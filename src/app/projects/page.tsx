'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Plus, Briefcase, Trash, FolderOpen, Loader2 } from 'lucide-react';
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

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      } else {
        toast.error('Failed to load projects');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while loading projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });

      if (res.ok) {
        toast.success('Project created successfully');
        setTitle('');
        setDescription('');
        setIsModalOpen(false);
        fetchProjects();
      } else {
        const errData = await res.json();
        toast.error(errData.message || 'Failed to create project');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this project? This will permanently remove all associated research runs.')) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Project deleted successfully');
        fetchProjects();
      } else {
        toast.error('Failed to delete project');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while deleting');
    }
  };

  return (
    <div className="py-8 max-w-5xl mx-auto px-4 min-h-screen">
      <div className="flex flex-row items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-white flex flex-row items-center gap-2">
            <Briefcase className="text-black/70 dark:text-white/70" />
            Mimir Projects
          </h1>
          <p className="text-sm text-black/50 dark:text-white/50 mt-1">
            Define projects and run research loops to explore technical solutions.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex flex-row items-center gap-1.5 px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-lg hover:opacity-80 active:scale-95 transition duration-150 text-sm font-medium"
        >
          <Plus size={16} />
          Create Project
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-black/50 dark:text-white/50" size={32} />
        </div>
      ) : projects.length === 0 ? (
        <div className="border border-dashed border-light-200 dark:border-dark-200 rounded-xl p-16 text-center">
          <Briefcase size={40} className="mx-auto text-black/30 dark:text-white/30 mb-4" />
          <h3 className="font-medium text-lg text-black dark:text-white">No projects yet</h3>
          <p className="text-sm text-black/50 dark:text-white/50 mt-1 mb-6">
            Get started by creating your first technical research project.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-lg hover:opacity-80 transition duration-150 text-sm font-medium"
          >
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="group block p-5 rounded-xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary hover:border-black/20 hover:dark:border-white/20 transition duration-150"
            >
              <div className="flex flex-col h-full justify-between">
                <div>
                  <div className="flex flex-row items-start justify-between">
                    <h3 className="font-medium text-black dark:text-white group-hover:underline text-lg">
                      {project.title}
                    </h3>
                    <button
                      onClick={(e) => handleDeleteProject(project.id, e)}
                      className="p-1 text-black/40 dark:text-white/40 hover:text-red-500 hover:dark:text-red-400 rounded transition duration-150"
                      title="Delete project"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                  <p className="text-sm text-black/60 dark:text-white/60 mt-2 line-clamp-2">
                    {project.description || 'No description provided.'}
                  </p>
                </div>
                <div className="flex flex-row items-center justify-between mt-6 pt-4 border-t border-light-200/50 dark:border-dark-200/50 text-xs text-black/40 dark:text-white/40">
                  <span className="capitalize px-2 py-0.5 rounded bg-light-200 dark:bg-dark-200 text-black/70 dark:text-white/70">
                    {project.status}
                  </span>
                  <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="mx-auto max-w-md w-full rounded-xl border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary p-6 shadow-xl">
            <DialogTitle className="text-lg font-medium text-black dark:text-white">
              Create New Project
            </DialogTitle>
            <form onSubmit={handleCreateProject} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-black/60 dark:text-white/60 mb-1">
                  Project Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., CarryState Database Integration"
                  className="w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary p-2.5 text-sm text-black dark:text-white focus:outline-none focus:border-black/30 focus:dark:border-white/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black/60 dark:text-white/60 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summarize the core technical problem or goal..."
                  rows={4}
                  className="w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary p-2.5 text-sm text-black dark:text-white focus:outline-none focus:border-black/30 focus:dark:border-white/30 resize-none"
                />
              </div>
              <div className="flex flex-row items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-light-200 dark:border-dark-200 text-black/70 dark:text-white/70 hover:bg-light-200 hover:dark:bg-dark-200 rounded-lg text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !title.trim()}
                  className="px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-lg hover:opacity-80 disabled:opacity-50 text-sm font-medium transition flex flex-row items-center gap-1.5"
                >
                  {submitting && <Loader2 className="animate-spin" size={14} />}
                  Create
                </button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  );
}
