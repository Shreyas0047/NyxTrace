import { clsx, type ClassValue } from 'clsx';

export const spacing = {
  '0': '0px',
  '0.5': '2px',
  '1': '4px',
  '2': '8px',
  '3': '12px',
  '4': '16px',
  '5': '20px',
  '6': '24px',
  '8': '32px',
  '10': '40px',
  '12': '48px',
  '16': '64px',
  '20': '80px',
  '24': '96px',
  'page-padding': '24px',
  'section-gap': '24px',
  'card-gap': '16px',
  'element-gap': '12px',
  'compact-gap': '8px',
  'tight-gap': '4px',
} as const;

export const typography = {
  fontFamily: {
    display: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
    body: "'DM Sans', 'Inter', ui-sans-serif, system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
  },
  fontSize: {
    '2xs': '10px',
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px',
    '5xl': '48px',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.15',
    snug: '1.3',
    normal: '1.5',
    relaxed: '1.6',
    loose: '1.8',
  },
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '-0.01em',
    wide: '0.025em',
    wider: '0.05em',
  },
} as const;

export const colors = {
  primary: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    950: '#451a03',
  },
  severity: {
    critical: { bg: 'bg-rose-950/30', text: 'text-rose-400', border: 'border-rose-800/40', solid: 'bg-rose-500' },
    high: { bg: 'bg-orange-950/30', text: 'text-orange-400', border: 'border-orange-800/40', solid: 'bg-orange-500' },
    medium: { bg: 'bg-amber-950/30', text: 'text-amber-400', border: 'border-amber-800/40', solid: 'bg-amber-500' },
    low: { bg: 'bg-emerald-950/30', text: 'text-emerald-400', border: 'border-emerald-800/40', solid: 'bg-emerald-500' },
    info: { bg: 'bg-sky-100 ', text: 'text-sky-600 ', border: 'border-sky-200 ', solid: 'bg-sky-500' },
  },
  status: {
    active: { bg: 'bg-emerald-100 ', text: 'text-emerald-600 ', dot: 'bg-emerald-500' },
    pending: { bg: 'bg-amber-100 ', text: 'text-amber-600 ', dot: 'bg-amber-500' },
    error: { bg: 'bg-rose-100 ', text: 'text-rose-600 ', dot: 'bg-rose-500' },
    inactive: { bg: 'bg-[var(--surface-container-low)] ', text: 'text-[var(--text-secondary)]', dot: 'bg-slate-500' },
  },
  surface: {
    base: 'bg-[var(--surface-base)]',
    dim: 'bg-[var(--surface-dim)]',
    container: 'bg-[var(--surface-container)]',
    'container-high': 'bg-[var(--surface-container-high)]',
    'container-highest': 'bg-[var(--surface-container-highest)]',
    bright: 'bg-[var(--surface-bright)]',
  },
  border: {
    primary: 'border-[var(--outline)]',
    secondary: 'border-[var(--outline-variant)]',
    accent: 'border-[#f59e0b]',
  },
  text: {
    primary: 'text-[var(--text-primary)]',
    secondary: 'text-[var(--text-secondary)]',
    tertiary: 'text-[var(--text-tertiary)]',
    muted: 'text-[var(--text-disabled)]',
    inverse: 'text-[var(--surface-base)]',
  },
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(0,0,0,0.5)',
  DEFAULT: '0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4)',
  md: '0 4px 12px rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.4)',
  lg: '0 12px 32px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.45)',
  xl: '0 20px 40px rgba(0,0,0,0.65), 0 8px 16px rgba(0,0,0,0.5)',
  card: '0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4)',
  elevated: '0 4px 12px rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.4)',
  dropdown: '0 10px 40px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.45)',
  glow: {
    amber: '0 0 0 1px rgba(245,158,11,0.15), 0 4px 20px rgba(245,158,11,0.08)',
    emerald: '0 0 0 1px rgba(52,211,153,0.15), 0 4px 20px rgba(52,211,153,0.08)',
    rose: '0 0 0 1px rgba(251,113,133,0.15), 0 4px 20px rgba(251,113,133,0.08)',
  },
} as const;

export const radii = {
  none: '0px',
  sm: '6px',
  DEFAULT: '8px',
  md: '10px',
  lg: '14px',
  xl: '20px',
  '2xl': '24px',
  full: '9999px',
} as const;

