/**
 * Chain of Custody Types
 */

export interface CustodyEvent {
  eventId: string;
  evidenceId: string;
  eventType: string;
  timestamp: string;
  performedBy: string;
  performedByName: string;
  details: string;
  investigationId?: string;
  transactionHash?: string;
  blockNumber?: number;
  integrityStatus?: string;
  previousEventHash?: string;
  currentEventHash?: string;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    location?: string;
    deviceId?: string;
  };
}

export interface ChainVisualizationEvent {
  timestamp: string;
  eventType: string;
  details: string;
  performedBy: string;
  integrityStatus?: string;
}

export interface ChainVisualization {
  evidenceId: string;
  chainId: string;
  events: ChainVisualizationEvent[];
  integrityStatus: string;
  blockchainVerified: boolean;
}

export interface ChainOfCustodyChain {
  id?: string;
  evidenceId: string;
  chainId: string;
  currentHolder?: string;
  currentHolderName?: string;
  custodyStatus: string;
  integrityStatus: string;
  lastIntegrityCheck?: string;
  lastVerifiedAt?: string;
  blockchainVerified: boolean;
  blockchainTxHash?: string;
  blockchainBlockNumber?: number;
  eventCount: number;
  verificationCount: number;
  lastEventAt?: string;
  chainHash?: string;
  genesisHash?: string;
  events: CustodyEvent[];
  createdAt?: string;
  updatedAt?: string;
}

export interface IntegrityStats {
  totalEvidence: number;
  verified: number;
  pending: number;
  failed: number;
  tamperSuspected: number;
  blockchainOnChain: number;
}

export interface VerificationHistoryRecord {
  verificationId: string;
  evidenceId: string;
  verificationType: string;
  timestamp: string;
  performedBy?: string;
  performedByName?: string;
  status: string;
  expectedHash?: string;
  actualHash?: string;
  hashMatch?: boolean;
  transactionHash?: string;
  blockNumber?: number;
  confirmations?: number;
  verificationTime?: number;
  details?: string;
}

export interface TamperInvestigationRecord {
  id?: string;
  investigationId: string;
  evidenceId: string;
  detectedAt: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  expectedHash?: string;
  actualHash?: string;
  status: 'open' | 'investigating' | 'resolved' | 'false_positive' | 'escalated';
  assignedTo?: string;
  assignedToName?: string;
  events: Array<{
    timestamp: string;
    action: string;
    performedBy: string;
    notes?: string;
  }>;
  driftAnalysis?: {
    firstDetectedAt?: string;
    lastConfirmedAt?: string;
    driftCount?: number;
    driftPattern?: string;
  };
  findings?: string;
  conclusion?: string;
  createdAt?: string;
}

export interface VerificationReportRecord {
  id?: string;
  reportId: string;
  investigationId?: string;
  evidenceIds: string[];
  reportType: string;
  generatedAt: string;
  generatedBy?: string;
  generatedByName?: string;
  summary: {
    totalEvidence: number;
    verifiedEvidence: number;
    failedEvidence: number;
    pendingEvidence: number;
    tamperDetected: number;
  };
  content?: unknown;
  reportHash?: string;
  digitalSignature?: string;
  exportedAt?: string;
  exportedBy?: string;
  exportFormat?: string;
  createdAt?: string;
}
