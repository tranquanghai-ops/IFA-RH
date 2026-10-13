import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { firestore } from "../firebase/config";
import type {
  Journal,
  JournalCandidate,
  JournalCouncilScore,
  JournalScoreEditLog,
  JournalSyncSettings,
} from "../types/journal";
import {
  fetchJournalGoogleSheetRows,
  fetchMultiCouncilGoogleSheetRows,
  buildJournalCandidatesFromSheet,
  buildCouncilScoreCompositeKey,
  sanitizePublicJournalSpreadsheetId,
  sanitizePublicJournalSheetName,
  DEFAULT_JOURNAL_SHEET_NAME,
  DEFAULT_JOURNAL_SPREADSHEET_ID,
  DEFAULT_MULTI_COUNCIL_SPREADSHEET_ID,
  DEFAULT_MULTI_COUNCIL_SHEET_NAME,
} from "./journalGoogleSheetService";
import { fetchJournals, createJournal, updateJournal } from "./journalService";

/**
 * Remove undefined values so Firestore does not reject writes.
 */
function cleanUndefined<T = any>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanUndefined(item)) as unknown as T;
  }
  const result: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      result[k] =
        typeof v === "object" && v !== null && !(v instanceof Date)
          ? cleanUndefined(v)
          : v;
    }
  }
  return result as T;
}

/**
 * Merge two councilScores arrays by composite key without losing historical entries.
 */
export function mergeCouncilScoresList(
  existingList: JournalCouncilScore[] = [],
  incomingList: JournalCouncilScore[] = []
): JournalCouncilScore[] {
  const merged = [...existingList];
  const keyIndexMap = new Map<string, number>();
  merged.forEach((item, idx) => {
    keyIndexMap.set(buildCouncilScoreCompositeKey(item), idx);
  });

  for (const inc of incomingList) {
    const key = buildCouncilScoreCompositeKey(inc);
    const existingIdx = keyIndexMap.get(key);
    if (existingIdx !== undefined) {
      merged[existingIdx] = inc;
    } else {
      keyIndexMap.set(key, merged.length);
      merged.push(inc);
    }
  }
  return merged;
}

/**
 * Subscribe to all journal candidates (Admin/Owner only).
 */
export function subscribeJournalCandidates(
  callback: (candidates: JournalCandidate[]) => void
) {
  const colRef = collection(firestore, "journalCandidates");
  const q = query(colRef, orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: JournalCandidate[] = [];
      snapshot.forEach((d) => {
        items.push({ ...(d.data() as any), id: d.id });
      });
      callback(items);
    },
    (error) => {
      console.warn("subscribeJournalCandidates error:", error);
      callback([]);
    }
  );
}

/**
 * Fetch all journal candidates once.
 */
