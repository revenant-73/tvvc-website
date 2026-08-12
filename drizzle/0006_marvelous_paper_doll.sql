CREATE TABLE `club_season_agreement_acceptances` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_id` text NOT NULL,
	`agreement_version_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`agreement_key_snapshot` text NOT NULL,
	`agreement_title_snapshot` text NOT NULL,
	`agreement_body_snapshot` text NOT NULL,
	`agreement_content_hash` text NOT NULL,
	`response` text NOT NULL,
	`accepted_name` text NOT NULL,
	`accepted_email` text NOT NULL,
	`request_ip_hash` text,
	`user_agent` text,
	`context_snapshot` text NOT NULL,
	`accepted_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`registration_id`) REFERENCES `club_season_registrations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agreement_version_id`) REFERENCES `club_season_agreement_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_acceptances_registration_version_unique` ON `club_season_agreement_acceptances` (`registration_id`,`agreement_version_id`);--> statement-breakpoint
CREATE INDEX `club_season_acceptances_registration_id_idx` ON `club_season_agreement_acceptances` (`registration_id`);--> statement-breakpoint
CREATE INDEX `club_season_acceptances_owner_user_id_idx` ON `club_season_agreement_acceptances` (`owner_user_id`);--> statement-breakpoint
CREATE TABLE `club_season_agreement_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`key` text NOT NULL,
	`version` integer NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`body` text NOT NULL,
	`content_hash` text NOT NULL,
	`response_type` text DEFAULT 'acknowledgement' NOT NULL,
	`allowed_responses` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`required` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`effective_at` text,
	`published_at` text,
	`retired_at` text,
	`created_by_user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `club_seasons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_agreements_season_key_version_unique` ON `club_season_agreement_versions` (`season_id`,`key`,`version`);--> statement-breakpoint
CREATE INDEX `club_season_agreements_season_id_idx` ON `club_season_agreement_versions` (`season_id`);--> statement-breakpoint
CREATE INDEX `club_season_agreements_status_idx` ON `club_season_agreement_versions` (`status`);--> statement-breakpoint
ALTER TABLE `club_season_registrations` ADD `draft_schema_version` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_agreements_one_published_key_unique`
ON `club_season_agreement_versions` (`season_id`, `key`)
WHERE `status` = 'published';
--> statement-breakpoint
CREATE TRIGGER `club_season_published_agreement_content_immutable`
BEFORE UPDATE OF `key`, `version`, `title`, `summary`, `body`, `content_hash`, `response_type`, `allowed_responses`, `required`
ON `club_season_agreement_versions`
WHEN OLD.`status` IN ('published', 'retired')
BEGIN
	SELECT RAISE(ABORT, 'Published agreement content is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `club_season_published_agreement_status_restricted`
BEFORE UPDATE OF `status` ON `club_season_agreement_versions`
WHEN (OLD.`status` = 'published' AND NEW.`status` NOT IN ('published', 'retired'))
  OR (OLD.`status` = 'retired' AND NEW.`status` <> 'retired')
BEGIN
	SELECT RAISE(ABORT, 'Published agreement status cannot be reopened');
END;
--> statement-breakpoint
CREATE TRIGGER `club_season_published_agreement_delete_restricted`
BEFORE DELETE ON `club_season_agreement_versions`
WHEN OLD.`status` IN ('published', 'retired')
BEGIN
	SELECT RAISE(ABORT, 'Published agreement versions cannot be deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `club_season_acceptance_update_restricted`
BEFORE UPDATE ON `club_season_agreement_acceptances`
BEGIN
	SELECT RAISE(ABORT, 'Agreement acceptances are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `club_season_acceptance_delete_restricted`
BEFORE DELETE ON `club_season_agreement_acceptances`
BEGIN
	SELECT RAISE(ABORT, 'Agreement acceptances are immutable');
END;
