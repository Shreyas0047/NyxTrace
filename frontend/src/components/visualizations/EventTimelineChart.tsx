/**
 * EventTimelineChart
 * Custom SVG area chart of event activity over time (events per minute bucket)
 */

import { useMemo } from 'react';

const CATEGORY_COLORS: Record<string, string> = {
  process: '#f59e0b',
  file: '#8b5cf6',
  registry: '#d97706',
  network: '#3b82f6',
  system: '#64748b',
  behavior: '#ea580c',
  wmi: '#06b6d4',
  other: '#94a3b8',
};

export interface TimelinePoint {
  label: string;
  buckets: Record<string, number>;
}

export function EventTimelineChart({
  points,
  title = 'Event Timeline',
}: {
  points: TimelinePoint[];
  title?: string;
}) {
  const { path, areaPath, categories, maxCount } = useMemo(() => {
    const categories: string[] = [];
    for (const p of points) {
      for (const cat of Object.keys(p.buckets)) {
        if (!categories.includes(cat)) categories.push(cat);
      }
    }
    if (categories.length === 0) return { path: '', areaPath: '', categories, maxCount: 0 };

    const W = 600;
    const H = 150;
    const PAD = 8;
    const maxCount = Math.max(1, ...points.map((p) => Object.values(p.buckets).reduce((a, b) => a + b, 0)));

    const x = (i: number) => (points.length <= 1 ? W / 2 : PAD + (i / (points.length - 1)) * (W - PAD * 2));
    const y = (count: number) => H - PAD - (count / maxCount) * (H - PAD * 2);

    const totalByPoint = points.map((p) => Object.values(p.buckets).reduce((a, b) => a + b, 0));

    const path = totalByPoint.map((count, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(count).toFixed(1)}`).join(' ');
    const areaPath = points.length > 0
      ? `${path} L${x(points.length - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`
      : '';

    return { path, areaPath, categories, maxCount };
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="p-4 bg-[var(--surface-container-lowest)] rounded-lg">
        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-3">{title}</p>
        <p className="text-sm text-[var(--text-secondary)] py-2">No event data available</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-[var(--surface-container-lowest)] rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase">{title}</p>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <span key={cat} className="inline-flex items-center gap-1 text-[10px] text-[var(--text-secondary)] capitalize">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] || CATEGORY_COLORS.other }} />
              {cat}
            </span>
          ))}
        </div>
      </div>
      <svg viewBox="0 0 600 160" className="w-full h-auto">
        <defs>
          <linearGradient id="timelineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {areaPath && <path d={areaPath} fill="url(#timelineFill)" />}
        {path && (
          <path
            d={path}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="flex justify-between mt-1 text-[10px] text-[var(--text-secondary)]">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
      {maxCount === 0 && (
        <p className="text-sm text-[var(--text-secondary)] py-1">No events in the collected window</p>
      )}
    </div>
  );
}
