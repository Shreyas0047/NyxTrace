/**
 * Smart Contract Service
 * Blockchain interaction layer for forensic smart contracts
 */

import logger from '../config/logger';
import { ethers } from 'ethers';
import { config } from '../config';
import { blockchainConfig } from './config';

// Smart contract ABI definitions
export const FORENSICS_EVIDENCE_ABI = [
  // Read functions
  "function getEvidence(string _evidenceId) view returns (tuple(string evidenceId, bytes32 evidenceHash, uint256 timestamp, address investigator, string investigationId, uint8 verificationStatus, bytes metadata))",
  "function getEvidenceHash(string _evidenceId) view returns (bytes32)",
  "function getEvidenceStatus(string _evidenceId) view returns (uint8)",
  "function checkEvidenceExists(string _evidenceId) view returns (bool)",
  "function getVerificationHistory(string _evidenceId) view returns (tuple(string evidenceId, address verifier, uint256 timestamp, bool result, bytes32 expectedHash, bytes32 actualHash, uint8 status)[])",
  "function getAllEvidenceIds() view returns (string[])",
  "function getInvestigationEvidenceCount(string _investigationId) view returns (uint256)",
  "function getContractInfo() view returns (string, address, uint256)",

  // Write functions
  "function registerEvidence(string _evidenceId, bytes32 _evidenceHash, string _investigationId, bytes _metadata) returns (bool)",
  "function batchRegisterEvidence(string[] _evidenceIds, bytes32[] _evidenceHashes, string _investigationId) returns (bool)",
  "function verifyEvidence(string _evidenceId, bytes32 _hashToVerify) returns (bool, uint8)",
  "function updateEvidenceStatus(string _evidenceId, uint8 _newStatus) returns (bool)",
  "function markEvidenceInvalid(string _evidenceId, string _reason) returns (bool)",

  // Events
  "event EvidenceRegistered(string indexed evidenceId, bytes32 indexed evidenceHash, address indexed investigator, uint256 timestamp, string investigationId)",
  "event EvidenceVerified(string indexed evidenceId, address indexed verifier, bool indexed result, uint8 status, uint256 timestamp)",
  "event VerificationFailed(string indexed evidenceId, address indexed verifier, bytes32 expectedHash, bytes32 actualHash, uint256 timestamp)",
  "event EvidenceStatusUpdated(string indexed evidenceId, uint8 indexed oldStatus, uint8 indexed newStatus, address updater, uint256 timestamp)"
];

export const FORENSICS_AUDIT_ABI = [
  // Read functions
  "function getAuditEntry(uint256 _index) view returns (tuple(uint8 category, uint8 severity, string description, address investigator, string investigationId, string evidenceId, uint256 timestamp, bytes metadata, bytes32 eventHash))",
  "function getInvestigationAudit(string _investigationId) view returns (tuple(uint8 category, uint8 severity, string description, address investigator, string investigationId, string evidenceId, uint256 timestamp, bytes metadata, bytes32 eventHash)[])",
  "function getEvidenceAudit(string _evidenceId) view returns (tuple(uint8 category, uint8 severity, string description, address investigator, string investigationId, string evidenceId, uint256 timestamp, bytes metadata, bytes32 eventHash)[])",
  "function getRecentAuditEntries(uint256 _count) view returns (tuple(uint8 category, uint8 severity, string description, address investigator, string investigationId, string evidenceId, uint256 timestamp, bytes metadata, bytes32 eventHash)[])",
  "function getContractInfo() view returns (string, address, uint256)",

  // Write functions
  "function createAuditEntry(uint8 _category, uint8 _severity, string _description, string _investigationId, string _evidenceId, bytes _metadata) returns (uint256)",
  "function recordEvidenceRegistration(string _evidenceId, string _investigationId, bytes32 _hash) returns (uint256)",
  "function recordVerificationResult(string _evidenceId, string _investigationId, bool _success, bytes32 _expectedHash, bytes32 _actualHash) returns (uint256)",
  "function recordTamperDetection(string _evidenceId, string _investigationId, bytes32 _expectedHash, bytes32 _actualHash) returns (uint256)",
  "function recordSystemEvent(string _description, bytes _metadata) returns (uint256)",

  // Events
  "event AuditEntryCreated(uint256 indexed entryIndex, uint8 indexed category, uint8 indexed severity, address investigator, uint256 timestamp)",
  "event CriticalAuditEvent(uint256 indexed entryIndex, string description, address indexed investigator, uint256 timestamp)",
  "event VerificationAuditEvent(uint256 indexed entryIndex, string indexed evidenceId, bool indexed success, address investigator, uint256 timestamp)",
  "event EvidenceAuditEvent(uint256 indexed entryIndex, string indexed evidenceId, string action, address indexed investigator, uint256 timestamp)"
];

