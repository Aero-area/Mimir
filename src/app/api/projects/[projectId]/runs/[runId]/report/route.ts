import db from '@/lib/db';
import { projects, researchRuns, reports, findings, sourceAssessments, findingConsequences, findingSources } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import ModelRegistry from '@/lib/models/registry';
import { generateReportAndEvidence } from '@/lib/agents/reportGenerator';

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

    // Verify run is completed
    if (runExists.status !== 'completed') {
      return Response.json(
        { message: 'Report generation can only be started for a completed research kørsel' },
        { status: 400 }
      );
    }

    const registry = new ModelRegistry();
    let providerId = runExists.chatModelProvider;
    let modelKey = runExists.chatModelKey;

    if (!providerId || !modelKey) {
      const activeProviders = await registry.getActiveProviders();
      const firstWithChat = activeProviders.find((p) => p.chatModels.length > 0);
      if (firstWithChat) {
        providerId = firstWithChat.id;
        modelKey = firstWithChat.chatModels[0].key;
      }
    }

    if (!providerId || !modelKey) {
      return Response.json(
        { message: 'No active chat models configured for report generation.' },
        { status: 400 }
      );
    }

    const llm = await registry.loadChatModel(providerId, modelKey);

    // Run report generator (Stage 1-4)
    const reportId = await generateReportAndEvidence(projectId, runId, llm, providerId, modelKey);

    // Make this new report active by default if there is no other active report
    const activeReport = await db.query.reports.findFirst({
      where: and(eq(reports.runId, runId), eq(reports.isActive, 1))
    });

    if (!activeReport) {
      await db.update(reports).set({ isActive: 1 }).where(eq(reports.id, reportId)).execute();
    }

    return Response.json({ message: 'Report generated successfully', reportId }, { status: 200 });

  } catch (err: any) {
    console.error('Error in POST /api/projects/[projectId]/runs/[runId]/report:', err);
    return Response.json(
      { message: 'Failed to generate report', error: err.message || err },
      { status: 500 },
    );
  }
};

// GET: Returns detail payload for active report (report, findings, assessments, consequences)
export const GET = async (
  req: Request,
  { params }: { params: Promise<{ projectId: string; runId: string }> },
) => {
  try {
    const { runId } = await params;

    const activeReport = await db.query.reports.findFirst({
      where: and(eq(reports.runId, runId), eq(reports.isActive, 1))
    });

    if (!activeReport) {
      return Response.json({ activeReport: null }, { status: 200 });
    }

    const runFindings = await db.query.findings.findMany({
      where: eq(findings.runId, runId)
    });

    const runAssessments = await db.query.sourceAssessments.findMany({
      where: eq(sourceAssessments.runId, runId)
    });

    // Load relations for findings
    const findingsWithRelations = await Promise.all(
      runFindings.map(async (f) => {
        const relations = await db.query.findingSources.findMany({
          where: eq(findingSources.findingId, f.id)
        });
        const consequences = await db.query.findingConsequences.findMany({
          where: eq(findingConsequences.findingId, f.id)
        });
        return {
          ...f,
          relations,
          consequences
        };
      })
    );

    return Response.json({
      activeReport,
      findings: findingsWithRelations,
      assessments: runAssessments
    }, { status: 200 });

  } catch (err: any) {
    console.error('Error in GET /api/projects/[projectId]/runs/[runId]/report:', err);
    return Response.json(
      { message: 'An error occurred fetching active report', error: err.message || err },
      { status: 500 }
    );
  }
};
