import { create } from 'zustand';
import type { ThreatIntelAnalysis, ThreatIntelSummary, ExtractedIOC } from '../types';
import api from '../services/api';

/**
 * Normalizes backend analysis report to frontend ThreatIntelAnalysis interface
 */
function normalizeAnalysis(raw: any): ThreatIntelAnalysis {
  if (!raw) return null as any;

  // Handle nested data if it's wrapped in a data property
  const data = raw.data || raw;

  return {
    id: data.analysisId || data.id || data._id,
    type: (data.analysisType === 'url_analysis' || data.sourceType === 'url') ? 'url' : 'document',
    status: data.status || 'completed',
    fileName: data.analysisType === 'document_analysis' ? data.sourceName : undefined,
    fileSize: data.sourceSize,
    url: data.analysisType === 'url_analysis' ? data.sourceName : undefined,
    threatScore: data.threatScore || 0,
    threatLevel: data.threatLevel === 'safe' ? 'benign' : (data.threatLevel || 'low'),
    confidence: data.confidence || 0,
    summary: data.summary || data.predictedThreat || '',
    iocs: (data.indicators || []).map((ioc: any) => ({
      type: ioc.type || 'unknown',
      value: ioc.value || '',
      context: ioc.context || '',
      severity: ioc.severity || 'info',
      mitreMapping: ioc.mitreMapping
    })) as ExtractedIOC[],
    mitreTechniques: data.mitreTechniques || [],
    mitreTactics: data.mitreTactics || [],
    findings: (data.findings || []).map((f: any) => ({
      id: f.id || Math.random().toString(36).substr(2, 9),
      title: f.title || f.name || 'Finding',
      description: f.description || '',
      severity: f.severity || 'info',
      category: f.category || 'other',
      confidence: f.confidence || 0,
      evidence: f.evidence || [],
      mitreMapping: f.mitreMapping
    })),
    sections: data.metadata?.sections || [],
    urlReputation: data.metadata?.urlReputation || data.urlReputation,
    aiInsights: data.aiInsights || undefined,
    analyzedAt: data.analysisTimestamp || data.createdAt || new Date().toISOString(),
  };
}

function computeSummary(analyses: ThreatIntelAnalysis[]): ThreatIntelSummary {
  return {
    totalAnalyses: analyses.length,
    totalIOCs: analyses.reduce((sum, a) => sum + (a.iocs?.length || 0), 0),
    criticalFindings: analyses.reduce((sum, a) => sum + (a.findings?.filter(f => f.severity === 'critical').length || 0), 0),
    highFindings: analyses.reduce((sum, a) => sum + (a.findings?.filter(f => f.severity === 'high').length || 0), 0),
    maliciousUrls: analyses.filter(a => a.type === 'url' && (a.threatLevel === 'critical' || a.threatLevel === 'high')).length,
    maliciousDocuments: analyses.filter(a => a.type === 'document' && (a.threatLevel === 'critical' || a.threatLevel === 'high')).length,
    topThreats: [],
    iocByType: {},
    recentAnalyses: analyses,
  };
}

interface ThreatIntelState {
  currentAnalysis: ThreatIntelAnalysis | null;
  analysisHistory: ThreatIntelAnalysis[];
  summary: ThreatIntelSummary | null;
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;

  analyzeDocument: (file: File) => Promise<void>;
  analyzeUrl: (url: string) => Promise<void>;
  loadHistory: (params?: { page?: number; limit?: number; type?: string; status?: string }) => Promise<void>;
  loadAnalysis: (id: string) => Promise<void>;
  clearCurrent: () => void;
  clearError: () => void;
}

export const useThreatIntelStore = create<ThreatIntelState>((set) => ({
  currentAnalysis: null,
  analysisHistory: [],
  summary: null,
  isLoading: false,
  isUploading: false,
  error: null,

  analyzeDocument: async (file: File) => {
    set({ isUploading: true, error: null, currentAnalysis: null });
    try {
      const response = await api.analyzeDocument(file);
      if (response.success && response.data) {
        set({ currentAnalysis: normalizeAnalysis(response.data), isUploading: false });
      } else {
        set({ error: response.message || 'Document analysis failed', isUploading: false });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to analyze document', isUploading: false });
    }
  },

  analyzeUrl: async (url: string) => {
    set({ isLoading: true, error: null, currentAnalysis: null });
    try {
      const response = await api.analyzeUrl(url);
      if (response.success && response.data) {
        set({ currentAnalysis: normalizeAnalysis(response.data), isLoading: false });
      } else {
        set({ error: response.message || 'URL analysis failed', isLoading: false });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to analyze URL', isLoading: false });
    }
  },

  loadHistory: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getThreatIntelHistory(params);
      if (response.success && response.data) {
        const items = Array.isArray(response.data) ? response.data : (response.data as any).recentAnalyses || [];
        const normalizedItems = items.map(normalizeAnalysis);
        set({
          analysisHistory: normalizedItems,
          summary: computeSummary(normalizedItems),
          isLoading: false,
        });
      } else {
        set({ error: response.message || 'Failed to load history', isLoading: false });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load history', isLoading: false });
    }
  },

  loadAnalysis: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getThreatIntelAnalysis(id);
      if (response.success && response.data) {
        set({ currentAnalysis: normalizeAnalysis(response.data), isLoading: false });
      } else {
        set({ error: response.message || 'Failed to load analysis', isLoading: false });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load analysis', isLoading: false });
    }
  },

  clearCurrent: () => {
    set({ currentAnalysis: null, error: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));

export default useThreatIntelStore;

