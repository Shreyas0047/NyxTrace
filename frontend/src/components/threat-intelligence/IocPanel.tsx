/**
 * IocPanel - Extracted Indicators of Compromise display
 * Groups IOCs by type with accordion expandable sections and search/filter
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  Fingerprint,
  Network,
  AtSign,
  FileCode,
  Workflow,
  HardDrive,
  Search,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { cn } from '../../design-system';

// ============================================
// Types
// ============================================
export interface ExtractedIOC {
  type: 'ip' | 'domain' | 'url' | 'hash' | 'email' | 'registry' | 'process' | 'filepath';
  value: string;
  context: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  mitreMapping?: string;
}

interface IocPanelProps {
  iocs: ExtractedIOC[];
  className?: string;
}

// ============================================
// Severity colors
// ============================================
const severityColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  critical: { bg: 'bg-red-500/20', text: 'text-red-600 ', border: 'border-red-500/30', dot: 'bg-red-400' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-600 ', border: 'border-orange-500/30', dot: 'bg-orange-400' },
  medium: { bg: 'bg-amber-500/20', text: 'text-amber-600 ', border: 'border-amber-500/30', dot: 'bg-amber-400' },
  low: { bg: 'bg-emerald-500/20', text: 'text-emerald-600 ', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  info: { bg: 'bg-sky-500/20', text: 'text-sky-600 ', border: 'border-sky-500/30', dot: 'bg-sky-400' },
};

// ============================================
// IOC type configuration
// ============================================
interface IocTypeConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const iocTypeConfig: Record<string, IocTypeConfig> = {
  ip: { label: 'IP Addresses', icon: Network, description: 'Suspicious IP addresses and hosts' },
  domain: { label: 'Domains', icon: Globe, description: 'Malicious domains and DNS indicators' },
  url: { label: 'URLs', icon: Globe, description: 'Suspicious URLs and paths' },
  hash: { label: 'File Hashes', icon: Fingerprint, description: 'MD5, SHA-1, SHA-256 file hashes' },
  email: { label: 'Email Addresses', icon: AtSign, description: 'Phishing and malicious email addresses' },
  registry: { label: 'Registry Keys', icon: FileCode, description: 'Suspicious Windows registry modifications' },
  process: { label: 'Process Names', icon: Workflow, description: 'Malicious process and service names' },
  filepath: { label: 'File Paths', icon: HardDrive, description: 'Suspicious file system locations' },
};

// ============================================
// Sub-components
// ============================================

function IocTypeIcon({ type, className }: { type: string; className?: string }) {
  const config = iocTypeConfig[type];
  if (!config) return null;
  const IconComponent = config.icon;
  return <IconComponent className={cn('w-4 h-4 flex-shrink-0', className)} />;
}

function SeverityDot({ severity }: { severity: string }) {
  const colors = severityColors[severity] || severityColors.info;
  return (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full flex-shrink-0',
        colors.dot
      )}
    />
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors = severityColors[severity] || severityColors.info;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border',
        colors.bg,
        colors.text,
        colors.border
      )}
    >
      <SeverityDot severity={severity} />
      {severity}
    </span>
  );
}

// ============================================
// Main Component
// ============================================

export function IocPanel({ iocs, className }: IocPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  // Filter and group IOCs
  const { groupedIocs, iocTypeOrder } = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    const filtered = query
      ? iocs.filter(
          (ioc) =>
            ioc.value.toLowerCase().includes(query) ||
            ioc.context.toLowerCase().includes(query) ||
            ioc.type.toLowerCase().includes(query) ||
            ioc.severity.toLowerCase().includes(query)
        )
      : iocs;

    const grouped: Record<string, ExtractedIOC[]> = {};
    filtered.forEach((ioc) => {
      if (!grouped[ioc.type]) grouped[ioc.type] = [];
      grouped[ioc.type].push(ioc);
    });

    const typeOrder = Object.keys(iocTypeConfig).filter((t) => grouped[t]);
    return { groupedIocs: grouped, iocTypeOrder: typeOrder };
  }, [iocs, searchQuery]);

  // Auto-expand groups that have results when searching
  React.useEffect(() => {
    if (searchQuery.trim()) {
      setExpandedTypes(new Set(iocTypeOrder));
    } else {
      setExpandedTypes(new Set());
    }
  }, [searchQuery, iocTypeOrder]);

  const toggleType = (type: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const totalIocs = iocs.length;
  const criticalCount = iocs.filter((i) => i.severity === 'critical').length;

  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--border-subtle)]  bg-white  shadow-sm overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border-subtle)] ">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)] ">
              Indicators of Compromise
            </h3>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)] ">
              {totalIocs} IOC{totalIocs !== 1 ? 's' : ''} extracted
              {criticalCount > 0 && (
                <span className="ml-1.5 text-red-600  font-medium">
                  ({criticalCount} critical)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]  " />
          <input
            type="text"
            placeholder="Filter IOCs by value, type, or severity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'w-full pl-10 pr-4 py-2 text-sm rounded-lg border',
              'bg-[var(--surface-container-lowest)] ',
              'border-[var(--border-subtle)] ',
              'text-[var(--text-primary)] ',
              'placeholder-slate-400 ',
              'focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50',
              'transition-colors duration-150'
            )}
          />
        </div>
      </div>

      {/* IOC Groups */}
      <div className="divide-y divide-[var(--border-subtle)] ">
        {iocTypeOrder.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-5">
            <Search className="w-8 h-8 text-[var(--text-secondary)]   mb-3" />
            <p className="text-sm text-[var(--text-secondary)] ">
              {searchQuery
                ? 'No IOCs match your search query'
                : 'No indicators of compromise found'}
            </p>
          </div>
        ) : (
          iocTypeOrder.map((type) => {
            const config = iocTypeConfig[type];
            const items = groupedIocs[type];
            const isExpanded = expandedTypes.has(type);
            const typeCriticalCount = items.filter((i) => i.severity === 'critical').length;

            return (
              <div key={type} className="group">
                {/* Accordion header */}
                <button
                  onClick={() => toggleType(type)}
                  className={cn(
                    'w-full flex items-center gap-3 px-5 py-3 text-left',
                    'hover:bg-[var(--surface-container-lowest)] ',
                    'transition-colors duration-150'
                  )}
                >
                  <IocTypeIcon
                    type={type}
                    className="text-[var(--text-secondary)] "
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-[var(--text-primary)] ">
                      {config.label}
                    </span>
                    <span className="ml-2 text-xs text-[var(--text-secondary)]  ">
                      ({items.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {typeCriticalCount > 0 && (
                      <span className="text-[10px] font-semibold text-red-600  bg-red-500/10 px-1.5 py-0.5 rounded">
                        {typeCriticalCount} critical
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]  " />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]  " />
                    )}
                  </div>
                </button>

                {/* Accordion content */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      key={`${type}-content`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-3 space-y-2">
                        {items.map((ioc, idx) => (
                          <motion.div
                            key={`${type}-${idx}`}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.15, delay: idx * 0.03 }}
                            className={cn(
                              'flex items-start gap-3 p-3 rounded-lg border',
                              'bg-[var(--surface-container-lowest)] ',
                              'border-[var(--border-subtle)] ',
                              'group/ioc hover:bg-[var(--surface-container-low)] ',
                              'transition-colors duration-150'
                            )}
                          >
                            <SeverityDot severity={ioc.severity} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <code className="text-xs font-mono font-medium text-[var(--text-primary)]  break-all">
                                  {ioc.value}
                                </code>
                                <SeverityBadge severity={ioc.severity} />
                              </div>
                              <p className="mt-1 text-xs text-[var(--text-secondary)]  line-clamp-2">
                                {ioc.context}
                              </p>
                              {ioc.mitreMapping && (
                                <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-medium text-violet-500   bg-violet-500/10 px-1.5 py-0.5 rounded">
                                  MITRE: {ioc.mitreMapping}
                                </span>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      {/* Footer summary */}
      {totalIocs > 0 && (
        <div className="px-5 py-3 border-t border-[var(--border-subtle)]  bg-[var(--surface-container-lowest)] ">
          <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)] ">
            <span className="flex items-center gap-1">
              <Network className="w-3.5 h-3.5" />
              {(groupedIocs.ip?.length || 0)} IPs
            </span>
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" />
              {(groupedIocs.domain?.length || 0) + (groupedIocs.url?.length || 0)} URLs/Domains
            </span>
            <span className="flex items-center gap-1">
              <Fingerprint className="w-3.5 h-3.5" />
              {groupedIocs.hash?.length || 0} Hashes
            </span>
            <span className="flex items-center gap-1">
              <AtSign className="w-3.5 h-3.5" />
              {groupedIocs.email?.length || 0} Emails
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default IocPanel;
