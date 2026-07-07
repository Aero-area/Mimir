'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Briefcase,
  Plus,
  Loader2,
  Calendar,
  FileText,
  Globe,
  GraduationCap,
  Github,
  Search,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Play,
  HelpCircle,
  Hash,
  Database,
  Terminal,
  BookOpen,
  List,
  Shield,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface ResearchRun {
  id: string;
  projectId: string;
  input: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  chatModelProvider: string | null;
  chatModelKey: string | null;
  error: string | null;
  metadata?: string | null;
}

interface SearchQuery {
  id: string;
  runId: string;
  query: string;
  sourceType: string;
  status: string;
  createdAt: string;
}

interface DBFileSource {
  id: string;
  runId: string;
  title: string;
  url: string;
  canonicalUrl: string;
  sourceType: string;
  provider: string;
  authors: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  doi: string | null;
  metadata: string; // JSON string
}

interface ReportVersion {
  id: string;
  runId: string;
  content: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  generatedAt: string;
  modelProvider: string | null;
  modelKey: string | null;
  isActive: number;
  summary: string | null;
}

interface SourceAssessment {
  id: string;
  runId: string;
  sourceId: string;
  directRelevance: string;
  originalSource: string;
  publicationStatus: string;
  methodTransparency: string;
  implementationEvidence: string;
  recency: string;
  knownLimitations: string;
  qualityReasoning: string;
  createdAt: string;
}

interface FindingConsequence {
  id: string;
  findingId: string;
  impactDescription: string;
  affectedChoice: string;
  riskChange: string;
  reopenAssumptions: string;
  validationRequired: string;
  createdAt: string;
}

interface FindingSourceRelation {
  id: string;
  findingId: string;
  sourceId: string;
  relationType: string;
  excerpt: string | null;
  location: string | null;
}

interface Finding {
  id: string;
  runId: string;
  statement: string;
  category: string;
  status: string;
  reasoning: string;
  createdAt: string;
  relations: FindingSourceRelation[];
  consequences: FindingConsequence[];
}

