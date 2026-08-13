/**
 * Blockchain Operations Page
 * Enterprise blockchain operational dashboard with sync, workers, and health monitoring
 */

import React, { useEffect } from 'react';
import { BlockchainOperationsPanel } from '../components/blockchain/BlockchainOperationsPanel';
import { ReconciliationPanel } from '../components/blockchain/ReconciliationPanel';
import { useAuthStore } from '../stores/authStore';
import { useBlockchainStore } from '../stores/blockchainStore';

export const BlockchainOperationsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { status, fetchStatus } = useBlockchainStore();

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Check if user is admin (only admins can access some features)
  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-full">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] ">
            Blockchain Operations
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)] ">
            Monitor and manage blockchain synchronization, verification queues, and system health
          </p>
        </div>

        {/* Offline Mode Banner */}
        {status && !status.available && (
          <div className="mb-6 rounded-lg border border-amber-500/50 bg-amber-900/20 p-4">
            <div className="flex items-center gap-3">
              <span className="text-amber-500 text-xl">!</span>
              <div>
                <h3 className="text-sm font-semibold text-amber-300">Blockchain Offline — Local Verification Only</h3>
                <p className="text-xs text-amber-600  mt-1">
                  No blockchain provider is connected. Evidence hashes are verified locally but are NOT anchored on-chain.
                  "Verified" badges reflect local integrity checks only. Configure BLOCKCHAIN_RPC_URL to enable on-chain verification.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="space-y-6">
          {/* Operations Panel */}
          <BlockchainOperationsPanel />

          {/* Reconciliation Panel - Admin Only */}
          {isAdmin && (
            <ReconciliationPanel />
          )}
        </div>

      </div>
    </div>
  );
};

export default BlockchainOperationsPage;

