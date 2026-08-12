CREATE TABLE `club_season_financial_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_id` text NOT NULL,
	`payment_plan_id` text NOT NULL,
	`transaction_id` text,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`balance_effect` integer NOT NULL,
	`effective_date` text NOT NULL,
	`reason` text NOT NULL,
	`note` text,
	`stripe_refund_id` text,
	`reverses_adjustment_id` text,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`registration_id`) REFERENCES `club_season_registrations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_plan_id`) REFERENCES `club_season_payment_plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`) REFERENCES `club_season_payment_transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reverses_adjustment_id`) REFERENCES `club_season_financial_adjustments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `club_season_adjustments_registration_id_idx` ON `club_season_financial_adjustments` (`registration_id`);--> statement-breakpoint
CREATE INDEX `club_season_adjustments_plan_id_idx` ON `club_season_financial_adjustments` (`payment_plan_id`);--> statement-breakpoint
CREATE INDEX `club_season_adjustments_transaction_id_idx` ON `club_season_financial_adjustments` (`transaction_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_adjustments_stripe_refund_unique` ON `club_season_financial_adjustments` (`stripe_refund_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_adjustments_reversal_unique` ON `club_season_financial_adjustments` (`reverses_adjustment_id`);--> statement-breakpoint
CREATE INDEX `club_season_adjustments_created_at_idx` ON `club_season_financial_adjustments` (`created_at`);
--> statement-breakpoint
CREATE TRIGGER `club_season_adjustment_insert_guard`
BEFORE INSERT ON `club_season_financial_adjustments`
WHEN NEW.`amount` <= 0
  OR NEW.`type` NOT IN ('offline_payment', 'credit', 'write_off', 'stripe_refund', 'reversal')
  OR (NEW.`type` IN ('offline_payment', 'credit', 'write_off') AND NEW.`balance_effect` <> -NEW.`amount`)
  OR (NEW.`type` = 'stripe_refund' AND (NEW.`balance_effect` <> NEW.`amount` OR NEW.`transaction_id` IS NULL OR NEW.`stripe_refund_id` IS NULL))
  OR (NEW.`type` = 'reversal' AND (NEW.`reverses_adjustment_id` IS NULL OR abs(NEW.`balance_effect`) <> NEW.`amount`))
BEGIN
	SELECT RAISE(ABORT, 'Invalid club season financial adjustment');
END;
--> statement-breakpoint
CREATE TRIGGER `club_season_adjustment_update_restricted`
BEFORE UPDATE ON `club_season_financial_adjustments`
BEGIN
	SELECT RAISE(ABORT, 'Financial adjustments are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `club_season_adjustment_delete_restricted`
BEFORE DELETE ON `club_season_financial_adjustments`
BEGIN
	SELECT RAISE(ABORT, 'Financial adjustments cannot be deleted');
END;
