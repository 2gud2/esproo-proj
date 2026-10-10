-- ─── Espro POS: Database Migration v5 (Sizes, Addons, Order Supplies, Enhanced Sales) ───
-- Idempotent and safe to re-run in Supabase SQL Editor

-- ============================================================
-- 1. INGREDIENTS: ADD item_type
-- ============================================================
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'ingredient';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ingredients_item_type_check'
  ) THEN
    ALTER TABLE ingredients ADD CONSTRAINT ingredients_item_type_check CHECK (item_type IN ('ingredient', 'supply'));
  END IF;
END $$;


-- ============================================================
-- 2. MENU ITEM SIZES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS menu_item_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  ingredient_multiplier NUMERIC NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE menu_item_sizes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'menu_item_sizes' AND policyname = 'Allow public read access to menu_item_sizes') THEN
    CREATE POLICY "Allow public read access to menu_item_sizes" ON menu_item_sizes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'menu_item_sizes' AND policyname = 'Allow public insert access to menu_item_sizes') THEN
    CREATE POLICY "Allow public insert access to menu_item_sizes" ON menu_item_sizes FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'menu_item_sizes' AND policyname = 'Allow public update access to menu_item_sizes') THEN
    CREATE POLICY "Allow public update access to menu_item_sizes" ON menu_item_sizes FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'menu_item_sizes' AND policyname = 'Allow public delete access to menu_item_sizes') THEN
    CREATE POLICY "Allow public delete access to menu_item_sizes" ON menu_item_sizes FOR DELETE USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_menu_item_sizes_item ON menu_item_sizes(menu_item_id);


-- ============================================================
-- 3. MENU ITEM INGREDIENTS: ADD size_id & usage_scope
-- ============================================================
ALTER TABLE menu_item_ingredients ADD COLUMN IF NOT EXISTS size_id UUID NULL REFERENCES menu_item_sizes(id) ON DELETE CASCADE;
ALTER TABLE menu_item_ingredients ADD COLUMN IF NOT EXISTS usage_scope TEXT NOT NULL DEFAULT 'always';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'menu_item_ingredients_usage_scope_check'
  ) THEN
    ALTER TABLE menu_item_ingredients ADD CONSTRAINT menu_item_ingredients_usage_scope_check CHECK (usage_scope IN ('always', 'takeout', 'dine_in'));
  END IF;
END $$;

-- Drop legacy unique constraint on (menu_item_id, ingredient_id) if it exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'menu_item_ingredients_menu_item_id_ingredient_id_key'
  ) THEN
    ALTER TABLE menu_item_ingredients DROP CONSTRAINT menu_item_ingredients_menu_item_id_ingredient_id_key;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_menu_item_ingredients_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_item_ingredients_scoped_unique
ON menu_item_ingredients (menu_item_id, ingredient_id, COALESCE(size_id, '00000000-0000-0000-0000-000000000000'::uuid), usage_scope);


-- ============================================================
-- 4. ADDONS & ADDON INGREDIENTS TABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  applies_to_categories TEXT[] NOT NULL DEFAULT '{}',
  applies_to_items UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE addons ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'addons' AND policyname = 'Allow public read access to addons') THEN
    CREATE POLICY "Allow public read access to addons" ON addons FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'addons' AND policyname = 'Allow public insert access to addons') THEN
    CREATE POLICY "Allow public insert access to addons" ON addons FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'addons' AND policyname = 'Allow public update access to addons') THEN
    CREATE POLICY "Allow public update access to addons" ON addons FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'addons' AND policyname = 'Allow public delete access to addons') THEN
    CREATE POLICY "Allow public delete access to addons" ON addons FOR DELETE USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS addon_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_id UUID NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity_used NUMERIC NOT NULL CHECK (quantity_used > 0),
  unit TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE addon_ingredients ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'addon_ingredients' AND policyname = 'Allow public read access to addon_ingredients') THEN
    CREATE POLICY "Allow public read access to addon_ingredients" ON addon_ingredients FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'addon_ingredients' AND policyname = 'Allow public insert access to addon_ingredients') THEN
    CREATE POLICY "Allow public insert access to addon_ingredients" ON addon_ingredients FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'addon_ingredients' AND policyname = 'Allow public update access to addon_ingredients') THEN
    CREATE POLICY "Allow public update access to addon_ingredients" ON addon_ingredients FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'addon_ingredients' AND policyname = 'Allow public delete access to addon_ingredients') THEN
    CREATE POLICY "Allow public delete access to addon_ingredients" ON addon_ingredients FOR DELETE USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_addon_ingredients_addon ON addon_ingredients(addon_id);
