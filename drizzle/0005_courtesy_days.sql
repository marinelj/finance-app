ALTER TABLE credit_products ADD COLUMN courtesy_days integer CHECK (courtesy_days IS NULL OR (typeof(courtesy_days) = 'integer' AND courtesy_days BETWEEN 0 AND 30));
