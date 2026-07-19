/**
 * Intelligence Pipeline
 * Unified analysis pipeline for threat intelligence
 */

import logger from '../config/logger';
import { v4 as uuidv4 } from 'uuid';
import {
  RawTelemetryEvent,
  NormalizedEvent,
  ExtractedFeatures,
  BehaviorFinding,
  RiskScore,
  AttackPattern,
  ThreatIntelligenceReport,
  SessionSummary,
  ForensicTimelineEntry,
  IntelligencePipelineInput,
  IntelligencePipelineOutput,
  NormalizedEventType
} from './threat_models';

import { eventNormalizer } from './event_normalizer';
import { featureExtractor } from './feature_extractor';
import { behaviorAnalyzer } from './behavior_analyzer';
import { riskEngine } from './risk_engine';
import { threatClassifier } from './threat_classifier';
import {
  EnhancedThreatIntelligenceReport,
  RuleMatch,
  EnhancedIndicator
} from './threat_models';

export class IntelligencePipeline {
  async analyze(input: IntelligencePipelineInput): Promise<IntelligencePipelineOutput> {
    try {
      if (!input.events || input.events.length === 0) {
        return {
          success: false,
          error: 'No events provided for analysis'
        };
      }

      logger.info(`[IntelligencePipeline] Analyzing ${input.events.length} events for session ${input.sessionId}`);

      const normalizedEvents = this.normalizeEvents(input);
      logger.info(`[IntelligencePipeline] Normalized to ${normalizedEvents.length} behavioral events`);

      const features = this.extractFeatures(normalizedEvents);
      logger.info(`[IntelligencePipeline] Extracted ${Object.keys(features).length} features`);

      const behaviors = this.analyzeBehaviors(normalizedEvents, features);
      logger.info(`[IntelligencePipeline] Detected ${behaviors.length} behavioral patterns`);

      const riskScore = this.calculateRiskScore(features, behaviors);
      logger.info(`[IntelligencePipeline] Risk score: ${riskScore.totalScore} (${riskScore.severity})`);

      const attackPatterns = this.correlateEvents(normalizedEvents);
      logger.info(`[IntelligencePipeline] Identified ${attackPatterns.length} attack patterns`);

      const classification = threatClassifier.classifyThreat(
        features,
        behaviors,
        attackPatterns,
        normalizedEvents
      );
      logger.info(`[IntelligencePipeline] Classification: ${classification.predicted_threat} (${classification.confidence}%)`);

      const executionChain = threatClassifier.buildExecutionChain(normalizedEvents);
      const mitreTactics = threatClassifier.extractMitreTactics(classification.mitre_techniques);

      const ruleMatches = this.evaluateAllRules(features);

      const report = this.generateEnhancedReport(
        input.sessionId,
        normalizedEvents,
        features,
        behaviors,
        riskScore,
        attackPatterns,
        classification,
        executionChain,
        mitreTactics,
        ruleMatches
      );

      logger.info(`[IntelligencePipeline] Analysis complete for session ${input.sessionId}`);

      return {
        success: true,
        report
      };
    } catch (error) {
      logger.error(`[IntelligencePipeline] Analysis failed: ${error}`);
      return {
        success: false,
        error: `Analysis failed: ${error}`
      };
    }
  }

  private normalizeEvents(input: IntelligencePipelineInput): NormalizedEvent[] {
    return eventNormalizer.normalize(input.events, input.sessionId);
  }

  private extractFeatures(events: NormalizedEvent[]): ExtractedFeatures {
    return featureExtractor.extractFeatures(events);
  }

  private analyzeBehaviors(events: NormalizedEvent[], features: ExtractedFeatures): BehaviorFinding[] {
    return behaviorAnalyzer.analyzeBehaviors(events, features);
  }

  private calculateRiskScore(features: ExtractedFeatures, findings: BehaviorFinding[]): RiskScore {
    return riskEngine.calculateRiskScore(features, findings);
  }

  private correlateEvents(events: NormalizedEvent[]): AttackPattern[] {
    return [];
  }

