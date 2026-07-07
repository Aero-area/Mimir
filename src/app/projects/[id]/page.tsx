'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Briefcase, Plus, Loader2, Calendar, FileText } from 'lucide-react';
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

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [runs, setRuns] = useState<ResearchRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingRun, setIsCreatingRun] = useState(false);
  const [input, setInput] = useState('');
  const [submittingRun, setSubmittingRun] = useState(false);

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

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
    }
  }, [projectId]);

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
        toast.success('Research run draft created successfully');
        setInput('');
        setIsCreatingRun(false);
        fetchProjectData();
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
            <div
              key={run.id}
              className="p-4 rounded-xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary flex flex-row items-center justify-between"
            >
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-sm font-medium text-black dark:text-white truncate">
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
