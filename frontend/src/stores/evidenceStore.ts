import { create } from 'zustand';
import type { Evidence, PaginationParams } from '../types';
import api from '../services/api';
import { useBlockchainStore } from './blockchainStore';

interface EvidenceState {
  evidence: Evidence[];
  currentEvidence: Evidence | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  fetchEvidence: (params: PaginationParams) => Promise<void>;
  fetchEvidenceByInvestigation: (investigationId: string, params: PaginationParams) => Promise<void>;
  fetchEvidenceById: (id: string) => Promise<void>;
  uploadEvidence: (formData: FormData) => Promise<Evidence>;
  verifyEvidence: (id: string) => Promise<void>;
  deleteEvidence: (id: string) => Promise<void>;
  clearCurrentEvidence: () => void;
}

export const useEvidenceStore = create<EvidenceState>((set, get) => ({
  evidence: [],
  currentEvidence: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  },

  fetchEvidence: async (params: PaginationParams) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getEvidence(params);
      if (response.success && response.data) {
        set({
          evidence: response.data,
          pagination: {
            page: response.meta?.page || 1,
            limit: response.meta?.limit || 20,
            total: response.meta?.total || 0,
            totalPages: response.meta?.totalPages || 0,
          },
          isLoading: false,
        });
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to fetch evidence' });
    }
  },

  fetchEvidenceByInvestigation: async (investigationId: string, params: PaginationParams) => {
    set({ isLoading: true, error: null, evidence: [] });
    try {
      const response = await api.getEvidenceByInvestigation(investigationId, params);
      if (response.success && response.data) {
        set({
          evidence: response.data,
          isLoading: false,
        });
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to fetch investigation evidence' });
    }
  },

  fetchEvidenceById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getEvidenceById(id);
      if (response.success && response.data) {
        set({ currentEvidence: response.data, isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to fetch evidence' });
    }
  },

  uploadEvidence: async (formData: FormData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.uploadEvidence(formData);
      if (response.success && response.data) {
        const evidence = get().evidence;
        set({ evidence: [response.data, ...evidence], isLoading: false });
        return response.data;
      }
      throw new Error('Failed to upload evidence');
    } catch (error) {
      set({ isLoading: false, error: 'Failed to upload evidence' });
      throw error;
    }
  },

  verifyEvidence: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.verifyEvidence(id);
      if (response.success) {
        const evidence = get().evidence.map((e) =>
          e.id === id ? { ...e, verified: true, verifiedAt: new Date().toISOString() } : e
        );
        set({ evidence, isLoading: false });

        const ev = get().evidence.find((e) => e.id === id);
        if (ev?.evidenceId && ev?.filePath) {
          useBlockchainStore.getState().verifyEvidence(ev.evidenceId, ev.filePath)
            .then(() => {
              const updated = get().evidence.map((e) =>
                e.id === id ? { ...e, blockchainVerified: true } : e
              );
              set({ evidence: updated });
            })
            .catch(() => {
              // Blockchain verification failed silently — evidence is still locally verified
            });
        }
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to verify evidence' });
    }
  },

  deleteEvidence: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteEvidence(id);
      const evidence = get().evidence.filter((e) => e.id !== id);
      set({ evidence, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: 'Failed to delete evidence' });
    }
  },

  clearCurrentEvidence: () => set({ currentEvidence: null }),
}));