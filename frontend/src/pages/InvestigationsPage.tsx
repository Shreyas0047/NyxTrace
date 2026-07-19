import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  Filter,
  MoreVertical,
  Folder,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge, SeverityBadge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { PageHeader } from '../layouts/PageContainer';
import { formatRelativeTime } from '../utils/helpers';
import { useInvestigationStore } from '../stores/investigationStore';
import type { InvestigationPriority } from '../types';
import { cn } from '../design-system';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export function InvestigationsPage() {
  const navigate = useNavigate();
  const {
    investigations,
    isLoading,
    error,
    pagination,
    fetchInvestigations,
    createInvestigation,
    deleteInvestigation,
  } = useInvestigationStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<InvestigationPriority>('medium');
  const [createLoading, setCreateLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  useEffect(() => {
    fetchInvestigations({ page, limit: 12 });
  }, [fetchInvestigations, page]);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    setCreateLoading(true);
    try {
      const result = await createInvestigation({
        title: newTitle.trim(),
        description: newDescription.trim(),
        priority: newPriority,
      });
      if (result) {
        setShowCreateModal(false);
        setNewTitle('');
        setNewDescription('');
        setNewPriority('medium');
        fetchInvestigations({ page: 1, limit: 12 });
      }
    } finally {
      setCreateLoading(false);
    }
  }, [newTitle, newDescription, newPriority, createInvestigation, fetchInvestigations]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this investigation?')) return;
    await deleteInvestigation(id);
    fetchInvestigations({ page, limit: 12 });
    setMenuOpen(null);
  }, [deleteInvestigation, fetchInvestigations, page]);

  const filteredInvestigations = investigations.filter(inv => {
    const matchesSearch = !searchTerm || inv.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.caseNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || inv.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const totalPages = pagination.totalPages || 1;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <PageHeader
        title="Investigations"
        subtitle="Manage and track all forensic investigations"
        actions={
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4" />
            New Investigation
          </Button>
        }
      />

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
          <button onClick={() => fetchInvestigations({ page, limit: 12 })} className="ml-auto p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded">
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}

      <Card>
        <div className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search investigations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <Select
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'pending', label: 'Pending' },
                { value: 'active', label: 'Active' },
                { value: 'analyzing', label: 'Analyzing' },
                { value: 'resolved', label: 'Resolved' },
                { value: 'closed', label: 'Closed' },
              ]}
            />
            <Select
              value={priorityFilter}
              onChange={(val) => setPriorityFilter(val)}
              options={[
                { value: 'all', label: 'All Priority' },
                { value: 'critical', label: 'Critical' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
            />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : filteredInvestigations.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Folder className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-lg font-medium">No investigations found</p>
            <p className="text-sm mt-1">Create a new investigation to get started</p>
            <Button size="sm" className="mt-4" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4" />
              New Investigation
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInvestigations.map((investigation) => (
            <motion.div key={investigation.id} variants={item}>
              <Card hover className="cursor-pointer h-full" onClick={() => navigate(`/investigations/${investigation.id}`)}>
                <div className="p-5 flex flex-col h-full relative">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{investigation.caseNumber}</p>
                      <h3 className="font-semibold text-slate-900 dark:text-white mt-1">{investigation.title}</h3>
                    </div>
                    <button
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === investigation.id ? null : investigation.id); }}
                    >
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>
                    {menuOpen === investigation.id && (
                      <div className="absolute right-4 top-10 z-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[140px]">
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                          onClick={(e) => { e.stopPropagation(); navigate(`/investigations/${investigation.id}`); setMenuOpen(null); }}
                        >
                          View Details
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                          onClick={(e) => { e.stopPropagation(); handleDelete(investigation.id); }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 flex-1">{investigation.description}</p>

                  <div className="flex items-center gap-2 mb-4">
                    <StatusBadge status={investigation.status} size="sm" />
                    <SeverityBadge severity={investigation.priority as any} size="sm" />
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Folder className="w-3.5 h-3.5" />
                        {investigation.evidenceCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {investigation.alertCount}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {formatRelativeTime(investigation.updatedAt)}
                    </span>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Card>
          <div className="p-4 flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing {(page - 1) * 12 + 1}-{Math.min(page * 12, pagination.total)} of {pagination.total} investigations
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = i + 1;
                return (
                  <Button
                    key={p}
                    variant="outline"
                    size="sm"
                    className={cn(page === p && 'bg-amber-500/20 border-amber-500/30 text-amber-400')}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                );
              })}
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">New Investigation</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  placeholder="Investigation title..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white resize-none"
                  rows={3}
                  placeholder="Describe the investigation..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                <Select
                  value={newPriority}
                  onChange={(val) => setNewPriority(val as InvestigationPriority)}
                  options={[
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' },
                    { value: 'critical', label: 'Critical' },
                  ]}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newTitle.trim() || createLoading}>
                {createLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default InvestigationsPage;
