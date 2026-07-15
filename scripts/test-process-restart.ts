import db from '../src/lib/db';
import {
  projects,
  researchRuns,
  searchQueries,
  sources,
  reports
} from '../src/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

const stateFile = path.resolve(__dirname, 'test-restart-state.json');

async function run() {
  const mode = process.argv[2];
  if (mode === 'setup') {
    console.log('=== STARTING RESTART TEST SETUP ===');
    const projectId = crypto.randomUUID();
    const runId = crypto.randomUUID();

    // Insert project and run
    await db.insert(projects).values({
      id: projectId,
      title: 'Restart Test Project',
      description: 'Validation across server process restarts',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).execute();

    await db.insert(researchRuns).values({
      id: runId,
      projectId,
      input: 'Transformer scaling factors',
      status: 'completed',
      startedAt: new Date().toISOString()
    }).execute();

    // Insert search query
    const queryId = crypto.randomUUID();
    await db.insert(searchQueries).values({
      id: queryId,
      runId,
      query: 'Transformer scaling laws',
      sourceType: 'web',
      status: 'completed',
      createdAt: new Date().toISOString()
    }).execute();

    // Insert verified repository source
    const sourceId = crypto.randomUUID();
    await db.insert(sources).values({
      id: sourceId,
      runId,
      title: 'Scaling Laws Repo',
      url: 'https://github.com/test/scaling-laws',
      canonicalUrl: 'https://github.com/test/scaling-laws',
      sourceType: 'repository',
      provider: 'github',
      retrievedAt: new Date().toISOString(),
      metadata: JSON.stringify({
        readmePreview: 'This is the verified repository content for scaling laws.'
      })
    }).execute();

    // Trigger report generation v1 over HTTP
    console.log('Generating report version 1 over API...');
    const res1 = await fetch(`http://localhost:3000/api/projects/${projectId}/runs/${runId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data1 = (await res1.json()) as { reportId: string };
    if (!res1.ok || !data1.reportId) {
      throw new Error(`Failed to generate report 1: ${JSON.stringify(data1)}`);
    }
    const report1Id = data1.reportId;
    console.log(`Report v1 generated: ${report1Id}`);

    // Trigger report generation v2 over HTTP
    console.log('Generating report version 2 over API...');
    const res2 = await fetch(`http://localhost:3000/api/projects/${projectId}/runs/${runId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data2 = (await res2.json()) as { reportId: string };
    if (!res2.ok || !data2.reportId) {
      throw new Error(`Failed to generate report 2: ${JSON.stringify(data2)}`);
    }
    const report2Id = data2.reportId;
    console.log(`Report v2 generated: ${report2Id}`);

    // Activate report v2 over HTTP
    console.log('Activating report version 2...');
    const resActive = await fetch(`http://localhost:3000/api/projects/${projectId}/runs/${runId}/report/versions/${report2Id}/active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!resActive.ok) {
      throw new Error(`Failed to activate report 2: ${resActive.statusText}`);
    }
    console.log('Report version 2 activated successfully.');

    // Save state
    fs.writeFileSync(stateFile, JSON.stringify({ projectId, runId, report1Id, report2Id }));
    console.log('Setup state saved successfully.');

  } else if (mode === 'verify') {
    console.log('=== STARTING RESTART TEST VERIFICATION ===');
    if (!fs.existsSync(stateFile)) {
      throw new Error('State file not found.');
    }
    const { projectId, runId, report1Id, report2Id } = JSON.parse(fs.readFileSync(stateFile, 'utf8'));

    // 1. Fetch active report details over API
    console.log('Fetching report details over API...');
    const res = await fetch(`http://localhost:3000/api/projects/${projectId}/runs/${runId}/report`);
    if (!res.ok) {
      throw new Error(`Failed to fetch report over API: ${res.statusText}`);
    }
    const payload = (await res.json()) as {
      activeReport: { id: string; version: number; isActive: number } | null;
      findings: any[];
      assessments: any[];
    };

    console.log('Verifying active report status...');
    if (!payload.activeReport) {
      throw new Error('No active report returned.');
    }
    if (payload.activeReport.id !== report2Id) {
      throw new Error(`Expected active report ID ${report2Id}, but got ${payload.activeReport.id}`);
    }
    if (payload.activeReport.isActive !== 1) {
      throw new Error('Active report is not marked active.');
    }
    console.log(`  -> Succes: Aktiv rapport ID ${payload.activeReport.id} matcher version 2.`);

    // Verify findings, assessments exist
    console.log(`  -> Succes: Fundet ${payload.findings.length} fund og ${payload.assessments.length} kildevurderinger.`);
    if (payload.findings.length === 0 || payload.assessments.length === 0) {
      throw new Error('Expected findings and assessments to be persisted.');
    }

    // Verify report v1 exists in database
    const v1Report = await db.query.reports.findFirst({ where: eq(reports.id, report1Id) });
    if (!v1Report) {
      throw new Error('Report version 1 not found in database.');
    }
    console.log('  -> Succes: Begge rapportversioner (v1 og v2) eksisterer.');

    // 2. Cascade delete project
    console.log('Deleting project to verify cascade...');
    const delRes = await fetch(`http://localhost:3000/api/projects/${projectId}`, {
      method: 'DELETE'
    });
    if (!delRes.ok) {
      throw new Error(`Failed to delete project: ${delRes.statusText}`);
    }

    // Verify database cascade
    const runAfterDelete = await db.query.researchRuns.findFirst({ where: eq(researchRuns.id, runId) });
    const reportsAfterDelete = await db.query.reports.findMany({ where: eq(reports.runId, runId) });
    if (runAfterDelete || reportsAfterDelete.length > 0) {
      throw new Error('Cascade delete failed. Orphaned records exist.');
    }
    console.log('  -> Succes: Kaskadesletning af alle relaterede tabeller bekræftet.');

    // Clean up
    fs.unlinkSync(stateFile);
    console.log('=== RESTART TEST VERIFICATION COMPLETED FEJLFRIT ===');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
