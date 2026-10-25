-- ─── Espro POS: Database Migration v7 (Refund Sale Without Stock Restoration RPC) ───
-- Safe & idempotent to run in Supabase SQL Editor

-- 1. Create or replace the refund_sale_no_restoration RPC function
CREATE OR REPLACE FUNCTION refund_sale_no_restoration(
  p_sale_id TEXT,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 2. Grant execute permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION refund_sale_no_restoration(TEXT, TEXT) TO anon, authenticated, service_role;

-- 3. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
