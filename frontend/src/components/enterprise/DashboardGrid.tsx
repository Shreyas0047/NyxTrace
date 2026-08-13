/**
 * Enterprise Dashboard Grid
 * Modular dashboard layout system
 */

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../design-system';

type GridColumn = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
type GridRow = 1 | 2 | 3 | 4 | 5 | 6;

interface DashboardGridProps {
  children: React.ReactNode;
  className?: string;
}

export function DashboardGrid({ children, className }: DashboardGridProps) {
  return (
    <div className={cn('grid gap-6', className)}>
      {children}
    </div>
  );
}

interface DashboardCardProps {
  children: React.ReactNode;
  className?: string;
  span?: GridColumn;
  rowSpan?: GridRow;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  hover?: boolean;
  onClick?: () => void;
}

export function DashboardCard({
  children,
  className,
  span,
  rowSpan,
  header,
  footer,
  hover = false,
  onClick,
}: DashboardCardProps) {
  const spanClass = span ? `lg:col-span-${span}` : '';
  const rowSpanClass = rowSpan ? `lg:row-span-${rowSpan}` : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      whileHover={hover ? { y: -2 } : undefined}
      onClick={onClick}
      className={cn(
        'bg-white  rounded-xl border border-[var(--border-subtle)] ',
        'shadow-sm',
        hover && 'cursor-pointer transition-shadow hover:shadow-md',
        spanClass,
        rowSpanClass,
        className
      )}
    >
      {header && (
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] ">
          {header}
        </div>
      )}
      <div className="p-5">
        {children}
      </div>
      {footer && (
        <div className="px-5 py-4 border-t border-[var(--border-subtle)]  bg-[var(--surface-container-lowest)]  rounded-b-xl">
          {footer}
        </div>
      )}
    </motion.div>
  );
}

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function DashboardHeader({ title, subtitle, action, className }: DashboardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between', className)}>
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] ">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-sm text-[var(--text-secondary)] ">
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <div className="flex items-center gap-2">
          {action}
        </div>
      )}
    </div>
  );
}

interface DashboardStatProps {
  label: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
  };
  icon?: React.ReactNode;
  className?: string;
  delta?: string;
}

export function DashboardStat({ label, value, change, icon, delta, className }: DashboardStatProps) {
  const getChangeColor = () => {
    if (!change) return '';
    switch (change.type) {
      case 'increase': return 'text-emerald-600  ';
      case 'decrease': return 'text-red-600  ';
      default: return 'text-[var(--text-secondary)] ';
    }
  };

  const getChangeIcon = () => {
    if (!change) return null;
    if (change.type === 'increase') return '↑';
    if (change.type === 'decrease') return '↓';
    return '→';
  };

  return (
    <div className={cn('flex items-center justify-between', className)}>
      <div>
        <p className="text-sm text-[var(--text-secondary)] ">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)] ">
          {value}
        </p>
        {change && (
          <p className={cn('mt-1 text-xs flex items-center gap-1', getChangeColor())}>
            <span>{getChangeIcon()}</span>
            <span>{Math.abs(change.value)}%</span>
            <span className="text-[var(--text-tertiary)] ">vs last period</span>
          </p>
        )}
        {delta && !change && (
          <p className="mt-1 text-xs text-[var(--text-tertiary)] ">{delta}</p>
        )}
      </div>
      {icon && (
        <div className="w-10 h-10 rounded-xl bg-[var(--surface-container-low)]  flex items-center justify-center">
          {icon}
        </div>
      )}
    </div>
  );
}

interface DashboardListProps {
  items: Array<{
    id: string;
    title: string;
    subtitle?: string;
    meta?: React.ReactNode;
    status?: 'default' | 'active' | 'warning' | 'error';
  }>;
  onItemClick?: (id: string) => void;
  renderItem?: (item: DashboardListProps['items'][0]) => React.ReactNode;
  className?: string;
}

export function DashboardList({ items, onItemClick, renderItem, className }: DashboardListProps) {
  const getStatusClasses = (status?: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-100  text-emerald-700  ';
      case 'warning': return 'bg-amber-100  text-amber-700  ';
      case 'error': return 'bg-red-100  text-red-700  ';
      default: return 'bg-[var(--surface-container-low)]  text-[var(--text-secondary)] ';
    }
  };

  return (
    <div className={cn('divide-y divide-[var(--border-subtle)] ', className)}>
      {items.map((item) => (
        <div
          key={item.id}
          onClick={() => onItemClick?.(item.id)}
          className={cn(
            'px-5 py-4 transition-colors',
            onItemClick && 'cursor-pointer hover:bg-[var(--surface-container-lowest)] '
          )}
        >
          {renderItem ? (
            renderItem(item)
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]  truncate">
                  {item.title}
                </p>
                {item.subtitle && (
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]  truncate">
                    {item.subtitle}
                  </p>
                )}
              </div>
              {item.meta && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.status && (
                    <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', getStatusClasses(item.status))}>
                      {item.status}
                    </span>
                  )}
                  {item.meta}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface DashboardChartProps {
  children: React.ReactNode;
  height?: string;
  className?: string;
}

export function DashboardChart({ children, height = '200px', className }: DashboardChartProps) {
  return (
    <div className={className} style={{ height }}>
      {children}
    </div>
  );
}

export default DashboardGrid;