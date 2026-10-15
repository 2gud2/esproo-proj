-- ─── Espro POS: Database Migration v6 (Actual Purchase Price) ───
-- Idempotent and safe to run in Supabase SQL Editor

-- Add actual_purchase_price column to ingredients table
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS actual_purchase_price NUMERIC DEFAULT 0;

-- Backfill existing ingredients with cost_per_unit if actual_purchase_price is 0 or null
UPDATE ingredients 
SET actual_purchase_price = COALESCE(cost_per_unit, 0)
WHERE actual_purchase_price IS NULL OR actual_purchase_price = 0;
