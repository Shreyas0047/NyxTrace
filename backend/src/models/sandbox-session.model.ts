/**
 * Sandbox Session Model
 * Mongoose schema for desktop sandbox synchronization
 */

import mongoose, { Schema } from 'mongoose';

const sandboxSessionSchema = new Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  // Evidence this session analyzes (evidence-driven workflow). Sessions are
  // created from an evidence record; the simulator is auto-selected from it.
  evidenceId: {
    type: Schema.Types.ObjectId,
    ref: 'Evidence',
    index: true,
  },
  // Artifact kind this session tests. 'document' / 'url' sessions run the
  // static + AI analysis pipeline; 'executable' sessions run in the VM.
  kind: {
    type: String,
    enum: ['executable', 'document', 'url'],
    default: 'executable',
    index: true,
  },
  vmName: {
    type: String,
    required: true,
  },
  simulatorId: {
    type: String,
    required: true,
  },
  simulatorName: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed', 'timeout'],
    default: 'pending',
    index: true,
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: Date,
  duration: Number,
  exitCode: Number,
  eventsCollected: {
    type: Number,
    default: 0,
  },
  evidenceFiles: [{
    type: String,
  }],
  errorMessages: {
    type: [String],
    default: [],
  },
  syncedAt: {
    type: Date,
    default: Date.now,
  },

  // Execution summary from sandbox
  executionSummary: {
    simulatorId: String,
    simulatorName: String,
    startTime: Date,
    endTime: Date,
    exitCode: Number,
    duration: Number,
    eventsCollected: Number,
    findings: [Schema.Types.Mixed],
    iocIndicators: [Schema.Types.Mixed],
    artifacts: [String],
    syncedAt: Date,
  },

  // Heartbeat and health monitoring
  lastHeartbeat: Date,
  vmState: String,
  memoryUsage: Number,
  cpuUsage: Number,

  // Telemetry data
  telemetry: [{
    timestamp: Date,
    eventCount: Number,
    eventCounts: Schema.Types.Mixed,
    anomalies: Number,
  }],
  recentEvents: [{
    id: String,
    timestamp: String,
    type: { type: String },
    source: String,
    details: Schema.Types.Mixed,
    receivedAt: Date,
  }],
  suspiciousEvents: [{
    timestamp: String,
    type: { type: String },
    source: String,
    details: Schema.Types.Mixed,
    flaggedAt: Date,
    reason: String,
  }],
  extractedIOCs: [{
    type: { type: String },
    value: String,
    source: String,
  }],

  // AI analysis result from AI microservice
  aiAnalysis: {
    session_id: String,
    analysis_timestamp: Date,
    total_events: Number,
    suspicious_events: Number,
    threat_classification: Schema.Types.Mixed,
    severity_score: Number,
    severity_level: String,
    anomalies: [{
      type: { type: String },
      description: String,
      severity: String,
      deviation_score: Number,
    }],
    behavioral_summary: String,
    recommendations: [String],
    confidence: Number,
  },

  // Rollback status
  rollbackStatus: {
    completed: Boolean,
    success: Boolean,
    snapshotRestored: String,
    errors: [String],
    completedAt: Date,
  },

  // Additional metadata
  metadata: {
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

// Indexes
sandboxSessionSchema.index({ status: 1, startTime: -1 });
sandboxSessionSchema.index({ simulatorId: 1 });
sandboxSessionSchema.index({ syncedAt: -1 });

export const SandboxSession = mongoose.model('SandboxSession', sandboxSessionSchema);
export default SandboxSession;