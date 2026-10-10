-- ─── Espro POS: Database Migration v3 ───
-- Idempotent and safe to re-run in Supabase SQL Editor

-- ============================================================
-- 1. INGREDIENTS TABLE UPDATES
-- ============================================================
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC DEFAULT 0;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS expiration_date DATE;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS auto_deduct_expired BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 2. CREATE TABLES: expenses, menu_categories, stock_movements
-- ============================================================

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expenses' AND policyname = 'Allow public read access to expenses') THEN
    CREATE POLICY "Allow public read access to expenses" ON expenses FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expenses' AND policyname = 'Allow public insert access to expenses') THEN
    CREATE POLICY "Allow public insert access to expenses" ON expenses FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expenses' AND policyname = 'Allow public update access to expenses') THEN
    CREATE POLICY "Allow public update access to expenses" ON expenses FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expenses' AND policyname = 'Allow public delete access to expenses') THEN
    CREATE POLICY "Allow public delete access to expenses" ON expenses FOR DELETE USING (true);
  END IF;
END $$;

-- Menu Categories Table
CREATE TABLE IF NOT EXISTS menu_categories (
  name TEXT PRIMARY KEY,
  sort_order INT DEFAULT 0
);

ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'menu_categories' AND policyname = 'Allow public read access to menu_categories') THEN
    CREATE POLICY "Allow public read access to menu_categories" ON menu_categories FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'menu_categories' AND policyname = 'Allow public insert access to menu_categories') THEN
    CREATE POLICY "Allow public insert access to menu_categories" ON menu_categories FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'menu_categories' AND policyname = 'Allow public update access to menu_categories') THEN
    CREATE POLICY "Allow public update access to menu_categories" ON menu_categories FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'menu_categories' AND policyname = 'Allow public delete access to menu_categories') THEN
    CREATE POLICY "Allow public delete access to menu_categories" ON menu_categories FOR DELETE USING (true);
  END IF;
END $$;

-- Stock Movements Table
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  change_qty NUMERIC NOT NULL,
  type TEXT NOT NULL, /* sale | void_restore | restock | spoilage | expired | count | adjust */
  reason TEXT,
  reference_id TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stock_movements' AND policyname = 'Allow public read access to stock_movements') THEN
    CREATE POLICY "Allow public read access to stock_movements" ON stock_movements FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stock_movements' AND policyname = 'Allow public insert access to stock_movements') THEN
    CREATE POLICY "Allow public insert access to stock_movements" ON stock_movements FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stock_movements' AND policyname = 'Allow public update access to stock_movements') THEN
    CREATE POLICY "Allow public update access to stock_movements" ON stock_movements FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stock_movements' AND policyname = 'Allow public delete access to stock_movements') THEN
    CREATE POLICY "Allow public delete access to stock_movements" ON stock_movements FOR DELETE USING (true);
  END IF;
END $$;


-- ============================================================
-- 3. RPC: COMPLETE SALE WITH DEDUCTION
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
BEGIN
  CREATE TEMPORARY TABLE IF NOT EXISTS temp_sale_deductions (
    ingredient_id UUID,
    quantity NUMERIC
  ) ON COMMIT DROP;

  TRUNCATE temp_sale_deductions;

  -- Phase 1: Collect deductions from p_items JSON
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

  -- Phase 2: Lock ingredient rows FOR UPDATE and validate stock
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
    PERFORM 1 FROM ingredients WHERE id = rec.ingredient_id FOR UPDATE;

    IF rec.curr_stock < rec.total_needed THEN
      RAISE EXCEPTION 'Insufficient stock for "%" — need % %, only % available',
        rec.ing_name, rec.total_needed, rec.ing_unit, rec.curr_stock;
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

  -- Phase 4: Decrement stock & write stock movements
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
    )
    VALUES (
      rec.ingredient_id,
      -rec.total_needed,
      'sale',
      'POS Sale ' || p_sale_id,
      p_sale_id,
      p_cashier_name,
      timezone('utc'::text, now())
    );
  END LOOP;

  RETURN p_sale_id;
