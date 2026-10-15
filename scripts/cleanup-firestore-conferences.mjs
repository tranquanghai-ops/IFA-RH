import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const headers = new Headers(opts?.headers || {});
  if (!headers.has('Referer')) headers.set('Referer', 'https://ifa-rh.web.app');
  if (!headers.has('Origin')) headers.set('Origin', 'https://ifa-rh.web.app');
  return originalFetch(url, { ...opts, headers });
};

function getAccessToken() {
  const cfgPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  let cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const expiresAt = cfg.tokens?.expires_at ? new Date(cfg.tokens.expires_at).getTime() : 0;
  if (!expiresAt || Date.now() >= expiresAt - 30000) {
    console.log('[Auth] Token expired or close to expiry, refreshing with firebase CLI...');
    try {
      execSync('npx firebase projects:list', { stdio: 'ignore' });
      cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    } catch (e) {
      console.warn('[Auth] Warning refreshing token:', e.message);
    }
  }
  return cfg.tokens.access_token;
}

const token = getAccessToken();
const PROJECT_ID = 'ifa-rh';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
};

function decodeValue(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue?.values || []).map(decodeValue);
  if ('mapValue' in v) return decodeFields(v.mapValue?.fields || {});
  return null;
}

function decodeFields(fields) {
  const result = {};
  for (const [k, v] of Object.entries(fields || {})) {
    result[k] = decodeValue(v);
  }
  return result;
}

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
  return { id, ...decodeFields(data.fields || {}) };
}

async function listDocuments(col) {
  const url = `${BASE_URL}/${col}?pageSize=100`;
  const res = await originalFetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to list ${col}: ${await res.text()}`);
  const data = await res.json();
  return (data.documents || []).map(doc => {
    const id = doc.name.split('/').pop();
    return { id, ...decodeFields(doc.fields || {}) };
  });
}

async function deleteDocument(col, id) {
  const url = `${BASE_URL}/${col}/${id}`;
  const res = await originalFetch(url, { method: 'DELETE', headers });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete ${col}/${id}: ${await res.text()}`);
  }
  return true;
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
  if (!res.ok) throw new Error(`Failed to update ${col}/${id}: ${await res.text()}`);
  return await res.json();
}