export async function fetchJournalCandidates(): Promise<JournalCandidate[]> {
  try {
    const colRef = collection(firestore, "journalCandidates");
    const q = query(colRef, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    const items: JournalCandidate[] = [];
    snap.forEach((d) => {
      items.push({ ...(d.data() as any), id: d.id });
    });
    return items;
  } catch (error) {
    console.error("fetchJournalCandidates error:", error);
    return [];
  }
}

export type JournalSyncStage =
  | "FETCH_SHEET"
  | "READ_JOURNALS"
  | "READ_CANDIDATES"
  | "DIFF_ANALYSIS"
  | "WRITE_CANDIDATE"
  | "WRITE_IMPORT_LOG"
  | "WRITE_CONFIG";

export class JournalSyncStageError extends Error {
  stage: JournalSyncStage;
  collectionName: string;
  documentId?: string;
  operationType: "get" | "list" | "create" | "update" | "delete";
  originalError: any;
  userSummary: string;
  actorUid?: string;
  actorRole?: string;

  constructor(params: {
    stage: JournalSyncStage;
    collectionName: string;
    documentId?: string;
    operationType: "get" | "list" | "create" | "update" | "delete";
    originalError: any;
    userSummary?: string;
    actorUid?: string;
    actorRole?: string;
  }) {
    const code = params.originalError?.code || (String(params.originalError?.message || "").includes("permission") ? "permission-denied" : "unknown");
    const baseMsg = params.originalError?.message || String(params.originalError);
    const friendlyMsg = `Lỗi tại bước ${params.stage} — Không đủ quyền thao tác trên ${params.collectionName}${
      params.documentId ? `/${params.documentId}` : ""
    } (${params.operationType}) — [${code}]: ${params.userSummary || baseMsg}`;
    super(friendlyMsg);
    this.name = "JournalSyncStageError";
    this.stage = params.stage;
    this.collectionName = params.collectionName;
    this.documentId = params.documentId;
    this.operationType = params.operationType;
    this.originalError = params.originalError;
    this.userSummary = params.userSummary || baseMsg;
    this.actorUid = params.actorUid;
    this.actorRole = params.actorRole;
  }
}

/**
 * Save Google Sheets sync settings to systemConfig/journal_sync.
 */
export async function saveJournalSyncSettings(
  settings: Partial<JournalSyncSettings>
): Promise<void> {
  const sanitized: Partial<JournalSyncSettings> = {
    ...settings,
    ...(settings.sheetId !== undefined
      ? { sheetId: sanitizePublicJournalSpreadsheetId(settings.sheetId) }
      : {}),
    ...(settings.sheetName !== undefined
      ? { sheetName: sanitizePublicJournalSheetName(settings.sheetName) }
      : {}),
    ...(settings.multiCouncilSheetId !== undefined
      ? {
          multiCouncilSheetId: sanitizePublicJournalSpreadsheetId(
            settings.multiCouncilSheetId
          ),
        }
      : {}),
    ...(settings.multiCouncilSheetName !== undefined
      ? {
          multiCouncilSheetName: sanitizePublicJournalSheetName(
            settings.multiCouncilSheetName
          ),
        }
      : {}),
  };
  const docRef = doc(firestore, "systemConfig", "journal_sync");
  await setDoc(docRef, cleanUndefined(sanitized), { merge: true });
}

/**
 * Get Google Sheets sync settings, automatically redirecting any legacy private
 * Spark spreadsheet ID to the single public IFA-RH Google Sheet.
 */
export async function getJournalSyncSettings(): Promise<JournalSyncSettings | null> {
  try {
    const docRef = doc(firestore, "systemConfig", "journal_sync");
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const raw = snap.data() as JournalSyncSettings;
    return {
      ...raw,
      sheetId: sanitizePublicJournalSpreadsheetId(raw.sheetId),
      sheetName: sanitizePublicJournalSheetName(raw.sheetName),
      multiCouncilSheetId: sanitizePublicJournalSpreadsheetId(raw.multiCouncilSheetId),
      multiCouncilSheetName: sanitizePublicJournalSheetName(raw.multiCouncilSheetName),
    };
  } catch (error) {
    console.warn("getJournalSyncSettings error:", error);
    return null;
  }
}

/**
 * Core engine: Syncs from Google Sheets single-tab into Review Queue (journalCandidates).
 * DOES NOT publish directly to public journals!
 */
export async function syncJournalsFromGoogleSheetsToQueue({
  sheetId = DEFAULT_JOURNAL_SPREADSHEET_ID,
  sheetName = DEFAULT_JOURNAL_SHEET_NAME,
  user,
}: {
  sheetId?: string;
  sheetName?: string;
  user: { uid: string; email?: string };
}): Promise<{
  success: boolean;
  totalRead: number;
  newCandidatesCount: number;
  updatedCandidatesCount: number;
  unchangedCount: number;
  skippedDuplicates: number;
  manualReviewCount: number;
  warnings: string[];
  writtenCount: number;
  batchId?: string;
}> {
  const effectiveSheetId = sanitizePublicJournalSpreadsheetId(sheetId);
  const effectiveSheetName = sanitizePublicJournalSheetName(sheetName);
  const currentSettings = await getJournalSyncSettings();
  const previousValidRowCount = currentSettings?.lastStats?.validRows;

  // 1. Fetch rows from Google Sheets IFA-RH
  let sheetResult: any;
  try {
    sheetResult = await fetchJournalGoogleSheetRows(
      effectiveSheetId,
      effectiveSheetName,
      { previousValidRowCount }
    );
    if (!sheetResult || !Array.isArray(sheetResult.validJournals)) {
      throw new Error("Không có dữ liệu hợp lệ trả về từ Google Sheets IFA-RH.");
    }
  } catch (sheetErr: any) {
    throw new JournalSyncStageError({
      stage: "FETCH_SHEET",
      collectionName: "google_sheets",
      operationType: "get",
      originalError: sheetErr,
      userSummary: `Lỗi kết nối hoặc đọc Google Sheets IFA-RH (${effectiveSheetName}): ${sheetErr.message || "Không thể đọc dữ liệu"}`,
      actorUid: user.uid,
      actorRole: user.email,
    });
  }

  // 2. Fetch existing journals and active pending candidates
  let existingJournals: Journal[] = [];
  try {
    existingJournals = await fetchJournals({ includeHidden: true });
  } catch (jErr: any) {
    throw new JournalSyncStageError({
      stage: "READ_JOURNALS",
      collectionName: "journals",
      operationType: "list",
      originalError: jErr,
      userSummary: "Không đủ quyền đọc danh mục tạp chí đã công bố",
      actorUid: user.uid,
      actorRole: user.email,
    });
  }

  let existingCandidates: JournalCandidate[] = [];
  try {
    const colRef = collection(firestore, "journalCandidates");
    const q = query(colRef, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    snap.forEach((d) => {
      existingCandidates.push({ ...(d.data() as any), id: d.id });
    });
  } catch (cErr: any) {
    throw new JournalSyncStageError({
      stage: "READ_CANDIDATES",
      collectionName: "journalCandidates",
      operationType: "list",
      originalError: cErr,
      userSummary: "Không đủ quyền đọc danh sách ứng viên trong hàng chờ duyệt",
      actorUid: user.uid,
      actorRole: user.email,
    });
  }

  // 3. Build candidate diffs
  let candidatesToCreate: JournalCandidate[] = [];
  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let skippedDuplicates = 0;
  try {
    const diff = buildJournalCandidatesFromSheet(
      sheetResult.validJournals,
      existingJournals,
      existingCandidates
    );
    candidatesToCreate = diff.candidatesToCreate;
    newCount = diff.newCount;
    updatedCount = diff.updatedCount;
    unchangedCount = diff.unchangedCount;
    skippedDuplicates = diff.skippedDuplicates;
  } catch (diffErr: any) {
    throw new JournalSyncStageError({
      stage: "DIFF_ANALYSIS",
      collectionName: "in_memory",
      operationType: "get",
      originalError: diffErr,
      userSummary: "Lỗi trong quá trình phân tích và so khớp hồ sơ tạp chí",
      actorUid: user.uid,
      actorRole: user.email,
    });
  }

  // 4. Write candidates to Firestore with granular per-document diagnostics
  let writtenCount = 0;
  const existingMap = new Map(existingCandidates.map((c) => [c.id, c]));

  for (const cand of candidatesToCreate) {
    const docRef = doc(firestore, "journalCandidates", cand.id);
    const existing = existingMap.get(cand.id);

    // If candidate already exists in queue, preserve original createdAt & scoreEditHistory
    const candidatePayload: JournalCandidate = {
      ...cand,
      createdAt: existing?.createdAt || cand.createdAt,
      scoreEditHistory: existing?.scoreEditHistory || cand.scoreEditHistory,
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(docRef, cleanUndefined(candidatePayload));
      writtenCount++;
    } catch (writeErr: any) {
      throw new JournalSyncStageError({
        stage: "WRITE_CANDIDATE",
        collectionName: "journalCandidates",
        documentId: cand.id,
        operationType: existing ? "update" : "create",
        originalError: writeErr,
        userSummary: `Không đủ quyền lưu ứng viên "${cand.name}" (ID: ${cand.journalId}, Trạng thái: ${cand.status}). Đã lưu thành công ${writtenCount}/${candidatesToCreate.length} bản ghi trước khi gặp lỗi.`,
        actorUid: user.uid,
        actorRole: user.email,
      });
    }
  }

  // 5. Write audit log entry in journalImports
  const now = new Date().toISOString();
  const batchId = `batch_gs_${Date.now()}`;
  try {
    const importLog = {
      batchId,
      fileName: `Google Sheets IFA-RH: ${effectiveSheetName} (${effectiveSheetId})`,
      totalParsed: sheetResult.totalRows,
      createdCount: newCount,
      updatedCount,
      skippedCount: skippedDuplicates,
      errorCount: sheetResult.warnings.length,
      errors: sheetResult.warnings.map((w: string) => ({ message: w })),
      importedAt: now,
      importedBy: user.email || user.uid,
      schemaVersion: 1,
      sheetId: effectiveSheetId,
      sheetName: effectiveSheetName,
      sourceType: "GOOGLE_SHEETS",
      createdAt: now,
    };
    const logRef = doc(firestore, "journalImports", batchId);
    await setDoc(logRef, cleanUndefined(importLog));
  } catch (importErr: any) {
    console.warn("Lỗi ghi nhật ký journalImports:", importErr);
    throw new JournalSyncStageError({
      stage: "WRITE_IMPORT_LOG",
      collectionName: "journalImports",
      documentId: batchId,
      operationType: "create",
      originalError: importErr,
      userSummary: `Không đủ quyền ghi lịch sử đồng bộ vào journalImports. (Lưu ý: ${writtenCount} ứng viên đã được đưa vào hàng chờ duyệt thành công).`,
      actorUid: user.uid,
      actorRole: user.email,
    });
  }

  // 6. Update sync settings in systemConfig/journal_sync
  try {
    await saveJournalSyncSettings({
      sheetId: effectiveSheetId,
      sheetName: effectiveSheetName,
      lastSyncedAt: now,
      lastSyncedBy: user.email || user.uid,
      lastStats: {
        totalRead: sheetResult.totalRows,
        validRows: sheetResult.validJournals.length,
        newCount,
        updatedCount,
        unchangedCount,
        skippedCount: skippedDuplicates,
        errorCount: sheetResult.warnings.length,
      },
    });
  } catch (configErr: any) {
    console.warn("Lỗi ghi cấu hình systemConfig/journal_sync:", configErr);
    throw new JournalSyncStageError({
      stage: "WRITE_CONFIG",
      collectionName: "systemConfig",
      documentId: "journal_sync",
      operationType: "update",
      originalError: configErr,
      userSummary: `Không đủ quyền cập nhật cấu hình đồng bộ trong systemConfig/journal_sync. (Lưu ý: ${writtenCount} ứng viên đã được đưa vào hàng chờ duyệt thành công).`,
      actorUid: user.uid,
      actorRole: user.email,
    });
  }

  return {
    success: true,
    totalRead: sheetResult.totalRows,
    newCandidatesCount: newCount,
    updatedCandidatesCount: updatedCount,
    unchangedCount,
    skippedDuplicates,
    manualReviewCount: sheetResult.manualReviewCount,
    warnings: sheetResult.warnings,
    writtenCount,
    batchId,
  };
}

/**
 * Multi-Council HDGSNN Score Sync Engine:
 * Reads the 53-column data from the single public IFA-RH Google Sheet (`1QJKvNd7s0eZpr8HiO_FYGi5HQF3sHhlqR6_G5SODXWE`, tab `TAP_CHI`),
 * processes only the multi-council score columns (`AV` to `BA`), performs strict journal identity reconciliation,
 * and queues score-update proposals into `journalCandidates` without overwriting non-score catalog fields.
 */
export async function syncMultiCouncilScoresFromGoogleSheetsToQueue({
  sheetId = DEFAULT_MULTI_COUNCIL_SPREADSHEET_ID,
  sheetName = DEFAULT_MULTI_COUNCIL_SHEET_NAME,
  user,
}: {
  sheetId?: string;
  sheetName?: string;
  user: { uid: string; email?: string };
}): Promise<{
  success: boolean;
  totalRead: number;
  newCandidatesCount: number;
  updatedCandidatesCount: number;
  unchangedCount: number;
  skippedDuplicates: number;
  manualReviewCount: number;
  warnings: string[];
  writtenCount: number;
  batchId?: string;
  sourceSpreadsheetId: string;
  sourceSheetName: string;
  usedFallbackCatalogSheet: boolean;
  multiCouncilStats: {
    rowsWithJson: number;
    totalCouncilEntries: number;
    multiCouncilJournalsCount: number;
    diffScoreAcrossCouncilsCount: number;
    reconciliationCounts: {
      HOAN_TAT: number;
      CAN_KIEM_TRA: number;
      CHUA_XAC_MINH: number;
    };
  };
  identityMatchStats: {
    matchedCount: number;
    ambiguousCount: number;
    unmatchedCount: number;
    conflictCount: number;
  };
}> {
  const effectiveSheetId = sanitizePublicJournalSpreadsheetId(sheetId);
  const effectiveSheetName = sanitizePublicJournalSheetName(sheetName);
  const currentSettings = await getJournalSyncSettings();
  const previousValidRowCount =
    currentSettings?.lastMultiCouncilStats?.validRows ||
    currentSettings?.lastStats?.validRows;

  // 1. Fetch 53-column multi-council rows from the single public IFA-RH Google Sheet
  let sheetResult: Awaited<ReturnType<typeof fetchMultiCouncilGoogleSheetRows>>;
  try {
    sheetResult = await fetchMultiCouncilGoogleSheetRows(
      effectiveSheetId,
      effectiveSheetName,
      { previousValidRowCount }
    );
    if (!sheetResult || !Array.isArray(sheetResult.validJournals)) {
      throw new Error("Không có dữ liệu điểm HĐGSNN hợp lệ trả về từ Google Sheets IFA-RH.");
    }
  } catch (sheetErr: any) {
    throw new JournalSyncStageError({
      stage: "FETCH_SHEET",
      collectionName: "google_sheets",
      operationType: "get",
      originalError: sheetErr,
      userSummary: `Lỗi kết nối hoặc đọc bảng điểm HĐGSNN trên Google Sheets IFA-RH (${effectiveSheetName}): ${sheetErr.message || "Không thể đọc dữ liệu"}`,
      actorUid: user.uid,
      actorRole: user.email,
    });
  }

  // 2. Fetch existing journals and active candidates
  let existingJournals: Journal[] = [];
  try {
    existingJournals = await fetchJournals({ includeHidden: true });
  } catch (jErr: any) {
    throw new JournalSyncStageError({
      stage: "READ_JOURNALS",
      collectionName: "journals",
      operationType: "list",
      originalError: jErr,
      userSummary: "Không đủ quyền đọc danh mục tạp chí đã công bố",
      actorUid: user.uid,
      actorRole: user.email,
    });
  }

  let existingCandidates: JournalCandidate[] = [];
  try {
    const colRef = collection(firestore, "journalCandidates");
    const q = query(colRef, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    snap.forEach((d) => {
      existingCandidates.push({ ...(d.data() as any), id: d.id });
    });
  } catch (cErr: any) {
    throw new JournalSyncStageError({
      stage: "READ_CANDIDATES",
      collectionName: "journalCandidates",
      operationType: "list",
      originalError: cErr,
      userSummary: "Không đủ quyền đọc danh sách ứng viên trong hàng chờ duyệt",
      actorUid: user.uid,
      actorRole: user.email,
    });
  }

  // 3. Build candidate diffs with strict identity reconciliation and score-only update mode
  let diffResult: ReturnType<typeof buildJournalCandidatesFromSheet>;
  try {
    diffResult = buildJournalCandidatesFromSheet(
      sheetResult.validJournals,
      existingJournals,
      existingCandidates,
      {
        forceUpdateMultiCouncil: true,
        onlyMultiCouncilScoreColumns: true,
      }
    );
  } catch (diffErr: any) {
    throw new JournalSyncStageError({
      stage: "DIFF_ANALYSIS",
      collectionName: "in_memory",
      operationType: "get",
      originalError: diffErr,
      userSummary: "Lỗi trong quá trình phân tích điểm HĐGSNN và đối soát định danh tạp chí",
      actorUid: user.uid,
      actorRole: user.email,
    });
  }

  const {
    candidatesToCreate,
    newCount,
    updatedCount,
    unchangedCount,
    skippedDuplicates,
    identityMatchStats,
  } = diffResult;

  // 4. Write candidates to Firestore
  let writtenCount = 0;
  const existingMap = new Map(existingCandidates.map((c) => [c.id, c]));

  for (const cand of candidatesToCreate) {
    const docRef = doc(firestore, "journalCandidates", cand.id);
    const existing = existingMap.get(cand.id);

    const candidatePayload: JournalCandidate = {
      ...cand,
      createdAt: existing?.createdAt || cand.createdAt,
      scoreEditHistory: existing?.scoreEditHistory || cand.scoreEditHistory,
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(docRef, cleanUndefined(candidatePayload));
      writtenCount++;
    } catch (writeErr: any) {
      throw new JournalSyncStageError({
        stage: "WRITE_CANDIDATE",
        collectionName: "journalCandidates",
        documentId: cand.id,
        operationType: existing ? "update" : "create",
        originalError: writeErr,
        userSummary: `Không đủ quyền lưu ứng viên điểm HĐGSNN "${cand.name}" (ID: ${cand.journalId}). Đã lưu ${writtenCount}/${candidatesToCreate.length} bản ghi.`,
        actorUid: user.uid,
        actorRole: user.email,
      });
    }
  }

  // 5. Write audit log entry in journalImports
  const now = new Date().toISOString();
  const batchId = `batch_hdgsnn_${Date.now()}`;
  try {
    const importLog = {
      batchId,
      fileName: `HDGSNN Multi-Council: ${sheetResult.sourceSheetName} (${sheetResult.sourceSpreadsheetId})`,
      totalParsed: sheetResult.totalRows,
      createdCount: newCount,
      updatedCount,
      skippedCount: skippedDuplicates,
      errorCount: sheetResult.warnings.length,
      errors: sheetResult.warnings.slice(0, 100).map((w: string) => ({ message: w })),
      importedAt: now,
      importedBy: user.email || user.uid,
      schemaVersion: 2,
      sheetId: sheetResult.sourceSpreadsheetId,
      sheetName: sheetResult.sourceSheetName,
      sourceType: "GOOGLE_SHEETS_HDGSNN",
      createdAt: now,
    };
    const logRef = doc(firestore, "journalImports", batchId);
    await setDoc(logRef, cleanUndefined(importLog));
  } catch (importErr: any) {
    console.warn("Lỗi ghi nhật ký journalImports (HDGSNN):", importErr);
    throw new JournalSyncStageError({
      stage: "WRITE_IMPORT_LOG",
      collectionName: "journalImports",
      documentId: batchId,
      operationType: "create",
      originalError: importErr,
      userSummary: `Không đủ quyền ghi lịch sử cập nhật điểm HĐGSNN vào journalImports. (Lưu ý: ${writtenCount} ứng viên đã được đưa vào hàng chờ duyệt thành công).`,
      actorUid: user.uid,
      actorRole: user.email,
    });
  }

  // 6. Update sync settings in systemConfig/journal_sync
  try {
    await saveJournalSyncSettings({
      multiCouncilSheetId: effectiveSheetId,
      multiCouncilSheetName: effectiveSheetName,
      lastMultiCouncilSyncedAt: now,
      lastMultiCouncilSyncedBy: user.email || user.uid,
      lastMultiCouncilStats: {
        totalRead: sheetResult.totalRows,
        validRows: sheetResult.validJournals.length,
        matchedCount: identityMatchStats.matchedCount,
        ambiguousCount: identityMatchStats.ambiguousCount,
        unmatchedCount: identityMatchStats.unmatchedCount,
        conflictCount: identityMatchStats.conflictCount,
        newCouncilRecordsCount: sheetResult.multiCouncilStats.totalCouncilEntries,
        updatedCouncilRecordsCount: updatedCount,
        needsReviewCount: sheetResult.manualReviewCount,
      },
    });
  } catch (configErr: any) {
    console.warn("Lỗi ghi cấu hình systemConfig/journal_sync (HDGSNN):", configErr);
    throw new JournalSyncStageError({
      stage: "WRITE_CONFIG",
      collectionName: "systemConfig",
      documentId: "journal_sync",
      operationType: "update",
      originalError: configErr,
      userSummary: `Không đủ quyền cập nhật cấu hình đồng bộ HĐGSNN trong systemConfig/journal_sync.`,
      actorUid: user.uid,
      actorRole: user.email,
    });
  }

  return {
    success: true,
    totalRead: sheetResult.totalRows,
    newCandidatesCount: newCount,
    updatedCandidatesCount: updatedCount,
    unchangedCount,
    skippedDuplicates,
    manualReviewCount: sheetResult.manualReviewCount,
    warnings: sheetResult.warnings,
    writtenCount,
    batchId,
    sourceSpreadsheetId: sheetResult.sourceSpreadsheetId,
    sourceSheetName: sheetResult.sourceSheetName,
    usedFallbackCatalogSheet: sheetResult.usedFallbackCatalogSheet,
    multiCouncilStats: sheetResult.multiCouncilStats,
    identityMatchStats,
  };
}

/**
 * Save candidate draft in the Admin Review Queue:
 * - Saves edited council scores or metadata on the candidate document
 * - Appends an audit log entry to `scoreEditHistory`
 * - Does NOT publish to `journals`
 * - Does NOT automatically clear `CAN_KIEM_TRA` or mark as approved
 */
export async function saveJournalCandidateDraft(
  candidateId: string,
  updates: Partial<JournalCandidate>,
  user: { uid: string; email?: string },
  editReason?: string
): Promise<void> {
  const candRef = doc(firestore, "journalCandidates", candidateId);
  const candSnap = await getDoc(candRef);
  if (!candSnap.exists()) {
    throw new Error("Không tìm thấy bản ghi chờ duyệt: " + candidateId);
  }

  const existing = candSnap.data() as JournalCandidate;
  const now = new Date().toISOString();
  const actor = user.email || user.uid;

  const nextCouncilScores = updates.councilScores ?? existing.councilScores ?? [];
  const uniqueVerifiedCouncils = Array.from(
    new Set(
      nextCouncilScores
        .filter((cs) => cs.verificationStatus === "VERIFIED")
        .map((cs) => cs.councilName)
    )
  );
  const uniqueAllCouncils = Array.from(
    new Set(nextCouncilScores.map((cs) => cs.councilId || cs.councilName))
  );

  // Compute max verified score across councils if councilScores were edited
  const numericScores = nextCouncilScores
    .filter((cs) => cs.verificationStatus === "VERIFIED" && typeof cs.maxScore === "number")
    .map((cs) => cs.maxScore as number);
  const computedMaxScore =
    updates.maxScore !== undefined
      ? updates.maxScore
      : numericScores.length > 0
      ? Math.max(...numericScores)
      : existing.maxScore;

  const logEntry: JournalScoreEditLog = {
    editedAt: now,
    editedBy: actor,
    actionType: "draft_save",
    reason: editReason?.trim() || "Lưu nháp chỉnh sửa thông tin / điểm Hội đồng",
    summary: `Lưu nháp (${nextCouncilScores.length} bản ghi điểm thuộc ${uniqueAllCouncils.length} Hội đồng)`,
  };

  const nextHistory = [...(existing.scoreEditHistory || []), logEntry];

  const payload: Partial<JournalCandidate> = {
    ...updates,
    councilScores: nextCouncilScores,
    recognizedCouncilCount: updates.recognizedCouncilCount ?? uniqueAllCouncils.length,
    verifiedCouncils: updates.verifiedCouncils ?? uniqueVerifiedCouncils,
    maxScore: computedMaxScore,
    // Keep status in pending / needs_review (do not auto-approve on draft save)
    status:
      updates.status && (updates.status === "pending" || updates.status === "needs_review")
        ? updates.status
        : existing.status === "approved" || existing.status === "rejected"
        ? "needs_review"
        : existing.status,
    // Preserve CAN_KIEM_TRA on draft save unless explicitly overridden
    scoreReconciliationStatus:
      updates.scoreReconciliationStatus ?? existing.scoreReconciliationStatus,
    draftSavedAt: now,
    draftSavedBy: actor,
    scoreEditHistory: nextHistory,
    updatedAt: now,
  };

  await updateDoc(candRef, cleanUndefined(payload));
}

/**
 * Approve candidate: Publishes to public `journals` and marks candidate as approved.
 * Supports optional inline overrides from the Admin Review Modal so Admin can edit & approve in one step.
 */
export async function approveJournalCandidate(
  candidateId: string,
  user: { uid: string; email?: string },
  options?: {
    overrideManual?: boolean;
    candidateOverrides?: Partial<JournalCandidate>;
    editReason?: string;
    replaceCouncilScoresExact?: boolean;
  }
): Promise<void> {
  const candRef = doc(firestore, "journalCandidates", candidateId);
  const candSnap = await getDoc(candRef);
  if (!candSnap.exists()) {
    throw new Error("Không tìm thấy bản ghi chờ duyệt: " + candidateId);
  }

  const rawCand = candSnap.data() as JournalCandidate;
  const cand: JournalCandidate = options?.candidateOverrides
    ? { ...rawCand, ...options.candidateOverrides }
    : rawCand;

  const now = new Date().toISOString();
  const reviewer = user.email || user.uid;

  // Normalize councilScores summary fields before publishing
  const candCouncilScores = cand.councilScores || [];
  const allCouncilsSet = new Set(
    candCouncilScores.map((cs) => cs.councilId || cs.councilName)
  );
  const verifiedCouncilNames = Array.from(
    new Set(
      candCouncilScores
        .filter((cs) => cs.verificationStatus === "VERIFIED")
        .map((cs) => cs.councilName)
    )
  );
  const verifiedNumericScores = candCouncilScores
    .filter((cs) => cs.verificationStatus === "VERIFIED" && typeof cs.maxScore === "number")
    .map((cs) => cs.maxScore as number);
  const effectiveCandMaxScore =
    verifiedNumericScores.length > 0
      ? Math.max(...verifiedNumericScores)
      : cand.maxScore;

  const publishLogEntry: JournalScoreEditLog = {
    editedAt: now,
    editedBy: reviewer,
    actionType: "approve_publish",
    reason: options?.editReason?.trim() || "Admin phê duyệt và công bố dữ liệu tạp chí / điểm HĐGSNN",
    summary: `Phê duyệt công bố (${candCouncilScores.length} bản ghi điểm thuộc ${allCouncilsSet.size} Hội đồng)`,
  };
  const nextEditHistory = [...(cand.scoreEditHistory || []), publishLogEntry];

  if (cand.changeType === "create") {
    // A. Create new journal document
    const journalData: Omit<Journal, "id" | "createdAt" | "updatedAt"> = {
      journalId: cand.journalId,
      name: cand.name,
      englishName: cand.englishName,
      abbreviation: cand.abbreviation,
      publisher: cand.publisher,
      issnPrint: cand.issnPrint,
      issnOnline: cand.issnOnline,
      isbn: cand.isbn,
      category: cand.category,
      primaryField: cand.primaryField,
      fields: cand.fields,
      website: cand.website,
      websiteVerified: cand.websiteVerified,
      maxScore: effectiveCandMaxScore,
      maxScoreYear: cand.maxScoreYear,
      scores: cand.scores,
      councilScores: candCouncilScores,
      recognizedCouncilCount: allCouncilsSet.size || cand.recognizedCouncilCount || 0,
      verifiedCouncils:
        verifiedCouncilNames.length > 0 ? verifiedCouncilNames : cand.verifiedCouncils || [],
      decisionYear: cand.decisionYear || cand.maxScoreYear,
      scoreReconciliationStatus: "HOAN_TAT",
      scoreSourceNote: cand.scoreSourceNote,
      scoreEditHistory: nextEditHistory,
      guidelines: cand.guidelines,
      links: cand.links,
      verification: cand.verification
        ? { ...cand.verification, manualReviewNeeded: false }
        : undefined,
      status: "active",
      isManualEdited: Boolean(options?.candidateOverrides),
      createdBy: reviewer,
    };

    await createJournal(journalData, user);
  } else {
    // B. Update existing journal document
    const existingDocId = cand.existingJournalId || cand.journalId;
    const existingRef = doc(firestore, "journals", existingDocId);
    const existingSnap = await getDoc(existingRef);

    if (existingSnap.exists()) {
      const existing = existingSnap.data() as Journal;

      // Merge legacy scores without overwriting older history
      const mergedScores = [...(existing.scores || [])];
      (cand.scores || []).forEach((newScore) => {
        const idx = mergedScores.findIndex(
          (s) =>
            s.councilCode === newScore.councilCode &&
            s.year === newScore.year &&
            s.decisionNumber === newScore.decisionNumber
        );
        if (idx >= 0) {
          mergedScores[idx] = newScore;
        } else {
          mergedScores.push(newScore);
        }
      });

      // Merge multi-council scores by composite key (or use exact list if Admin edited in modal)
      const mergedCouncilScores = options?.replaceCouncilScoresExact
        ? candCouncilScores
        : mergeCouncilScoresList(existing.councilScores || [], candCouncilScores);

      const mergedAllCouncils = new Set(
        mergedCouncilScores.map((cs) => cs.councilId || cs.councilName)
      );
      const mergedVerifiedCouncils = Array.from(
        new Set(
          mergedCouncilScores
            .filter((cs) => cs.verificationStatus === "VERIFIED")
            .map((cs) => cs.councilName)
        )
      );
      const mergedVerifiedNumeric = mergedCouncilScores
        .filter((cs) => cs.verificationStatus === "VERIFIED" && typeof cs.maxScore === "number")
        .map((cs) => cs.maxScore as number);

      const mergedMaxScore =
        mergedVerifiedNumeric.length > 0
          ? Math.max(...mergedVerifiedNumeric)
          : Math.max(effectiveCandMaxScore, existing.maxScore || 0);

      const mergedEditHistory = [
        ...(existing.scoreEditHistory || []),
        ...nextEditHistory,
      ];

      // Prepare updates
      const updates: Partial<Journal> = {
        name: existing.isManualEdited && !options?.overrideManual ? existing.name : cand.name,
        englishName: cand.englishName || existing.englishName,
        abbreviation: cand.abbreviation || existing.abbreviation,
        publisher: existing.isManualEdited && !options?.overrideManual ? existing.publisher : cand.publisher,
        issnPrint: cand.issnPrint || existing.issnPrint,
        issnOnline: cand.issnOnline || existing.issnOnline,
        isbn: cand.isbn || existing.isbn,
        primaryField: existing.isManualEdited && !options?.overrideManual ? existing.primaryField : cand.primaryField,
        fields: Array.from(new Set([...(existing.fields || []), ...(cand.fields || [])])),
        website: cand.website || existing.website,
        websiteVerified: cand.websiteVerified || existing.websiteVerified,
        maxScore: mergedMaxScore,
        maxScoreYear: cand.maxScoreYear || existing.maxScoreYear,
        scores: mergedScores,
        councilScores: mergedCouncilScores,
        recognizedCouncilCount: mergedAllCouncils.size,
        verifiedCouncils: mergedVerifiedCouncils,
        decisionYear: cand.decisionYear || existing.decisionYear || cand.maxScoreYear,
        scoreReconciliationStatus: "HOAN_TAT",
        scoreSourceNote: cand.scoreSourceNote || existing.scoreSourceNote,
        scoreEditHistory: mergedEditHistory,
        guidelines: cand.guidelines || existing.guidelines,
        verification: cand.verification
          ? { ...cand.verification, manualReviewNeeded: false }
          : existing.verification,
      };

      await updateJournal(existingDocId, updates, user);
    } else {
      // Fallback if existingDocId no longer exists: create it
      const journalData: Omit<Journal, "id" | "createdAt" | "updatedAt"> = {
        journalId: cand.journalId,
        name: cand.name,
        englishName: cand.englishName,
        abbreviation: cand.abbreviation,
        publisher: cand.publisher,
        issnPrint: cand.issnPrint,
        issnOnline: cand.issnOnline,
        isbn: cand.isbn,
        category: cand.category,
        primaryField: cand.primaryField,
        fields: cand.fields,
        website: cand.website,
        websiteVerified: cand.websiteVerified,
        maxScore: effectiveCandMaxScore,
        maxScoreYear: cand.maxScoreYear,
        scores: cand.scores,
        councilScores: candCouncilScores,
        recognizedCouncilCount: allCouncilsSet.size || cand.recognizedCouncilCount || 0,
        verifiedCouncils:
          verifiedCouncilNames.length > 0 ? verifiedCouncilNames : cand.verifiedCouncils || [],
        decisionYear: cand.decisionYear || cand.maxScoreYear,
        scoreReconciliationStatus: "HOAN_TAT",
        scoreSourceNote: cand.scoreSourceNote,
        scoreEditHistory: nextEditHistory,
        guidelines: cand.guidelines,
        links: cand.links,
        verification: cand.verification
          ? { ...cand.verification, manualReviewNeeded: false }
          : undefined,
        status: "active",
        isManualEdited: Boolean(options?.candidateOverrides),
        createdBy: reviewer,
      };
      await createJournal(journalData, user);
    }
  }

  // Mark candidate as approved and persist any inline overrides
  await updateDoc(
    candRef,
    cleanUndefined({
      ...(options?.candidateOverrides || {}),
      councilScores: candCouncilScores,
      recognizedCouncilCount: allCouncilsSet.size || cand.recognizedCouncilCount || 0,
      verifiedCouncils:
        verifiedCouncilNames.length > 0 ? verifiedCouncilNames : cand.verifiedCouncils || [],
      maxScore: effectiveCandMaxScore,
      scoreReconciliationStatus: "HOAN_TAT",
      scoreEditHistory: nextEditHistory,
      status: "approved",
      reviewedAt: now,
      reviewedBy: reviewer,
      publishedJournalId: cand.existingJournalId || cand.journalId,
      updatedAt: now,
    })
  );
}

/**
 * Bulk approve multiple candidates.
 */
export async function bulkApproveJournalCandidates(
  candidateIds: string[],
  user: { uid: string; email?: string }
): Promise<{ successCount: number; errorCount: number; skippedWarningCount: number }> {
  let successCount = 0;
  let errorCount = 0;
  let skippedWarningCount = 0;

  for (const id of candidateIds) {
    try {
      const candRef = doc(firestore, "journalCandidates", id);
      const candSnap = await getDoc(candRef);
      if (candSnap.exists()) {
        const cand = candSnap.data() as JournalCandidate;
        // Enforce rule: candidates with verification warning, CAN_KIEM_TRA, or identity ambiguity cannot be bulk approved
        const hasWarning =
          cand.status === "needs_review" ||
          cand.scoreReconciliationStatus === "CAN_KIEM_TRA" ||
          cand.identityMatchStatus === "AMBIGUOUS" ||
          cand.identityMatchStatus === "CONFLICT" ||
          cand.verification?.manualReviewNeeded === true ||
          cand.unverifiedFields?.some((f) => f.includes("Cần kiểm tra thủ công"));

        if (hasWarning) {
          skippedWarningCount++;
          continue;
        }
      }

      await approveJournalCandidate(id, user);
      successCount++;
    } catch (err) {
      console.error(`Error approving candidate ${id}:`, err);
      errorCount++;
    }
  }

  return { successCount, errorCount, skippedWarningCount };
}


/**
 * Reject candidate with reason.
 */
export async function rejectJournalCandidate(
  candidateId: string,
  rejectionReason: string,
  user: { uid: string; email?: string }
): Promise<void> {
  const candRef = doc(firestore, "journalCandidates", candidateId);
  const now = new Date().toISOString();

  await updateDoc(candRef, {
    status: "rejected",
    rejectionReason: rejectionReason.trim() || "Chưa phù hợp tiêu chí",
    reviewedAt: now,
    reviewedBy: user.email || user.uid,
    updatedAt: now,
  });
}

/**
 * Mark candidate as needs_review.
 */
export async function markJournalCandidateNeedsReview(
  candidateId: string,
  user: { uid: string; email?: string }
): Promise<void> {
  const candRef = doc(firestore, "journalCandidates", candidateId);
  const now = new Date().toISOString();

  await updateDoc(candRef, {
    status: "needs_review",
    updatedAt: now,
    reviewedBy: user.email || user.uid,
  });
}

/**
 * Delete candidate.
 */
export async function deleteJournalCandidate(candidateId: string): Promise<void> {
  const candRef = doc(firestore, "journalCandidates", candidateId);
  await deleteDoc(candRef);
}
