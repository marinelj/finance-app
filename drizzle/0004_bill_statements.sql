CREATE TABLE bill_statements (
  id text PRIMARY KEY NOT NULL,
  product_id text NOT NULL REFERENCES credit_products(id) ON DELETE CASCADE,
  source_message_id text NOT NULL,
  issuer text,
  card_last4 text CHECK (card_last4 IS NULL OR (length(card_last4) = 4 AND card_last4 NOT GLOB '*[^0-9]*')),
  statement_date text,
  due_date text NOT NULL,
  statement_balance real NOT NULL CHECK (statement_balance >= 0),
  minimum_payment real,
  currency text NOT NULL,
  received_at text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
--> statement-breakpoint
CREATE INDEX bill_statements_product_idx ON bill_statements(product_id, due_date);

--> statement-breakpoint
CREATE UNIQUE INDEX bill_statements_source_idx ON bill_statements(source_message_id);
