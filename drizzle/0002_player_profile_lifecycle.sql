ALTER TABLE `player_profiles` ADD `archived_at` text;--> statement-breakpoint
ALTER TABLE `player_profiles` ADD `merged_into_profile_id` integer REFERENCES player_profiles(id);--> statement-breakpoint
CREATE INDEX `player_profiles_archived_at_idx` ON `player_profiles` (`archived_at`);--> statement-breakpoint
CREATE INDEX `player_profiles_merged_into_profile_id_idx` ON `player_profiles` (`merged_into_profile_id`);