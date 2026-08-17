import fs from 'fs';
import { DocumentAnalysisResult, DocumentFinding } from './types';
import { PdfAnalyzer } from './pdf-analyzer';
import { DocxAnalyzer } from './docx-analyzer';
import { iocExtractionService } from '../ioc_extraction';
import mammoth from 'mammoth';
// pdf-parse has no TypeScript declarations - use require for callable
const pdfParse = require('pdf-parse');

export class DocumentAnalysisService {
  private pdfAnalyzer = new PdfAnalyzer();
  private docxAnalyzer = new DocxAnalyzer();

  async analyzePdf(filePath: string, filename: string): Promise<DocumentAnalysisResult> {
    let pdfText = '';
    try {
      const dataBuffer = fs.readFileSync(filePath);
      let data: any;
      if (typeof pdfParse === 'function') {
        // pdf-parse v1: callable
        data = await pdfParse(dataBuffer);
      } else {
        // pdf-parse v2+: PDFParse class API
        data = await new pdfParse.PDFParse({ data: dataBuffer }).getText();
      }
      pdfText = data.text || '';
    } catch (err: any) {
      const stat = fs.statSync(filePath);
      return {
        filename,
        file_size: stat.size,
        file_type: 'pdf',
        threat_score: 0,
        threat_level: 'unknown',
        confidence: 0,
        predicted_threat: 'unknown',
        findings: [],
        extracted_text: '',
        text_length: 0,
        embedded_urls: [],
        suspicious_scripts: [],
        ioc_count: 0,
        mitre_techniques: [],
        summary: `PDF analysis failed: ${err.message}`,
      };
    }

    const { findings: pdfFindings, suspiciousScripts, embeddedUrls, extractedText } = this.pdfAnalyzer.analyze(pdfText, filename);

    // Extract IOCs from the PDF text
    const iocs = iocExtractionService.extractFromText(pdfText, filename);

    const stat = fs.statSync(filePath);
    const totalScore = pdfFindings.reduce((s, f) => s + f.score, 0);
    const threatScore = Math.min(totalScore, 100);
    const confidence = Math.min(0.4 + (threatScore / 100) * 0.5, 0.95);
    const threatLevel = threatScore >= 70 ? 'critical' : threatScore >= 50 ? 'high' : threatScore >= 25 ? 'medium' : threatScore >= 10 ? 'low' : 'safe';
    const predictedThreat = this.classifyDocument(threatScore, pdfFindings, 'pdf');

    const mitreTechniques: string[] = [];
    if (pdfFindings.some(f => f.type === 'embedded_javascript')) mitreTechniques.push('T1059.007');
    if (pdfFindings.some(f => f.type === 'suspicious_launch_action')) mitreTechniques.push('T1204.002');
    if (pdfFindings.some(f => f.type === 'auto_action')) mitreTechniques.push('T1204');
    if (pdfFindings.some(f => f.type === 'embedded_file')) mitreTechniques.push('T1566.001');
    if (pdfFindings.some(f => f.type === 'phishing_indicator')) mitreTechniques.push('T1566');
    if (pdfFindings.some(f => f.type === 'obfuscated_content')) mitreTechniques.push('T1027');

    return {
      filename,
      file_size: stat.size,
      file_type: 'pdf',
      threat_score: threatScore,
      threat_level: threatLevel,
      confidence: Math.round(confidence * 100) / 100,
      predicted_threat: predictedThreat,
      findings: pdfFindings,
      extracted_text: extractedText.substring(0, 5000),
      text_length: extractedText.length,
      embedded_urls: embeddedUrls,
      suspicious_scripts: suspiciousScripts,
      ioc_count: iocs.totalCount,
      mitre_techniques: mitreTechniques,
      summary: this.generateSummary(filename, threatLevel, pdfFindings.length, iocs.totalCount, 'PDF'),
    };
  }

  async analyzeDocx(filePath: string, filename: string): Promise<DocumentAnalysisResult> {
    let docxText = '';
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      docxText = result.value || '';
    } catch (err: any) {
      const stat = fs.statSync(filePath);
      return {
        filename,
        file_size: stat.size,
        file_type: 'docx',
        threat_score: 0,
        threat_level: 'unknown',
        confidence: 0,
        predicted_threat: 'unknown',
        findings: [],
        extracted_text: '',
        text_length: 0,
        embedded_urls: [],
        suspicious_scripts: [],
        ioc_count: 0,
        mitre_techniques: [],
        summary: `DOCX analysis failed: ${err.message}`,
      };
    }

