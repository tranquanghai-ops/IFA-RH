#!/usr/bin/env node

/**
 * sync-research.mjs
 * 
 * Tự động đồng bộ dữ liệu nghiên cứu khoa học từ Google Sheets (SPAK) vào IFA-RH.
 * Được chạy định kỳ bởi GitHub Actions vào mỗi thứ Hai lúc 03:00 AM (giờ Việt Nam, UTC+7),
 * hoặc chạy thủ công qua workflow_dispatch / CLI.
 * 
 * Tham số dòng lệnh:
 *   --dry-run       : Chạy thử nghiệm, phân tích đối chiếu dữ liệu nhưng không ghi vào Firestore
 *   --force         : Ghi đè khóa concurrency nếu có phiên chạy trước chưa giải phóng
 *   --sheet-id <id> : Spreadsheet ID tùy chọn (mặc định: 1ug0b4Holu6nGp6NwO-JViqe7XexeDLlwirqRELGwh4U)
 *   --sheet-name <n>: Tên tab Google Sheet (mặc định: HỘI THẢO)
 *   github_schedule | github_dispatch | manual_cli (nguồn kích hoạt)
 */

import process from 'node:process';
import crypto from 'node:crypto';
import admin from 'firebase-admin';

const DEFAULT_RESEARCH_SHEET_ID = '1ug0b4Holu6nGp6NwO-JViqe7XexeDLlwirqRELGwh4U';
const DEFAULT_RESEARCH_SHEET_NAME = 'HỘI THẢO';

// Parse command-line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');

const sheetIdIdx = args.indexOf('--sheet-id');
const customSheetId = sheetIdIdx !== -1 ? args[sheetIdIdx + 1] : null;

const sheetNameIdx = args.indexOf('--sheet-name');
const customSheetName = sheetNameIdx !== -1 ? args[sheetNameIdx + 1] : null;

const runSourceArg = args.find(a => !a.startsWith('--'));
const runSource = runSourceArg || (process.env.GITHUB_ACTIONS ? (process.env.GITHUB_EVENT_NAME === 'schedule' ? 'github_schedule' : 'github_dispatch') : 'manual_cli');

// ============================================================================
// Helper Utilities & Normalizers
// ============================================================================

function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCanonicalUrl(url) {
  if (!url) return '';
  let clean = String(url).trim().toLowerCase();
  clean = clean.replace(/^https?:\/\//, '');
  clean = clean.replace(/^www\./, '');
  clean = clean.replace(/[?#].*$/, '');
  clean = clean.replace(/\/+$/, '');
  return clean;
}

function extractConferenceYear(text) {
  if (!text) return '';
  const match = String(text).match(/\b(202[4-9]|203[0-5])\b/);
  return match ? match[1] : '';
}

function isGenericPortalUrl(url) {
  return [
    'neu.edu.vn',
    'ueh.edu.vn',
    'tdtu.edu.vn',
    'vnu.edu.vn',
    'docs.google.com',
    'drive.google.com',
  ].some(domain => url === domain || url.startsWith(`${domain}/`));
}

function cleanUndefined(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item));
  }
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      result[k] = typeof v === 'object' && v !== null && !(v instanceof Date) ? cleanUndefined(v) : v;
    }
  }
  return result;
}

