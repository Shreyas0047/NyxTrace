/**
 * Analytics Controller
 * Handles behavioral analytics and investigation correlation endpoints
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware';
import { ApiResponse } from '../types';
import { behavioralAnalyticsService, Anomaly, ProcessBehavior } from '../services/behavioral-analytics.service';
import { investigationCorrelationService, InvestigationCluster, InvestigationRelationship, CorrelationInsight } from '../services/investigation-correlation.service';
import { SandboxSession } from '../models';
import { TelemetryEvent } from '../models/telemetry-event.model';
import { sandboxRuntimeService } from '../services';
import { sandboxSyncService } from '../services';
import { aiAnalysisService } from '../services/ai-analysis.service';

type NormalizedTelemetry = {
  eventType: string;
  category: string;
  timestamp: Date;
  processName?: string;
  metadata: Record<string, any>;
};

const MITRE_BY_CATEGORY: Record<string, { id: string; name: string; tactic: string; description: string }> = {
  process: { id: 'T1059', name: 'Command and Scripting Interpreter', tactic: 'Execution', description: 'Suspicious process or command execution activity.' },
  file: { id: 'T1005', name: 'Data from Local System', tactic: 'Collection', description: 'File system activity relevant to data collection or modification.' },
  registry: { id: 'T1112', name: 'Modify Registry', tactic: 'Defense Evasion', description: 'Registry activity indicating persistence or configuration changes.' },
  network: { id: 'T1071', name: 'Application Layer Protocol', tactic: 'Command and Control', description: 'Outbound network activity or beaconing behavior.' },
  credential: { id: 'T1003', name: 'OS Credential Dumping', tactic: 'Credential Access', description: 'Credential access or sensitive store activity.' },
};

export class AnalyticsController {
  private normalizeEvent(raw: any): NormalizedTelemetry {
    const eventType = String(raw.eventType || raw.event_type || raw.type || raw.raw?.event_type || raw.raw?.type || 'unknown').toLowerCase();
    const metadata = raw.metadata || raw.details || raw.data || raw.raw?.details || raw.raw?.data || {};
    const text = `${eventType} ${JSON.stringify(metadata)} ${raw.processName || raw.process_name || ''}`.toLowerCase();
    const category =
      text.includes('registry') || text.includes('reg_') ? 'registry' :
      text.includes('network') || text.includes('connect') || text.includes('dns') || text.includes('http') ? 'network' :
      text.includes('credential') || text.includes('password') || text.includes('lsass') ? 'credential' :
      text.includes('file') || text.includes('write') || text.includes('delete') || text.includes('encrypt') ? 'file' :
      'process';

    return {
      eventType,
      category,
      timestamp: new Date(raw.timestamp || raw.createdAt || Date.now()),
      processName: raw.processName || raw.process_name || metadata.process_name || metadata.processName,
      metadata,
    };
  }

  private async loadSessionTelemetry(sessionId: string): Promise<NormalizedTelemetry[]> {
    const [events, session] = await Promise.all([
      TelemetryEvent.find({ sessionId }).sort({ timestamp: 1 }).limit(5000).lean(),
      SandboxSession.findOne({ sessionId }).lean(),
    ]);

    const normalized = events.map((event) => this.normalizeEvent(event));
    if (normalized.length > 0) return normalized;

    // Fallback: try fetching events directly from the sandbox agent runtime
    try {
      const agentData = await sandboxRuntimeService.getSessionEvents(sessionId);
      if (agentData.events && agentData.events.length > 0) {
        // Persist to TelemetryEvent collection so future analyses don't need the agent
        await sandboxSyncService.receiveForensicEvents({
          sessionId,
          events: agentData.events,
        });
        return agentData.events.map((event: any) => this.normalizeEvent(event));
      }
    } catch {
      // Agent unavailable — fall through to recentEvents
    }

    const recentEvents = (session?.recentEvents || []).map((event: any) => this.normalizeEvent(event));
    return recentEvents;
  }

  private analyzeTelemetry(sessionId: string, events: NormalizedTelemetry[]) {
    const counts = events.reduce<Record<string, number>>((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1;
      return acc;
    }, {});
    const suspiciousEvents = events.filter((event) => {
      const text = `${event.eventType} ${JSON.stringify(event.metadata)}`.toLowerCase();
      return /encrypt|delete|credential|password|lsass|registry|autorun|startup|beacon|connect|exfil|suspicious|ransom/.test(text);
    });

    const score = Math.min(10, Number((
      suspiciousEvents.length * 0.8 +
      (counts.file || 0) * 0.08 +
      (counts.registry || 0) * 0.25 +
      (counts.network || 0) * 0.2 +
      (counts.credential || 0) * 0.8
    ).toFixed(1)));

    const predictedThreat =
      suspiciousEvents.some(e => `${e.eventType} ${JSON.stringify(e.metadata)}`.toLowerCase().includes('encrypt')) ? 'ransomware' :
      (counts.credential || 0) > 0 ? 'credential_access' :
      (counts.network || 0) > Math.max(3, (counts.process || 0)) ? 'command_and_control' :
      suspiciousEvents.length > 0 ? 'suspicious_behavior' :
      'benign_or_inconclusive';

    const confidence = events.length === 0 ? 0 : Math.min(0.98, Number((0.35 + Math.min(suspiciousEvents.length / Math.max(events.length, 1), 0.5) + Math.min(events.length / 200, 0.13)).toFixed(2)));
    const severityLevel = score >= 8 ? 'critical' : score >= 6 ? 'high' : score >= 3 ? 'medium' : 'low';
    const mitreTechniques = Array.from(new Set(events.map(e => e.category)))
      .map((category) => MITRE_BY_CATEGORY[category])
      .filter(Boolean);
    const heuristics = [
      { name: 'Suspicious process execution', category: 'process', triggered: (counts.process || 0) > 0 },
      { name: 'File system modification burst', category: 'file', triggered: (counts.file || 0) >= 5 },
      { name: 'Registry persistence activity', category: 'registry', triggered: (counts.registry || 0) > 0 },
      { name: 'Outbound network behavior', category: 'network', triggered: (counts.network || 0) > 0 },
      { name: 'Credential access indicators', category: 'credential', triggered: (counts.credential || 0) > 0 },
    ].map((h) => ({
      name: h.name,
      triggered: h.triggered,
      severity: h.triggered ? (h.category === 'credential' ? 'critical' : h.category === 'registry' || h.category === 'network' ? 'high' : 'medium') : 'low',
      confidence: h.triggered ? Math.min(0.95, 0.55 + ((counts[h.category] || 0) / Math.max(events.length, 1))) : 0,
      description: h.triggered ? `${counts[h.category] || 0} ${h.category} event(s) observed in telemetry.` : `No ${h.category} signal observed.`,
    }));
    const anomalies = suspiciousEvents.slice(0, 10).map((event, index) => ({
      type: event.category,
      description: `${event.eventType} observed${event.processName ? ` from ${event.processName}` : ''}`,
      severity: event.category === 'credential' ? 'critical' : event.category === 'network' || event.category === 'registry' ? 'high' : 'medium',
      deviation_score: Math.min(0.99, 0.65 + index * 0.03),
    }));
    const recommendations = suspiciousEvents.length
      ? ['Review full telemetry timeline', 'Isolate the sandbox VM state before reuse', 'Preserve session artifacts and logs']
      : ['Collect additional telemetry before making a threat determination'];

    return {
      sessionId,
      analysisTimestamp: new Date().toISOString(),
      totalEvents: events.length,
      suspiciousEvents: suspiciousEvents.length,
      threatClassification: { [predictedThreat]: confidence },
      predictedThreat,
      confidence,
      reasons: [
        `${events.length} telemetry event(s) analyzed`,
        `${suspiciousEvents.length} suspicious behavior indicator(s) matched`,
        `Category counts: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(', ') || 'none'}`,
      ],
      severityScore: score,
      severityLevel,
      anomalies,
      behavioralSummary: suspiciousEvents.length
        ? `Telemetry shows ${predictedThreat.replace(/_/g, ' ')} indicators with ${severityLevel} severity.`
        : 'Telemetry does not contain enough suspicious behavior to classify a threat.',
      recommendations,
      mitreTechniques: mitreTechniques.map(t => ({ ...t, evidence: [`Telemetry category matched: ${t.tactic}`], confidence })),
      attackChain: {
        stages: mitreTechniques.map((technique, index) => ({
          stageName: technique.tactic,
          events: counts[Object.keys(MITRE_BY_CATEGORY).find(k => MITRE_BY_CATEGORY[k].id === technique.id) || 'process'] || 1,
          mitreTechniques: [technique.id],
        })),
      },
      behavioralHeuristics: heuristics,
      analystExplanation: suspiciousEvents.length
        ? 'Classification is derived from telemetry event categories and suspicious behavior keywords only.'
        : 'No high-confidence malicious telemetry patterns were present.',
    };
  }
  /**
   * GET /api/v1/analytics/patterns
   * Get behavioral patterns
   */
  async getBehavioralPatterns(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const patterns = behavioralAnalyticsService.getBehavioralPatterns();

      const response: ApiResponse = {
        success: true,
        message: 'Behavioral patterns retrieved',
        data: { patterns },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get behavioral patterns',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/analytics/analyze-behavior
   * Analyze process behavior
   */
  async analyzeProcessBehavior(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { evidenceId } = req.body;

      if (!evidenceId) {
        res.status(400).json({
          success: false,
          message: 'Evidence ID is required',
        });
        return;
      }

      const behavior = await behavioralAnalyticsService.analyzeProcessBehavior(evidenceId);

      const response: ApiResponse = {
        success: true,
        message: 'Process behavior analyzed',
        data: { behavior },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to analyze process behavior',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/analytics/detect-anomalies
   * Detect anomalies in evidence
   */
  async detectAnomalies(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { evidenceId } = req.body;

      if (!evidenceId) {
        res.status(400).json({
          success: false,
          message: 'Evidence ID is required',
        });
        return;
      }

      const anomalies = await behavioralAnalyticsService.detectAnomalies(evidenceId);

      const response: ApiResponse = {
        success: true,
        message: `Detected ${anomalies.length} anomalies`,
        data: { anomalies },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to detect anomalies',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/analytics/baseline
   * Analyze behavioral baseline
   */
  async analyzeBaseline(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { investigationId } = req.body;

      if (!investigationId) {
        res.status(400).json({
          success: false,
          message: 'Investigation ID is required',
        });
        return;
      }

      const baseline = await behavioralAnalyticsService.analyzeBehavioralBaseline(investigationId);

      const response: ApiResponse = {
        success: true,
        message: 'Behavioral baseline analyzed',
        data: baseline,
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to analyze baseline',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/analytics/clusters
   * Get investigation clusters
   */
  async getInvestigationClusters(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const clusters = await investigationCorrelationService.correlateInvestigations();

      const response: ApiResponse = {
        success: true,
        message: `Found ${clusters.length} investigation clusters`,
        data: { clusters },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get investigation clusters',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/analytics/clusters/:investigationId/relationships
   * Get relationships for specific investigation
   */
  async getInvestigationRelationships(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { investigationId } = req.params;

      const relationships = await investigationCorrelationService.getInvestigationRelationships(investigationId);

      const response: ApiResponse = {
        success: true,
        message: `Found ${relationships.length} relationships`,
        data: { relationships },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get investigation relationships',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/analytics/clusters/:investigationId/score
   * Score relationship between investigations
   */
  async scoreRelationship(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { investigationId } = req.params;
      const { targetInvestigationId } = req.body;

      if (!targetInvestigationId) {
        res.status(400).json({
          success: false,
          message: 'Target investigation ID is required',
        });
        return;
      }

      const score = await investigationCorrelationService.scoreRelationship(
        investigationId,
        targetInvestigationId
      );

      const response: ApiResponse = {
        success: true,
        message: 'Relationship scored',
        data: { score },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to score relationship',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/analytics/insights
   * Get correlation insights
   */
  async getCorrelationInsights(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { investigationId } = req.query;

      const insights = await investigationCorrelationService.generateCorrelationInsights(
        investigationId as string | undefined
      );

      const response: ApiResponse = {
        success: true,
        message: `Generated ${insights.length} insights`,
        data: { insights },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get correlation insights',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/analytics/cluster-visualization
   * Get cluster visualization data
   */
  async getClusterVisualization(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const visualization = await investigationCorrelationService.getClusterVisualization();

      const response: ApiResponse = {
        success: true,
        message: 'Cluster visualization retrieved',
        data: visualization,
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get cluster visualization',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/v1/analytics/session/analyze
   * Analyze a sandbox session
   */
  async analyzeSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        res.status(400).json({
          success: false,
          message: 'Session ID is required',
        });
        return;
      }

      const events = await this.loadSessionTelemetry(sessionId);
      if (events.length === 0) {
        res.status(404).json({
          success: false,
          message: 'No telemetry found for this session',
        });
        return;
      }

      let analysisResult: Record<string, any>;

      try {
        const aiResult = await aiAnalysisService.analyzeTelemetry({
          sessionId,
          events: events.map(e => ({
            timestamp: e.timestamp.toISOString(),
            type: e.eventType,
            source: e.category,
            details: e.metadata,
          })),
        });

        if (aiResult && aiResult.confidence > 0) {
          analysisResult = this.mapAIResult(sessionId, events, aiResult as any);

          await SandboxSession.updateOne(
            { sessionId },
            { $set: { aiAnalysis: aiResult } }
          );
        } else {
          analysisResult = this.analyzeTelemetry(sessionId, events);
        }
      } catch {
        analysisResult = this.analyzeTelemetry(sessionId, events);
      }

      const response: ApiResponse = {
        success: true,
        message: 'Session analyzed successfully',
        data: analysisResult,
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to analyze session',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private mapAIResult(sessionId: string, events: NormalizedTelemetry[], ai: any): Record<string, any> {
    const counts = events.reduce<Record<string, number>>((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1;
      return acc;
    }, {});

    const threatTypes = ai.threat_classification || {};
    const predictedThreat = Object.keys(threatTypes).sort((a, b) => (threatTypes[b] || 0) - (threatTypes[a] || 0))[0] || 'benign_or_inconclusive';

    const mitreTechniques = (ai.mitre_mapping || []).map((m: any) => ({
      id: m.technique_id,
      name: m.technique_name,
      tactic: m.tactic,
      description: `${m.technique_name} (${m.technique_id})`,
      evidence: m.evidence_snippets || [],
      confidence: m.confidence || ai.confidence || 0.5,
    }));

    const attackStages = (ai.attack_chain || []).map((link: any) => ({
      stageName: link.phase?.replace(/_/g, ' ') || 'Unknown',
      events: link.event_count || 0,
      mitreTechniques: link.techniques || [],
    }));

    const heuristics = [
      { name: 'Suspicious process execution', triggered: (counts.process || 0) > 0 },
      { name: 'File system modification', triggered: (counts.file || 0) >= 5 },
      { name: 'Registry persistence activity', triggered: (counts.registry || 0) > 0 },
      { name: 'Outbound network behavior', triggered: (counts.network || 0) > 0 },
      { name: 'Credential access indicators', triggered: (counts.credential || 0) > 0 },
    ].map(h => ({
      name: h.name,
      triggered: h.triggered,
      severity: h.triggered ? 'medium' : 'low',
      confidence: h.triggered ? Math.min(0.9, ai.confidence || 0.5) : 0,
      description: h.triggered ? `${h.name} detected in telemetry` : `No ${h.name.toLowerCase()} observed`,
    }));

    const anomalies: any[] = (ai.anomalies || []).map((a: any) => ({
      type: a.type || 'behavioral',
      description: a.description || '',
      severity: a.severity || 'medium',
      deviation_score: a.deviation_score || 0,
    }));

    const severityScore = Number(((ai.severity_score || 0) / 10).toFixed(1));

    return {
      sessionId,
      analysisTimestamp: new Date().toISOString(),
      totalEvents: ai.total_events || events.length,
      suspiciousEvents: ai.suspicious_events || 0,
      threatClassification: threatTypes,
      predictedThreat,
      confidence: ai.confidence || 0,
      reasons: [
        `AI microservice analyzed ${ai.total_events || events.length} events`,
        `${ai.suspicious_events || 0} suspicious events detected`,
        `Primary threat: ${predictedThreat.replace(/_/g, ' ')}`,
        `Severity: ${ai.severity_level || 'unknown'} (${ai.severity_score || 0}/100)`,
      ],
      severityScore,
      severityLevel: ai.severity_level || 'low',
      anomalies,
      behavioralSummary: ai.behavioral_summary || ai.reconstruction_summary || 'Analysis completed',
      recommendations: ai.recommendations || [],
      mitreTechniques,
      attackChain: { stages: attackStages.length > 0 ? attackStages : [{ stageName: 'Execution', events: events.length, mitreTechniques: mitreTechniques.map((m: any) => m.id) }] },
      behavioralHeuristics: heuristics,
      analystExplanation: ai.reconstruction_summary || ai.behavioral_summary || `Threat classification: ${predictedThreat.replace(/_/g, ' ')}. Confidence: ${((ai.confidence || 0) * 100).toFixed(0)}%.`,
    };
  }

  /**
   * POST /api/v1/analytics/sessions/compare
   * Compare multiple sandbox sessions
   */
  async compareSessions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { sessionIds } = req.body;

      if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length < 2) {
        res.status(400).json({
          success: false,
          message: 'At least two session IDs are required',
        });
        return;
      }

      const analyses = await Promise.all(sessionIds.slice(0, 2).map(async (id: string) => this.analyzeTelemetry(id, await this.loadSessionTelemetry(id))));
      const techniques1 = analyses[0].mitreTechniques.map((t: any) => t.id);
      const techniques2 = analyses[1].mitreTechniques.map((t: any) => t.id);
      const sharedTechniques = techniques1.filter((t: string) => techniques2.includes(t));

      const response: ApiResponse = {
        success: true,
        message: 'Sessions compared successfully',
        data: {
          session1: {
            id: sessionIds[0],
            threatType: analyses[0].predictedThreat,
            severityScore: analyses[0].severityScore,
            mitreTechniques: techniques1,
            heuristicsTriggered: analyses[0].behavioralHeuristics.filter((h: any) => h.triggered).length,
          },
          session2: {
            id: sessionIds[1],
            threatType: analyses[1].predictedThreat,
            severityScore: analyses[1].severityScore,
            mitreTechniques: techniques2,
            heuristicsTriggered: analyses[1].behavioralHeuristics.filter((h: any) => h.triggered).length,
          },
          differences: {
            threatTypeMatch: analyses[0].predictedThreat === analyses[1].predictedThreat,
            severityDelta: Number((analyses[0].severityScore - analyses[1].severityScore).toFixed(1)),
            sharedTechniques,
            uniqueToSession1: techniques1.filter((t: string) => !techniques2.includes(t)),
            uniqueToSession2: techniques2.filter((t: string) => !techniques1.includes(t)),
          },
          comparisonTimestamp: new Date().toISOString(),
        },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to compare sessions',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/v1/analytics/dashboard
   * Get analytics dashboard data
   */
  async getDashboardData(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Gather all dashboard metrics
      const [clusters, insights, patterns] = await Promise.all([
        investigationCorrelationService.correlateInvestigations(),
        investigationCorrelationService.generateCorrelationInsights(),
        Promise.resolve(behavioralAnalyticsService.getBehavioralPatterns()),
      ]);

      const response: ApiResponse = {
        success: true,
        message: 'Dashboard data retrieved',
        data: {
          summary: {
            totalClusters: clusters.length,
            highSeverityInsights: insights.filter(i => i.severity === 'critical' || i.severity === 'high').length,
            totalPatterns: patterns.length,
            criticalPatterns: patterns.filter(p => p.severityWeight >= 75).length,
          },
          clusters: clusters.slice(0, 10),
          insights: insights.slice(0, 10),
          patterns: patterns.map(p => ({
            name: p.name,
            category: p.category,
            severity: p.severityWeight >= 75 ? 'high' : p.severityWeight >= 50 ? 'medium' : 'low',
            mitreTactics: p.mitreTactics,
          })),
        },
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get dashboard data',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const analyticsController = new AnalyticsController();
export default analyticsController;
