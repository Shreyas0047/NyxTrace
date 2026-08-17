import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Filter,
  FileText,
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
  ShieldCheck,
  Anchor,
  Undo2,
  Satellite,
  FlaskConical,
  Globe,
  Plus,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';
import { PageHeader, PageGrid } from '../layouts/PageContainer';
import { DashboardCard, DashboardStat } from '../components/enterprise/DashboardGrid';
import { formatRelativeTime, formatFileSize } from '../utils/helpers';
import { cn } from '../design-system';
import { useEvidenceStore } from '../stores/evidenceStore';
import { useAuthStore } from '../stores/authStore';
import { EvidenceUploadModal } from '../components/evidence/EvidenceUploadModal';
import { config } from '../config';

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
  executable: FileCode,
  document: FileText,
  url: Globe,
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
    anchorEvidence,
    simulateTamper,
    restoreEvidence,
    recordTamperOnChain,
  } = useEvidenceStore();
  const { user } = useAuthStore();

  const isDemoAdmin =
    config.demoMode &&
    (user?.role === 'admin' || user?.role === 'super_admin');

  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEvidence({
        page: 1,
        limit: 50,
        type: typeFilter === 'all' ? undefined : typeFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [fetchEvidence, typeFilter, statusFilter]);

  const applyFilters = useCallback(() => {
    fetchEvidence({
      page: 1,
      limit: 50,
      type: typeFilter === 'all' ? undefined : typeFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
    });
  }, [fetchEvidence, typeFilter, statusFilter]);

  const handleOpenCustody = useCallback((evidenceId: string) => {
    navigate(`/custody?evidenceId=${encodeURIComponent(evidenceId)}`);
  }, [navigate]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this evidence?')) return;
    await deleteEvidence(id);
    applyFilters();
    if (selectedId === id) setSelectedId(null);
  }, [deleteEvidence, applyFilters, selectedId]);

  const handleVerify = useCallback(async (id: string) => {
    await verifyEvidence(id);
    applyFilters();
  }, [verifyEvidence, applyFilters]);

  const handleAnchor = useCallback(async (id: string) => {
    await anchorEvidence(id);
    applyFilters();
  }, [anchorEvidence, applyFilters]);

  const handleSimulateTamper = useCallback(async (id: string) => {
    if (!confirm('Simulate tampering with this evidence file? The original is backed up and can be restored.')) return;
    await simulateTamper(id);
  }, [simulateTamper]);

  const handleRestore = useCallback(async (id: string) => {
    if (!confirm('Restore the original evidence file from the demo backup?')) return;
    await restoreEvidence(id);
  }, [restoreEvidence]);

  const handleRecordTamperOnChain = useCallback(async (id: string) => {
    if (!confirm('Broadcast a CriticalAuditEvent to the blockchain recording this tamper?')) return;
    await recordTamperOnChain(id);
  }, [recordTamperOnChain]);

  const selectedEvidence = evidence.find(e => e.id === selectedId) || null;

  const totalSize = evidence.reduce((sum, e) => sum + (e.size || 0), 0);
  const verifiedCount = evidence.filter(e => e.status === 'verified').length;
  const analyzingCount = evidence.filter(e => e.status === 'analyzing').length;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <PageHeader
        title="Evidence Explorer"
        subtitle="Browse and manage forensic evidence"
        actions={
          <Button size="sm" onClick={() => setShowUploadModal(true)}>
            <Plus className="w-4 h-4" />
            Add Evidence
          </Button>
        }
      />

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50  border border-red-200  rounded-lg">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-700  ">{error}</span>
          <button onClick={applyFilters} className="ml-auto p-1 hover:bg-red-100  rounded">
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}

      {isDemoAdmin && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs font-medium">
          <FlaskConical className="w-4 h-4 flex-shrink-0" />
          Demo Mode — tamper simulation enabled (admin)
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
          <div className="flex items-center gap-2 ml-auto">
            <Filter className="w-4 h-4 text-[var(--text-secondary)] " />
            <Select
              value={typeFilter}
              onChange={(val) => setTypeFilter(val)}
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'email', label: 'Email' },
                { value: 'malware_sample', label: 'Malware Sample' },
                { value: 'executable', label: 'Executable' },
                { value: 'document', label: 'Document' },
                { value: 'url', label: 'URL' },
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
                { value: 'tampered', label: 'Tampered' },
              ]}
            />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--text-secondary)] " />
        </div>
      ) : evidence.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-[var(--text-secondary)]">
            <FileText className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-lg font-medium">No evidence found</p>
            <p className="text-sm mt-1">
              {typeFilter !== 'all' || statusFilter !== 'all'
                ? 'Nothing matches your filters — try clearing them'
                : 'Evidence collected from sandbox sessions will appear here'}
            </p>
          </div>
        </Card>
      ) : (
        <div className={cn('grid grid-cols-1 gap-6', selectedEvidence && 'lg:grid-cols-3')}>
          <div className={cn(selectedEvidence && 'lg:col-span-2')}>
            <Card>
              <div className="divide-y divide-[var(--border-subtle)]  max-h-[500px] overflow-y-auto">
                {evidence.map((ev) => {
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
                            {ev.status === 'tampered' && <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-[var(--text-secondary)]   font-mono">{ev.evidenceId}</span>
                            <span className="text-xs text-[var(--text-secondary)]  ">•</span>
                            <span className="text-xs text-[var(--text-secondary)]   capitalize">{ev.type.replace('_', ' ')}</span>
                            <span className="text-xs text-[var(--text-secondary)]  ">•</span>
                            {ev.type === 'url' ? (
                              <span className="text-xs text-[var(--text-secondary)]  font-mono truncate max-w-[140px]">{ev.url || ev.filePath}</span>
                            ) : (
                              <span className="text-xs text-[var(--text-secondary)]  ">{formatFileSize(ev.size ?? ev.fileSize ?? 0)}</span>
                            )}
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
                          {isDemoAdmin && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleAnchor(ev.id); }}
                                className="p-1.5 rounded hover:bg-amber-50  text-amber-600   transition-colors"
                                title="Anchor on blockchain"
                              >
                                <Anchor className="w-4 h-4" />
                              </button>
                              {ev.status !== 'tampered' ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleSimulateTamper(ev.id); }}
                                  className="p-1.5 rounded hover:bg-rose-50  text-rose-600   transition-colors"
                                  title="Simulate tamper"
                                >
                                  <AlertTriangle className="w-4 h-4" />
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleRecordTamperOnChain(ev.id); }}
                                    className="p-1.5 rounded hover:bg-violet-50  text-violet-600   transition-colors"
                                    title="Record tamper on blockchain"
                                  >
                                    <Satellite className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleRestore(ev.id); }}
                                    className="p-1.5 rounded hover:bg-emerald-50  text-emerald-600   transition-colors"
                                    title="Restore original file"
                                  >
                                    <Undo2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenCustody(ev.evidenceId); }}
                            className="p-1.5 rounded hover:bg-amber-50  text-amber-600   transition-colors"
                            title="View custody chain"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>
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

          {selectedEvidence && (
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
                    {selectedEvidence.type === 'url' && (
                      <div className="flex justify-between">
                        <span className="text-sm text-[var(--text-secondary)] ">URL</span>
                        <span className="text-xs text-[var(--text-secondary)]  font-mono truncate max-w-[180px]" title={selectedEvidence.url || selectedEvidence.filePath}>
                          {selectedEvidence.url || selectedEvidence.filePath}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--text-secondary)] ">Size</span>
                      {selectedEvidence.type === 'url' ? (
                        <span className="text-sm text-[var(--text-secondary)] ">—</span>
                      ) : (
                        <span className="text-sm text-[var(--text-secondary)] ">{formatFileSize(selectedEvidence.size ?? selectedEvidence.fileSize ?? 0)}</span>
                      )}
                    </div>
                    {selectedEvidence.simulatorHint && (
                      <div className="flex justify-between">
                        <span className="text-sm text-[var(--text-secondary)] ">Preferred Sample</span>
                        <span className="text-sm text-[var(--text-secondary)]  font-mono">{selectedEvidence.simulatorHint}</span>
                      </div>
                    )}
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
                    {selectedEvidence.tamperedHash && (
                      <div className="flex justify-between">
                        <span className="text-sm text-rose-600  ">Tampered SHA-256</span>
                        <span className="text-xs text-rose-600  font-mono truncate max-w-[150px]" title={selectedEvidence.tamperedHash}>
                          {selectedEvidence.tamperedHash.slice(0, 16) + '...'}
                        </span>
                      </div>
                    )}
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

                  {selectedEvidence.investigationId && (
                    <div className="flex gap-2 pt-4 border-t border-[var(--border-subtle)] ">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() =>
                          navigate(
                            `/sandbox?investigationId=${encodeURIComponent(selectedEvidence.investigationId!)}&evidenceId=${encodeURIComponent(selectedEvidence.id)}`
                          )
                        }
                      >
                        <FlaskConical className="w-4 h-4" />
                        Analyze in Sandbox
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            )}
        </div>
      )}

      <EvidenceUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploaded={applyFilters}
      />
    </motion.div>
  );
}

export default EvidenceExplorerPage;