function parseGvizDateValue(cell) {
  if (!cell || (cell.v === null && cell.f === null)) {
    return { text: '', date: null };
  }
  const rawVal = cell.v;
  const formattedVal = String(cell.f || '').trim();

  if (typeof rawVal === 'string' && (
    rawVal.toLowerCase().includes('chưa xác minh') ||
    rawVal.toLowerCase().includes('chua xac minh') ||
    rawVal.toLowerCase().includes('thường xuyên') ||
    rawVal.toLowerCase().includes('liên tục')
  )) {
    return { text: rawVal.trim(), date: null };
  }

  if (formattedVal && (
    formattedVal.toLowerCase().includes('chưa xác minh') ||
    formattedVal.toLowerCase().includes('chua xac minh') ||
    formattedVal.toLowerCase().includes('thường xuyên')
  )) {
    return { text: formattedVal, date: null };
  }

  if (typeof rawVal === 'string') {
    const m = rawVal.match(/^Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})(?:,\s*(\d{1,2}),\s*(\d{1,2}),\s*(\d{1,2}))?\)$/);
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]);
      const day = Number(m[3]);
      const hours = Number(m[4] || 0);
      const minutes = Number(m[5] || 0);
      const seconds = Number(m[6] || 0);
      const d = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
      const dayStr = String(day).padStart(2, '0');
      const monthStr = String(month + 1).padStart(2, '0');
      return { text: `${dayStr}/${monthStr}/${year}`, date: d };
    }
  }

  if (formattedVal) {
    const parts = formattedVal.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (parts) {
      const d = Number(parts[1]);
      const m = Number(parts[2]) - 1;
      const y = Number(parts[3]);
      return {
        text: `${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}/${y}`,
        date: new Date(Date.UTC(y, m, d))
      };
    }
    return { text: formattedVal, date: null };
  }

  if (typeof rawVal === 'string' && rawVal.trim()) {
    const parts = rawVal.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (parts) {
      const d = Number(parts[1]);
      const m = Number(parts[2]) - 1;
      const y = Number(parts[3]);
      return {
        text: `${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}/${y}`,
        date: new Date(Date.UTC(y, m, d))
      };
    }
    return { text: rawVal.trim(), date: null };
  }

  return { text: '', date: null };
}

function parseFacultyResearchGvizRow(cells, index) {
  const getCellVal = idx => {
    const c = cells[idx];
    if (!c) return '';
    if (c.f !== undefined && c.f !== null) return String(c.f).trim();
    if (c.v !== undefined && c.v !== null) return String(c.v).trim();
    return '';
  };

  const sttNum = Number(cells[0]?.v);
  const stt = Number.isFinite(sttNum) && sttNum > 0 ? sttNum : index + 1;

  const discovered = parseGvizDateValue(cells[1]);
  const runId = getCellVal(2);
  const title = getCellVal(3);
  const sourceUrl = getCellVal(4);
  const submissionUrl = getCellVal(5);
  const organizer = getCellVal(6);
  const country = getCellVal(7) || 'Việt Nam';
  const level = getCellVal(8) || 'Quốc tế';
  const type = getCellVal(9) || 'Hội thảo';
  const topic = getCellVal(10);
  const suitability = getCellVal(11) || 'Phù hợp';
  const field = getCellVal(12) || 'Chung Khoa MTCN';

  const abstractParsed = parseGvizDateValue(cells[13]);
  const fullPaperParsed = parseGvizDateValue(cells[14]);
  const regParsed = parseGvizDateValue(cells[15]);
  const eventDateVal = getCellVal(16);
  const location = getCellVal(17);
  const fee = getCellVal(18);
  const publicationFormat = getCellVal(19);
  const indexing = getCellVal(20);
  const content = getCellVal(21);
  const directions = getCellVal(22);
  const tags = getCellVal(23);
  const statusText = getCellVal(24) || 'CÒN HẠN';
  const updatedParsed = parseGvizDateValue(cells[25]);
  const notes = getCellVal(26);

  const feeStatus = fee.toLowerCase().includes('miễn phí')
    ? 'FREE'
    : fee.toLowerCase().includes('chưa xác minh') || !fee
    ? 'UNKNOWN'
    : 'SPECIFIED';

  const publicationFee = feeStatus === 'FREE' ? 'Miễn phí' : fee ? fee : 'Không rõ chi phí';
  const registrationFee = feeStatus === 'FREE' ? 'Miễn phí' : 'Không rõ chi phí';

  return {
    stt,
    discoveredAt: discovered.text || undefined,
    runId: runId || undefined,
    title,
    sourceUrl: sourceUrl || undefined,
    submissionUrl: submissionUrl || undefined,
    organizer,
    country,
    level,
    type,
    topic,
    suitability,
    field,
    abstractDeadline: abstractParsed.text || undefined,
    fullPaperDeadline: fullPaperParsed.text || undefined,
    registrationDeadline: regParsed.text || undefined,
    eventDate: eventDateVal || undefined,
    location: location || undefined,
    fee: fee || undefined,
    publicationFee,
    registrationFee,
    feeStatus,
    publicationFormat: publicationFormat || undefined,
    indexing: indexing || undefined,
    content,
    directions: directions || undefined,
    tags: tags || undefined,
    statusText,
    updatedAt: updatedParsed.text || undefined,
    notes: notes || undefined,
  };
}

