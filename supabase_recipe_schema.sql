-- ─── Espro POS: Recipe-Based Menu & Inventory Schema ───
-- Run this in Supabase SQL Editor AFTER the original schema.
-- It adds: ingredients, menu_items, menu_item_ingredients tables,
-- RLS policies, and atomic RPC functions for sale stock deduction.

-- ============================================================
-- 1. INGREDIENTS TABLE (raw stock items)
-- ============================================================
CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL,  -- e.g. grams, ml, pcs
  stock_quantity NUMERIC NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

-- Everyone can read ingredients
CREATE POLICY "Allow public read access to ingredients"
  ON ingredients FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to ingredients"
  ON ingredients FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to ingredients"
  ON ingredients FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to ingredients"
  ON ingredients FOR DELETE USING (true);


-- ============================================================
-- 2. MENU_ITEMS TABLE (sellable products with recipes)
-- ============================================================
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to menu_items"
  ON menu_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to menu_items"
  ON menu_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to menu_items"
  ON menu_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to menu_items"
  ON menu_items FOR DELETE USING (true);


-- ============================================================
-- 3. MENU_ITEM_INGREDIENTS TABLE (recipe junction)
-- ============================================================
CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity_used NUMERIC NOT NULL,  -- amount per 1 unit sold
  unit TEXT NOT NULL,              -- should match ingredient unit
  UNIQUE (menu_item_id, ingredient_id)
);

ALTER TABLE menu_item_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to menu_item_ingredients"
  ON menu_item_ingredients FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to menu_item_ingredients"
  ON menu_item_ingredients FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to menu_item_ingredients"
  ON menu_item_ingredients FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access to menu_item_ingredients"
  ON menu_item_ingredients FOR DELETE USING (true);


-- ============================================================
-- 4. RPC: COMPLETE SALE WITH INGREDIENT DEDUCTION (Atomic)
-- ============================================================
-- Accepts sale data + a JSON array of cart items:
--   [{ "menu_item_id": "uuid", "qty": 2, "name": "Matcha Latte", "price": 180 }, ...]
-- Steps:
--   1. For each cart item, look up recipe (menu_item_ingredients)
--   2. Check that all ingredients have sufficient stock
--   3. If any insufficient → RAISE EXCEPTION (blocks the sale)
--   4. Insert the sale record
--   5. Deduct stock from all ingredients

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
  cart_item JSONB;
  recipe_row RECORD;
  needed NUMERIC;
  current_stock NUMERIC;
  ingredient_name TEXT;
BEGIN
  -- Phase 1: Validate stock for ALL items in the cart
  FOR cart_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    FOR recipe_row IN
      SELECT mii.quantity_used, mii.ingredient_id, i.stock_quantity, i.name AS ing_name
      FROM menu_item_ingredients mii
      JOIN ingredients i ON i.id = mii.ingredient_id
      WHERE mii.menu_item_id = (cart_item->>'menu_item_id')::UUID
    LOOP
      needed := recipe_row.quantity_used * (cart_item->>'qty')::NUMERIC;
      IF recipe_row.stock_quantity < needed THEN
        RAISE EXCEPTION 'Insufficient stock for "%" — need % %, only % available',
          recipe_row.ing_name, needed, 
          (SELECT unit FROM ingredients WHERE id = recipe_row.ingredient_id),
          recipe_row.stock_quantity;
      END IF;
    END LOOP;
  END LOOP;

  -- Phase 2: Insert the sale record
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

  -- Phase 3: Deduct ingredient stock
  FOR cart_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    FOR recipe_row IN
      SELECT mii.quantity_used, mii.ingredient_id
      FROM menu_item_ingredients mii
      WHERE mii.menu_item_id = (cart_item->>'menu_item_id')::UUID
    LOOP
      needed := recipe_row.quantity_used * (cart_item->>'qty')::NUMERIC;
      UPDATE ingredients
        SET stock_quantity = stock_quantity - needed,
            updated_at = timezone('utc'::text, now())
        WHERE id = recipe_row.ingredient_id;
    END LOOP;
  END LOOP;

  RETURN p_sale_id;
END;
$$;


-- ============================================================
-- 5. RPC: VOID/REFUND SALE WITH STOCK RESTORATION (Atomic)
-- ============================================================
-- Reads the sale items JSONB, looks up each menu item's recipe,
-- and adds back the deducted stock.

CREATE OR REPLACE FUNCTION void_sale_with_restoration(
  p_sale_id TEXT,
  p_status TEXT,       -- 'voided' or 'refunded'
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  sale_record RECORD;
  cart_item JSONB;
  recipe_row RECORD;
  restore_qty NUMERIC;
BEGIN
  -- Get the sale
  SELECT * INTO sale_record FROM sales WHERE id = p_sale_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale "%" not found', p_sale_id;
  END IF;
  IF sale_record.status != 'completed' THEN
    RAISE EXCEPTION 'Sale "%" is already %', p_sale_id, sale_record.status;
  END IF;

  -- Update sale status
  UPDATE sales
    SET status = p_status,
        void_reason = p_reason
    WHERE id = p_sale_id;

  -- Restore ingredient stock for each item
  FOR cart_item IN SELECT * FROM jsonb_array_elements(sale_record.items)
  LOOP
    -- Check if this item has a menu_item_id (new-style sale)
    IF cart_item ? 'menu_item_id' THEN
      FOR recipe_row IN
        SELECT mii.quantity_used, mii.ingredient_id
        FROM menu_item_ingredients mii
        WHERE mii.menu_item_id = (cart_item->>'menu_item_id')::UUID
      LOOP
        restore_qty := recipe_row.quantity_used * (cart_item->>'qty')::NUMERIC;
        UPDATE ingredients
          SET stock_quantity = stock_quantity + restore_qty,
              updated_at = timezone('utc'::text, now())
          WHERE id = recipe_row.ingredient_id;
      END LOOP;
    END IF;
    -- Old-style sales (with embedded product object) are skipped for stock restore
    -- since those used the old products table
  END LOOP;
END;
$$;


-- ============================================================
-- 6. RPC: REFUND SALE WITHOUT STOCK RESTORATION
-- ============================================================
-- Marks a completed sale as refunded, but leaves ingredient stock unchanged.

CREATE OR REPLACE FUNCTION refund_sale_no_restoration(
  p_sale_id TEXT,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  sale_record RECORD;
BEGIN
  SELECT * INTO sale_record FROM sales WHERE id = p_sale_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale "%" not found', p_sale_id;
  END IF;
  IF sale_record.status != 'completed' THEN
    RAISE EXCEPTION 'Sale "%" is already %', p_sale_id, sale_record.status;
  END IF;

  UPDATE sales
    SET status = 'refunded',
        void_reason = p_reason
    WHERE id = p_sale_id;
END;
$$;


-- ============================================================
-- 6. STORAGE POLICIES FOR 'menu-images' BUCKET
-- ============================================================
-- Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow public read access to images
CREATE POLICY "Public Read Menu Images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'menu-images');

-- Allow public upload access to images
CREATE POLICY "Public Insert Menu Images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'menu-images');

-- Allow public update/overwrite access
CREATE POLICY "Public Update Menu Images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'menu-images');