export enum ContractType {
  EVIDENCE = 'evidence',
  AUDIT = 'audit'
}

/** Evidence state machine: PENDING → REGISTERED → TRANSFERRED → LOCKED */
export enum EvidenceState {
  PENDING = 0,
  REGISTERED = 1,
  TRANSFERRED = 2,
  LOCKED = 3,
}

const VALID_TRANSITIONS: Record<EvidenceState, EvidenceState[]> = {
  [EvidenceState.PENDING]: [EvidenceState.REGISTERED],
  [EvidenceState.REGISTERED]: [EvidenceState.TRANSFERRED, EvidenceState.LOCKED],
  [EvidenceState.TRANSFERRED]: [EvidenceState.LOCKED],
  [EvidenceState.LOCKED]: [],
};

export interface ContractConfig {
  address: string;
  abi: any[];
  type: ContractType;
}

export interface TransactionResult {
  success: boolean;
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
}

export interface VerificationResult {
  verified: boolean;
  status: number;
  transactionHash?: string;
  blockNumber?: number;
}

export interface EvidenceInfo {
  evidenceId: string;
  evidenceHash: string;
  timestamp: number;
  investigator: string;
  investigationId: string;
  verificationStatus: number;
  metadata: string;
}

export class SmartContractService {
  private provider: ethers.JsonRpcProvider | null = null;
  private signer: ethers.Wallet | null = null;
  private evidenceContract: ethers.Contract | null = null;
  private auditContract: ethers.Contract | null = null;
  private initialized: boolean = false;
  private retryTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize smart contract services
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!blockchainConfig.enabled) {
      logger.info('[SmartContract] Blockchain disabled - running in local verification mode');
      return;
    }

    try {
      await this.connect();
    } catch (error) {
      logger.warn('[SmartContract] Failed to initialize:', error);
      logger.warn('[SmartContract] Running in offline mode - will keep retrying in the background');
      this.scheduleRetry();
    }
  }

  /**
   * Establish the provider connection, signer, and contract instances.
   */
  private async connect(): Promise<void> {
    // Initialize provider
    this.provider = new ethers.JsonRpcProvider(blockchainConfig.rpcUrl);

    // Verify connection
    const network = await this.provider.getNetwork();
    logger.info(`[SmartContract] Connected to network: ${network.name}`);

    // Create signer if private key is available (required for write operations)
    const { walletConfig } = await import('./config');
    if (walletConfig.privateKey) {
      this.signer = new ethers.Wallet(walletConfig.privateKey, this.provider);
      logger.info(`[SmartContract] Signer initialized: ${this.signer.address}`);
    } else {
      logger.warn('[SmartContract] No private key configured — running in read-only mode');
    }

    // Initialize contracts if addresses are configured
    if (blockchainConfig.contractAddress) {
      this.initializeContracts();
    }

    this.initialized = true;
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
        logger.warn('[SmartContract] Background reconnect attempt failed:', (error as Error).message);
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
   * Initialize contract instances
   */
  private initializeContracts(): void {
    if (!this.provider) return;

    const runner = this.signer || this.provider;

    // Evidence contract (read/write if signer available)
    this.evidenceContract = new ethers.Contract(
      blockchainConfig.contractAddress,
      FORENSICS_EVIDENCE_ABI,
      runner
    );

    // Audit contract (use same address for combined contract or separate)
    this.auditContract = new ethers.Contract(
      blockchainConfig.contractAddress,
      FORENSICS_AUDIT_ABI,
      runner
    );

    logger.info('[SmartContract] Contracts initialized');
  }

  /**
   * Check if blockchain is available
   */
  isAvailable(): boolean {
    return this.initialized && this.provider !== null;
  }

  /**
   * Register evidence on blockchain
   */
  async registerEvidence(
    evidenceId: string,
    evidenceHash: string,
    investigationId: string,
    metadata?: string
  ): Promise<TransactionResult> {
    if (!this.evidenceContract || !this.provider) {
      return { success: false, error: 'Blockchain not available' };
    }

    try {
      // Convert hash string to bytes32
      const hashBytes32 = ethers.zeroPadValue('0x' + evidenceHash.slice(2), 32);

      // Prepare transaction
      const tx = await this.evidenceContract.registerEvidence(
        evidenceId,
        hashBytes32,
        investigationId,
        metadata || ''
      );

      // Wait for confirmation
      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error: any) {
      logger.error('[SmartContract] Registration failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Batch register evidence
   */
  async batchRegisterEvidence(
    evidenceItems: Array<{ evidenceId: string; evidenceHash: string }>,
    investigationId: string
  ): Promise<TransactionResult> {
    if (!this.evidenceContract || !this.provider) {
      return { success: false, error: 'Blockchain not available' };
    }

    try {
      const evidenceIds = evidenceItems.map((e) => e.evidenceId);
      const evidenceHashes = evidenceItems.map((e) =>
        ethers.zeroPadValue('0x' + e.evidenceHash.slice(2), 32)
      );

      const tx = await this.evidenceContract.batchRegisterEvidence(
        evidenceIds,
        evidenceHashes,
        investigationId
      );

      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error: any) {
      logger.error('[SmartContract] Batch registration failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify evidence on blockchain
   */
  async verifyEvidence(
    evidenceId: string,
    hashToVerify: string
  ): Promise<VerificationResult> {
    if (!this.evidenceContract || !this.provider) {
      return { verified: false, status: 0 };
    }

    try {
      const hashBytes32 = ethers.zeroPadValue('0x' + hashToVerify.slice(2), 32);

      const tx = await this.evidenceContract.verifyEvidence(evidenceId, hashBytes32);
      const receipt = await tx.wait();

      // Get result from transaction
      const result = await this.evidenceContract.getEvidence(evidenceId);

      return {
        verified: result.verificationStatus === 1, // VERIFIED = 1
        status: result.verificationStatus,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      logger.error('[SmartContract] Verification failed:', error);
      return { verified: false, status: 0 };
    }
  }

  /**
   * Get evidence from blockchain
   */
  async getEvidence(evidenceId: string): Promise<EvidenceInfo | null> {
    if (!this.evidenceContract) {
      return null;
    }

    try {
      const result = await this.evidenceContract.getEvidence(evidenceId);

      return {
        evidenceId: result.evidenceId,
        evidenceHash: result.evidenceHash,
        timestamp: result.timestamp,
        investigator: result.investigator,
        investigationId: result.investigationId,
        verificationStatus: result.verificationStatus,
        metadata: result.metadata,
      };
    } catch (error) {
      logger.error('[SmartContract] Get evidence failed:', error);
      return null;
    }
  }

  /**
   * Check if evidence exists on blockchain
   */
  async checkEvidenceExists(evidenceId: string): Promise<boolean> {
    if (!this.evidenceContract) {
      return false;
    }

    try {
      return await this.evidenceContract.checkEvidenceExists(evidenceId);
    } catch {
      return false;
    }
  }

  /**
   * Get evidence hash from blockchain
   */
  async getEvidenceHash(evidenceId: string): Promise<string | null> {
    if (!this.evidenceContract) {
      return null;
    }

    try {
      return await this.evidenceContract.getEvidenceHash(evidenceId);
    } catch {
      return null;
    }
  }

  /**
   * Get verification history from blockchain
   */
  async getVerificationHistory(evidenceId: string): Promise<any[]> {
    if (!this.evidenceContract) {
      return [];
    }

    try {
      return await this.evidenceContract.getVerificationHistory(evidenceId);
    } catch {
      return [];
    }
  }

  /**
   * Record audit entry on blockchain
   */
  async recordAuditEntry(params: {
    category: number;
    severity: number;
    description: string;
    investigationId: string;
    evidenceId?: string;
    metadata?: string;
  }): Promise<TransactionResult> {
    if (!this.auditContract || !this.provider) {
      return { success: false, error: 'Blockchain not available' };
    }

    try {
      const tx = await this.auditContract.createAuditEntry(
        params.category,
        params.severity,
        params.description,
        params.investigationId,
        params.evidenceId || '',
        params.metadata || ''
      );

      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error: any) {
      logger.error('[SmartContract] Audit entry failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record evidence registration in audit
   */
  async recordEvidenceRegistration(
    evidenceId: string,
    investigationId: string,
    hash: string
  ): Promise<TransactionResult> {
    if (!this.auditContract) {
      return { success: false, error: 'Blockchain not available' };
    }

    try {
      const hashBytes32 = ethers.zeroPadValue('0x' + hash.slice(2), 32);
      const tx = await this.auditContract.recordEvidenceRegistration(
        evidenceId,
        investigationId,
        hashBytes32
      );

      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error: any) {
      logger.error('[SmartContract] Audit registration failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record verification result in audit
   */
  async recordVerificationResult(
    evidenceId: string,
    investigationId: string,
    success: boolean,
    expectedHash: string,
    actualHash: string
  ): Promise<TransactionResult> {
    if (!this.auditContract) {
      return { success: false, error: 'Blockchain not available' };
    }

    try {
      const expectedBytes32 = ethers.zeroPadValue('0x' + expectedHash.slice(2), 32);
      const actualBytes32 = ethers.zeroPadValue('0x' + actualHash.slice(2), 32);

      const tx = await this.auditContract.recordVerificationResult(
        evidenceId,
        investigationId,
        success,
        expectedBytes32,
        actualBytes32
      );

      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error: any) {
      logger.error('[SmartContract] Verification audit failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record tamper detection
   */
  async recordTamperDetection(
    evidenceId: string,
    investigationId: string,
    expectedHash: string,
    actualHash: string
  ): Promise<TransactionResult> {
    if (!this.auditContract) {
      return { success: false, error: 'Blockchain not available' };
    }

    try {
      const expectedBytes32 = ethers.zeroPadValue('0x' + expectedHash.slice(2), 32);
      const actualBytes32 = ethers.zeroPadValue('0x' + actualHash.slice(2), 32);

      const tx = await this.auditContract.recordTamperDetection(
        evidenceId,
        investigationId,
        expectedBytes32,
        actualBytes32
      );

      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error: any) {
      logger.error('[SmartContract] Tamper detection audit failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get audit entries for evidence
   */
  async getEvidenceAudit(evidenceId: string): Promise<any[]> {
    if (!this.auditContract) {
      return [];
    }

    try {
      return await this.auditContract.getEvidenceAudit(evidenceId);
    } catch {
      return [];
    }
  }

  /**
   * Get recent audit entries
   */
  async getRecentAuditEntries(count: number = 10): Promise<any[]> {
    if (!this.auditContract) {
      return [];
    }

    try {
      return await this.auditContract.getRecentAuditEntries(count);
    } catch {
      return [];
    }
  }

  /**
   * Get contract information
   */
  async getContractInfo(): Promise<{ version: string; owner: string; count: number } | null> {
    if (!this.evidenceContract) {
      return null;
    }

    try {
      return await this.evidenceContract.getContractInfo();
    } catch {
      return null;
    }
  }

  /**
   * Get explorer URL for transaction
   */
  getExplorerUrl(txHash: string): string {
    return `${blockchainConfig.explorerUrl}/tx/${txHash}`;
  }

  /**
   * Transition evidence through the state machine.
   * Validates allowed transitions: PENDING→REGISTERED→TRANSFERRED→LOCKED
   */
  async transitionState(evidenceId: string, newState: EvidenceState): Promise<TransactionResult> {
    if (!this.evidenceContract || !this.provider) {
      return { success: false, error: 'Blockchain not available' };
    }

    try {
      // Get current state
      const currentState: number = await this.evidenceContract.getEvidenceStatus(evidenceId);
      const allowed = VALID_TRANSITIONS[currentState as EvidenceState] || [];

      if (!allowed.includes(newState)) {
        return { success: false, error: `Invalid transition: ${EvidenceState[currentState]} → ${EvidenceState[newState]}` };
      }

      const tx = await this.evidenceContract.updateEvidenceStatus(evidenceId, newState);
      const receipt = await tx.wait();

      logger.info(`[SmartContract] Evidence ${evidenceId} transitioned to ${EvidenceState[newState]}`);
      return { success: true, transactionHash: receipt.hash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed.toString() };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[SmartContract] State transition failed:', msg);
      return { success: false, error: msg };
    }
  }

  /**
   * Reconciliation: compare MongoDB hash against on-chain hash.
   * Returns tamper alert if mismatch detected.
   */
  async reconcileEvidence(evidenceId: string, dbHash: string): Promise<{ match: boolean; chainHash?: string; alert?: string }> {
    if (!this.evidenceContract) {
      return { match: true }; // Can't verify — skip
    }

    try {
      const chainHashRaw = await this.evidenceContract.getEvidenceHash(evidenceId);
      const chainHash = chainHashRaw.toString();

      // Normalize: compare hex without 0x prefix and zero-padding
      const normalizedDb = dbHash.replace(/^0x/, '').toLowerCase();
      const normalizedChain = chainHash.replace(/^0x/, '').replace(/^0+/, '').toLowerCase();

      if (normalizedDb !== normalizedChain && normalizedChain.length > 0) {
        logger.warn(`[Reconciliation] TAMPER_ALERT: Evidence ${evidenceId} hash mismatch. DB=${normalizedDb.slice(0, 16)}... Chain=${normalizedChain.slice(0, 16)}...`);
        return {
          match: false,
          chainHash,
          alert: `Hash mismatch detected for evidence ${evidenceId}. Database hash does not match blockchain record.`,
        };
      }

      return { match: true, chainHash };
    } catch (error) {
      logger.error('[Reconciliation] Check failed:', error);
      return { match: true }; // Fail-open for reconciliation (don't block on network errors)
    }
  }

  /**
   * Cleanup
   */
  async destroy(): Promise<void> {
    this.provider = null;
    this.evidenceContract = null;
    this.auditContract = null;
    this.initialized = false;
  }
}

export const smartContractService = new SmartContractService();
export default smartContractService;
