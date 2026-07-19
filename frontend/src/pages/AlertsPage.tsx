import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  AlertTriangle,
  Search,
  Filter,
  MoreVertical,
  Zap,
  Loader2,
  X,
  CheckCircle,
  Eye,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { SeverityBadge, StatusBadge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { PageHeader, PageGrid } from '../layouts/PageContainer';
import { DashboardCard, DashboardStat } from '../components/enterprise/DashboardGrid';
import { formatRelativeTime } from '../utils/helpers';
import { cn } from '../design-system';
import { useAlertStore } from '../stores/alertStore';
import type { Alert } from '../types';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };

export function AlertsPage() {
  const {
    alerts,
    isLoading,
    error,
    pagination,
    fetchAlerts,
    acknowledgeAlert,
    resolveAlert,
  } = useAlertStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  useEffect(() => {
    fetchAlerts({ page: 1, limit: 50 });
  }, [fetchAlerts]);

  const handleAcknowledge = useCallback(async (id: string) => {
    await acknowledgeAlert(id);
    fetchAlerts({ page: 1, limit: 50 });
    setMenuOpen(null);
  }, [acknowledgeAlert, fetchAlerts]);

  const handleResolve = useCallback(async (id: string) => {
    await resolveAlert(id, {
      summary: 'Resolved from alert center',
      actionTaken: 'Reviewed and marked resolved',
    });
    fetchAlerts({ page: 1, limit: 50 });
    setMenuOpen(null);
  }, [resolveAlert, fetchAlerts]);

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = !searchTerm || alert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = severityFilter === 'all' || alert.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || alert.status === statusFilter;
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const highCount = alerts.filter(a => a.severity === 'high').length;
  const totalActive = alerts.filter(a => a.status !== 'resolved').length;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <PageHeader
        title="Alert Center"
        subtitle="Monitor and respond to security alerts"
      />

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
          <button onClick={() => fetchAlerts({ page: 1, limit: 50 })} className="ml-auto p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded">
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}

      <PageGrid columns={3}>
        <DashboardCard>
          <DashboardStat
            label="Critical Alerts"
            value={criticalCount}
            icon={<AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />}
            delta={criticalCount > 0 ? 'Requires immediate attention' : 'No critical alerts'}
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="High Priority"
            value={highCount}
            icon={<Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />}
            delta={highCount > 0 ? 'Review recommended' : 'No high priority alerts'}
          />
        </DashboardCard>
        <DashboardCard>
          <DashboardStat
            label="Active Alerts"
            value={totalActive}
            icon={<Bell className="w-5 h-5 text-amber-400" />}
            delta={`${pagination.total || 0} total alerts`}
          />
        </DashboardCard>
      </PageGrid>

      <Card>
        <div className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search alerts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <Select
              value={severityFilter}
              onChange={(val) => setSeverityFilter(val)}
              options={[
                { value: 'all', label: 'All Severity' },
                { value: 'critical', label: 'Critical' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
            />
            <Select
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'new', label: 'New' },
                { value: 'acknowledged', label: 'Acknowledged' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'resolved', label: 'Resolved' },
              ]}
            />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : filteredAlerts.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <CheckCircle className="w-12 h-12 mb-3 opacity-40 text-emerald-500" />
            <p className="text-lg font-medium">All clear</p>
            <p className="text-sm mt-1">No alerts match your current filters</p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {filteredAlerts.map((alert, index) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors relative"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    alert.severity === 'critical' && 'bg-red-100 dark:bg-red-900/20',
                    alert.severity === 'high' && 'bg-orange-100 dark:bg-orange-900/20',
                    alert.severity === 'medium' && 'bg-amber-100 dark:bg-amber-900/20',
                    alert.severity === 'low' && 'bg-emerald-100 dark:bg-emerald-900/20'
                  )}>
                    <AlertTriangle className={cn(
                      'w-5 h-5',
                      alert.severity === 'critical' && 'text-red-600 dark:text-red-400',
                      alert.severity === 'high' && 'text-orange-600 dark:text-orange-400',
                      alert.severity === 'medium' && 'text-amber-600 dark:text-amber-400',
                      alert.severity === 'low' && 'text-emerald-600 dark:text-emerald-400'
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 dark:text-white truncate">{alert.title}</p>
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{alert.alertId}</span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">{alert.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-slate-400 dark:text-slate-500">{formatRelativeTime(alert.detectedAt)}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 capitalize">{alert.source}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <SeverityBadge severity={alert.severity as any} size="sm" />
                    <StatusBadge status={alert.status} size="sm" />
                    <div className="relative">
                      <button
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                        onClick={() => setMenuOpen(menuOpen === alert.id ? null : alert.id)}
                      >
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </button>
                      {menuOpen === alert.id && (
                        <div className="absolute right-0 top-8 z-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[160px]">
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-2"
                            onClick={() => {
                              setSelectedAlert(alert);
                              setMenuOpen(null);
                            }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Details
                          </button>
                          {alert.status === 'new' && (
                            <button
                              className="w-full text-left px-3 py-2 text-sm hover:bg-amber-500/10 dark:hover:bg-amber-900/20 text-amber-400 flex items-center gap-2"
                              onClick={() => handleAcknowledge(alert.id)}
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Acknowledge
                            </button>
                          )}
                          {alert.status !== 'resolved' && (
                            <button
                              className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-2"
                              onClick={() => handleResolve(alert.id)}
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Resolve
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        isOpen={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        title="Alert Details"
        size="lg"
        className="dark:bg-slate-900"
      >
        {selectedAlert && (
          <div className="space-y-4 text-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">{selectedAlert.title}</h3>
                <p className="mt-1 text-slate-600 dark:text-slate-400">{selectedAlert.description}</p>
              </div>
              <div className="flex gap-2">
                <SeverityBadge severity={selectedAlert.severity as any} size="sm" />
                <StatusBadge status={selectedAlert.status} size="sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600 dark:text-slate-300">
              <div><span className="text-slate-400">Alert ID:</span> {selectedAlert.alertId}</div>
              <div><span className="text-slate-400">Source:</span> {selectedAlert.source}</div>
              <div><span className="text-slate-400">Detected:</span> {formatRelativeTime(selectedAlert.detectedAt)}</div>
              <div><span className="text-slate-400">Type:</span> {selectedAlert.type}</div>
            </div>
            {(selectedAlert.mitreTechniques?.length || 0) > 0 && (
              <div>
                <p className="mb-2 font-medium text-slate-700 dark:text-slate-200">MITRE Techniques</p>
                <div className="flex flex-wrap gap-2">
                  {selectedAlert.mitreTechniques?.map((technique) => (
                    <span key={technique} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-xs">
                      {technique}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </motion.div>
  );
}

export default AlertsPage;