CREATE INDEX IF NOT EXISTS idx_addon_ingredients_ingredient ON addon_ingredients(ingredient_id);


-- ============================================================
-- 5. ORDER SUPPLY RULES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS order_supply_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity_used NUMERIC NOT NULL CHECK (quantity_used > 0),
  unit TEXT NOT NULL,
  order_type TEXT NOT NULL DEFAULT 'takeout' CHECK (order_type IN ('takeout', 'dine_in', 'all')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE order_supply_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_supply_rules' AND policyname = 'Allow public read access to order_supply_rules') THEN
    CREATE POLICY "Allow public read access to order_supply_rules" ON order_supply_rules FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_supply_rules' AND policyname = 'Allow public insert access to order_supply_rules') THEN
    CREATE POLICY "Allow public insert access to order_supply_rules" ON order_supply_rules FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_supply_rules' AND policyname = 'Allow public update access to order_supply_rules') THEN
    CREATE POLICY "Allow public update access to order_supply_rules" ON order_supply_rules FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_supply_rules' AND policyname = 'Allow public delete access to order_supply_rules') THEN
    CREATE POLICY "Allow public delete access to order_supply_rules" ON order_supply_rules FOR DELETE USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_supply_rules_ingredient ON order_supply_rules(ingredient_id);


-- ============================================================
-- 6. SALES TABLE: ADD NEW COLUMNS
-- ============================================================
ALTER TABLE sales ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'dine_in';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS order_deductions JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS order_supplies_cogs NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS amount_tendered NUMERIC NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS change_due NUMERIC NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_order_type_check'
  ) THEN
    ALTER TABLE sales ADD CONSTRAINT sales_order_type_check CHECK (order_type IN ('dine_in', 'takeout'));
  END IF;
END $$;


