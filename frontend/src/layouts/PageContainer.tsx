import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../design-system';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  eyebrow?: string;
  stamp?: string;
}

export function PageHeader({ title, subtitle, actions, badge, eyebrow, stamp }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-start justify-between gap-4 mb-6"
    >
      <div className="flex-1 min-w-0">
        {eyebrow && (
          <p className="eyebrow mb-1.5">{eyebrow}</p>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-display-2 text-[var(--text-primary)] truncate">
            {title}
          </h1>
          {badge}
          {stamp && (
            <span className="stamp">{stamp}</span>
          )}
        </div>
        {subtitle && (
          <p className="mt-1.5 text-sm font-body text-[var(--text-secondary)]">
            {subtitle}
          </p>
        )}
        <div className="hairline mt-4" aria-hidden />
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}
        </div>
      )}
    </motion.div>
  );
}

interface PageSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function PageSection({ title, description, children, className, noPadding = false }: PageSectionProps) {
  return (
    <section className={cn('mb-6', className)}>
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h2 className="font-display text-lg font-semibold text-[var(--text-primary)] tracking-tight">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-sm font-body text-[var(--text-secondary)] mt-1">
              {description}
            </p>
          )}
        </div>
      )}
      <div className={noPadding ? '' : 'p-0'}>
        {children}
      </div>
    </section>
  );
}

interface PageGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export function PageGrid({ children, columns = 3, className }: PageGridProps) {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 lg:grid-cols-2',
    3: 'grid-cols-1 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };
  return (
    <div className={cn('grid gap-6', gridClasses[columns], className)}>
      {children}
    </div>
  );
}

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'full' | '5xl' | '4xl' | '3xl' | '2xl';
}

export function PageContainer({ children, className, maxWidth = 'full' }: PageContainerProps) {
  const maxWidthClasses = {
    full: '',
    '5xl': 'max-w-5xl',
    '4xl': 'max-w-4xl',
    '3xl': 'max-w-3xl',
    '2xl': 'max-w-2xl',
  };
  return (
    <div className={cn('mx-auto', maxWidthClasses[maxWidth], className)}>
      {children}
    </div>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  stamp?: string;
}

export function EmptyState({ icon, title, description, action, className, stamp }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-6 text-center', className)}>
      {icon && (
        <div className="w-16 h-16 rounded-[20px] bg-[var(--surface-container)] flex items-center justify-center mb-4 border border-[var(--border-subtle)]">
          {icon}
        </div>
      )}
      {stamp && (
        <p className="eyebrow mb-2">{stamp}</p>
      )}
      <h3 className="font-display text-lg font-semibold text-[var(--text-primary)] tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-sm font-body text-[var(--text-secondary)] max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  );
}

interface LoadingSkeletonProps {
  className?: string;
  rows?: number;
}

export function LoadingSkeleton({ className, rows = 3 }: LoadingSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 skeleton rounded-[10px]" />
      ))}
    </div>
  );
}

export default PageContainer;
