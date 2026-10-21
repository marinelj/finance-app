CREATE TABLE `bond_holdings` (
	`id` text PRIMARY KEY NOT NULL,
	`issuer` text NOT NULL,
	`name` text,
	`identifier` text,
	`face_value` real NOT NULL,
	`coupon_rate` real NOT NULL,
	`coupon_frequency` integer NOT NULL,
	`maturity_date` text NOT NULL,
	`purchase_date` text,
	`purchase_price` real,
	`current_price` real,
	`currency` text NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cash_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`balance` real NOT NULL,
	`currency` text NOT NULL,
	`rate_percent` real,
	`is_emergency_fund` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`label` text,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`essential` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `housing` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`currency` text NOT NULL,
	`monthly_rent` real,
	`balance` real,
	`rate_percent` real,
	`remaining_months` integer,
	`monthly_payment` real,
	`property_value` real,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `incomes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`amount` real NOT NULL,
	`period` text NOT NULL,
	`currency` text NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `insurance_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`insurer` text,
	`premium` real NOT NULL,
	`premium_period` text NOT NULL,
	`coverage` real,
	`currency` text NOT NULL,
	`renewal_date` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_holdings` (
	`id` text PRIMARY KEY NOT NULL,
	`ticker` text NOT NULL,
	`name` text,
	`asset_class` text NOT NULL,
	`shares` real NOT NULL,
	`price` real NOT NULL,
	`cost_basis` real,
	`dividend_per_share` real,
	`dividend_frequency` integer NOT NULL,
	`first_pay_month` integer,
	`currency` text NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
