import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  FileText,
  Download,
  Eye,
  Trash2,
  CheckCircle,
  Clock,
  AlertTriangle,
  Folder,
  File,
  Database,
  Network,
  Image,
  FileCode,
  Loader2,
  X,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { PageHeader, PageGrid } from '../layouts/PageContainer';
import { DashboardCard, DashboardStat } from '../components/enterprise/DashboardGrid';
import { formatRelativeTime, formatFileSize } from '../utils/helpers';
import { cn } from '../design-system';
import { useEvidenceStore } from '../stores/evidenceStore';

const typeIcons: Record<string, typeof File> = {
  email: FileText,
  malware_sample: FileCode,
  network_capture: Network,
  memory_dump: Database,
  file: File,
  log: FileText,
  screenshot: Image,
  registry_dump: FileCode,
  package: Folder,
  report: FileText,
};

const typeColors: Record<string, string> = {
  email: 'bg-blue-100  text-blue-600 ',
  malware_sample: 'bg-red-100  text-red-600  ',
  network_capture: 'bg-purple-100  text-purple-600 ',
  memory_dump: 'bg-orange-100  text-orange-600  ',
  file: 'bg-[var(--surface-container-low)]  text-[var(--text-secondary)] ',
  log: 'bg-amber-500/15 text-amber-600 ',
  screenshot: 'bg-green-100  text-green-600 ',
  registry_dump: 'bg-violet-100  text-violet-600  ',
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };

