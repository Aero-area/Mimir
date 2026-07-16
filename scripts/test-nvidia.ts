import { loadEnvConfig } from '@next/env';
// Load environment variables from .env
loadEnvConfig(process.cwd());

import db from '../src/lib/db';
import { projects, researchRuns, sources } from '../src/lib/db/schema';
import NVIDIAProvider from '../src/lib/models/providers/nvidia';
import { runResearchLoop } from '../src/lib/agents/researchLoop';
import { generateReportAndEvidence } from '../src/lib/agents/reportGenerator';
import * as searxng from '../src/lib/adapters/searxng';
import * as openalex from '../src/lib/adapters/openalex';
import * as github from '../src/lib/adapters/github';
import { z } from 'zod';

// Stub search adapters to keep test consumption low and avoid external dependencies
Object.defineProperty(searxng, 'searchWeb', { value: async () => [] });
Object.defineProperty(openalex, 'searchOpenAlex', { value: async () => [] });
Object.defineProperty(github, 'searchGithub', { value: async () => [] });

async function runNVIDIATest() {
  console.log('=== STARTING NVIDIA NIM PROVIDER TEST ===');

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    console.log('requires API key');
    process.exit(0);
  }

  const baseURL = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
  console.log(`Using Base URL: ${baseURL}`);

  // Initialize Provider
  const provider = new NVIDIAProvider('nvidia', 'NVIDIA NIM', {
    apiKey,
    baseURL,
  });

  // 1. Direct Chat Completion Test (Health check)
  console.log('1. Kører direkte chat completion test (health check) for hver model...');
  const modelsToTest = [
    'nvidia/nemotron-3-ultra-550b-a55b',
    'nvidia/nemotron-3-nano-30b-a3b'
  ];

  for (const m of modelsToTest) {
    console.log(`Testing model: ${m}`);
    try {
      const llm = await provider.loadChatModel(m);
      const result = await llm.generateText({
        messages: [{ role: 'user', content: 'MODELTEST OK' }],
        options: { temperature: 0.1, maxTokens: 15 },
      });
      console.log(`Modelrespons for ${m}: "${result.content.trim()}"`);
      console.log(`NVIDIA NIM chat completion for ${m}: SUCCESS`);
    } catch (err: any) {
      console.error(`NVIDIA NIM chat completion failed for ${m}:`, err.message || err);
      process.exit(1);
    }
  }

  // 3. Nemotron Nano Smoke Test
  console.log('3. Afvikler Nemotron Nano smoke test (JSON klassifikation)...');
  try {
    const nemotronNano = await provider.loadChatModel('nvidia/nemotron-3-nano-30b-a3b');
    const classificationSchema = z.object({
      category: z.string(),
      confidence: z.number()
    });
    const nanoResult = await nemotronNano.generateObject<any>({
      messages: [
        {
          role: 'user',
          content: 'Classify this sentence: "I love coding agents". Categories: technology, food, sports. Return JSON.'
        }
      ],
      schema: classificationSchema,
      options: { temperature: 0.1 }
    });
    console.log(`Nemotron Nano klassifikation JSON:`, JSON.stringify(nanoResult));
    console.log('Nemotron Nano smoke test: SUCCESS');
  } catch (err: any) {
    console.error('Nemotron Nano smoke test failed:', err.message || err);
    process.exit(1);
  }

  // 4. Full E2E Loop using Ultra
  console.log('4. Afvikler fuld E2E research og rapport loop med Nemotron Ultra...');
  const projectId = crypto.randomUUID();
  const runId = crypto.randomUUID();

  try {
    const ultraLLM = await provider.loadChatModel('nvidia/nemotron-3-ultra-550b-a55b');

    // Insert temp project & research run
    await db.insert(projects).values({
      id: projectId,
      title: 'NVIDIA NIM E2E Test',
      description: 'Validation of NVIDIA NIM integration',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).execute();

    await db.insert(researchRuns).values({
      id: runId,
      projectId,
      input: 'Verify that Switch Transformer is an MoE architecture',
      status: 'draft',
      startedAt: new Date().toISOString()
    }).execute();

    // Run Research Smoke Test
    await runResearchLoop(projectId, runId, ultraLLM, (progress) => {
      console.log(`[Research Progress] ${progress.phase}: ${progress.message}`);
    });
    console.log('Research smoke test: SUCCESS');

    // Add temp source
    const sourceId = crypto.randomUUID();
    await db.insert(sources).values({
      id: sourceId,
      runId,
      title: 'Switch Transformers: Scaling to Trillion Parameter Models',
      url: 'https://arxiv.org/abs/2101.03961',
      canonicalUrl: 'https://arxiv.org/abs/2101.03961',
      sourceType: 'academic',
      provider: 'openalex',
      retrievedAt: new Date().toISOString(),
      metadata: JSON.stringify({
        snippet: 'Switch Transformers scale parameter count while keeping floating point operations constant.'
      })
    }).execute();

    // Run Report Smoke Test
    const reportId = await generateReportAndEvidence(projectId, runId, ultraLLM, 'nvidia', 'nvidia/nemotron-3-ultra-550b-a55b');
    console.log(`Rapport genereret med succes. ID: ${reportId}`);
    console.log('Rapport smoke test: SUCCESS');

    console.log('=== NVIDIA NIM PROVIDER TEST FULLY COMPLETED ===');
  } catch (err: any) {
    console.error('E2E test failed:', err.message || err);
    process.exit(1);
  } finally {
    // Cleanup database
    await db.delete(projects).where(eq(projects.id, projectId)).execute();
  }
}

async function qwenResultText(qwenCoder: any) {
  const result = await qwenCoder.generateText({
    messages: [
      {
        role: 'user',
        content: 'Analyze the following typescript class: class Stack { items = []; push(item) { this.items.push(item); } }'
      }
    ],
    options: { temperature: 0.1, maxTokens: 100 },
  });
  return result.content.trim();
}

// Helper eq for drizzle
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

runNVIDIATest();
