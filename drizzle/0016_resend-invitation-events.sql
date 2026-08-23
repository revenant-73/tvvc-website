CREATE TABLE `club_season_invitation_delivery_events` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`batch_item_id` text,
	`provider_message_id` text NOT NULL,
	`webhook_message_id` text NOT NULL,
	`event_type` text NOT NULL,
	`event_created_at` text NOT NULL,
	`recipient_email` text,
	`severity` text DEFAULT 'info' NOT NULL,
	`reason` text,
	`payload` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `club_season_invitation_delivery_attempts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`batch_id`) REFERENCES `club_season_invitation_batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`batch_item_id`) REFERENCES `club_season_invitation_batch_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_invitation_delivery_events_webhook_unique` ON `club_season_invitation_delivery_events` (`webhook_message_id`);
--> statement-breakpoint
CREATE INDEX `club_season_invitation_delivery_events_attempt_idx` ON `club_season_invitation_delivery_events` (`attempt_id`);
--> statement-breakpoint
CREATE INDEX `club_season_invitation_delivery_events_provider_idx` ON `club_season_invitation_delivery_events` (`provider_message_id`);
--> statement-breakpoint
CREATE INDEX `club_season_invitation_delivery_events_batch_idx` ON `club_season_invitation_delivery_events` (`batch_id`);
--> statement-breakpoint
CREATE INDEX `club_season_invitation_delivery_events_type_idx` ON `club_season_invitation_delivery_events` (`event_type`);
--> statement-breakpoint
CREATE INDEX `club_season_invitation_delivery_events_created_idx` ON `club_season_invitation_delivery_events` (`event_created_at`);
--> statement-breakpoint
CREATE TRIGGER `club_season_invitation_delivery_events_no_update` BEFORE UPDATE ON `club_season_invitation_delivery_events` BEGIN SELECT RAISE(ABORT, 'invitation delivery events are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `club_season_invitation_delivery_events_no_delete` BEFORE DELETE ON `club_season_invitation_delivery_events` BEGIN SELECT RAISE(ABORT, 'invitation delivery events are immutable'); END;
