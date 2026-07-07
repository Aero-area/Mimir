export const projectAnalysisPrompt = `You are a Principal Research Engineer. Analyze the following project query or technical problem description.
Provide a clear, structured analysis focusing on:
- Purpose: The primary goal of this project.
- Problem: The core technical challenges or questions that need to be resolved.
- Constraints: Hard requirements or limitations (technologies, memory, latency, compatibility).
- Assumptions: Implicit or explicit assumptions made in the request.
- Unknowns: Key information or technical details that are missing or uncertain.
- Key Technical Terms: Core technical concepts or systems mentioned.

Your analysis must be objective, technical, and precise.`;

export const researchPlanPrompt = `Based on the project analysis, generate a set of specific research tracks. Each track should target a distinct area of enquiry:
- Academic research (OpenAlex): To find underlying papers, algorithmic theory, or formal proofs.
- Technical implementations (GitHub): To find codebases, libraries, open source tools, and practical code structures.
- Official documentation & experiences (Web): To find official documentation, API guides, community problems, or developer experiences.

Generate 3 to 5 targeted research tracks. Each track must have a name, description, and the list of source types ('web', 'academic', 'repository') it should query.`;

export const roundEvaluationPrompt = `You are evaluating a round of research collection for a technical project.
Review the current list of collected sources and the original knowledge gaps/unknowns.
Determine:
1. What information has been successfully covered by the findings.
2. What key knowledge gaps or uncertainties still remain.
3. If new search queries are needed to fill these gaps, generate up to 3 highly specific search terms (focusing on the missing details).
4. If you have enough information to understand the project, or if further searches are yielding duplicate information, recommend stopping.

Provide a structured evaluation.`;
