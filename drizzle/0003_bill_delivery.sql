ALTER TABLE credit_products ADD COLUMN bill_email text;
--> statement-breakpoint
ALTER TABLE credit_products ADD COLUMN card_last4 text CHECK (card_last4 IS NULL OR (length(card_last4) = 4 AND card_last4 NOT GLOB '*[^0-9]*'));