-- ============================================================
-- 7. RPC: SAVE MENU ITEM CONFIG (ATOMIC TRANSACTION)
-- ============================================================
CREATE OR REPLACE FUNCTION save_menu_item_config(
  p_menu_item_id UUID,
  p_sizes JSONB,
  p_rows JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  s JSONB;
  r JSONB;
BEGIN
  -- 1. Replace sizes
  DELETE FROM menu_item_sizes WHERE menu_item_id = p_menu_item_id;

  IF p_sizes IS NOT NULL AND jsonb_typeof(p_sizes) = 'array' AND jsonb_array_length(p_sizes) > 0 THEN
    FOR s IN SELECT * FROM jsonb_array_elements(p_sizes)
    LOOP
      INSERT INTO menu_item_sizes (
        id,
        menu_item_id,
        name,
        price,
        ingredient_multiplier,
        sort_order,
        is_default,
        is_active
      ) VALUES (
        COALESCE((s->>'id')::UUID, gen_random_uuid()),
        p_menu_item_id,
        s->>'name',
        (s->>'price')::NUMERIC,
        COALESCE((s->>'ingredient_multiplier')::NUMERIC, 1),
        COALESCE((s->>'sort_order')::INT, 0),
        COALESCE((s->>'is_default')::BOOLEAN, false),
        COALESCE((s->>'is_active')::BOOLEAN, true)
      );
    END LOOP;
  END IF;

  -- 2. Replace recipe rows
  DELETE FROM menu_item_ingredients WHERE menu_item_id = p_menu_item_id;

  IF p_rows IS NOT NULL AND jsonb_typeof(p_rows) = 'array' AND jsonb_array_length(p_rows) > 0 THEN
    FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
    LOOP
      INSERT INTO menu_item_ingredients (
        id,
        menu_item_id,
        ingredient_id,
        quantity_used,
        unit,
        size_id,
        usage_scope
      ) VALUES (
        COALESCE((r->>'id')::UUID, gen_random_uuid()),
        p_menu_item_id,
        (r->>'ingredient_id')::UUID,
        (r->>'quantity_used')::NUMERIC,
        r->>'unit',
        CASE WHEN (r->>'size_id') IS NOT NULL AND (r->>'size_id') <> '' THEN (r->>'size_id')::UUID ELSE NULL END,
        COALESCE(r->>'usage_scope', 'always')
      );
    END LOOP;
  END IF;
END;
$$;


-- ============================================================
-- 8. RPC: SAVE ADDON & SAVE ORDER SUPPLY RULES (ATOMIC)
-- ============================================================
CREATE OR REPLACE FUNCTION save_addon(
  p_addon JSONB,
  p_rows JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_addon_id UUID;
  r JSONB;
BEGIN
  v_addon_id := COALESCE((p_addon->>'id')::UUID, gen_random_uuid());

  INSERT INTO addons (
    id,
    name,
    price,
    is_active,
    applies_to_categories,
    applies_to_items
  ) VALUES (
    v_addon_id,
    p_addon->>'name',
    COALESCE((p_addon->>'price')::NUMERIC, 0),
    COALESCE((p_addon->>'is_active')::BOOLEAN, true),
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(p_addon->'applies_to_categories')),
      '{}'::TEXT[]
    ),
    COALESCE(
      ARRAY(SELECT (jsonb_array_elements_text(p_addon->'applies_to_items'))::UUID),
      '{}'::UUID[]
    )
  )
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      price = EXCLUDED.price,
      is_active = EXCLUDED.is_active,
      applies_to_categories = EXCLUDED.applies_to_categories,
      applies_to_items = EXCLUDED.applies_to_items;

  DELETE FROM addon_ingredients WHERE addon_id = v_addon_id;

  IF p_rows IS NOT NULL AND jsonb_typeof(p_rows) = 'array' AND jsonb_array_length(p_rows) > 0 THEN
    FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
    LOOP
      INSERT INTO addon_ingredients (
        id,
        addon_id,
        ingredient_id,
        quantity_used,
        unit
      ) VALUES (
        COALESCE((r->>'id')::UUID, gen_random_uuid()),
        v_addon_id,
        (r->>'ingredient_id')::UUID,
        (r->>'quantity_used')::NUMERIC,
        r->>'unit'
      );
    END LOOP;
  END IF;

  RETURN v_addon_id;
END;
$$;

