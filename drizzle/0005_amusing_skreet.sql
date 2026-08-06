CREATE TABLE `club_season_offers` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`team_id` text NOT NULL,
	`source_registration_id` text NOT NULL,
	`source_athlete_id` integer NOT NULL,
	`source_profile_id` integer,
	`recipient_email` text NOT NULL,
	`recipient_user_id` text,
	`status` text DEFAULT 'offered' NOT NULL,
	`acceptance_deadline` text,
	`decline_reason` text,
	`decline_details` text,
	`offered_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`viewed_at` text,
	`responded_at` text,
	`created_by_user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `club_seasons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `club_teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_athlete_id`) REFERENCES `athletes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_profile_id`) REFERENCES `player_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_offers_season_athlete_unique` ON `club_season_offers` (`season_id`,`source_athlete_id`);--> statement-breakpoint
CREATE INDEX `club_season_offers_season_id_idx` ON `club_season_offers` (`season_id`);--> statement-breakpoint
CREATE INDEX `club_season_offers_team_id_idx` ON `club_season_offers` (`team_id`);--> statement-breakpoint
CREATE INDEX `club_season_offers_source_registration_id_idx` ON `club_season_offers` (`source_registration_id`);--> statement-breakpoint
CREATE INDEX `club_season_offers_recipient_email_idx` ON `club_season_offers` (`recipient_email`);--> statement-breakpoint
CREATE INDEX `club_season_offers_recipient_user_id_idx` ON `club_season_offers` (`recipient_user_id`);--> statement-breakpoint
CREATE INDEX `club_season_offers_status_idx` ON `club_season_offers` (`status`);--> statement-breakpoint
CREATE TABLE `club_season_registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`offer_id` text NOT NULL,
	`season_id` text NOT NULL,
	`team_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`player_profile_id` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`current_step` integer DEFAULT 1 NOT NULL,
	`draft_data` text,
	`version` integer DEFAULT 1 NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_saved_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`submitted_at` text,
	`accepted_at` text,
	`cancelled_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`offer_id`) REFERENCES `club_season_offers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`season_id`) REFERENCES `club_seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `club_teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_profile_id`) REFERENCES `player_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_registrations_offer_id_unique` ON `club_season_registrations` (`offer_id`);--> statement-breakpoint
CREATE INDEX `club_season_registrations_season_id_idx` ON `club_season_registrations` (`season_id`);--> statement-breakpoint
CREATE INDEX `club_season_registrations_team_id_idx` ON `club_season_registrations` (`team_id`);--> statement-breakpoint
CREATE INDEX `club_season_registrations_owner_user_id_idx` ON `club_season_registrations` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `club_season_registrations_status_idx` ON `club_season_registrations` (`status`);