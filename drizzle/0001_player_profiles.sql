CREATE TABLE `player_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`parent_id` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`preferred_name` text,
	`date_of_birth` text,
	`gender` text,
	`grade` text NOT NULL,
	`school` text,
	`grad_year` text,
	`division` text,
	`tshirt_size` text,
	`jersey_size` text,
	`experience` text,
	`positions` text,
	`medical_info` text,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`parent_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `player_profiles_parent_id_idx` ON `player_profiles` (`parent_id`);--> statement-breakpoint
ALTER TABLE `athletes` ADD `profile_id` integer REFERENCES player_profiles(id);--> statement-breakpoint
INSERT INTO `player_profiles` (
	`id`,
	`parent_id`,
	`first_name`,
	`last_name`,
	`preferred_name`,
	`date_of_birth`,
	`gender`,
	`grade`,
	`school`,
	`grad_year`,
	`division`,
	`tshirt_size`,
	`jersey_size`,
	`experience`,
	`positions`,
	`medical_info`,
	`metadata`
)
SELECT
	`id`,
	`parent_id`,
	`first_name`,
	`last_name`,
	`preferred_name`,
	`date_of_birth`,
	`gender`,
	`grade`,
	`school`,
	`grad_year`,
	`division`,
	`tshirt_size`,
	`jersey_size`,
	`experience`,
	`positions`,
	`medical_info`,
	`metadata`
FROM `athletes`
WHERE `parent_id` IS NOT NULL;--> statement-breakpoint
UPDATE `athletes`
SET `profile_id` = `id`
WHERE `parent_id` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `athletes_profile_id_idx` ON `athletes` (`profile_id`);
