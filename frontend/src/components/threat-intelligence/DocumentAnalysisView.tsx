/**
 * DocumentAnalysisView - Full document threat analysis view
 *
 * Manages the full lifecycle of document analysis:
 *   idle (upload zone) → selected (file preview + analyze) → uploading (progress) → completed (results) / failed (error)
 *
 * When completed, displays:
 *   - Threat score gauge
 *   - Summary card with threat level, confidence, IOC count
 *   - Findings list with severity badges and evidence chips
 *   - IocPanel for extracted indicators
 *   - Document sections with suspicious indicators
 *   - MITRE technique chips
 */

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  File,
  FileSearch,
  AlertTriangle,
  Shield,
  XCircle,
  Loader2,
  Brain,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Layers,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react';
import { cn } from '../../design-system';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { IocPanel } from './IocPanel';
import AiInsightsCard from './AiInsightsCard';
import { useThreatIntelStore } from '../../stores/threatIntelStore';
import type { AnalysisFinding, DocumentSection } from '../../types';

// ============================================
// Constants
// ============================================

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  benign: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const threatLevelConfig: Record<string, { label: string; color: string; barColor: string; icon: React.ComponentType<{ className?: string }> }> = {
  critical: { label: 'Critical', color: 'text-red-400', barColor: 'bg-red-500', icon: AlertTriangle },
  high: { label: 'High', color: 'text-orange-400', barColor: 'bg-orange-500', icon: AlertTriangle },
  medium: { label: 'Medium', color: 'text-amber-400', barColor: 'bg-amber-500', icon: Shield },
  low: { label: 'Low', color: 'text-emerald-400', barColor: 'bg-emerald-500', icon: Shield },
  benign: { label: 'Benign', color: 'text-slate-400', barColor: 'bg-slate-500', icon: Shield },
};

const findingCategoryConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  malware: { label: 'Malware', icon: AlertTriangle },
  phishing: { label: 'Phishing', icon: FileText },
  exploit: { label: 'Exploit', icon: AlertTriangle },
  recon: { label: 'Recon', icon: Search },
  persistence: { label: 'Persistence', icon: Layers },
  evasion: { label: 'Evasion', icon: Shield },
  collection: { label: 'Collection', icon: FileSpreadsheet },
  command: { label: 'C2', icon: Brain },
};

const ACCEPTED_FILE_TYPES = '.pdf,.docx,.doc,.txt,.rtf,.xls,.xlsx,.csv';

