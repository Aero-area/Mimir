import db from '@/lib/db';
import { reports } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ projectId: string; runId: string; versionId: string }> },
) => {
  try {
    const { runId, versionId } = await params;

    // Find the report version
    const targetReport = await db.query.reports.findFirst({
      where: and(eq(reports.runId, runId), eq(reports.id, versionId))
    });

    if (!targetReport) {
      return Response.json({ message: 'Report version not found' }, { status: 404 });
    }

    if (targetReport.status !== 'completed') {
      return Response.json({ message: 'Only completed reports can be set as active' }, { status: 400 });
    }

    // Mark all reports for this run inactive
    await db.update(reports)
      .set({ isActive: 0 })
      .where(eq(reports.runId, runId))
      .execute();

    // Mark this report active
    await db.update(reports)
      .set({ isActive: 1 })
      .where(eq(reports.id, versionId))
      .execute();

    return Response.json({ message: 'Report version activated successfully' }, { status: 200 });

  } catch (err: any) {
    console.error('Error in POST /api/projects/[projectId]/runs/[runId]/report/versions/[versionId]/active:', err);
    return Response.json(
      { message: 'Failed to activate report version', error: err.message || err },
      { status: 500 }
    );
  }
};
