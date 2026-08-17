import { create } from 'zustand';
import type { Evidence, PaginationParams } from '../types';
import api from '../services/api';
import { useBlockchainStore } from './blockchainStore';
import { useStatusStore } from './statusStore';

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
  registerUrlEvidence: (payload: { investigationId: string; url: string; name?: string; description?: string }) => Promise<Evidence>;
  verifyEvidence: (id: string) => Promise<void>;
  anchorEvidence: (id: string) => Promise<void>;
  simulateTamper: (id: string) => Promise<void>;
  restoreEvidence: (id: string) => Promise<void>;
  recordTamperOnChain: (id: string) => Promise<void>;
  deleteEvidence: (id: string) => Promise<void>;
  clearCurrentEvidence: () => void;
}

function patchEvidence(list: Evidence[], id: string, patch: Partial<Evidence>): Evidence[] {
  return list.map((e) => (e.id === id ? { ...e, ...patch } : e));
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

  registerUrlEvidence: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.registerUrlEvidence(payload);
      if (response.success && response.data) {
        const evidence = get().evidence;
        set({ evidence: [response.data, ...evidence], isLoading: false });
        return response.data;
      }
      throw new Error('Failed to register URL evidence');
    } catch (error) {
      set({ isLoading: false, error: 'Failed to register URL evidence' });
      throw error;
    }
  },

  verifyEvidence: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.verifyEvidence(id);
      if (response.success) {
        const verified = response.data?.verified === true;
        const evidence = patchEvidence(get().evidence, id, {
          verified,
          verifiedAt: verified ? new Date().toISOString() : undefined,
          status: verified ? 'verified' : eStatusAfterMismatch(get().evidence.find((e) => e.id === id)?.status),
        });
        set({ evidence, isLoading: false });

        if (!verified) {
          useStatusStore
            .getState()
            .show(
              'error',
              'Integrity check failed',
              'File hash does not match the stored record — evidence may have been tampered.',
              9000
            );
        }

        const ev = get().evidence.find((e) => e.id === id);
        if (ev?.evidenceId) {
          const isUrl = ev.artifactKind === 'url' || ev.type === 'url';
          const sourceValue = isUrl ? ev.url : ev.filePath;
          if (sourceValue) {
            useBlockchainStore
              .getState()
              .verifyEvidence(ev.evidenceId, sourceValue, isUrl ? 'url' : 'file')
              .then(() => {
                set({
                  evidence: patchEvidence(get().evidence, id, { blockchainVerified: true }),
                });
              })
              .catch((err) => {
                console.error('Blockchain verification failed:', err);
              });
          }
        }
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to verify evidence' });
    }
  },

  anchorEvidence: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const ev = get().evidence.find((e) => e.id === id);
      if (!ev) throw new Error('Evidence not found');
      const isUrl = ev.artifactKind === 'url' || ev.type === 'url';
      const sourceValue = isUrl ? ev.url : ev.filePath;
      if (!ev.evidenceId || !sourceValue) throw new Error('Evidence is missing file metadata');

      const registered = await api.registerEvidenceForBlockchain(ev.evidenceId, sourceValue, isUrl ? 'url' : 'file');
      const fingerprint = registered.data?.fingerprint || ev.hash?.sha256 || '';
      if (!fingerprint) throw new Error('Fingerprint not returned by blockchain service');

      set({
        evidence: patchEvidence(get().evidence, id, {
          fingerprint,
          blockchainVerified: true,
        }),
        isLoading: false,
      });

      useStatusStore
        .getState()
        .show(
          'success',
          'Evidence anchored on-chain',
          `Fingerprint ${fingerprint.slice(0, 16)}… queued for the ledger.`,
          8000
        );
      return;
    } catch (error) {
      set({ isLoading: false, error: 'Failed to anchor evidence' });
      useStatusStore
        .getState()
        .show(
          'error',
          'Anchoring failed',
          error instanceof Error ? error.message : 'Unknown error',
          8000
        );
      throw error;
    }
  },

  simulateTamper: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.simulateTamper(id);
      if (!response.success) throw new Error('Failed to simulate tamper');

      set({
        evidence: patchEvidence(get().evidence, id, {
          verified: false,
          blockchainVerified: false,
          status: 'tampered',
          tamperedHash: response.data?.newHash,
        }),
        isLoading: false,
      });

      useStatusStore
        .getState()
        .show(
          'warning',
          'Tamper simulated',
          response.data
            ? `File mutated — stored hash no longer matches. New hash: ${response.data.newHash.slice(0, 16)}…`
            : 'File mutated — stored hash no longer matches.',
          9000
        );
    } catch (error) {
      set({ isLoading: false, error: 'Failed to simulate tamper' });
      useStatusStore
        .getState()
        .show('error', 'Tamper simulation failed', error instanceof Error ? error.message : 'Unknown error', 8000);
      throw error;
    }
  },

  restoreEvidence: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.restoreEvidence(id);
      if (!response.success) throw new Error('Failed to restore evidence');

      set({
        evidence: patchEvidence(get().evidence, id, {
          verified: false,
          status: 'ready',
        }),
        isLoading: false,
      });

      useStatusStore
        .getState()
        .show(
          'success',
          'Evidence restored',
          'Original file bytes restored from the demo backup — verify again to re-establish integrity.',
          8000
        );
    } catch (error) {
      set({ isLoading: false, error: 'Failed to restore evidence' });
      useStatusStore
        .getState()
        .show('error', 'Restore failed', error instanceof Error ? error.message : 'Unknown error', 8000);
      throw error;
    }
  },

  recordTamperOnChain: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const ev = get().evidence.find((e) => e.id === id);
      if (!ev) throw new Error('Evidence not found');
      if (!ev.evidenceId) throw new Error('Evidence is missing metadata');

      const expectedHash = ev.hash?.sha256 || '';
      const actualHash = ev.tamperedHash || '';
      if (!expectedHash) throw new Error('Stored hash is missing from the evidence record');
      if (!actualHash) throw new Error('Tampered hash is missing — simulate the tamper first');

      const response = await api.recordTamperOnChain(ev.evidenceId, ev.investigationId, expectedHash, actualHash);
      if (!response.success) throw new Error(response.message || 'Failed to record tamper on chain');

      set({ isLoading: false });

      useStatusStore
        .getState()
        .show(
          'success',
          'Tamper recorded on-chain',
          response.data?.transactionHash
            ? `Critical audit event broadcast — tx ${response.data.transactionHash.slice(0, 16)}…`
            : 'Critical audit event broadcast to the ledger.',
          9000
        );
    } catch (error) {
      set({ isLoading: false, error: 'Failed to record tamper on chain' });
      useStatusStore
        .getState()
        .show('error', 'On-chain record failed', error instanceof Error ? error.message : 'Unknown error', 8000);
      throw error;
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

function eStatusAfterMismatch(previous: Evidence['status'] | undefined): Evidence['status'] {
  return previous === 'tampered' ? 'tampered' : 'ready';
}
