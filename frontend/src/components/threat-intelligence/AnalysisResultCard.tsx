/**
 * AnalysisResultCard - Individual threat analysis result card
 * Displays file/URL analysis with threat level, findings, and confidence
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Globe,
  AlertTriangle,
  Shield,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../design-system';
import { Card, CardContent } from '../ui/Card';
import type { ExtractedIOC } from './IocPanel';

// ============================================
// Types
// ============================================
export interface ThreatIntelAnalysis {
  id: string;
  type: 'document' | 'url' | 'ioc_collection';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileName?: string;
  fileSize?: number;
  url?: string;
  threatScore: number;
  threatLevel: 'critical' | 'high' | 'medium' | 'low' | 'benign';
  confidence: number;
  summary: string;
  iocs: ExtractedIOC[];
  mitreTechniques: string[];
  mitreTactics: string[];
  findings: Array<{
    id: string;
    title: string;
    description: string;
    severity: string;
    category: string;
    confidence: number;
    evidence: string[];
  }>;
  analyzedAt: string;
}

interface AnalysisResultCardProps {
  analysis: ThreatIntelAnalysis;
  onClick?: () => void;
  className?: string;
}

// ============================================
// Threat level configuration
// ============================================
interface ThreatLevelConfig {
  label: string;
  bg: string;
  text: string;
  border: string;
  icon: React.ComponentType<{ className?: string }>;
}

const threatLevelConfig: Record<string, ThreatLevelConfig> = {
  critical: {
    label: 'Critical',
    bg: 'bg-red-500/20',
    text: 'text-red-600 ',
    border: 'border-red-500/30',
    icon: AlertTriangle,
  },
  high: {
    label: 'High',
    bg: 'bg-orange-500/20',
    text: 'text-orange-600 ',
    border: 'border-orange-500/30',
    icon: AlertTriangle,
  },
  medium: {
    label: 'Medium',
    bg: 'bg-amber-500/20',
    text: 'text-amber-600 ',
    border: 'border-amber-500/30',
    icon: Shield,
  },
  low: {
    label: 'Low',
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-600 ',
    border: 'border-emerald-500/30',
    icon: Shield,
  },
  benign: {
    label: 'Benign',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600 ',
    border: 'border-emerald-500/20',
    icon: Shield,
  },
};

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

function confidenceColor(confidence: number): string {
  if (confidence >= 80) return 'bg-emerald-500';
  if (confidence >= 60) return 'bg-cyan-500';
  if (confidence >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

// ============================================
// Main Component
// ============================================

export function AnalysisResultCard({ analysis, onClick, className }: AnalysisResultCardProps) {
  const threatConfig = threatLevelConfig[analysis.threatLevel] || threatLevelConfig.benign;
  const ThreatIcon = threatConfig.icon;
  const iocs = analysis.iocs || [];
  const findings = analysis.findings || [];
  const mitreTechniques = analysis.mitreTechniques || [];
  const confidence = Math.max(0, Math.min(100, Number(analysis.confidence) || 0));

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      className={cn(
        'w-full text-left rounded-xl',
        'bg-white ',
        'border border-[var(--border-subtle)] ',
        'shadow-sm hover:shadow-md',
        'transition-all duration-200',
        onClick && 'cursor-pointer',
        className
      )}
    >
      <Card variant="ghost" padding="none">
        <CardContent className="p-4">
          {/* Top row: icon, title, threat badge */}
          <div className="flex items-start gap-3">
            {/* Type icon */}
            <div
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0',
                analysis.type === 'url'
                  ? 'bg-sky-500/10 text-sky-500'
                  : analysis.type === 'ioc_collection'
                  ? 'bg-violet-500/10 text-violet-500'
                  : 'bg-[var(--surface-container)] text-[var(--text-secondary)]'
              )}
            >
              {analysis.type === 'url' ? (
                <Globe className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-[var(--text-primary)]  truncate">
                  {analysis.fileName || analysis.url || 'Unknown source'}
                </span>
                {analysis.fileSize && (
                  <span className="text-[10px] text-[var(--text-secondary)]   flex-shrink-0">
                    {formatFileSize(analysis.fileSize)}
                  </span>
                )}
              </div>

              <p className="text-xs text-[var(--text-secondary)]  line-clamp-2 mb-3">
                {analysis.summary}
              </p>

              {/* Stats row */}
              <div className="flex items-center gap-4 flex-wrap">
                {/* Threat level badge */}
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border',
                    threatConfig.bg,
                    threatConfig.text,
                    threatConfig.border
                  )}
                >
                  <ThreatIcon className="w-3 h-3" />
                  {threatConfig.label}
                </span>

                {/* IOC count */}
                {iocs.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] ">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {iocs.length} IOC{iocs.length !== 1 ? 's' : ''}
                  </span>
                )}

                {/* Finding count */}
                {findings.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] ">
                    <Shield className="w-3.5 h-3.5" />
                    {findings.length} finding{findings.length !== 1 ? 's' : ''}
                  </span>
                )}

                {/* Timestamp */}
                <span className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]   ml-auto">
                  <Clock className="w-3 h-3" />
                  {formatTimestamp(analysis.analyzedAt)}
                </span>
              </div>

              {/* Confidence bar */}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] font-medium text-[var(--text-secondary)]  flex-shrink-0">
                  Confidence
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-container)]  overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${confidence}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={cn('h-full rounded-full', confidenceColor(confidence))}
                  />
                </div>
                <span className="text-[10px] font-medium text-[var(--text-secondary)]  flex-shrink-0 w-8 text-right">
                  {confidence}%
                </span>
              </div>

              {/* MITRE techniques */}
              {mitreTechniques.length > 0 && (
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  {mitreTechniques.slice(0, 3).map((technique) => (
                    <span
                      key={technique}
                      className="text-[10px] font-medium text-violet-500   bg-violet-500/10 px-1.5 py-0.5 rounded"
                    >
                      {technique}
                    </span>
                  ))}
                  {mitreTechniques.length > 3 && (
                    <span className="text-[10px] text-[var(--text-secondary)]  ">
                      +{mitreTechniques.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Chevron */}
            {onClick && (
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]   flex-shrink-0 mt-1" />
            )}
          </div>
        </CardContent>
      </Card>
    </motion.button>
  );
}

export default AnalysisResultCard;
