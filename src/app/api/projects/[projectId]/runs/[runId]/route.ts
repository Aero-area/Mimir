import db from '@/lib/db';
import { researchRuns, searchQueries, sources, reports } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ projectId: string; runId: string }> },
) => {
  try {
    const { runId } = await params;
    const run = await db.query.researchRuns.findFirst({
      where: eq(researchRuns.id, runId),
    });

    if (!run) {
      return Response.json({ message: 'Research run not found' }, { status: 404 });
    }

    const queriesList = await db.query.searchQueries.findMany({
      where: eq(searchQueries.runId, runId),
    });

    const sourcesList = await db.query.sources.findMany({
      where: eq(sources.runId, runId),
    });

    const reportsList = await db.query.reports.findMany({
      where: eq(reports.runId, runId),
    });

    return Response.json(
      {
        run,
        queries: queriesList,
        sources: sourcesList,
        reports: reportsList,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in GET /api/projects/[projectId]/runs/[runId]: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
