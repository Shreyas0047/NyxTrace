import { useState, useEffect, useCallback, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Archive, HardDrive, Trash2, AlertTriangle,
  RefreshCw, ChevronDown, ChevronUp,
  FileText, FileCode, FileLock, Server, Loader2, Fingerprint,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import {
  PageHeader, PageGrid, PageContainer, PageSection,
} from '../layouts/PageContainer';
import { DashboardCard, DashboardStat } from '../components/enterprise/DashboardGrid';
import { EmptyState } from '../layouts/PageContainer';
import { cn } from '../design-system';
import api from '../services/api';
import { useStatusStore } from '../stores/statusStore';
import { formatDateTime, formatFileSize } from '../utils/helpers';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

interface StorageCategoryInfo {
  key: string;
  label: string;
  path: string;
  fileCount: number;
  sizeBytes: number;
  lastModified: string | null;
  sizeFormatted: string;
}

interface FileInfo {
  name: string;
  size: number;
  mtime: string;
  sessionId?: string;
  linkedEvidenceId?: string;
  sizeFormatted: string;
}

interface SessionFootprintInfo {
  session: {
    sessionId: string;
    status: string;
    startTime: string;
    eventsCollected: number;
    vmName: string;
    simulatorName: string;
  };
  reportFile: FileInfo | null;
  telemetryCount: number;
  monitoringLogFiles: FileInfo[];
}

interface StorageOverview {
  categories: StorageCategoryInfo[];
  database: {
    sandboxSessions: number;
    telemetryEvents: number;
    analysisReports: number;
    reports: number;
    evidence: number;
    alerts: number;
    investigations: number;
  };
  totalFiles: number;
  totalSizeBytes: number;
  totalSizeFormatted: string;
}

interface DeleteResult {
  deleted: boolean;
  message: string;
  details: {
    filesDeleted: string[];
    dbRecordsDeleted: number;
    sizeFreed: number;
    failedFiles?: string[];
    fileHashes?: Record<string, string>;
  };
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  reports: FileText,
  analysis: FileCode,
  evidence: FileLock,
  'sandbox-logs': HardDrive,
  monitoring: Server,
};

const CATEGORY_COLORS: Record<string, string> = {
  reports: 'from-amber-500 to-amber-600',
  analysis: 'from-violet-500 to-purple-600',
  evidence: 'from-emerald-500 to-teal-600',
  'sandbox-logs': 'from-slate-500 to-slate-600',
  monitoring: 'from-blue-500 to-cyan-600',
};

export function StorageManagerPage() {
  const [overview, setOverview] = useState<StorageOverview | null>(null);
  const [sessions, setSessions] = useState<SessionFootprintInfo[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [categoryFiles, setCategoryFiles] = useState<Record<string, FileInfo[]>>({});
  const [categoryFilesLoading, setCategoryFilesLoading] = useState<Record<string, boolean>>({});
  const [fileFilters, setFileFilters] = useState<Record<string, string>>({});
  const [fileHashes, setFileHashes] = useState<Record<string, { sha256: string; md5: string } | 'loading' | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Record<string, Set<string>>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    danger: boolean;
    onConfirm: () => Promise<void>;
  }>({ isOpen: false, title: '', message: '', danger: false, onConfirm: async () => {} });
  const [purgeConfirm, setPurgeConfirm] = useState<string>('');

  const showStatus = useStatusStore((s) => s.show);

  const fetchOverview = useCallback(async () => {
    setIsLoading(true);
    try {
      const resp = await api.get<StorageOverview>('/storage/overview');
      if (resp.success) {
        setOverview(resp.data ?? null);
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch storage overview:', error);
      showStatus('error', 'Failed to load storage overview', 'Check that the backend is running.');
    } finally {
      setIsLoading(false);
    }
  }, [showStatus]);

  const fetchSessions = useCallback(async () => {
    try {
      const resp = await api.get<SessionFootprintInfo[]>('/storage/sessions');
      if (resp.success) {
        setSessions(resp.data ?? []);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      showStatus('error', 'Failed to load session footprints', 'Check that the backend is running.');
    }
  }, [showStatus]);

  useEffect(() => {
    fetchOverview();
    fetchSessions();
  }, [fetchOverview, fetchSessions]);

  const fetchCategoryFiles = useCallback(async (categoryKey: string) => {
    setCategoryFilesLoading(prev => ({ ...prev, [categoryKey]: true }));
    try {
      const resp = await api.get<FileInfo[]>(`/storage/categories/${categoryKey}/files`);
      if (resp.success) {
        setCategoryFiles(prev => ({ ...prev, [categoryKey]: resp.data || [] }));
      }
    } catch (error) {
      console.error(`Failed to fetch files for ${categoryKey}:`, error);
      showStatus('error', `Failed to load ${categoryKey} files`, 'Check that the backend is running.');
    } finally {
      setCategoryFilesLoading(prev => ({ ...prev, [categoryKey]: false }));
    }
  }, [showStatus]);

  const refreshExpandedCategories = useCallback(() => {
    const expanded = Object.entries(expandedCategories)
      .filter(([, isExpanded]) => isExpanded)
      .map(([key]) => key);
    expanded.forEach(key => {
      fetchCategoryFiles(key);
      setFileHashes(prev => {
        const next: Record<string, { sha256: string; md5: string } | 'loading' | null> = { ...prev };
        Object.keys(next).forEach(k => { if (k.startsWith(`${key}::`)) delete next[k]; });
        return next;
      });
    });
  }, [expandedCategories, fetchCategoryFiles]);

  const handleCategoryFiles = async (categoryKey: string) => {
    const nextExpanded = !expandedCategories[categoryKey];
    setExpandedCategories(prev => ({ ...prev, [categoryKey]: nextExpanded }));
    if (nextExpanded && !categoryFiles[categoryKey]) {
      await fetchCategoryFiles(categoryKey);
    }
  };

  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const toggleFileSelection = (categoryKey: string, fileName: string) => {
    setSelectedFiles(prev => {
      const categorySet = new Set(prev[categoryKey] || []);
      if (categorySet.has(fileName)) categorySet.delete(fileName);
      else categorySet.add(fileName);
      return { ...prev, [categoryKey]: categorySet };
    });
  };

  const openConfirm = (title: string, message: string, onConfirm: () => Promise<void>, danger = false) => {
    setConfirmDialog({ isOpen: true, title, message, danger, onConfirm });
  };

  const closeConfirm = () => {
    setConfirmDialog({ isOpen: false, title: '', message: '', danger: false, onConfirm: async () => {} });
  };

  const deleteSelectedSessions = async () => {
    if (selectedSessions.size === 0) return;
    setIsActionLoading(true);
    try {
      let deleted = 0;
      for (const sessionId of selectedSessions) {
        await api.delete<DeleteResult>(`/storage/sessions/${sessionId}`);
        deleted += 1;
      }
      setSelectedSessions(new Set());
      showStatus('success', `Deleted ${deleted} session footprint(s)`);
      fetchOverview();
      fetchSessions();
      refreshExpandedCategories();
    } catch (error: any) {
      console.error('Failed to delete sessions:', error);
      showStatus('error', 'Failed to delete session(s)', error?.response?.data?.message || error?.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const deleteSelectedFiles = async (categoryKey: string) => {
    const files = selectedFiles[categoryKey];
    if (!files || files.size === 0) return;
    setIsActionLoading(true);
    try {
      const resp = await api.delete<DeleteResult>('/storage/files', { category: categoryKey, names: Array.from(files) });
      setSelectedFiles(prev => ({ ...prev, [categoryKey]: new Set() }));
      setFileHashes(prev => {
        const next: Record<string, { sha256: string; md5: string } | 'loading' | null> = { ...prev };
        Object.keys(next).forEach(k => { if (k.startsWith(`${categoryKey}::`)) delete next[k]; });
        return next;
      });
      showStatus(resp.data?.deleted ? 'success' : 'warning', resp.data?.message || 'Files deleted', resp.data?.details?.failedFiles?.length
        ? `Failed to remove: ${resp.data.details.failedFiles.join(', ')}`
        : undefined);
      fetchOverview();
      fetchCategoryFiles(categoryKey);
    } catch (error: any) {
      console.error('Failed to delete files:', error);
      showStatus('error', 'Failed to delete files', error?.response?.data?.message || error?.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const deleteEvidenceFile = async (evidenceId: string, categoryKey: string, fileName: string) => {
    setIsActionLoading(true);
    try {
      const resp = await api.delete<DeleteResult>(`/storage/evidence/${evidenceId}`);
      setFileHashes(prev => {
        const next: Record<string, { sha256: string; md5: string } | 'loading' | null> = { ...prev };
        Object.keys(next).forEach(k => { if (k.startsWith(`${categoryKey}::${fileName}`)) delete next[k]; });
        return next;
      });
      showStatus('success', resp.data?.message || 'Evidence deleted');
      fetchOverview();
      fetchCategoryFiles(categoryKey);
    } catch (error: any) {
      console.error('Failed to delete evidence:', error);
      showStatus('error', 'Failed to delete evidence', error?.response?.data?.message || error?.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const deleteSingleFile = async (categoryKey: string, fileName: string) => {
    setIsActionLoading(true);
    try {
      const resp = await api.delete<DeleteResult>('/storage/files', { category: categoryKey, names: [fileName] });
      setFileHashes(prev => {
        const next: Record<string, { sha256: string; md5: string } | 'loading' | null> = { ...prev };
        Object.keys(next).forEach(k => { if (k.startsWith(`${categoryKey}::${fileName}`)) delete next[k]; });
        return next;
      });
      showStatus(resp.data?.deleted ? 'success' : 'warning', resp.data?.message || 'File deleted');
      fetchOverview();
      fetchCategoryFiles(categoryKey);
    } catch (error: any) {
      console.error('Failed to delete file:', error);
      showStatus('error', 'Failed to delete file', error?.response?.data?.message || error?.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const purgeCategory = async (categoryKey: string) => {
    setIsActionLoading(true);
    try {
      const resp = await api.delete<DeleteResult>(`/storage/categories/${categoryKey}`, { confirm: true });
      setCategoryFiles(prev => ({ ...prev, [categoryKey]: [] }));
      setSelectedFiles(prev => ({ ...prev, [categoryKey]: new Set() }));
      setFileHashes(prev => {
        const next: Record<string, { sha256: string; md5: string } | 'loading' | null> = { ...prev };
        Object.keys(next).forEach(k => { if (k.startsWith(`${categoryKey}::`)) delete next[k]; });
        return next;
      });
      showStatus('success', resp.data?.message || `Purged ${categoryKey}`);
      fetchOverview();
    } catch (error: any) {
      console.error('Failed to purge category:', error);
      showStatus('error', 'Failed to purge category', error?.response?.data?.message || error?.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const purgeAll = async () => {
    if (purgeConfirm !== 'PURGE') return;
    setIsActionLoading(true);
    try {
      const resp = await api.post<DeleteResult>('/storage/purge', { confirm: 'PURGE' });
      setCategoryFiles({});
      setSelectedFiles({});
      setFileHashes({});
      setPurgeConfirm('');
      showStatus('success', resp.data?.message || 'All session data purged');
      fetchOverview();
      fetchSessions();
    } catch (error: any) {
      console.error('Failed to purge all:', error);
      showStatus('error', 'Failed to purge all session data', error?.response?.data?.message || error?.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const fetchFileHash = async (categoryKey: string, fileName: string) => {
    const hashKey = `${categoryKey}::${fileName}`;
    setFileHashes(prev => ({ ...prev, [hashKey]: 'loading' as const }));
    try {
      const resp = await api.get<{ sha256: string; md5: string }>(
        `/storage/categories/${categoryKey}/files/${encodeURIComponent(fileName)}/hash`
      );
      if (resp.success) {
        setFileHashes(prev => ({ ...prev, [hashKey]: resp.data ?? null }));
      }
    } catch (error: any) {
      console.error('Failed to fetch file hash:', error);
      setFileHashes(prev => ({ ...prev, [hashKey]: null }));
      showStatus('error', 'Failed to compute file hash', error?.response?.data?.message || error?.message);
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '—';
    try {
      return formatDateTime(dateString);
    } catch {
      return dateString;
    }
  };

  if (isLoading && !overview) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--text-secondary)]" />
      </div>
    );
  }

  return (
    <PageContainer maxWidth="full" className="p-6 space-y-6">
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={item}>
          <PageHeader
            eyebrow="Administration · Storage"
            title="Storage Manager"
            subtitle="Forensic evidence vault — session data, reports, and artifact lifecycle"
            stamp="EVIDENCE VAULT"
            actions={
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hidden md:flex">
                  <RefreshCw className="w-4 h-4" />
                  {lastRefresh ? `Last refresh: ${formatDateTime(lastRefresh)}` : 'Not loaded'}
                </div>
                <Button variant="outline" size="sm" onClick={fetchOverview} disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Refresh
                </Button>
              </div>
            }
          />
        </motion.div>

        <motion.div variants={item}>
          <PageGrid columns={4}>
            <DashboardCard>
              <DashboardStat
                label="Session Reports"
                value={overview?.categories.find(c => c.key === 'reports')?.fileCount || 0}
                stamp="FILES"
                mono
                delta={`${overview?.categories.find(c => c.key === 'reports')?.sizeFormatted || '0 B'} total`}
                icon={<FileText className="w-5 h-5 text-amber-600" />}
              />
            </DashboardCard>
            <DashboardCard>
              <DashboardStat
                label="Document Analyses"
                value={overview?.categories.find(c => c.key === 'analysis')?.fileCount || 0}
                stamp="FILES"
                mono
                delta={`${overview?.categories.find(c => c.key === 'analysis')?.sizeFormatted || '0 B'} total`}
                icon={<FileCode className="w-5 h-5 text-violet-600" />}
              />
            </DashboardCard>
            <DashboardCard>
              <DashboardStat
                label="Evidence Files"
                value={overview?.categories.find(c => c.key === 'evidence')?.fileCount || 0}
                stamp="FILES"
                mono
                delta={`${overview?.categories.find(c => c.key === 'evidence')?.sizeFormatted || '0 B'} total`}
                icon={<FileLock className="w-5 h-5 text-emerald-600" />}
              />
            </DashboardCard>
            <DashboardCard>
              <DashboardStat
                label="Log Files"
                value={
                  (overview?.categories.find(c => c.key === 'sandbox-logs')?.fileCount || 0) +
                  (overview?.categories.find(c => c.key === 'monitoring')?.fileCount || 0)
                }
                stamp="FILES"
                mono
                delta={`${formatFileSize(
                  (overview?.categories.find(c => c.key === 'sandbox-logs')?.sizeBytes || 0) +
                  (overview?.categories.find(c => c.key === 'monitoring')?.sizeBytes || 0)
                )} total`}
                icon={<HardDrive className="w-5 h-5 text-slate-600" />}
              />
            </DashboardCard>
          </PageGrid>
        </motion.div>

        <motion.div variants={item}>
          <PageGrid columns={4}>
            <DashboardCard>
              <DashboardStat
                label="Sandbox Sessions"
                value={overview?.database.sandboxSessions || 0}
                stamp="SESSIONS"
                mono
                delta="Active + Archived"
                icon={<Database className="w-5 h-5 text-amber-600" />}
              />
            </DashboardCard>
            <DashboardCard>
              <DashboardStat
                label="Telemetry Events"
                value={overview?.database.telemetryEvents || 0}
                stamp="EVENTS"
                mono
                delta="Collected"
                icon={<Server className="w-5 h-5 text-blue-600" />}
              />
            </DashboardCard>
            <DashboardCard>
              <DashboardStat
                label="Analysis Reports"
                value={overview?.database.analysisReports || 0}
                stamp="REPORTS"
                mono
                delta="AI + Heuristic"
                icon={<FileCode className="w-5 h-5 text-violet-600" />}
              />
            </DashboardCard>
            <DashboardCard>
              <DashboardStat
                label="Total Storage"
                value={overview?.totalSizeFormatted || '0 B'}
                stamp="USED"
                mono
                delta={`${overview?.totalFiles || 0} files`}
                icon={<Archive className="w-5 h-5 text-slate-600" />}
              />
            </DashboardCard>
          </PageGrid>
        </motion.div>

        <motion.div variants={item}>
          <PageSection title="Session Footprints">
            <DashboardCard>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[var(--text-tertiary)] font-mono text-[11px] uppercase tracking-[0.08em] border-b border-[var(--border-subtle)]">
                      <th className="p-3 w-10"></th>
                      <th className="p-3">Session ID</th>
                      <th className="p-3">VM / Simulator</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Started</th>
                      <th className="p-3">Events</th>
                      <th className="p-3">Report</th>
                      <th className="p-3">Telemetry</th>
                      <th className="p-3">Monitoring</th>
                      <th className="p-3 w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {sessions.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center">
                          <EmptyState
                            icon={<Database className="w-8 h-8 text-[var(--text-tertiary)]" />}
                            title="No sandbox sessions"
                            description="Sessions appear here after sandbox execution completes."
                            stamp="EMPTY"
                          />
                        </td>
                      </tr>
                    ) : (
                      sessions.map((sf) => (
                        <tr key={sf.session.sessionId} className="hover:bg-[var(--surface-container-lowest)] transition-colors">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={selectedSessions.has(sf.session.sessionId)}
                              onChange={() => toggleSessionSelection(sf.session.sessionId)}
                              className="w-4 h-4 rounded border-[var(--border-default)] text-amber-500 focus:ring-amber-500 focus:ring-2"
                            />
                          </td>
                          <td className="p-3 font-mono text-[var(--text-primary)]">{sf.session.sessionId}</td>
                          <td className="p-3">
                            <div className="text-[var(--text-primary)]">{sf.session.vmName}</div>
                            <div className="text-xs text-[var(--text-secondary)]">{sf.session.simulatorName}</div>
                          </td>
                          <td className="p-3">
                            <StatusBadge status={sf.session.status} size="sm" />
                          </td>
                          <td className="p-3 text-[var(--text-secondary)] font-mono">{formatDate(sf.session.startTime)}</td>
                          <td className="p-3 font-mono text-[var(--text-primary)]">{sf.session.eventsCollected}</td>
                          <td className="p-3">
                            {sf.reportFile ? (
                              <div className="flex items-center gap-2 text-sm">
                                <FileText className="w-4 h-4 text-amber-500" />
                                <span className="font-mono">{sf.reportFile.sizeFormatted}</span>
                              </div>
                            ) : (
                              <span className="text-[var(--text-tertiary)] font-mono text-xs">—</span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-[var(--text-primary)]">{sf.telemetryCount}</td>
                          <td className="p-3 font-mono text-[var(--text-primary)]">{sf.monitoringLogFiles.length}</td>
                          <td className="p-3">
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => openConfirm(
                                'Delete Session Footprint',
                                `This will permanently delete session ${sf.session.sessionId}: its database record, ${sf.telemetryCount} telemetry events, and associated report/monitoring files. This action cannot be undone.`,
                                async () => {
                                  setIsActionLoading(true);
                                  try {
                                    await api.delete<DeleteResult>(`/storage/sessions/${sf.session.sessionId}`);
                                    showStatus('success', `Deleted session ${sf.session.sessionId}`);
                                    fetchOverview();
                                    fetchSessions();
                                    refreshExpandedCategories();
                                  } catch (error: any) {
                                    console.error('Failed to delete session:', error);
                                    showStatus('error', 'Failed to delete session', error?.response?.data?.message || error?.message);
                                  } finally {
                                    setIsActionLoading(false);
                                  }
                                },
                                true
                              )}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {selectedSessions.size > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">
                    {selectedSessions.size} session(s) selected
                  </span>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => openConfirm(
                      'Delete Selected Sessions',
                      `This will permanently delete ${selectedSessions.size} session footprint(s): database records, telemetry events, and associated files. This action cannot be undone.`,
                      deleteSelectedSessions,
                      true
                    )}
                    disabled={isActionLoading}
                  >
                    {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete Selected
                  </Button>
                </div>
              )}
            </DashboardCard>
          </PageSection>
        </motion.div>

        <motion.div variants={item}>
          <PageSection title="File Categories">
            <div className="space-y-4">
              {overview?.categories.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.key] || Database;
                const isExpanded = expandedCategories[cat.key];
                const files = categoryFiles[cat.key] || [];
                const isLoadingFiles = categoryFilesLoading[cat.key];
                const filterQuery = (fileFilters[cat.key] || '').toLowerCase();
                const filteredFiles = filterQuery
                  ? files.filter(f => f.name.toLowerCase().includes(filterQuery))
                  : files;
                const selectedInCategory = selectedFiles[cat.key] || new Set();

                return (
                  <DashboardCard key={cat.key} className="overflow-hidden">
                    <div className="px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-container-lowest)]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', `bg-gradient-to-br ${CATEGORY_COLORS[cat.key] || 'from-slate-500 to-slate-600'}`)}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-[var(--text-primary)]">{cat.label}</h3>
                            <p className="text-xs text-[var(--text-secondary)] font-mono">{cat.path}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-mono text-[var(--text-primary)]">{cat.fileCount}</p>
                            <p className="text-xs text-[var(--text-secondary)]">files</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-mono text-[var(--text-primary)]">{cat.sizeFormatted}</p>
                            <p className="text-xs text-[var(--text-secondary)]">total</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCategoryFiles(cat.key)}
                            leftIcon={isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          >
                            {isExpanded ? 'Collapse' : 'Browse'}
                          </Button>
                          {(cat.fileCount > 0 || selectedInCategory.size > 0) && (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => openConfirm(
                                `Purge ${cat.label}`,
                                `This will permanently delete all ${cat.fileCount} file(s) in ${cat.label}. This action cannot be undone.`,
                                async () => {
                                  setIsActionLoading(true);
                                  try {
                                    await purgeCategory(cat.key);
                                  } finally {
                                    setIsActionLoading(false);
                                  }
                                },
                                true
                              )}
                              className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Purge
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="p-4"
                        >
                          <div className="mb-4 flex items-center gap-3">
                            <input
                              type="text"
                              value={fileFilters[cat.key] || ''}
                              onChange={(e) => setFileFilters(prev => ({ ...prev, [cat.key]: e.target.value }))}
                              placeholder="Filter files..."
                              className="flex-1 max-w-xs px-3 py-1.5 text-sm rounded-[8px] bg-[var(--surface-container)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            />
                            {selectedInCategory.size > 0 && (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => openConfirm(
                                  `Delete Selected Files`,
                                  `This will permanently delete ${selectedInCategory.size} selected file(s) from ${cat.label}. This action cannot be undone.`,
                                  async () => {
                                    setIsActionLoading(true);
                                    try {
                                      await deleteSelectedFiles(cat.key);
                                    } finally {
                                      setIsActionLoading(false);
                                    }
                                  },
                                  true
                                )}
                                disabled={isActionLoading}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete Selected ({selectedInCategory.size})
                              </Button>
                            )}
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-[var(--text-tertiary)] font-mono text-[11px] uppercase tracking-[0.08em] border-b border-[var(--border-subtle)]">
                                  <th className="p-3 w-10"></th>
                                  <th className="p-3">Filename</th>
                                  <th className="p-3">Size</th>
                                  <th className="p-3">Modified</th>
                                  <th className="p-3">Session ID</th>
                                  <th className="p-3">Linked</th>
                                  <th className="p-3 w-28"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--border-subtle)]">
                                {isLoadingFiles ? (
                                  <tr>
                                    <td colSpan={7} className="py-12 text-center text-[var(--text-tertiary)]">
                                      <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                                      Loading files...
                                    </td>
                                  </tr>
                                ) : filteredFiles.length === 0 ? (
                                  <tr>
                                    <td colSpan={7} className="py-12 text-center text-[var(--text-tertiary)]">
                                      {files.length === 0 ? 'No files in this category.' : 'No files match the current filter.'}
                                    </td>
                                  </tr>
                                ) : (
                                  filteredFiles.map((file) => {
                                    const hashKey = `${cat.key}::${file.name}`;
                                    const hashInfo = fileHashes[hashKey];
                                    return (
                                      <Fragment key={file.name}>
                                        <tr className="hover:bg-[var(--surface-container-lowest)] transition-colors align-top">
                                          <td className="p-3">
                                            <input
                                              type="checkbox"
                                              checked={selectedInCategory.has(file.name)}
                                              onChange={() => toggleFileSelection(cat.key, file.name)}
                                              className="w-4 h-4 rounded border-[var(--border-default)] text-amber-500 focus:ring-amber-500 focus:ring-2"
                                            />
                                          </td>
                                          <td className="p-3 font-mono text-[var(--text-primary)]">{file.name}</td>
                                          <td className="p-3 font-mono text-[var(--text-secondary)]">{file.sizeFormatted}</td>
                                          <td className="p-3 text-[var(--text-secondary)] font-mono">{formatDate(file.mtime)}</td>
                                          <td className="p-3 font-mono text-[var(--text-secondary)]">{file.sessionId || '—'}</td>
                                          <td className="p-3">
                                            {file.linkedEvidenceId ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
                                                Evidence
                                              </span>
                                            ) : (
                                              <span className="text-[var(--text-tertiary)]">—</span>
                                            )}
                                          </td>
                                          <td className="p-3">
                                            <div className="flex items-center gap-1">
                                              <Button
                                                variant="ghost"
                                                size="xs"
                                                title="Compute SHA-256 / MD5"
                                                onClick={() => fetchFileHash(cat.key, file.name)}
                                                disabled={isActionLoading}
                                              >
                                                <Fingerprint className="w-3.5 h-3.5" />
                                              </Button>
                                              <Button
                                                variant="danger"
                                                size="xs"
                                                title="Delete file"
                                                onClick={() => openConfirm(
                                                  'Delete File',
                                                  `This will permanently delete ${file.name} from ${cat.label}. This action cannot be undone.`,
                                                  async () => {
                                                    if (cat.key === 'evidence' && file.linkedEvidenceId) {
                                                      await deleteEvidenceFile(file.linkedEvidenceId, cat.key, file.name);
                                                    } else {
                                                      await deleteSingleFile(cat.key, file.name);
                                                    }
                                                  },
                                                  true
                                                )}
                                                disabled={isActionLoading}
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </Button>
                                            </div>
                                          </td>
                                        </tr>
                                        {hashInfo && (
                                          <tr className="bg-[var(--surface-container-lowest)]/60">
                                            <td className="p-3"></td>
                                            <td colSpan={6} className="p-3">
                                              {hashInfo === 'loading' ? (
                                                <span className="text-[var(--text-tertiary)] text-xs">Computing hash...</span>
                                              ) : hashInfo === null ? (
                                                <span className="text-rose-600 text-xs">Hash unavailable</span>
                                              ) : (
                                                <div className="font-mono text-[11px] text-[var(--text-secondary)] space-y-1">
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-[var(--text-tertiary)] uppercase tracking-wider">SHA-256</span>
                                                    <span className="text-emerald-700">{hashInfo.sha256}</span>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-[var(--text-tertiary)] uppercase tracking-wider">MD5</span>
                                                    <span className="text-[var(--text-secondary)]">{hashInfo.md5}</span>
                                                  </div>
                                                </div>
                                              )}
                                            </td>
                                          </tr>
                                        )}
                                      </Fragment>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </DashboardCard>
                );
              })}
            </div>
          </PageSection>
        </motion.div>

        <motion.div variants={item}>
          <PageSection title="Danger Zone">
            <DashboardCard className="border-rose-500/20 bg-rose-500/5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-rose-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-rose-400">Purge All Session Data</h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    This will permanently delete ALL sandbox sessions, telemetry events, and session report files.
                    This action is irreversible and requires typed confirmation.
                  </p>
                  <div className="mt-4 flex items-center gap-4">
                    <input
                      type="text"
                      value={purgeConfirm}
                      onChange={(e) => setPurgeConfirm(e.target.value)}
                      placeholder="Type PURGE to confirm"
                      className="flex-1 max-w-md px-3 py-2 text-sm font-mono rounded-[8px] bg-[var(--surface-container)] border border-rose-500/30 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                      disabled={isActionLoading}
                    />
                    <Button
                      variant="danger"
                      size="md"
                      onClick={purgeAll}
                      disabled={isActionLoading || purgeConfirm !== 'PURGE'}
                    >
                      {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Purge All Session Data
                    </Button>
                  </div>
                </div>
              </div>
            </DashboardCard>
          </PageSection>
        </motion.div>
      </motion.div>

      <Modal
        isOpen={confirmDialog.isOpen}
        onClose={closeConfirm}
        title={confirmDialog.title}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-[var(--text-secondary)]">{confirmDialog.message}</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
            <Button variant="secondary" size="md" onClick={closeConfirm} disabled={isActionLoading}>
              Cancel
            </Button>
            <Button
              variant={confirmDialog.danger ? 'danger' : 'primary'}
              size="md"
              onClick={async () => {
                await confirmDialog.onConfirm();
                closeConfirm();
              }}
              disabled={isActionLoading}
            >
              {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}

export default StorageManagerPage;