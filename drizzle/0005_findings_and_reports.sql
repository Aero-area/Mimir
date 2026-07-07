CREATE TABLE `reports_backup` (
  `id` text PRIMARY KEY NOT NULL,
  `runId` text NOT NULL,
  `content` text NOT NULL,
  `status` text NOT NULL,
  `createdAt` text NOT NULL,
  `updatedAt` text NOT NULL
);

INSERT INTO `reports_backup` SELECT id, runId, content, status, createdAt, updatedAt FROM reports;

DROP TABLE `reports`;

CREATE TABLE `reports` (
  `id` text PRIMARY KEY NOT NULL,
  `runId` text NOT NULL REFERENCES `research_runs`(`id`) ON DELETE cascade,
  `content` text NOT NULL,
  `status` text NOT NULL,
  `createdAt` text NOT NULL,
  `updatedAt` text NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `generatedAt` text NOT NULL,
  `modelProvider` text,
  `modelKey` text,
  `isActive` integer DEFAULT 0,
  `summary` text,
  `metadata` text
);

CREATE INDEX `reports_run_id_idx` ON `reports` (`runId`);
CREATE INDEX `reports_status_idx` ON `reports` (`status`);

INSERT INTO `reports` (id, runId, content, status, createdAt, updatedAt, version, generatedAt, modelProvider, modelKey, isActive, metadata)
SELECT id, runId, content, status, createdAt, updatedAt, 1, createdAt, NULL, NULL, 1, NULL FROM reports_backup;

DROP TABLE `reports_backup`;

--> statement-breakpoint

CREATE TABLE `source_assessments` (
  `id` text PRIMARY KEY NOT NULL,
  `runId` text NOT NULL REFERENCES `research_runs`(`id`) ON DELETE cascade,
  `sourceId` text NOT NULL REFERENCES `sources`(`id`) ON DELETE cascade,
  `directRelevance` text NOT NULL,
  `originalSource` text NOT NULL,
  `publicationStatus` text NOT NULL,
  `methodTransparency` text NOT NULL,
  `implementationEvidence` text NOT NULL,
  `recency` text NOT NULL,
  `knownLimitations` text NOT NULL,
  `qualityReasoning` text NOT NULL,
  `createdAt` text NOT NULL
);

CREATE INDEX `source_assessments_run_id_idx` ON `source_assessments` (`runId`);
CREATE INDEX `source_assessments_source_id_idx` ON `source_assessments` (`sourceId`);

--> statement-breakpoint

CREATE TABLE `findings` (
  `id` text PRIMARY KEY NOT NULL,
  `runId` text NOT NULL REFERENCES `research_runs`(`id`) ON DELETE cascade,
  `statement` text NOT NULL,
  `category` text NOT NULL,
  `status` text NOT NULL,
  `reasoning` text NOT NULL,
  `createdAt` text NOT NULL
);

CREATE INDEX `findings_run_id_idx` ON `findings` (`runId`);
CREATE INDEX `findings_category_idx` ON `findings` (`category`);

--> statement-breakpoint

CREATE TABLE `finding_consequences` (
  `id` text PRIMARY KEY NOT NULL,
  `findingId` text NOT NULL REFERENCES `findings`(`id`) ON DELETE cascade,
  `impactDescription` text NOT NULL,
  `affectedChoice` text NOT NULL,
  `riskChange` text NOT NULL,
  `reopenAssumptions` text NOT NULL,
  `validationRequired` text NOT NULL,
  `createdAt` text NOT NULL
);

CREATE INDEX `finding_consequences_finding_id_idx` ON `finding_consequences` (`findingId`);

--> statement-breakpoint

CREATE TABLE `finding_sources` (
  `id` text PRIMARY KEY NOT NULL,
  `findingId` text NOT NULL REFERENCES `findings`(`id`) ON DELETE cascade,
  `sourceId` text NOT NULL REFERENCES `sources`(`id`) ON DELETE cascade,
  `relationType` text NOT NULL,
  `excerpt` text,
  `location` text,
  `createdAt` text NOT NULL
);

CREATE INDEX `finding_sources_finding_id_idx` ON `finding_sources` (`findingId`);
CREATE INDEX `finding_sources_source_id_idx` ON `finding_sources` (`sourceId`);
