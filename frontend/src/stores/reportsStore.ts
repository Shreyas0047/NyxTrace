import { create } from 'zustand';
import type { ForensicReportSummary, ForensicReportDetail } from '../types/reports';
import type { SandboxSessionWithExtras, AnalysisReportItem } from '../types';
import api from '../services/api';

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ReportsState {
  reports: ForensicReportSummary[];
  currentReport: ForensicReportDetail | null;
  isLoading: boolean;
  isDetailLoading: boolean;
  error: string | null;
  pagination: { page: number; limit: number; total: number; totalPages: number };
  filters: {
    simulator: string;
    severity: string;
    dateFrom: string;
    dateTo: string;
    search: string;
  };
  investigationId: string;

  // Analytics hub — sandbox sessions
  sessions: SandboxSessionWithExtras[];
  sessionsPagination: Pagination;
  isSessionsLoading: boolean;

  // Analytics hub — document / URL analyses
  analysisDocs: AnalysisReportItem[];
  analysisUrls: AnalysisReportItem[];
  analysisPagination: Pagination;
  isAnalysisLoading: boolean;
  currentAnalysis: AnalysisReportItem | null;
  isAnalysisDetailLoading: boolean;

  fetchReports: (params?: Partial<ReportsState['filters'] & { page: number; limit: number }>) => Promise<void>;
  fetchReportById: (id: string) => Promise<void>;
  exportReport: (id: string, format: 'json' | 'text' | 'pdf') => Promise<void>;
  setFilters: (filters: Partial<ReportsState['filters']>) => void;
  setInvestigationId: (investigationId: string) => void;
  clearCurrentReport: () => void;

  fetchSessions: (page?: number, limit?: number) => Promise<void>;
  fetchAnalysisHistory: (type: 'document_analysis' | 'url_analysis', page?: number, limit?: number) => Promise<void>;
  fetchAnalysisById: (id: string) => Promise<void>;
  clearCurrentAnalysis: () => void;
}

export const useReportsStore = create<ReportsState>((set, get) => ({
  reports: [],
  currentReport: null,
  isLoading: false,
  isDetailLoading: false,
  error: null,
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  filters: { simulator: '', severity: '', dateFrom: '', dateTo: '', search: '' },
  investigationId: '',

  sessions: [],
  sessionsPagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  isSessionsLoading: false,
  analysisDocs: [],
  analysisUrls: [],
  analysisPagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  isAnalysisLoading: false,
  currentAnalysis: null,
  isAnalysisDetailLoading: false,

  fetchReports: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const { filters, pagination } = get();
      const merged = { ...filters, ...params };
      const page = merged.page ?? pagination.page;
      const limit = merged.limit ?? pagination.limit;

      const response = await api.getReports({
        page,
        limit,
        simulator: merged.simulator || undefined,
        severity: merged.severity || undefined,
        dateFrom: merged.dateFrom || undefined,
        dateTo: merged.dateTo || undefined,
        search: merged.search || undefined,
        investigationId: get().investigationId || undefined,
      });

      if (response.success && response.data) {
        set({
          reports: response.data,
          pagination: {
            page: response.meta?.page || page,
            limit: response.meta?.limit || limit,
            total: response.meta?.total || 0,
            totalPages: response.meta?.totalPages || 0,
          },
          filters: {
            simulator: merged.simulator || '',
            severity: merged.severity || '',
            dateFrom: merged.dateFrom || '',
            dateTo: merged.dateTo || '',
            search: merged.search || '',
          },
          isLoading: false,
        });
      } else {
        set({ isLoading: false, error: 'Failed to load reports' });
      }
    } catch {
      set({ isLoading: false, error: 'Failed to load reports' });
    }
  },

  fetchReportById: async (id: string) => {
    set({ isDetailLoading: true, error: null, currentReport: null });
    try {
      const response = await api.getReport(id);
      if (response.success && response.data) {
        set({ currentReport: response.data, isDetailLoading: false });
      } else {
        set({ isDetailLoading: false, error: 'Report not found' });
      }
    } catch {
      set({ isDetailLoading: false, error: 'Failed to load report details' });
    }
  },

  exportReport: async (id: string, format: 'json' | 'text' | 'pdf') => {
    try {
      const blob = await api.exportReport(id, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'json' ? 'json' : format === 'pdf' ? 'pdf' : 'txt';
      const filename = `report_${id}_${new Date().toISOString().split('T')[0]}.${ext}`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      set({ error: 'Failed to export report' });
    }
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  setInvestigationId: (investigationId) => {
    set({ investigationId });
  },

  clearCurrentReport: () => set({ currentReport: null }),

  fetchSessions: async (page = 1, limit = 20) => {
    set({ isSessionsLoading: true });
    try {
      const response = await api.getSandboxSessions({
        page,
        limit,
        investigationId: get().investigationId || undefined,
      });
      if (response.success && response.data) {
        set({
          sessions: response.data,
          sessionsPagination: {
            page: response.meta?.page || page,
            limit: response.meta?.limit || limit,
            total: response.meta?.total || 0,
            totalPages: response.meta?.totalPages || 0,
          },
          isSessionsLoading: false,
        });
      } else {
        set({ isSessionsLoading: false });
      }
    } catch {
      set({ isSessionsLoading: false });
    }
  },

  fetchAnalysisHistory: async (type, page = 1, limit = 20) => {
    set({ isAnalysisLoading: true });
    try {
      const response = await api.getThreatIntelHistory({ page, limit, type, investigationId: get().investigationId || undefined });
      if (response.success && response.data) {
        const items = response.data as unknown as AnalysisReportItem[];
        set((state) => ({
          analysisDocs: type === 'document_analysis' ? items : state.analysisDocs,
          analysisUrls: type === 'url_analysis' ? items : state.analysisUrls,
          analysisPagination: {
            page: response.meta?.page || page,
            limit: response.meta?.limit || limit,
            total: response.meta?.total || 0,
            totalPages: response.meta?.totalPages || 0,
          },
          isAnalysisLoading: false,
        }));
      } else {
        set({ isAnalysisLoading: false });
      }
    } catch {
      set({ isAnalysisLoading: false });
    }
  },

  fetchAnalysisById: async (id: string) => {
    set({ isAnalysisDetailLoading: true, currentAnalysis: null });
    try {
      const response = await api.getThreatIntelAnalysis(id);
      if (response.success && response.data) {
        set({ currentAnalysis: response.data as unknown as AnalysisReportItem, isAnalysisDetailLoading: false });
      } else {
        set({ isAnalysisDetailLoading: false });
      }
    } catch {
      set({ isAnalysisDetailLoading: false });
    }
  },

  clearCurrentAnalysis: () => set({ currentAnalysis: null }),
}));