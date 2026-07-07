import db from '@/lib/db';
import { projects, researchRuns, searchQueries, sources } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { searchWeb } from '@/lib/adapters/searxng';
import { searchOpenAlex } from '@/lib/adapters/openalex';
import { searchGithub } from '@/lib/adapters/github';
import { mergeSources } from '@/lib/utils/normalization';
import { NormalizedSource } from '@/lib/types/sources';

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ projectId: string; runId: string }> },
) => {
  try {
    const { projectId, runId } = await params;
    
    // Verify project and run exist
    const projectExists = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    const runExists = await db.query.researchRuns.findFirst({
      where: eq(researchRuns.id, runId),
    });

    if (!projectExists || !runExists) {
      return Response.json({ message: 'Project or research run not found' }, { status: 404 });
    }

    const body = await req.json();
    const { query, sourceTypes } = body as { query: string; sourceTypes: ('web' | 'academic' | 'repository')[] };

    if (!query || !sourceTypes || !Array.isArray(sourceTypes) || sourceTypes.length === 0) {
      return Response.json({ message: 'Query and sourceTypes are required' }, { status: 400 });
    }

    const collectedSources: NormalizedSource[] = [];
    const queriesToInsert: any[] = [];
    const errors: string[] = [];

    // Parallel execution of adapters
    const promises = sourceTypes.map(async (type) => {
      const queryId = crypto.randomUUID();
      const now = new Date().toISOString();

      try {
        let results: NormalizedSource[] = [];
        if (type === 'web') {
          results = await searchWeb(query);
        } else if (type === 'academic') {
          results = await searchOpenAlex(query);
        } else if (type === 'repository') {
          results = await searchGithub(query);
        }

        collectedSources.push(...results);
        queriesToInsert.push({
          id: queryId,
          runId,
          query,
          sourceType: type,
          status: 'completed',
          createdAt: now,
        });
      } catch (err: any) {
        console.error(`Adapter [${type}] failed:`, err);
        errors.push(`${type}: ${err.message || err}`);
        queriesToInsert.push({
          id: queryId,
          runId,
          query,
          sourceType: type,
          status: 'error',
          createdAt: now,
        });
      }
    });

    await Promise.all(promises);

    // Save queries in database
    for (const q of queriesToInsert) {
      await db.insert(searchQueries).values(q).execute();
    }

    // Fetch existing sources from DB for deduplication
    const existingDbSources = await db.query.sources.findMany({
      where: eq(sources.runId, runId),
    });

    // Map DB sources to NormalizedSource format
    const existingMapped: NormalizedSource[] = existingDbSources.map((s) => ({
      title: s.title,
      url: s.url,
      canonicalUrl: s.canonicalUrl,
      sourceType: s.sourceType as any,
      provider: s.provider || '',
      authors: s.authors,
      publishedAt: s.publishedAt,
      retrievedAt: s.retrievedAt,
      doi: s.doi,
      snippet: s.metadata ? (JSON.parse(s.metadata).snippetPreview || null) : null,
      metadata: s.metadata ? JSON.parse(s.metadata) : {},
    }));

    // Merge and Deduplicate
    const allCombined = [...existingMapped, ...collectedSources];
    const finalMerged = mergeSources(allCombined);

    // Delete existing sources for this run
    await db.delete(sources).where(eq(sources.runId, runId)).execute();

    // Insert newly merged sources
    for (const src of finalMerged) {
      const sourceId = crypto.randomUUID();
      // Embed snippet preview inside metadata JSON for easy storage
      const meta = {
        ...(src.metadata || {}),
        snippetPreview: src.snippet || null,
      };

      await db.insert(sources).values({
        id: sourceId,
        runId,
        title: src.title,
        url: src.url,
        canonicalUrl: src.canonicalUrl,
        sourceType: src.sourceType,
        provider: src.provider,
        authors: src.authors,
        publishedAt: src.publishedAt,
        retrievedAt: src.retrievedAt,
        doi: src.doi,
        metadata: JSON.stringify(meta),
      }).execute();
    }

    const summary = {
      totalFound: collectedSources.length,
      totalSaved: finalMerged.length,
      sourcesByType: {
        web: finalMerged.filter(s => s.sourceType === 'web').length,
        academic: finalMerged.filter(s => s.sourceType === 'academic').length,
        repository: finalMerged.filter(s => s.sourceType === 'repository').length,
      }
    };

    return Response.json({
      searchQueries: queriesToInsert,
      sources: finalMerged,
      errors,
      summary
    }, { status: 200 });

  } catch (err: any) {
    console.error('Error in POST /api/projects/[projectId]/runs/[runId]/collect: ', err);
    return Response.json(
      { message: 'An error has occurred.', error: err.message || err },
      { status: 500 },
    );
  }
};