END;
$$;


-- ============================================================
-- 4. RPC: VOID SALE WITH RESTORATION
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
  item_elem JSONB;
  deduct_elem JSONB;
  has_deductions BOOLEAN := false;
  rec RECORD;
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

  CREATE TEMPORARY TABLE IF NOT EXISTS temp_void_restorations (
    ingredient_id UUID,
    quantity NUMERIC
  ) ON COMMIT DROP;

  TRUNCATE temp_void_restorations;

  -- Extract deductions
  FOR item_elem IN SELECT * FROM jsonb_array_elements(sale_record.items)
  LOOP
    IF item_elem ? 'deductions' AND jsonb_typeof(item_elem->'deductions') = 'array' THEN
      FOR deduct_elem IN SELECT * FROM jsonb_array_elements(item_elem->'deductions')
      LOOP
        IF deduct_elem ? 'ingredient_id' AND (deduct_elem->>'ingredient_id') IS NOT NULL AND (deduct_elem->>'quantity')::NUMERIC > 0 THEN
          has_deductions := true;
          INSERT INTO temp_void_restorations (ingredient_id, quantity)
          VALUES (
            (deduct_elem->>'ingredient_id')::UUID,
            (deduct_elem->>'quantity')::NUMERIC
          );
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  IF NOT has_deductions THEN
    RETURN jsonb_build_object('restored', false);
  END IF;

  -- Restore stock and log movements
  FOR rec IN
    SELECT
      ingredient_id,
      SUM(quantity) AS total_restore
    FROM temp_void_restorations
    GROUP BY ingredient_id
  LOOP
    UPDATE ingredients
      SET stock_quantity = stock_quantity + rec.total_restore,
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
    )
    VALUES (
      rec.ingredient_id,
      rec.total_restore,
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
-- 5. RPC: ADJUST INGREDIENT STOCK
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
  curr_stock NUMERIC;
  new_stock NUMERIC;
  actual_change NUMERIC;
BEGIN
  SELECT stock_quantity INTO curr_stock FROM ingredients WHERE id = p_ingredient_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ingredient not found';
  END IF;

  IF p_type = 'add' THEN
    new_stock := curr_stock + p_quantity;
    actual_change := p_quantity;
  ELSIF p_type = 'reduce' THEN
    new_stock := GREATEST(0, curr_stock - p_quantity);
    actual_change := new_stock - curr_stock;
  ELSIF p_type = 'set' THEN
    new_stock := GREATEST(0, p_quantity);
    actual_change := new_stock - curr_stock;
  ELSE
    RAISE EXCEPTION 'Invalid adjustment type: %', p_type;
  END IF;

  UPDATE ingredients
    SET stock_quantity = new_stock,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_ingredient_id;

  INSERT INTO stock_movements (
    ingredient_id,
    change_qty,
    type,
    reason,
    created_by,
    created_at
  )
  VALUES (
    p_ingredient_id,
    actual_change,
    COALESCE(p_type, 'adjust'),
    p_reason,
    p_created_by,
    timezone('utc'::text, now())
  );

  RETURN new_stock;
END;
$$;


-- ============================================================
-- 6. RPC: SAVE MENU ITEM RECIPE (ATOMIC TRANSACTION)
-- ============================================================
CREATE OR REPLACE FUNCTION save_menu_item_recipe(
  p_menu_item_id UUID,
  p_rows JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  r JSONB;
BEGIN
  DELETE FROM menu_item_ingredients WHERE menu_item_id = p_menu_item_id;

  IF p_rows IS NOT NULL AND jsonb_typeof(p_rows) = 'array' AND jsonb_array_length(p_rows) > 0 THEN
    FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
    LOOP
      INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, quantity_used, unit)
      VALUES (
        p_menu_item_id,
        (r->>'ingredient_id')::UUID,
        (r->>'quantity_used')::NUMERIC,
        r->>'unit'
      );
    END LOOP;
  END IF;
END;
$$;
