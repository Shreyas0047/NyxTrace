import logger from '../config/logger';
import * as fs from 'fs';
import * as path from 'path';

const CONFIG_FILE = path.resolve(process.cwd(), 'uploads/system-config.json');

interface SystemConfig {
  blockchain: {
    contractAddress: string;
    networkRpc: string;
    chainId: string;
    autoSync: boolean;
    confirmations: string;
    gasLimit: string;
  };
  database: {
    mongodbUri: string;
    dbName: string;
    poolSize: string;
    autoIndex: boolean;
    backupEnabled: boolean;
  };
  aiService: {
    llmProvider: string;
    llmModel: string;
    apiEndpoint: string;
    analysisEnabled: boolean;
    cacheTtl: string;
    maxRetries: string;
  };
  notifications: {
    smtpHost: string;
    smtpPort: string;
    smtpUser: string;
    smtpPass: string;
    alertEmail: string;
    criticalAlerts: boolean;
  };
  sandbox: {
    vmName: string;
    vmRam: string;
    vmCpus: string;
    timeout: string;
    snapshotRestore: boolean;
    networkEnabled: boolean;
  };
  security: {
    jwtExpiry: string;
    refreshExpiry: string;
    maxLoginAttempts: string;
    otpEnabled: boolean;
    sessionTimeout: string;
    auditLogging: boolean;
  };
}

const DEFAULT_CONFIG: SystemConfig = {
  blockchain: {
    contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    networkRpc: 'http://127.0.0.1:8545',
    chainId: '31337',
    autoSync: true,
    confirmations: '3',
    gasLimit: '300000',
  },
  database: {
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/nyxtrace',
    dbName: 'nyxtrace',
    poolSize: '10',
    autoIndex: true,
    backupEnabled: true,
  },
  aiService: {
    llmProvider: 'ollama',
    llmModel: 'llama3.2:3b',
    apiEndpoint: 'http://127.0.0.1:11434',
    analysisEnabled: true,
    cacheTtl: '300',
    maxRetries: '3',
  },
  notifications: {
    smtpHost: 'smtp.nyxtrace.io',
    smtpPort: '587',
    smtpUser: 'notifications@nyxtrace.io',
    smtpPass: '',
    alertEmail: 'alerts@nyxtrace.io',
    criticalAlerts: true,
  },
  sandbox: {
    vmName: 'NyxTrace-Sandbox',
    vmRam: '4096',
    vmCpus: '2',
    timeout: '300',
    snapshotRestore: true,
    networkEnabled: false,
  },
  security: {
    jwtExpiry: '24',
    refreshExpiry: '7',
    maxLoginAttempts: '5',
    otpEnabled: true,
    sessionTimeout: '30',
    auditLogging: true,
  },
};

function loadConfig(): SystemConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const saved = JSON.parse(content);
      return deepMerge({ ...DEFAULT_CONFIG }, saved);
    }
  } catch (error) {
    logger.error('Error loading system config:', error);
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config: SystemConfig): void {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    logger.error('Error saving system config:', error);
    throw error;
  }
}

function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export class ConfigService {
  getConfig(): SystemConfig {
    return loadConfig();
  }

  updateConfig(section: string, values: Record<string, unknown>): SystemConfig {
    const current = loadConfig();
    if (current[section as keyof SystemConfig]) {
      (current[section as keyof SystemConfig] as any) = {
        ...(current[section as keyof SystemConfig] as any),
        ...values,
      };
    }
    saveConfig(current);
    return current;
  }

  resetConfig(): SystemConfig {
    saveConfig({ ...DEFAULT_CONFIG });
    return { ...DEFAULT_CONFIG };
  }

  getSection(section: string): Record<string, unknown> | null {
    const config = loadConfig();
    return (config[section as keyof SystemConfig] as any) || null;
  }
}

export const configService = new ConfigService();