export function EvidenceExplorerPage() {
  const {
    evidence,
    isLoading,
    error,
    pagination,
    fetchEvidence,
    deleteEvidence,
    verifyEvidence,
  } = useEvidenceStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetchEvidence({ page: 1, limit: 50 });
  }, [fetchEvidence]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this evidence?')) return;
    await deleteEvidence(id);
    fetchEvidence({ page: 1, limit: 50 });
    if (selectedId === id) setSelectedId(null);
  }, [deleteEvidence, fetchEvidence, selectedId]);

  const handleVerify = useCallback(async (id: string) => {
    await verifyEvidence(id);
    fetchEvidence({ page: 1, limit: 50 });
  }, [verifyEvidence, fetchEvidence]);

  const filteredEvidence = evidence.filter((ev) => {
    const matchesSearch = !searchTerm || ev.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.evidenceId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || ev.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || ev.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const selectedEvidence = evidence.find(e => e.id === selectedId) || null;

  const totalSize = evidence.reduce((sum, e) => sum + (e.size || 0), 0);
  const verifiedCount = evidence.filter(e => e.status === 'verified').length;
  const analyzingCount = evidence.filter(e => e.status === 'analyzing').length;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <PageHeader
        title="Evidence Explorer"
        subtitle="Browse and manage forensic evidence"
      />

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50  border border-red-200  rounded-lg">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-700  ">{error}</span>
          <button onClick={() => fetchEvidence({ page: 1, limit: 50 })} className="ml-auto p-1 hover:bg-red-100  rounded">
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}

      <PageGrid columns={4}>
        <DashboardCard>
          <DashboardStat
            label="Total Evidence"
            value={evidence.length}
            icon={<FileText className="w-5 h-5 text-amber-600 " />}
            delta={`${pagination.total || 0} in database`}
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Verified"
            value={verifiedCount}
            icon={<CheckCircle className="w-5 h-5 text-emerald-600  " />}
            delta={verifiedCount > 0 ? 'Chain of custody intact' : 'No verified evidence'}
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Analyzing"
            value={analyzingCount}
            icon={<Clock className="w-5 h-5 text-violet-600  " />}
            delta="In progress"
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Total Size"
            value={formatFileSize(totalSize)}
            icon={<Database className="w-5 h-5 text-amber-600  " />}
            delta="Across all evidence"
          />
        </DashboardCard>
      </PageGrid>

      <Card>
        <div className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search evidence..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--text-secondary)] " />
            <Select
              value={typeFilter}
              onChange={(val) => setTypeFilter(val)}
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'email', label: 'Email' },
                { value: 'malware_sample', label: 'Malware Sample' },
                { value: 'network_capture', label: 'Network Capture' },
                { value: 'memory_dump', label: 'Memory Dump' },
                { value: 'log', label: 'Log' },
                { value: 'screenshot', label: 'Screenshot' },
                { value: 'registry_dump', label: 'Registry Dump' },
              ]}
            />
            <Select
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'ready', label: 'Ready' },
                { value: 'analyzing', label: 'Analyzing' },
                { value: 'verified', label: 'Verified' },
              ]}
            />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--text-secondary)] " />
        </div>
      ) : filteredEvidence.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-[var(--text-secondary)]">
            <FileText className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-lg font-medium">No evidence found</p>
            <p className="text-sm mt-1">Evidence collected from sandbox sessions will appear here</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <div className="divide-y divide-[var(--border-subtle)]  max-h-[500px] overflow-y-auto">
                {filteredEvidence.map((ev) => {
                  const Icon = typeIcons[ev.type] || File;
                  const colorClass = typeColors[ev.type] || 'bg-[var(--surface-container-low)]  text-[var(--text-secondary)] ';

                  return (
                    <motion.div
                      key={ev.id}
                      variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                      onClick={() => setSelectedId(ev.id)}
                      className={cn(
                        'px-5 py-4 hover:bg-[var(--surface-container-lowest)]  cursor-pointer transition-colors',
                        selectedId === ev.id && 'bg-amber-500/10'
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', colorClass)}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-[var(--text-primary)]  truncate">{ev.name}</p>
                            {ev.status === 'verified' && <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-[var(--text-secondary)]   font-mono">{ev.evidenceId}</span>
                            <span className="text-xs text-[var(--text-secondary)]  ">•</span>
                            <span className="text-xs text-[var(--text-secondary)]   capitalize">{ev.type.replace('_', ' ')}</span>
                            <span className="text-xs text-[var(--text-secondary)]  ">•</span>
                            <span className="text-xs text-[var(--text-secondary)]  ">{formatFileSize(ev.size ?? ev.fileSize ?? 0)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={ev.status} size="sm" />
                          {ev.status !== 'verified' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleVerify(ev.id); }}
                              className="p-1.5 rounded hover:bg-emerald-50  text-emerald-600   transition-colors"
                              title="Verify"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(ev.id); }}
                            className="p-1.5 rounded hover:bg-red-50  text-red-600   transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </Card>
          </div>

          <div>
            {selectedEvidence ? (
              <Card>
                <div className="p-5">
                  <h3 className="font-semibold text-[var(--text-primary)]  mb-4">Evidence Details</h3>
                  <div className="flex items-center gap-4 p-4 bg-[var(--surface-container-lowest)]  rounded-lg mb-4">
                    <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', typeColors[selectedEvidence.type] || 'bg-[var(--surface-container-low)]')}>
                      {(() => {
                        const Icon = typeIcons[selectedEvidence.type] || File;
                        return <Icon className="w-6 h-6" />;
                      })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--text-primary)]  truncate">{selectedEvidence.name}</p>
                      <p className="text-xs text-[var(--text-secondary)]   font-mono">{selectedEvidence.evidenceId}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--text-secondary)] ">Type</span>
                      <span className="text-sm text-[var(--text-secondary)]  capitalize">{selectedEvidence.type.replace('_', ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--text-secondary)] ">Size</span>
                      <span className="text-sm text-[var(--text-secondary)] ">{formatFileSize(selectedEvidence.size ?? selectedEvidence.fileSize ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--text-secondary)] ">Status</span>
                      <StatusBadge status={selectedEvidence.status} size="sm" />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--text-secondary)] ">Investigation</span>
                      <span className="text-sm text-[var(--text-secondary)]  font-mono">{selectedEvidence.investigationId || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--text-secondary)] ">SHA-256</span>
                      <span className="text-xs text-[var(--text-secondary)]  font-mono truncate max-w-[150px]" title={selectedEvidence.sha256}>
                        {selectedEvidence.sha256 ? selectedEvidence.sha256.slice(0, 16) + '...' : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--text-secondary)] ">Collected</span>
                      <span className="text-sm text-[var(--text-secondary)] ">{selectedEvidence.collectedAt ? formatRelativeTime(selectedEvidence.collectedAt) : 'N/A'}</span>
                    </div>
                  </div>

                  {selectedEvidence.tags && selectedEvidence.tags.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm text-[var(--text-secondary)]  mb-2">Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedEvidence.tags.map((tag: string) => (
                          <span key={tag} className="px-2 py-1 text-xs bg-[var(--surface-container-low)]  text-[var(--text-secondary)]  rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4 border-t border-[var(--border-subtle)] ">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Eye className="w-4 h-4" />
                      View
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card>
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 rounded-full bg-[var(--surface-container-low)]  flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-[var(--text-secondary)] " />
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] ">Select an evidence item to view details</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default EvidenceExplorerPage;
