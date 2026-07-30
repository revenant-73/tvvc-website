CREATE TABLE `household_guardians` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_user_id` text NOT NULL,
	`guardian_email` text NOT NULL,
	`guardian_user_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`invited_at` text DEFAULT CURRENT_TIMESTAMP,
	`accepted_at` text,
	`revoked_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`guardian_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `household_guardians_owner_email_unique` ON `household_guardians` (`owner_user_id`,`guardian_email`);--> statement-breakpoint
CREATE INDEX `household_guardians_owner_user_id_idx` ON `household_guardians` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `household_guardians_guardian_email_idx` ON `household_guardians` (`guardian_email`);--> statement-breakpoint
CREATE INDEX `household_guardians_guardian_user_id_idx` ON `household_guardians` (`guardian_user_id`);--> statement-breakpoint
CREATE INDEX `household_guardians_status_idx` ON `household_guardians` (`status`);
