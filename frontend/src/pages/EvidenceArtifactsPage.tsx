import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  Eye,
  Copy,
  Download,
  CheckCircle,
  FileText,
  Database,
  Network,
  File,
  Activity,
  Hexagon,
  Shield,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { PageHeader, PageGrid } from '../layouts/PageContainer';
import { DashboardCard, DashboardStat } from '../components/enterprise/DashboardGrid';
import { formatDateTime, formatFileSize } from '../utils/helpers';
import { cn } from '../design-system';
import api from '../services/api';
import type { EvidenceArtifact, ForensicEvidenceDetail } from '../types/reports';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };

const categoryIcons: Record<string, typeof File> = {
  process_dump: Activity,
  file_sample: FileText,
  registry_snapshot: Database,
  network_capture: Network,
  memory_dump: Hexagon,
  screenshot: File,
  log_file: FileText,
  config_file: File,
  configuration: Database,
};

const categoryColors: Record<string, string> = {
  process_dump: 'bg-amber-500/15 text-amber-600 ',
  file_sample: 'bg-violet-100  text-violet-600  ',
  registry_snapshot: 'bg-amber-100  text-amber-600  ',
  network_capture: 'bg-blue-100  text-blue-600 ',
  memory_dump: 'bg-orange-100  text-orange-600  ',
  screenshot: 'bg-emerald-100  text-emerald-600  ',
  log_file: 'bg-pink-100  text-pink-600 ',
  config_file: 'bg-[var(--surface-container-low)]  text-[var(--text-secondary)] ',
  configuration: 'bg-indigo-100  text-indigo-600 ',
};

