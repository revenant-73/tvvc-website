CREATE TABLE `club_age_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`pricing_tier_id` text NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `club_seasons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pricing_tier_id`) REFERENCES `club_pricing_tiers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_age_groups_season_code_unique` ON `club_age_groups` (`season_id`,`code`);--> statement-breakpoint
CREATE INDEX `club_age_groups_season_id_idx` ON `club_age_groups` (`season_id`);--> statement-breakpoint
CREATE INDEX `club_age_groups_pricing_tier_id_idx` ON `club_age_groups` (`pricing_tier_id`);--> statement-breakpoint
CREATE INDEX `club_age_groups_active_idx` ON `club_age_groups` (`active`);--> statement-breakpoint
CREATE TABLE `club_pricing_tiers` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`total_amount` integer NOT NULL,
	`deposit_amount` integer NOT NULL,
	`installment_amount` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `club_seasons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_pricing_tiers_season_key_unique` ON `club_pricing_tiers` (`season_id`,`key`);--> statement-breakpoint
CREATE INDEX `club_pricing_tiers_season_id_idx` ON `club_pricing_tiers` (`season_id`);--> statement-breakpoint
CREATE INDEX `club_pricing_tiers_active_idx` ON `club_pricing_tiers` (`active`);--> statement-breakpoint
CREATE TABLE `club_seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`timezone` text DEFAULT 'America/Los_Angeles' NOT NULL,
	`default_billing_day` integer DEFAULT 5 NOT NULL,
	`first_installment_date` text NOT NULL,
	`standard_installment_count` integer DEFAULT 5 NOT NULL,
	`registration_opens_at` text,
	`registration_closes_at` text,
	`season_start_date` text,
	`season_end_date` text,
	`public_registration_enabled` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `club_seasons_status_idx` ON `club_seasons` (`status`);--> statement-breakpoint
CREATE TABLE `club_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`age_group_id` text NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`billing_day_override` integer,
	`acceptance_deadline_override` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `club_seasons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`age_group_id`) REFERENCES `club_age_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_teams_season_name_unique` ON `club_teams` (`season_id`,`name`);--> statement-breakpoint
CREATE INDEX `club_teams_season_id_idx` ON `club_teams` (`season_id`);--> statement-breakpoint
CREATE INDEX `club_teams_age_group_id_idx` ON `club_teams` (`age_group_id`);--> statement-breakpoint
CREATE INDEX `club_teams_active_idx` ON `club_teams` (`active`);--> statement-breakpoint
INSERT OR IGNORE INTO `club_seasons` (
	`id`, `name`, `status`, `timezone`, `default_billing_day`,
	`first_installment_date`, `standard_installment_count`, `public_registration_enabled`
) VALUES (
	'2026-2027-club', '2026-2027 Club Season', 'draft', 'America/Los_Angeles', 5,
	'2027-01-05', 5, 0
);--> statement-breakpoint
INSERT OR IGNORE INTO `club_pricing_tiers` (
	`id`, `season_id`, `key`, `name`, `total_amount`, `deposit_amount`,
	`installment_amount`, `active`, `sort_order`
) VALUES
	('tier-2026-2027-12u', '2026-2027-club', '12u', '12U', 120000, 30000, 18000, 1, 10),
	('tier-2026-2027-13u-18u', '2026-2027-club', '13u-18u', '13U-18U', 150000, 40000, 22000, 1, 20);--> statement-breakpoint
INSERT OR IGNORE INTO `club_age_groups` (
	`id`, `season_id`, `pricing_tier_id`, `code`, `label`, `active`, `sort_order`
) VALUES
	('age-2026-2027-12u', '2026-2027-club', 'tier-2026-2027-12u', '12U', '12U', 1, 12),
	('age-2026-2027-13u', '2026-2027-club', 'tier-2026-2027-13u-18u', '13U', '13U', 1, 13),
	('age-2026-2027-14u', '2026-2027-club', 'tier-2026-2027-13u-18u', '14U', '14U', 1, 14),
	('age-2026-2027-15u', '2026-2027-club', 'tier-2026-2027-13u-18u', '15U', '15U', 1, 15),
	('age-2026-2027-16u', '2026-2027-club', 'tier-2026-2027-13u-18u', '16U', '16U', 1, 16),
	('age-2026-2027-17u', '2026-2027-club', 'tier-2026-2027-13u-18u', '17U', '17U', 1, 17),
	('age-2026-2027-18u', '2026-2027-club', 'tier-2026-2027-13u-18u', '18U', '18U', 1, 18);
