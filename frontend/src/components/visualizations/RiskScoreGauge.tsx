/**
 * Animated Risk Score Gauge
 * Enterprise-grade risk visualization with smooth animations
 */

import { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { cn } from '../../design-system';
import { Shield, AlertTriangle, CheckCircle } from 'lucide-react';

interface RiskScoreGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
  label?: string;
}

const getSeverityConfig = (score: number) => {
  if (score >= 81) return { label: 'Critical', color: '#e11d48', bg: 'bg-rose-500', icon: AlertTriangle };
  if (score >= 51) return { label: 'High', color: '#ea580c', bg: 'bg-orange-500', icon: AlertTriangle };
  if (score >= 21) return { label: 'Medium', color: '#d97706', bg: 'bg-amber-500', icon: Shield };
  return { label: 'Low', color: '#059669', bg: 'bg-emerald-500', icon: CheckCircle };
};

export function RiskScoreGauge({
  score,
  size = 'md',
  showLabel = true,
  animated = true,
  label = 'Risk Score',
}: RiskScoreGaugeProps) {
  const config = getSeverityConfig(score);

  const springScore = useSpring(animated ? score : 100, {
    stiffness: 40,
    damping: 15,
    mass: 1,
  });

  const sizeConfigs = {
    sm: { width: 80, strokeWidth: 6, fontSize: 'text-lg' },
    md: { width: 120, strokeWidth: 8, fontSize: 'text-2xl' },
    lg: { width: 160, strokeWidth: 10, fontSize: 'text-4xl' },
  };

  const { width, strokeWidth, fontSize } = sizeConfigs[size];
  const radius = (width - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = useTransform(springScore, [0, 100], [circumference, 0]);

  useEffect(() => {
    if (animated) {
      springScore.set(score);
    }
  }, [score, animated]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width, height: width }}>
        {/* Background Circle */}
        <svg
          className="absolute inset-0 -rotate-90"
          width={width}
          height={width}
        >
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-container-high)"
            strokeWidth={strokeWidth}
          />
        </svg>

        {/* Animated Progress Circle */}
        <svg
          className="absolute inset-0 -rotate-90"
          width={width}
          height={width}
        >
          <motion.circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            fill="none"
            stroke={config.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
          />
        </svg>

        {/* Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={cn('font-bold', fontSize)}
            style={{ color: config.color }}
          >
            {animated ? (
              <AnimatedNumber value={score} />
            ) : (
              score
            )}
          </motion.span>
          <span className="text-xs mt-1 text-[var(--text-tertiary)]">
            / 100
          </span>
        </div>
      </div>

      {/* Label */}
      {showLabel && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            {label}
          </span>
          <span
            className="px-2 py-0.5 text-xs font-medium rounded-full"
            style={{ backgroundColor: `${config.color}1a`, color: config.color }}
          >
            {config.label}
          </span>
        </div>
      )}
    </div>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(interval);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(interval);
  }, [value]);

  return <>{displayValue}</>;
}

export default RiskScoreGauge;
