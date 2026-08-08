CREATE TABLE `club_season_launch_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`type` text NOT NULL,
	`evidence_reference` text NOT NULL,
	`checks_snapshot` text,
	`recorded_by_user_id` text NOT NULL,
	`recorded_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `club_seasons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recorded_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_season_launch_evidence_season_type_unique` ON `club_season_launch_evidence` (`season_id`,`type`);--> statement-breakpoint
CREATE INDEX `club_season_launch_evidence_season_id_idx` ON `club_season_launch_evidence` (`season_id`);--> statement-breakpoint
CREATE INDEX `club_season_launch_evidence_recorded_by_idx` ON `club_season_launch_evidence` (`recorded_by_user_id`);
--> statement-breakpoint
CREATE TRIGGER `club_season_launch_evidence_insert_guard`
BEFORE INSERT ON `club_season_launch_evidence`
FOR EACH ROW
WHEN NEW.`type` NOT IN ('resend_domain', 'stripe_live_review', 'controlled_pilot')
  OR trim(NEW.`evidence_reference`) = ''
  OR (NEW.`type` = 'controlled_pilot' AND NEW.`checks_snapshot` IS NULL)
  OR (NEW.`type` <> 'controlled_pilot' AND NEW.`checks_snapshot` IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'Invalid launch evidence');
END;
--> statement-breakpoint
CREATE TRIGGER `club_season_launch_evidence_update_restricted`
BEFORE UPDATE ON `club_season_launch_evidence`
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Launch evidence is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `club_season_launch_evidence_delete_restricted`
BEFORE DELETE ON `club_season_launch_evidence`
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Launch evidence cannot be deleted');
END;
