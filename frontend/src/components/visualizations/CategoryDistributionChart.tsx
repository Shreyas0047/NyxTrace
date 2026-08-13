/**
 * CategoryDistributionChart
 * Custom CSS/SVG horizontal bar chart of event category distribution
 */

import { motion } from 'framer-motion';

export interface CategorySlice {
  category: string;
  count: number;
  color: string;
}

const DEFAULT_COLORS: Record<string, string> = {
  process: '#f59e0b',
  file: '#8b5cf6',
  registry: '#d97706',
  network: '#3b82f6',
  system: '#64748b',
  behavior: '#ea580c',
  wmi: '#06b6d4',
};

export function CategoryDistributionChart({
  data,
  total,
  title = 'Event Categories',
}: {
  data: CategorySlice[];
  total: number;
  title?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const sorted = [...data].sort((a, b) => b.count - a.count);

  return (
    <div className="p-4 bg-[var(--surface-container-lowest)] rounded-lg">
      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-3">{title}</p>
      {sorted.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)] py-2">No event data available</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((d) => {
            const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
            return (
              <div key={d.category}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[var(--text-secondary)] font-medium capitalize">{d.category}</span>
                  <span className="text-[var(--text-primary)] font-mono">{d.count} · {pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface-container)] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(2, (d.count / max) * 100)}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: d.color || DEFAULT_COLORS[d.category] || '#f59e0b' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
