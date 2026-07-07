import z from 'zod';
import db from '../db';
import {
  reports,
  findings,
  findingSources,
  sourceAssessments,
  findingConsequences,
  sources,
  researchRuns
} from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';

// Zod schemas for structured LLM outputs
const sourceAssessmentSchema = z.object({
  assessments: z.array(z.object({
    sourceId: z.string(),
    directRelevance: z.string().describe('How directly relevant is the source (High/Medium/Low) and why.'),
    originalSource: z.string().describe('What is the original source type (e.g. peer-reviewed paper, official doc, developer blog).'),
    publicationStatus: z.string().describe('Is the source officially published, self-published draft, or raw repository.'),
    methodTransparency: z.string().describe('How transparent is the source about its methods or testing environment.'),
    implementationEvidence: z.string().describe('Does it provide working code benchmarks or test evidence.'),
    recency: z.string().describe('Is the source current or outdated relative to the technology.'),
    knownLimitations: z.string().describe('Does the source self-report limitations or have known biases.'),
    qualityReasoning: z.string().describe('Structured reasoning about the quality profile.'),
  }))
});

const findingsExtractionSchema = z.object({
  extractedFindings: z.array(z.object({
    statement: z.string().describe('Verifiable statement or claim extracted from the sources.'),
    category: z.enum([
      'academic_background',
      'existing_implementation',
      'official_documentation',
      'known_limitation',
      'failed_approach',
      'practical_experience'
    ]),
    status: z.enum(['supported', 'contradicted', 'uncertain', 'insufficient_evidence']),
    reasoning: z.string().describe('Why this claim is assigned this status based on the source evidence.'),
    relations: z.array(z.object({
      sourceId: z.string().describe('The ID of the source this claim is extracted from.'),
      relationType: z.enum(['supports', 'contradicts', 'context', 'mentions']),
      excerpt: z.string().optional().describe('Direct original quote or phrase from the source content to back up the claim.'),
      location: z.string().optional().describe('Section, chapter, page number, or repository folder if available.'),
    })),
  }))
});

const consequencesMappingSchema = z.object({
  consequences: z.array(z.object({
    statement: z.string().describe('The statement of the finding this consequence applies to.'),
    impactDescription: z.string().describe('Detailed description of the technical impact.'),
    affectedChoice: z.string().describe('Which project architecture choice or design decision is affected.'),
    riskChange: z.string().describe('How this alters the risk profile (reduced or increased).'),
    reopenAssumptions: z.string().describe('Which initial assumptions must be re-evaluated.'),
    validationRequired: z.string().describe('What further validation or benchmarking is required.'),
  }))
});

const reportSynthesisSchema = z.object({
  content: z.string().describe('The complete Markdown research report complying with the required chapters structure.'),
  summary: z.string().describe('Brief executive summary of the report.'),
});