  private generateReport(
    sessionId: string,
    events: NormalizedEvent[],
    features: ExtractedFeatures,
    behaviors: BehaviorFinding[],
    riskScore: RiskScore,
    attackPatterns: AttackPattern[]
  ): ThreatIntelligenceReport {
    const sortedEvents = [...events].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const startTime = sortedEvents.length > 0 ? new Date(sortedEvents[0].timestamp) : new Date();
    const endTime = sortedEvents.length > 0 ? new Date(sortedEvents[sortedEvents.length - 1].timestamp) : new Date();

    const sessionSummary: SessionSummary = {
      totalEvents: features.totalEvents,
      duration: features.executionDuration,
      processCount: features.totalProcesses,
      networkConnections: features.networkConnectionCount,
      fileOperations: features.fileModificationCount + features.fileCreateCount + features.fileDeleteCount,
      registryOperations: features.registryModificationCount,
      primaryProcess: this.extractPrimaryProcess(events),
      startTime,
      endTime
    };

    const suspiciousIndicators = this.extractSuspiciousIndicators(features, behaviors);

    const recommendedActions = this.consolidateRecommendations(behaviors, attackPatterns);

    const forensicTimeline = this.buildForensicTimeline(events, behaviors, attackPatterns);

    const evidenceReferences = this.extractEvidenceReferences(events);

    return {
      sessionId,
      analysisTimestamp: new Date(),
      sessionSummary,
      extractedFeatures: features,
      detectedBehaviors: behaviors,
      suspiciousIndicators,
      riskScore,
      correlatedAttackPatterns: attackPatterns,
      recommendedActions,
      forensicTimeline,
      evidenceReferences
    };
  }

  private extractPrimaryProcess(events: NormalizedEvent[]): string | undefined {
    const firstProcess = events.find(e => 
      e.normalizedType === NormalizedEventType.PROCESS_START && 
      e.metadata.processName
    );
    return firstProcess?.metadata.processName;
  }

  private extractSuspiciousIndicators(features: ExtractedFeatures, behaviors: BehaviorFinding[]): string[] {
    const indicators: string[] = [];

    if (features.fileModificationCount > 50) {
      indicators.push(`Mass file modification: ${features.fileModificationCount} files`);
    }
    if (features.renamedFilesCount > 5) {
      indicators.push(`File renaming detected: ${features.renamedFilesCount} files renamed`);
    }
    if (features.persistenceKeysModified > 0) {
      indicators.push(`Registry persistence: ${features.persistenceKeysModified} keys modified`);
    }
    if (features.outboundConnectionCount > 5) {
      indicators.push(`Excessive outbound connections: ${features.outboundConnectionCount} connections`);
    }
    if (features.suspiciousPortsUsed.length > 0) {
      indicators.push(`Suspicious ports used: ${features.suspiciousPortsUsed.join(', ')}`);
    }
    if (features.powershellExecutions > 3) {
      indicators.push(`PowerShell executions: ${features.powershellExecutions} invocations`);
    }
    if (features.privilegeEscalationAttempts > 0) {
      indicators.push(`Privilege escalation attempts: ${features.privilegeEscalationAttempts}`);
    }
    if (features.uniqueDestinationIPs.length > 3) {
      indicators.push(`Multiple external targets: ${features.uniqueDestinationIPs.length} unique IPs`);
    }

    for (const behavior of behaviors) {
      indicators.push(`Behavioral detection: ${behavior.behaviorType.replace(/_/g, ' ')}`);
    }

    return [...new Set(indicators)];
  }

  private consolidateRecommendations(behaviors: BehaviorFinding[], patterns: AttackPattern[]): string[] {
    const recommendations: string[] = [];

    const allRecommendations = [
      ...behaviors.flatMap(b => b.recommendedActions),
      ...patterns.flatMap(p => [
        `Investigate ${p.name.toLowerCase()} pattern`,
        `Review timeline: ${p.timeline.length} correlated events`
      ])
    ];

    const uniqueRecommendations = [...new Set(allRecommendations)].slice(0, 10);
    return uniqueRecommendations;
  }

  private buildForensicTimeline(
    events: NormalizedEvent[],
    behaviors: BehaviorFinding[],
    patterns: AttackPattern[]
  ): ForensicTimelineEntry[] {
    const timeline: ForensicTimelineEntry[] = [];

    const sortedEvents = [...events].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (const event of sortedEvents) {
      timeline.push({
        timestamp: new Date(event.timestamp),
        eventType: event.normalizedType,
        description: this.formatEventDescription(event),
        severity: this.getEventSeverity(event),
        process: event.metadata.processName,
        details: event.metadata
      });
    }

    return timeline.slice(0, 500); 
  }

