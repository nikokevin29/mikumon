CREATE TABLE `admins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `hotspot_active_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`router_id` integer NOT NULL,
	`user_id` integer,
	`username` text,
	`ip_address` text,
	`mac_address` text,
	`session_id` text,
	`upload_bytes` integer DEFAULT 0,
	`download_bytes` integer DEFAULT 0,
	`connected_at` integer,
	`last_updated` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`router_id`) REFERENCES `routers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `hotspot_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `hotspot_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`router_id` integer NOT NULL,
	`profile_id` integer NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`comment` text,
	`is_active` integer DEFAULT true,
	`used_at` integer,
	`expired_at` integer,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`router_id`) REFERENCES `routers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `routers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`ip_address` text NOT NULL,
	`port` integer DEFAULT 8728,
	`username` text NOT NULL,
	`password_encrypted` text NOT NULL,
	`is_default` integer DEFAULT false,
	`is_active` integer DEFAULT true,
	`last_connected_at` integer,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `sales_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`router_id` integer NOT NULL,
	`profile_id` integer NOT NULL,
	`username` text,
	`price` real,
	`sold_at` integer DEFAULT (unixepoch()),
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`router_id`) REFERENCES `routers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`router_id` integer NOT NULL,
	`name` text NOT NULL,
	`limit_uptime_seconds` integer,
	`limit_bytes_total` integer,
	`limit_bytes_down` integer,
	`limit_bytes_up` integer,
	`price` real NOT NULL,
	`selling_price` real,
	`expired_mode` text DEFAULT 'none',
	`parent_queue` text,
	`address_pool` text,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`router_id`) REFERENCES `routers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admins_email_unique` ON `admins` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `router_username` ON `hotspot_users` (`router_id`,`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `routers_name_unique` ON `routers` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `router_profile_name` ON `user_profiles` (`router_id`,`name`);