export async function generateReportAndEvidence(
  projectId: string,
  runId: string,
  llm: any,
  modelProvider: string,
  modelKey: string
): Promise<string> {
  const reportId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Create report in drafting state
  // Calculate next version
  const existingReports = await db.query.reports.findMany({
    where: eq(reports.runId, runId),
    orderBy: desc(reports.version)
  });
  const nextVersion = existingReports.length > 0 ? existingReports[0].version + 1 : 1;

  await db.insert(reports).values({
    id: reportId,
    runId,
    content: 'Drafting report...',
    status: 'drafting',
    createdAt: now,
    updatedAt: now,
    version: nextVersion,
    generatedAt: now,
    modelProvider,
    modelKey,
    isActive: 0,
    metadata: null
  }).execute();

  try {
    // 1. Fetch sources from database
    const dbSources = await db.query.sources.findMany({
      where: eq(sources.runId, runId)
    });

    if (dbSources.length === 0) {
      throw new Error('No sources found for this research run. Please collect sources first.');
    }

    const validSourceIds = new Set(dbSources.map(s => s.id));
    const sourcesSummaryText = dbSources.map(s => {
      const meta = s.metadata ? JSON.parse(s.metadata) : {};
      return `Source ID: ${s.id}\nTitle: ${s.title}\nURL: ${s.url}\nType: ${s.sourceType}\nProvider: ${s.provider}\nAuthors: ${s.authors}\nPublished: ${s.publishedAt}\nSnippet: ${meta.snippetPreview || ''}`;
    }).join('\n\n');

    // === STAGE 1: SOURCE QUALITY ASSESSMENT ===
    const assessmentPrompt = `You are a Senior Systems Architect evaluating source reliability.
Evaluate the following sources for a research run. Provide a quality profile for each source.
Sources:\n${sourcesSummaryText}`;

    const assessmentResult = (await llm.generateObject({
      messages: [
        { role: 'system', content: assessmentPrompt }
      ],
      schema: sourceAssessmentSchema
    })) as z.infer<typeof sourceAssessmentSchema>;

    // Save assessments
    for (const assess of assessmentResult.assessments) {
      if (!validSourceIds.has(assess.sourceId)) continue; // skip hallucinated ids
      await db.insert(sourceAssessments).values({
        id: crypto.randomUUID(),
        runId,
        sourceId: assess.sourceId,
        directRelevance: assess.directRelevance,
        originalSource: assess.originalSource,
        publicationStatus: assess.publicationStatus,
        methodTransparency: assess.methodTransparency,
        implementationEvidence: assess.implementationEvidence,
        recency: assess.recency,
        knownLimitations: assess.knownLimitations,
        qualityReasoning: assess.qualityReasoning,
        createdAt: now
      }).execute();
    }

    // === STAGE 2: FINDINGS EXTRACTION ===
    const extractionPrompt = `You are a Principal Software Engineer. Extract technical claims and findings from the following sources.
For each finding, assign a category and status. Connect it to the referencing sources.
IMPORTANT: You must only include original quotes (excerpts) and locations if they actually exist in the source content provided. DO NOT invent citations.
Valid Source IDs: ${Array.from(validSourceIds).join(', ')}

Sources:\n${sourcesSummaryText}`;

    let extractionResult = (await llm.generateObject({
      messages: [
        { role: 'system', content: extractionPrompt }
      ],
      schema: findingsExtractionSchema
    })) as z.infer<typeof findingsExtractionSchema>;

    // Citation Verification & Repair Attempt
    let needsRepair = false;
    for (const f of extractionResult.extractedFindings) {
      for (const rel of f.relations) {
        if (!validSourceIds.has(rel.sourceId)) {
          needsRepair = true;
          break;
        }
      }
    }

    if (needsRepair) {
      console.log('Hallucinated source IDs found. Triggering repair attempt...');
      const repairPrompt = `The previous extraction contained invalid source IDs.
The valid source IDs are: ${Array.from(validSourceIds).join(', ')}.
Please correct and re-map the following findings to valid source IDs only. If a finding cannot be mapped to any valid source ID, omit it.
Original extracted findings: ${JSON.stringify(extractionResult.extractedFindings, null, 2)}`;

      extractionResult = (await llm.generateObject({
        messages: [
          { role: 'system', content: repairPrompt }
        ],
        schema: findingsExtractionSchema
      })) as z.infer<typeof findingsExtractionSchema>;

      // Double check after repair
      for (const f of extractionResult.extractedFindings) {
        for (const rel of f.relations) {
          if (!validSourceIds.has(rel.sourceId)) {
            throw new Error(`Report generation failed: Hallucinated source ID ${rel.sourceId} persisted after repair attempt.`);
          }
        }
      }
    }

    // Helper to classify source content class
    const getSourceContentClass = (source: any): 'verified_source_content' | 'search_snippet' | 'metadata_only' => {
      const meta = source.metadata ? JSON.parse(source.metadata) : {};
      if (meta.readmePreview || meta.fullContent || source.sourceType === 'repository') {
        return 'verified_source_content';
      }
      if (meta.snippetPreview || meta.snippet) {
        return 'search_snippet';
      }
      return 'metadata_only';
    };

    // Save findings and sources relations
    const savedFindingIdsMap = new Map<string, string>(); // maps statement to DB ID
    const linkedSourceIds = new Set<string>();

    for (const f of extractionResult.extractedFindings) {
      const findingId = crypto.randomUUID();
      await db.insert(findings).values({
        id: findingId,
        runId,
        statement: f.statement,
        category: f.category,
        status: f.status,
        reasoning: f.reasoning,
        createdAt: now
      }).execute();
      savedFindingIdsMap.set(f.statement, findingId);

      for (const rel of f.relations) {
        let verifiedExcerpt = rel.excerpt || null;
        let finalRelationType = rel.relationType;
        let finalLocation = rel.location || null;

        const linkedSource = dbSources.find(s => s.id === rel.sourceId);
        if (linkedSource) {
          linkedSourceIds.add(rel.sourceId);
          const contentClass = getSourceContentClass(linkedSource);

          if (contentClass === 'verified_source_content') {
            // Only verified_source_content can support excerpts
            if (verifiedExcerpt) {
              const meta = linkedSource.metadata ? JSON.parse(linkedSource.metadata) : {};
              const fullText = (meta.readmePreview || meta.fullContent || '').toLowerCase();
              if (!fullText.includes(verifiedExcerpt.toLowerCase())) {
                verifiedExcerpt = null; // discard excerpt if not found in actual source content
              }
            }
          } else if (contentClass === 'search_snippet') {
            // Snippets without full source content can only have context or mentions
            if (finalRelationType === 'supports' || finalRelationType === 'contradicts') {
              finalRelationType = 'context';
            }
            // Discard excerpt (snippets cannot have verified excerpts)
            verifiedExcerpt = null;
          } else {
            // metadata_only
            finalRelationType = 'mentions';
            verifiedExcerpt = null;
            finalLocation = null;
          }
        }

        await db.insert(findingSources).values({
          id: crypto.randomUUID(),
          findingId,
          sourceId: rel.sourceId,
          relationType: finalRelationType,
          excerpt: verifiedExcerpt,
          location: finalLocation,
          createdAt: now
        }).execute();
      }
    }

    // === STAGE 3: CONSEQUECES MAPPING ===
    const consequencePrompt = `You are a Principal Architect. Map the technical consequences of the extracted findings.
Explain how each finding statement affects the project's choices, risks, initial assumptions, and validations needed.
Extracted findings:\n${JSON.stringify(extractionResult.extractedFindings, null, 2)}`;

    const consequenceResult = (await llm.generateObject({
      messages: [
        { role: 'system', content: consequencePrompt }
      ],
      schema: consequencesMappingSchema
    })) as z.infer<typeof consequencesMappingSchema>;

    // Save consequences
    for (const cons of consequenceResult.consequences) {
      const findingId = savedFindingIdsMap.get(cons.statement);
      if (!findingId) continue; // skip if finding not found
      await db.insert(findingConsequences).values({
        id: crypto.randomUUID(),
        findingId,
        impactDescription: cons.impactDescription,
        affectedChoice: cons.affectedChoice,
        riskChange: cons.riskChange,
        reopenAssumptions: cons.reopenAssumptions,
        validationRequired: cons.validationRequired,
        createdAt: now
      }).execute();
    }

    // === STAGE 4: REPORT SYNTHESIS ===
    // Get full DB findings and assessments text for report context
    const findingsText = extractionResult.extractedFindings.map(f => {
      return `Finding: ${f.statement}\nCategory: ${f.category}\nStatus: ${f.status}\nReasoning: ${f.reasoning}`;
    }).join('\n\n');

    const reportPrompt = `You are a Principal Technical Writer. Synthesize a professional, comprehensive research report.
Your output must be formatted in Markdown and follow this structure:
1. Executive Summary
2. Projekt & Problem
3. Researchgrundlag
4. Centrale Fund
   - Akademisk baggrund
   - Eksisterende implementeringer
   - Officiel dokumentation
   - Kendte begrænsninger og fejlede tilgange
   - Praktiske erfaringer
5. Modstridende og Manglende Dokumentation
6. Konsekvenser for Projektet
7. Anbefalede Næste Valideringer
8. Kilderegister

All technical statements must be formally referenced using inline links pointing to their source title, e.g., "[Source Title](sourceId)".

Context:
Findings:\n${findingsText}
Consequences:\n${JSON.stringify(consequenceResult.consequences, null, 2)}`;

    const reportResult = (await llm.generateObject({
      messages: [
        { role: 'system', content: reportPrompt }
      ],
      schema: reportSynthesisSchema
    })) as z.infer<typeof reportSynthesisSchema>;

    // Compute metrics
    const totalCollected = dbSources.length;
    const totalAssessed = assessmentResult.assessments.length;
    const totalLinkedToFindings = linkedSourceIds.size;

    const usedSourceIds = new Set<string>();
    for (const src of dbSources) {
      if (reportResult.content.includes(src.id)) {
        usedSourceIds.add(src.id);
      }
    }
    const totalUsedInReport = usedSourceIds.size;
    const totalDiscarded = totalCollected - totalLinkedToFindings;
    const discardedReason = totalDiscarded > 0 
      ? 'Kilder blev fravalgt, da de enten havde lavere relevans eller ikke indeholdt direkte evidens for de udtrukne arkitektoniske fund under Stage 2.'
      : 'Ingen kilder blev fravalgt.';

    // Update report to completed state
    await db.update(reports).set({
      content: reportResult.content,
      status: 'completed',
      summary: reportResult.summary,
      updatedAt: new Date().toISOString(),
      metadata: JSON.stringify({
        generatedRoundsCount: existingReports.length + 1,
        metrics: {
          totalCollected,
          totalAssessed,
          totalLinkedToFindings,
          totalUsedInReport,
          totalDiscarded,
          discardedReason
        }
      })
    }).where(eq(reports.id, reportId)).execute();

    return reportId;

  } catch (err: any) {
    console.error('Error generating report:', err);
    // Mark report as failed
    await db.update(reports).set({
      content: `Failed to generate report: ${err.message || err}`,
      status: 'failed',
      updatedAt: new Date().toISOString()
    }).where(eq(reports.id, reportId)).execute();
    throw err;
  }
}
