CREATE TABLE `club_season_invitation_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`team_id` text,
	`wave` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'prepared' NOT NULL,
	`subject` text NOT NULL,
	`template_fingerprint` text NOT NULL,
	`request_idempotency_key` text NOT NULL,
	`request_fingerprint` text NOT NULL,
	`admin_user_id` text NOT NULL,
	`audit_reason` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`released_at` text,
	`completed_at` text,
	FOREIGN KEY (`season_id`) REFERENCES `club_seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `club_teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`admin_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_invitation_batches_request_key_unique` ON `club_season_invitation_batches` (`request_idempotency_key`);
--> statement-breakpoint
CREATE INDEX `club_season_invitation_batches_season_wave_idx` ON `club_season_invitation_batches` (`season_id`,`wave`);
--> statement-breakpoint
CREATE INDEX `club_season_invitation_batches_team_id_idx` ON `club_season_invitation_batches` (`team_id`);
--> statement-breakpoint
CREATE INDEX `club_season_invitation_batches_status_idx` ON `club_season_invitation_batches` (`status`);
--> statement-breakpoint
CREATE INDEX `club_season_invitation_batches_created_at_idx` ON `club_season_invitation_batches` (`created_at`);
--> statement-breakpoint
CREATE TABLE `club_season_invitation_batch_items` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`offer_id` text NOT NULL,
	`recipient_email` text NOT NULL,
	`parent_name` text NOT NULL,
	`player_name` text NOT NULL,
	`team_name` text NOT NULL,
	`acceptance_deadline` text NOT NULL,
	`total_amount` integer NOT NULL,
	`deposit_amount` integer NOT NULL,
	`installment_amount` integer NOT NULL,
	`installment_count` integer NOT NULL,
	`schedule_snapshot` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `club_season_invitation_batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`offer_id`) REFERENCES `club_season_offers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_invitation_items_batch_offer_unique` ON `club_season_invitation_batch_items` (`batch_id`,`offer_id`);
--> statement-breakpoint
CREATE INDEX `club_season_invitation_items_batch_id_idx` ON `club_season_invitation_batch_items` (`batch_id`);
--> statement-breakpoint
CREATE INDEX `club_season_invitation_items_offer_id_idx` ON `club_season_invitation_batch_items` (`offer_id`);
--> statement-breakpoint
CREATE INDEX `club_season_invitation_items_recipient_idx` ON `club_season_invitation_batch_items` (`recipient_email`);
--> statement-breakpoint
CREATE TABLE `club_season_invitation_delivery_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`batch_item_id` text,
	`attempt_number` integer NOT NULL,
	`recipient_email` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider_message_id` text,
	`error_message` text,
	`admin_user_id` text NOT NULL,
	`attempted_at` text NOT NULL,
	`resolved_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `club_season_invitation_batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`batch_item_id`) REFERENCES `club_season_invitation_batch_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`admin_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_invitation_attempts_item_number_unique` ON `club_season_invitation_delivery_attempts` (`batch_item_id`,`attempt_number`);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_invitation_attempts_idempotency_unique` ON `club_season_invitation_delivery_attempts` (`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `club_season_invitation_attempts_batch_status_idx` ON `club_season_invitation_delivery_attempts` (`batch_id`,`status`);
--> statement-breakpoint
CREATE INDEX `club_season_invitation_attempts_item_id_idx` ON `club_season_invitation_delivery_attempts` (`batch_item_id`);
--> statement-breakpoint
CREATE INDEX `club_season_invitation_attempts_attempted_at_idx` ON `club_season_invitation_delivery_attempts` (`attempted_at`);
--> statement-breakpoint
CREATE TRIGGER `club_season_invitation_items_no_update` BEFORE UPDATE ON `club_season_invitation_batch_items` BEGIN SELECT RAISE(ABORT, 'invitation batch items are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `club_season_invitation_items_no_delete` BEFORE DELETE ON `club_season_invitation_batch_items` BEGIN SELECT RAISE(ABORT, 'invitation batch items are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `club_season_invitation_batches_identity_immutable` BEFORE UPDATE ON `club_season_invitation_batches` WHEN NEW.id <> OLD.id OR NEW.season_id <> OLD.season_id OR COALESCE(NEW.team_id, '') <> COALESCE(OLD.team_id, '') OR NEW.wave <> OLD.wave OR NEW.kind <> OLD.kind OR NEW.subject <> OLD.subject OR NEW.template_fingerprint <> OLD.template_fingerprint OR NEW.request_idempotency_key <> OLD.request_idempotency_key OR NEW.request_fingerprint <> OLD.request_fingerprint OR NEW.admin_user_id <> OLD.admin_user_id OR NEW.audit_reason <> OLD.audit_reason OR NEW.created_at <> OLD.created_at OR COALESCE(NEW.released_at, '') <> COALESCE(OLD.released_at, '') BEGIN SELECT RAISE(ABORT, 'invitation batch identity is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `club_season_invitation_batches_no_delete` BEFORE DELETE ON `club_season_invitation_batches` BEGIN SELECT RAISE(ABORT, 'invitation batches are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `club_season_invitation_attempts_identity_immutable` BEFORE UPDATE ON `club_season_invitation_delivery_attempts` WHEN NEW.id <> OLD.id OR NEW.batch_id <> OLD.batch_id OR COALESCE(NEW.batch_item_id, '') <> COALESCE(OLD.batch_item_id, '') OR NEW.attempt_number <> OLD.attempt_number OR NEW.recipient_email <> OLD.recipient_email OR NEW.idempotency_key <> OLD.idempotency_key OR NEW.admin_user_id <> OLD.admin_user_id OR NEW.attempted_at <> OLD.attempted_at OR NEW.created_at <> OLD.created_at BEGIN SELECT RAISE(ABORT, 'invitation attempt identity is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `club_season_invitation_attempts_no_delete` BEFORE DELETE ON `club_season_invitation_delivery_attempts` BEGIN SELECT RAISE(ABORT, 'invitation attempts are immutable'); END;
