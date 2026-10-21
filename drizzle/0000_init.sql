CREATE TABLE `credit_products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`issuer` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`preset` text,
	`custom_type_id` text,
	`currency` text NOT NULL,
	`color` text NOT NULL,
	`emoji` text NOT NULL,
	`credit_limit` real DEFAULT 0 NOT NULL,
	`balance` real DEFAULT 0 NOT NULL,
	`statement_balance` real,
	`minimum_payment` real,
	`statement_day` integer,
	`due_rule` text,
	`due_day` integer,
	`due_days_after_statement` integer,
	`has_grace_period` integer DEFAULT false NOT NULL,
	`grace_note` text,
	`interest_rate` real,
	`interest_rate_unit` text,
	`annual_fee` real,
	`fee_waiver` text,
	`repayment_day` integer,
	`loan_principal` real,
	`loan_start_date` text,
	`loan_term_months` integer,
	`repayment_method` text,
	`paid_through` text,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`custom_type_id`) REFERENCES `custom_product_types`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `credit_products_active_idx` ON `credit_products` (`is_active`);--> statement-breakpoint
CREATE TABLE `custom_product_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`has_grace_period` integer NOT NULL,
	`emoji` text NOT NULL,
	`color` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fx_rates` (
	`currency` text PRIMARY KEY NOT NULL,
	`units_per_usd` real NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `installments` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`seq` integer NOT NULL,
	`due_date` text NOT NULL,
	`principal` real NOT NULL,
	`interest` real NOT NULL,
	`amount` real NOT NULL,
	`paid_at` text,
	FOREIGN KEY (`product_id`) REFERENCES `credit_products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `installments_product_idx` ON `installments` (`product_id`,`due_date`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`date` text NOT NULL,
	`amount` real NOT NULL,
	`for_due_date` text,
	`installment_id` text,
	`note` text,
	`balance_reduction` real DEFAULT 0 NOT NULL,
	`previous_paid_through` text,
	`previous_statement_balance` real,
	`created_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `credit_products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payments_product_idx` ON `payments` (`product_id`,`date`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