export function EvidenceArtifactsPage() {
  const [artifacts, setArtifacts] = useState<EvidenceArtifact[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<EvidenceArtifact | null>(null);
  const [detail, setDetail] = useState<ForensicEvidenceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [viewMode, setViewMode] = useState<'detail' | 'json'>('detail');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  const fetchArtifacts = async (params?: { page?: number; limit?: number; search?: string; category?: string; source?: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getEvidenceArtifacts({
        page: params?.page ?? pagination.page,
        limit: params?.limit ?? pagination.limit,
        search: params?.search ?? search,
        category: params?.category ?? categoryFilter,
        source: params?.source ?? sourceFilter,
      });
      if (response.success && response.data) {
        setArtifacts(response.data);
        setPagination(prev => ({
          ...prev,
          page: response.meta?.page ?? prev.page,
          total: response.meta?.total ?? prev.total,
        }));
      }
    } catch {
      setError('Failed to load evidence artifacts');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchArtifactDetail = async (id: string) => {
    setIsDetailLoading(true);
    setDetail(null);
    try {
      const response = await api.getEvidenceArtifact(id);
      if (response.success && response.data) {
        setDetail(response.data);
      }
    } catch {
      setError('Failed to load artifact details');
    } finally {
      setIsDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchArtifacts();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchArtifacts({ search, category: categoryFilter, source: sourceFilter, page: 1 });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, categoryFilter, sourceFilter]);

  const handleSelectArtifact = async (artifact: EvidenceArtifact) => {
    setSelectedArtifact(artifact);
    setViewMode('detail');
    await fetchArtifactDetail(artifact.id);
  };

  const handleCopyJson = () => {
    if (!detail) return;
    navigator.clipboard.writeText(JSON.stringify(detail.rawEvent || detail, null, 2));
  };

  const handleDownloadJson = () => {
    if (!detail) return;
    const blob = new Blob([JSON.stringify(detail.rawEvent || detail, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedArtifact?.name || 'artifact'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totalArtifacts = artifacts.length;
  const verifiedCount = artifacts.filter(a => a.blockchainVerified).length;
  const categoryCount = Object.keys(categoryColors).length;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <PageHeader
        title="Evidence Artifacts"
        subtitle="Browse forensic events extracted from reports"
      />

      <PageGrid columns={3}>
        <DashboardCard>
          <DashboardStat
            label="Total Artifacts"
            value={totalArtifacts}
            icon={<FileText className="w-5 h-5 text-amber-600 " />}
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Blockchain Verified"
            value={verifiedCount}
            icon={<Shield className="w-5 h-5 text-emerald-600  " />}
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Categories"
            value={categoryCount}
            icon={<Activity className="w-5 h-5 text-violet-600  " />}
          />
        </DashboardCard>
      </PageGrid>

      <Card>
        <div className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search artifacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--text-secondary)] " />
            <Select
              value={categoryFilter}
              onChange={(val) => { setCategoryFilter(val); fetchArtifacts({ category: val }); }}
              options={[
                { value: '', label: 'All Categories' },
                { value: 'process_dump', label: 'Process Dump' },
                { value: 'file_sample', label: 'File Sample' },
                { value: 'registry_snapshot', label: 'Registry Snapshot' },
                { value: 'network_capture', label: 'Network Capture' },
                { value: 'memory_dump', label: 'Memory Dump' },
                { value: 'screenshot', label: 'Screenshot' },
                { value: 'log_file', label: 'Log File' },
                { value: 'config_file', label: 'Config File' },
                { value: 'configuration', label: 'Configuration' },
              ]}
            />
            <Select
              value={sourceFilter}
              onChange={(val) => { setSourceFilter(val); fetchArtifacts({ source: val }); }}
              options={[
                { value: '', label: 'All Sources' },
                { value: 'process_activity', label: 'Process Activity' },
                { value: 'file_activity', label: 'File Activity' },
                { value: 'registry_activity', label: 'Registry Activity' },
                { value: 'network_activity', label: 'Network Activity' },
              ]}
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-red-500 mb-3">{error}</p>
                <Button variant="outline" size="sm" onClick={() => fetchArtifacts()}>Retry</Button>
              </div>
            ) : artifacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6">
                <FileText className="w-12 h-12 text-[var(--text-secondary)]   mb-3" />
                <p className="text-sm font-medium text-[var(--text-secondary)]  mb-1">No Evidence Artifacts Available</p>
                <p className="text-xs text-[var(--text-secondary)]  text-center max-w-md">
                  Artifacts are generated when the Sandbox Agent completes a simulation run. 
                  To populate this page: start an investigation → run a simulator in the sandbox → 
                  wait for the session to complete and sync evidence back to the server.
                </p>
                <div className="mt-4 text-xs text-[var(--text-secondary)]   bg-[var(--surface-container-low)]  rounded px-3 py-2">
                  Expected data path: <code className="text-amber-600 ">uploads/evidence/</code> and <code className="text-amber-600 ">uploads/sandbox-logs/</code>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)] ">
                {artifacts.map((artifact) => {
                  const Icon = categoryIcons[artifact.category] || File;
                  const colorClass = categoryColors[artifact.category] || categoryColors.configuration;
                  return (
                    <motion.div
                      key={artifact.id}
                      variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                      onClick={() => handleSelectArtifact(artifact)}
                      className={cn(
                        'px-5 py-4 hover:bg-[var(--surface-container-lowest)]  cursor-pointer transition-colors',
                        selectedArtifact?.id === artifact.id && 'bg-amber-500/10'
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', colorClass)}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-[var(--text-primary)]  truncate">{artifact.name}</p>
                            {artifact.blockchainVerified && <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-[var(--text-secondary)]   font-mono">{artifact.evidenceId}</span>
                            <span className="text-xs text-[var(--text-secondary)]  ">•</span>
                            <span className="text-xs text-[var(--text-secondary)]   capitalize">{artifact.category.replace('_', ' ')}</span>
                            <span className="text-xs text-[var(--text-secondary)]  ">•</span>
                            <span className="text-xs text-[var(--text-secondary)]  ">{formatDateTime(artifact.timestamp)}</span>
                            <span className="text-xs text-[var(--text-secondary)]  ">•</span>
                            <span className="text-xs text-[var(--text-secondary)]  ">{formatFileSize(artifact.fileSize)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {artifact.blockchainTxHash && (
                            <span className="w-2 h-2 bg-emerald-500 rounded-full" title="Blockchain verified" />
                          )}
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div>
          {selectedArtifact ? (
            <Card>
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[var(--text-primary)] ">Artifact Details</h3>
                  <div className="flex gap-1">
                    <Button variant={viewMode === 'detail' ? 'primary' : 'outline'} size="xs" onClick={() => setViewMode('detail')}>Detail</Button>
                    <Button variant={viewMode === 'json' ? 'primary' : 'outline'} size="xs" onClick={() => setViewMode('json')}>JSON</Button>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-[var(--surface-container-lowest)]  rounded-lg">
                  <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', categoryColors[selectedArtifact.category] || categoryColors.configuration)}>
                    {(() => {
                      const Icon = categoryIcons[selectedArtifact.category] || File;
                      return <Icon className="w-6 h-6" />;
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--text-primary)]  truncate">{selectedArtifact.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]   font-mono">{selectedArtifact.evidenceId}</p>
                  </div>
                </div>

                {isDetailLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full" />
                  </div>
                ) : viewMode === 'detail' && detail ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--text-secondary)] ">Source</span>
                      <span className="text-sm text-[var(--text-secondary)]  capitalize">{selectedArtifact.source}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--text-secondary)] ">Category</span>
                      <span className="text-sm text-[var(--text-secondary)]  capitalize">{selectedArtifact.category.replace('_', ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--text-secondary)] ">Timestamp</span>
                      <span className="text-sm text-[var(--text-secondary)] ">{formatDateTime(selectedArtifact.timestamp)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--text-secondary)] ">File Size</span>
                      <span className="text-sm text-[var(--text-secondary)] ">{formatFileSize(selectedArtifact.fileSize)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--text-secondary)] ">File Path</span>
                      <span className="text-xs text-[var(--text-secondary)]  font-mono break-all">{selectedArtifact.filePath}</span>
                    </div>
                    {selectedArtifact.blockchainVerified && (
                      <div className="flex justify-between">
                        <span className="text-sm text-[var(--text-secondary)] ">Blockchain</span>
                        <span className="text-xs text-emerald-600   font-mono break-all">{selectedArtifact.blockchainTxHash}</span>
                      </div>
                    )}
                    {detail.eventRelationships?.length > 0 && (
                      <div>
                        <p className="text-sm text-[var(--text-secondary)]  mb-2">Relationships ({detail.eventRelationships.length})</p>
                        <div className="space-y-1">
                          {detail.eventRelationships.slice(0, 5).map((rel, i) => (
                            <div key={i} className="p-2 bg-[var(--surface-container-lowest)]  rounded text-xs">
                              <span className="text-[var(--text-secondary)] ">{rel.relationshipType}:</span>
                              <span className="ml-1 text-[var(--text-secondary)] ">{rel.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {detail.timeline?.length > 0 && (
                      <div>
                        <p className="text-sm text-[var(--text-secondary)]  mb-2">Timeline Events ({detail.timeline.length})</p>
                        <div className="space-y-1">
                          {detail.timeline.slice(0, 5).map((evt, i) => (
                            <div key={i} className="p-2 bg-[var(--surface-container-lowest)]  rounded text-xs">
                              <span className="font-mono text-[var(--text-secondary)] ">{evt.timestamp}</span>
                              <span className="mx-1 text-[var(--text-secondary)] ">|</span>
                              <span className="text-[var(--text-secondary)] ">{evt.operation}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : viewMode === 'json' && detail ? (
                  <div className="relative">
                    <pre className="text-xs font-mono bg-slate-900  text-[var(--text-primary)]  p-3 rounded-lg max-h-[400px] overflow-auto">
                      {JSON.stringify(detail.rawEvent || detail, null, 2)}
                    </pre>
                  </div>
                ) : null}

                <div className="flex gap-2 pt-2 border-t border-[var(--border-subtle)] ">
                  <Button variant="outline" size="sm" className="flex-1" leftIcon={<Copy className="w-4 h-4" />} onClick={handleCopyJson}>
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" leftIcon={<Download className="w-4 h-4" />} onClick={handleDownloadJson}>
                    Download
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-full bg-[var(--surface-container-low)]  flex items-center justify-center mb-4">
                  <Hexagon className="w-8 h-8 text-[var(--text-secondary)] " />
                </div>
                <p className="text-sm text-[var(--text-secondary)] ">Select an artifact to view details</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default EvidenceArtifactsPage;
