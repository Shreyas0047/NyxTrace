/**
 * Chain of Custody Store — frontend state for custody chains,
 * tamper investigations and verification reports.
 */

import { create } from 'zustand';
import type {
  ChainVisualization,
  ChainOfCustodyChain,
  IntegrityStats,
  VerificationHistoryRecord,
  TamperInvestigationRecord,
  VerificationReportRecord,
} from '../types/custody';
import api from '../services/api';

interface CustodyState {
  stats: IntegrityStats | null;
  chain: ChainVisualization | null;
  timeline: ChainOfCustodyChain | null;
  verificationHistory: VerificationHistoryRecord[];
  tamperInvestigations: TamperInvestigationRecord[];
  latestReport: VerificationReportRecord | null;
  isLoading: boolean;
  isExporting: boolean;
  error: string | null;

  fetchStats: () => Promise<void>;
  fetchChain: (evidenceId: string) => Promise<void>;
  fetchTimeline: (evidenceId: string) => Promise<void>;
  fetchVerificationHistory: (evidenceId: string) => Promise<void>;
  addEvent: (input: {
    evidenceId: string;
    eventType: string;
    details: string;
    investigationId?: string;
  }) => Promise<boolean>;
  transferCustody: (evidenceId: string, newHolderId: string, newHolderName: string) => Promise<boolean>;
  fetchTamperInvestigations: () => Promise<void>;
  createTamperInvestigation: (input: {
    evidenceId: string;
    expectedHash: string;
    actualHash: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  }) => Promise<boolean>;
  generateReport: (evidenceIds: string[], reportType: string, investigationId?: string) => Promise<VerificationReportRecord | null>;
  exportReportPdf: (reportId: string) => Promise<{ pdfBase64: string; pdfFileName: string } | null>;
  resetEvidence: () => void;
  clearError: () => void;
}

export const useCustodyStore = create<CustodyState>((set, get) => ({
  stats: null,
  chain: null,
  timeline: null,
  verificationHistory: [],
  tamperInvestigations: [],
  latestReport: null,
  isLoading: false,
  isExporting: false,
  error: null,

  fetchStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getCustodyIntegrityStats();
      if (response.success && response.data) {
        set({ stats: response.data.stats, isLoading: false });
      }
    } catch {
      set({ isLoading: false, error: 'Failed to fetch integrity statistics' });
    }
  },

  fetchChain: async (evidenceId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getCustodyChain(evidenceId);
      if (response.success && response.data) {
        set({ chain: response.data.chain, isLoading: false });
      } else {
        set({ chain: null, isLoading: false });
      }
    } catch {
      // No chain yet for this evidenceId — treat as empty state
      set({ chain: null, isLoading: false });
    }
  },

  fetchTimeline: async (evidenceId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getCustodyTimeline(evidenceId);
      if (response.success && response.data) {
        set({ timeline: response.data.timeline, isLoading: false });
      }
    } catch {
      set({ timeline: null, isLoading: false, error: 'Failed to fetch custody timeline' });
    }
  },

  fetchVerificationHistory: async (evidenceId) => {
    try {
      const response = await api.getCustodyVerificationHistory(evidenceId);
      if (response.success && response.data) {
        set({ verificationHistory: response.data.history });
      }
    } catch {
      set({ verificationHistory: [] });
    }
  },

  addEvent: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.addCustodyEvent(input);
      if (response.success && response.data) {
        set({ chain: response.data.chain, isLoading: false });
        return true;
      }
      set({ isLoading: false });
      return false;
    } catch {
      set({ isLoading: false, error: 'Failed to add custody event' });
      return false;
    }
  },

  transferCustody: async (evidenceId, newHolderId, newHolderName) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.transferCustody({ evidenceId, newHolderId, newHolderName });
      if (response.success) {
        set({ isLoading: false });
        return true;
      }
      set({ isLoading: false });
      return false;
    } catch {
      set({ isLoading: false, error: 'Failed to transfer custody' });
      return false;
    }
  },

  fetchTamperInvestigations: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getTamperInvestigations();
      if (response.success && response.data) {
        set({ tamperInvestigations: response.data.investigations, isLoading: false });
      }
    } catch {
      set({ isLoading: false, error: 'Failed to fetch tamper investigations' });
    }
  },

  createTamperInvestigation: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.createTamperInvestigation(input);
      if (response.success && response.data) {
        const current = get().tamperInvestigations;
        set({
          tamperInvestigations: [response.data.investigation, ...current],
          isLoading: false,
        });
        return true;
      }
      set({ isLoading: false });
      return false;
    } catch {
      set({ isLoading: false, error: 'Failed to create tamper investigation' });
      return false;
    }
  },

  generateReport: async (evidenceIds, reportType, investigationId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.generateCustodyReport({ investigationId, evidenceIds, reportType });
      if (response.success && response.data) {
        set({ latestReport: response.data.report, isLoading: false });
        return response.data.report;
      }
      set({ isLoading: false });
      return null;
    } catch {
      set({ isLoading: false, error: 'Failed to generate verification report' });
      return null;
    }
  },

  exportReportPdf: async (reportId) => {
    set({ isExporting: true, error: null });
    try {
      const response = await api.exportCustodyReport(reportId, 'pdf');
      if (response.success && response.data?.pdfBase64) {
        set({ isExporting: false });
        return {
          pdfBase64: response.data.pdfBase64,
          pdfFileName: response.data.pdfFileName || `${reportId}.pdf`,
        };
      }
      set({ isExporting: false });
      return null;
    } catch {
      set({ isExporting: false, error: 'Failed to export report PDF' });
      return null;
    }
  },

  resetEvidence: () => {
    set({ chain: null, timeline: null, verificationHistory: [], error: null });
  },

  clearError: () => set({ error: null }),
}));
