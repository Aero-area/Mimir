'use client';

import { useState, useEffect } from 'react';
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
    }
  }, [selectedRunId]);

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
        setSelectedRunId(data.run.id); // Open it directly
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
        // Refresh sources & queries list
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
          <div className="mb-6">
            <button
              onClick={() => setSelectedRunId(null)}
              className="flex flex-row items-center gap-1.5 text-sm text-black/60 dark:text-white/60 hover:text-black hover:dark:text-white transition duration-150"
            >
              <ArrowLeft size={16} />
              Back to Project Runs
            </button>
          </div>

          {loadingRunDetails || !selectedRun ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-black/50 dark:text-white/50" size={32} />
            </div>
          ) : (
            <div>
              {/* Run Information Header */}
              <div className="bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 rounded-xl p-6 mb-8">
                <h1 className="text-lg font-semibold text-black dark:text-white">
                  Research Run: {selectedRun.id.slice(0, 8)}
                </h1>
                <p className="text-sm text-black/70 dark:text-white/70 mt-2">
                  <strong>Topic / Goal:</strong> {selectedRun.input}
                </p>
                <div className="mt-4 pt-3 border-t border-light-200/50 dark:border-dark-200/50 flex flex-row gap-4 text-xs text-black/40 dark:text-white/40">
                  <span>Started: {new Date(selectedRun.startedAt).toLocaleString()}</span>
                  <span>•</span>
                  <span>Status: <span className="capitalize font-medium text-black/60 dark:text-white/60">{selectedRun.status}</span></span>
                </div>
              </div>

              {/* Source Collection form panel */}
              {selectedRun.status === 'draft' && (
                <div className="border border-light-200 dark:border-dark-200 rounded-xl p-6 bg-light-secondary/30 dark:bg-dark-secondary/30 mb-8">
                  <h2 className="text-base font-semibold text-black dark:text-white mb-4 flex flex-row items-center gap-2">
                    <Search size={18} />
                    Source Collection
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

              {/* Queries Log List */}
              {runQueries.length > 0 && (
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
