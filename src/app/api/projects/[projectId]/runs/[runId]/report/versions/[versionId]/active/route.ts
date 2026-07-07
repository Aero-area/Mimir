import db from '@/lib/db';
import { reports } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ projectId: string; runId: string; versionId: string }> },
) => {
  try {
    const { runId, versionId } = await params;

    const result = await db.transaction(async (tx) => {
      // Find the report version
      const targetReport = await tx.query.reports.findFirst({
        where: and(eq(reports.runId, runId), eq(reports.id, versionId))
      });

      if (!targetReport) {
        return { success: false, message: 'Report version not found', status: 404 };
      }

      if (targetReport.status !== 'completed') {
        return { success: false, message: 'Only completed reports can be set as active', status: 400 };
      }

      // Mark all reports for this run inactive
      await tx.update(reports)
        .set({ isActive: 0 })
        .where(eq(reports.runId, runId))
        .execute();

      // Mark this report active
      await tx.update(reports)
        .set({ isActive: 1 })
        .where(eq(reports.id, versionId))
        .execute();

      return { success: true, message: 'Report version activated successfully', status: 200 };
    });

    return Response.json({ message: result.message }, { status: result.status });

  } catch (err: any) {
    console.error('Error in POST /api/projects/[projectId]/runs/[runId]/report/versions/[versionId]/active:', err);
    return Response.json(
      { message: 'Failed to activate report version', error: err.message || err },
      { status: 500 }
    );
  }
};
