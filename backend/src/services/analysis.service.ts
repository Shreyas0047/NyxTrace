import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import AnalysisReport from '../models/analysis-report.model';
import { Alert, AlertType, AlertSeverity, AlertSource, AlertStatus } from '../models/alert.model';
import { documentAnalysisService } from '../document_analysis';
import { urlIntelligenceService } from '../url_intelligence';
import { iocExtractionService } from '../ioc_extraction';
import { threatIntelligenceService } from './threat-intelligence.service';
import { aiAnalysisService } from './ai-analysis.service';
import { IOCTypes, IOCSeverity } from '../models/threat.model';
import { AppError } from '../middleware';
import logger from '../config/logger';

export class AnalysisService {
  private readonly uploadDir = './uploads/analysis';

  async analyzeDocument(
    filePath: string,
    filename: string,
    context?: { investigationId?: string; evidenceId?: string }
  ): Promise<any> {
    const ext = path.extname(filename).toLowerCase();
    let result: any;

    if (ext === '.pdf') {
      result = await documentAnalysisService.analyzePdf(filePath, filename);
    } else if (ext === '.docx') {
      result = await documentAnalysisService.analyzeDocx(filePath, filename);
    } else {
      throw new AppError('Unsupported document format', 400, 'UNSUPPORTED_FORMAT');
    }

    const analysisId = uuidv4();
    const report = await AnalysisReport.create({
      analysisId,
      analysisType: 'document_analysis',
      sourceType: ext === '.pdf' ? 'pdf' : 'docx',
      sourceName: filename,
      sourceSize: result.file_size,
      investigationId: context?.investigationId || null,
      threatScore: result.threat_score,
      threatLevel: result.threat_level,
      confidence: result.confidence,
      predictedThreat: result.predicted_threat,
      findings: result.findings,
      indicators: result.extractedIocs?.map((ioc: any) => ({
        type: ioc.type,
        value: ioc.value,
        context: ioc.context || '',
        severity: ioc.severity || 'medium',
        source: 'document_analysis',
      })) || [],
      iocCount: result.ioc_count,
      mitreTechniques: result.mitre_techniques,
      heuristicsTriggered: result.findings.map((f: any) => f.type),
      recommendations: this.generateRecommendations(result),
      summary: result.summary,
      metadata: {
        file_type: result.file_type,
        text_length: result.text_length,
        embedded_urls: result.embedded_urls,
        suspicious_scripts: result.suspicious_scripts,
        macro_risk: result.macro_risk,
        extracted_text_preview: result.extracted_text?.substring(0, 2000),
      },
      analysisTimestamp: new Date(),
    });

    // Auto-generate alert for high-risk documents (PDF or Word)
    await this.maybeCreateAlert({
      analysisId,
      sourceType: ext === '.pdf' ? 'pdf' : 'docx',
      sourceName: filename,
      threatScore: result.threat_score,
      threatLevel: result.threat_level,
      summary: result.summary,
      mitreTechniques: result.mitre_techniques,
    });

    // Persist extracted IOCs to the IOC collection so they appear in Threat Intel
    await this.persistIocs(result.extractedIocs || [], ext === '.pdf' ? 'pdf_analysis' : 'docx_analysis', context);

    // Optional LLM-enhanced second opinion (non-blocking, heuristic verdict stands)
    const aiInsights = await this.enhanceWithLlm('document', {
      analysisId,
      filename,
      fileType: ext.slice(1),
      extractedText: result.extracted_text || '',
      findings: result.findings || [],
      embeddedUrls: result.embedded_urls || [],
      macroRisk: result.macro_risk || null,
      threatScore: result.threat_score || 0,
      threatLevel: result.threat_level || 'unknown',
      predictedThreat: result.predicted_threat || 'unknown',
    });
    if (aiInsights && report) {
      report.set('aiInsights', aiInsights);
      await report.save().catch((err: any) => logger.warn(`[Analysis] Failed to persist aiInsights: ${err?.message}`));
    }

    return { analysisId, ...result, aiInsights, report: report.toJSON() };
  }

