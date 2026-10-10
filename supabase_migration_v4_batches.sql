-- ─── Espro POS: Database Migration v4 (Batches & FEFO Inventory) ───
-- Idempotent and safe to re-run in Supabase SQL Editor

-- ============================================================
-- 1. INGREDIENT BATCHES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS ingredient_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_received NUMERIC NOT NULL CHECK (quantity_received >= 0),
  quantity_remaining NUMERIC NOT NULL CHECK (quantity_remaining >= 0),
  cost_per_unit NUMERIC DEFAULT 0,
  received_at DATE NOT NULL DEFAULT CURRENT_DATE,
  expiration_date DATE NULL,
  supplier TEXT NULL,
  note TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'depleted', 'expired')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE ingredient_batches ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ingredient_batches' AND policyname = 'Allow public read access to ingredient_batches') THEN
    CREATE POLICY "Allow public read access to ingredient_batches" ON ingredient_batches FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ingredient_batches' AND policyname = 'Allow public insert access to ingredient_batches') THEN
    CREATE POLICY "Allow public insert access to ingredient_batches" ON ingredient_batches FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ingredient_batches' AND policyname = 'Allow public update access to ingredient_batches') THEN
    CREATE POLICY "Allow public update access to ingredient_batches" ON ingredient_batches FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ingredient_batches' AND policyname = 'Allow public delete access to ingredient_batches') THEN
    CREATE POLICY "Allow public delete access to ingredient_batches" ON ingredient_batches FOR DELETE USING (true);
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ingredient_batches_ing_status ON ingredient_batches (ingredient_id, status);
CREATE INDEX IF NOT EXISTS idx_ingredient_batches_fefo ON ingredient_batches (ingredient_id, status, expiration_date, received_at, created_at);


