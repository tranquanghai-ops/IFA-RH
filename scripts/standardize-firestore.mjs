import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fetchLatestConferencesFromDrive, mapJsonConferenceToRawRow } from '../src/services/researchDriveJsonService.ts';

// Patch global fetch for Google Drive API key origin/referer verification in Node.js
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const headers = new Headers(opts?.headers || {});
  if (!headers.has('Referer')) headers.set('Referer', 'https://ifa-rh.web.app');
  if (!headers.has('Origin')) headers.set('Origin', 'https://ifa-rh.web.app');
  return originalFetch(url, { ...opts, headers });
};

const cfgPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const token = cfg.tokens.access_token;
const PROJECT_ID = 'ifa-rh';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
};

function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(encodeValue) } };
  }
  if (typeof v === 'object') {
    return { mapValue: { fields: encodeFields(v) } };
  }
  return { stringValue: String(v) };
}

function encodeFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined) {
      fields[k] = encodeValue(v);
    }
  }
  return fields;
}

async function getDocument(col, id) {
  const url = `${BASE_URL}/${col}/${id}`;
  const res = await originalFetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to get ${col}/${id}: ${await res.text()}`);
  const data = await res.json();
  const fields = {};
  for (const [k, v] of Object.entries(data.fields || {})) {
    if (v.stringValue !== undefined) fields[k] = v.stringValue;
    else if (v.booleanValue !== undefined) fields[k] = v.booleanValue;
    else if (v.integerValue !== undefined) fields[k] = Number(v.integerValue);
    else if (v.arrayValue?.values) fields[k] = v.arrayValue.values.map(x => x.stringValue);
  }
  return { id, ...fields };
}

async function updateDocument(col, id, data) {
  const fields = encodeFields(data);
  const mask = Object.keys(data).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const url = `${BASE_URL}/${col}/${id}?${mask}`;
  const res = await originalFetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    throw new Error(`Failed to update ${col}/${id} [${res.status}]: ${await res.text()}`);
  }
  return await res.json();
}

async function main() {
  console.log('=============================================================');
  console.log('IFA-RH: TIẾN HÀNH CHUẨN HÓA DỮ LIỆU FIRESTORE & XÓA BỎ TRÙNG LẶP');
  console.log('=============================================================');

  // 1. Fetch Spark JSON official rows
  const driveResult = await fetchLatestConferencesFromDrive({});
  const sparkRows = driveResult.payload.conferences.map((c, idx) => mapJsonConferenceToRawRow(c, idx, driveResult.payload.runId));
  console.log(`Đã đọc ${sparkRows.length} hội thảo chính thức từ Spark Drive JSON.\n`);

  const now = new Date().toISOString();

  // Mapping configurations
  const CONFERENCES_MAP = [
    {
      code: 'TN0001',
      category: 'TN',
      oppId: 'opp_ietbhec_2027',
      origCandId: 'spark_opp_20261006-01_5',
      proposalId: 'cand_upd_opp_ietbhec_2027',
      isProposalRedundant: true,
    },
    {
      code: 'TN0002',
      category: 'TN',
      oppId: 'opp_celg_2026',
      origCandId: 'spark_opp_20261006-01_7',
      proposalId: 'cand_upd_opp_celg_2026',
      isProposalRedundant: true,
    },
    {
      code: 'TN0003',
      category: 'TN',
      oppId: 'opp_ciemb_2026',
      origCandId: 'spark_opp_20261006-01_1',
      proposalId: 'cand_upd_opp_ciemb_2026',
      isProposalRedundant: true,
    },
    {
      code: 'TN0004',
      category: 'TN',
      oppId: 'opp_letj_2027',
      origCandId: 'spark_opp_20261006-01_2',
      proposalId: 'cand_upd_opp_letj_2027',
      isProposalRedundant: true,
    },
    {
      code: 'TN0005',
      category: 'TN',
      oppId: 'opp_icisn_2027',
      origCandId: 'spark_opp_20261006-01_3',
      proposalId: 'cand_upd_opp_icisn_2027',
      isProposalRedundant: true,
    },
    {
      code: 'TN0006',
      category: 'TN',
      oppId: 'opp_neu_duongdai_2026',
      origCandId: 'spark_opp_20261006-01_4',
      proposalId: 'cand_upd_opp_neu_duongdai_2026',
      isProposalRedundant: true,
    },
    {
      code: 'TN0007',
      category: 'TN',
      oppId: 'E3zjQ9KZxXarkH8R2CEM',
      origCandId: 'spark_opp_20261006-01_8',
      proposalId: 'cand_upd_E3zjQ9KZxXarkH8R2CEM',
      isProposalRedundant: true,
    },
    {
      code: 'QT0003',
      category: 'QT',
      oppId: 'opp_global_south_2026',
      origCandId: 'spark_opp_20261006-01_6',
      proposalId: 'cand_upd_opp_global_south_2026',
      isProposalRedundant: false, // Genuine update proposal, retain pending
    },
  ];

  // 1. Standardize 8 published opportunities & sync official Spark clean fields for TN0001-TN0007
  console.log('--- 1. Chuẩn hóa 8 published opportunities ---');
  for (const item of CONFERENCES_MAP) {
    const existingOpp = await getDocument('opportunities', item.oppId);
    if (!existingOpp) continue;

    if (existingOpp.editedByAdmin === true) {
      console.log(`[SKIP FIELD OVERWRITE] Opportunity ${item.oppId} has editedByAdmin=true, preserving Admin edits.`);
      await updateDocument('opportunities', item.oppId, {
        conferenceCode: item.code,
        category: item.category,
        candidateId: item.origCandId,
      });
      continue;
    }

    const manualOverrides = new Set(existingOpp.manualOverrides || []);
    const sparkRow = sparkRows.find(r => r.conferenceCode === item.code);
    const updates = {
      conferenceCode: item.code,
      category: item.category,
      candidateId: item.origCandId,
      status: 'published',
      updatedAt: now,
      updatedBy: 'SPARK_STANDARDIZATION',
    };

    // For TN0001-TN0007, sync the clean Spark JSON fields to eliminate false-positive diffs, respecting manualOverrides
    if (sparkRow && item.category === 'TN') {
      if (sparkRow.location && !manualOverrides.has('location')) updates.location = sparkRow.location;
      if (sparkRow.directions && !manualOverrides.has('directions')) updates.directions = sparkRow.directions;
      if (sparkRow.submissionUrl && !manualOverrides.has('submissionUrl')) updates.submissionUrl = sparkRow.submissionUrl.replace(/^mailto:/, '');
      if (sparkRow.feeStatus && !manualOverrides.has('feeStatus')) updates.feeStatus = sparkRow.feeStatus;
      if (sparkRow.publicationFee && !manualOverrides.has('publicationFee')) updates.publicationFee = sparkRow.publicationFee;
      if (sparkRow.registrationFee && !manualOverrides.has('registrationFee')) updates.registrationFee = sparkRow.registrationFee;
      if (sparkRow.notes && !manualOverrides.has('notes')) updates.notes = sparkRow.notes;
      if (sparkRow.content && !manualOverrides.has('content')) updates.content = sparkRow.content;
    }

    await updateDocument('opportunities', item.oppId, updates);
    console.log(`[PASS] Opportunity ${item.oppId} -> ${item.code} (${item.category}), candidateId: ${item.origCandId}`);
  }

  // 2. Standardize 8 original approved candidates (spark_opp_...)
  console.log('\n--- 2. Chuẩn hóa 8 original approved candidates ---');
  for (const item of CONFERENCES_MAP) {
    await updateDocument('opportunityCandidates', item.origCandId, {
      conferenceCode: item.code,
      category: item.category,
      publishedOpportunityId: item.oppId,
      status: 'approved',
      resolutionType: 'APPROVED_UPDATE',
      updatedAt: now,
      updatedBy: 'SPARK_STANDARDIZATION',
    });
    console.log(`[PASS] Candidate ${item.origCandId} -> ${item.code} (${item.category}), publishedOpportunityId: ${item.oppId}`);
  }

  // 3. Auto-close 7 redundant TN update proposals
  console.log('\n--- 3. Tự động đóng 7 đề xuất cập nhật trùng lặp (TN0001 - TN0007) ---');
  for (const item of CONFERENCES_MAP) {
    if (item.isProposalRedundant && item.proposalId) {
      await updateDocument('opportunityCandidates', item.proposalId, {
        conferenceCode: item.code,
        category: item.category,
        publishedOpportunityId: item.oppId,
        status: 'closed',
        resolutionType: 'AUTO_CLOSED',
        rejectionReason: 'Đồng bộ chuẩn hóa: Hội thảo đã được công bố chính thức. Đề xuất cập nhật do khác biệt định dạng đã được tự động đóng để chống trùng lặp.',
        reviewedBy: 'SPARK_SYNC',
        reviewedAt: now,
        updatedAt: now,
        updatedBy: 'SPARK_SYNC',
      });
      console.log(`[CLOSED] Proposal ${item.proposalId} (${item.code}) -> status: closed, resolutionType: AUTO_CLOSED`);
    }
  }

  // 4. Retain and standardize QT0003 update proposal
  console.log('\n--- 4. Chuẩn hóa đề xuất cập nhật QT0003 ---');
  await updateDocument('opportunityCandidates', 'cand_upd_opp_global_south_2026', {
    conferenceCode: 'QT0003',
    category: 'QT',
    publishedOpportunityId: 'opp_global_south_2026',
    changeType: 'update',
    status: 'pending',
    resolutionType: 'PENDING_UPDATE',
    updatedAt: now,
    updatedBy: 'SPARK_STANDARDIZATION',
  });
  console.log('[RETAINED] Proposal cand_upd_opp_global_south_2026 (QT0003) -> status: pending, changeType: update');

  // 5. Standardize new QT candidates (QT0001, QT0002)
  console.log('\n--- 5. Chuẩn hóa 2 ứng viên mới QT0001, QT0002 ---');
  await updateDocument('opportunityCandidates', 'cand_auto_1792055682252_z45py', {
    conferenceCode: 'QT0001',
    category: 'QT',
    changeType: 'create',
    status: 'pending',
    updatedAt: now,
    updatedBy: 'SPARK_STANDARDIZATION',
  });
  console.log('[RETAINED] Candidate cand_auto_1792055682252_z45py -> QT0001, pending create');

  await updateDocument('opportunityCandidates', 'cand_auto_1792055682982_ee4ci', {
    conferenceCode: 'QT0002',
    category: 'QT',
    changeType: 'create',
    status: 'pending',
    updatedAt: now,
    updatedBy: 'SPARK_STANDARDIZATION',
  });
  console.log('[RETAINED] Candidate cand_auto_1792055682982_ee4ci -> QT0002, pending create');

  // 6. Safe check for sync locks (only reset if idle or expired)
  console.log('\n--- 6. Kiểm tra khóa đồng bộ ---');
  try {
    const syncDoc = await getDocument('systemConfig', 'facultyResearchSync');
    if (syncDoc) {
      const lockTime = syncDoc.syncStartedAtMs || (syncDoc.syncStartedAt ? new Date(syncDoc.syncStartedAt).getTime() : 0);
      const isExpired = lockTime > 0 && Date.now() - lockTime > 5 * 60 * 1000;
      if (!syncDoc.syncInProgress || isExpired) {
        await updateDocument('systemConfig', 'facultyResearchSync', {
          syncInProgress: false,
          activeLockId: null,
          lockId: null,
          lastSyncStatus: 'idle',
          updatedAt: now,
        });
        console.log('[PASS] Cleaned up idle/expired facultyResearchSync lock.');
      } else {
        console.log('[SAFE] An active sync session is running within TTL, skipping lock release.');
      }
    }
  } catch (e) {
    console.warn('Could not check facultyResearchSync lock:', e.message);
  }

  console.log('\n=============================================================');
  console.log('HOÀN TẤT CHUẨN HÓA DỮ LIỆU THÀNH CÔNG!');
  console.log('=============================================================');
}

main().catch(err => {
  console.error('LỖI CHUẨN HÓA:', err);
  process.exit(1);
});
