import db from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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

    return Response.json({ project }, { status: 200 });
  } catch (err) {
    console.error('Error in GET /api/projects/[projectId]: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const PATCH = async (
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await params;
    const body = await req.json();
    const { title, description, status } = body;

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return Response.json({ message: 'Project not found' }, { status: 404 });
    }

    const updated = {
      ...project,
      title: title !== undefined ? title : project.title,
      description: description !== undefined ? description : project.description,
      status: status !== undefined ? status : project.status,
      updatedAt: new Date().toISOString(),
    };

    await db
      .update(projects)
      .set(updated)
      .where(eq(projects.id, projectId))
      .execute();

    return Response.json({ project: updated }, { status: 200 });
  } catch (err) {
    console.error('Error in PATCH /api/projects/[projectId]: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const DELETE = async (
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

    // SQLite foreign key cascade delete will automatically remove runs, queries, sources, and reports.
    await db.delete(projects).where(eq(projects.id, projectId)).execute();

    return Response.json(
      { message: 'Project deleted successfully' },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in DELETE /api/projects/[projectId]: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