-- ============================================================
-- 2. SALE BATCH ALLOCATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS sale_batch_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id TEXT NOT NULL,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES ingredient_batches(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE sale_batch_allocations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sale_batch_allocations' AND policyname = 'Allow public read access to sale_batch_allocations') THEN
    CREATE POLICY "Allow public read access to sale_batch_allocations" ON sale_batch_allocations FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sale_batch_allocations' AND policyname = 'Allow public insert access to sale_batch_allocations') THEN
    CREATE POLICY "Allow public insert access to sale_batch_allocations" ON sale_batch_allocations FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sale_batch_allocations' AND policyname = 'Allow public update access to sale_batch_allocations') THEN
    CREATE POLICY "Allow public update access to sale_batch_allocations" ON sale_batch_allocations FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sale_batch_allocations' AND policyname = 'Allow public delete access to sale_batch_allocations') THEN
    CREATE POLICY "Allow public delete access to sale_batch_allocations" ON sale_batch_allocations FOR DELETE USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sale_batch_allocations_sale ON sale_batch_allocations(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_batch_allocations_batch ON sale_batch_allocations(batch_id);


-- ============================================================
-- 3. STOCK MOVEMENTS: ADD BATCH_ID
-- ============================================================
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES ingredient_batches(id) ON DELETE SET NULL;


-- ============================================================
-- 4. BACKFILL OPENING BALANCES
-- ============================================================
INSERT INTO ingredient_batches (
  ingredient_id,
  quantity_received,
  quantity_remaining,
  cost_per_unit,
  received_at,
  expiration_date,
  supplier,
  note,
  status
)
SELECT
  i.id,
  i.stock_quantity,
  i.stock_quantity,
  COALESCE(i.cost_per_unit, 0),
  COALESCE(i.created_at::date, CURRENT_DATE),
  i.expiration_date,
  'Initial Inventory',
  'Opening balance',
  'active'
FROM ingredients i
WHERE i.stock_quantity > 0
  AND NOT EXISTS (
    SELECT 1 FROM ingredient_batches b WHERE b.ingredient_id = i.id
  );


-- ============================================================
-- 5. TRIGGER ON INGREDIENT BATCHES TO SYNC INGREDIENT TOTALS
-- ============================================================
CREATE OR REPLACE FUNCTION sync_ingredient_totals_from_batches()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_ingredient_id UUID;
  v_total_stock NUMERIC;
  v_earliest_exp DATE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_ingredient_id := OLD.ingredient_id;
  ELSE
    v_ingredient_id := NEW.ingredient_id;
  END IF;

  SELECT
    COALESCE(SUM(quantity_remaining), 0),
    MIN(expiration_date)
  INTO v_total_stock, v_earliest_exp
  FROM ingredient_batches
  WHERE ingredient_id = v_ingredient_id
    AND status = 'active';

  UPDATE ingredients
  SET stock_quantity = v_total_stock,
      expiration_date = v_earliest_exp,
      updated_at = timezone('utc'::text, now())
  WHERE id = v_ingredient_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_ingredient_totals ON ingredient_batches;
CREATE TRIGGER trg_sync_ingredient_totals
AFTER INSERT OR UPDATE OR DELETE ON ingredient_batches
FOR EACH ROW
EXECUTE FUNCTION sync_ingredient_totals_from_batches();


-- ============================================================
-- 6. RPC: COMPLETE SALE WITH FEFO DEDUCTION & BATCH ALLOCATION
-- ============================================================
DROP FUNCTION IF EXISTS complete_sale_with_deduction(TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT);

CREATE OR REPLACE FUNCTION complete_sale_with_deduction(
  p_sale_id TEXT,
  p_items JSONB,
  p_subtotal NUMERIC,
  p_discount NUMERIC,
  p_total NUMERIC,
  p_payment_method TEXT,
  p_cashier_name TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  item_elem JSONB;
  deduct_elem JSONB;
  rec RECORD;
  batch_rec RECORD;
  v_needed NUMERIC;
  v_take NUMERIC;
  v_available NUMERIC;
BEGIN
  CREATE TEMPORARY TABLE IF NOT EXISTS temp_sale_deductions (
    ingredient_id UUID,
    quantity NUMERIC
  ) ON COMMIT DROP;

  TRUNCATE temp_sale_deductions;

  -- Phase 1: Collect total deductions per ingredient
  FOR item_elem IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF item_elem ? 'deductions' AND jsonb_typeof(item_elem->'deductions') = 'array' THEN
      FOR deduct_elem IN SELECT * FROM jsonb_array_elements(item_elem->'deductions')
      LOOP
        IF deduct_elem ? 'ingredient_id' AND (deduct_elem->>'ingredient_id') IS NOT NULL AND (deduct_elem->>'quantity')::NUMERIC > 0 THEN
          INSERT INTO temp_sale_deductions (ingredient_id, quantity)
          VALUES (
            (deduct_elem->>'ingredient_id')::UUID,
            (deduct_elem->>'quantity')::NUMERIC
          );
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  -- Phase 2: Lock batches and check stock feasibility
  FOR rec IN
    SELECT
      d.ingredient_id,
      SUM(d.quantity) AS total_needed,
      i.name AS ing_name,
      i.unit AS ing_unit
    FROM temp_sale_deductions d
    JOIN ingredients i ON i.id = d.ingredient_id
    GROUP BY d.ingredient_id, i.name, i.unit
  LOOP
    -- Lock active non-expired batches FOR UPDATE
    SELECT COALESCE(SUM(quantity_remaining), 0) INTO v_available
    FROM ingredient_batches
    WHERE ingredient_id = rec.ingredient_id
      AND status = 'active'
      AND (expiration_date IS NULL OR expiration_date >= CURRENT_DATE);

    IF v_available < rec.total_needed THEN
      RAISE EXCEPTION 'Insufficient stock for "%" — need % %, only % available',
        rec.ing_name, rec.total_needed, rec.ing_unit, v_available;
    END IF;
  END LOOP;

  -- Phase 3: Insert sale record
  INSERT INTO sales (id, items, subtotal, discount, total, payment_method, cashier_name, status, created_at)
  VALUES (
    p_sale_id,
    p_items,
    p_subtotal,
    p_discount,
    p_total,
    p_payment_method,
    p_cashier_name,
    'completed',
    timezone('utc'::text, now())
  );

  -- Phase 4: FEFO Batch Allocation & Movement Logging
  FOR rec IN
    SELECT
      ingredient_id,
      SUM(quantity) AS total_needed
    FROM temp_sale_deductions
    GROUP BY ingredient_id
  LOOP
    v_needed := rec.total_needed;

    -- Allocate in FEFO order: earliest expiration date first, then oldest received
    FOR batch_rec IN
      SELECT id, quantity_remaining
      FROM ingredient_batches
      WHERE ingredient_id = rec.ingredient_id
        AND status = 'active'
        AND (expiration_date IS NULL OR expiration_date >= CURRENT_DATE)
      ORDER BY expiration_date ASC NULLS LAST, received_at ASC, created_at ASC
      FOR UPDATE
    LOOP
      IF v_needed <= 0 THEN
        EXIT;
      END IF;

      v_take := LEAST(v_needed, batch_rec.quantity_remaining);

      -- Update batch
      UPDATE ingredient_batches
      SET quantity_remaining = quantity_remaining - v_take,
          status = CASE WHEN quantity_remaining - v_take = 0 THEN 'depleted' ELSE 'active' END
      WHERE id = batch_rec.id;

      -- Log allocation
      INSERT INTO sale_batch_allocations (
        sale_id,
        ingredient_id,
        batch_id,
        quantity
      ) VALUES (
        p_sale_id,
        rec.ingredient_id,
        batch_rec.id,
        v_take
      );

      -- Log movement
      INSERT INTO stock_movements (
        ingredient_id,
        batch_id,
        change_qty,
        type,
        reason,
        reference_id,
        created_by,
        created_at
      ) VALUES (
        rec.ingredient_id,
        batch_rec.id,
        -v_take,
        'sale',
        'POS Sale ' || p_sale_id,
        p_sale_id,
        p_cashier_name,
        timezone('utc'::text, now())
      );

      v_needed := v_needed - v_take;
    END LOOP;
  END LOOP;

  RETURN p_sale_id;
END;
$$;


-- ============================================================
-- 7. RPC: VOID SALE WITH RESTORATION TO ORIGINAL BATCHES
-- ============================================================
DROP FUNCTION IF EXISTS void_sale_with_restoration(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION void_sale_with_restoration(
  p_sale_id TEXT,
  p_status TEXT,       -- 'voided' or 'refunded'
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  sale_record RECORD;
  alloc_rec RECORD;
  has_allocations BOOLEAN := false;
BEGIN
  SELECT * INTO sale_record FROM sales WHERE id = p_sale_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale "%" not found', p_sale_id;
  END IF;

  IF sale_record.status != 'completed' THEN
    RAISE EXCEPTION 'Sale "%" is already %', p_sale_id, sale_record.status;
  END IF;

  -- Update status
  UPDATE sales
  SET status = p_status,
      void_reason = p_reason
  WHERE id = p_sale_id;

  -- Check if sale has batch allocations
  SELECT EXISTS(SELECT 1 FROM sale_batch_allocations WHERE sale_id = p_sale_id) INTO has_allocations;

  IF NOT has_allocations THEN
    -- Legacy sales without batch allocations
    RETURN jsonb_build_object('restored', false);
  END IF;

  -- Restore stock to original batches
  FOR alloc_rec IN
    SELECT
      a.id,
      a.ingredient_id,
      a.batch_id,
      a.quantity,
      b.expiration_date,
      b.quantity_remaining
    FROM sale_batch_allocations a
    JOIN ingredient_batches b ON b.id = a.batch_id
    WHERE a.sale_id = p_sale_id
    FOR UPDATE OF b
  LOOP
    -- Restore quantity to batch: if batch is expired, status remains 'expired', else 'active'
    UPDATE ingredient_batches
    SET quantity_remaining = quantity_remaining + alloc_rec.quantity,
        status = CASE
          WHEN alloc_rec.expiration_date IS NOT NULL AND alloc_rec.expiration_date < CURRENT_DATE THEN 'expired'
          ELSE 'active'
        END
    WHERE id = alloc_rec.batch_id;

    -- Log movement
    INSERT INTO stock_movements (
      ingredient_id,
      batch_id,
      change_qty,
      type,
      reason,
      reference_id,
      created_by,
      created_at
    ) VALUES (
      alloc_rec.ingredient_id,
      alloc_rec.batch_id,
      alloc_rec.quantity,
      'void_restore',
      p_reason,
      p_sale_id,
      sale_record.cashier_name,
      timezone('utc'::text, now())
    );
  END LOOP;

  RETURN jsonb_build_object('restored', true);
END;
$$;


-- ============================================================
-- 8. RPC: ADJUST INGREDIENT STOCK (BATCH-AWARE)
-- ============================================================
CREATE OR REPLACE FUNCTION adjust_ingredient_stock(
  p_ingredient_id UUID,
  p_quantity NUMERIC,
  p_type TEXT,
  p_reason TEXT,
  p_created_by TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_curr_stock NUMERIC;
  v_new_stock NUMERIC;
  v_diff NUMERIC;
  v_needed NUMERIC;
  v_take NUMERIC;
  v_new_batch_id UUID;
  batch_rec RECORD;
  v_cost NUMERIC;
BEGIN
  SELECT stock_quantity, COALESCE(cost_per_unit, 0)
  INTO v_curr_stock, v_cost
  FROM ingredients
  WHERE id = p_ingredient_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ingredient not found';
  END IF;

  IF p_type = 'add' THEN
    IF p_quantity <= 0 THEN
      RETURN v_curr_stock;
    END IF;

    -- Create new batch for addition
    INSERT INTO ingredient_batches (
      ingredient_id,
      quantity_received,
      quantity_remaining,
      cost_per_unit,
      received_at,
      expiration_date,
      note,
      status
    ) VALUES (
      p_ingredient_id,
      p_quantity,
      p_quantity,
      v_cost,
      CURRENT_DATE,
      NULL,
      p_reason,
      'active'
    ) RETURNING id INTO v_new_batch_id;

    INSERT INTO stock_movements (
      ingredient_id,
      batch_id,
      change_qty,
      type,
      reason,
      created_by,
      created_at
    ) VALUES (
      p_ingredient_id,
      v_new_batch_id,
      p_quantity,
      'adjust',
      p_reason,
      p_created_by,
      timezone('utc'::text, now())
    );

  ELSIF p_type = 'reduce' THEN
    IF p_quantity <= 0 THEN
      RETURN v_curr_stock;
    END IF;

    v_needed := p_quantity;

    -- Consume FEFO from active batches
    FOR batch_rec IN
      SELECT id, quantity_remaining
      FROM ingredient_batches
      WHERE ingredient_id = p_ingredient_id
        AND status = 'active'
      ORDER BY expiration_date ASC NULLS LAST, received_at ASC, created_at ASC
      FOR UPDATE
    LOOP
      IF v_needed <= 0 THEN
        EXIT;
      END IF;

      v_take := LEAST(v_needed, batch_rec.quantity_remaining);

      UPDATE ingredient_batches
      SET quantity_remaining = quantity_remaining - v_take,
          status = CASE WHEN quantity_remaining - v_take = 0 THEN 'depleted' ELSE 'active' END
      WHERE id = batch_rec.id;

      INSERT INTO stock_movements (
        ingredient_id,
        batch_id,
        change_qty,
        type,
        reason,
        created_by,
        created_at
      ) VALUES (
        p_ingredient_id,
        batch_rec.id,
        -v_take,
        'adjust',
        p_reason,
        p_created_by,
        timezone('utc'::text, now())
      );

      v_needed := v_needed - v_take;
    END LOOP;

  ELSIF p_type = 'set' THEN
    v_diff := p_quantity - v_curr_stock;

    IF v_diff > 0 THEN
      -- Add difference as new batch
      INSERT INTO ingredient_batches (
        ingredient_id,
        quantity_received,
        quantity_remaining,
        cost_per_unit,
        received_at,
        expiration_date,
        note,
        status
      ) VALUES (
        p_ingredient_id,
        v_diff,
        v_diff,
        v_cost,
        CURRENT_DATE,
        NULL,
        p_reason,
        'active'
      ) RETURNING id INTO v_new_batch_id;

      INSERT INTO stock_movements (
        ingredient_id,
        batch_id,
        change_qty,
        type,
        reason,
        created_by,
        created_at
      ) VALUES (
        p_ingredient_id,
        v_new_batch_id,
        v_diff,
        'adjust',
        p_reason,
        p_created_by,
        timezone('utc'::text, now())
      );

    ELSIF v_diff < 0 THEN
      -- Reduce difference FEFO
      v_needed := ABS(v_diff);

      FOR batch_rec IN
        SELECT id, quantity_remaining
        FROM ingredient_batches
        WHERE ingredient_id = p_ingredient_id
          AND status = 'active'
        ORDER BY expiration_date ASC NULLS LAST, received_at ASC, created_at ASC
        FOR UPDATE
      LOOP
        IF v_needed <= 0 THEN
          EXIT;
        END IF;

        v_take := LEAST(v_needed, batch_rec.quantity_remaining);

        UPDATE ingredient_batches
        SET quantity_remaining = quantity_remaining - v_take,
            status = CASE WHEN quantity_remaining - v_take = 0 THEN 'depleted' ELSE 'active' END
        WHERE id = batch_rec.id;

        INSERT INTO stock_movements (
          ingredient_id,
          batch_id,
          change_qty,
          type,
          reason,
          created_by,
          created_at
        ) VALUES (
          p_ingredient_id,
          batch_rec.id,
          -v_take,
          'adjust',
          p_reason,
          p_created_by,
          timezone('utc'::text, now())
        );

        v_needed := v_needed - v_take;
      END LOOP;
    END IF;

  ELSE
    RAISE EXCEPTION 'Invalid adjustment type: %', p_type;
  END IF;

  -- Re-query current total stock
  SELECT COALESCE(stock_quantity, 0) INTO v_new_stock
  FROM ingredients
  WHERE id = p_ingredient_id;

  RETURN v_new_stock;
END;
$$;


-- ============================================================
-- 9. RPC: RESTOCK INGREDIENT
-- ============================================================
CREATE OR REPLACE FUNCTION restock_ingredient(
  p_ingredient_id UUID,
  p_quantity NUMERIC,
  p_cost NUMERIC DEFAULT 0,
  p_received DATE DEFAULT CURRENT_DATE,
  p_expiration DATE DEFAULT NULL,
  p_supplier TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_created_by TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_batch_id UUID;
  v_batch_row RECORD;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Restock quantity must be greater than zero';
  END IF;

  -- Insert the batch
  INSERT INTO ingredient_batches (
    ingredient_id,
    quantity_received,
    quantity_remaining,
    cost_per_unit,
    received_at,
    expiration_date,
    supplier,
    note,
    status
  ) VALUES (
    p_ingredient_id,
    p_quantity,
    p_quantity,
    COALESCE(p_cost, 0),
    COALESCE(p_received, CURRENT_DATE),
    p_expiration,
    p_supplier,
    p_note,
    'active'
  ) RETURNING * INTO v_batch_row;

  -- Update ingredient cost if specified
  IF p_cost IS NOT NULL AND p_cost > 0 THEN
    UPDATE ingredients
    SET cost_per_unit = p_cost
    WHERE id = p_ingredient_id;
  END IF;

  -- Log restock movement
  INSERT INTO stock_movements (
    ingredient_id,
    batch_id,
    change_qty,
    type,
    reason,
    created_by,
    created_at
  ) VALUES (
    p_ingredient_id,
    v_batch_row.id,
    p_quantity,
    'restock',
    COALESCE(p_note, 'Restock delivery'),
    p_created_by,
    timezone('utc'::text, now())
  );

  RETURN to_jsonb(v_batch_row);
END;
$$;


-- ============================================================
-- 10. RPC: EXPIRE BATCHES (AUTO-DEDUCT WRITE-OFF)
-- ============================================================
CREATE OR REPLACE FUNCTION expire_batches()
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  batch_rec RECORD;
  v_count INT := 0;
BEGIN
  FOR batch_rec IN
    SELECT b.id, b.ingredient_id, b.quantity_remaining, b.expiration_date
    FROM ingredient_batches b
    JOIN ingredients i ON i.id = b.ingredient_id
    WHERE b.status = 'active'
      AND b.quantity_remaining > 0
      AND b.expiration_date IS NOT NULL
      AND b.expiration_date < CURRENT_DATE
      AND i.auto_deduct_expired = true
    FOR UPDATE OF b
  LOOP
    -- Zero remaining quantity and mark expired
    UPDATE ingredient_batches
    SET quantity_remaining = 0,
        status = 'expired'
    WHERE id = batch_rec.id;

    -- Log expiration movement
    INSERT INTO stock_movements (
      ingredient_id,
      batch_id,
      change_qty,
      type,
      reason,
      created_at
    ) VALUES (
      batch_rec.ingredient_id,
      batch_rec.id,
      -batch_rec.quantity_remaining,
      'expired',
      'Batch expired on ' || batch_rec.expiration_date,
      timezone('utc'::text, now())
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
