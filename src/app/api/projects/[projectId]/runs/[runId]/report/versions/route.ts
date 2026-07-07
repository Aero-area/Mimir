import db from '@/lib/db';
import { reports } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ projectId: string; runId: string }> },
) => {
  try {
    const { runId } = await params;

    const runVersions = await db.query.reports.findMany({
      where: eq(reports.runId, runId),
      orderBy: desc(reports.version),
    });

    return Response.json({ versions: runVersions }, { status: 200 });

  } catch (err: any) {
    console.error('Error in GET /api/projects/[projectId]/runs/[runId]/report/versions:', err);
    return Response.json(
      { message: 'An error occurred fetching versions', error: err.message || err },
      { status: 500 }
    );
  }
};
