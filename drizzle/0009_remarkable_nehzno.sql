CREATE TABLE `club_season_admin_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`reason` text,
	`before_snapshot` text,
	`after_snapshot` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`admin_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `club_season_admin_audit_admin_id_idx` ON `club_season_admin_audit_log` (`admin_user_id`);--> statement-breakpoint
CREATE INDEX `club_season_admin_audit_entity_idx` ON `club_season_admin_audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `club_season_admin_audit_created_at_idx` ON `club_season_admin_audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `club_season_payment_plan_authorizations` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_plan_version_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`authorization_text` text NOT NULL,
	`authorization_content_hash` text NOT NULL,
	`authorized_name` text NOT NULL,
	`authorized_email` text NOT NULL,
	`request_ip_hash` text,
	`user_agent` text,
	`authorized_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`payment_plan_version_id`) REFERENCES `club_season_payment_plan_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_plan_authorizations_version_unique` ON `club_season_payment_plan_authorizations` (`payment_plan_version_id`);--> statement-breakpoint
CREATE INDEX `club_season_plan_authorizations_owner_id_idx` ON `club_season_payment_plan_authorizations` (`owner_user_id`);--> statement-breakpoint
CREATE TABLE `club_season_payment_plan_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_id` text NOT NULL,
	`payment_plan_id` text NOT NULL,
	`from_version_id` text NOT NULL,
	`proposed_version_id` text NOT NULL,
	`status` text DEFAULT 'pending_authorization' NOT NULL,
	`reason` text NOT NULL,
	`admin_note` text,
	`proposed_by_user_id` text NOT NULL,
	`proposed_at` text NOT NULL,
	`reviewed_at` text,
	`cancelled_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`registration_id`) REFERENCES `club_season_registrations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_plan_id`) REFERENCES `club_season_payment_plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_version_id`) REFERENCES `club_season_payment_plan_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`proposed_version_id`) REFERENCES `club_season_payment_plan_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`proposed_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_plan_revisions_proposed_version_unique` ON `club_season_payment_plan_revisions` (`proposed_version_id`);--> statement-breakpoint
CREATE INDEX `club_season_plan_revisions_plan_id_idx` ON `club_season_payment_plan_revisions` (`payment_plan_id`);--> statement-breakpoint
CREATE INDEX `club_season_plan_revisions_registration_id_idx` ON `club_season_payment_plan_revisions` (`registration_id`);--> statement-breakpoint
CREATE INDEX `club_season_plan_revisions_status_idx` ON `club_season_payment_plan_revisions` (`status`);
--> statement-breakpoint
CREATE TRIGGER `club_season_admin_audit_update_restricted`
BEFORE UPDATE ON `club_season_admin_audit_log`
BEGIN
	SELECT RAISE(ABORT, 'Admin audit entries are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `club_season_admin_audit_delete_restricted`
BEFORE DELETE ON `club_season_admin_audit_log`
BEGIN
	SELECT RAISE(ABORT, 'Admin audit entries are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `club_season_plan_authorization_update_restricted`
BEFORE UPDATE ON `club_season_payment_plan_authorizations`
BEGIN
	SELECT RAISE(ABORT, 'Payment plan authorizations are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `club_season_plan_authorization_delete_restricted`
BEFORE DELETE ON `club_season_payment_plan_authorizations`
BEGIN
	SELECT RAISE(ABORT, 'Payment plan authorizations are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `club_season_plan_revision_identity_immutable`
BEFORE UPDATE OF `registration_id`, `payment_plan_id`, `from_version_id`, `proposed_version_id`, `reason`, `admin_note`, `proposed_by_user_id`, `proposed_at`
ON `club_season_payment_plan_revisions`
BEGIN
	SELECT RAISE(ABORT, 'Payment plan revision identity is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `club_season_plan_revision_delete_restricted`
BEFORE DELETE ON `club_season_payment_plan_revisions`
BEGIN
	SELECT RAISE(ABORT, 'Payment plan revisions cannot be deleted');
END;
