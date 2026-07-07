import z from 'zod';
import db from '../db';
import { researchRuns, searchQueries, sources } from '../db/schema';
import { eq } from 'drizzle-orm';
import { projectAnalysisPrompt, researchPlanPrompt, roundEvaluationPrompt } from '../prompts/researchLoop';
import { searchWeb } from '../adapters/searxng';
import { searchOpenAlex } from '../adapters/openalex';
import { searchGithub } from '../adapters/github';
import { mergeSources } from '../utils/normalization';
import { NormalizedSource } from '../types/sources';

const analysisSchema = z.object({
  purpose: z.string().describe('The primary goal of the project.'),
  problem: z.string().describe('The core technical challenge or question.'),
  constraints: z.array(z.string()).describe('Direct requirements, technology constraints, or memory limitations.'),
  assumptions: z.array(z.string()).describe('Explicit or implicit assumptions.'),
  unknowns: z.array(z.string()).describe('Unknown topics or missing data.'),
  keyTerms: z.array(z.string()).describe('Core technical keywords.'),
});

const planSchema = z.object({
  tracks: z.array(z.object({
    name: z.string().describe('Name of the research track.'),
    description: z.string().describe('Brief description of what this track aims to discover.'),
    sourceTypes: z.array(z.enum(['web', 'academic', 'repository'])).describe('Adapters required for this track.'),
  })),
  terminologyMap: z.object({
    academicTerms: z.array(z.string()).describe('Academic or theoretical synonyms.'),
    technicalTerms: z.array(z.string()).describe('Official technical keywords.'),
    implementationTerms: z.array(z.string()).describe('Keywords related to code/repositories.'),
    communityTerms: z.array(z.string()).describe('Forum, blog, or community keywords.'),
  }),
});

const evaluationSchema = z.object({
  coveredTracks: z.array(z.string()).describe('List of tracks or questions fully answered in this round.'),
  remainingGaps: z.array(z.string()).describe('List of outstanding uncertainties or missing details.'),
  newQueries: z.array(z.object({
    query: z.string().describe('Search query string.'),
    sourceTypes: z.array(z.enum(['web', 'academic', 'repository'])).describe('Source adapters to target.'),
  })).describe('List of next queries to run.'),
  shouldStop: z.boolean().describe('Indicates whether we should terminate the loop.'),
  stopReason: z.string().optional().describe('Reason for stopping research.'),
});

export interface ResearchLoopProgress {
  phase: 'analyzing' | 'planning' | 'round_start' | 'searching' | 'evaluating' | 'completed' | 'failed';
  roundNumber?: number;
  message: string;
  data?: any;
}

