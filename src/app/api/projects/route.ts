import db from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export const GET = async (req: Request) => {
  try {
    const list = await db.query.projects.findMany({
      orderBy: desc(projects.createdAt),
    });
    return Response.json({ projects: list }, { status: 200 });
  } catch (err) {
    console.error('Error in GET /api/projects: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const POST = async (req: Request) => {
  try {
    const body = await req.json();
    const { title, description } = body;

    if (!title) {
      return Response.json({ message: 'Title is required' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const newProject = {
      id,
      title,
      description: description || null,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(projects).values(newProject).execute();

    return Response.json({ project: newProject }, { status: 201 });
  } catch (err) {
    console.error('Error in POST /api/projects: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
