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
}, (table) => ({
  runIdx: index('reports_run_id_idx').on(table.runId),
  statusIdx: index('reports_status_idx').on(table.status),
}));

