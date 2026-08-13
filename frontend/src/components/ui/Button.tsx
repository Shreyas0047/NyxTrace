import React from 'react';
import { cn } from '../../design-system';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'solid' | 'outline' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-amber-500 text-[#1e1b14] font-medium hover:bg-amber-400 active:bg-amber-600 shadow-sm hover:shadow-[0_0_24px_rgba(245,158,11,0.2)]',
  secondary: 'bg-[var(--surface-container-high)] text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)] active:bg-[var(--surface-container)] border border-[var(--outline-variant)]',
  solid: 'bg-[var(--surface-container-high)] text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)] active:bg-[var(--surface-container)] border border-[var(--outline-variant)]',
  outline: 'bg-transparent text-[var(--text-secondary)] border border-[var(--outline-variant)] hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)] hover:border-[var(--outline)]',
  ghost: 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)]',
  danger: 'bg-rose-600 text-white font-medium hover:bg-rose-500 active:bg-rose-700 shadow-sm',
  success: 'bg-emerald-600 text-white font-medium hover:bg-emerald-500 active:bg-emerald-700 shadow-sm',
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-xs gap-1',
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      type={type}
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-[10px]',
        'transition-all duration-200 ease-out active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
}

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon: React.ReactNode;
  label: string;
  loading?: boolean;
}

const iconSizeClasses: Record<ButtonSize, string> = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

export function IconButton({ variant = 'ghost', size = 'md', icon, label, loading, className }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center rounded-[10px]',
        'transition-all duration-200 ease-out active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        iconSizeClasses[size],
        className
      )}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
    </button>
  );
}

export default Button;
