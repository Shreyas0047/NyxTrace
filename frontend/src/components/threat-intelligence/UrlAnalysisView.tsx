/**
 * UrlAnalysisView - URL Intelligence Analysis Component
 *
 * Analyzes URLs for malicious indicators and displays comprehensive threat intelligence
 * including reputation data, risk scoring, MITRE techniques, findings, and extracted IOCs.
 *
 * States handled: idle | loading | completed | failed
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  Link2,
  Search,
  AlertTriangle,
  Shield,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Server,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Hash,
  Wifi,
  X,
  Bug,
} from 'lucide-react';
import { cn } from '../../design-system';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { IocPanel, type ExtractedIOC } from './IocPanel';
import AiInsightsCard from './AiInsightsCard';
import { VerdictBanner } from './VerdictBanner';
import { useThreatIntelStore } from '../../stores/threatIntelStore';
import type { AnalysisFinding } from '../../types';

// ============================================
// Types
// ============================================
interface UrlAnalysisViewProps {}

type ViewState = 'idle' | 'loading' | 'completed' | 'failed';

// ============================================
// Constants & Helpers
// ============================================

const EXAMPLE_URL = 'https://suspicious-download-archive.xyz/setup-package.exe';

const SEVERITY_ORDER: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

function getThreatLevelMeta(level: string): {
  bg: string;
  text: string;
  border: string;
  icon: React.ElementType;
} {
  switch (level) {
    case 'critical':
      return { bg: 'bg-red-500/15', text: 'text-red-600 ', border: 'border-red-500/30', icon: ShieldAlert };
    case 'high':
      return { bg: 'bg-orange-500/15', text: 'text-orange-600 ', border: 'border-orange-500/30', icon: ShieldAlert };
    case 'medium':
      return { bg: 'bg-amber-500/15', text: 'text-amber-600 ', border: 'border-amber-500/30', icon: Shield };
    case 'low':
      return { bg: 'bg-sky-500/15', text: 'text-sky-600 ', border: 'border-sky-500/30', icon: ShieldCheck };
    case 'benign':
      return { bg: 'bg-emerald-500/15', text: 'text-emerald-600 ', border: 'border-emerald-500/30', icon: ShieldCheck };
    default:
      return { bg: 'bg-[var(--surface-container)]', text: 'text-[var(--text-secondary)] ', border: 'border-[var(--border-default)] ', icon: Shield };
  }
}

function getRiskScoreColor(score: number): string {
  if (score >= 80) return 'bg-red-500';
  if (score >= 60) return 'bg-orange-500';
  if (score >= 40) return 'bg-amber-500';
  if (score >= 20) return 'bg-sky-500';
  return 'bg-emerald-500';
}

function getRiskScoreTextColor(score: number): string {
  if (score >= 80) return 'text-red-600 ';
  if (score >= 60) return 'text-orange-600 ';
  if (score >= 40) return 'text-amber-600 ';
  if (score >= 20) return 'text-sky-600 ';
  return 'text-emerald-600 ';
}

function getRiskScoreLabel(score: number): string {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Medium';
  if (score >= 20) return 'Low';
  return 'Safe';
}

function getFindingSeverityMeta(severity: string): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (severity) {
    case 'critical':
      return { bg: 'bg-red-500/10', text: 'text-red-600 ', border: 'border-red-500/20', dot: 'bg-red-400' };
    case 'high':
      return { bg: 'bg-orange-500/10', text: 'text-orange-600 ', border: 'border-orange-500/20', dot: 'bg-orange-400' };
    case 'medium':
      return { bg: 'bg-amber-500/10', text: 'text-amber-600 ', border: 'border-amber-500/20', dot: 'bg-amber-400' };
    case 'low':
      return { bg: 'bg-emerald-500/10', text: 'text-emerald-600 ', border: 'border-emerald-500/20', dot: 'bg-emerald-400' };
    case 'info':
    default:
      return { bg: 'bg-sky-500/10', text: 'text-sky-600 ', border: 'border-sky-500/20', dot: 'bg-sky-400' };
  }
}

function isValidUrl(value: string): boolean {
  return /^https?:\/\/.+/i.test(value.trim());
}

// ============================================
// Sub-components
// ============================================

/**
 * URL Input Form shown in the idle state
 */