CREATE OR REPLACE FUNCTION save_order_supply_rules(
  p_rows JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  r JSONB;
BEGIN
  DELETE FROM order_supply_rules WHERE id IS NOT NULL;

  IF p_rows IS NOT NULL AND jsonb_typeof(p_rows) = 'array' AND jsonb_array_length(p_rows) > 0 THEN
    FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
    LOOP
      INSERT INTO order_supply_rules (
        id,
        ingredient_id,
        quantity_used,
        unit,
        order_type,
        is_active
      ) VALUES (
        COALESCE((r->>'id')::UUID, gen_random_uuid()),
        (r->>'ingredient_id')::UUID,
        (r->>'quantity_used')::NUMERIC,
        r->>'unit',
        COALESCE(r->>'order_type', 'takeout'),
        COALESCE((r->>'is_active')::BOOLEAN, true)
      );
    END LOOP;
  END IF;
END;
$$;


-- ============================================================
-- 9. RPC: COMPLETE SALE WITH DEDUCTION (FEFO BATCHES + ORDER OPTIONS)
-- ============================================================
DROP FUNCTION IF EXISTS complete_sale_with_deduction(TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS complete_sale_with_deduction(TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION complete_sale_with_deduction(
  p_sale_id TEXT,
  p_items JSONB,
  p_subtotal NUMERIC,
  p_discount NUMERIC,
  p_total NUMERIC,
  p_payment_method TEXT,
  p_cashier_name TEXT,
  p_order_type TEXT DEFAULT 'dine_in',
  p_order_deductions JSONB DEFAULT '[]'::jsonb,
  p_order_supplies_cogs NUMERIC DEFAULT 0,
  p_amount_tendered NUMERIC DEFAULT NULL,
  p_change_due NUMERIC DEFAULT NULL
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
  v_has_batches BOOLEAN := false;
BEGIN
  CREATE TEMPORARY TABLE IF NOT EXISTS temp_sale_deductions (
    ingredient_id UUID,
    quantity NUMERIC
  ) ON COMMIT DROP;

  TRUNCATE temp_sale_deductions;

  -- Phase 1a: Collect line item deductions
  IF p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' THEN
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
  END IF;

  -- Phase 1b: Collect order-level supply deductions
  IF p_order_deductions IS NOT NULL AND jsonb_typeof(p_order_deductions) = 'array' THEN
    FOR deduct_elem IN SELECT * FROM jsonb_array_elements(p_order_deductions)
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

  -- Phase 2: Check if batches table exists & lock rows to check feasibility
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'ingredient_batches'
  ) INTO v_has_batches;

  FOR rec IN
    SELECT
      d.ingredient_id,
      SUM(d.quantity) AS total_needed,
      i.name AS ing_name,
      i.unit AS ing_unit,
      i.stock_quantity AS curr_stock
    FROM temp_sale_deductions d
    JOIN ingredients i ON i.id = d.ingredient_id
    GROUP BY d.ingredient_id, i.name, i.unit, i.stock_quantity
  LOOP
    IF v_has_batches THEN
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
    ELSE
      PERFORM 1 FROM ingredients WHERE id = rec.ingredient_id FOR UPDATE;
      IF rec.curr_stock < rec.total_needed THEN
        RAISE EXCEPTION 'Insufficient stock for "%" — need % %, only % available',
          rec.ing_name, rec.total_needed, rec.ing_unit, rec.curr_stock;
      END IF;
    END IF;
  END LOOP;

  -- Phase 3: Insert sale record
  INSERT INTO sales (
    id,
    items,
    subtotal,
    discount,
    total,
    payment_method,
    cashier_name,
    status,
    order_type,
    order_deductions,
    order_supplies_cogs,
    amount_tendered,
    change_due,
    created_at
  )
  VALUES (
    p_sale_id,
    p_items,
    p_subtotal,
    p_discount,
    p_total,
    p_payment_method,
    p_cashier_name,
    'completed',
    COALESCE(p_order_type, 'dine_in'),
    COALESCE(p_order_deductions, '[]'::jsonb),
    COALESCE(p_order_supplies_cogs, 0),
    p_amount_tendered,
    p_change_due,
    timezone('utc'::text, now())
  );

  -- Phase 4: Deduction & Movement Logging
  IF v_has_batches THEN
    -- FEFO Batch Allocation
    FOR rec IN
      SELECT
        ingredient_id,
        SUM(quantity) AS total_needed
      FROM temp_sale_deductions
      GROUP BY ingredient_id
    LOOP
      v_needed := rec.total_needed;

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

        UPDATE ingredient_batches
        SET quantity_remaining = quantity_remaining - v_take,
            status = CASE WHEN quantity_remaining - v_take = 0 THEN 'depleted' ELSE 'active' END
        WHERE id = batch_rec.id;

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
  ELSE
    -- Direct ingredients table deduction
    FOR rec IN
      SELECT
        ingredient_id,
        SUM(quantity) AS total_needed
      FROM temp_sale_deductions
      GROUP BY ingredient_id
    LOOP
      UPDATE ingredients
      SET stock_quantity = stock_quantity - rec.total_needed,
          updated_at = timezone('utc'::text, now())
      WHERE id = rec.ingredient_id;

      INSERT INTO stock_movements (
        ingredient_id,
        change_qty,
        type,
        reason,
        reference_id,
        created_by,
        created_at
      ) VALUES (
        rec.ingredient_id,
        -rec.total_needed,
        'sale',
        'POS Sale ' || p_sale_id,
        p_sale_id,
        p_cashier_name,
        timezone('utc'::text, now())
      );
    END LOOP;
  END IF;

  RETURN p_sale_id;
END;
$$;


-- ============================================================
-- 10. RPC: VOID SALE WITH RESTORATION (INCLUDES ORDER DEDUCTIONS)
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
  v_has_batches BOOLEAN := false;
  item_elem JSONB;
  deduct_elem JSONB;
  has_direct_deductions BOOLEAN := false;
BEGIN
  SELECT * INTO sale_record FROM sales WHERE id = p_sale_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale "%" not found', p_sale_id;
  END IF;

  IF sale_record.status != 'completed' THEN
    RAISE EXCEPTION 'Sale "%" is already %', p_sale_id, sale_record.status;
  END IF;

  UPDATE sales
  SET status = p_status,
      void_reason = p_reason
  WHERE id = p_sale_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'sale_batch_allocations'
  ) INTO v_has_batches;

  IF v_has_batches THEN
    SELECT EXISTS(SELECT 1 FROM sale_batch_allocations WHERE sale_id = p_sale_id) INTO has_allocations;

    IF has_allocations THEN
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
        UPDATE ingredient_batches
        SET quantity_remaining = quantity_remaining + alloc_rec.quantity,
            status = CASE
              WHEN alloc_rec.expiration_date IS NOT NULL AND alloc_rec.expiration_date < CURRENT_DATE THEN 'expired'
              ELSE 'active'
            END
        WHERE id = alloc_rec.batch_id;

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
    END IF;
  END IF;

  -- Fallback for legacy sales or installations without batch allocations:
  CREATE TEMPORARY TABLE IF NOT EXISTS temp_void_restorations (
    ingredient_id UUID,
    quantity NUMERIC
  ) ON COMMIT DROP;

  TRUNCATE temp_void_restorations;

  IF sale_record.items IS NOT NULL AND jsonb_typeof(sale_record.items) = 'array' THEN
    FOR item_elem IN SELECT * FROM jsonb_array_elements(sale_record.items)
    LOOP
      IF item_elem ? 'deductions' AND jsonb_typeof(item_elem->'deductions') = 'array' THEN
        FOR deduct_elem IN SELECT * FROM jsonb_array_elements(item_elem->'deductions')
        LOOP
          IF deduct_elem ? 'ingredient_id' AND (deduct_elem->>'ingredient_id') IS NOT NULL AND (deduct_elem->>'quantity')::NUMERIC > 0 THEN
            INSERT INTO temp_void_restorations (ingredient_id, quantity)
            VALUES (
              (deduct_elem->>'ingredient_id')::UUID,
              (deduct_elem->>'quantity')::NUMERIC
            );
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- Also restore order-level supply deductions
  IF sale_record.order_deductions IS NOT NULL AND jsonb_typeof(sale_record.order_deductions) = 'array' THEN
    FOR deduct_elem IN SELECT * FROM jsonb_array_elements(sale_record.order_deductions)
    LOOP
      IF deduct_elem ? 'ingredient_id' AND (deduct_elem->>'ingredient_id') IS NOT NULL AND (deduct_elem->>'quantity')::NUMERIC > 0 THEN
        INSERT INTO temp_void_restorations (ingredient_id, quantity)
        VALUES (
          (deduct_elem->>'ingredient_id')::UUID,
          (deduct_elem->>'quantity')::NUMERIC
        );
      END IF;
    END LOOP;
  END IF;

  SELECT EXISTS(SELECT 1 FROM temp_void_restorations) INTO has_direct_deductions;

  IF NOT has_direct_deductions THEN
    RETURN jsonb_build_object('restored', false);
  END IF;

  FOR alloc_rec IN
    SELECT
      ingredient_id,
      SUM(quantity) AS total_restore
    FROM temp_void_restorations
    GROUP BY ingredient_id
  LOOP
    UPDATE ingredients
    SET stock_quantity = stock_quantity + alloc_rec.total_restore,
        updated_at = timezone('utc'::text, now())
    WHERE id = alloc_rec.ingredient_id;

    INSERT INTO stock_movements (
      ingredient_id,
      change_qty,
      type,
      reason,
      reference_id,
      created_by,
      created_at
    ) VALUES (
      alloc_rec.ingredient_id,
      alloc_rec.total_restore,
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