export const transitions = {
  duration: { fast: '120ms', DEFAULT: '200ms', slow: '300ms', slower: '500ms' },
  easing: {
    DEFAULT: 'cubic-bezier(0.16, 1, 0.3, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

export const zIndex = {
  dropdown: '1000',
  sticky: '1100',
  fixed: '1200',
  modalBackdrop: '1300',
  modal: '1400',
  popover: '1500',
  tooltip: '1600',
} as const;

export const animations = {
  fadeIn: { keyframe: 'fadeIn', duration: '200ms', easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  slideUp: { keyframe: 'slideUp', duration: '300ms', easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  slideDown: { keyframe: 'slideDown', duration: '200ms', easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  pulse: { keyframe: 'pulse', duration: '2s', easing: 'cubic-bezier(0.4, 0, 0.6, 1)', repeat: 'infinite' },
  spin: { keyframe: 'spin', duration: '1s', easing: 'linear', repeat: 'infinite' },
  shimmer: { keyframe: 'shimmer', duration: '1.5s', easing: 'linear', repeat: 'infinite' },
} as const;

export const buttonVariants = {
  primary: `
    bg-amber-500
    text-[#1e1b14]
    font-medium
    hover:bg-amber-400 active:bg-amber-600
    shadow-sm hover:shadow-[0_0_24px_rgba(245,158,11,0.15)]
    focus-visible:ring-2 focus-visible:ring-amber-500/50
    transition-all duration-[200ms] ease-out
  `,
  secondary: `
    bg-[var(--surface-container-high)]
    text-[var(--on-surface)]
    hover:bg-[var(--surface-container-highest)] active:bg-[var(--surface-container)]
    border border-[var(--outline-variant)]
    focus-visible:ring-2 focus-visible:ring-amber-500/50
    transition-all duration-[200ms] ease-out
  `,
  outline: `
    bg-transparent
    text-[var(--text-secondary)]
    border border-[var(--outline-variant)]
    hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)] hover:border-[var(--outline)]
    focus-visible:ring-2 focus-visible:ring-amber-500/50
    transition-all duration-[200ms] ease-out
  `,
  ghost: `
    bg-transparent
    text-[var(--text-secondary)]
    hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)]
    focus-visible:ring-2 focus-visible:ring-amber-500/50
    transition-all duration-[200ms] ease-out
  `,
  danger: `
    bg-rose-600
    text-white
    font-medium
    hover:bg-rose-500 active:bg-rose-700
    shadow-sm
    focus-visible:ring-2 focus-visible:ring-rose-500/50
    transition-all duration-[200ms] ease-out
  `,
  success: `
    bg-emerald-600
    text-white
    font-medium
    hover:bg-emerald-500 active:bg-emerald-700
    shadow-sm
    focus-visible:ring-2 focus-visible:ring-emerald-500/50
    transition-all duration-[200ms] ease-out
  `,
} as const;

export const cardVariants = {
  default: `
    bg-[var(--surface-container)]
    border border-[var(--border-subtle)]
    shadow-sm
    rounded-[20px]
  `,
  elevated: `
    bg-[var(--surface-raised)]
    border border-[var(--border-default)]
    shadow-md
    rounded-[20px]
  `,
  bordered: `
    bg-[var(--surface-container)]
    border-2 border-[var(--outline-variant)]
    rounded-[20px]
  `,
  ghost: `
    bg-transparent
    border border-transparent
  `,
  accent: `
    bg-[var(--surface-container)]
    border border-[rgba(245,158,11,0.2)]
    shadow-sm
    rounded-[20px]
  `,
} as const;

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function responsive(base: string, sm?: string, md?: string, lg?: string, xl?: string): string {
  return [base, sm, md, lg, xl].filter(Boolean).join(' ');
}

export function cssVar(name: string): string {
  return `var(--${name})`;
}

export function formatDate(date: string | Date, format: 'short' | 'long' | 'relative' = 'short'): string {
  const d = new Date(date);
  switch (format) {
    case 'short': return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case 'long': return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    case 'relative': return getRelativeTime(d);
    default: return d.toLocaleDateString();
  }
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export const useDesignSystem = () => ({
  spacing, typography, colors, shadows, radii, transitions, zIndex, animations,
  buttonVariants, cardVariants, cn, responsive, cssVar, formatDate,
});

export const designSystem = {
  spacing, typography, colors, shadows, radii, transitions, zIndex, animations,
  buttonVariants, cardVariants, cn, responsive, cssVar, formatDate,
};

export default designSystem;