async function fetchGoogleSheetRows(sheetId, sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?sheet=${encodeURIComponent(
    sheetName
  )}&tqx=out:json&headers=1&_t=${Date.now()}`;

  console.log(`Đang tải dữ liệu từ Google Sheets: ${sheetName}...`);
  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) {
    throw new Error(`Google Sheets HTTP ${response.status}: ${response.statusText}`);
  }

  const text = await response.text();
  const start = text.indexOf('google.visualization.Query.setResponse(');
  if (start < 0) {
    throw new Error('Google Sheets không trả về cấu trúc bảng dữ liệu hợp lệ.');
  }

  const jsonStr = text.slice(start + 'google.visualization.Query.setResponse('.length).trim().replace(/\);?\s*$/, '');
  const resObj = JSON.parse(jsonStr);

  if (resObj.status !== 'ok' || !resObj.table) {
    throw new Error(
      `Lỗi đọc Google Sheet: ${resObj.errors?.[0]?.message || resObj.status || 'Không có dữ liệu bảng'}`
    );
  }

  const rows = resObj.table.rows || [];
  const parsedRows = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row.c)) continue;
    const title = row.c[3]?.f || row.c[3]?.v;
    if (!title || !String(title).trim()) continue;
    parsedRows.push(parseFacultyResearchGvizRow(row.c, i));
  }

  return parsedRows;
}

// ============================================================================
// Matching & Deduplication Engine
// ============================================================================

function findMatchingTarget(row, existingList) {
  const normTitle = normalizeText(row.title);
  const rowYear =
    extractConferenceYear(row.title) ||
    extractConferenceYear(row.eventDate) ||
    extractConferenceYear(row.fullPaperDeadline);

  const rowSourceUrl = normalizeCanonicalUrl(row.sourceUrl);
  const rowSubUrl = normalizeCanonicalUrl(row.submissionUrl);
  const rowOrg = normalizeText(row.organizer);

  for (const existing of existingList) {
    const exTitle = normalizeText(existing.title);
    const exYear =
      extractConferenceYear(existing.title) ||
      extractConferenceYear(existing.eventDate) ||
      extractConferenceYear(existing.fullPaperDeadline);

    // Rule 1: Canonical sourceUrl match
    const exSourceUrl = normalizeCanonicalUrl(existing.sourceUrl);
    if (
      rowSourceUrl &&
      exSourceUrl &&
      rowSourceUrl === exSourceUrl &&
      rowSourceUrl.length > 8 &&
      !isGenericPortalUrl(rowSourceUrl)
    ) {
      if (rowYear && exYear && rowYear !== exYear) continue;
      return {
        isMatch: true,
        matchedId: existing.id,
        target: existing,
        matchType: 'source_url',
        reason: `Khớp link nguồn chính thức (${rowSourceUrl})`,
      };
    }

    // Rule 2: Web portal submissionUrl match
    const exSubUrl = normalizeCanonicalUrl(existing.submissionUrl);
    if (
      rowSubUrl &&
      exSubUrl &&
      rowSubUrl === exSubUrl &&
      rowSubUrl.length > 12 &&
      !rowSubUrl.includes('@') &&
      !isGenericPortalUrl(rowSubUrl)
    ) {
      if (rowYear && exYear && rowYear !== exYear) continue;
      return {
        isMatch: true,
        matchedId: existing.id,
        target: existing,
        matchType: 'submission_url',
        reason: `Khớp link nộp bài / đăng ký (${rowSubUrl})`,
      };
    }

    // Rule 3: Exact title match + Same Year Check
    if (normTitle && exTitle && normTitle === exTitle) {
      if (rowYear && exYear && rowYear !== exYear) continue;
      return {
        isMatch: true,
        matchedId: existing.id,
        target: existing,
        matchType: 'exact_title_year',
        reason: `Khớp chính xác tiêu đề "${existing.title}"`,
      };
    }

    // Rule 4: Same Organizer + Substantial title overlap + Same Year
    const exOrg = normalizeText(existing.organizer);
    if (rowOrg && exOrg && rowOrg === exOrg) {
      const titlesOverlap =
        (normTitle.length > 15 && exTitle.includes(normTitle)) ||
        (exTitle.length > 15 && normTitle.includes(exTitle));

      if (titlesOverlap) {
        if (rowYear && exYear && rowYear !== exYear) continue;
        return {
          isMatch: true,
          matchedId: existing.id,
          target: existing,
          matchType: 'organizer_title_year',
          reason: 'Cùng đơn vị tổ chức và trùng phần lớn tiêu đề',
        };
      }
    }
  }

  return { isMatch: false };
}

function isEditedByAdmin(record) {
  if (record.editedByAdmin === true) return true;
  if (Array.isArray(record.manualOverrides) && record.manualOverrides.length > 0) return true;
  
  const updatedBy = String(record.updatedBy || record.reviewedBy || '').toLowerCase();
  if (
    updatedBy &&
    !updatedBy.includes('spark') &&
    !updatedBy.includes('bot') &&
    !updatedBy.includes('github-actions') &&
    !updatedBy.includes('system')
  ) {
    if (record.status === 'approved' || record.status === 'rejected' || record.status === 'published') {
      return true;
    }
  }
  return false;
}

function computeDiff(existing, row) {
  const updates = {};
  const changedKeys = [];

  const compareField = (key, newVal, exVal) => {
    if (newVal === undefined || newVal === null) return;
    const strNew = String(newVal).trim();
    const strEx = String(exVal || '').trim();
    if (strNew && strNew !== strEx) {
      updates[key] = newVal;
      changedKeys.push(key);
    }
  };

  compareField('deadline', row.fullPaperDeadline || row.abstractDeadline || row.registrationDeadline, existing.deadline);
  compareField('fullPaperDeadline', row.fullPaperDeadline, existing.fullPaperDeadline);
  compareField('abstractDeadline', row.abstractDeadline, existing.abstractDeadline);
  compareField('registrationDeadline', row.registrationDeadline, existing.registrationDeadline);
  compareField('eventDate', row.eventDate, existing.eventDate);
  compareField('location', row.location, existing.location);
  compareField('fee', row.fee, existing.fee);
  compareField('publicationFee', row.publicationFee, existing.publicationFee);
  compareField('registrationFee', row.registrationFee, existing.registrationFee);
  compareField('feeStatus', row.feeStatus, existing.feeStatus);
  compareField('publicationFormat', row.publicationFormat, existing.publicationFormat);
  compareField('indexing', row.indexing, existing.indexing);
  compareField('content', row.content, existing.content);
  compareField('directions', row.directions, existing.directions);
  compareField('suitability', row.suitability, existing.suitability);
  compareField('notes', row.notes, existing.notes);
  compareField('sourceUrl', row.sourceUrl, existing.sourceUrl);
  compareField('submissionUrl', row.submissionUrl, existing.submissionUrl);
  compareField('sheetStatus', row.statusText, existing.sheetStatus);

  return {
    hasChanges: changedKeys.length > 0,
    changedKeys,
    updates,
  };
}

function mapRowToCandidateDoc(row, index) {
  const fullPaper = row.fullPaperDeadline && row.fullPaperDeadline !== 'Chưa xác minh' ? row.fullPaperDeadline : '';
  const abstract = row.abstractDeadline && row.abstractDeadline !== 'Chưa xác minh' ? row.abstractDeadline : '';
  const registration = row.registrationDeadline && row.registrationDeadline !== 'Chưa xác minh' ? row.registrationDeadline : '';
  const mainDeadline =
    fullPaper ||
    abstract ||
    registration ||
    (event && (event.toLowerCase().includes('định kỳ') || event.toLowerCase().includes('thường xuyên'))
      ? 'Nhận bài thường xuyên'
      : '') ||
    'Nhận bài thường xuyên';

  const tagsList = (row.tags || '')
    .split(/[,;]/)
    .map(t => t.trim())
    .filter(t => t.length > 0);

  let mappedType = 'Hội thảo';
  if (row.type?.includes('Hội nghị')) mappedType = 'Hội nghị';
  else if (row.type?.includes('Call for Papers')) mappedType = 'Call for Papers';
  else if (row.type?.includes('Special Issue')) mappedType = 'Special Issue';
  else if (row.type?.includes('Book Chapter')) mappedType = 'Book Chapter';
  else if (row.type?.includes('Seminar')) mappedType = 'Seminar';

  let mappedLevel = 'Quốc tế';
  if (row.level?.includes('Quốc gia')) mappedLevel = 'Quốc gia';
  else if (row.level?.includes('Trường')) mappedLevel = 'Cấp Trường';
  else if (row.level?.includes('Khoa')) mappedLevel = 'Cấp Khoa';

  return {
    title: row.title,
    organizer: row.organizer || 'Đang cập nhật',
    country: row.country || 'Việt Nam',
    type: mappedType,
    level: mappedLevel,
    topic: row.topic || '',
    field: row.field || 'Chung Khoa MTCN',
    tags: tagsList,
    deadline: mainDeadline,
    abstractDeadline: abstract || undefined,
    fullPaperDeadline: fullPaper || undefined,
    registrationDeadline: registration || undefined,
    eventDate: event || undefined,
    location: row.location || undefined,
    fee: row.fee || undefined,
    publicationFee: row.publicationFee,
    registrationFee: row.registrationFee,
    feeStatus: row.feeStatus,
    publicationFormat: row.publicationFormat || undefined,
    indexing: row.indexing || undefined,
    content: row.content || '',
    submissionUrl: row.submissionUrl || undefined,
    sourceUrl: row.sourceUrl || undefined,
    directions: row.directions || undefined,
    suitability: row.suitability || 'Phù hợp',
    notes: row.notes || undefined,
    runId: row.runId || undefined,
    discoveredAt: row.discoveredAt || undefined,
    sheetStatus: row.statusText || undefined,
    sourceType: 'SPARK',
    status: 'pending',
    normalizedTitle: normalizeText(row.title),
    createdAt: row.discoveredAt || new Date().toISOString(),
    updatedAt: row.updatedAt || new Date().toISOString(),
  };
}

// ============================================================================
// Main Execution Function
// ============================================================================

async function main() {
  const startTime = Date.now();
  console.log('=================================================================');
  console.log(' IFA-RH: ĐỒNG BỘ TỰ ĐỘNG DỮ LIỆU NGHIÊN CỨU KHOA HỌC (SPAK -> IFA-RH)');
  console.log(` Thời điểm: ${new Date().toISOString()} (UTC)`);
  console.log(` Nguồn chạy: ${runSource}`);
  if (isDryRun) console.log(' Chế độ: --dry-run (Chỉ kiểm tra đối chiếu, không ghi Firestore)');
  if (isForce) console.log(' Chế độ: --force (Bỏ qua kiểm tra khóa phiên trước)');
  console.log('=================================================================');

  const sheetId = customSheetId || DEFAULT_RESEARCH_SHEET_ID;
  const sheetName = customSheetName || DEFAULT_RESEARCH_SHEET_NAME;

  // Initialize Firebase Admin
  let db = null;
  const rhKeyStr = process.env.IFA_RH_SA_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_IFA_RH || process.env.FIREBASE_SERVICE_ACCOUNT;

  if (rhKeyStr) {
    console.log('Đang khởi tạo Firebase Admin SDK bằng Service Account key...');
    const rhApp = admin.initializeApp(
      { credential: admin.credential.cert(JSON.parse(rhKeyStr)) },
      'ifa-rh-admin'
    );
    db = admin.firestore(rhApp);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('Đang khởi tạo Firebase Admin SDK bằng GOOGLE_APPLICATION_CREDENTIALS...');
    const rhApp = admin.initializeApp(
      { credential: admin.credential.applicationDefault() },
      'ifa-rh-admin'
    );
    db = admin.firestore(rhApp);
  } else if (!isDryRun) {
    console.error('Lỗi: Cần IFA_RH_SA_KEY hoặc GOOGLE_APPLICATION_CREDENTIALS để kết nối Firestore.');
    console.error('Để kích hoạt tự động trên GitHub Actions:');
    console.error('1. Vào GitHub repo Settings -> Secrets and variables -> Actions.');
    console.error('2. Thêm Secret: IFA_RH_SA_KEY (Service Account JSON của ifa-rh).');
    process.exit(1);
  }

  // 1. Check lock in systemConfig/facultyResearchSync
  const stateRef = db ? db.collection('systemConfig').doc('facultyResearchSync') : null;
  const lockId = crypto.randomUUID();

  if (db && !isDryRun) {
    try {
      const stateSnap = await stateRef.get();
      if (stateSnap.exists) {
        const state = stateSnap.data();
        const inProgress = Boolean(state.syncInProgress);
        const startedAtMs = state.syncStartedAtMs || (state.syncStartedAt ? new Date(state.syncStartedAt).getTime() : 0);
        const isFreshLock = inProgress && (Date.now() - startedAtMs < 15 * 60 * 1000);

        if (isFreshLock && !isForce) {
          console.warn('CẢNH BÁO: Một phiên đồng bộ khác đang chạy. Bỏ qua phiên này.');
          process.exit(0);
        }
      }

      await stateRef.set({
        syncInProgress: true,
        lockId,
        syncStartedAt: new Date().toISOString(),
        syncStartedAtMs: startTime,
        syncStartedBy: 'github-actions[bot]',
        lastSyncStatus: 'running',
        lastSyncSource: runSource,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (lockErr) {
      console.warn('Lưu ý không ghi được lock (tiếp tục đồng bộ):', lockErr.message);
    }
  }

  try {
    // 2. Fetch Google Sheets
    const rows = await fetchGoogleSheetRows(sheetId, sheetName);
    console.log(`Đã đọc thành công ${rows.length} dòng dữ liệu từ Google Sheets.`);

    // 3. Fetch existing Firestore records
    let existingCandidates = [];
    let existingOpportunities = [];

    if (db) {
      console.log('Đang tải danh sách cơ hội hiện có từ Firestore...');
      const [candsSnap, oppsSnap] = await Promise.all([
        db.collection('opportunityCandidates').get(),
        db.collection('opportunities').get(),
      ]);

      existingCandidates = candsSnap.docs.map(d => ({ ...d.data(), id: d.id, _targetType: 'candidate' }));
      existingOpportunities = oppsSnap.docs.map(d => ({ ...d.data(), id: d.id, _targetType: 'opportunity' }));
      console.log(`Tìm thấy: ${existingCandidates.length} ứng viên chờ duyệt, ${existingOpportunities.length} cơ hội đã đăng.`);
    }

    const combinedTargets = [...existingOpportunities, ...existingCandidates];

    const stats = {
      read: rows.length,
      valid: 0,
      created: 0,
      matched: 0,
      updated: 0,
      preservedAdmin: 0,
      duplicates: 0,
      errorCount: 0,
    };

    const diagnostics = [];
    const seenMatchedIds = new Set();

    // 4. Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const sttVal = row.stt || i + 1;

      if (String(row.statusText || '').toUpperCase() === 'TEST' || row.title.toLowerCase().startsWith('test')) {
        diagnostics.push({
          row: rowNum,
          stt: sttVal,
          title: row.title,
          status: 'skipped',
          action: 'Bỏ qua TEST',
          reason: 'Bản ghi thử nghiệm (TEST)',
        });
        continue;
      }

      if (!row.title.trim()) {
        stats.errorCount++;
        diagnostics.push({
          row: rowNum,
          stt: sttVal,
          title: 'Chưa có tiêu đề',
          status: 'invalid',
          action: 'Lỗi',
          reason: 'Dòng thiếu tiêu đề',
        });
        continue;
      }

      stats.valid++;

      const match = findMatchingTarget(row, combinedTargets);

      if (match.isMatch && match.target) {
        const target = match.target;

        if (seenMatchedIds.has(target.id)) {
          stats.duplicates++;
          diagnostics.push({
            row: rowNum,
            stt: sttVal,
            title: row.title,
            status: 'skipped',
            action: 'Trùng Sheet',
            reason: 'Trùng với dòng khác trong Google Sheet',
            targetId: target.id,
          });
          continue;
        }
        seenMatchedIds.add(target.id);

        if (isEditedByAdmin(target)) {
          stats.preservedAdmin++;
          diagnostics.push({
            row: rowNum,
            stt: sttVal,
            title: row.title,
            status: 'preserved_admin',
            action: 'Giữ sửa Admin',
            reason: `Khớp ${target._targetType}, giữ nguyên chỉnh sửa Admin`,
            targetId: target.id,
          });
          continue;
        }

        const diff = computeDiff(target, row);
        if (diff.hasChanges) {
          if (db && !isDryRun) {
            const colName = target._targetType === 'opportunity' ? 'opportunities' : 'opportunityCandidates';
            await db.collection(colName).doc(target.id).update(
              cleanUndefined({
                ...diff.updates,
                updatedAt: new Date().toISOString(),
                updatedBy: 'SPARK_SYNC',
              })
            );
          }
          stats.updated++;
          diagnostics.push({
            row: rowNum,
            stt: sttVal,
            title: row.title,
            status: 'updated',
            action: 'Cập nhật',
            reason: `Cập nhật thông tin (${diff.changedKeys.join(', ')})`,
            targetId: target.id,
          });
        } else {
          stats.matched++;
          diagnostics.push({
            row: rowNum,
            stt: sttVal,
            title: row.title,
            status: 'matched',
            action: 'Khớp',
            reason: 'Dữ liệu không đổi',
            targetId: target.id,
          });
        }
      } else {
        // New record: create candidate
        const candidate = mapRowToCandidateDoc(row, i);
        let newCandidateId = '';

        if (db && !isDryRun) {
          const addedDoc = await db.collection('opportunityCandidates').add(
            cleanUndefined({
              ...candidate,
              status: 'pending',
              sourceType: 'SPARK',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
          );
          newCandidateId = addedDoc.id;
        }

        stats.created++;
        diagnostics.push({
          row: rowNum,
          stt: sttVal,
          title: row.title,
          status: 'created',
          action: 'Tạo mới',
          reason: 'Cơ hội NCKH mới đưa vào hàng chờ duyệt',
          targetId: newCandidateId,
        });
      }
    }

    const durationMs = Date.now() - startTime;
    const finalStatus = stats.errorCount > 0 ? 'partial_success' : 'success';

    // 5. Update systemConfig and write imports record
    if (db && !isDryRun) {
      await stateRef.set({
        lastSyncAt: new Date().toISOString(),
        lastSyncDate: new Date().toISOString().split('T')[0],
        lastSyncStatus: finalStatus,
        lastSyncSource: runSource,
        lastSyncStats: stats,
        durationMs,
        diagnostics: diagnostics.slice(0, 30),
        syncInProgress: false,
        lockId: '',
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      try {
        const importRef = db.collection('imports').doc(`imp_spark_${Date.now()}`);
        await importRef.set({
          id: importRef.id,
          timestamp: new Date().toISOString(),
          importedBy: 'github-actions[bot]',
          fileName: `IFA Faculty Research (${sheetName})`,
          type: 'opportunities',
          totalRows: stats.read,
          successCount: stats.created + stats.updated + stats.matched + stats.preservedAdmin,
          errorCount: stats.errorCount,
          skippedCount: stats.duplicates,
          errors: diagnostics
            .filter(d => d.status === 'invalid')
            .map(d => ({ row: d.row, reason: d.reason })),
          createdAt: new Date().toISOString(),
        });
      } catch (impErr) {
        console.warn('Không ghi được lịch sử imports:', impErr.message);
      }
    }

    console.log('=================================================================');
    console.log('KẾT QUẢ ĐỒNG BỘ:');
    console.log(`- Tổng số dòng đọc được: ${stats.read}`);
    console.log(`- Dòng hợp lệ:           ${stats.valid}`);
    console.log(`- Mới tạo (chờ duyệt):   ${stats.created}`);
    console.log(`- Khớp dữ liệu cũ:       ${stats.matched}`);
    console.log(`- Cập nhật thông tin:    ${stats.updated}`);
    console.log(`- Giữ sửa thủ công Admin:${stats.preservedAdmin}`);
    console.log(`- Trùng lặp / Bỏ qua:    ${stats.duplicates}`);
    console.log(`- Lỗi:                   ${stats.errorCount}`);
    console.log(`- Thời gian thực thi:    ${(durationMs / 1000).toFixed(2)}s`);
    console.log('=================================================================');

    console.log('\nCHI TIẾT TỪNG DÒNG:');
    for (const d of diagnostics) {
      console.log(`[${d.action.padEnd(16)}] STT ${String(d.stt).padStart(2)}: ${d.title.slice(0, 50).padEnd(50)} -> ${d.reason}`);
    }

    if (stats.errorCount > 0) {
      process.exitCode = 0; // Partial success doesn't fail pipeline
    }
  } catch (err) {
    console.error('LỖI ĐỒNG BỘ THẤT BẠI:', err);
    if (db && !isDryRun) {
      try {
        await stateRef.set({
          syncInProgress: false,
          lastSyncStatus: 'failed',
          lastError: String(err?.message || err).slice(0, 1000),
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (unlockErr) {
        console.warn('Lỗi mở khóa sau thất bại:', unlockErr.message);
      }
    }
    process.exit(1);
  }
}

main();