// Simple Markdown parser function to render headers, lists, links, and bold text securely
function renderSimpleMarkdown(md: string) {
  if (!md) return '';
  const lines = md.split('\n');
  return lines.map((line, index) => {
    let cleanLine = line;
    // Headers
    if (cleanLine.startsWith('# ')) {
      return <h1 key={index} className="text-xl font-bold text-black dark:text-white mt-5 mb-2">{cleanLine.slice(2)}</h1>;
    }
    if (cleanLine.startsWith('## ')) {
      return <h2 key={index} className="text-lg font-bold text-black dark:text-white mt-4 mb-2">{cleanLine.slice(3)}</h2>;
    }
    if (cleanLine.startsWith('### ')) {
      return <h3 key={index} className="text-base font-bold text-black dark:text-white mt-3 mb-1.5">{cleanLine.slice(4)}</h3>;
    }
    // Bullet points
    if (cleanLine.startsWith('- ') || cleanLine.startsWith('* ')) {
      return <li key={index} className="ml-4 list-disc text-sm text-black/80 dark:text-white/80 my-1">{cleanLine.slice(2)}</li>;
    }
    // Numbered list
    const numMatch = cleanLine.match(/^(\d+)\.\s(.*)/);
    if (numMatch) {
      return <li key={index} className="ml-4 list-decimal text-sm text-black/80 dark:text-white/80 my-1">{numMatch[2]}</li>;
    }
    // Bold, italic, links placeholders parsing
    const parsedText = cleanLine
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" class="text-blue-600 dark:text-blue-400 underline inline-flex items-center gap-0.5">$1</a>');

    if (!cleanLine.trim()) {
      return <div key={index} className="h-2" />;
    }

    return (
      <p
        key={index}
        className="text-sm text-black/80 dark:text-white/80 leading-relaxed my-1.5"
        dangerouslySetInnerHTML={{ __html: parsedText }}
      />
    );
  });
}

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [runs, setRuns] = useState<ResearchRun[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Project-level run creation
  const [isCreatingRun, setIsCreatingRun] = useState(false);
  const [input, setInput] = useState('');
  const [submittingRun, setSubmittingRun] = useState(false);

  // Active run details view
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<ResearchRun | null>(null);
  const [runQueries, setRunQueries] = useState<SearchQuery[]>([]);
  const [runSources, setRunSources] = useState<DBFileSource[]>([]);
  const [loadingRunDetails, setLoadingRunDetails] = useState(false);

  // Source collection state
  const [collectQuery, setCollectQuery] = useState('');
  const [sourceTypes, setSourceTypes] = useState({
    web: true,
    academic: true,
    repository: true,
  });
  const [collecting, setCollecting] = useState(false);
  const [collectionErrors, setCollectionErrors] = useState<string[]>([]);
  const [collectionSummary, setCollectionSummary] = useState<any>(null);

  // Research Loop State
  const [researching, setResearching] = useState(false);
  const [loopProgress, setLoopProgress] = useState<string[]>([]);
  const [activePhase, setActivePhase] = useState<string>('');
  const logEndRef = useRef<HTMLDivElement>(null);

  // Report & Evidence State
  const [activeReport, setActiveReport] = useState<ReportVersion | null>(null);
  const [runFindings, setRunFindings] = useState<Finding[]>([]);
  const [runAssessments, setRunAssessments] = useState<SourceAssessment[]>([]);
  const [reportVersions, setReportVersions] = useState<ReportVersion[]>([]);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState<'report' | 'findings' | 'assessments' | 'consequences'>('report');

  const fetchProjectData = async () => {
    try {
      const projectRes = await fetch(`/api/projects/${projectId}`);
      if (!projectRes.ok) {
        toast.error('Project not found');
        router.push('/projects');
        return;
      }
      const projectData = await projectRes.json();
      setProject(projectData.project);

      const runsRes = await fetch(`/api/projects/${projectId}/runs`);
      if (runsRes.ok) {
        const runsData = await runsRes.json();
        setRuns(runsData.runs || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Error loading project details');
    } finally {
      setLoading(false);
    }
  };

  const fetchRunDetails = async (runId: string) => {
    setLoadingRunDetails(true);
    try {
      // 1. Core Run Details
      const res = await fetch(`/api/projects/${projectId}/runs/${runId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedRun(data.run);
        setRunQueries(data.queries || []);
        setRunSources(data.sources || []);
        setCollectQuery(data.run.input);
      } else {
        toast.error('Failed to load research run details');
      }

      // 2. Active Report & Evidence
      const reportRes = await fetch(`/api/projects/${projectId}/runs/${runId}/report`);
      if (reportRes.ok) {
        const rData = await reportRes.json();
        setActiveReport(rData.activeReport);
        setRunFindings(rData.findings || []);
        setRunAssessments(rData.assessments || []);
      }

      // 3. Report Versions
      const versionsRes = await fetch(`/api/projects/${projectId}/runs/${runId}/report/versions`);
      if (versionsRes.ok) {
        const vData = await versionsRes.json();
        setReportVersions(vData.versions || []);
      }

    } catch (err) {
      console.error(err);
      toast.error('Error loading run details');
    } finally {
      setLoadingRunDetails(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
    }
  }, [projectId]);

  useEffect(() => {
    if (selectedRunId) {
      fetchRunDetails(selectedRunId);
    } else {
      setSelectedRun(null);
      setRunQueries([]);
      setRunSources([]);
      setCollectionSummary(null);
      setCollectionErrors([]);
      setLoopProgress([]);
      setResearching(false);
      setActivePhase('');
      setActiveReport(null);
      setRunFindings([]);
      setRunAssessments([]);
      setReportVersions([]);
    }
  }, [selectedRunId]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [loopProgress]);

  const handleCreateRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setSubmittingRun(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success('Research run draft created successfully');
        setInput('');
        setIsCreatingRun(false);
        await fetchProjectData();
        setSelectedRunId(data.run.id);
      } else {
        const errData = await res.json();
        toast.error(errData.message || 'Failed to create research run');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred');
    } finally {
      setSubmittingRun(false);
    }
  };

  const handleCollectSources = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectQuery.trim()) return;

    const selectedTypes = Object.entries(sourceTypes)
      .filter(([_, enabled]) => enabled)
      .map(([type]) => type);

    if (selectedTypes.length === 0) {
      toast.error('Select at least one source type to collect');
      return;
    }

    setCollecting(true);
    setCollectionErrors([]);
    setCollectionSummary(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/runs/${selectedRunId}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: collectQuery, sourceTypes: selectedTypes }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success('Sources collected and saved');
        setCollectionSummary(data.summary);
        if (data.errors && data.errors.length > 0) {
          setCollectionErrors(data.errors);
        }
        await fetchRunDetails(selectedRunId!);
      } else {
        const errData = await res.json();
        toast.error(errData.message || 'Failed to collect sources');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred during source collection');
    } finally {
      setCollecting(false);
    }
  };

  const handleStartResearch = async () => {
    if (!selectedRunId) return;

    setResearching(true);
    setLoopProgress([]);
    setActivePhase('initializing');
    setLoopProgress(['[System] Initializing research process...']);

    try {
      const res = await fetch(`/api/projects/${projectId}/runs/${selectedRunId}/research`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to start research loop');
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('Readable stream not supported');

      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const progress = JSON.parse(line);
            setActivePhase(progress.phase);
            setLoopProgress((prev) => [...prev, `[${progress.phase.toUpperCase()}] ${progress.message}`]);
            
            if (progress.phase === 'completed') {
              toast.success('Research loop completed successfully');
              setResearching(false);
              await fetchRunDetails(selectedRunId);
            } else if (progress.phase === 'failed') {
              toast.error(progress.message);
              setResearching(false);
              await fetchRunDetails(selectedRunId);
            }
          } catch (e) {
            console.error('Error parsing progress stream line:', e);
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'An error occurred during research');
      setResearching(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedRunId) return;
    setGeneratingReport(true);
    toast.info('Starting report & evidence generation pipeline...');

    try {
      const res = await fetch(`/api/projects/${projectId}/runs/${selectedRunId}/report`, {
        method: 'POST',
      });

      if (res.ok) {
        toast.success('Research report & evidence successfully generated');
        await fetchRunDetails(selectedRunId);
      } else {
        const errData = await res.json();
        toast.error(errData.message || 'Failed to generate report');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred during report generation');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleActivateVersion = async (versionId: string) => {
    if (!selectedRunId) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/runs/${selectedRunId}/report/versions/${versionId}/active`,
        { method: 'POST' }
      );

      if (res.ok) {
        toast.success('Report version activated successfully');
        await fetchRunDetails(selectedRunId);
      } else {
        const errData = await res.json();
        toast.error(errData.message || 'Failed to activate version');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred activating version');
    }
  };

  const runMeta = selectedRun?.metadata ? JSON.parse(selectedRun.metadata) : null;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="animate-spin text-black/50 dark:text-white/50" size={32} />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="py-8 max-w-5xl mx-auto px-4 min-h-screen">
      {!selectedRunId ? (
        // === PROJECT OVERVIEW VIEW ===
        <div>
          <div className="mb-6">
            <Link
              href="/projects"
              className="flex flex-row items-center gap-1.5 text-sm text-black/60 dark:text-white/60 hover:text-black hover:dark:text-white transition duration-150"
            >
              <ArrowLeft size={16} />
              Back to Projects
            </Link>
          </div>

          <div className="bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 rounded-xl p-6 mb-8">
            <div className="flex flex-row items-start justify-between">
              <div className="flex items-start gap-3">
                <Briefcase className="text-black/60 dark:text-white/60 mt-1" size={24} />
                <div>
                  <h1 className="text-2xl font-semibold text-black dark:text-white">
                    {project.title}
                  </h1>
                  <p className="text-sm text-black/70 dark:text-white/70 mt-3 whitespace-pre-wrap">
                    {project.description || 'No description provided.'}
                  </p>
                </div>
              </div>
              <span className="capitalize text-xs font-medium px-2.5 py-1 rounded bg-light-200 dark:bg-dark-200 text-black/70 dark:text-white/70">
                {project.status}
              </span>
            </div>
            <div className="mt-6 pt-4 border-t border-light-200/50 dark:border-dark-200/50 flex flex-row gap-6 text-xs text-black/40 dark:text-white/40">
              <div className="flex items-center gap-1">
                <Calendar size={14} />
                Created {new Date(project.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="flex flex-row items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-black dark:text-white">
              Research Runs
            </h2>
            {!isCreatingRun && (
              <button
                onClick={() => setIsCreatingRun(true)}
                className="flex flex-row items-center gap-1.5 px-3 py-1.5 bg-black text-white dark:bg-white dark:text-black rounded-lg hover:opacity-85 active:scale-95 transition text-xs font-medium"
              >
                <Plus size={14} />
                New Research Draft
              </button>
            )}
          </div>

          {isCreatingRun && (
            <div className="border border-light-200 dark:border-dark-200 rounded-xl p-5 mb-6 bg-light-secondary/50 dark:bg-dark-secondary/50">
              <h3 className="text-sm font-medium text-black dark:text-white mb-3">
                New Research Draft Run
              </h3>
              <form onSubmit={handleCreateRun} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-black/60 dark:text-white/60 mb-1">
                    What do you want to research? *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Describe your technical query or feature plan..."
                    className="w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary p-3 text-sm text-black dark:text-white focus:outline-none focus:border-black/30 focus:dark:border-white/30 resize-none"
                  />
                </div>
                <div className="flex flex-row items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreatingRun(false)}
                    className="px-3.5 py-1.5 border border-light-200 dark:border-dark-200 text-black/70 dark:text-white/70 hover:bg-light-200 hover:dark:bg-dark-200 rounded-lg text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingRun || !input.trim()}
                    className="px-3.5 py-1.5 bg-black text-white dark:bg-white dark:text-black rounded-lg hover:opacity-80 disabled:opacity-50 text-xs font-medium transition flex flex-row items-center gap-1.5"
                  >
                    {submittingRun && <Loader2 className="animate-spin" size={12} />}
                    Create Draft
                  </button>
                </div>
              </form>
            </div>
          )}

          {runs.length === 0 ? (
            <div className="border border-dashed border-light-200 dark:border-dark-200 rounded-xl py-12 text-center">
              <FileText size={32} className="mx-auto text-black/30 dark:text-white/30 mb-3" />
              <p className="text-sm text-black/50 dark:text-white/50">
                No research runs created yet. Create a draft to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <button
                  key={run.id}
                  onClick={() => setSelectedRunId(run.id)}
                  className="w-full text-left p-4 rounded-xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary hover:border-black/20 hover:dark:border-white/20 transition duration-150 flex flex-row items-center justify-between group"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-sm font-medium text-black dark:text-white truncate group-hover:underline">
                      {run.input}
                    </p>
                    <p className="text-xs text-black/40 dark:text-white/40 mt-1 flex items-center gap-2">
                      <span>Started {new Date(run.startedAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>ID: {run.id.slice(0, 8)}...</span>
                    </p>
                  </div>
                  <div className="flex flex-row items-center gap-4">
                    <span className="capitalize text-xs font-medium px-2 py-0.5 rounded bg-light-200 dark:bg-dark-200 text-black/70 dark:text-white/70">
                      {run.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        // === RESEARCH RUN DETAILS / SOURCE COLLECTION VIEW ===
        <div>
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => setSelectedRunId(null)}
              className="flex flex-row items-center gap-1.5 text-sm text-black/60 dark:text-white/60 hover:text-black hover:dark:text-white transition duration-150"
            >
              <ArrowLeft size={16} />
              Back to Project Runs
            </button>
            
            <div className="flex items-center gap-2">
              {/* Generate Report Button (only when loop completed) */}
              {selectedRun?.status === 'completed' && !generatingReport && (
                <button
                  onClick={handleGenerateReport}
                  className="flex flex-row items-center gap-1.5 px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-lg text-sm font-medium shadow-sm transition active:scale-95 hover:opacity-85"
                >
                  <BookOpen size={14} />
                  Generate Evidence & Report
                </button>
              )}
              {generatingReport && (
                <div className="flex items-center gap-1.5 text-xs text-black/60 dark:text-white/60 font-medium px-3 py-1.5 border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary rounded-lg">
                  <Loader2 className="animate-spin text-black dark:text-white" size={14} />
                  Generating Report...
                </div>
              )}
              {/* Start Research Loop Button */}
              {selectedRun?.status === 'draft' && !researching && (
                <button
                  onClick={handleStartResearch}
                  className="flex flex-row items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium shadow-sm transition active:scale-95"
                >
                  <Play size={14} fill="currentColor" />
                  Start Research Loop
                </button>
              )}
            </div>
          </div>

          {loadingRunDetails || !selectedRun ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-black/50 dark:text-white/50" size={32} />
            </div>
          ) : (
            <div>
              {/* Run Information Header */}
              <div className="bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 rounded-xl p-6 mb-8">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-lg font-semibold text-black dark:text-white">
                      Research Run: {selectedRun.id.slice(0, 8)}
                    </h1>
                    <p className="text-sm text-black/70 dark:text-white/70 mt-2">
                      <strong>Topic / Goal:</strong> {selectedRun.input}
                    </p>
                  </div>
                  <span className={`capitalize text-xs font-semibold px-2.5 py-1 rounded ${
                    selectedRun.status === 'completed'
                      ? 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400'
                      : selectedRun.status === 'failed'
                        ? 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                  }`}>
                    {selectedRun.status}
                  </span>
                </div>
                {runMeta?.stopReason && (
                  <div className="mt-4 p-3 bg-light-200/40 dark:bg-dark-200/40 rounded-lg text-xs border border-light-200/50 dark:border-dark-200/30 text-black/80 dark:text-white/80">
                    <strong>Stop Reason:</strong> {runMeta.stopReason}
                  </div>
                )}
                <div className="mt-4 pt-3 border-t border-light-200/50 dark:border-dark-200/50 flex flex-row gap-4 text-xs text-black/40 dark:text-white/40">
                  <span>Started: {new Date(selectedRun.startedAt).toLocaleString()}</span>
                  {selectedRun.completedAt && (
                    <span>Completed: {new Date(selectedRun.completedAt).toLocaleString()}</span>
                  )}
                </div>
              </div>

              {/* Streaming Logs Console */}
              {researching && (
                <div className="border border-light-200 dark:border-dark-200 rounded-xl bg-black text-emerald-400 font-mono text-xs p-5 mb-8 h-48 overflow-y-auto shadow-inner flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 border-b border-neutral-800 pb-2 mb-2 text-neutral-400">
                    <Terminal size={14} />
                    <span>Research Loop Progress Console (Active Phase: {activePhase.toUpperCase()})</span>
                  </div>
                  {loopProgress.map((log, index) => (
                    <div key={index} className="whitespace-pre-wrap leading-relaxed">
                      {log}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              )}

              {/* === REPORT & EVIDENCE VIEWER === */}
              {activeReport && (
                <div className="border border-light-200 dark:border-dark-200 rounded-xl p-6 bg-light-secondary/20 dark:bg-dark-secondary/10 mb-8">
                  <div className="flex flex-row items-center justify-between border-b border-light-200 dark:border-dark-200 pb-4 mb-4 flex-wrap gap-4">
                    <div className="flex flex-row items-center gap-2">
                      <BookOpen size={20} className="text-black/70 dark:text-white/70" />
                      <h2 className="text-lg font-bold text-black dark:text-white">
                        Research Report & Evidence
                      </h2>
                      <span className="text-xs bg-black text-white dark:bg-white dark:text-black px-2 py-0.5 rounded font-medium">
                        Version {activeReport.version} (Active)
                      </span>
                    </div>

                    {/* Report Tabs Selector */}
                    <div className="flex flex-row gap-1 bg-light-200 dark:bg-dark-200 p-1 rounded-lg text-xs font-semibold text-black/60 dark:text-white/60">
                      <button
                        onClick={() => setActiveReportTab('report')}
                        className={`px-3 py-1.5 rounded-md transition ${activeReportTab === 'report' ? 'bg-black text-white dark:bg-white dark:text-black shadow' : ''}`}
                      >
                        Report Content
                      </button>
                      <button
                        onClick={() => setActiveReportTab('findings')}
                        className={`px-3 py-1.5 rounded-md transition ${activeReportTab === 'findings' ? 'bg-black text-white dark:bg-white dark:text-black shadow' : ''}`}
                      >
                        Extracted Findings
                      </button>
                      <button
                        onClick={() => setActiveReportTab('assessments')}
                        className={`px-3 py-1.5 rounded-md transition ${activeReportTab === 'assessments' ? 'bg-black text-white dark:bg-white dark:text-black shadow' : ''}`}
                      >
                        Source Quality Profiles
                      </button>
                      <button
                        onClick={() => setActiveReportTab('consequences')}
                        className={`px-3 py-1.5 rounded-md transition ${activeReportTab === 'consequences' ? 'bg-black text-white dark:bg-white dark:text-black shadow' : ''}`}
                      >
                        Project Consequences
                      </button>
                    </div>
                  </div>

                  {/* Active Tab rendering */}
                  {activeReportTab === 'report' && (
                    <div className="bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 rounded-lg p-6 shadow-sm overflow-x-auto prose dark:prose-invert max-w-none">
                      {renderSimpleMarkdown(activeReport.content)}
                    </div>
                  )}

                  {activeReportTab === 'findings' && (
                    <div className="space-y-4">
                      {runFindings.length === 0 ? (
                        <p className="text-sm text-black/50 dark:text-white/50 text-center py-6">No findings extracted yet.</p>
                      ) : (
                        runFindings.map((f) => (
                          <div key={f.id} className="p-4 bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 rounded-lg">
                            <div className="flex flex-row items-center justify-between gap-4 mb-2">
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-light-200 dark:bg-dark-200 text-black/70 dark:text-white/70">
                                {f.category.replace('_', ' ')}
                              </span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                f.status === 'supported'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-950/20 dark:text-green-400'
                                  : f.status === 'contradicted'
                                    ? 'bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400'
                              }`}>
                                {f.status}
                              </span>
                            </div>
                            <h4 className="font-semibold text-sm text-black dark:text-white">{f.statement}</h4>
                            <p className="text-xs text-black/60 dark:text-white/60 mt-1 italic">{f.reasoning}</p>

                            {/* Finding Relations */}
                            {f.relations && f.relations.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-light-200/50 dark:border-dark-200/20">
                                <span className="block text-[10px] font-bold text-black/40 dark:text-white/40 mb-1.5">References & Citations:</span>
                                <div className="space-y-1.5">
                                  {f.relations.map((rel) => {
                                    const src = runSources.find(s => s.id === rel.sourceId);
                                    return (
                                      <div key={rel.id} className="text-xs bg-light-200/40 dark:bg-dark-200/30 p-2 rounded">
                                        <div className="flex justify-between items-center text-[10px]">
                                          <span className="font-semibold text-black/70 dark:text-white/70">{src?.title || 'Unknown Source'}</span>
                                          <span className="capitalize text-black/40 dark:text-white/40">{rel.relationType}</span>
                                        </div>
                                        {rel.excerpt && (
                                          <blockquote className="border-l border-light-200 dark:border-dark-200 pl-2 mt-1 text-black/50 dark:text-white/50 italic">
                                            "{rel.excerpt}"
                                          </blockquote>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {activeReportTab === 'assessments' && (
                    <div className="space-y-4">
                      {runAssessments.length === 0 ? (
                        <p className="text-sm text-black/50 dark:text-white/50 text-center py-6">No source assessments created.</p>
                      ) : (
                        runAssessments.map((a) => {
                          const src = runSources.find(s => s.id === a.sourceId);
                          return (
                            <div key={a.id} className="p-4 bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 rounded-lg">
                              <h4 className="font-semibold text-sm text-black dark:text-white mb-2">{src?.title || 'Unknown Source'}</h4>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px] text-black/60 dark:text-white/60 mb-2 bg-light-200/40 dark:bg-dark-200/20 p-2.5 rounded">
                                <div><strong>Relevance:</strong> {a.directRelevance}</div>
                                <div><strong>Source Type:</strong> {a.originalSource}</div>
                                <div><strong>Publication Status:</strong> {a.publicationStatus}</div>
                                <div><strong>Method Transparency:</strong> {a.methodTransparency}</div>
                                <div><strong>Implementation Evidence:</strong> {a.implementationEvidence}</div>
                                <div><strong>Recency:</strong> {a.recency}</div>
                                <div className="col-span-2 md:col-span-3"><strong>Limitations:</strong> {a.knownLimitations}</div>
                              </div>
                              <p className="text-xs text-black/50 dark:text-white/50 italic mt-1.5">
                                <strong>Assessment Reasoning:</strong> {a.qualityReasoning}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {activeReportTab === 'consequences' && (
                    <div className="space-y-4">
                      {runFindings.flatMap(f => f.consequences || []).length === 0 ? (
                        <p className="text-sm text-black/50 dark:text-white/50 text-center py-6">No consequences mapped.</p>
                      ) : (
                        runFindings.flatMap(f => (f.consequences || []).map(c => {
                          return (
                            <div key={c.id} className="p-4 bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 rounded-lg space-y-2">
                              <div>
                                <span className="text-[10px] font-bold text-black/40 dark:text-white/40 block">Based on Finding:</span>
                                <p className="text-xs font-medium text-black dark:text-white">{f.statement}</p>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-black/80 dark:text-white/80 mt-1 border-t border-light-200/50 dark:border-dark-200/10 pt-2">
                                <div>
                                  <strong>Impact Description:</strong>
                                  <p className="text-black/60 dark:text-white/60">{c.impactDescription}</p>
                                </div>
                                <div>
                                  <strong>Affected Architecture Choice:</strong>
                                  <p className="text-black/60 dark:text-white/60">{c.affectedChoice}</p>
                                </div>
                                <div>
                                  <strong>Risk Profile Change:</strong>
                                  <p className="text-black/60 dark:text-white/60">{c.riskChange}</p>
                                </div>
                                <div>
                                  <strong>Assumptions to Reopen:</strong>
                                  <p className="text-black/60 dark:text-white/60">{c.reopenAssumptions}</p>
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                  <strong>Validation Required:</strong>
                                  <p className="text-black/60 dark:text-white/60">{c.validationRequired}</p>
                                </div>
                              </div>
                            </div>
                          );
                        }))
                      )}
                    </div>
                  )}

                  {/* Report Versions Log Timeline */}
                  {reportVersions.length > 1 && (
                    <div className="mt-6 pt-5 border-t border-light-200 dark:border-dark-200">
                      <span className="text-xs font-bold text-black/50 dark:text-white/50 block mb-2.5 flex items-center gap-1.5">
                        <Clock size={14} /> Report Generation History
                      </span>
                      <div className="flex flex-row flex-wrap gap-2">
                        {reportVersions.map((v) => (
                          <button
                            key={v.id}
                            disabled={v.isActive === 1 || v.status !== 'completed'}
                            onClick={() => handleActivateVersion(v.id)}
                            className={`text-[11px] px-2.5 py-1 rounded border transition ${
                              v.isActive === 1
                                ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white cursor-default'
                                : v.status === 'completed'
                                  ? 'bg-light-200 dark:bg-dark-200 border-light-200 dark:border-dark-200 hover:border-black/20 hover:dark:border-white/20'
                                  : 'bg-red-50 text-red-500 border-red-200 cursor-not-allowed opacity-60'
                            }`}
                          >
                            Version {v.version} ({v.status}) {v.isActive === 1 && '• Active'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Automated Research Plan Details */}
              {runMeta && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {/* Analysis Panel */}
                  <div className="border border-light-200 dark:border-dark-200 rounded-xl p-5 bg-light-secondary/30 dark:bg-dark-secondary/30">
                    <h3 className="text-sm font-semibold text-black dark:text-white mb-3 flex items-center gap-2 border-b border-light-200 dark:border-dark-200 pb-2">
                      <HelpCircle size={16} />
                      Project Analysis
                    </h3>
                    <div className="space-y-3.5 text-xs text-black/70 dark:text-white/70">
                      <div>
                        <strong className="block text-black dark:text-white mb-0.5">Purpose</strong>
                        <p>{runMeta.projectAnalysis?.purpose}</p>
                      </div>
                      <div>
                        <strong className="block text-black dark:text-white mb-0.5">Core Problem</strong>
                        <p>{runMeta.projectAnalysis?.problem}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <strong className="block text-black dark:text-white mb-0.5">Constraints</strong>
                          <ul className="list-disc pl-4 space-y-0.5">
                            {runMeta.projectAnalysis?.constraints?.map((item: string, idx: number) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <strong className="block text-black dark:text-white mb-0.5">Unknowns / Gaps</strong>
                          <ul className="list-disc pl-4 space-y-0.5">
                            {runMeta.projectAnalysis?.unknowns?.map((item: string, idx: number) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Plan & Terminology Panel */}
                  <div className="border border-light-200 dark:border-dark-200 rounded-xl p-5 bg-light-secondary/30 dark:bg-dark-secondary/30">
                    <h3 className="text-sm font-semibold text-black dark:text-white mb-3 flex items-center gap-2 border-b border-light-200 dark:border-dark-200 pb-2">
                      <Hash size={16} />
                      Research Tracks & Terminology
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <strong className="block text-xs text-black dark:text-white mb-1.5">Identified Tracks</strong>
                        <div className="space-y-2">
                          {runMeta.researchPlan?.tracks?.map((track: any) => (
                            <div key={track.id} className="p-2.5 rounded border border-light-200/80 dark:border-dark-200/50 bg-light-secondary/50 dark:bg-dark-secondary/20 flex justify-between items-center text-xs">
                              <div>
                                <span className="font-semibold text-black dark:text-white block">{track.name}</span>
                                <span className="text-[10px] text-black/50 dark:text-white/50">{track.description}</span>
                              </div>
                              <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-semibold ${
                                track.status === 'completed'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-950/20 dark:text-green-400'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400'
                              }`}>
                                {track.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {runMeta.terminologyMap && (
                        <div>
                          <strong className="block text-xs text-black dark:text-white mb-1">Terminology Map</strong>
                          <div className="flex flex-wrap gap-1">
                            {runMeta.terminologyMap.academicTerms?.slice(0, 3).map((term: string) => (
                              <span key={term} className="text-[10px] bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400 px-2 py-0.5 rounded border border-purple-200/30">
                                {term}
                              </span>
                            ))}
                            {runMeta.terminologyMap.technicalTerms?.slice(0, 3).map((term: string) => (
                              <span key={term} className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 px-2 py-0.5 rounded border border-blue-200/30">
                                {term}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Source Collection form panel (Only show when not executing loop) */}
              {selectedRun.status === 'draft' && !researching && (
                <div className="border border-light-200 dark:border-dark-200 rounded-xl p-6 bg-light-secondary/30 dark:bg-dark-secondary/30 mb-8">
                  <h2 className="text-base font-semibold text-black dark:text-white mb-4 flex flex-row items-center gap-2">
                    <Search size={18} />
                    Source Collection (Manual)
                  </h2>
                  <form onSubmit={handleCollectSources} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-black/60 dark:text-white/60 mb-1">
                        Search Query
                      </label>
                      <input
                        type="text"
                        required
                        value={collectQuery}
                        onChange={(e) => setCollectQuery(e.target.value)}
                        placeholder="Query terms..."
                        className="w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary p-2.5 text-sm text-black dark:text-white focus:outline-none focus:border-black/30 focus:dark:border-white/30"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-black/60 dark:text-white/60 mb-2">
                        Source Providers
                      </label>
                      <div className="flex flex-row flex-wrap gap-4 text-sm text-black/80 dark:text-white/80">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sourceTypes.web}
                            onChange={(e) => setSourceTypes({ ...sourceTypes, web: e.target.checked })}
                            className="rounded border-light-200 dark:border-dark-200 text-black focus:ring-0"
                          />
                          <Globe size={16} /> Web (SearXNG)
                        </label>
                        
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sourceTypes.academic}
                            onChange={(e) => setSourceTypes({ ...sourceTypes, academic: e.target.checked })}
                            className="rounded border-light-200 dark:border-dark-200 text-black focus:ring-0"
                          />
                          <GraduationCap size={16} /> Academic (OpenAlex)
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sourceTypes.repository}
                            onChange={(e) => setSourceTypes({ ...sourceTypes, repository: e.target.checked })}
                            className="rounded border-light-200 dark:border-dark-200 text-black focus:ring-0"
                          />
                          <Github size={16} /> Repositories (GitHub API)
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-row justify-end pt-2">
                      <button
                        type="submit"
                        disabled={collecting || !collectQuery.trim()}
                        className="px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-lg hover:opacity-80 disabled:opacity-50 text-sm font-medium transition flex flex-row items-center gap-1.5"
                      >
                        {collecting && <Loader2 className="animate-spin" size={14} />}
                        Collect Sources
                      </button>
                    </div>
                  </form>

                  {/* Status & Error Logs */}
                  {collecting && (
                    <div className="mt-4 p-3 rounded-lg bg-light-200/50 dark:bg-dark-200/50 text-xs text-black/60 dark:text-white/60 flex items-center gap-2">
                      <Loader2 className="animate-spin" size={14} />
                      Querying adapters and normalizing sources...
                    </div>
                  )}

                  {collectionErrors.length > 0 && (
                    <div className="mt-4 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-xs text-red-700 dark:text-red-400 space-y-1">
                      <p className="font-semibold flex items-center gap-1">
                        <AlertTriangle size={14} /> Some adapters failed:
                      </p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {collectionErrors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {collectionSummary && (
                    <div className="mt-4 p-4 rounded-lg bg-green-50 dark:bg-green-950/10 border border-green-200 dark:border-green-900/20 text-xs text-green-800 dark:text-green-400 space-y-1">
                      <p className="font-semibold flex items-center gap-1">
                        <CheckCircle2 className="text-green-600 dark:text-green-500" size={14} /> Collection completed!
                      </p>
                      <p>
                        Found {collectionSummary.totalFound} sources, saved {collectionSummary.totalSaved} normalized items.
                      </p>
                      <div className="flex gap-4 mt-1 font-medium">
                        <span>Web: {collectionSummary.sourcesByType?.web || 0}</span>
                        <span>Academic: {collectionSummary.sourcesByType?.academic || 0}</span>
                        <span>GitHub: {collectionSummary.sourcesByType?.repository || 0}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Research Loop Rounds History */}
              {runMeta?.rounds && runMeta.rounds.length > 0 && (
                <div className="mb-8 border border-light-200 dark:border-dark-200 rounded-xl p-5 bg-light-secondary/10 dark:bg-dark-secondary/10">
                  <h3 className="text-sm font-semibold text-black dark:text-white mb-3 flex items-center gap-2">
                    <Database size={16} />
                    Research Loop Rounds History
                  </h3>
                  <div className="space-y-3.5">
                    {runMeta.rounds.map((round: any) => (
                      <div key={round.roundNumber} className="text-xs border-l-2 border-light-200 dark:border-dark-200 pl-3.5 space-y-1">
                        <strong className="block text-black dark:text-white">Round {round.roundNumber}</strong>
                        <p className="text-black/50 dark:text-white/50">Found {round.sourcesFoundCount} sources.</p>
                        <div className="mt-1">
                          <span className="font-semibold text-black/60 dark:text-white/60">Queries executed:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {round.queriesExecuted?.map((q: string, idx: number) => (
                              <span key={idx} className="bg-light-200 dark:bg-dark-200 px-1.5 py-0.5 rounded text-[10px] font-mono text-black/60 dark:text-white/60">
                                {q}
                              </span>
                            ))}
                          </div>
                        </div>
                        {round.gapsIdentified?.length > 0 && (
                          <div className="mt-1">
                            <span className="font-semibold text-black/60 dark:text-white/60">Remaining Gaps:</span>
                            <ul className="list-disc pl-4 text-black/60 dark:text-white/60 space-y-0.5 mt-0.5">
                              {round.gapsIdentified.map((gap: string, idx: number) => (
                                <li key={idx}>{gap}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Queries Log List (Manual queries or loop queries) */}
              {runQueries.length > 0 && !researching && (
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-black dark:text-white mb-3">
                    Query History
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {runQueries.map((q) => (
                      <span
                        key={q.id}
                        className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                          q.status === 'completed'
                            ? 'bg-green-50 dark:bg-green-950/10 border-green-200 dark:border-green-950/30 text-green-700 dark:text-green-400'
                            : 'bg-red-50 dark:bg-red-950/10 border-red-200 dark:border-red-950/30 text-red-700 dark:text-red-400'
                        }`}
                      >
                        <span className="font-semibold capitalize">{q.sourceType}</span>: "{q.query}"
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sources Table / List */}
              <div>
                <h3 className="text-base font-semibold text-black dark:text-white mb-4">
                  Saved Sources ({runSources.length})
                </h3>
                {runSources.length === 0 ? (
                  <div className="border border-dashed border-light-200 dark:border-dark-200 rounded-xl py-12 text-center text-sm text-black/50 dark:text-white/50">
                    No sources collected yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {runSources.map((source) => {
                      const meta = source.metadata ? JSON.parse(source.metadata) : {};
                      
                      return (
                        <div
                          key={source.id}
                          className="p-5 rounded-xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary"
                        >
                          <div className="flex flex-row items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-row flex-wrap items-center gap-2 mb-1.5">
                                {/* Type Badge */}
                                <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded flex items-center gap-1 ${
                                  source.sourceType === 'academic'
                                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/30 dark:text-purple-400'
                                    : source.sourceType === 'repository'
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400'
                                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                                }`}>
                                  {source.sourceType === 'academic' && <GraduationCap size={10} />}
                                  {source.sourceType === 'repository' && <Github size={10} />}
                                  {source.sourceType === 'web' && <Globe size={10} />}
                                  {source.sourceType}
                                </span>
                                {/* Provider Badge */}
                                <span className="text-[10px] bg-light-200 dark:bg-dark-200 px-1.5 py-0.5 rounded text-black/50 dark:text-white/50 font-mono">
                                  {source.provider}
                                </span>
                              </div>
                              
                              <h4 className="font-semibold text-black dark:text-white text-base">
                                {source.title}
                              </h4>
                              
                              {source.authors && (
                                <p className="text-xs text-black/50 dark:text-white/50 mt-1">
                                  By {source.authors}
                                </p>
                              )}

                              {meta.snippetPreview && (
                                <p className="text-xs text-black/60 dark:text-white/60 mt-2 line-clamp-3 bg-light-primary/50 dark:bg-dark-primary/30 p-2 rounded border border-light-200/40 dark:border-dark-200/20 italic">
                                  {meta.snippetPreview}
                                </p>
                              )}

                              {/* Source Specific Stats */}
                              <div className="flex flex-row flex-wrap items-center gap-4 text-[11px] text-black/40 dark:text-white/40 mt-3 pt-2.5 border-t border-light-200/40 dark:border-dark-200/10">
                                {source.sourceType === 'academic' && (
                                  <>
                                    {meta.venue && <span>Venue: {meta.venue}</span>}
                                    {source.doi && <span>DOI: {source.doi}</span>}
                                    {meta.citations !== undefined && <span>Citations: {meta.citations}</span>}
                                    {meta.isOpenAccess && <span className="text-green-600 dark:text-green-500 font-medium">Open Access</span>}
                                  </>
                                )}
                                {source.sourceType === 'repository' && (
                                  <>
                                    {meta.language && <span>Language: {meta.language}</span>}
                                    {meta.stars !== undefined && <span>Stars: ★ {meta.stars}</span>}
                                    {meta.latestRelease && <span>Latest Release: {meta.latestRelease}</span>}
                                    {meta.license && <span>License: {meta.license}</span>}
                                  </>
                                )}
                                <span>Retrieved: {new Date(source.retrievedAt).toLocaleDateString()}</span>
                              </div>
                            </div>

                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-black/50 dark:text-white/50 hover:bg-light-200 hover:dark:bg-dark-200 rounded-lg transition"
                              title="Open source URL"
                            >
                              <ExternalLink size={16} />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
