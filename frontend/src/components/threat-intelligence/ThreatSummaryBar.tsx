/**
 * ThreatSummaryBar - Aggregate threat intelligence metrics dashboard bar
 * Displays 5 key summary statistics in a horizontal row
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  FileSearch,
  AlertTriangle,
  Globe,
  FileText,
  Fingerprint,
} from 'lucide-react';
import { cn } from '../../design-system';
import { Card, CardContent } from '../ui/Card';

// ============================================
// Types
// ============================================
interface ThreatSummary {
  totalAnalyses: number;
  totalIOCs: number;
  criticalFindings: number;
  maliciousUrls: number;
  maliciousDocuments: number;
}

interface ThreatSummaryBarProps {
  summary: ThreatSummary;
  className?: string;
}

// ============================================
// Stat card configuration
// ============================================
interface StatConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  iconBgClass: string;
  format?: (value: number) => string;
}

const statConfigs: Record<keyof ThreatSummary, StatConfig> = {
  totalAnalyses: {
    label: 'Total Analyses',
    icon: FileSearch,
    colorClass: 'text-cyan-500',
    iconBgClass: 'bg-cyan-500/10',
  },
  totalIOCs: {
    label: 'IOCs Extracted',
    icon: AlertTriangle,
    colorClass: 'text-amber-500',
    iconBgClass: 'bg-amber-500/10',
  },
  criticalFindings: {
    label: 'Critical Findings',
    icon: Fingerprint,
    colorClass: 'text-red-500',
    iconBgClass: 'bg-red-500/10',
  },
  maliciousUrls: {
    label: 'Malicious URLs',
    icon: Globe,
    colorClass: 'text-orange-500',
    iconBgClass: 'bg-orange-500/10',
  },
  maliciousDocuments: {
    label: 'Malicious Docs',
    icon: FileText,
    colorClass: 'text-violet-500',
    iconBgClass: 'bg-violet-500/10',
  },
};

// ============================================
// Sub-components
// ============================================

interface StatBoxProps {
  config: StatConfig;
  value: number;
  index: number;
}

function StatBox({ config, value, index }: StatBoxProps) {
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: index * 0.08,
        ease: 'easeOut',
      }}
      className="flex-1 min-w-0"
    >
      <Card variant="default" padding="md" className="h-full">
        <CardContent className="flex items-center gap-3 p-4">
          {/* Icon */}
          <div
            className={cn(
              'flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0',
              config.iconBgClass
            )}
          >
            <Icon className={cn('w-5 h-5', config.colorClass)} />
          </div>

          {/* Value and label */}
          <div className="flex-1 min-w-0">
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.4,
                delay: index * 0.08 + 0.15,
                ease: 'easeOut',
              }}
              className={cn(
                'block text-2xl font-bold leading-none mb-1',
                config.colorClass
              )}
            >
              {value.toLocaleString()}
            </motion.span>
            <span className="block text-xs text-[var(--text-secondary)]  truncate">
              {config.label}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================
// Main Component
// ============================================

export function ThreatSummaryBar({ summary, className }: ThreatSummaryBarProps) {
  const keys = Object.keys(statConfigs) as Array<keyof ThreatSummary>;

  return (
    <div
      className={cn(
        'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3',
        className
      )}
    >
      {keys.map((key, index) => (
        <StatBox
          key={key}
          config={statConfigs[key]}
          value={summary[key]}
          index={index}
        />
      ))}
    </div>
  );
}

export default ThreatSummaryBar;