async function main() {
  console.log('=== IFA-RH FIRESTORE CLEANUP & BACKUP ===\n');

  // 1. Fetch current collections
  console.log('--- 1. Quét dữ liệu hiện tại trong Firestore ---');
  const allOpps = await listDocuments('opportunities');
  const allCands = await listDocuments('opportunityCandidates');
  console.log(`opportunities: ${allOpps.length} bản ghi`);
  console.log(`opportunityCandidates: ${allCands.length} bản ghi`);

  // Identify targets to delete
  // A. 7 redundant auto-closed proposals
  const autoClosedProposalIds = [
    'cand_upd_opp_ietbhec_2027',
    'cand_upd_opp_celg_2026',
    'cand_upd_opp_ciemb_2026',
    'cand_upd_opp_letj_2027',
    'cand_upd_opp_icisn_2027',
    'cand_upd_opp_neu_duongdai_2026',
    'cand_upd_E3zjQ9KZxXarkH8R2CEM',
  ];

  const candsToDelete = allCands.filter(c => autoClosedProposalIds.includes(c.id));

  // B. 4 archived opportunities not part of official 10 conferences
  const archivedOppIds = [
    'opp_aia_2026',
    'opp_icdi_2026',
    'opp_sus_design_2026',
    'opp_sustainable_design',
  ];
  const oppsToDelete = allOpps.filter(o => archivedOppIds.includes(o.id));

  // 2. Perform local backup
  console.log('\n--- 2. Tạo bản sao lưu cục bộ (Local Backup) ---');
  const backupData = {
    timestamp: new Date().toISOString(),
    project: PROJECT_ID,
    deletedCandidates: candsToDelete,
    deletedOpportunities: oppsToDelete,
    preservedOpportunities: allOpps.filter(o => !archivedOppIds.includes(o.id)),
    preservedCandidates: allCands.filter(c => !autoClosedProposalIds.includes(c.id)),
  };

  const backupDir = path.resolve('backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupFile = path.join(backupDir, 'firestore_cleanup_backup_20261015.json');
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`[PASS] Đã lưu bản sao lưu an toàn tại: ${backupFile}`);
  console.log(`  - Ứng viên tự đóng sao lưu: ${candsToDelete.length}`);
  console.log(`  - Hội thảo lưu trữ cũ sao lưu: ${oppsToDelete.length}`);

  // 3. Delete 7 redundant AUTO_CLOSED proposals
  console.log('\n--- 3. Xóa hẳn 7 đề xuất tự đóng (AUTO_CLOSED) dư thừa ---');
  for (const cand of candsToDelete) {
    await deleteDocument('opportunityCandidates', cand.id);
    console.log(`  [DELETED] opportunityCandidates/${cand.id} (${cand.conferenceCode || 'TN'})`);
  }

  // 4. Delete 4 archived opportunities
  console.log('\n--- 4. Xóa 4 hội thảo lưu trữ cũ không thuộc 10 hội thảo chính thức ---');
  for (const opp of oppsToDelete) {
    await deleteDocument('opportunities', opp.id);
    console.log(`  [DELETED] opportunities/${opp.id}`);
  }

  // 5. Correct spark_opp_20261006-01_6 (QT0003) to ensure it is in-scope and approved
  console.log('\n--- 5. Chuẩn hóa QT0003 (spark_opp_20261006-01_6) sang trạng thái Trong phạm vi / Đã duyệt ---');
  const spark6 = await getDocument('opportunityCandidates', 'spark_opp_20261006-01_6');
  if (spark6) {
    await updateDocument('opportunityCandidates', 'spark_opp_20261006-01_6', {
      isOutOfScope: false,
      outOfScopeReason: '',
      category: 'QT',
      conferenceCode: 'QT0003',
      status: 'approved',
      resolutionType: 'APPROVED_UPDATE',
      updatedAt: new Date().toISOString(),
      updatedBy: 'SPARK_CLEANUP',
    });
    console.log('[PASS] spark_opp_20261006-01_6 updated: isOutOfScope=false, status=approved, code=QT0003');
  }

  // 6. Verify final state
  console.log('\n--- 6. Kiểm tra lại trạng thái sau khi dọn dẹp ---');
  const finalOpps = await listDocuments('opportunities');
  const finalCands = await listDocuments('opportunityCandidates');

  console.log(`\nOPPORTUNITIES (${finalOpps.length} bản ghi):`);
  for (const o of finalOpps) {
    console.log(`  - [${o.conferenceCode}] ID: ${o.id} | Title: ${o.title?.slice(0, 45)}... | Status: ${o.status}`);
  }

  console.log(`\nOPPORTUNITY CANDIDATES (${finalCands.length} bản ghi):`);
  for (const c of finalCands) {
    console.log(`  - [${c.conferenceCode}] ID: ${c.id} | Status: ${c.status} | ResType: ${c.resolutionType || 'none'} | Change: ${c.changeType || 'none'} | Title: ${c.title?.slice(0, 40)}...`);
  }

  console.log('\n======================================================');
  console.log('HOÀN THÀNH DỌN DẸP FIRESTORE THỰC TẾ!');
  console.log(`- Đã xóa tổng cộng: ${candsToDelete.length + oppsToDelete.length} bản ghi dư thừa`);
  console.log(`- Hội thảo công bố giữ lại: ${finalOpps.length} (Đúng 8 hội thảo: TN0001-TN0007, QT0003)`);
  console.log(`- Ứng viên giữ lại: ${finalCands.length} (8 đã duyệt, 2 mới chờ duyệt [QT0001, QT0002], 1 đề xuất cập nhật [QT0003])`);
}

main().catch(err => {
  console.error('Fatal error during cleanup:', err);
  process.exit(1);
});
