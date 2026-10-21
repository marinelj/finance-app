CREATE TABLE `net_worth_snapshots` (
	`month` text PRIMARY KEY NOT NULL,
	`assets` real NOT NULL,
	`liabilities` real NOT NULL,
	`net_worth` real NOT NULL,
	`currency` text NOT NULL,
	`updated_at` text NOT NULL
);
