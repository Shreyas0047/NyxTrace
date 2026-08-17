/**
 * Chain of Custody Page
 * Evidence custody chains, tamper investigations and verification reports.
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Fingerprint, ShieldCheck, ShieldAlert, Link2, ArrowRightLeft,
  FileText, FileDown, RefreshCw, Search, ShieldQuestion, Box,
} from 'lucide-react';
import { cn, buttonVariants, cardVariants } from '../design-system';
import { formatDateTime, truncate } from '../utils/helpers';
import { useCustodyStore } from '../stores/custodyStore';
import { useAuthStore } from '../stores/authStore';
import type { CustodyEvent } from '../types/custody';

const EVENT_TYPES = [
  'evidence_created', 'evidence_uploaded', 'verification_registered',
  'blockchain_synced', 'investigation_linked', 'analyst_accessed',
  'integrity_checked', 'verification_completed', 'verification_failed',
  'tamper_detected', 'evidence_modified', 'evidence_exported',
  'evidence_archived', 'custody_transferred', 'blockchain_confirmed',
  'reconciliation_completed',
] as const;

const INTEGRITY_STYLES: Record<string, string> = {
  verified: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
  pending_verification: 'text-amber-300 bg-amber-500/10 border-amber-500/25',
  syncing: 'text-sky-300 bg-sky-500/10 border-sky-500/25',
  integrity_mismatch: 'text-rose-300 bg-rose-500/10 border-rose-500/25',
  tamper_suspected: 'text-rose-300 bg-rose-500/10 border-rose-500/25',
  verification_failed: 'text-orange-300 bg-orange-500/10 border-orange-500/25',
  blockchain_unavailable: 'text-slate-300 bg-slate-500/10 border-slate-500/25',
};

function integrityBadge(status?: string) {
  const s = status || 'pending_verification';
  return cn(
    'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono border',
    INTEGRITY_STYLES[s] || INTEGRITY_STYLES.pending_verification
  );
}

function eventTypeBadge(eventType: string) {
  const rose = ['tamper_detected', 'verification_failed', 'evidence_modified', 'seal_broken'];
  const emerald = ['evidence_created', 'evidence_uploaded', 'verification_completed', 'verification_registered', 'blockchain_confirmed', 'reconciliation_completed', 'blockchain_synced', 'integrity_checked'];
  const amber = ['custody_transferred', 'evidence_exported'];
  const sky = ['investigation_linked', 'analyst_accessed', 'evidence_stored', 'evidence_retrieved', 'evidence_returned', 'investigator_assigned', 'case_updated', 'evidence_archived'];
  const cls = rose.includes(eventType)
    ? 'text-rose-300 bg-rose-500/10 border-rose-500/25'
    : emerald.includes(eventType)
      ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25'
      : amber.includes(eventType)
        ? 'text-amber-300 bg-amber-500/10 border-amber-500/25'
        : sky.includes(eventType)
          ? 'text-sky-300 bg-sky-500/10 border-sky-500/25'
          : 'text-slate-300 bg-slate-500/10 border-slate-500/25';
  return cn('inline-flex px-2 py-0.5 rounded-md text-[11px] font-mono border', cls);
}

function downloadPdf(pdfBase64: string, fileName: string) {
  try {
    const binary = atob(pdfBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    // Invalid base64 — surfaced by caller
    throw new Error('Invalid PDF payload');
  }
}

interface StatCardProps {
  label: string;
  value: number;
  tone: 'amber' | 'emerald' | 'rose' | 'sky' | 'slate';
}

function StatCard({ label, value, tone }: StatCardProps) {
  const tones = {
    amber: 'text-amber-300',
    emerald: 'text-emerald-300',
    rose: 'text-rose-300',
    sky: 'text-sky-300',
    slate: 'text-slate-300',
  };
  return (
    <div className={cn(cardVariants.default, 'p-4')}>
      <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{label}</p>
      <p className={cn('mt-1.5 font-display text-2xl font-semibold tabular-nums', tones[tone])}>{value}</p>
    </div>
  );
}

function TimelineEvent({ event, index }: { event: CustodyEvent; index: number }) {
  const isLast = index === 0;
  return (
    <div className="relative pl-10 pb-5 last:pb-0">
      {!isLast && (
        <div className="absolute left-[13px] top-5 bottom-0 w-px bg-[var(--border-subtle)]" />
      )}
      <div
        className={cn(
          'absolute left-0 top-1 w-[27px] h-[27px] rounded-full flex items-center justify-center border',
          event.eventType === 'tamper_detected'
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            : event.eventType === 'custody_transferred'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        )}
      >
        {event.eventType === 'tamper_detected' ? (
          <ShieldAlert className="w-3.5 h-3.5" />
        ) : event.eventType === 'custody_transferred' ? (
          <ArrowRightLeft className="w-3.5 h-3.5" />
        ) : (
          <Fingerprint className="w-3.5 h-3.5" />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className="font-mono text-[11px] text-[var(--text-tertiary)]">{formatDateTime(event.timestamp)}</span>
        {eventTypeBadge(event.eventType)}
        {event.integrityStatus && integrityBadge(event.integrityStatus)}
      </div>
      <p className="text-[13px] text-[var(--text-primary)] leading-relaxed">{event.details || '—'}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-mono text-[var(--text-tertiary)]">
        <span>by {event.performedByName || event.performedBy || 'system'}</span>
        {event.transactionHash && (
          <span className="inline-flex items-center gap-1">
            <Link2 className="w-3 h-3" />
            tx {truncate(event.transactionHash, 18)}
          </span>
        )}
        {event.currentEventHash && <span>hash {truncate(event.currentEventHash, 18)}</span>}
      </div>
    </div>
  );
}

export default function CustodyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialEvidenceId = searchParams.get('evidenceId') || '';
  const [evidenceInput, setEvidenceInput] = useState(initialEvidenceId);
  const [activeEvidenceId, setActiveEvidenceId] = useState(initialEvidenceId);

  const [eventType, setEventType] = useState<string>(EVENT_TYPES[0]);
  const [eventDetails, setEventDetails] = useState('');
  const [newHolderName, setNewHolderName] = useState('');
  const [newHolderId, setNewHolderId] = useState('');

  const [tamperEvidenceId, setTamperEvidenceId] = useState('');
  const [tamperExpectedHash, setTamperExpectedHash] = useState('');
  const [tamperActualHash, setTamperActualHash] = useState('');
  const [tamperSeverity, setTamperSeverity] = useState('high');

  const { hasRole, isAdmin } = useAuthStore();
  const {
    stats, chain, timeline, verificationHistory, tamperInvestigations,
    latestReport, isLoading, isExporting, error,
    fetchStats, fetchChain, fetchTimeline, fetchVerificationHistory,
    addEvent, transferCustody, fetchTamperInvestigations, createTamperInvestigation,
    generateReport, exportReportPdf, resetEvidence, clearError,
  } = useCustodyStore();

  const canMutate = hasRole('admin') || hasRole('super_admin') || hasRole('forensic_analyst');
  const canTransfer = isAdmin();

  useEffect(() => {
    fetchStats();
    fetchTamperInvestigations();
  }, [fetchStats, fetchTamperInvestigations]);

  useEffect(() => {
    if (activeEvidenceId) {
      fetchChain(activeEvidenceId);
      fetchTimeline(activeEvidenceId);
      fetchVerificationHistory(activeEvidenceId);
    } else {
      resetEvidence();
    }
  }, [activeEvidenceId, fetchChain, fetchTimeline, fetchVerificationHistory, resetEvidence]);

  // Prefill the tamper investigation form from the active evidence
  useEffect(() => {
    setTamperEvidenceId(activeEvidenceId || '');
  }, [activeEvidenceId]);

  useEffect(() => {
    if (!tamperExpectedHash) {
      const events = timeline?.events;
      const last = events && events.length > 0 ? events[events.length - 1] : undefined;
      if (last?.currentEventHash) setTamperExpectedHash(last.currentEventHash);
    }
  }, [timeline, tamperExpectedHash]);

  const loadEvidence = (id: string) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    setActiveEvidenceId(trimmed);
    setSearchParams({ evidenceId: trimmed }, { replace: true });
  };

  const handleSubmitEvent = async () => {
    if (!activeEvidenceId || !eventDetails.trim()) return;
    const ok = await addEvent({
      evidenceId: activeEvidenceId,
      eventType,
      details: eventDetails.trim(),
    });
    if (ok) {
      setEventDetails('');
      fetchTimeline(activeEvidenceId);
      fetchVerificationHistory(activeEvidenceId);
    }
  };

  const handleTransfer = async () => {
    if (!activeEvidenceId || !newHolderName.trim() || !newHolderId.trim()) return;
    const ok = await transferCustody(activeEvidenceId, newHolderId.trim(), newHolderName.trim());
    if (ok) {
      setNewHolderName('');
      setNewHolderId('');
      fetchChain(activeEvidenceId);
      fetchTimeline(activeEvidenceId);
    }
  };

  const handleCreateTamper = async () => {
    if (!tamperEvidenceId.trim() || !tamperExpectedHash.trim() || !tamperActualHash.trim()) return;
    const ok = await createTamperInvestigation({
      evidenceId: tamperEvidenceId.trim(),
      expectedHash: tamperExpectedHash.trim(),
      actualHash: tamperActualHash.trim(),
      severity: tamperSeverity as 'low' | 'medium' | 'high' | 'critical',
    });
    if (ok) {
      setTamperEvidenceId('');
      setTamperExpectedHash('');
      setTamperActualHash('');
      if (activeEvidenceId === tamperEvidenceId.trim()) {
        fetchChain(activeEvidenceId);
        fetchTimeline(activeEvidenceId);
      }
    }
  };

  const handleGenerateReport = async () => {
    if (!activeEvidenceId) return;
    await generateReport([activeEvidenceId], 'chain_of_custody');
  };

  const handleExportPdf = async () => {
    if (!latestReport) return;
    const result = await exportReportPdf(latestReport.reportId);
    if (result) {
      downloadPdf(result.pdfBase64, result.pdfFileName);
    }
  };

  const sortedEvents = useMemo(() => {
    const events = timeline?.events || [];
    return [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [timeline]);

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-[10px] flex items-center justify-center bg-amber-500/10 border border-amber-500/25">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
            </div>
            <h1 className="font-display text-xl font-semibold text-[var(--text-primary)] tracking-tight">Chain of Custody</h1>
          </div>
          <p className="text-[13px] text-[var(--text-tertiary)]">
            Immutable custody chains, integrity verification and tamper investigations for forensic evidence.
          </p>
        </div>
        <button
          onClick={() => {
            fetchStats();
            fetchTamperInvestigations();
            if (activeEvidenceId) {
              fetchChain(activeEvidenceId);
              fetchTimeline(activeEvidenceId);
            }
          }}
          className={cn(buttonVariants.outline, 'h-9 px-3.5 text-[13px] inline-flex items-center gap-2 rounded-[10px]')}
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-[12px] bg-rose-500/10 border border-rose-500/25 text-[13px] text-rose-300">
          <span>{error}</span>
          <button onClick={clearError} className="text-rose-300/70 hover:text-rose-300 font-mono text-xs">dismiss</button>
        </div>
      )}

      {/* Integrity stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Evidence" value={stats?.totalEvidence ?? 0} tone="slate" />
        <StatCard label="Verified" value={stats?.verified ?? 0} tone="emerald" />
        <StatCard label="Pending" value={stats?.pending ?? 0} tone="amber" />
        <StatCard label="Failed" value={stats?.failed ?? 0} tone="rose" />
        <StatCard label="Tamper Suspected" value={stats?.tamperSuspected ?? 0} tone="rose" />
        <StatCard label="On Chain" value={stats?.blockchainOnChain ?? 0} tone="sky" />
      </div>

      {/* Evidence selector */}
      <div className={cn(cardVariants.default, 'p-4')}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-[11px] font-mono uppercase tracking-[0.14em] text-[var(--text-tertiary)] w-full sm:w-auto sm:mr-1">
            Evidence ID
          </label>
          <input
            value={evidenceInput}
            onChange={(e) => setEvidenceInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadEvidence(evidenceInput)}
            placeholder="e.g. SANDBOX-3f8a..."
            className="flex-1 min-w-[220px] h-9 px-3 rounded-[10px] bg-[var(--surface-base)] border border-[var(--outline-variant)] text-[13px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
          />
          <button
            onClick={() => loadEvidence(evidenceInput)}
            className={cn(buttonVariants.primary, 'h-9 px-4 text-[13px] inline-flex items-center gap-2 rounded-[10px]')}
          >
            <Search className="w-3.5 h-3.5" />
            Load chain
          </button>
          {activeEvidenceId && (
            <button
              onClick={() => {
                setActiveEvidenceId('');
                setEvidenceInput('');
                setSearchParams({}, { replace: true });
              }}
              className={cn(buttonVariants.ghost, 'h-9 px-3 text-[13px] rounded-[10px]')}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {!activeEvidenceId ? (
        <div className={cn(cardVariants.default, 'p-10 text-center')}>
          <div className="w-12 h-12 mx-auto rounded-full bg-[var(--surface-container-high)] border border-[var(--border-subtle)] flex items-center justify-center mb-3">
            <ShieldQuestion className="w-5 h-5 text-[var(--text-tertiary)]" />
          </div>
          <p className="text-sm font-medium text-[var(--text-primary)]">No evidence selected</p>
          <p className="mt-1 text-[13px] text-[var(--text-tertiary)] max-w-sm mx-auto">
            Enter an evidence ID above — or jump in from the Evidence page — to load its custody chain. A chain is created automatically when the first event is recorded.
          </p>
        </div>
      ) : (
        <>
          {/* Chain overview */}
          <div className={cn(cardVariants.default, 'p-5')}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-sm text-[var(--text-primary)]">{activeEvidenceId}</span>
                  {chain?.chainId && (
                    <span className="px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/25 text-sky-300 font-mono text-[11px]">
                      {chain.chainId}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {chain?.integrityStatus
                    ? integrityBadge(chain.integrityStatus)
                    : integrityBadge('pending_verification')}
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono border',
                      chain?.blockchainVerified
                        ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25'
                        : 'text-slate-300 bg-slate-500/10 border-slate-500/25'
                    )}
                  >
                    <Link2 className="w-3 h-3" />
                    {chain?.blockchainVerified ? 'on-chain' : 'not anchored'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 min-w-[220px]">
                <div className="px-3 py-2 rounded-[10px] bg-[var(--surface-base)] border border-[var(--border-subtle)]">
                  <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Events</p>
                  <p className="mt-0.5 font-display text-lg font-semibold text-[var(--text-primary)] tabular-nums">
                    {chain?.events?.length ?? 0}
                  </p>
                </div>
                <div className="px-3 py-2 rounded-[10px] bg-[var(--surface-base)] border border-[var(--border-subtle)]">
                  <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Verifications</p>
                  <p className="mt-0.5 font-display text-lg font-semibold text-[var(--text-primary)] tabular-nums">
                    {verificationHistory.length}
                  </p>
                </div>
                <div className="px-3 py-2 rounded-[10px] bg-[var(--surface-base)] border border-[var(--border-subtle)]">
                  <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Holder</p>
                  <p className="mt-0.5 text-[13px] font-medium text-[var(--text-primary)] truncate max-w-[110px]">
                    {timeline?.currentHolderName || timeline?.currentHolder || '—'}
                  </p>
                </div>
                <div className="px-3 py-2 rounded-[10px] bg-[var(--surface-base)] border border-[var(--border-subtle)]">
                  <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Status</p>
                  <p className="mt-0.5 text-[13px] font-medium text-[var(--text-primary)] capitalize">
                    {timeline?.custodyStatus || '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Timeline */}
            <div className={cn(cardVariants.default, 'p-5 lg:col-span-2')}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">Custody Timeline</h2>
                <span className="text-[11px] font-mono text-[var(--text-tertiary)]">
                  {timeline ? `${timeline.eventCount || sortedEvents.length} events` : 'no chain yet'}
                </span>
              </div>
              {sortedEvents.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-[13px] text-[var(--text-tertiary)]">
                    No custody events recorded yet. Record the first event below to create the chain.
                  </p>
                </div>
              ) : (
                <div>{sortedEvents.map((event, idx) => (
                  <TimelineEvent key={event.eventId || idx} event={event} index={idx} />
                ))}</div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-6">
              {/* Add event */}
              <div className={cn(cardVariants.default, 'p-5')}>
                <h2 className="font-display text-sm font-semibold text-[var(--text-primary)] mb-3">Record Event</h2>
                <div className="space-y-3">
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    disabled={!canMutate}
                    className="w-full h-9 px-3 rounded-[10px] bg-[var(--surface-base)] border border-[var(--outline-variant)] text-[13px] font-mono text-[var(--text-primary)] focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
                  >
                    {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <textarea
                    value={eventDetails}
                    onChange={(e) => setEventDetails(e.target.value)}
                    disabled={!canMutate}
                    placeholder="Event details (required)"
                    rows={3}
                    className="w-full px-3 py-2 rounded-[10px] bg-[var(--surface-base)] border border-[var(--outline-variant)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-amber-500/50 resize-none disabled:opacity-50"
                  />
                  <button
                    onClick={handleSubmitEvent}
                    disabled={!canMutate || !eventDetails.trim() || isLoading}
                    className={cn(buttonVariants.primary, 'w-full h-9 text-[13px] rounded-[10px] disabled:opacity-50')}
                  >
                    Append to chain
                  </button>
                  {!canMutate && (
                    <p className="text-[11px] text-[var(--text-tertiary)]">Requires admin or analyst role.</p>
                  )}
                </div>
              </div>

              {/* Transfer */}
              <div className={cn(cardVariants.default, 'p-5')}>
                <h2 className="font-display text-sm font-semibold text-[var(--text-primary)] mb-3">Transfer Custody</h2>
                <div className="space-y-3">
                  <input
                    value={newHolderName}
                    onChange={(e) => setNewHolderName(e.target.value)}
                    disabled={!canTransfer}
                    placeholder="New holder name"
                    className="w-full h-9 px-3 rounded-[10px] bg-[var(--surface-base)] border border-[var(--outline-variant)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
                  />
                  <input
                    value={newHolderId}
                    onChange={(e) => setNewHolderId(e.target.value)}
                    disabled={!canTransfer}
                    placeholder="New holder user ID"
                    className="w-full h-9 px-3 rounded-[10px] bg-[var(--surface-base)] border border-[var(--outline-variant)] text-[13px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
                  />
                  <button
                    onClick={handleTransfer}
                    disabled={!canTransfer || !newHolderName.trim() || !newHolderId.trim() || isLoading}
                    className={cn(buttonVariants.secondary, 'w-full h-9 text-[13px] rounded-[10px] disabled:opacity-50')}
                  >
                    Transfer
                  </button>
                  {!canTransfer && (
                    <p className="text-[11px] text-[var(--text-tertiary)]">Requires admin role.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Verification report */}
          <div className={cn(cardVariants.default, 'p-5')}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[10px] bg-[var(--surface-container-high)] border border-[var(--border-subtle)] flex items-center justify-center">
                  <FileText className="w-4 h-4 text-[var(--text-tertiary)]" />
                </div>
                <div>
                  <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">Verification Report</h2>
                  <p className="text-[11px] font-mono text-[var(--text-tertiary)]">
                    {latestReport
                      ? `${latestReport.reportId} · ${formatDateTime(latestReport.generatedAt)} · ${latestReport.summary.verifiedEvidence}/${latestReport.summary.totalEvidence} verified`
                      : 'No report generated for this session'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleGenerateReport}
                  disabled={!canMutate || isLoading}
                  className={cn(buttonVariants.secondary, 'h-9 px-4 text-[13px] inline-flex items-center gap-2 rounded-[10px] disabled:opacity-50')}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Generate report
                </button>
                <button
                  onClick={handleExportPdf}
                  disabled={!latestReport || isExporting || !canMutate}
                  className={cn(buttonVariants.primary, 'h-9 px-4 text-[13px] inline-flex items-center gap-2 rounded-[10px] disabled:opacity-50')}
                >
                  <FileDown className={cn('w-3.5 h-3.5', isExporting && 'animate-bounce')} />
                  {isExporting ? 'Exporting…' : 'Export PDF'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Tamper investigations */}
      <div className={cn(cardVariants.default, 'p-5')}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[10px] bg-rose-500/10 border border-rose-500/25 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">Tamper Investigations</h2>
              <p className="text-[11px] font-mono text-[var(--text-tertiary)]">{tamperInvestigations.length} open</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/25 text-rose-300 text-[11px] font-mono">
            <ShieldAlert className="w-3 h-3" />
            integrity alerts
          </span>
        </div>

        {tamperInvestigations.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-[var(--text-tertiary)]">
            No open tamper investigations. Suspicious integrity mismatches will appear here.
          </p>
        ) : (
          <div className="space-y-3">
            {tamperInvestigations.map((inv) => (
              <div
                key={inv.investigationId}
                className="px-4 py-3 rounded-[12px] bg-[var(--surface-base)] border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={cn('px-2 py-0.5 rounded-md text-[11px] font-mono border',
                    inv.severity === 'critical' ? 'text-rose-300 bg-rose-500/10 border-rose-500/25'
                      : inv.severity === 'high' ? 'text-orange-300 bg-orange-500/10 border-orange-500/25'
                        : inv.severity === 'medium' ? 'text-amber-300 bg-amber-500/10 border-amber-500/25'
                          : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25')}>
                    {inv.severity}
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-[13px] text-[var(--text-primary)] truncate">{inv.evidenceId}</p>
                    <p className="text-[11px] font-mono text-[var(--text-tertiary)]">
                      {inv.investigationId} · {formatDateTime(inv.detectedAt)} · drift {inv.driftAnalysis?.driftCount ?? 0}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('px-2 py-0.5 rounded-md text-[11px] font-mono border capitalize',
                    inv.status === 'resolved' || inv.status === 'false_positive'
                      ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25'
                      : inv.status === 'escalated'
                        ? 'text-rose-300 bg-rose-500/10 border-rose-500/25'
                        : 'text-amber-300 bg-amber-500/10 border-amber-500/25')}>
                    {inv.status.replace('_', ' ')}
                  </span>
                  {inv.assignedToName && (
                    <span className="text-[11px] text-[var(--text-tertiary)]">→ {inv.assignedToName}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {canTransfer && (
          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
            <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-[var(--text-tertiary)] mb-3">
              Open new investigation
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <input
                value={tamperEvidenceId}
                onChange={(e) => setTamperEvidenceId(e.target.value)}
                placeholder="Evidence ID"
                className="h-9 px-3 rounded-[10px] bg-[var(--surface-base)] border border-[var(--outline-variant)] text-[13px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-rose-500/50"
              />
              <input
                value={tamperExpectedHash}
                onChange={(e) => setTamperExpectedHash(e.target.value)}
                placeholder="Expected hash"
                className="h-9 px-3 rounded-[10px] bg-[var(--surface-base)] border border-[var(--outline-variant)] text-[13px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-rose-500/50"
              />
              <input
                value={tamperActualHash}
                onChange={(e) => setTamperActualHash(e.target.value)}
                placeholder="Actual hash"
                className="h-9 px-3 rounded-[10px] bg-[var(--surface-base)] border border-[var(--outline-variant)] text-[13px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-rose-500/50"
              />
              <select
                value={tamperSeverity}
                onChange={(e) => setTamperSeverity(e.target.value)}
                className="h-9 px-3 rounded-[10px] bg-[var(--surface-base)] border border-[var(--outline-variant)] text-[13px] font-mono text-[var(--text-primary)] focus:outline-none focus:border-rose-500/50"
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
                <option value="critical">critical</option>
              </select>
              <button
                onClick={handleCreateTamper}
                disabled={!tamperEvidenceId.trim() || !tamperExpectedHash.trim() || !tamperActualHash.trim() || isLoading}
                className={cn(buttonVariants.danger, 'h-9 px-4 text-[13px] inline-flex items-center gap-2 justify-center rounded-[10px] disabled:opacity-50')}
              >
                <Box className="w-3.5 h-3.5" />
                Open
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}