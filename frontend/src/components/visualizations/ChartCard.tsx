/**
 * ChartCard
 * Dossier-style container for data visualizations: eyebrow title, optional
 * stamp/action, hairline, and padded body. Used across showcase pages.
 */

import type { ReactNode } from 'react';
import { cn } from '../../design-system';

interface ChartCardProps {
  title?: string;
  subtitle?: string;
  stamp?: string;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, stamp, action, className, bodyClassName, children }: ChartCardProps) {
  return (
    <section
      className={cn(
        'bg-[var(--surface-bright)] rounded-2xl border border-[var(--border-subtle)] shadow-sm overflow-hidden',
        className
      )}
    >
      {(title || action || stamp) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            {title && <p className="eyebrow">{title}</p>}
            {subtitle && (
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {stamp && <span className="stamp">{stamp}</span>}
            {action}
          </div>
        </header>
      )}
      {title && <div className="hairline mx-5" aria-hidden />}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export default ChartCard;
