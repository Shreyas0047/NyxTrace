import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Loader2, Info, X } from 'lucide-react';
import { cn } from '../../design-system';

export type StatusType = 'info' | 'success' | 'warning' | 'error' | 'loading';

export interface StatusMessage {
  id: string;
  type: StatusType;
  message: string;
  detail?: string;
}

interface StatusBannerProps {
  status: StatusMessage | null;
  onDismiss?: () => void;
  className?: string;
}

const typeConfig: Record<StatusType, { icon: typeof Info; bg: string; border: string; text: string; iconColor: string }> = {
  info: {
    icon: Info,
    bg: 'bg-blue-50 ',
    border: 'border-blue-200 ',
    text: 'text-blue-800 ',
    iconColor: 'text-blue-500',
  },
  success: {
    icon: CheckCircle,
    bg: 'bg-emerald-50 ',
    border: 'border-emerald-200 ',
    text: 'text-emerald-800 ',
    iconColor: 'text-emerald-500',
  },
  warning: {
    icon: AlertCircle,
    bg: 'bg-amber-50 ',
    border: 'border-amber-200 ',
    text: 'text-amber-800 ',
    iconColor: 'text-amber-500',
  },
  error: {
    icon: AlertCircle,
    bg: 'bg-red-50 ',
    border: 'border-red-200 ',
    text: 'text-red-800 ',
    iconColor: 'text-red-500',
  },
  loading: {
    icon: Loader2,
    bg: 'bg-[var(--surface-container-lowest)] ',
    border: 'border-[var(--border-subtle)] ',
    text: 'text-[var(--text-primary)] ',
    iconColor: 'text-[var(--text-secondary)]',
  },
};

export function StatusBanner({ status, onDismiss, className }: StatusBannerProps) {
  if (!status) return null;

  const config = typeConfig[status.type];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -8, height: 0 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'flex items-start gap-3 px-4 py-3 rounded-lg border',
          config.bg,
          config.border,
          className
        )}
      >
        <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', config.iconColor, status.type === 'loading' && 'animate-spin')} />
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-medium', config.text)}>{status.message}</p>
          {status.detail && (
            <p className={cn('text-xs mt-0.5', config.text, 'opacity-70')}>{status.detail}</p>
          )}
        </div>
        {onDismiss && status.type !== 'loading' && (
          <button onClick={onDismiss} className="p-0.5 rounded hover:bg-black/5  transition-colors flex-shrink-0">
            <X className="w-3.5 h-3.5 opacity-50" />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export function StatusProvider() {
  return null;
}
