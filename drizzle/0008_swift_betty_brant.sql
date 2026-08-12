CREATE TABLE `club_season_email_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_id` text NOT NULL,
	`installment_id` text,
	`type` text NOT NULL,
	`recipient` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider_message_id` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`sent_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`registration_id`) REFERENCES `club_season_registrations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`installment_id`) REFERENCES `club_season_payment_installments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_email_deliveries_idempotency_unique` ON `club_season_email_deliveries` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `club_season_email_deliveries_registration_id_idx` ON `club_season_email_deliveries` (`registration_id`);--> statement-breakpoint
CREATE INDEX `club_season_email_deliveries_installment_id_idx` ON `club_season_email_deliveries` (`installment_id`);--> statement-breakpoint
CREATE INDEX `club_season_email_deliveries_status_idx` ON `club_season_email_deliveries` (`status`);--> statement-breakpoint
CREATE TABLE `club_season_payment_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_id` text NOT NULL,
	`payment_plan_version_id` text NOT NULL,
	`installment_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`stripe_payment_intent_id` text,
	`failure_code` text,
	`failure_message` text,
	`attempted_at` text NOT NULL,
	`resolved_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`registration_id`) REFERENCES `club_season_registrations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_plan_version_id`) REFERENCES `club_season_payment_plan_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`installment_id`) REFERENCES `club_season_payment_installments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_payment_attempts_installment_attempt_unique` ON `club_season_payment_attempts` (`installment_id`,`attempt_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_payment_attempts_idempotency_unique` ON `club_season_payment_attempts` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `club_season_payment_attempts_stripe_intent_idx` ON `club_season_payment_attempts` (`stripe_payment_intent_id`);--> statement-breakpoint
CREATE INDEX `club_season_payment_attempts_status_idx` ON `club_season_payment_attempts` (`status`);--> statement-breakpoint
ALTER TABLE `club_season_payment_installments` ADD `attempt_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `club_season_payment_installments` ADD `next_attempt_date` text;--> statement-breakpoint
ALTER TABLE `club_season_payment_installments` ADD `last_attempted_at` text;--> statement-breakpoint
ALTER TABLE `club_season_payment_installments` ADD `last_failure_code` text;--> statement-breakpoint
ALTER TABLE `club_season_payment_installments` ADD `last_failure_message` text;--> statement-breakpoint
ALTER TABLE `club_season_payment_plans` ADD `financial_status` text DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE `club_season_payment_transactions` ADD `source` text DEFAULT 'checkout' NOT NULL;--> statement-breakpoint
ALTER TABLE `club_season_payment_transactions` ADD `stripe_charge_id` text;
--> statement-breakpoint
CREATE TRIGGER `club_season_payment_attempt_identity_immutable`
BEFORE UPDATE OF `registration_id`, `payment_plan_version_id`, `installment_id`, `attempt_number`, `idempotency_key`, `amount`, `currency`
ON `club_season_payment_attempts`
BEGIN
	SELECT RAISE(ABORT, 'Payment attempt identity is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `club_season_payment_attempt_delete_restricted`
BEFORE DELETE ON `club_season_payment_attempts`
BEGIN
	SELECT RAISE(ABORT, 'Payment attempts cannot be deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `club_season_email_delivery_identity_immutable`
BEFORE UPDATE OF `registration_id`, `installment_id`, `type`, `recipient`, `idempotency_key`
ON `club_season_email_deliveries`
BEGIN
	SELECT RAISE(ABORT, 'Email delivery identity is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `club_season_email_delivery_delete_restricted`
BEFORE DELETE ON `club_season_email_deliveries`
BEGIN
	SELECT RAISE(ABORT, 'Email deliveries cannot be deleted');
END;