  private formatEventDescription(event: NormalizedEvent): string {
    const processName = event.metadata.processName || 'unknown';
    const path = event.metadata.path || event.metadata.target || '';
    const destination = event.metadata.destination;
    const port = event.metadata.port;

    switch (event.normalizedType) {
      case NormalizedEventType.PROCESS_START:
        return `Process started: ${processName}`;
      case NormalizedEventType.FILE_CREATE:
        return `File created: ${path}`;
      case NormalizedEventType.FILE_MODIFY:
        return `File modified: ${path}`;
      case NormalizedEventType.FILE_DELETE:
        return `File deleted: ${path}`;
      case NormalizedEventType.FILE_RENAME:
        return `File renamed: ${path}`;
      case NormalizedEventType.REGISTRY_CREATE:
        return `Registry created: ${path}`;
      case NormalizedEventType.REGISTRY_MODIFY:
        return `Registry modified: ${path}`;
      case NormalizedEventType.NETWORK_CONNECT:
        return `Network connect: ${destination}:${port}`;
      case NormalizedEventType.NETWORK_LISTEN:
        return `Network listen: ${port}`;
      case NormalizedEventType.NETWORK_DATA_SENT:
        return `Data sent: ${destination}`;
      case NormalizedEventType.MASS_FILE_MODIFICATION:
        return 'Mass file modification detected';
      case NormalizedEventType.PERSISTENCE_ATTEMPT:
        return 'Persistence mechanism detected';
      case NormalizedEventType.SUSPICIOUS_NETWORK_ACTIVITY:
        return 'Suspicious network activity detected';
      case NormalizedEventType.RAPID_PROCESS_SPAWNING:
        return 'Rapid process spawning detected';
      default:
        return `Event: ${event.normalizedType}`;
    }
  }

  private getEventSeverity(event: NormalizedEvent): string {
    if (event.behavioralTags.includes('derived_behavior')) {
      return 'high';
    }
    if (event.behavioralTags.includes('persistence_registry')) {
      return 'medium';
    }
    if (event.behavioralTags.includes('external_network')) {
      return 'medium';
    }
    return 'low';
  }

  private extractEvidenceReferences(events: NormalizedEvent[]): string[] {
    const references: string[] = [];

    const paths = events
      .filter(e => e.metadata.path || e.metadata.target)
      .map(e => e.metadata.path || e.metadata.target)
      .filter(Boolean);

    const uniquePaths = [...new Set(paths)].slice(0, 20);
    return uniquePaths;
  }

  private evaluateAllRules(features: ExtractedFeatures): RuleMatch[] {
    const { threatClassifier } = require('./threat_classifier');
    const rules = [
      'RULE_RANSOMWARE_FILE_BURST', 'RULE_RANSOMWARE_EXTENSION_CHANGE', 'RULE_RANSOMWARE_NOTE',
      'RULE_SPYWARE_PROCESS_ENUM', 'RULE_SPYWARE_BROWSER_DATA', 'RULE_SPYWARE_BEACONING',
      'RULE_TROJAN_DROPPER', 'RULE_TROJAN_PERSISTENCE', 'RULE_TROJAN_HIDDEN_FILES',
      'RULE_WORM_LATERAL_MOVEMENT', 'RULE_WORM_NETWORK_SCAN', 'RULE_WORM_PROPAGATION',
      'RULE_CREDENTIAL_ACCESS', 'RULE_CREDENTIAL_KEYLOG', 'RULE_PERSISTENCE_AUTORUN', 'RULE_NETWORK_BEACONING'
    ];

    return rules.map(ruleId => ({
      rule_id: ruleId,
      rule_name: ruleId.replace('RULE_', '').replace(/_/g, ' '),
      matched: false,
      confidence_boost: 0
    }));
  }

  private generateEnhancedReport(
    sessionId: string,
    events: NormalizedEvent[],
    features: ExtractedFeatures,
    behaviors: BehaviorFinding[],
    riskScore: RiskScore,
    patterns: AttackPattern[],
    classification: any,
    executionChain: any[],
    mitreTactics: string[],
    ruleMatches: RuleMatch[]
  ): EnhancedThreatIntelligenceReport {
    const baseReport = this.generateReport(
      sessionId,
      events,
      features,
      behaviors,
      riskScore,
      patterns
    );

    const enhancedIndicators: EnhancedIndicator[] = events
      .filter(e => e.behavioralTags.includes('derived_behavior') || e.behavioralTags.includes('persistence_registry'))
      .slice(0, 10)
      .map((e, idx) => ({
        id: `indicator-${idx}`,
        type: e.normalizedType,
        description: this.formatEventDescription(e),
        severity: this.getEventSeverity(e),
        timestamp: new Date(e.timestamp),
        source_process: e.metadata.processName || 'unknown',
        mitre_techniques: [] as string[]
      }));

    return {
      ...baseReport,
      threat_classification: classification,
      detection_rules_triggered: ruleMatches.filter(r => r.matched),
      mitre_tactics_detected: mitreTactics,
      execution_chain: executionChain,
      enhanced_indicators: enhancedIndicators
    };
  }
}

export const intelligencePipeline = new IntelligencePipeline();
export default intelligencePipeline;