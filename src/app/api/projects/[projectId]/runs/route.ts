import db from '@/lib/db';
import { projects, researchRuns } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await params;
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return Response.json({ message: 'Project not found' }, { status: 404 });
    }

    const runs = await db.query.researchRuns.findMany({
      where: eq(researchRuns.projectId, projectId),
      orderBy: desc(researchRuns.startedAt),
    });

    return Response.json({ runs }, { status: 200 });
  } catch (err) {
    console.error('Error in GET /api/projects/[projectId]/runs: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await params;
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return Response.json({ message: 'Project not found' }, { status: 404 });
    }

    const body = await req.json();
    const { input, chatModelProvider, chatModelKey } = body;

    if (!input) {
      return Response.json({ message: 'Input is required' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const newRun = {
      id,
      projectId,
      input,
      status: 'draft',
      startedAt: new Date().toISOString(),
      completedAt: null,
      chatModelProvider: chatModelProvider || null,
      chatModelKey: chatModelKey || null,
      error: null,
    };

    await db.insert(researchRuns).values(newRun).execute();

    return Response.json({ run: newRun }, { status: 201 });
  } catch (err) {
    console.error('Error in POST /api/projects/[projectId]/runs: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
