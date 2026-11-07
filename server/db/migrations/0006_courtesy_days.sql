-- Additional interest-free days only; payment due dates stay unchanged.
ALTER TABLE credit_products ADD COLUMN IF NOT EXISTS courtesy_days smallint
  CHECK (courtesy_days BETWEEN 0 AND 30);
