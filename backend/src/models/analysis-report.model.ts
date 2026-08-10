import mongoose, { Schema } from 'mongoose';

export interface IAnalysisReport {
  analysisId: string;
  analysisType: 'sandbox_behavioral' | 'document_analysis' | 'url_analysis';
  sourceType: 'exe' | 'pdf' | 'docx' | 'url' | 'unknown';
  sourceName: string;
  sourceSize?: number;
  threatScore: number;
  threatLevel: 'critical' | 'high' | 'medium' | 'low' | 'safe' | 'unknown';
  confidence: number;
  predictedThreat: string;
  findings: any[];
  indicators: any[];
  iocCount: number;
  mitreTechniques: string[];
  heuristicsTriggered: string[];
  recommendations: string[];
  summary: string;
  aiInsights?: Record<string, any> | null;
  metadata: Record<string, any>;
  analyzedBy: string;
  analysisTimestamp: Date;
}

const analysisReportSchema = new Schema({
  analysisId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  analysisType: {
    type: String,
    required: true,
    enum: ['sandbox_behavioral', 'document_analysis', 'url_analysis'],
  },
  sourceType: {
    type: String,
    required: true,
    enum: ['exe', 'pdf', 'docx', 'url', 'unknown'],
  },
  sourceName: {
    type: String,
    required: true,
  },
  sourceSize: {
    type: Number,
  },
  threatScore: {
    type: Number,
    required: true,
    default: 0,
  },
  threatLevel: {
    type: String,
    required: true,
    enum: ['critical', 'high', 'medium', 'low', 'safe', 'unknown'],
    default: 'unknown',
  },
  confidence: {
    type: Number,
    default: 0,
  },
  predictedThreat: {
    type: String,
    default: 'unknown',
  },
  findings: [{
    type: Schema.Types.Mixed,
  }],
  indicators: [{
    type: Schema.Types.Mixed,
  }],
  iocCount: {
    type: Number,
    default: 0,
  },
  mitreTechniques: [{
    type: String,
  }],
  heuristicsTriggered: [{
    type: String,
  }],
  recommendations: [{
    type: String,
  }],
  summary: {
    type: String,
  },
  aiInsights: {
    type: Schema.Types.Mixed,
    default: null,
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
  },
  analyzedBy: {
    type: String,
    default: 'system',
  },
  analysisTimestamp: {
    type: Date,
    default: Date.now,
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

analysisReportSchema.index({ analysisType: 1, analysisTimestamp: -1 });
analysisReportSchema.index({ threatLevel: 1 });
analysisReportSchema.index({ sourceName: 'text', summary: 'text' });

export const AnalysisReport = mongoose.model('AnalysisReport', analysisReportSchema);
export default AnalysisReport;
