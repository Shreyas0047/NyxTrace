import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import { cn } from '../../design-system';

type Verdict = 'safe' | 'caution' | 'unsafe';

interface VerdictBannerProps {
  /** Threat level from the analysis, e.g. 'benign' | 'low' | 'medium' | 'high' | 'critical' */
  threatType: string;
  /** Analysis confidence, 0–100 */
  confidence: number;
  /** Optional reputation risk score (0–100, higher = riskier). Overrides safety % when present. */
  riskScore?: number;
  /** Optional reputation malicious flag — forces the UNSAFE verdict. */
  malicious?: boolean;
  /** Optional artifact label shown alongside the verdict (e.g. file name / URL). */
  artifactLabel?: string;
}

export function VerdictBanner({ threatType, confidence, riskScore, malicious, artifactLabel }: VerdictBannerProps) {
  const level = (threatType || '').toLowerCase();

  let verdict: Verdict;
  if (malicious || ['critical', 'high', 'malicious'].includes(level)) {
    verdict = 'unsafe';
  } else if (['medium', 'suspicious', 'unknown'].includes(level)) {
    verdict = 'caution';
  } else {
    verdict = 'safe';
  }

  const safetyPercent = riskScore !== undefined
    ? Math.max(0, 100 - riskScore)
    : verdict === 'safe'
      ? Math.max(confidence, 50)
      : Math.max(0, 100 - confidence);

  const config: Record<Verdict, { label: string; headline: string; icon: typeof ShieldCheck; banner: string; text: string; iconBg: string }> = {
    safe: {
      label: 'SAFE',
      headline: 'Safe to open or use',
      icon: ShieldCheck,
      banner: 'bg-emerald-500/10 border-emerald-500/30',
      text: 'text-emerald-600  ',
      iconBg: 'bg-emerald-500/15',
    },
    caution: {
      label: 'CAUTION',
      headline: 'Use with caution — potential threat',
      icon: AlertTriangle,
      banner: 'bg-amber-500/10 border-amber-500/30',
      text: 'text-amber-600  ',
      iconBg: 'bg-amber-500/15',
    },
    unsafe: {
      label: 'UNSAFE',
      headline: 'Do not open or use — malicious',
      icon: ShieldAlert,
      banner: 'bg-red-500/10 border-red-500/30',
      text: 'text-red-600  ',
      iconBg: 'bg-red-500/15',
    },
  };

  const c = config[verdict];
  const Icon = c.icon;
  const threatLabel = threatType ? threatType.charAt(0).toUpperCase() + threatType.slice(1) : 'Unknown';

  return (
    <div className={cn('flex items-center gap-4 p-4 rounded-xl border', c.banner)}>
      <div className={cn('w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0', c.iconBg)}>
        <Icon className={cn('w-5 h-5', c.text)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-[13px] font-bold tracking-wide', c.text)}>{c.label}</span>
          {artifactLabel && (
            <span className="text-[12px] text-[var(--text-secondary)]  font-mono truncate max-w-[280px]">
              {artifactLabel}
            </span>
          )}
        </div>
        <p className="text-[14px] font-medium mt-0.5 text-[var(--text-secondary)] ">{c.headline}</p>
        <p className="text-[12px] mt-1 text-[var(--text-secondary)] ">
          Threat type: <span className="font-medium text-[var(--text-secondary)] ">{threatLabel}</span>
          {' · '}Analysis confidence: {confidence}%
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={cn('font-display text-2xl font-semibold tabular-nums leading-none', c.text)}>
          {Math.round(safetyPercent)}%
        </p>
        <p className="text-[11px] text-[var(--text-secondary)]  mt-1">safe</p>
      </div>
    </div>
  );
}

export default VerdictBanner;