// ============================================
// Helpers
// ============================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
  if (diffMin < 10080) return `${Math.floor(diffMin / 1440)}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getScoreBarColor(score: number): string {
  if (score >= 80) return 'bg-red-500';
  if (score >= 60) return 'bg-orange-500';
  if (score >= 40) return 'bg-amber-500';
  if (score >= 20) return 'bg-emerald-500';
  return 'bg-slate-500';
}

function getFileTypeIcon(file: File): React.ReactNode {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return <FileText className="w-8 h-8 text-red-400" />;
  if (name.endsWith('.docx') || name.endsWith('.doc')) return <FileText className="w-8 h-8 text-blue-400" />;
  if (name.endsWith('.txt')) return <FileText className="w-8 h-8 text-slate-400" />;
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    return <FileSpreadsheet className="w-8 h-8 text-emerald-400" />;
  }
  return <File className="w-8 h-8 text-slate-400" />;
}

// ============================================
// Sub-components
// ============================================

/** Severity badge pill */
function SeverityBadge({ severity }: { severity: string }) {
  const colors = severityColors[severity] || severityColors.benign;
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border', colors)}>
      {severity}
    </span>
  );
}

/** Evidence chip */
function EvidenceChip({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-700/50 text-slate-300 border border-slate-600/30 truncate max-w-[200px]">
      <FileText className="w-3 h-3 flex-shrink-0 text-slate-400" />
      {text}
    </span>
  );
}

/** Single finding card within the findings list */
function FindingCard({ finding, index }: { finding: AnalysisFinding; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const catConfig = findingCategoryConfig[finding.category as keyof typeof findingCategoryConfig];
  const CategoryIcon = catConfig?.icon || AlertTriangle;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      className="rounded-lg border border-slate-700/40 bg-slate-800/40 overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-slate-700/30 transition-colors duration-150"
      >
        <div className={cn(
          'flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 mt-0.5',
          finding.severity === 'critical' ? 'bg-red-500/10 text-red-400' :
          finding.severity === 'high' ? 'bg-orange-500/10 text-orange-400' :
          finding.severity === 'medium' ? 'bg-amber-500/10 text-amber-400' :
          'bg-slate-500/10 text-slate-400'
        )}>
          <CategoryIcon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-200">{finding.title}</span>
            <SeverityBadge severity={finding.severity} />
          </div>
          <p className="mt-1 text-xs text-slate-400 line-clamp-2">{finding.description}</p>
        </div>
        <div className="flex-shrink-0 mt-1">
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2 border-t border-slate-700/30 pt-2">
              {/* Evidence chips */}
              {finding.evidence.length > 0 && (
                <div>
                  <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block mb-1.5">
                    Evidence
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {finding.evidence.map((ev, i) => (
                      <EvidenceChip key={i} text={ev} />
                    ))}
                  </div>
                </div>
              )}

              {/* Category & confidence */}
              <div className="flex items-center gap-3 text-[10px] text-slate-500">
                {catConfig && (
                  <span className="inline-flex items-center gap-1">
                    <CategoryIcon className="w-3 h-3" />
                    {catConfig.label}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Brain className="w-3 h-3" />
                  Confidence: {finding.confidence}%
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Document section row */
function DocumentSectionRow({ section, index }: { section: DocumentSection; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-colors duration-150',
        section.suspicious
          ? 'bg-red-500/5 border-red-500/20'
          : 'bg-slate-800/20 border-slate-700/30'
      )}
    >
      <div className={cn(
        'flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0',
        section.suspicious ? 'bg-red-500/10 text-red-400' : 'bg-slate-700/30 text-slate-400'
      )}>
        <Layers className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-200">{section.heading}</span>
          <span className="text-[10px] text-slate-500">p.{section.pageNumber}</span>
          {section.suspicious && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
              <AlertTriangle className="w-3 h-3" />
              Suspicious
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{section.content}</p>
        {section.riskIndicators.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {section.riskIndicators.map((indicator, i) => (
              <span key={i} className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                {indicator}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================
// Upload Zone Component
// ============================================

function UploadZone({
  selectedFile,
  dragActive,
  isUploading,
  onFileSelect,
  onDragOver,
  onDragLeave,
  onDrop,
  onClear,
  onAnalyze,
}: {
  selectedFile: File | null;
  dragActive: boolean;
  isUploading: boolean;
  onFileSelect: (file: File) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onClear: () => void;
  onAnalyze: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    e.target.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload document for analysis"
      onKeyDown={handleKeyDown}
      onClick={!selectedFile ? handleClick : undefined}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'relative rounded-xl border-2 border-dashed transition-all duration-200',
        dragActive
          ? 'border-cyan-400 bg-cyan-500/5 shadow-lg shadow-cyan-500/10'
          : selectedFile
            ? 'border-slate-600/60 bg-slate-800/40'
            : 'border-slate-600/30 bg-slate-800/20 hover:border-slate-500/50 hover:bg-slate-800/30',
        'cursor-pointer group'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
      />

      <AnimatePresence mode="wait">
        {!selectedFile ? (
          /* Empty state - prompt to upload */
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-14 px-6"
          >
            <motion.div
              animate={dragActive ? { scale: 1.1, y: -4 } : { scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className={cn(
                'flex items-center justify-center w-16 h-16 rounded-2xl mb-4 transition-colors duration-200',
                dragActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700/40 text-slate-500 group-hover:text-slate-400'
              )}
            >
              <Upload className="w-8 h-8" />
            </motion.div>
            <p className="text-base font-medium text-slate-300 mb-1">
              {dragActive ? 'Drop your file here' : 'Drop your document here'}
            </p>
            <p className="text-sm text-slate-500 mb-4">
              or <span className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">browse files</span>
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
              <FileText className="w-3 h-3" />
              <span>Supported: PDF, DOCX, TXT, RTF, XLSX, CSV</span>
            </div>
            <p className="mt-2 text-[10px] text-slate-600">Max file size: 50 MB</p>
          </motion.div>
        ) : (
          /* File selected - show preview + actions */
          <motion.div
            key="selected"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-6"
          >
            <div className="flex items-center gap-4">
              {getFileTypeIcon(selectedFile)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-200 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatFileSize(selectedFile.size)} &middot; {selectedFile.type || 'Unknown type'}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onClear(); }}
                className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-slate-300 transition-colors"
                aria-label="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Button
                variant="primary"
                size="md"
                loading={isUploading}
                disabled={isUploading}
                onClick={(e) => { e.stopPropagation(); onAnalyze(); }}
                leftIcon={<Brain className="w-4 h-4" />}
                className="flex-1"
              >
                {isUploading ? 'Analyzing...' : 'Analyze Document'}
              </Button>
              <Button
                variant="outline"
                size="md"
                disabled={isUploading}
                onClick={(e) => { e.stopPropagation(); onClear(); }}
                leftIcon={<Trash2 className="w-4 h-4" />}
              >
                Clear
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Results View Components
// ============================================

/** Threat score gauge bar at the top of results */
function ThreatScoreGauge({ score, threatLevel }: { score: number; threatLevel: string }) {
  const config = threatLevelConfig[threatLevel] || threatLevelConfig.benign;
  const ThreatIcon = config.icon;
  const barColor = getScoreBarColor(score);

  return (
    <Card variant="default" padding="md">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-300">Threat Score</span>
            <span className="text-2xl font-bold text-white">{score}</span>
            <span className="text-sm text-slate-500">/ 100</span>
          </div>
          <span className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border',
            severityColors[threatLevel] || severityColors.benign
          )}>
            <ThreatIcon className="w-3.5 h-3.5" />
            {config.label}
          </span>
        </div>

        {/* Gauge bar */}
        <div className="relative h-3 rounded-full bg-slate-700/50 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
            className={cn('h-full rounded-full relative', barColor)}
            style={{
              boxShadow: score > 60 ? `0 0 12px ${score >= 80 ? 'rgba(239,68,68,0.4)' : 'rgba(249,115,22,0.35)'}` : undefined,
            }}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between mt-1.5">
          {[
            { label: 'Benign', color: 'bg-slate-500', max: 20 },
            { label: 'Low', color: 'bg-emerald-500', max: 40 },
            { label: 'Medium', color: 'bg-amber-500', max: 60 },
            { label: 'High', color: 'bg-orange-500', max: 80 },
            { label: 'Critical', color: 'bg-red-500', max: 100 },
          ].map((tier) => (
            <span
              key={tier.label}
              className={cn(
                'text-[10px] transition-colors duration-300',
                score <= tier.max ? 'text-slate-500' : tier.color.replace('bg-', 'text-')
              )}
            >
              {tier.label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Summary card showing analysis overview */
function AnalysisSummaryCard({ analysis }: { analysis: any }) {
  const config = threatLevelConfig[analysis.threatLevel] || threatLevelConfig.benign;
  const ThreatIcon = config.icon;

  return (
    <Card variant="default" padding="md">
      <CardContent className="p-4 space-y-4">
        {/* Top row: file info + threat badge */}
        <div className="flex items-start gap-3">
          <div className={cn(
            'flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0',
            analysis.threatLevel === 'critical' ? 'bg-red-500/10' :
            analysis.threatLevel === 'high' ? 'bg-orange-500/10' :
            analysis.threatLevel === 'medium' ? 'bg-amber-500/10' :
            'bg-slate-500/10'
          )}>
            <FileText className={cn(
              'w-5 h-5',
              analysis.threatLevel === 'critical' ? 'text-red-400' :
              analysis.threatLevel === 'high' ? 'text-orange-400' :
              analysis.threatLevel === 'medium' ? 'text-amber-400' :
              'text-slate-400'
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-white truncate">
                {analysis.fileName || 'Document Analysis'}
              </h3>
              {analysis.fileSize && (
                <span className="text-[11px] text-slate-500 flex-shrink-0">
                  {formatFileSize(analysis.fileSize)}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{analysis.summary}</p>
          </div>
          <span className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border flex-shrink-0',
            severityColors[analysis.threatLevel] || severityColors.benign
          )}>
            <ThreatIcon className="w-3.5 h-3.5" />
            {config.label}
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-slate-800/50 border border-slate-700/30 p-3 text-center">
            <p className="text-lg font-bold text-slate-200">{analysis.threatScore}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Threat Score</p>
          </div>
          <div className="rounded-lg bg-slate-800/50 border border-slate-700/30 p-3 text-center">
            <p className="text-lg font-bold text-slate-200">{analysis.iocs?.length || 0}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">IOCs</p>
          </div>
          <div className="rounded-lg bg-slate-800/50 border border-slate-700/30 p-3 text-center">
            <p className="text-lg font-bold text-slate-200">{analysis.findings?.length || 0}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Findings</p>
          </div>
        </div>

        {/* Confidence bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-400">Analysis Confidence</span>
            <span className="text-xs font-bold text-slate-300">{analysis.confidence}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-700/50 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${analysis.confidence}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
              className={cn(
                'h-full rounded-full',
                analysis.confidence >= 80 ? 'bg-emerald-500' :
                analysis.confidence >= 60 ? 'bg-cyan-500' :
                analysis.confidence >= 40 ? 'bg-amber-500' : 'bg-red-500'
              )}
            />
          </div>
        </div>

        {/* Analyzed timestamp */}
        {analysis.analyzedAt && (
          <p className="text-[10px] text-slate-600 text-right">
            Analyzed {formatTimestamp(analysis.analyzedAt)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** MITRE techniques displayed as chips */
function MitreTechniquesSection({ techniques, tactics }: { techniques: string[]; tactics: string[] }) {
  if (techniques.length === 0 && tactics.length === 0) return null;

  return (
    <Card variant="default" padding="md">
      <CardHeader
        title="MITRE ATT&CK Mapping"
        description="Techniques and tactics identified in the document"
      />
      <CardContent className="space-y-3">
        {tactics.length > 0 && (
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
              Tactics
            </span>
            <div className="flex flex-wrap gap-1.5">
              {tactics.map((tactic) => (
                <span
                  key={tactic}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20"
                >
                  <Shield className="w-3 h-3" />
                  {tactic}
                </span>
              ))}
            </div>
          </div>
        )}
        {techniques.length > 0 && (
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
              Techniques
            </span>
            <div className="flex flex-wrap gap-1.5">
              {techniques.map((technique) => (
                <span
                  key={technique}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono font-medium bg-slate-700/40 text-slate-300 border border-slate-600/30"
                >
                  <Brain className="w-3 h-3 text-slate-500" />
                  {technique}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Document sections list */
function DocumentSectionsSection({ sections }: { sections: DocumentSection[] }) {
  if (!sections || sections.length === 0) return null;

  const suspiciousCount = sections.filter((s) => s.suspicious).length;

  return (
    <Card variant="default" padding="md">
      <CardHeader
        title="Document Sections"
        description={`${sections.length} section${sections.length !== 1 ? 's' : ''} found${suspiciousCount > 0 ? `, ${suspiciousCount} suspicious` : ''}`}
      />
      <CardContent>
        <div className="space-y-2">
          <AnimatePresence>
            {sections.map((section, index) => (
              <DocumentSectionRow key={`${section.heading}-${index}`} section={section} index={index} />
            ))}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}

/** Findings list section */
function FindingsSection({ findings }: { findings: AnalysisFinding[] }) {
  if (!findings || findings.length === 0) return null;

  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;

  return (
    <Card variant="default" padding="md">
      <CardHeader
        title="Analysis Findings"
        description={`${findings.length} finding${findings.length !== 1 ? 's' : ''} detected`}
        action={
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                {criticalCount} critical
              </span>
            )}
            {highCount > 0 && (
              <span className="text-[10px] font-semibold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded">
                {highCount} high
              </span>
            )}
          </div>
        }
      />
      <CardContent>
        <div className="space-y-2">
          <AnimatePresence>
            {findings.map((finding, index) => (
              <FindingCard key={finding.id || index} finding={finding} index={index} />
            ))}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}

/** Loading/uploading overlay */
function UploadingOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-20"
    >
      <div className="relative mb-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 rounded-full border-4 border-slate-700 border-t-cyan-500"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <Brain className="w-6 h-6 text-cyan-400" />
        </motion.div>
      </div>
      <motion.p
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        className="text-base font-medium text-slate-300 mb-2"
      >
        Analyzing Document
      </motion.p>
      <p className="text-sm text-slate-500 mb-6 text-center max-w-md">
        Scanning for threats, extracting IOCs, and classifying content...
      </p>
      <div className="w-64 h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
        <motion.div
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-1/3 h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500"
        />
      </div>
    </motion.div>
  );
}

/** Error state display */
function ErrorState({ error, onRetry, onClear }: { error: string; onRetry: () => void; onClear: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12 }}
        className="flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 mb-5"
      >
        <XCircle className="w-10 h-10 text-red-400" />
      </motion.div>
      <h3 className="text-lg font-semibold text-slate-200 mb-2">Analysis Failed</h3>
      <p className="text-sm text-slate-400 text-center max-w-md mb-6">{error}</p>
      <div className="flex items-center gap-3">
        <Button variant="primary" size="md" onClick={onRetry} leftIcon={<Loader2 className="w-4 h-4" />}>
          Try Again
        </Button>
        <Button variant="outline" size="md" onClick={onClear} leftIcon={<X className="w-4 h-4" />}>
          Dismiss
        </Button>
      </div>
    </motion.div>
  );
}

// ============================================
// Main Component
// ============================================

interface DocumentAnalysisViewProps {
  className?: string;
}

export function DocumentAnalysisView({ className }: DocumentAnalysisViewProps) {
  const {
    currentAnalysis,
    isUploading,
    error,
    analyzeDocument,
    clearCurrent,
  } = useThreatIntelStore();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Derive the current view mode from store state
  const viewMode: 'upload' | 'uploading' | 'completed' | 'failed' = useMemo(() => {
    if (error) return 'failed';
    if (isUploading) return 'uploading';
    if (currentAnalysis) return 'completed';
    return 'upload';
  }, [error, isUploading, currentAnalysis]);

  // ------ Handlers ------

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleAnalyze = useCallback(() => {
    if (selectedFile) {
      analyzeDocument(selectedFile);
    }
  }, [selectedFile, analyzeDocument]);

  const handleClear = useCallback(() => {
    setSelectedFile(null);
    clearCurrent();
  }, [clearCurrent]);

  const handleNewAnalysis = useCallback(() => {
    setSelectedFile(null);
    clearCurrent();
  }, [clearCurrent]);

  const handleRetry = useCallback(() => {
    clearCurrent();
    setSelectedFile(null);
  }, [clearCurrent]);

  // ------ Render ------

  return (
    <div className={cn('space-y-4', className)}>
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/10">
            <FileSearch className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Document Analysis</h2>
            <p className="text-xs text-slate-500">
              {viewMode === 'upload' && 'Upload a document for threat intelligence analysis'}
              {viewMode === 'uploading' && 'Analyzing document content...'}
              {viewMode === 'completed' && 'Analysis complete — review findings below'}
              {viewMode === 'failed' && 'Analysis encountered an error'}
            </p>
          </div>
        </div>

        {/* Show "New Analysis" button when viewing results */}
        {viewMode === 'completed' && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewAnalysis}
            leftIcon={<X className="w-4 h-4" />}
          >
            New Analysis
          </Button>
        )}
      </div>

      {/* Main content area - switches between upload, loading, results, error */}
      <Card variant="default" padding="none">
        <CardContent className="p-0">
          <AnimatePresence mode="wait">
            {/* ---------- UPLOAD / IDLE ---------- */}
            {viewMode === 'upload' && (
              <motion.div
                key="upload"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <UploadZone
                  selectedFile={selectedFile}
                  dragActive={dragActive}
                  isUploading={false}
                  onFileSelect={handleFileSelect}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClear={handleClear}
                  onAnalyze={handleAnalyze}
                />
              </motion.div>
            )}

            {/* ---------- UPLOADING ---------- */}
            {viewMode === 'uploading' && (
              <motion.div
                key="uploading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="p-6">
                  <UploadZone
                    selectedFile={selectedFile}
                    dragActive={false}
                    isUploading={true}
                    onFileSelect={handleFileSelect}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClear={handleClear}
                    onAnalyze={handleAnalyze}
                  />
                  <UploadingOverlay />
                </div>
              </motion.div>
            )}

            {/* ---------- COMPLETED ---------- */}
            {viewMode === 'completed' && currentAnalysis && (
              <motion.div
                key="completed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="p-5 space-y-5"
              >
                {/* 1. Threat Score Gauge */}
                <ThreatScoreGauge
                  score={currentAnalysis.threatScore}
                  threatLevel={currentAnalysis.threatLevel}
                />

                {/* 2. Summary Card */}
                <AnalysisSummaryCard analysis={currentAnalysis} />

                {/* 3. AI Assessment (LLM second opinion) */}
                <AiInsightsCard insights={currentAnalysis.aiInsights} />

                {/* 4. Findings */}
                {currentAnalysis.findings && currentAnalysis.findings.length > 0 && (
                  <FindingsSection findings={currentAnalysis.findings} />
                )}

                {/* 4. IocPanel */}
                {currentAnalysis.iocs && currentAnalysis.iocs.length > 0 && (
                  <IocPanel iocs={currentAnalysis.iocs as any[]} />
                )}

                {/* 5. Document Sections */}
                {currentAnalysis.sections && currentAnalysis.sections.length > 0 && (
                  <DocumentSectionsSection sections={currentAnalysis.sections} />
                )}

                {/* 6. MITRE Techniques */}
                <MitreTechniquesSection
                  techniques={currentAnalysis.mitreTechniques || []}
                  tactics={currentAnalysis.mitreTactics || []}
                />

                {/* Bottom action bar */}
                <div className="flex items-center justify-center pt-2 pb-1">
                  <Button
                    variant="outline"
                    size="md"
                    onClick={handleNewAnalysis}
                    leftIcon={<FileText className="w-4 h-4" />}
                  >
                    Analyze Another Document
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ---------- FAILED ---------- */}
            {viewMode === 'failed' && (
              <motion.div
                key="failed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ErrorState
                  error={error || 'An unexpected error occurred during analysis.'}
                  onRetry={handleRetry}
                  onClear={handleClear}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}

export default DocumentAnalysisView;
