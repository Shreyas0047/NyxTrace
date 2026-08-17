import { motion } from 'framer-motion';
import { cn } from '../../design-system';

type StatusValue = 'active' | 'pending' | 'analyzing' | 'resolved' | 'in_progress' | 'new' | 'acknowledged' | 'closed' | 'archived';

interface StatusBadgeProps {
  status: StatusValue | string;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
  pulse?: boolean;
  className?: string;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  resolved: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  acknowledged: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  in_progress: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  analyzing: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  pending: { bg: 'bg-[var(--surface-container-low)] border-[var(--border-subtle)]', text: 'text-[var(--text-secondary)]', dot: 'bg-slate-400' },
  new: { bg: 'bg-sky-50 border-sky-200', text: 'text-sky-700', dot: 'bg-sky-500' },
  tampered: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500' },
  closed: { bg: 'bg-[var(--surface-container-low)] border-[var(--border-subtle)]', text: 'text-[var(--text-secondary)]', dot: 'bg-slate-400' },
  archived: { bg: 'bg-[var(--surface-container-low)] border-[var(--border-subtle)]', text: 'text-[var(--text-secondary)]', dot: 'bg-slate-400' },
};

const sizeConfig = { sm: 'px-1.5 py-0.5 text-[10px]', md: 'px-2 py-1 text-xs', lg: 'px-2.5 py-1.5 text-sm' };
const dotSizeConfig = { sm: 'w-1.5 h-1.5', md: 'w-2 h-2', lg: 'w-2.5 h-2.5' };

const pulsingStatuses = ['active', 'analyzing', 'in_progress', 'acknowledged', 'new', 'tampered'];

export function StatusBadge({ status, size = 'md', showDot = true, pulse, className }: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] || statusConfig.pending;
  const shouldPulse = pulse !== undefined ? pulse : pulsingStatuses.includes(status.toLowerCase());

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('inline-flex items-center gap-1.5 font-medium rounded-full border font-mono', config.bg, config.text, sizeConfig[size], 'border-transparent', className)}
    >
      {showDot && <span className={cn('rounded-full flex-shrink-0', config.dot, dotSizeConfig[size], shouldPulse && 'animate-pulse')} />}
      <span className="capitalize">{status.replace(/_/g, ' ')}</span>
    </motion.span>
  );
}

type SeverityValue = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface SeverityBadgeProps {
  severity: SeverityValue;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const severityConfig: Record<SeverityValue, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-rose-50', text: 'text-rose-700 ', border: 'border-rose-200' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700 ', border: 'border-orange-200' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700 ', border: 'border-amber-200' },
  low: { bg: 'bg-emerald-50', text: 'text-emerald-700 ', border: 'border-emerald-200' },
  info: { bg: 'bg-sky-50', text: 'text-sky-700 ', border: 'border-sky-200' },
};

export function SeverityBadge({ severity, size = 'md', className }: SeverityBadgeProps) {
  const config = severityConfig[severity];
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('inline-flex items-center justify-center font-semibold rounded-full border font-mono tracking-tight', config.bg, config.text, config.border, sizeConfig[size], className)}
    >
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </motion.span>
  );
}

interface CountBadgeProps {
  count: number;
  max?: number;
  variant?: 'default' | 'primary' | 'danger';
  className?: string;
}

export function CountBadge({ count, max = 99, variant = 'default', className }: CountBadgeProps) {
  const variantClasses = {
    default: 'bg-[var(--surface-container-high)] text-[var(--text-secondary)]',
    primary: 'bg-amber-500/15 text-amber-600  ',
    danger: 'bg-rose-500/15 text-rose-600  ',
  };

  if (count === 0) return null;
  const displayCount = count > max ? `${max}+` : count;

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-mono font-semibold rounded-full', variantClasses[variant], className)}
    >
      {displayCount}
    </motion.span>
  );
}

export default StatusBadge;
