CREATE TABLE IF NOT EXISTS `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text NOT NULL DEFAULT 'active',
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `research_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`input` text NOT NULL,
	`status` text NOT NULL,
	`startedAt` text NOT NULL,
	`completedAt` text,
	`chatModelProvider` text,
	`chatModelKey` text,
	`error` text,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `search_queries` (
	`id` text PRIMARY KEY NOT NULL,
	`runId` text NOT NULL,
	`query` text NOT NULL,
	`sourceType` text NOT NULL,
	`status` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`runId`) REFERENCES `research_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`runId` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`canonicalUrl` text NOT NULL,
	`sourceType` text NOT NULL,
	`provider` text,
	`authors` text,
	`publishedAt` text,
	`retrievedAt` text NOT NULL,
	`doi` text,
	`metadata` text,
	FOREIGN KEY (`runId`) REFERENCES `research_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`runId` text NOT NULL,
	`content` text NOT NULL,
	`status` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`runId`) REFERENCES `research_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `research_runs_project_id_idx` ON `research_runs` (`projectId`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `research_runs_status_idx` ON `research_runs` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `search_queries_run_id_idx` ON `search_queries` (`runId`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `search_queries_status_idx` ON `search_queries` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `sources_run_id_idx` ON `sources` (`runId`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `sources_canonical_url_idx` ON `sources` (`canonicalUrl`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `reports_run_id_idx` ON `reports` (`runId`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `reports_status_idx` ON `reports` (`status`);
