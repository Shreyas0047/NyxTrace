/**
 * Report Model - Enhanced Enterprise Edition
 * Comprehensive forensic report management
 */

import mongoose, { Schema } from 'mongoose';

// ============================================
// REPORT TYPE ENUM
// ============================================

export enum ReportType {
  INVESTIGATION = 'investigation',
  EVIDENCE = 'evidence',
  THREAT_ANALYSIS = 'threat_analysis',
  EXECUTIVE = 'executive',
  TECHNICAL = 'technical',
  INCIDENT = 'incident',
  MALWARE = 'malware',
  SANDBOX = 'sandbox',
}

// ============================================
// REPORT STATUS ENUM
// ============================================

export enum ReportStatus {
  DRAFT = 'draft',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  PUBLISHED = 'published',
  REJECTED = 'rejected',
  ARCHIVED = 'archived',
}

// ============================================
// REPORT SEVERITY
// ============================================

export enum ReportSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFORMATIONAL = 'informational',
}

// ============================================
// FINDING STRUCTURE
// ============================================

export interface ReportFinding {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  timestamp: Date;
  indicators: string[];
  evidence: string[];
  recommendations: string[];
  mitreTactics: string[];
  mitreTechniques?: string[];
}

// ============================================
// EXECUTIVE SUMMARY
// ============================================

export interface ExecutiveSummary {
  overview: string;
  keyFindings: string[];
  riskLevel: string;
  recommendedActions: string[];
  timeline: string;
}

// ============================================
// TECHNICAL DETAILS
// ============================================

export interface TechnicalDetail {
  section: string;
  content: string;
  code?: string;
  logs?: string[];
  screenshots?: string[];
}

// ============================================
// AI ANALYSIS RESULTS
// ============================================

export interface AIAnalysisResults {
  summary: string;
  threatClassification: {
    category: string;
    family: string;
    confidence: number;
  };
  behavioralIndicators: string[];
  recommendations: string[];
  similarThreats: string[];
  riskScore: number;
}

// ============================================
// REPORT SCHEMA
// ============================================

const reportSchema = new Schema({
  // Core identification
  reportId: {
    type: String,
    unique: true,
    index: true,
  },

  // Investigation reference
  investigationId: {
    type: Schema.Types.ObjectId,
    ref: 'Investigation',
    required: true,
    index: true,
  },
  investigationCaseNumber: String,

  // Basic info
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
  },
  summary: {
    type: String,
    required: true,
    maxlength: 5000,
  },

  // Classification
  type: {
    type: String,
    enum: Object.values(ReportType),
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: Object.values(ReportStatus),
    default: ReportStatus.DRAFT,
    index: true,
  },
  severity: {
    type: String,
    enum: Object.values(ReportSeverity),
  },

  // Content
  executiveSummary: {
    overview: String,
    keyFindings: [String],
    riskLevel: String,
    recommendedActions: [String],
    timeline: String,
  },
  findings: [{
    id: String,
    category: String,
    severity: String,
    title: String,
    description: String,
    timestamp: Date,
    indicators: [String],
    evidence: [String],
    recommendations: [String],
    mitreTactics: [String],
    mitreTechniques: [String],
  }],
  technicalDetails: [{
    section: String,
    content: String,
    code: String,
    logs: [String],
    screenshots: [String],
  }],
  recommendations: [{
    priority: String,
    description: String,
    rationale: String,
    implemented: Boolean,
  }],
  iocIndicators: [{
    type: { type: String },
    value: String,
    description: String,
    context: String,
  }],

  // Timeline
  timeline: [{
    timestamp: Date,
    event: String,
    description: String,
    source: String,
  }],
  affectedSystems: [String],
  affectedUsers: [String],

  // AI Analysis
  aiAnalysisCompleted: {
    type: Boolean,
    default: false,
  },
  aiAnalysis: {
    summary: String,
    threatClassification: {
      category: String,
      family: String,
      confidence: Number,
    },
    behavioralIndicators: [String],
    recommendations: [String],
    similarThreats: [String],
    riskScore: Number,
  },

  // Authorship
  generatedAt: {
    type: Date,
    default: Date.now,
    // NOTE: duplicates createdAt from timestamps:true - use createdAt instead
  },
  generatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  reviewedAt: Date,
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedAt: Date,

  // Versioning
  version: {
    type: String,
    default: '1.0.0',
  },
  versionNotes: String,
  previousVersions: [{
    version: String,
    generatedAt: Date,
    generatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    changes: String,
  }],

  // Publication
  published: {
    type: Boolean,
    default: false,
  },
  publishedAt: Date,
  publishedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },

  // Related entities
  evidenceIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Evidence',
  }],
  sandboxSessionId: {
    type: Schema.Types.ObjectId,
    ref: 'SandboxSession',
  },

  // Export formats
  exportFormats: [{
    format: String,
    path: String,
    generatedAt: Date,
  }],

  // Tags
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],

  // Custom fields
  customFields: {
    type: Schema.Types.Mixed,
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
// INDEXES
// ============================================

reportSchema.index({ investigationId: 1, type: 1 });
reportSchema.index({ investigationId: 1, status: 1 });
reportSchema.index({ generatedAt: -1 });
reportSchema.index({ generatedBy: 1 });
reportSchema.index({ tags: 1 });
reportSchema.index({ severity: 1, status: 1 });
reportSchema.index({ published: 1, status: 1 });

// Text search
reportSchema.index({
  title: 'text',
  summary: 'text',
  tags: 'text',
});

// ============================================
// METHODS
// ============================================

// Submit for review
reportSchema.methods.submitForReview = function() {
  this.status = ReportStatus.IN_REVIEW;
  return this.save();
};

// Approve report
reportSchema.methods.approve = function(userId: string) {
  this.status = ReportStatus.APPROVED;
  this.approvedAt = new Date();
  this.approvedBy = userId as any;
  return this.save();
};

// Publish report
reportSchema.methods.publish = function(userId: string) {
  this.status = ReportStatus.PUBLISHED;
  this.published = true;
  this.publishedAt = new Date();
  this.publishedBy = userId as any;
  return this.save();
};

// Add finding
reportSchema.methods.addFinding = function(finding: any) {
  this.findings.push(finding);
  return this.save();
};

// ============================================
// EXPORT
// ============================================

export const Report = mongoose.model('Report', reportSchema);
export default Report;