function UrlInputForm({
  url,
  onUrlChange,
  onSubmit,
  onPasteExample,
  validationError,
}: {
  url: string;
  onUrlChange: (val: string) => void;
  onSubmit: () => void;
  onPasteExample: () => void;
  validationError: string | null;
}) {
  return (
    <div className="space-y-6">
      {/* Icon header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
          <Link2 className="w-7 h-7 text-cyan-600 " />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)] ">URL Intelligence Analysis</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]  max-w-md mx-auto leading-relaxed">
            Analyze any URL for malicious indicators, threat intelligence matches, SSL validity,
            domain reputation, and more.
          </p>
        </div>
      </div>

      {/* URL input */}
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none z-10">
            <Globe className="w-4 h-4" />
          </div>
          <input
            type="url"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && url.trim() && !validationError) onSubmit();
            }}
            placeholder="https://example.com or https://suspicious-site.xyz/malware.exe"
            aria-label="URL to analyze"
            className={cn(
              'w-full pl-10 pr-10 py-3 text-sm rounded-xl border',
              'bg-[var(--surface-container-low)]  text-[var(--text-primary)]  placeholder:text-[var(--text-tertiary)]',
              'border-[var(--border-subtle)]  focus:border-cyan-500/50',
              'focus:outline-none focus:ring-2 focus:ring-cyan-500/20',
              'transition-all duration-200',
              validationError && 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20',
            )}
          />
          {url && (
            <button
              type="button"
              onClick={() => onUrlChange('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-secondary)]  transition-colors"
              aria-label="Clear URL input"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Validation error */}
        <AnimatePresence>
          {validationError && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="text-xs text-red-600  flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {validationError}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="lg"
            onClick={onSubmit}
            disabled={!url.trim() || !!validationError}
            leftIcon={<Search className="w-4 h-4" />}
            className="flex-1"
          >
            Analyze URL
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onPasteExample}
            leftIcon={<ArrowRight className="w-4 h-4" />}
          >
            Paste Example
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Animated loading state with URL being analyzed
 */
function LoadingState({ url }: { url: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-16 space-y-6"
    >
      {/* Pulsing spinner */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-cyan-500/10 animate-ping" />
        <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-[var(--surface-container-low)]  border border-[var(--border-subtle)] ">
          <Loader2 className="w-7 h-7 text-cyan-600  animate-spin" />
        </div>
      </div>

      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] ">Analyzing URL</h3>
        <p className="text-sm text-[var(--text-secondary)]  max-w-md truncate px-4" title={url}>
          {url}
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        <span className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
        </span>
        <span>Scanning threat intelligence sources&hellip;</span>
      </div>
    </motion.div>
  );
}

/**
 * Error state with retry and new analysis options
 */
function ErrorState({
  error,
  onRetry,
  onNew,
}: {
  error: string;
  onRetry: () => void;
  onNew: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 space-y-6"
    >
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20">
        <XCircle className="w-7 h-7 text-red-600 " />
      </div>

      <div className="text-center space-y-1 max-w-md">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] ">Analysis Failed</h3>
        <p className="text-sm text-[var(--text-secondary)]  leading-relaxed">{error}</p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          onClick={onRetry}
          leftIcon={<Loader2 className="w-4 h-4" />}
        >
          Retry Analysis
        </Button>
        <Button variant="outline" onClick={onNew}>
          New Analysis
        </Button>
      </div>
    </motion.div>
  );
}

/**
 * Badge indicating malicious or benign reputation
 */
function ReputationBadge({ malicious }: { malicious: boolean }) {
  if (malicious) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-600  border border-red-500/30">
        <AlertTriangle className="w-3.5 h-3.5" />
        Malicious
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600  border border-emerald-500/30">
      <CheckCircle className="w-3.5 h-3.5" />
      Benign
    </span>
  );
}

/**
 * Animated risk score bar showing score 0–100
 */
function RiskScoreBar({ score }: { score: number }) {
  const barColor = getRiskScoreColor(score);
  const textColor = getRiskScoreTextColor(score);
  const label = getRiskScoreLabel(score);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-secondary)] ">Risk Score</span>
        <span className={cn('font-semibold', textColor)}>
          {score}/100 &mdash; {label}
        </span>
      </div>
      <div className="w-full h-2.5 rounded-full bg-[var(--surface-container-low)]  overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(score, 100)}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={cn('h-full rounded-full', barColor)}
        />
      </div>
    </div>
  );
}

