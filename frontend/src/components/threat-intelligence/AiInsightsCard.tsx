/**
 * AiInsightsCard - LLM-enhanced second opinion for document/URL analysis.
 *
 * Renders the optional LLM assessment (Ollama llama3.2 or OpenAI) produced
 * as a non-blocking enhancer on top of the heuristic verdict. Returns null
 * when no LLM insights are available, so the existing result layout is
 * unchanged when the LLM is disabled or unreachable.
 */

import { Sparkles, ShieldAlert, Lightbulb, Cpu } from 'lucide-react';
import { cn } from '../../design-system';
import { Card, CardContent, CardHeader } from '../ui/Card';
import type { AiInsights } from '../../types';

interface AiInsightsCardProps {
  insights?: AiInsights | null;
  className?: string;
}

function AiInsightsCard({ insights, className }: AiInsightsCardProps) {
  if (!insights || !insights.llm_available) return null;

  const modelLabel = insights.model ? String(insights.model) : undefined;
  const confidence = insights.llm_confidence ?? null;

  return (
    <Card
      variant="accent"
      padding="md"
      className={cn('border-cyan-500/20', className)}
    >
      <CardHeader
        title="AI Assessment"
        description="LLM narrative generated on top of the heuristic verdict"
        action={
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-cyan-500/10 text-cyan-600  border border-cyan-500/20">
              <Sparkles className="w-3 h-3" />
              Second Opinion
            </span>
            {modelLabel && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-[var(--text-secondary)]  bg-[var(--surface-container-low)]  border border-[var(--border-subtle)] ">
                <Cpu className="w-3 h-3" />
                {modelLabel}
              </span>
            )}
          </div>
        }
      />
      <CardContent className="space-y-4">
        {insights.executive_summary && (
          <div>
            <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">
              Executive Summary
            </span>
            <p className="text-sm text-[var(--text-secondary)]  leading-relaxed">{insights.executive_summary}</p>
          </div>
        )}

        {insights.classification_opinion && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/15">
            <ShieldAlert className="w-4 h-4 text-cyan-600  flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-1">
                Classification Opinion
              </span>
              <p className="text-sm text-[var(--text-secondary)]  leading-relaxed">{insights.classification_opinion}</p>
              {confidence !== null && (
                <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                  LLM confidence:{' '}
                  <span className="text-cyan-600  font-medium">{Math.round(confidence * 100)}%</span>
                </p>
              )}
            </div>
          </div>
        )}

        {insights.mitre_techniques && insights.mitre_techniques.length > 0 && (
          <div>
            <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">
              Suggested MITRE Techniques
            </span>
            <div className="flex flex-wrap gap-1.5">
              {insights.mitre_techniques.map((technique) => (
                <span
                  key={technique}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-cyan-500/10 text-cyan-600  border border-cyan-500/20"
                >
                  <ShieldAlert className="w-3 h-3" />
                  {technique}
                </span>
              ))}
            </div>
          </div>
        )}

        {insights.recommendations && insights.recommendations.length > 0 && (
          <div>
            <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">
              AI Recommendations
            </span>
            <ul className="space-y-1.5">
              {insights.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]  leading-relaxed">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-600  flex-shrink-0 mt-1" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AiInsightsCard;
