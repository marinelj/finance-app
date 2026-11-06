BEGIN;
ALTER TABLE credit_products ADD COLUMN IF NOT EXISTS bill_email text
  CHECK (bill_email IS NULL OR (length(bill_email) <= 254 AND bill_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));
COMMIT;
