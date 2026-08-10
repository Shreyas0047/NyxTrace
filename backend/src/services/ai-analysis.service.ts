/**
 * AI Analysis Service
 * Integration layer for communicating with Python AI microservice
 */

import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { AppError } from '../middleware';
import { websocketService } from './websocket.service';
import logger from '../config/logger';

export interface TelemetryEvent {
  timestamp: string;
  type: string;
  source: string;
  details: Record<string, any>;
}

export interface TelemetryAnalysisRequest {
  sessionId: string;
  investigationId?: string;
  events: TelemetryEvent[];
  metadata?: Record<string, any>;
}

export interface TelemetryAnalysisResult {
  session_id: string;
  analysis_timestamp: string;
  total_events: number;
  suspicious_events: number;
  threat_classification: Record<string, number>;
  severity_score: number;
  severity_level: string;
  anomalies: Array<{
    type: string;
    description: string;
    severity: string;
    deviation_score: number;
  }>;
  behavioral_summary: string;
  recommendations: string[];
  confidence: number;
}

export interface AlertEnrichmentRequest {
  alertId: string;
  title: string;
  description: string;
  type: string;
  severity: string;
  iocIndicators?: Array<{ type: string; value: string }>;
}

export interface InvestigationSummaryRequest {
  investigationId: string;
  caseNumber: string;
  evidence: any[];
  reports: any[];
  alerts: any[];
  timeline: any[];
}

export interface DocumentInsightsRequest {
  analysisId: string;
  filename: string;
  fileType: string;
  extractedText: string;
  findings: Array<{ type?: string; severity?: string; description?: string; score?: number }>;
  embeddedUrls: string[];
  macroRisk?: Record<string, any> | null;
  threatScore: number;
  threatLevel: string;
  predictedThreat: string;
}

export interface UrlInsightsRequest {
  analysisId: string;
  url: string;
  hostname: string;
  tld: string;
  isIpBased: boolean;
  heuristicsTriggered: string[];
  indicators: Array<{ type?: string; description?: string; score?: number }>;
  riskScore: number;
  riskLevel: string;
  phishingProbability: number;
}

export class AIAnalysisService {
  private client: AxiosInstance;
  private timeout: number;

