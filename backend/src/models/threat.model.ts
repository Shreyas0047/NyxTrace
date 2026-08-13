/**
 * IOC (Indicator of Compromise) Model
 * Threat intelligence data models
 */

import mongoose, { Schema } from 'mongoose';

// ============================================
// IOC TYPES
// ============================================

export enum IOCTypes {
  IP_ADDRESS = 'ip_address',
  DOMAIN = 'domain',
  URL = 'url',
  FILE_HASH = 'file_hash',
  PROCESS_NAME = 'process_name',
  REGISTRY_KEY = 'registry_key',
  FILE_PATH = 'file_path',
  COMMAND_LINE = 'command_line',
  EMAIL = 'email',
  MUTEX = 'mutex',
  YARA_RULE = 'yara_rule',
  BEHAVIORAL = 'behavioral',
}

export enum IOCSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

export enum IOCStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  OBSOLETE = 'obsolete',
  FALSE_POSITIVE = 'false_positive',
}

export enum MITRETactics {
  RECONNAISSANCE = 'reconnaissance',
  RESOURCE_DEVELOPMENT = 'resource_development',
  INITIAL_ACCESS = 'initial_access',
  EXECUTION = 'execution',
  PERSISTENCE = 'persistence',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  DEFENSE_EVASION = 'defense_evasion',
  CREDENTIAL_ACCESS = 'credential_access',
  DISCOVERY = 'discovery',
  LATERAL_MOVEMENT = 'lateral_movement',
  COLLECTION = 'collection',
  COMMAND_AND_CONTROL = 'command_and_control',
  EXFILTRATION = 'exfiltration',
  IMPACT = 'impact',
}

// ============================================
// IOC SCHEMA
// ============================================

