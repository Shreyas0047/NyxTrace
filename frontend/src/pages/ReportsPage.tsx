import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  Clock,
  AlertTriangle,
  Shield,
  Activity,
  Hash,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { PageHeader, PageGrid } from '../layouts/PageContainer';
import { DashboardCard, DashboardStat } from '../components/enterprise/DashboardGrid';
import { formatDateTime, formatDuration, formatFileSize } from '../utils/helpers';
import { cn } from '../design-system';
import { useReportsStore } from '../stores/reportsStore';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  high: 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
  medium: 'bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
  low: 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
  info: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
};

const categoryIcons: Record<string, typeof Activity> = {
  process: Activity,
  file: FileText,
  registry: Hash,
  network: Activity,
  behavior: Shield,
  system: AlertTriangle,
};

const categoryColors: Record<string, string> = {
  process: 'bg-amber-500/15 text-amber-400',
  file: 'bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',
  registry: 'bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
  network: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  behavior: 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
  system: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400',
};

type DetailTab = 'timeline' | 'events' | 'suspicious' | 'summary';

export function ReportsPage() {
  const {
    reports, currentReport, isLoading, isDetailLoading, error,
    pagination, filters,
    fetchReports, fetchReportById, exportReport, setFilters, clearCurrentReport,
  } = useReportsStore();

  const [search, setSearch] = useState('');
  const [detailTab, setDetailTab] = useState<DetailTab>('timeline');
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== filters.search) {
        setFilters({ search });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleViewReport = async (id: string) => {
    await fetchReportById(id);
    setShowDetail(true);
  };

  const handleCloseDetail = () => {
    setShowDetail(false);
    clearCurrentReport();
  };

  const totalEvents = reports.reduce((acc, r) => acc + r.totalEvents, 0);
  const criticalCount = reports.reduce((acc, r) => acc + (r.severityCounts?.critical || 0), 0);
  const suspiciousCount = reports.filter(r => r.blockchainVerified).length;

  const eventCategories = ['process', 'file', 'registry', 'network', 'behavior', 'system'];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <PageHeader
        title="Forensic Reports"
        subtitle="View and analyze malware execution reports"
      />

      <PageGrid columns={4}>
        <DashboardCard>
          <DashboardStat
            label="Total Reports"
            value={reports.length}
            icon={<FileText className="w-5 h-5 text-amber-400" />}
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Total Events"
            value={totalEvents}
            icon={<Activity className="w-5 h-5 text-violet-600 dark:text-violet-400" />}
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Critical Alerts"
            value={criticalCount}
            icon={<AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />}
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Blockchain Verified"
            value={suspiciousCount}
            icon={<Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          />
        </DashboardCard>
      </PageGrid>

      <Card>
        <div className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search reports..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <Select
              value={filters.simulator}
              onChange={(val) => { setFilters({ simulator: val }); fetchReports({ simulator: val }); }}
              options={[
                { value: '', label: 'All Simulators' },
                { value: 'ransomware', label: 'Ransomware' },
                { value: 'spyware', label: 'Spyware' },
                { value: 'trojan', label: 'Trojan' },
                { value: 'botnet', label: 'Botnet' },
                { value: 'credential-stealer', label: 'Credential Stealer' },
              ]}
            />
            <Select
              value={filters.severity}
              onChange={(val) => { setFilters({ severity: val }); fetchReports({ severity: val }); }}
              options={[
                { value: '', label: 'All Severity' },
                { value: 'critical', label: 'Critical' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
                { value: 'info', label: 'Info' },
              ]}
            />
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-red-500 mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchReports()}>Retry</Button>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No reports found. Run a simulation to generate reports.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {reports.map((report, index) => (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleViewReport(report.id)}
                className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 dark:text-white truncate">{report.simulatorName}</p>
                      {report.blockchainVerified && <Shield className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{report.reportFile}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{formatDateTime(report.generatedAt)}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{report.totalEvents} events</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{formatDuration(report.executionTime)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {eventCategories.map((cat) => {
                      const count = report.categoryCounts?.[cat as keyof typeof report.categoryCounts] || 0;
                      if (count === 0) return null;
                      const Icon = categoryIcons[cat] || Activity;
                      return (
                        <span key={cat} className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs', categoryColors[cat])}>
                          <Icon className="w-3 h-3" />
                          {count}
                        </span>
                      );
                    })}
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewReport(report.id); }}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => fetchReports({ page: pagination.page - 1 })}>Previous</Button>
          <span className="text-sm text-slate-500">Page {pagination.page} of {pagination.totalPages}</span>
          <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchReports({ page: pagination.page + 1 })}>Next</Button>
        </div>
      )}

      <Modal isOpen={showDetail} onClose={handleCloseDetail} title="Report Details" size="xl">
        {isDetailLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
          </div>
        ) : currentReport ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <FileText className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white">{currentReport.simulatorName}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{currentReport.reportFile}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" leftIcon={<Download className="w-4 h-4" />} onClick={() => exportReport(currentReport.id, 'pdf')}>PDF</Button>
                <Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />} onClick={() => exportReport(currentReport.id, 'json')}>JSON</Button>
                <Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />} onClick={() => exportReport(currentReport.id, 'text')}>TXT</Button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {Object.entries(currentReport.severityCounts || {}).map(([level, count]) => (
                <div key={level} className={cn('p-3 rounded-lg', severityColors[level] || severityColors.info)}>
                  <p className="text-xs font-medium uppercase">{level}</p>
                  <p className="text-2xl font-bold mt-1">{count}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2 border-b border-slate-100 dark:border-slate-700">
              {(['timeline', 'events', 'suspicious', 'summary'] as DetailTab[]).map((tab) => (
                <button key={tab} onClick={() => setDetailTab(tab)}
                  className={cn('px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors',
                    detailTab === tab
                      ? 'border-amber-500 text-amber-400'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  )}>
                  {tab}
                </button>
              ))}
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {detailTab === 'timeline' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-500 dark:text-slate-400">Start: {formatDateTime(currentReport.executionSummary?.startTime || currentReport.generatedAt)}</span>
                    <span className="text-slate-400">→</span>
                    <span className="text-slate-500 dark:text-slate-400">End: {formatDateTime(currentReport.executionSummary?.endTime || currentReport.generatedAt)}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500 dark:text-slate-400">Duration: {formatDuration(currentReport.executionTime)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Status: </span>
                    <span className={cn('font-medium',
                      currentReport.executionSummary?.completionStatus === 'completed' ? 'text-emerald-600' :
                      currentReport.executionSummary?.completionStatus === 'failed' ? 'text-red-600' :
                      'text-amber-600'
                    )}>
                      {currentReport.executionSummary?.completionStatus || 'completed'}
                    </span>
                  </div>
                </div>
              )}

              {detailTab === 'events' && (
                <div className="space-y-2">
                  {eventCategories.map((cat) => {
                    const events = currentReport[`${cat}Activity` as keyof typeof currentReport] as unknown[] || [];
                    if (events.length === 0) return null;
                    return (
                      <div key={cat}>
                        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase mb-2">{cat} ({events.length})</p>
                        {events.slice(0, 5).map((evt: unknown) => {
                          const e = evt as { operation?: string; timestamp?: string; severity?: string; details?: Record<string, unknown> };
                          return (
                            <div key={(e.timestamp || '') + (e.operation || '')} className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded text-xs mb-1">
                              <span className="text-slate-400 font-mono">{e.timestamp}</span>
                              <span className="mx-2 text-slate-300">|</span>
                              <span className="text-slate-700 dark:text-slate-300">{e.operation}</span>
                              {e.severity && <span className={cn('ml-2 px-1.5 py-0.5 rounded text-xs font-medium', severityColors[e.severity])}>{e.severity}</span>}
                            </div>
                          );
                        })}
                        {events.length > 5 && <p className="text-xs text-slate-400">+{events.length - 5} more events</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              {detailTab === 'suspicious' && (
                <div className="space-y-2">
                  {currentReport.suspiciousActivities?.length === 0 && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No suspicious activities detected</p>
                  )}
                  {currentReport.suspiciousActivities?.map((act, i) => (
                    <div key={i} className={cn('p-3 rounded-lg border', severityColors[act.severity] || severityColors.info)}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-500">{act.timestamp}</span>
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', severityColors[act.severity])}>{act.severity}</span>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{act.description}</p>
                      {act.indicators?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {act.indicators.map((ind, j) => (
                            <span key={j} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded text-xs">{ind.type}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {detailTab === 'summary' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Risk Score</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{currentReport.behaviorSummary?.overallRiskScore ?? 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Events Collected</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{currentReport.executionSummary?.eventsCollected ?? currentReport.totalEvents}</p>
                    </div>
                  </div>
                  {currentReport.collectionIntegrity && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Collection Integrity</p>
                      <p className="text-xs font-mono text-slate-700 dark:text-slate-300">{currentReport.collectionIntegrity.hashAlgorithm}: {currentReport.collectionIntegrity.hash}</p>
                      <div className="flex gap-3 mt-1">
                        <span className="text-xs text-slate-500">{currentReport.collectionIntegrity.fileCount} files</span>
                        <span className="text-xs text-slate-500">{formatFileSize(currentReport.collectionIntegrity.totalSize)}</span>
                        <span className={cn('text-xs font-medium', currentReport.collectionIntegrity.verified ? 'text-emerald-600' : 'text-slate-400')}>
                          {currentReport.collectionIntegrity.verified ? 'Verified' : 'Unverified'}
                        </span>
                      </div>
                    </div>
                  )}
                  {currentReport.hash && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">File Hashes</p>
                      {currentReport.hash.sha256 && <p className="text-xs font-mono text-slate-700 dark:text-slate-300">SHA256: {currentReport.hash.sha256}</p>}
                      {currentReport.hash.md5 && <p className="text-xs font-mono text-slate-700 dark:text-slate-300">MD5: {currentReport.hash.md5}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-slate-500 dark:text-slate-400">Failed to load report details</p>
          </div>
        )}
      </Modal>
    </motion.div>
  );
}

export default ReportsPage;