  async analyzeUrl(
    url: string,
    context?: { investigationId?: string; evidenceId?: string }
  ): Promise<any> {
    const result = await urlIntelligenceService.analyzeUrl(url);

    const analysisId = uuidv4();
    const report = await AnalysisReport.create({
      analysisId,
      analysisType: 'url_analysis',
      sourceType: 'url',
      sourceName: url,
      investigationId: context?.investigationId || null,
      threatScore: result.risk_score,
      threatLevel: result.risk_level,
      confidence: result.confidence,
      predictedThreat: result.predicted_threat,
      findings: result.indicators,
      indicators: result.extracted_iocs,
      iocCount: result.extracted_iocs.length,
      mitreTechniques: this.getUrlMitreTechniques(result),
      heuristicsTriggered: result.heuristics_triggered,
      recommendations: this.generateUrlRecommendations(result),
      summary: result.summary,
      metadata: {
        parsed: result.parsed,
        domain_intel: result.domain_intel,
        redirect_analysis: result.redirect_analysis,
        phishing_probability: result.phishing_probability,
      },
      analysisTimestamp: new Date(),
    });

    // Auto-generate alert for malicious/high-risk URLs
    await this.maybeCreateAlert({
      analysisId,
      sourceType: 'url',
      sourceName: url,
      threatScore: result.risk_score,
      threatLevel: result.risk_level,
      summary: result.summary,
      mitreTechniques: this.getUrlMitreTechniques(result),
    });

    // Persist extracted IOCs to the IOC collection
    await this.persistIocs(result.extracted_iocs || [], 'url_analysis', context);
    // Always persist the URL itself as an IOC
    if (url) {
      await this.persistIocs(
        [{ type: 'url', value: url, severity: this.threatLevelToSeverity(result.risk_level) }],
        'url_analysis',
        context,
      );
    }

    // Optional LLM-enhanced second opinion (non-blocking, heuristic verdict stands)
    const aiInsights = await this.enhanceWithLlm('url', {
      analysisId,
      url,
      hostname: result.parsed?.hostname || '',
      tld: result.parsed?.tld || '',
      isIpBased: result.parsed?.is_ip_based || false,
      heuristicsTriggered: result.heuristics_triggered || [],
      indicators: result.indicators || [],
      riskScore: result.risk_score || 0,
      riskLevel: result.risk_level || 'unknown',
      phishingProbability: result.phishing_probability || 0,
    });
    if (aiInsights && report) {
      report.set('aiInsights', aiInsights);
      await report.save().catch((err: any) => logger.warn(`[Analysis] Failed to persist aiInsights: ${err?.message}`));
    }

    return { analysisId, ...result, aiInsights, report: report.toJSON() };
  }

  async getAnalysisById(analysisId: string): Promise<any> {
    const report = await AnalysisReport.findOne({ analysisId });
    if (!report) {
      throw new AppError('Analysis not found', 404, 'ANALYSIS_NOT_FOUND');
    }
    return report.toJSON();
  }