const iocSchema = new Schema({
  iocId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  // IOC type and value
  type: {
    type: String,
    enum: Object.values(IOCTypes),
    required: true,
    index: true,
  },

  value: {
    type: String,
    required: true,
    index: true,
  },

  // Classification
  severity: {
    type: String,
    enum: Object.values(IOCSeverity),
    default: IOCSeverity.MEDIUM,
    index: true,
  },

  status: {
    type: String,
    enum: Object.values(IOCStatus),
    default: IOCStatus.ACTIVE,
    index: true,
  },

  // Context
  category: {
    type: String,
    required: true,
    index: true,
  },

  description: String,

  // Source
  source: {
    type: String,
    required: true,
  },

  confidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 50,
  },

  // MITRE ATT&CK mapping
  mitreTactics: [{
    type: String,
    enum: Object.values(MITRETactics),
  }],

  mitreTechniques: [String],

  // Related entities
  linkedEvidence: [{
    type: Schema.Types.ObjectId,
    ref: 'Evidence',
  }],

  linkedInvestigations: [{
    type: Schema.Types.ObjectId,
    ref: 'Investigation',
  }],

  // Behavioral signature
  behavioralSignature: {
    processTree: [String],
    networkPatterns: [String],
    registryPatterns: [String],
    filePatterns: [String],
  },

  // Statistics
  firstSeenAt: {
    type: Date,
    default: Date.now,
  },

  lastSeenAt: {
    type: Date,
    default: Date.now,
  },

  occurrenceCount: {
    type: Number,
    default: 1,
  },

  // Threat scoring
  threatScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },

  // Tags
  tags: [String],

  // Analyst notes
  analystNotes: String,

  // Created by
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // Reputation
  falsePositiveCount: {
    type: Number,
    default: 0,
  },

  verifiedCount: {
    type: Number,
    default: 0,
  },

}, {
  timestamps: true,
  toJSON: {
    transform: (doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

// ============================================
// THREAT CORRELATION SCHEMA
// ============================================

const threatCorrelationSchema = new Schema({
  correlationId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  // Correlation type
  correlationType: {
    type: String,
    enum: ['ioc_match', 'behavioral_pattern', 'telemetry_similarity', 'investigation_link', 'time_correlation'],
    required: true,
  },

  // Entities involved
  entities: [{
    entityType: {
      type: String,
      enum: ['evidence', 'ioc', 'investigation', 'telemetry', 'alert'],
    },
    entityId: String,
    entityValue: String,
  }],

  // Correlation strength
  strength: {
    type: Number,
    min: 0,
    max: 100,
    required: true,
  },

  // Details
  description: String,

  // Related investigations
  linkedInvestigations: [{
    type: Schema.Types.ObjectId,
    ref: 'Investigation',
  }],

  // Evidence cluster
  clusterId: String,
  clusterLabel: String,

  // Visualization data
  graphData: {
    nodes: [{
      id: String,
      type: { type: String },
      label: String,
    }],
    edges: [{
      source: String,
      target: String,
      relationship: String,
    }],
  },

  // Detection
  detectedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },

  detectedAt: {
    type: Date,
    default: Date.now,
  },

  // Status
  status: {
    type: String,
    enum: ['new', 'investigating', 'confirmed', 'dismissed'],
    default: 'new',
  },

}, {
  timestamps: true,
  toJSON: {
    transform: (doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

// ============================================
// THREAT ENRICHMENT SCHEMA
// ============================================

const threatEnrichmentSchema = new Schema({
  enrichmentId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  // Target entity
  targetType: {
    type: String,
    enum: ['evidence', 'ioc', 'investigation', 'alert'],
    required: true,
  },

  targetId: {
    type: String,
    required: true,
    index: true,
  },

  // Enrichment data
  enrichmentType: {
    type: String,
    enum: ['ioc_lookup', 'behavioral_analysis', 'historical_correlation', 'threat_actor_mapping', 'geolocation', 'reputation_check'],
    required: true,
  },

  // Results
  matchedIocs: [{
    iocId: String,
    iocType: String,
    iocValue: String,
    severity: String,
    confidence: Number,
  }],

  relatedEntities: [{
    entityType: String,
    entityId: String,
    relationship: String,
    relevanceScore: Number,
  }],

  behavioralContext: {
    pattern: String,
    anomalies: [String],
    riskIndicators: [String],
  },

  // Threat context
  threatContext: {
    threatActor: String,
    attackCampaign: String,
    associatedMalware: [String],
    associatedTTPs: [String],
  },

  // Enrichment metadata
  enrichedAt: {
    type: Date,
    default: Date.now,
  },

  confidence: {
    type: Number,
    min: 0,
    max: 100,
  },

  rawData: Schema.Types.Mixed,

}, {
  timestamps: true,
  toJSON: {
    transform: (doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

// ============================================
// THREAT ANALYTICS SCHEMA
// ============================================

const threatAnalyticsSchema = new Schema({
  analyticsId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  // Analytics type
  analyticsType: {
    type: String,
    enum: ['trend', 'heatmap', 'distribution', 'correlation', 'anomaly'],
    required: true,
  },

  // Time range
  timeRange: {
    start: Date,
    end: Date,
  },

  // Data
  data: {
    labels: [String],
    values: [Number],
    series: [{
      name: String,
      data: [Number],
    }],
  },

  // Filters
  filters: {
    severity: [String],
    iocTypes: [String],
    categories: [String],
    investigations: [String],
  },

  // Visualization
  visualizationConfig: {
    chartType: String,
    colorScheme: [String],
    thresholds: [{
      value: Number,
      color: String,
      label: String,
    }],
  },

  generatedAt: {
    type: Date,
    default: Date.now,
  },

  generatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },

}, {
  timestamps: true,
  toJSON: {
    transform: (doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

// ============================================
// CREATE MODELS
// ============================================

export const IOC = mongoose.model('IOC', iocSchema);
export const ThreatCorrelation = mongoose.model('ThreatCorrelation', threatCorrelationSchema);
export const ThreatEnrichment = mongoose.model('ThreatEnrichment', threatEnrichmentSchema);
export const ThreatAnalytics = mongoose.model('ThreatAnalytics', threatAnalyticsSchema);

// ============================================
// INDEXES
// ============================================

iocSchema.index({ type: 1, status: 1 });
iocSchema.index({ severity: 1, status: 1 });
iocSchema.index({ category: 1, severity: 1 });
iocSchema.index({ value: 'text' });
iocSchema.index({ threatScore: -1 });
iocSchema.index({ lastSeenAt: -1 });
iocSchema.index({ tags: 1 });

threatCorrelationSchema.index({ correlationType: 1, status: 1 });
threatCorrelationSchema.index({ strength: -1 });
threatCorrelationSchema.index({ 'entities.entityId': 1 });
threatCorrelationSchema.index({ clusterId: 1 });

threatEnrichmentSchema.index({ targetType: 1, targetId: 1 });
threatEnrichmentSchema.index({ enrichmentType: 1, enrichedAt: -1 });

threatAnalyticsSchema.index({ analyticsType: 1, generatedAt: -1 });

export default {
  IOC,
  ThreatCorrelation,
  ThreatEnrichment,
  ThreatAnalytics,
};