import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable, index } from 'drizzle-orm/sqlite-core';
import { Block } from '../types';
import { SearchSources } from '../agents/search/types';

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey(),
  messageId: text('messageId').notNull(),
  chatId: text('chatId').notNull(),
  backendId: text('backendId').notNull(),
  query: text('query').notNull(),
  createdAt: text('createdAt').notNull(),
  responseBlocks: text('responseBlocks', { mode: 'json' })
    .$type<Block[]>()
    .default(sql`'[]'`),
  status: text({ enum: ['answering', 'completed', 'error'] }).default(
    'answering',
  ),
});

interface DBFile {
  name: string;
  fileId: string;
}

export const chats = sqliteTable('chats', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: text('createdAt').notNull(),
  sources: text('sources', {
    mode: 'json',
  })
    .$type<SearchSources[]>()
    .default(sql`'[]'`),
  files: text('files', { mode: 'json' })
    .$type<DBFile[]>()
    .default(sql`'[]'`),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('active'),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
});

export const researchRuns = sqliteTable('research_runs', {
  id: text('id').primaryKey(),
  projectId: text('projectId')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  input: text('input').notNull(),
  status: text('status').notNull(),
  startedAt: text('startedAt').notNull(),
  completedAt: text('completedAt'),
  chatModelProvider: text('chatModelProvider'),
  chatModelKey: text('chatModelKey'),
  error: text('error'),
  metadata: text('metadata'),
}, (table) => ({
  projectIdx: index('research_runs_project_id_idx').on(table.projectId),
  statusIdx: index('research_runs_status_idx').on(table.status),
}));

export const searchQueries = sqliteTable('search_queries', {
  id: text('id').primaryKey(),
  runId: text('runId')
    .notNull()
    .references(() => researchRuns.id, { onDelete: 'cascade' }),
  query: text('query').notNull(),
  sourceType: text('sourceType').notNull(),
  status: text('status').notNull(),
  createdAt: text('createdAt').notNull(),
}, (table) => ({
  runIdx: index('search_queries_run_id_idx').on(table.runId),
  statusIdx: index('search_queries_status_idx').on(table.status),
}));

export const sources = sqliteTable('sources', {
  id: text('id').primaryKey(),
  runId: text('runId')
    .notNull()
    .references(() => researchRuns.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  url: text('url').notNull(),
  canonicalUrl: text('canonicalUrl').notNull(),
  sourceType: text('sourceType').notNull(),
  provider: text('provider'),
  authors: text('authors'),
  publishedAt: text('publishedAt'),
  retrievedAt: text('retrievedAt').notNull(),
  doi: text('doi'),
  metadata: text('metadata'), // JSON text
}, (table) => ({
  runIdx: index('sources_run_id_idx').on(table.runId),
  canonicalUrlIdx: index('sources_canonical_url_idx').on(table.canonicalUrl),
}));

export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(),
  runId: text('runId')
    .notNull()
    .references(() => researchRuns.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  status: text('status').notNull(),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
  version: integer('version').notNull().default(1),
  generatedAt: text('generatedAt').notNull(),
  modelProvider: text('modelProvider'),
  modelKey: text('modelKey'),
  isActive: integer('isActive').default(0),
  summary: text('summary'),
  metadata: text('metadata'),
}, (table) => ({
  runIdx: index('reports_run_id_idx').on(table.runId),
  statusIdx: index('reports_status_idx').on(table.status),
}));

export const sourceAssessments = sqliteTable('source_assessments', {
  id: text('id').primaryKey(),
  runId: text('runId')
    .notNull()
    .references(() => researchRuns.id, { onDelete: 'cascade' }),
  sourceId: text('sourceId')
    .notNull()
    .references(() => sources.id, { onDelete: 'cascade' }),
  directRelevance: text('directRelevance').notNull(),
  originalSource: text('originalSource').notNull(),
  publicationStatus: text('publicationStatus').notNull(),
  methodTransparency: text('methodTransparency').notNull(),
  implementationEvidence: text('implementationEvidence').notNull(),
  recency: text('recency').notNull(),
  knownLimitations: text('knownLimitations').notNull(),
  qualityReasoning: text('qualityReasoning').notNull(),
  createdAt: text('createdAt').notNull(),
}, (table) => ({
  runIdx: index('source_assessments_run_id_idx').on(table.runId),
  sourceIdx: index('source_assessments_source_id_idx').on(table.sourceId),
}));

export const findings = sqliteTable('findings', {
  id: text('id').primaryKey(),
  runId: text('runId')
    .notNull()
    .references(() => researchRuns.id, { onDelete: 'cascade' }),
  statement: text('statement').notNull(),
  category: text('category').notNull(),
  status: text('status').notNull(),
  reasoning: text('reasoning').notNull(),
  createdAt: text('createdAt').notNull(),
}, (table) => ({
  runIdx: index('findings_run_id_idx').on(table.runId),
  categoryIdx: index('findings_category_idx').on(table.category),
}));

export const findingConsequences = sqliteTable('finding_consequences', {
  id: text('id').primaryKey(),
  findingId: text('findingId')
    .notNull()
    .references(() => findings.id, { onDelete: 'cascade' }),
  impactDescription: text('impactDescription').notNull(),
  affectedChoice: text('affectedChoice').notNull(),
  riskChange: text('riskChange').notNull(),
  reopenAssumptions: text('reopenAssumptions').notNull(),
  validationRequired: text('validationRequired').notNull(),
  createdAt: text('createdAt').notNull(),
}, (table) => ({
  findingIdx: index('finding_consequences_finding_id_idx').on(table.findingId),
}));

export const findingSources = sqliteTable('finding_sources', {
  id: text('id').primaryKey(),
  findingId: text('findingId')
    .notNull()
    .references(() => findings.id, { onDelete: 'cascade' }),
  sourceId: text('sourceId')
    .notNull()
    .references(() => sources.id, { onDelete: 'cascade' }),
  relationType: text('relationType').notNull(),
  excerpt: text('excerpt'),
  location: text('location'),
  createdAt: text('createdAt').notNull(),
}, (table) => ({
  findingIdx: index('finding_sources_finding_id_idx').on(table.findingId),
  sourceIdx: index('finding_sources_source_id_idx').on(table.sourceId),
}));