  async getAnalysisHistory(page: number = 1, limit: number = 20, type?: string, investigationId?: string): Promise<{ items: any[]; total: number; page: number; totalPages: number }> {
    const filter: any = {};
    if (type) filter.analysisType = type;
    if (investigationId) filter.investigationId = investigationId;

    const [items, total] = await Promise.all([
      AnalysisReport.find(filter).sort({ analysisTimestamp: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AnalysisReport.countDocuments(filter),
    ]);

    return {
      items: items.map((i: any) => ({ ...i, id: i._id })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  private generateRecommendations(result: any): string[] {
    const recs: string[] = [];
    if (result.threat_score >= 50) {
      recs.push('Do not open this document in a production environment');
      recs.push('Quarantine and flag for security review');
    }
    if (result.findings?.some((f: any) => f.type === 'embedded_javascript' || f.type === 'vba_macro_detected')) {
      recs.push('Disable macros and JavaScript before viewing');
    }
    if (result.embedded_urls?.length > 0) {
      recs.push('Scan extracted URLs for phishing indicators');
    }
    if (recs.length === 0) recs.push('Document appears benign, standard caution advised');
    return recs;
  }

  private generateUrlRecommendations(result: any): string[] {
    const recs: string[] = [];
    if (result.risk_score >= 50) {
      recs.push('Do not visit this URL');
      recs.push('Block at network perimeter if possible');
    }
    if (result.phishing_probability >= 0.4) {
      recs.push('Flag as potential phishing attempt');
    }
    if (recs.length === 0) recs.push('URL appears benign, standard caution advised');
    return recs;
  }

  private getUrlMitreTechniques(result: any): string[] {
    const techniques: string[] = [];
    if (result.phishing_probability >= 0.4) techniques.push('T1566');
    if (result.heuristics_triggered?.includes('credential_harvesting_path')) techniques.push('T1566.004');
    if (result.heuristics_triggered?.includes('encoded_payload')) techniques.push('T1027');
    if (result.heuristics_triggered?.includes('path_traversal')) techniques.push('T1003');
    return techniques;
  }

  /**
   * Auto-generate an Alert when document/URL analysis flags high-risk content.
   * Maps the analysis threat level to an Alert severity. Critical / high score
   * thresholds match the workflow:
   *   High Risk PDF       -> Critical Alert
   *   Malicious URL       -> Critical Alert
   *   Medium / suspicious -> High Alert
   */
  private async maybeCreateAlert(input: {
    analysisId: string;
    sourceType: 'pdf' | 'docx' | 'url';
    sourceName: string;
    threatScore: number;
    threatLevel: string;
    summary?: string;
    mitreTechniques?: string[];
  }): Promise<void> {
    const level = (input.threatLevel || '').toLowerCase();
    const score = input.threatScore || 0;

    // Only generate alerts for medium-risk and above
    const isHighRisk = ['critical', 'high', 'malicious'].includes(level) || score >= 70;
    const isMediumRisk = ['medium', 'suspicious'].includes(level) || (score >= 40 && score < 70);

    if (!isHighRisk && !isMediumRisk) {
      return;
    }

    const severity: AlertSeverity = isHighRisk ? AlertSeverity.CRITICAL : AlertSeverity.HIGH;
    const alertId = `ALT-${Date.now()}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

    const titlePrefix =
      input.sourceType === 'pdf' ? 'High Risk PDF' :
      input.sourceType === 'docx' ? 'High Risk Document' :
      'Malicious URL';

    try {
      await Alert.create({
        alertId,
        title: `${titlePrefix} Detected: ${input.sourceName}`.slice(0, 500),
        description: input.summary || `${titlePrefix} detected via AI analysis (score: ${score}, level: ${level})`,
        type: input.sourceType === 'url' ? AlertType.THREAT_INTEL : AlertType.EVIDENCE,
        severity,
        source: AlertSource.AI,
        status: AlertStatus.NEW,
        mitreTechniques: input.mitreTechniques || [],
        tags: [input.sourceType, 'ai-analysis', 'auto-generated', level],
        metadata: {
          analysisId: input.analysisId,
          sourceType: input.sourceType,
          sourceName: input.sourceName,
          threatScore: score,
          threatLevel: level,
          autoGenerated: true,
        },
      });
      logger.info(`[Analysis] Auto-generated ${severity} alert ${alertId} for ${input.sourceType} analysis ${input.analysisId}`);
    } catch (err) {
      logger.warn(`[Analysis] Failed to auto-generate alert for analysis ${input.analysisId}:`, err);
    }
  }

  /**
   * Persist extracted IOCs to the threat intelligence IOC collection.
   * IOCs from document/URL analysis become available in the Threat Intel page.
   */
  private async persistIocs(
    iocs: Array<{ type: string; value: string; severity?: string; context?: string }>,
    source: 'pdf_analysis' | 'docx_analysis' | 'url_analysis',
    analysisContext?: { investigationId?: string; evidenceId?: string },
  ): Promise<void> {
    if (!iocs || iocs.length === 0) {
      return;
    }

    if (!analysisContext?.investigationId) {
      logger.warn(
        `[Analysis] persistIocs called without investigation context — ${iocs.length} IOC(s) from ${source} will not be linked to an investigation`,
      );
    }

    for (const ioc of iocs) {
      try {
        const mappedType = this.mapIocType(ioc.type);
        if (!mappedType) continue;
        const severity = this.mapIocSeverity(ioc.severity);

        await threatIntelligenceService.createIOC(
          {
            type: mappedType,
            value: ioc.value,
            severity,
            category: source,
            description: ioc.context || `Extracted from ${source}`,
            source,
            confidence: 70,
            linkedInvestigations: analysisContext?.investigationId ? [analysisContext.investigationId] : [],
            linkedEvidence: analysisContext?.evidenceId ? [analysisContext.evidenceId] : [],
          },
          'system',
        );
      } catch (err: any) {
        // Silently skip duplicates (unique index violation)
        if (err?.code !== 11000) {
          logger.debug(`[Analysis] Skipped IOC ${ioc.type}=${ioc.value}: ${err?.message || 'unknown error'}`);
        }
      }
    }
  }

  /**
   * Map analysis IOC type strings to threat model IOCTypes enum.
   */
  private mapIocType(type: string): IOCTypes | null {
    const t = (type || '').toLowerCase();
    switch (t) {
      case 'url':
        return IOCTypes.URL;
      case 'domain':
        return IOCTypes.DOMAIN;
      case 'ip':
      case 'ipv4':
      case 'ip_address':
      case 'ipv6':
        return IOCTypes.IP_ADDRESS;
      case 'md5':
      case 'sha1':
      case 'sha256':
      case 'hash':
      case 'file_hash':
        return IOCTypes.FILE_HASH;
      case 'email':
        return IOCTypes.EMAIL;
      case 'registry':
      case 'registry_key':
        return IOCTypes.REGISTRY_KEY;
      case 'file':
      case 'file_path':
        return IOCTypes.FILE_PATH;
      case 'process':
      case 'process_name':
        return IOCTypes.PROCESS_NAME;
      case 'command_line':
      case 'powershell':
      case 'cmd':
        return IOCTypes.COMMAND_LINE;
      default:
        return null;
    }
  }

  private mapIocSeverity(severity?: string): IOCSeverity {
    const s = (severity || '').toLowerCase();
    if (s === 'critical') return IOCSeverity.CRITICAL;
    if (s === 'high' || s === 'malicious') return IOCSeverity.HIGH;
    if (s === 'low') return IOCSeverity.LOW;
    if (s === 'info') return IOCSeverity.INFO;
    return IOCSeverity.MEDIUM;
  }

  private threatLevelToSeverity(level: string): string {
    const l = (level || '').toLowerCase();
    if (l === 'critical' || l === 'malicious') return 'critical';
    if (l === 'high') return 'high';
    if (l === 'medium' || l === 'suspicious') return 'medium';
    if (l === 'low') return 'low';
    return 'info';
  }

  /**
   * Call the AI service for an optional LLM-enhanced second opinion on
   * document/URL analysis. Non-blocking: any failure returns null and the
   * heuristic verdict stands unchanged. Returns null when the AI service
   * is down or the LLM is disabled/unavailable (llm_available=false).
   */
  private async enhanceWithLlm(
    kind: 'document' | 'url',
    payload: any,
  ): Promise<any> {
    try {
      const insights = kind === 'document'
        ? await aiAnalysisService.analyzeDocument(payload)
        : await aiAnalysisService.analyzeUrl(payload);

      if (insights && insights.llm_available) {
        logger.info(`[Analysis] LLM enhancement complete for ${kind} analysis ${payload.analysisId}`);
        return insights;
      }
      logger.debug(`[Analysis] LLM enhancement unavailable for ${kind} analysis ${payload.analysisId}`);
      return null;
    } catch (err: any) {
      logger.warn(`[Analysis] LLM enhancement skipped for ${kind} analysis: ${err?.message}`);
      return null;
    }
  }
}

export const analysisService = new AnalysisService();
export default analysisService;
