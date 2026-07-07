import db from '@/lib/db';
import { projects, researchRuns } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import ModelRegistry from '@/lib/models/registry';
import { runResearchLoop } from '@/lib/agents/researchLoop';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    const registry = new ModelRegistry();
    let providerId = runExists.chatModelProvider;
    let modelKey = runExists.chatModelKey;

    // Fallback if not set
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
        { message: 'No active chat models configured. Please configure a model in Settings.' },
        { status: 400 }
      );
    }

    // Update run model details in database
    await db.update(researchRuns)
      .set({ chatModelProvider: providerId, chatModelKey: modelKey })
      .where(eq(researchRuns.id, runId))
      .execute();

    const llm = await registry.loadChatModel(providerId, modelKey);

    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    // Start research loop in background
    runResearchLoop(projectId, runId, llm, (progress) => {
      try {
        writer.write(encoder.encode(JSON.stringify(progress) + '\n'));
        if (progress.phase === 'completed' || progress.phase === 'failed') {
          writer.close();
        }
      } catch (err) {
        console.error('Error writing stream:', err);
      }
    }).catch((err) => {
      console.error('Unhandled loop promise rejection:', err);
      try {
        writer.write(
          encoder.encode(
            JSON.stringify({
              phase: 'failed',
              message: err.message || String(err),
            }) + '\n'
          )
        );
        writer.close();
      } catch (e) {}
    });

    return new Response(responseStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache, no-transform',
      },
    });

  } catch (err: any) {
    console.error('Error in POST /api/projects/[projectId]/runs/[runId]/research:', err);
    return Response.json(
      { message: 'An error has occurred.', error: err.message || err },
      { status: 500 },
    );
  }
};
