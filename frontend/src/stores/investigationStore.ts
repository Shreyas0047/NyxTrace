import { create } from 'zustand';
import type { Investigation, PaginationParams } from '../types';
import api from '../services/api';

interface InvestigationState {
  investigations: Investigation[];
  currentInvestigation: Investigation | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  fetchInvestigations: (params: PaginationParams) => Promise<void>;
  fetchInvestigation: (id: string) => Promise<void>;
  createInvestigation: (data: Partial<Investigation>) => Promise<Investigation>;
  updateInvestigation: (id: string, data: Partial<Investigation>) => Promise<void>;
  deleteInvestigation: (id: string) => Promise<void>;
  clearCurrentInvestigation: () => void;
}

export const useInvestigationStore = create<InvestigationState>((set, get) => ({
  investigations: [],
  currentInvestigation: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  },

  fetchInvestigations: async (params: PaginationParams) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getInvestigations(params);
      if (!response.success) {
        set({ isLoading: false });
        return;
      }
      set({
        investigations: response.data || [],
        pagination: {
          page: response.meta?.page || 1,
          limit: response.meta?.limit || 20,
          total: response.meta?.total || 0,
          totalPages: response.meta?.totalPages || 0,
        },
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
    }
  },

  fetchInvestigation: async (id: string) => {
    set({ isLoading: true, error: null, currentInvestigation: null });
    try {
      const response = await api.getInvestigation(id);
      if (response.success && response.data) {
        set({
          currentInvestigation: response.data,
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        isLoading: false,
        error: 'Failed to fetch investigation',
      });
    }
  },

  createInvestigation: async (data: Partial<Investigation>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.createInvestigation(data);
      if (response.success && response.data) {
        const investigations = get().investigations;
        set({
          investigations: [response.data, ...investigations],
          isLoading: false,
        });
        return response.data;
      }
      throw new Error('Failed to create investigation');
    } catch (error) {
      set({
        isLoading: false,
        error: 'Failed to create investigation',
      });
      throw error;
    }
  },

  updateInvestigation: async (id: string, data: Partial<Investigation>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.updateInvestigation(id, data);
      if (response.success && response.data) {
        const investigations = get().investigations.map((inv) =>
          inv.id === id ? response.data : inv
        ).filter((inv): inv is Investigation => inv !== undefined);
        set({
          investigations,
          currentInvestigation: response.data,
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        isLoading: false,
        error: 'Failed to update investigation',
      });
    }
  },

  deleteInvestigation: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteInvestigation(id);
      const investigations = get().investigations.filter((inv) => inv.id !== id);
      set({
        investigations,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: 'Failed to delete investigation',
      });
    }
  },

  clearCurrentInvestigation: () => set({ currentInvestigation: null }),
}));