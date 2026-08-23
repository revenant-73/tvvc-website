ALTER TABLE `events` ADD `waitlist_enabled` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `event_waitlist_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`user_id` text,
	`profile_id` integer,
	`parent_name` text NOT NULL,
	`parent_email` text NOT NULL,
	`parent_phone` text NOT NULL,
	`secondary_parent_name` text,
	`secondary_parent_email` text,
	`secondary_parent_phone` text,
	`emergency_phone` text,
	`athlete_first_name` text NOT NULL,
	`athlete_last_name` text NOT NULL,
	`athlete_preferred_name` text,
	`athlete_grade` text NOT NULL,
	`athlete_medical_info` text,
	`status` text DEFAULT 'waitlisted' NOT NULL,
	`source` text DEFAULT 'public' NOT NULL,
	`note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`invited_at` text,
	`registered_at` text,
	`removed_at` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`profile_id`) REFERENCES `player_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `event_waitlist_entries_event_id_idx` ON `event_waitlist_entries` (`event_id`);
--> statement-breakpoint
CREATE INDEX `event_waitlist_entries_status_idx` ON `event_waitlist_entries` (`status`);
--> statement-breakpoint
CREATE INDEX `event_waitlist_entries_parent_email_idx` ON `event_waitlist_entries` (`parent_email`);
--> statement-breakpoint
CREATE INDEX `event_waitlist_entries_created_at_idx` ON `event_waitlist_entries` (`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_waitlist_entries_active_unique` ON `event_waitlist_entries` (`event_id`,`parent_email`,`athlete_first_name`,`athlete_last_name`) WHERE `status` IN ('waitlisted', 'invited');
