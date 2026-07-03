/**
 * Blockchain Configuration
 * Web3 and blockchain integration settings
 */

export interface BlockchainConfig {
  enabled: boolean;
  network: 'mainnet' | 'testnet' | 'sepolia' | 'local';
  rpcUrl: string;
  contractAddress: string;
  chainId: number;
  explorerUrl: string;
  confirmations: number;
  gasSettings: {
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    gasLimit: number;
  };
}

export interface EvidenceVerificationConfig {
  hashAlgorithm: 'sha256' | 'sha3-256';
  verificationBatchSize: number;
  autoVerifyOnUpload: boolean;
  storeHashesOnChain: boolean;
}

export interface WalletConfig {
  type: 'educational' | 'testnet';
  address: string;
  privateKey: string;
  minConfirmations: number;
}

export const blockchainConfig: BlockchainConfig = {
  enabled: process.env.BLOCKCHAIN_ENABLED === 'true',
  network: (process.env.BLOCKCHAIN_NETWORK as any) || 'sepolia',
  rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'https://sepolia.infura.io/v3/your-project-id',
  contractAddress: process.env.BLOCKCHAIN_CONTRACT_ADDRESS || '',
  chainId: process.env.BLOCKCHAIN_CHAIN_ID ? parseInt(process.env.BLOCKCHAIN_CHAIN_ID) : 11155111,
  explorerUrl: process.env.BLOCKCHAIN_EXPLORER_URL || 'https://sepolia.etherscan.io',
  confirmations: parseInt(process.env.BLOCKCHAIN_CONFIRMATIONS || '1'),
  gasSettings: {
    maxFeePerGas: '2000000000', // 2 gwei
    maxPriorityFeePerGas: '1000000000', // 1 gwei
    gasLimit: 500000,
  },
};

export const verificationConfig: EvidenceVerificationConfig = {
  hashAlgorithm: 'sha256',
  verificationBatchSize: 10,
  autoVerifyOnUpload: process.env.AUTO_VERIFY_ON_UPLOAD === 'true',
  storeHashesOnChain: process.env.STORE_HASHES_ON_CHAIN === 'true',
};

export const walletConfig: WalletConfig = {
  type: 'testnet',
  address: process.env.BLOCKCHAIN_WALLET_ADDRESS || '',
  privateKey: process.env.BLOCKCHAIN_PRIVATE_KEY || '',
  minConfirmations: 6,
};

export default {
  blockchain: blockchainConfig,
  verification: verificationConfig,
  wallet: walletConfig,
};