export async function runResearchLoop(
  projectId: string,
  runId: string,
  llm: any,
  onProgress: (progress: ResearchLoopProgress) => void
) {
  try {
    onProgress({ phase: 'analyzing', message: 'Analyzing project scope and description...' });
    
    const run = await db.query.researchRuns.findFirst({
      where: eq(researchRuns.id, runId),
    });
    if (!run) throw new Error('Research run not found');

    // 1. PROJECT ANALYSIS
    const analysis = (await llm.generateObject({
      messages: [
        { role: 'system', content: projectAnalysisPrompt },
        { role: 'user', content: `Project description to analyze:\n${run.input}` },
      ],
      schema: analysisSchema,
    })) as z.infer<typeof analysisSchema>;

    onProgress({
      phase: 'planning',
      message: 'Creating structured research tracks and terminology maps...',
      data: { analysis }
    });

    // 2. RESEARCH PLANNING
    const plan = (await llm.generateObject({
      messages: [
        { role: 'system', content: researchPlanPrompt },
        { role: 'user', content: `Project Analysis:\n${JSON.stringify(analysis, null, 2)}` },
      ],
      schema: planSchema,
    })) as z.infer<typeof planSchema>;

    // Initialize loop metadata
    const runMetadata = {
      projectAnalysis: analysis,
      terminologyMap: plan.terminologyMap,
      researchPlan: {
        tracks: plan.tracks.map((t, idx) => ({
          id: `track-${idx}`,
          name: t.name,
          description: t.description,
          sourceTypes: t.sourceTypes,
          status: 'pending' as 'pending' | 'active' | 'completed' | 'skipped',
        }))
      },
      rounds: [] as any[],
      stopReason: '',
      identifiedGaps: analysis.unknowns,
    };

    await db.update(researchRuns)
      .set({
        status: 'analyzing',
        metadata: JSON.stringify(runMetadata)
      })
      .where(eq(researchRuns.id, runId))
      .execute();

    let currentRound = 1;
    const maxRounds = 3;
    let shouldStop = false;
    let stopReason = '';

    // Initial queries: pick first queries from key terms / tracks
    let activeQueries = plan.tracks.map((track) => ({
      query: `${analysis.keyTerms[0] || run.input} ${track.name}`,
      sourceTypes: track.sourceTypes,
    }));

    while (currentRound <= maxRounds && !shouldStop) {
      onProgress({
        phase: 'round_start',
        roundNumber: currentRound,
        message: `Starting research round ${currentRound}...`,
        data: { activeQueries }
      });

      const roundQueriesLogged: string[] = [];
      const newlyFoundSources: NormalizedSource[] = [];
      const errors: string[] = [];

      onProgress({
        phase: 'searching',
        roundNumber: currentRound,
        message: `Querying sources for round ${currentRound}...`,
      });

      // Run queries in parallel/sequentially
      for (const q of activeQueries) {
        const queryPromises = q.sourceTypes.map(async (type) => {
          const queryId = crypto.randomUUID();
          const now = new Date().toISOString();
          try {
            let results: NormalizedSource[] = [];
            if (type === 'web') {
              results = await searchWeb(q.query);
            } else if (type === 'academic') {
              results = await searchOpenAlex(q.query);
            } else if (type === 'repository') {
              results = await searchGithub(q.query);
            }
            newlyFoundSources.push(...results);
            await db.insert(searchQueries).values({
              id: queryId,
              runId,
              query: q.query,
              sourceType: type,
              status: 'completed',
              createdAt: now,
            }).execute();
            roundQueriesLogged.push(`${type}: ${q.query}`);
          } catch (err: any) {
            console.error(`Loop search error [${type}]:`, err);
            errors.push(`${type} query [${q.query}] failed: ${err.message || err}`);
            await db.insert(searchQueries).values({
              id: queryId,
              runId,
              query: q.query,
              sourceType: type,
              status: 'error',
              createdAt: now,
            }).execute();
          }
        });
        await Promise.all(queryPromises);
      }

      // Fetch existing sources from DB and merge
      const existingDbSources = await db.query.sources.findMany({
        where: eq(sources.runId, runId),
      });

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

      const beforeCount = existingMapped.length;
      const allCombined = [...existingMapped, ...newlyFoundSources];
      const finalMerged = mergeSources(allCombined);
      const afterCount = finalMerged.length;

      // Save merged sources
      await db.delete(sources).where(eq(sources.runId, runId)).execute();
      for (const src of finalMerged) {
        const sourceId = crypto.randomUUID();
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
          metadata: JSON.stringify({
            ...(src.metadata || {}),
            snippetPreview: src.snippet || null,
          }),
        }).execute();
      }

      // Calculate duplicate rate
      const newUniqueCount = afterCount - beforeCount;
      const totalCollectedThisRound = newlyFoundSources.length;
      const duplicateRate = totalCollectedThisRound > 0 
        ? (totalCollectedThisRound - newUniqueCount) / totalCollectedThisRound
        : 0;

      onProgress({
        phase: 'evaluating',
        roundNumber: currentRound,
        message: `Evaluating round ${currentRound} collection results...`,
      });

      // 3. ROUND EVALUATION
      const sourcesContext = finalMerged.slice(0, 15).map((s) => ({
        title: s.title,
        type: s.sourceType,
        authors: s.authors,
        snippet: s.snippet ? s.snippet.slice(0, 300) : '',
      }));

      const evaluation = (await llm.generateObject({
        messages: [
          { role: 'system', content: roundEvaluationPrompt },
          {
            role: 'user',
            content: `Original Project Description: ${run.input}
Project Gaps: ${JSON.stringify(runMetadata.identifiedGaps)}
Newly Collected Sources: ${JSON.stringify(sourcesContext, null, 2)}`
          },
        ],
        schema: evaluationSchema,
      })) as z.infer<typeof evaluationSchema>;

      // Update tracks status
      runMetadata.researchPlan.tracks = runMetadata.researchPlan.tracks.map((t) => {
        const isCovered = evaluation.coveredTracks.some((ct) => ct.toLowerCase().includes(t.name.toLowerCase()));
        return {
          ...t,
          status: isCovered ? ('completed' as const) : ('active' as const),
        };
      });

      // Append round results
      runMetadata.rounds.push({
        roundNumber: currentRound,
        queriesExecuted: roundQueriesLogged,
        sourcesFoundCount: totalCollectedThisRound,
        gapsIdentified: evaluation.remainingGaps,
        isCompleted: true,
      });
      runMetadata.identifiedGaps = evaluation.remainingGaps;

      // Check stop conditions
      if (evaluation.shouldStop) {
        shouldStop = true;
        stopReason = evaluation.stopReason || 'LLM evaluated that enough information has been gathered.';
      } else if (evaluation.newQueries.length === 0) {
        shouldStop = true;
        stopReason = 'LLM generated 0 new search queries.';
      } else if (duplicateRate >= 0.85 && totalCollectedThisRound > 5) {
        shouldStop = true;
        stopReason = `High duplicate rate (${(duplicateRate * 100).toFixed(0)}%). New queries primarily return existing sources.`;
      } else if (currentRound === maxRounds) {
        shouldStop = true;
        stopReason = `Maximum research round limit (${maxRounds}) reached.`;
      }

      if (shouldStop) {
        runMetadata.stopReason = stopReason;
      } else {
        // Prepare next round queries
        activeQueries = evaluation.newQueries.map((nq: any) => ({
          query: nq.query,
          sourceTypes: nq.sourceTypes,
        }));
        currentRound++;
      }

      // Update DB with intermediate metadata
      await db.update(researchRuns)
        .set({
          status: `round_${currentRound - (shouldStop ? 1 : 0)}`,
          metadata: JSON.stringify(runMetadata)
        })
        .where(eq(researchRuns.id, runId))
        .execute();
    }

    // Mark completed
    await db.update(researchRuns)
      .set({
        status: 'completed',
        completedAt: new Date().toISOString(),
        metadata: JSON.stringify(runMetadata)
      })
      .where(eq(researchRuns.id, runId))
      .execute();

    onProgress({
      phase: 'completed',
      message: `Research loop finished successfully. Stop reason: ${stopReason}`,
      data: { metadata: runMetadata }
    });

  } catch (err: any) {
    console.error('Error executing research loop:', err);
    await db.update(researchRuns)
      .set({
        status: 'failed',
        error: err.message || String(err)
      })
      .where(eq(researchRuns.id, runId))
      .execute();

    onProgress({
      phase: 'failed',
      message: `Research loop failed: ${err.message || err}`,
      data: { error: err.message || err }
    });
  }
}