  constructor() {
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    this.timeout = parseInt(process.env.AI_SERVICE_TIMEOUT || '60000', 10);

    this.client = axios.create({
      baseURL: aiServiceUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Normalize granular simulator event types to coarse AI-service types
   */
  private normalizeEventType(eventType: string): string {
    const t = eventType.toLowerCase();
    if (/file|encrypt|write|delete/.test(t)) return 'file';
    if (/process|start|terminate/.test(t)) return 'process';
    if (/registry/.test(t)) return 'registry';
    if (/network|connect|dns|beacon/.test(t)) return 'network';
    return 'behavior';
  }

  /**
   * Analyze telemetry events from sandbox execution
   */
  async analyzeTelemetry(request: TelemetryAnalysisRequest): Promise<TelemetryAnalysisResult> {
    try {
      const normalizedEvents = request.events.map((event) => ({
        ...event,
        type: this.normalizeEventType(event.type),
      }));

      const response = await this.client.post('/api/v1/analyze/telemetry', {
        session_id: request.sessionId,
        investigation_id: request.investigationId,
        events: normalizedEvents,
        metadata: request.metadata,
      });

      if (!response.data.success) {
        throw new AppError('AI analysis failed', 500, 'AI_ANALYSIS_FAILED');
      }

      const result = response.data.data;
      websocketService.emitAIAnalysisComplete(request.investigationId || request.sessionId, result);
      return result;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
          // Degraded mode — return a minimal result instead of crashing
          return {
            session_id: request.sessionId,
            analysis_timestamp: new Date().toISOString(),
            total_events: request.events.length,
            suspicious_events: 0,
            threat_classification: {},
            severity_score: 0,
            severity_level: 'informational',
            anomalies: [],
            behavioral_summary: 'AI service unavailable — analysis deferred. Events stored for later processing.',
            recommendations: ['AI service is currently unreachable. Retry analysis when service recovers.'],
            confidence: 0,
          };
        }
        if (error.response) {
          throw new AppError(`AI service error: ${error.response.status}`, error.response.status, 'AI_SERVICE_ERROR');
        }
      }
      throw new AppError('Failed to analyze telemetry', 500, 'ANALYSIS_FAILED');
    }
  }

  /**
   * Enrich alert with AI analysis
   */
  async enrichAlert(alertData: AlertEnrichmentRequest): Promise<any> {
    try {
      const response = await this.client.post('/api/v1/enrich/alert', alertData);

      if (!response.data.success) {
        throw new AppError('AI alert enrichment failed', 500, 'AI_ENRICHMENT_FAILED');
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error) && (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT')) {
        return { alert_id: alertData.alertId, ai_severity_assessment: alertData.severity, confidence: 0, analysis_summary: 'AI service unavailable — enrichment deferred.', recommendations: [] };
      }
      throw new AppError('Failed to enrich alert', 500, 'ENRICHMENT_FAILED');
    }
  }

  /**
   * Generate AI-powered investigation summary
   */
  async generateInvestigationSummary(request: InvestigationSummaryRequest): Promise<any> {
    try {
      const response = await this.client.post('/api/v1/summarize/investigation', request);

      if (!response.data.success) {
        throw new AppError('AI summarization failed', 500, 'AI_SUMMARIZATION_FAILED');
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error) && (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT')) {
        return { executive_summary: 'AI service unavailable — summary deferred.', key_findings: [], recommendations: ['Retry when AI service recovers.'], confidence: 0 };
      }
      throw new AppError('Failed to generate summary', 500, 'SUMMARIZATION_FAILED');
    }
  }

  /**
   * LLM-enhanced second opinion for heuristic document analysis.
   * Non-blocking enhancer — returns null when the AI service is down or
   * the LLM is unavailable; never throws.
   */
  async analyzeDocument(insightsRequest: DocumentInsightsRequest): Promise<any> {
    try {
      const response = await this.client.post('/api/v1/analyze/document', insightsRequest);
      if (!response.data || !response.data.success) return null;
      return response.data.data || null;
    } catch (error) {
      if (axios.isAxiosError(error) && (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED')) {
        logger.info('[AI] Document LLM enhancement skipped — AI service unavailable');
        return null;
      }
      if (axios.isAxiosError(error) && error.response) {
        logger.warn(`[AI] Document LLM enhancement failed (HTTP ${error.response.status})`);
        return null;
      }
      return null;
    }
  }

  /**
   * LLM-enhanced second opinion for heuristic URL analysis.
   * Non-blocking enhancer — returns null when the AI service is down or
   * the LLM is unavailable; never throws.
   */
  async analyzeUrl(insightsRequest: UrlInsightsRequest): Promise<any> {
    try {
      const response = await this.client.post('/api/v1/analyze/url', insightsRequest);
      if (!response.data || !response.data.success) return null;
      return response.data.data || null;
    } catch (error) {
      if (axios.isAxiosError(error) && (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED')) {
        logger.info('[AI] URL LLM enhancement skipped — AI service unavailable');
        return null;
      }
      if (axios.isAxiosError(error) && error.response) {
        logger.warn(`[AI] URL LLM enhancement failed (HTTP ${error.response.status})`);
        return null;
      }
      return null;
    }
  }

  /**
   * Analyze forensic report
   */
  async analyzeReport(reportData: any, investigationId?: string): Promise<any> {
    try {
      const response = await this.client.post('/api/v1/analyze/report', {
        report_data: reportData,
        investigation_id: investigationId,
      });

      if (!response.data.success) {
        throw new AppError('AI report analysis failed', 500, 'AI_REPORT_ANALYSIS_FAILED');
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
        throw new AppError('AI service unavailable', 503, 'AI_SERVICE_UNAVAILABLE');
      }
      throw new AppError('Failed to analyze report', 500, 'REPORT_ANALYSIS_FAILED');
    }
  }

  /**
   * Check AI service health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      return response.data.status === 'healthy';
    } catch {
      return false;
    }
  }
}

export const aiAnalysisService = new AIAnalysisService();
export default aiAnalysisService;