/**
 * Summary statistic card used in the stats grid
 */
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="flex items-center gap-3 p-4 rounded-xl bg-[var(--surface-container-low)]  border border-[var(--border-subtle)]  transition-colors hover:bg-[var(--surface-container)] "
    >
      <div className={cn('flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg', `${color.replace('text-', 'bg-')}/10`)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-[var(--text-secondary)]  truncate">{label}</p>
        <p className={cn('text-lg font-bold leading-tight', color)}>{value}</p>
      </div>
    </motion.div>
  );
}

/**
 * Key-value detail row for URL details section
 */
function DetailRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--border-subtle)]  last:border-b-0">
      <div className="flex items-center gap-2 text-sm min-w-0">
        <span className="text-[var(--text-secondary)] flex-shrink-0">{icon}</span>
        <span className="text-[var(--text-secondary)]  truncate">{label}</span>
      </div>
      <div
        className={cn(
          'text-sm font-medium text-right flex-shrink-0 ml-4',
          highlight ? 'text-[var(--text-primary)] ' : 'text-[var(--text-secondary)] ',
        )}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * Expandable finding card showing analysis findings with severity
 */
function FindingCard({ finding }: { finding: AnalysisFinding }) {
  const colors = getFindingSeverityMeta(finding.severity);
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      className={cn('rounded-xl border overflow-hidden transition-colors', colors.border, colors.bg)}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-start gap-3 p-4 text-left"
      >
        <div className={cn('flex-shrink-0 w-2 h-2 rounded-full mt-1.5', colors.dot)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className={cn('text-sm font-medium', colors.text)}>{finding.title}</span>
            <span
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded',
                colors.bg,
                colors.text,
                colors.border,
              )}
            >
              {finding.severity}
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)]  line-clamp-2 leading-relaxed">{finding.description}</p>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0 mt-1" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0 mt-1" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            key="finding-details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 space-y-3">
              {/* Meta row */}
              <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                <span>
                  Category:{' '}
                  <span className="text-[var(--text-secondary)]  capitalize">{finding.category}</span>
                </span>
                <span>
                  Confidence:{' '}
                  <span className="text-[var(--text-secondary)] ">{finding.confidence}%</span>
                </span>
              </div>

              {/* Evidence list */}
              {finding.evidence.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Evidence:</span>
                  <ul className="space-y-1">
                    {finding.evidence.map((ev, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <span className="text-[var(--text-secondary)] mt-1 flex-shrink-0">&bull;</span>
                        <code className="font-mono text-[11px] text-[var(--text-secondary)]  bg-[var(--surface-container-low)]  px-1.5 py-0.5 rounded break-all leading-relaxed">
                          {ev}
                        </code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* MITRE mapping */}
              {finding.mitreMapping && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-600  bg-violet-500/10 px-2 py-0.5 rounded">
                  MITRE: {finding.mitreMapping}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * MITRE ATT&CK technique chip
 */
function MitreTechniqueChip({ technique }: { technique: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-violet-300 bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 transition-colors">
      <Bug className="w-3 h-3 flex-shrink-0" />
      {technique}
    </span>
  );
}

/**
 * Category tag badge
 */
function CategoryTag({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/20">
      {category}
    </span>
  );
}

/**
 * Threat intelligence match alert-style row
 */
function ThreatIntelMatchItem({ match, index }: { match: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-container-low)]  border border-[var(--border-subtle)]  hover:bg-[var(--surface-container)]  transition-colors"
    >
      <AlertTriangle className="w-4 h-4 text-amber-600  flex-shrink-0" />
      <code className="text-xs font-mono text-[var(--text-secondary)]  break-all leading-relaxed">{match}</code>
    </motion.div>
  );
}

// ============================================
// Main Component
// ============================================

export function UrlAnalysisView(_props: UrlAnalysisViewProps) {
  const { currentAnalysis, isLoading, error, analyzeUrl, clearCurrent } = useThreatIntelStore();

  const [url, setUrl] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  // Derive the current view state from store values
  const viewState: ViewState = useMemo(() => {
    if (isLoading) return 'loading';
    if (currentAnalysis) return 'completed';
    if (error) return 'failed';
    return 'idle';
  }, [isLoading, currentAnalysis, error]);

  // Validate URL format
  const validateUrl = useCallback((value: string): string | null => {
    if (!value.trim()) return 'Please enter a URL to analyze.';
    if (!isValidUrl(value)) return 'URL must start with http:// or https://';
    return null;
  }, []);

  // Handle URL input changes with live validation
  const handleUrlChange = useCallback((value: string) => {
    setUrl(value);
    if (value && !isValidUrl(value)) {
      setLocalError('URL must start with http:// or https://');
    } else {
      setLocalError(null);
    }
  }, []);

  // Initiate URL analysis
  const handleSubmit = useCallback(() => {
    const trimmedUrl = url.trim();
    const validationError = validateUrl(trimmedUrl);
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    setLocalError(null);
    analyzeUrl(trimmedUrl);
  }, [url, validateUrl, analyzeUrl]);

  // Fill in example suspicious URL
  const handlePasteExample = useCallback(() => {
    setUrl(EXAMPLE_URL);
    setLocalError(null);
  }, []);

  // Clear current result and return to idle state
  const handleNewAnalysis = useCallback(() => {
    clearCurrent();
    setUrl('');
    setLocalError(null);
  }, [clearCurrent]);

  // Retry failed analysis
  const handleRetry = useCallback(() => {
    if (url.trim()) {
      setLocalError(null);
      analyzeUrl(url.trim());
    }
  }, [url, analyzeUrl]);

  // Derived data
  const analysis = currentAnalysis;
  const reputation = analysis?.urlReputation;
  const threatMeta = analysis ? getThreatLevelMeta(analysis.threatLevel) : null;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <AnimatePresence mode="wait">
        {/* ============================================== */}
        {/* IDLE STATE — URL Input Form                    */}
        {/* ============================================== */}
        {viewState === 'idle' && (
          <motion.div
            key="view-idle"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <Card padding="lg" className="!p-8">
              <UrlInputForm
                url={url}
                onUrlChange={handleUrlChange}
                onSubmit={handleSubmit}
                onPasteExample={handlePasteExample}
                validationError={localError}
              />
            </Card>
          </motion.div>
        )}

        {/* ============================================== */}
        {/* LOADING STATE — Spinner + URL                   */}
        {/* ============================================== */}
        {viewState === 'loading' && (
          <motion.div
            key="view-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Card padding="lg">
              <LoadingState url={url} />
            </Card>
          </motion.div>
        )}

        {/* ============================================== */}
        {/* COMPLETED STATE — Full Analysis Results         */}
        {/* ============================================== */}
        {viewState === 'completed' && analysis && (
          <motion.div
            key="view-completed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* --- Header: URL + Badges + New Analysis --- */}
            <Card variant="elevated">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Globe className="w-5 h-5 text-cyan-600  flex-shrink-0" />
                    <h2 className="text-base font-semibold text-[var(--text-primary)]  truncate max-w-md" title={analysis.url}>
                      {analysis.url || 'URL Analysis'}
                    </h2>
                    {reputation && <ReputationBadge malicious={reputation.malicious} />}
                    {threatMeta && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border',
                          threatMeta.bg,
                          threatMeta.text,
                          threatMeta.border,
                        )}
                      >
                        {analysis.threatLevel}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]  leading-relaxed">{analysis.summary}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNewAnalysis}
                  leftIcon={<X className="w-3.5 h-3.5" />}
                  className="flex-shrink-0"
                >
                  New Analysis
                </Button>
              </div>
            </Card>

            {/* --- Verdict Banner --- */}
            <VerdictBanner
              threatType={analysis.threatLevel}
              confidence={analysis.confidence}
              riskScore={reputation?.riskScore}
              malicious={reputation?.malicious}
              artifactLabel={analysis.url}
            />

            {/* --- Summary Stats Grid --- */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={
                  threatMeta ? (
                    <Shield className={cn('w-5 h-5', threatMeta.text)} />
                  ) : (
                    <Shield className="w-5 h-5 text-[var(--text-secondary)] " />
                  )
                }
                label="Threat Level"
                value={analysis.threatLevel.charAt(0).toUpperCase() + analysis.threatLevel.slice(1)}
                color={threatMeta?.text || 'text-[var(--text-secondary)] '}
              />
              <StatCard
                icon={<ShieldCheck className="w-5 h-5 text-cyan-600 " />}
                label="Confidence"
                value={`${analysis.confidence}%`}
                color="text-cyan-600 "
              />
              <StatCard
                icon={<Hash className="w-5 h-5 text-violet-600 " />}
                label="Findings"
                value={analysis.findings.length}
                color="text-violet-600 "
              />
              <StatCard
                icon={<Bug className="w-5 h-5 text-amber-600 " />}
                label="IOC Count"
                value={analysis.iocs.length}
                color="text-amber-600 "
              />
            </div>

            {/* --- AI Assessment (LLM second opinion) --- */}
            <AiInsightsCard insights={analysis.aiInsights} />

            {/* --- URL Reputation & Details Section --- */}
            {reputation && (
              <>
                {/* Risk Score */}
                <Card>
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">URL Reputation Analysis</h3>
                      <span className="text-xs text-[var(--text-secondary)]">
                        Last analyzed: {new Date(reputation.lastAnalyzed).toLocaleDateString()}
                      </span>
                    </div>
                    <RiskScoreBar score={reputation.riskScore} />
                  </div>
                </Card>

                {/* URL Details Table */}
                <Card>
                  <div className="flex items-center gap-2 mb-4">
                    <Server className="w-4 h-4 text-[var(--text-secondary)] " />
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">URL Details</h3>
                  </div>
                  <div className="divide-y divide-[var(--border-subtle)]">
                    <DetailRow
                      icon={<Clock className="w-4 h-4" />}
                      label="Domain Age"
                      value={reputation.domainAge > 0 ? `${reputation.domainAge} days` : 'Unknown'}
                    />
                    <DetailRow
                      icon={<Shield className="w-4 h-4" />}
                      label="SSL Valid"
                      value={
                        <span
                          className={cn(
                            'inline-flex items-center gap-1',
                            reputation.sslValid ? 'text-emerald-600 ' : 'text-red-600 ',
                          )}
                        >
                          {reputation.sslValid ? (
                            <CheckCircle className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          {reputation.sslValid ? 'Yes' : 'No'}
                        </span>
                      }
                    />
                    {reputation.registrar && (
                      <DetailRow icon={<Server className="w-4 h-4" />} label="Registrar" value={reputation.registrar} />
                    )}
                    {reputation.registrantCountry && (
                      <DetailRow icon={<Globe className="w-4 h-4" />} label="Registrant Country" value={reputation.registrantCountry} />
                    )}
                    {reputation.creationDate && (
                      <DetailRow
                        icon={<Clock className="w-4 h-4" />}
                        label="Creation Date"
                        value={new Date(reputation.creationDate).toLocaleDateString()}
                      />
                    )}
                    {reputation.firstSeen && (
                      <DetailRow
                        icon={<Clock className="w-4 h-4" />}
                        label="First Seen"
                        value={new Date(reputation.firstSeen).toLocaleDateString()}
                      />
                    )}
                  </div>
                </Card>

                {/* Redirect Chain */}
                {reputation.redirectChain.length > 0 && (
                  <Card>
                    <div className="flex items-center gap-2 mb-4">
                      <ArrowRight className="w-4 h-4 text-[var(--text-secondary)] " />
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Redirect Chain</h3>
                      <span className="text-xs text-[var(--text-secondary)]">({reputation.redirectChain.length} hops)</span>
                    </div>
                    <div className="space-y-1">
                      {reputation.redirectChain.map((redirectUrl, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="flex flex-col items-center gap-0.5 pt-1">
                            <div className="w-2 h-2 rounded-full bg-cyan-500/50 flex-shrink-0" />
                            {i < reputation.redirectChain.length - 1 && (
                              <div className="w-px h-6 bg-[var(--surface-container-low)] " />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <code className="text-xs font-mono text-[var(--text-secondary)]  break-all bg-[var(--surface-container-low)]  px-2.5 py-1.5 rounded-lg block">
                              {redirectUrl}
                            </code>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Technologies Detected */}
                {reputation.technologies.length > 0 && (
                  <Card>
                    <div className="flex items-center gap-2 mb-4">
                      <Wifi className="w-4 h-4 text-[var(--text-secondary)] " />
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Technologies Detected</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {reputation.technologies.map((tech, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--text-secondary)]  bg-[var(--surface-container-low)]  border border-[var(--border-default)]  "
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Categories */}
                {reputation.categories.length > 0 && (
                  <Card>
                    <div className="flex items-center gap-2 mb-4">
                      <Hash className="w-4 h-4 text-[var(--text-secondary)] " />
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Categories</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {reputation.categories.map((cat, i) => (
                        <CategoryTag key={i} category={cat} />
                      ))}
                    </div>
                  </Card>
                )}

                {/* Threat Intelligence Matches */}
                {reputation.threatIntelMatches.length > 0 && (
                  <Card>
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-4 h-4 text-amber-600 " />
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Threat Intelligence Matches</h3>
                      <span className="text-xs text-amber-600 ">({reputation.threatIntelMatches.length} matches)</span>
                    </div>
                    <div className="space-y-2">
                      {reputation.threatIntelMatches.map((match, i) => (
                        <ThreatIntelMatchItem key={i} match={match} index={i} />
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}

            {/* --- MITRE ATT&CK Techniques --- */}
            {analysis.mitreTechniques.length > 0 && (
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <Bug className="w-4 h-4 text-violet-600 " />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">MITRE ATT&CK Techniques</h3>
                  <span className="text-xs text-[var(--text-secondary)]">({analysis.mitreTechniques.length} techniques)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {analysis.mitreTechniques.map((technique, i) => (
                    <MitreTechniqueChip key={i} technique={technique} />
                  ))}
                </div>
                {analysis.mitreTactics.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[var(--border-subtle)] ">
                    {analysis.mitreTactics.map((tactic, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium text-violet-600  bg-violet-500/5 border border-violet-500/10"
                      >
                        {tactic}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* --- Analysis Findings --- */}
            {analysis.findings.length > 0 && (
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4 text-amber-600 " />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Analysis Findings</h3>
                  <span className="text-xs text-[var(--text-secondary)]">({analysis.findings.length} findings)</span>
                </div>
                <div className="space-y-2">
                  {[...analysis.findings]
                    .sort(
                      (a, b) =>
                        (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0),
                    )
                    .map((finding) => (
                      <FindingCard key={finding.id} finding={finding} />
                    ))}
                </div>
              </Card>
            )}

            {/* --- Extracted IOCs via IocPanel --- */}
            {analysis.iocs.length > 0 && (
              <IocPanel
                iocs={analysis.iocs as ExtractedIOC[]}
              />
            )}

            {/* --- Footer: Timestamp + New Analysis --- */}
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] pt-2">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Analyzed at: {new Date(analysis.analyzedAt).toLocaleString()}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewAnalysis}
                leftIcon={<Search className="w-3.5 h-3.5" />}
              >
                New Analysis
              </Button>
            </div>
          </motion.div>
        )}

        {/* ============================================== */}
        {/* FAILED STATE — Error Message + Retry            */}
        {/* ============================================== */}
        {viewState === 'failed' && (
          <motion.div
            key="view-failed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Card padding="lg">
              <ErrorState
                error={error || 'An unknown error occurred during URL analysis. Please try again.'}
                onRetry={handleRetry}
                onNew={handleNewAnalysis}
              />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default UrlAnalysisView;