    const { findings: docxFindings, macroRisk, suspiciousScripts, embeddedUrls, extractedText } = this.docxAnalyzer.analyze(docxText, filename);

    const iocs = iocExtractionService.extractFromText(docxText, filename);

    const stat = fs.statSync(filePath);
    const macroScore = macroRisk.risk_score * 0.4;
    const docFindingsScore = docxFindings.reduce((s, f) => s + f.score, 0);
    const threatScore = Math.min(Math.round(docFindingsScore + macroScore), 100);

    const confidence = Math.min(0.4 + (threatScore / 100) * 0.5, 0.95);
    const threatLevel = threatScore >= 70 ? 'critical' : threatScore >= 50 ? 'high' : threatScore >= 25 ? 'medium' : threatScore >= 10 ? 'low' : 'safe';
    const predictedThreat = this.classifyDocument(threatScore, docxFindings, 'docx');

    const mitreTechniques: string[] = [];
    if (macroRisk.has_macros) mitreTechniques.push('T1059.005');
    if (macroRisk.auto_execute) mitreTechniques.push('T1204.002');
    if (docxFindings.some(f => f.type === 'dde_exploit')) mitreTechniques.push('T1204');
    if (docxFindings.some(f => f.type === 'external_template')) mitreTechniques.push('T1221');
    if (docxFindings.some(f => f.type === 'suspicious_vba')) mitreTechniques.push('T1059.005');
    if (docxFindings.some(f => f.type === 'powershell_in_document')) mitreTechniques.push('T1059.001');
    if (docxFindings.some(f => f.type === 'encoded_payload')) mitreTechniques.push('T1027');
    if (docxFindings.some(f => f.type === 'ole_embedded_object')) mitreTechniques.push('T1027');

    // Add macro risk as a finding
    const allFindings = [...docxFindings];
    if (macroRisk.has_macros) {
      allFindings.push({
        type: 'macro_risk_summary', severity: macroRisk.risk_level as any,
        description: `Macro analysis: ${macroRisk.macro_count} macros, ${macroRisk.suspicious_strings.length} suspicious strings${macroRisk.auto_execute ? ', auto-execute enabled' : ''}`,
        score: macroRisk.risk_score,
      });
    }

    return {
      filename,
      file_size: stat.size,
      file_type: 'docx',
      threat_score: threatScore,
      threat_level: threatLevel,
      confidence: Math.round(confidence * 100) / 100,
      predicted_threat: predictedThreat,
      findings: allFindings,
      macro_risk: macroRisk,
      extracted_text: extractedText.substring(0, 5000),
      text_length: extractedText.length,
      embedded_urls: embeddedUrls,
      suspicious_scripts: suspiciousScripts,
      ioc_count: iocs.totalCount,
      mitre_techniques: mitreTechniques,
      summary: this.generateSummary(filename, threatLevel, allFindings.length, iocs.totalCount, 'DOCX'),
    };
  }

  private classifyDocument(score: number, findings: DocumentFinding[], type: string): string {
    if (findings.some(f => f.severity === 'critical')) return 'exploit-document';
    if (score >= 70) return 'malicious-document';
    if (score >= 50) return 'suspicious-document';
    if (score >= 25) {
      if (findings.some(f => f.type.includes('phish') || f.type.includes('link') || f.type.includes('url')))
        return 'phishing-document';
      if (findings.some(f => f.type.includes('macro') || f.type.includes('vba')))
        return 'macro-dropper';
      return 'suspicious-document';
    }
    if (findings.length === 0) return 'benign';
    return 'suspicious-document';
  }

  private generateSummary(filename: string, level: string, findings: number, iocs: number, type: string): string {
    return `${type} analysis: "${filename}" - ${findings} findings, ${iocs} indicators extracted. Threat level: ${level}`;
  }
}

export const documentAnalysisService = new DocumentAnalysisService();
export default documentAnalysisService;
