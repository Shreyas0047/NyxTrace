/**
 * Reconciliation Panel
 * Displays and manages blockchain reconciliation issues
 */

import React, { useEffect, useState } from 'react';
import { useBlockchainStore } from '../../stores/blockchainStore';

interface ReconciliationIssue {
  id: string;
  type: 'hash_mismatch' | 'orphan_record' | 'sync_failure' | 'transaction_failure' | 'drift_detected';
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidenceId?: string;
  description: string;
  detectedAt: string;
  resolved: boolean;
  resolution?: string;
}

export const ReconciliationPanel: React.FC = () => {
  const {
    reconciliationIssues,
    reconciliationStats,
    fetchReconciliationIssues,
    fetchReconciliationStats,
    resolveReconciliationIssue,
    runReconciliation,
    isLoading,
  } = useBlockchainStore();

  const [selectedSeverity, setSelectedSeverity] = useState<string>('');
  const [showResolved, setShowResolved] = useState(false);
  const [resolveModal, setResolveModal] = useState<ReconciliationIssue | null>(null);
  const [resolutionText, setResolutionText] = useState('');

  useEffect(() => {
    fetchReconciliationIssues(selectedSeverity || undefined);
    fetchReconciliationStats();
  }, [fetchReconciliationIssues, fetchReconciliationStats, selectedSeverity]);

  const handleResolve = async () => {
    if (resolveModal && resolutionText) {
      await resolveReconciliationIssue(resolveModal.id, resolutionText);
      setResolveModal(null);
      setResolutionText('');
      fetchReconciliationIssues(selectedSeverity || undefined);
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'hash_mismatch':
        return 'Hash Mismatch';
      case 'orphan_record':
        return 'Orphan Record';
      case 'sync_failure':
        return 'Sync Failure';
      case 'transaction_failure':
        return 'Transaction Failure';
      case 'drift_detected':
        return 'Integrity Drift';
      default:
        return type;
    }
  };

  const filteredIssues = showResolved
    ? reconciliationIssues
    : reconciliationIssues.filter(i => !i.resolved);

  return (
    <div className="bg-[var(--surface-container-low)]  rounded-lg shadow-md border border-[var(--border-subtle)] ">
      {/* Header */}
      <div className="border-b border-[var(--border-subtle)]  p-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Blockchain Reconciliation
            </h2>
            <p className="text-sm text-[var(--text-secondary)]  mt-1">
              Detect and resolve inconsistencies in blockchain records
            </p>
          </div>
          <button
            onClick={() => runReconciliation()}
            disabled={isLoading}
            className="px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 disabled:opacity-50 text-sm"
          >
            Run Full Reconciliation
          </button>
        </div>
      </div>

      {/* Stats */}
      {reconciliationStats && (
        <div className="border-b border-[var(--border-subtle)]  p-4 bg-[var(--surface-container-low)] ">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{reconciliationStats.totalIssues}</div>
              <div className="text-xs text-[var(--text-secondary)] ">Total Issues</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600 ">{reconciliationStats.bySeverity?.critical ?? 0}</div>
              <div className="text-xs text-[var(--text-secondary)] ">Critical</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600 ">{reconciliationStats.bySeverity?.high ?? 0}</div>
              <div className="text-xs text-[var(--text-secondary)] ">High</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">{reconciliationStats.resolvedToday}</div>
              <div className="text-xs text-[var(--text-secondary)] ">Resolved Today</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-cyan-600 ">{reconciliationStats.autoResolved}</div>
              <div className="text-xs text-[var(--text-secondary)] ">Auto-Resolved</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="p-4 border-b border-[var(--border-subtle)] ">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm text-[var(--text-secondary)] ">Severity Filter:</label>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="border border-[var(--border-default)]  bg-[var(--surface-container-low)]  rounded-md px-3 py-1 text-sm text-[var(--text-primary)]"
            >
              <option value="">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showResolved"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="showResolved" className="text-sm text-[var(--text-secondary)] ">
              Show Resolved
            </label>
          </div>
        </div>
      </div>

      {/* Issues List */}
      <div className="p-4">
        {filteredIssues.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)] ">
            No reconciliation issues found
          </div>
        ) : (
          <div className="space-y-3">
            {filteredIssues.map((issue) => (
              <div
                key={issue.id}
                className={`border rounded-lg p-4 ${
                  issue.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                  issue.severity === 'high' ? 'bg-orange-500/10 border-orange-500/30' :
                  issue.severity === 'medium' ? 'bg-yellow-500/10 border-yellow-500/30' :
                  'bg-[var(--surface-container-low)]  border-[var(--border-default)] '
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded uppercase ${
                        issue.severity === 'critical' ? 'bg-red-500/20 text-red-600 ' :
                        issue.severity === 'high' ? 'bg-orange-500/20 text-orange-600 ' :
                        issue.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-600 text-[var(--text-secondary)] '
                      }`}>
                        {issue.severity}
                      </span>
                      <span className="text-sm font-medium text-white">{getTypeLabel(issue.type)}</span>
                      {issue.resolved && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-500/20 text-green-400">
                          Resolved
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] ">{issue.description}</p>
                    {issue.evidenceId && (
                      <p className="text-xs mt-1 text-[var(--text-secondary)] ">Evidence ID: {issue.evidenceId}</p>
                    )}
                    <p className="text-xs mt-1 text-[var(--text-secondary)]">
                      Detected: {new Date(issue.detectedAt).toLocaleString()}
                    </p>
                    {issue.resolution && (
                      <p className="text-sm mt-2 font-medium text-[var(--text-secondary)] ">Resolution: {issue.resolution}</p>
                    )}
                  </div>
                  {!issue.resolved && (
                    <button
                      onClick={() => setResolveModal(issue)}
                      className="ml-4 px-3 py-1 bg-[var(--surface-container-low)]  border border-[var(--border-default)]  rounded text-sm text-[var(--text-primary)] hover:bg-slate-600"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resolve Modal */}
      {resolveModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[var(--surface-container-low)]  rounded-lg p-6 w-full max-w-md border border-[var(--border-subtle)] ">
            <h3 className="text-lg font-medium mb-4 text-white">Resolve Issue</h3>
            <p className="text-sm text-[var(--text-secondary)]  mb-4">
              Issue: {resolveModal.description}
            </p>
            <textarea
              value={resolutionText}
              onChange={(e) => setResolutionText(e.target.value)}
              placeholder="Enter resolution description..."
              className="w-full border border-[var(--border-default)]  bg-[var(--surface-container-low)]  rounded-md p-3 text-sm text-[var(--text-primary)] mb-4"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setResolveModal(null);
                  setResolutionText('');
                }}
                className="px-4 py-2 border border-[var(--border-default)]  rounded-md text-sm text-[var(--text-secondary)]  hover:bg-[var(--surface-container-low)] "
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={!resolutionText}
                className="px-4 py-2 bg-cyan-600 text-white rounded-md text-sm hover:bg-cyan-700 disabled:opacity-50"
              >
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReconciliationPanel;
