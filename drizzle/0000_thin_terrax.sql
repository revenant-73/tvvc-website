CREATE TABLE `account` (
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	PRIMARY KEY(`provider`, `provider_account_id`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `athletes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`registration_id` text,
	`parent_id` text,
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
	`waiver_agreed` integer DEFAULT false,
	`photo_release_agreed` integer DEFAULT false,
	`metadata` text,
	FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `athletes_parent_id_idx` ON `athletes` (`parent_id`);--> statement-breakpoint
CREATE INDEX `athletes_registration_id_idx` ON `athletes` (`registration_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`date_info` text NOT NULL,
	`time_info` text,
	`start_date` text,
	`end_date` text,
	`price` integer NOT NULL,
	`capacity` integer NOT NULL,
	`spots_filled` integer DEFAULT 0,
	`pending_spots` integer DEFAULT 0,
	`active` integer DEFAULT true,
	`email_details` text,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `events_parent_id_idx` ON `events` (`parent_id`);--> statement-breakpoint
CREATE INDEX `events_type_idx` ON `events` (`type`);--> statement-breakpoint
CREATE INDEX `events_start_date_idx` ON `events` (`start_date`);--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_type` text NOT NULL,
	`team` text NOT NULL,
	`anonymous` text NOT NULL,
	`name` text,
	`overall_rating` integer NOT NULL,
	`best_parts` text,
	`frustrating_parts` text,
	`keep_doing` text,
	`consider_changing` text,
	`coaching_positive` integer NOT NULL,
	`coaching_growth` integer NOT NULL,
	`practices_useful` integer NOT NULL,
	`encouraged_problem_solving` integer NOT NULL,
	`coaching_well` text,
	`coaching_improve` text,
	`team_environment` text,
	`club_communication` integer NOT NULL,
	`team_communication` integer NOT NULL,
	`easy_to_understand` integer NOT NULL,
	`communication_well` text,
	`communication_improve` text,
	`confusion_moments` text,
	`good_value` integer NOT NULL,
	`time_commitment` integer NOT NULL,
	`tournament_schedule` integer NOT NULL,
	`better_value` text,
	`unclear_logistics` text,
	`volleyball_growth` integer NOT NULL,
	`personal_growth` integer NOT NULL,
	`noticeable_growth` text,
	`support_needed` text,
	`return_likelihood` integer NOT NULL,
	`return_incentive` text,
	`additional_opportunities` text,
	`important_opportunities` text,
	`future_hope` text,
	`leadership_understanding` text,
	`appreciation` text,
	`advice` text,
	`anything_else` text,
	`user_id` text,
	`metadata` text,
	`starred` integer DEFAULT false,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `feedback_user_id_idx` ON `feedback` (`user_id`);--> statement-breakpoint
CREATE TABLE `feedback_answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`feedback_id` integer,
	`question_key` text NOT NULL,
	`answer_value` text NOT NULL,
	`category` text,
	FOREIGN KEY (`feedback_id`) REFERENCES `feedback`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `feedback_answers_feedback_id_idx` ON `feedback_answers` (`feedback_id`);--> statement-breakpoint
CREATE TABLE `registration_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`registration_id` text,
	`athlete_id` integer,
	`event_id` text,
	FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `registration_items_registration_id_idx` ON `registration_items` (`registration_id`);--> statement-breakpoint
CREATE INDEX `registration_items_athlete_id_idx` ON `registration_items` (`athlete_id`);--> statement-breakpoint
CREATE INDEX `registration_items_event_id_idx` ON `registration_items` (`event_id`);--> statement-breakpoint
CREATE TABLE `registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`parent_name` text NOT NULL,
	`parent_email` text NOT NULL,
	`parent_phone` text NOT NULL,
	`secondary_parent_name` text,
	`secondary_parent_email` text,
	`secondary_parent_phone` text,
	`emergency_phone` text,
	`stripe_session_id` text,
	`stripe_customer_id` text,
	`status` text DEFAULT 'pending',
	`needs_review` integer DEFAULT false,
	`total_amount` integer NOT NULL,
	`metadata` text,
	`expires_at` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `registrations_parent_email_idx` ON `registrations` (`parent_email`);--> statement-breakpoint
CREATE INDEX `registrations_user_id_idx` ON `registrations` (`user_id`);--> statement-breakpoint
CREATE INDEX `registrations_stripe_session_id_idx` ON `registrations` (`stripe_session_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`session_token` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`email_verified` integer,
	`image` text,
	`role` text DEFAULT 'user',
	`stripe_customer_id` text,
	`emergency_phone` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `user_email_idx` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification_token` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
