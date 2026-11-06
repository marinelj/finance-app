BEGIN;
CREATE TABLE IF NOT EXISTS bill_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES credit_products(id) ON DELETE CASCADE,
  source_message_id text NOT NULL,
  issuer text,
  card_last4 char(4) CHECK (card_last4 ~ '^[0-9]{4}$'),
  statement_date date,
  due_date date NOT NULL,
  statement_balance numeric(18,2) NOT NULL CHECK (statement_balance >= 0),
  minimum_payment numeric(18,2) CHECK (minimum_payment >= 0),
  currency text NOT NULL CHECK (currency IN ('CNY','USD','HKD','EUR','GBP','JPY','SGD','AUD','CAD')),
  received_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_message_id)
);
CREATE INDEX IF NOT EXISTS bill_statements_product_idx ON bill_statements(user_id, product_id, due_date DESC, received_at DESC);
COMMIT;
