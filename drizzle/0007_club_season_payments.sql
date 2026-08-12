CREATE TABLE `club_season_payment_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`status` text DEFAULT 'pending_checkout' NOT NULL,
	`current_version` integer DEFAULT 1 NOT NULL,
	`stripe_customer_id` text,
	`stripe_payment_method_id` text,
	`needs_review` integer DEFAULT false NOT NULL,
	`activated_at` text,
	`completed_at` text,
	`cancelled_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`registration_id`) REFERENCES `club_season_registrations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_payment_plans_registration_id_unique` ON `club_season_payment_plans` (`registration_id`);--> statement-breakpoint
CREATE INDEX `club_season_payment_plans_owner_user_id_idx` ON `club_season_payment_plans` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `club_season_payment_plans_status_idx` ON `club_season_payment_plans` (`status`);--> statement-breakpoint
CREATE TABLE `club_season_payment_plan_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_plan_id` text NOT NULL,
	`version` integer NOT NULL,
	`payment_option` text NOT NULL,
	`status` text DEFAULT 'pending_checkout' NOT NULL,
	`total_amount` integer NOT NULL,
	`due_now_amount` integer NOT NULL,
	`currency` text DEFAULT 'usd' NOT NULL,
	`billing_day` integer,
	`schedule_snapshot` text NOT NULL,
	`terms_fingerprint` text NOT NULL,
	`authorization_text` text,
	`authorization_content_hash` text,
	`authorized_name` text,
	`authorized_email` text,
	`request_ip_hash` text,
	`user_agent` text,
	`authorized_at` text,
	`stripe_checkout_session_id` text,
	`stripe_checkout_expires_at` text,
	`stripe_payment_intent_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`payment_plan_id`) REFERENCES `club_season_payment_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_payment_plan_versions_plan_version_unique` ON `club_season_payment_plan_versions` (`payment_plan_id`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_payment_plan_versions_stripe_session_unique` ON `club_season_payment_plan_versions` (`stripe_checkout_session_id`);--> statement-breakpoint
CREATE INDEX `club_season_payment_plan_versions_plan_id_idx` ON `club_season_payment_plan_versions` (`payment_plan_id`);--> statement-breakpoint
CREATE INDEX `club_season_payment_plan_versions_status_idx` ON `club_season_payment_plan_versions` (`status`);--> statement-breakpoint
CREATE TABLE `club_season_payment_installments` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_plan_version_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`type` text NOT NULL,
	`due_date` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`stripe_payment_intent_id` text,
	`paid_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`payment_plan_version_id`) REFERENCES `club_season_payment_plan_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_installments_version_sequence_unique` ON `club_season_payment_installments` (`payment_plan_version_id`,`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_installments_stripe_intent_unique` ON `club_season_payment_installments` (`stripe_payment_intent_id`);--> statement-breakpoint
CREATE INDEX `club_season_installments_plan_version_id_idx` ON `club_season_payment_installments` (`payment_plan_version_id`);--> statement-breakpoint
CREATE INDEX `club_season_installments_status_idx` ON `club_season_payment_installments` (`status`);--> statement-breakpoint
CREATE INDEX `club_season_installments_due_date_idx` ON `club_season_payment_installments` (`due_date`);--> statement-breakpoint
CREATE TABLE `club_season_payment_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_id` text NOT NULL,
	`payment_plan_version_id` text NOT NULL,
	`installment_id` text NOT NULL,
	`stripe_event_id` text NOT NULL,
	`stripe_checkout_session_id` text,
	`stripe_payment_intent_id` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`processed_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`registration_id`) REFERENCES `club_season_registrations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_plan_version_id`) REFERENCES `club_season_payment_plan_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`installment_id`) REFERENCES `club_season_payment_installments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_payment_transactions_event_unique` ON `club_season_payment_transactions` (`stripe_event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_payment_transactions_session_unique` ON `club_season_payment_transactions` (`stripe_checkout_session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_payment_transactions_intent_unique` ON `club_season_payment_transactions` (`stripe_payment_intent_id`);--> statement-breakpoint
CREATE INDEX `club_season_payment_transactions_registration_id_idx` ON `club_season_payment_transactions` (`registration_id`);--> statement-breakpoint
CREATE TRIGGER `club_season_payment_version_terms_immutable`
BEFORE UPDATE OF `payment_option`, `total_amount`, `due_now_amount`, `currency`, `billing_day`, `schedule_snapshot`, `terms_fingerprint`, `authorization_text`, `authorization_content_hash`, `authorized_name`, `authorized_email`, `request_ip_hash`, `user_agent`, `authorized_at`
ON `club_season_payment_plan_versions`
BEGIN
	SELECT RAISE(ABORT, 'Authorized payment plan terms are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `club_season_payment_version_delete_restricted`
BEFORE DELETE ON `club_season_payment_plan_versions`
BEGIN
	SELECT RAISE(ABORT, 'Payment plan versions cannot be deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `club_season_installment_terms_immutable`
BEFORE UPDATE OF `payment_plan_version_id`, `sequence`, `type`, `due_date`, `amount`
ON `club_season_payment_installments`
BEGIN
	SELECT RAISE(ABORT, 'Payment installment terms are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `club_season_installment_delete_restricted`
BEFORE DELETE ON `club_season_payment_installments`
BEGIN
	SELECT RAISE(ABORT, 'Payment installments cannot be deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `club_season_payment_transaction_update_restricted`
BEFORE UPDATE ON `club_season_payment_transactions`
BEGIN
	SELECT RAISE(ABORT, 'Payment transactions are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `club_season_payment_transaction_delete_restricted`
BEFORE DELETE ON `club_season_payment_transactions`
BEGIN
	SELECT RAISE(ABORT, 'Payment transactions are immutable');
END;
