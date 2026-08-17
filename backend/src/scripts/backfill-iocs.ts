/**
 * IOC + Analysis Report Backfill Script
 * Fixes linkage created before investigationId/evidenceId propagation:
 *   1. Reports with null investigationId are matched to evidence by
 *      sourceName (filename) or sourceType=url + sourceName (URL), then
 *      their investigationId is backfilled.
 *   2. Existing IOCs get linkedInvestigations/linkedEvidence derived from:
 *        - AnalysisReport.indicators (value match → report.investigationId)
 *        - SandboxSession.extractedIOCs (value match → session.evidenceId → evidence.investigationId)
 * Idempotent: uses $addToSet / only sets null fields, safe to re-run.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { IOC } from '../models/threat.model';
import AnalysisReport from '../models/analysis-report.model';
import { SandboxSession, Evidence } from '../models';

const normalize = (v: any): string => String(v || '').trim().toLowerCase();

async function backfillIocs() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/forensics_platform');
    console.log('Connected to MongoDB');

    // ── 1. Backfill report investigationId via evidence matching ────────
    const reports = await AnalysisReport.find({}).select('_id analysisId analysisType sourceName sourceType investigationId indicators').lean();
    const evidence = await Evidence.find({}).select('_id name url investigationId').lean();

    const nameIndex = new Map<string, string>();   // evidence name (normalized) → investigationId
    const urlIndex = new Map<string, string>();    // evidence url (normalized) → investigationId
    for (const ev of evidence) {
      const invId = String((ev as any).investigationId);
      if (!invId || invId === 'null' || invId === 'undefined') continue;
      const n = normalize((ev as any).name);
      if (n) nameIndex.set(n, invId);
      const u = normalize((ev as any).url);
      if (u) urlIndex.set(u, invId);
    }

    let reportsFixed = 0;
    for (const r of reports) {
      if ((r as any).investigationId) continue;
      const name = normalize((r as any).sourceName);
      const isUrl = (r as any).analysisType === 'url_analysis';
      const invId = isUrl ? urlIndex.get(name) : nameIndex.get(name);
      if (!invId) continue;
      await AnalysisReport.updateOne({ _id: r._id }, { $set: { investigationId: invId } });
      reportsFixed += 1;
    }
    console.log(`Backfilled investigationId on ${reportsFixed} analysis report(s)`);

    // ── 2. Link IOCs to investigations/evidence ──────────────────────────
    const iocs = await IOC.find({}).select('_id value type').lean();
    console.log(`IOC collection size: ${iocs.length}`);

    const reportsWithInv = await AnalysisReport.find({ investigationId: { $ne: null } })
      .select('investigationId indicators')
      .lean();

    const sessions = await SandboxSession.find({ extractedIOCs: { $exists: true, $ne: [] } })
      .select('evidenceId extractedIOCs')
      .lean();
    const evidenceIds = [...new Set(sessions.map((s: any) => String(s.evidenceId)).filter(Boolean))];

    const evidenceMap = new Map<string, string>();
    for (const ev of await Evidence.find({ _id: { $in: evidenceIds } }).select('_id investigationId').lean()) {
      evidenceMap.set(String(ev._id), String(ev.investigationId));
    }

    let linked = 0;
    let skipped = 0;

    for (const ioc of iocs) {
      const value = normalize((ioc as any).value);
      if (!value) continue;

      const invIds = new Set<string>();
      const evIds = new Set<string>();

      for (const r of reportsWithInv) {
        const indicators: any[] = (r as any).indicators || [];
        if (indicators.some((ind: any) => normalize(ind.value) === value)) {
          invIds.add(String((r as any).investigationId));
        }
      }

      for (const s of sessions as any[]) {
        const extracted: any[] = s.extractedIOCs || [];
        if (extracted.some((x: any) => normalize(x.value) === value)) {
          const evId = String(s.evidenceId);
          if (evId) {
            evIds.add(evId);
            const invId = evidenceMap.get(evId);
            if (invId) invIds.add(invId);
          }
        }
      }

      if (invIds.size === 0 && evIds.size === 0) {
        skipped += 1;
        continue;
      }

      const res = await IOC.updateOne(
        { _id: ioc._id },
        {
          $addToSet: {
            linkedInvestigations: { $each: [...invIds] },
            linkedEvidence: { $each: [...evIds] },
          },
        },
      );
      if (res.modifiedCount > 0) linked += 1;
    }

    console.log(`Linked ${linked} IOC(s), skipped ${skipped} with no matches`);
    const stillEmpty = await IOC.countDocuments({ linkedInvestigations: { $size: 0 } });
    console.log(`IOCs still without investigation linkage: ${stillEmpty}`);
    const unlinkedReports = await AnalysisReport.countDocuments({ investigationId: null });
    console.log(`Analysis reports still without investigationId: ${unlinkedReports}`);

    await mongoose.connection.close();
    console.log('Done');
    process.exit(0);
  } catch (error) {
    console.error('Failed:', error);
    process.exit(1);
  }
}

backfillIocs();