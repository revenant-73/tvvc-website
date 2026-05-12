CREATE TABLE `feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text,
	`player_name` text,
	`coach_rating` integer NOT NULL,
	`coach_comments` text,
	`overall_rating` integer NOT NULL,
	`overall_comments` text,
	`went_well` text NOT NULL,
	`to_improve` text NOT NULL,
	`next_season` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
