/**
 * Blockchain Service - Core Web3 Integration
 * Web3 provider management and blockchain communication
 */

import logger from '../config/logger';
import { blockchainConfig } from './config';
import { Web3Transaction, SmartContractCall } from './types';

export class BlockchainService {
  private provider: any = null;
  private initialized: boolean = false;
  private retryTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize Web3 provider
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (!blockchainConfig.enabled) {
      logger.info('[Blockchain] Blockchain disabled - running in offline mode');
      return;
    }

    try {
      await this.connect();
    } catch (error) {
      logger.warn('[Blockchain] Failed to initialize Web3 provider:', error);
      logger.warn('[Blockchain] Running in offline mode - will keep retrying in the background');
      this.scheduleRetry();
    }
  }

  /**
   * Establish the provider connection and verify the network.
   */
  private async connect(): Promise<void> {
    // Dynamic import of ethers.js to support optional blockchain
    const { ethers } = await import('ethers');

    // Create RPC provider
    const provider = new ethers.JsonRpcProvider(blockchainConfig.rpcUrl);

    // Verify connection
    const network = await provider.getNetwork();
    this.provider = provider;
    this.initialized = true;
    logger.info(`[Blockchain] Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
  }

  /**
   * Keep re-attempting the connection in the background so a node that comes
   * up after the backend (or a transient network blip) is picked up without
   * requiring a backend restart.
   */
  private scheduleRetry(): void {
    if (this.retryTimer) return;
    this.retryTimer = setInterval(async () => {
      if (this.initialized) {
        this.clearRetry();
        return;
      }
      try {
        await this.connect();
        this.clearRetry();
      } catch (error) {
        logger.warn('[Blockchain] Background reconnect attempt failed:', (error as Error).message);
      }
    }, 15000);
    this.retryTimer.unref();
  }

  private clearRetry(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /**
   * Get the underlying ethers provider
   */
  getProvider(): any {
    return this.provider;
  }

  /**
   * Check if blockchain is available
   */
  isAvailable(): boolean {
    return this.initialized && this.provider !== null;
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }
    return await this.provider.getBlockNumber();
  }

  /**
   * Get block by number
   */
  async getBlock(blockNumber: number): Promise<any> {
    if (!this.isAvailable()) {
      throw new Error('Blockchain not available');
    }
    return await this.provider.getBlock(blockNumber);
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: string): Promise<any> {
    if (!this.isAvailable()) {
      throw new Error('Blockchain not available');
    }
    return await this.provider.getTransactionReceipt(txHash);
  }

  /**
   * Get gas price
   */
  async getGasPrice(): Promise<string> {
    if (!this.isAvailable()) {
      return blockchainConfig.gasSettings.maxFeePerGas;
    }
    const feeData = await this.provider.getFeeData();
    return feeData.maxFeePerGas?.toString() || blockchainConfig.gasSettings.maxFeePerGas;
  }

  /**
   * Estimate gas for transaction
   */
  async estimateGas(tx: Web3Transaction): Promise<number> {
    if (!this.isAvailable()) {
      return blockchainConfig.gasSettings.gasLimit;
    }
    return await this.provider.estimateGas(tx);
  }

  /**
   * Get network information
   */
  async getNetworkInfo(): Promise<{
    chainId: number;
    blockNumber: number;
    networkName: string;
    available: boolean;
  }> {
    try {
      if (!this.isAvailable()) {
        return {
          chainId: 0,
          blockNumber: 0,
          networkName: 'offline',
          available: false,
        };
      }

      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();

      return {
        chainId: Number(network.chainId),
        blockNumber,
        networkName: network.name,
        available: true,
      };
    } catch (error) {
      return {
        chainId: 0,
        blockNumber: 0,
        networkName: 'error',
        available: false,
      };
    }
  }

  /**
   * Format address for display
   */
  formatAddress(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }

  /**
   * Format transaction hash for display
   */
  formatTxHash(txHash: string): string {
    if (!txHash || txHash.length < 20) return txHash;
    return `${txHash.substring(0, 10)}...${txHash.substring(txHash.length - 8)}`;
  }

  /**
   * Get explorer URL for transaction
   */
  getExplorerUrl(txHash: string): string {
    return `${blockchainConfig.explorerUrl}/tx/${txHash}`;
  }

  /**
   * Get explorer URL for address
   */
  getAddressExplorerUrl(address: string): string {
    return `${blockchainConfig.explorerUrl}/address/${address}`;
  }

  /**
   * Verify transaction confirmation
   */
  async verifyTransaction(txHash: string, requiredConfirmations: number = 12): Promise<{
    confirmed: boolean;
    confirmations: number;
    blockNumber: number;
  }> {
    if (!this.isAvailable()) {
      return { confirmed: false, confirmations: 0, blockNumber: 0 };
    }

    const receipt = await this.provider.getTransactionReceipt(txHash);
    if (!receipt || !receipt.blockNumber) {
      return { confirmed: false, confirmations: 0, blockNumber: 0 };
    }

    const currentBlock = await this.provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber + 1;

    return {
      confirmed: confirmations >= requiredConfirmations,
      confirmations,
      blockNumber: receipt.blockNumber,
    };
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    if (this.provider) {
      this.provider = null;
      this.initialized = false;
    }
  }
}

export const blockchainService = new BlockchainService();
export default blockchainService;
