/**
 * MITRE ATT&CK Heatmap Component
 * Enterprise-grade visualization of attack techniques
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useTheme } from '../../providers/ThemeProvider';
import { cn } from '../../design-system';

interface TechniqueData {
  id: string;
  name: string;
  count: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description?: string;
}

interface TacticData {
  id: string;
  name: string;
  techniques: TechniqueData[];
}

interface MITREHeatmapProps {
  data?: TacticData[];
  title?: string;
}

const severityColors = {
  critical: { bg: 'bg-red-600', text: 'text-red-600', ring: 'ring-red-500/30' },
  high: { bg: 'bg-orange-500', text: 'text-orange-500', ring: 'ring-orange-500/30' },
  medium: { bg: 'bg-amber-500', text: 'text-amber-500', ring: 'ring-amber-500/30' },
  low: { bg: 'bg-emerald-500', text: 'text-emerald-500', ring: 'ring-emerald-500/30' },
};

export function MITREHeatmap({ data, title = 'MITRE ATT&CK Heatmap' }: MITREHeatmapProps) {
  const { isDark } = useTheme();
  const [expandedTactic, setExpandedTactic] = useState<string | null>(null);
  const [hoveredTechnique, setHoveredTechnique] = useState<string | null>(null);

  const tactics = data || [];
  const maxCount = Math.max(1, ...tactics.flatMap((t) => t.techniques.map((tech) => tech.count || 0)));

  const getIntensity = (count: number) => {
    const ratio = count / maxCount;
    if (ratio >= 0.8) return 'opacity-100';
    if (ratio >= 0.6) return 'opacity-80';
    if (ratio >= 0.4) return 'opacity-60';
    if (ratio >= 0.2) return 'opacity-40';
    return 'opacity-20';
  };

  const getSeverityColor = (severity: keyof typeof severityColors) => {
    return severityColors[severity];
  };

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden',
      isDark ? 'bg-[var(--surface-container-low)]  border-[var(--border-subtle)] ' : 'bg-white border-[var(--border-subtle)]'
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between px-5 py-4 border-b',
        isDark ? 'border-[var(--border-subtle)] ' : 'border-[var(--border-subtle)]'
      )}>
        <div className="flex items-center gap-3">
          <Shield className={cn('w-5 h-5', isDark ? 'text-[var(--text-secondary)] ' : 'text-[var(--text-secondary)]')} />
          <h3 className={cn(
            'text-base font-semibold',
            isDark ? 'text-[var(--text-primary)] ' : 'text-[var(--text-primary)]'
          )}>
            {title}
          </h3>
        </div>

        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-xs',
              isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)] '
            )}>
              Intensity:
            </span>
            <div className="flex gap-0.5">
              {['#ef4444', '#ef444499', '#ef44444d'].map((color, i) => (
                <div
                  key={i}
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Severity Legend */}
          <div className="flex items-center gap-3">
            {Object.entries(severityColors).map(([severity, colors]) => (
              <div key={severity} className="flex items-center gap-1">
                <div className={cn('w-2 h-2 rounded-full', colors.bg)} />
                <span className={cn(
                  'text-xs capitalize',
                  isDark ? 'text-[var(--text-secondary)] ' : 'text-[var(--text-secondary)]'
                )}>
                  {severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="p-5">
        {tactics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Shield className="w-12 h-12 text-[var(--text-secondary)]  mb-3" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">No MITRE ATT&CK data available</p>
            <p className="text-xs text-[var(--text-secondary)]  mt-1">Technique mapping will appear after analysis</p>
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {tactics.map((tactic) => {
            const isExpanded = expandedTactic === tactic.id;
            return (
              <motion.div
                key={tactic.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'rounded-xl border overflow-hidden',
                  isDark ? 'bg-[var(--surface-container-low)]  border-[var(--border-subtle)] ' : 'bg-[var(--surface-container-lowest)] border-[var(--border-subtle)]'
                )}
              >
                {/* Tactic Header */}
                <div
                  onClick={() => setExpandedTactic(isExpanded ? null : tactic.id)}
                  className={cn(
                    'flex items-center justify-between px-4 py-3 cursor-pointer',
                    'transition-colors',
                    isDark ? 'hover:bg-[var(--surface-container-low)] ' : 'hover:bg-[var(--surface-container-low)]'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'text-xs font-mono font-bold',
                      isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)] '
                    )}>
                      {tactic.id}
                    </span>
                    <span className={cn(
                      'text-sm font-semibold',
                      isDark ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                    )}>
                      {tactic.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      isDark ? 'bg-[var(--surface-container-low)]  text-[var(--text-secondary)] ' : 'bg-[var(--surface-container)] text-[var(--text-secondary)]'
                    )}>
                      {tactic.techniques.length} techniques
                    </span>
                    {isExpanded ? (
                      <ChevronDown className={cn(
                        'w-4 h-4',
                        isDark ? 'text-[var(--text-secondary)] ' : 'text-[var(--text-secondary)]'
                      )} />
                    ) : (
                      <ChevronRight className={cn(
                        'w-4 h-4',
                        isDark ? 'text-[var(--text-secondary)] ' : 'text-[var(--text-secondary)]'
                      )} />
                    )}
                  </div>
                </div>

                {/* Techniques Preview (always visible) */}
                <div className="px-4 pb-3">
                  <div className="flex flex-wrap gap-1.5">
                    {tactic.techniques.map((tech) => {
                      const colors = getSeverityColor(tech.severity);
                      return (
                        <div
                          key={tech.id}
                          onMouseEnter={() => setHoveredTechnique(tech.id)}
                          onMouseLeave={() => setHoveredTechnique(null)}
                          className={cn(
                            'relative px-2 py-1 rounded text-xs font-mono cursor-help',
                            'transition-all duration-150',
                            colors.bg,
                            'text-white',
                            getIntensity(tech.count)
                          )}
                        >
                          {tech.id}
                          {hoveredTechnique === tech.id && (
                            <div className={cn(
                              'absolute z-10 left-0 top-full mt-2 p-3 rounded-lg shadow-xl w-48',
                              isDark ? 'bg-[var(--surface-container-low)]  border border-[var(--border-subtle)] ' : 'bg-white border border-[var(--border-subtle)]'
                            )}>
                              <p className={cn(
                                'text-sm font-semibold',
                                isDark ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                              )}>
                                {tech.name}
                              </p>
                              <p className={cn(
                                'text-xs mt-1',
                                isDark ? 'text-[var(--text-secondary)] ' : 'text-[var(--text-secondary)]'
                              )}>
                                Count: {tech.count}
                              </p>
                              <span className={cn(
                                'inline-block mt-2 text-xs font-medium capitalize',
                                colors.text
                              )}>
                                {tech.severity} severity
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className={cn(
                      'border-t px-4 py-3 space-y-2',
                      isDark ? 'border-[var(--border-subtle)] ' : 'border-[var(--border-subtle)]'
                    )}
                  >
                    {tactic.techniques.map((tech) => {
                      const colors = getSeverityColor(tech.severity);
                      return (
                        <div
                          key={tech.id}
                          className={cn(
                            'flex items-center justify-between p-2 rounded-lg',
                            isDark ? 'bg-[var(--surface-container-low)] ' : 'bg-[var(--surface-container-low)]'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              'text-xs font-mono font-bold px-1.5 py-0.5 rounded',
                              isDark ? 'bg-slate-600 text-[var(--text-secondary)] ' : 'bg-[var(--surface-container)] text-[var(--text-secondary)]'
                            )}>
                              {tech.id}
                            </span>
                            <span className={cn(
                              'text-sm',
                              isDark ? 'text-[var(--text-secondary)] ' : 'text-[var(--text-secondary)]'
                            )}>
                              {tech.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              'w-20 h-2 rounded-full overflow-hidden',
                              isDark ? 'bg-[var(--surface-container-low)] ' : 'bg-[var(--surface-container)]'
                            )}>
                              <div
                                className={cn('h-full rounded-full', colors.bg)}
                                style={{ width: `${(tech.count / maxCount) * 100}%` }}
                              />
                            </div>
                            <span className={cn(
                              'text-xs font-medium w-6 text-right',
                              isDark ? 'text-[var(--text-secondary)] ' : 'text-[var(--text-secondary)]'
                            )}>
                              {tech.count}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}

export default MITREHeatmap;
