import {
  fetchFacultyResearchSheetRows,
  DEFAULT_RESEARCH_SHEET_ID,
  DEFAULT_RESEARCH_SHEET_NAME,
} from "./researchSheetService";
import {
  fetchLatestConferencesFromDrive,
  mapJsonConferenceToRawRow,
  acquireFirestoreSyncLock,
  releaseFirestoreSyncLock,
  ResearchDriveJsonError,
  RESEARCH_SYNC_LOCK_TTL_MS,
  RESEARCH_SYNC_LOCK_DOC_ID,
} from "./researchDriveJsonService";
import {
  findMatchingResearchOpportunity,
  isEditedByAdmin,
  computeOpportunityDiff,
  classifyOutOfScopeRecord,
  ResearchMatchTarget,
} from "../utils/researchDedupe";
import { normalizeText } from "../utils/dedupe";
import { mapRowToCandidate } from "./facultyResearchData";
import type { RawFacultyResearchRow } from "./facultyResearchData";
import type { OpportunityCandidate, Opportunity } from "../types";

export interface ResearchSyncStats {
  read: number;
  valid: number;
  created: number;
  matched: number;
  unchanged: number;
  updated: number;
  updateProposals: number;
  preservedAdmin: number;
  outOfScope: number;
  duplicates: number;
  successWrites: number;
  errorCount: number;
}

export interface ResearchSyncDiagnosticItem {
  row: number;
  stt: number | string;
  title: string;
  status:
    | "created"
    | "matched"
    | "updated"
    | "update_proposal"
    | "proposal_unchanged"
    | "preserved_admin"
    | "preserved_rejection"
    | "out_of_scope"
    | "skipped"
    | "invalid";
  action: string;
  reason: string;
  targetId?: string;
}

export type SyncStage =
  | "READ_CONFIG"
  | "CLAIM_LOCK"
  | "LOCK_EXPIRED"
  | "LOCK_LOST"
  | "FETCH_SHEET"
  | "READ_CANDIDATES"
  | "WRITE_NEW_CANDIDATE"
  | "WRITE_UPDATE_CANDIDATE"
  | "UPDATE_CANDIDATE"
  | "UPDATE_OPPORTUNITY"
  | "UPDATE_SYNC_STATE"
  | "WRITE_IMPORT_HISTORY";

export class ResearchSyncStageError extends Error {
  stage: SyncStage;
  collectionName: string;
  documentId?: string;
  operationType: "get" | "list" | "create" | "update" | "delete";
  originalError?: any;
  userSummary: string;
  actorUid?: string;
  actorRole?: string;

  constructor(params: {
    stage: SyncStage;
    collectionName: string;
    documentId?: string;
    operationType: "get" | "list" | "create" | "update" | "delete";
    originalError?: any;
    userSummary?: string;
    actorUid?: string;
    actorRole?: string;
  }) {
    const code = params.originalError?.code || "permission-denied";
    const baseMsg = params.originalError?.message || String(params.originalError);
    const friendlyMsg = `Lỗi tại bước ${params.stage} — Không đủ quyền thao tác trên ${params.collectionName}${
      params.documentId ? `/${params.documentId}` : ""
    } (${params.operationType}) — [${code}]: ${params.userSummary || baseMsg}`;
    super(friendlyMsg);
    this.name = "ResearchSyncStageError";
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

export interface ResearchSyncOutcome {
  skipped: boolean;
  reason?: string;
  status?: "success" | "partial_success" | "failed";
  stats?: ResearchSyncStats;
  diagnostics?: ResearchSyncDiagnosticItem[];
  durationMs?: number;
  driveMeta?: {
    fileId: string;
    fileName: string;
    revision: number;
    generatedAt?: string;
    runId?: string;
    isCached?: boolean;
  };
  items?: Array<{
    code: string;
    category: "TN" | "QT";
    title: string;
    organizer: string;
    status: ResearchSyncDiagnosticItem["status"];
    action: string;
    reason: string;
    targetId?: string;
    changedKeys?: string[];
    diffSummary?: any[];
    row: RawFacultyResearchRow;
    candidate: OpportunityCandidate;
  }>;
}

export interface ResearchSyncSdk {
  doc: (db: any, col: string, id: string) => any;
  getDoc: (ref: any) => Promise<any>;
  setDoc: (ref: any, data: any, options?: any) => Promise<any>;
  updateDoc: (ref: any, data: any) => Promise<any>;
  collection: (db: any, path: string) => any;
  getDocs: (query: any) => Promise<any>;
  addDoc: (col: any, data: any) => Promise<any>;
  serverTimestamp: () => any;
  runTransaction?: <T>(db: any, updateFunction: (transaction: any) => Promise<T>) => Promise<T>;
}

/**
 * Recursively removes keys with undefined values so Firestore does not reject writes.
 */
export function cleanUndefined<T = any>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanUndefined(item)) as unknown as T;
  }
  const result: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      result[k] = typeof v === "object" && v !== null && !(v instanceof Date) ? cleanUndefined(v) : v;
    }
  }
  return result as T;
}

/**
 * Core engine for weekly automated and manual research data sync.
 * Fully compatible with both Browser Client SDK and Node.js Admin SDK.
 */
export async function executeResearchSync({
  db,
  sdk,
  user,
  options = {},
}: {
  db: any;
  sdk: ResearchSyncSdk;
  user: { uid: string; email: string; role?: string };
  options?: {
    manual?: boolean;
    force?: boolean;
    dryRun?: boolean;
    expectedRevision?: number;
    runSource?: "github_schedule" | "github_dispatch" | "manual_admin" | "manual_cli";
    sheetConfig?: { sheetId?: string; sheetName?: string };
    dataSource?: "drive_json" | "sheets";
    driveConfig?: { folderId?: string; fileName?: string };
  };
}): Promise<ResearchSyncOutcome> {
  const startTime = Date.now();
  const runSource = options.runSource || (options.manual ? "manual_admin" : "github_schedule");
  const isDryRun = Boolean(options.dryRun);

  const stateRef = sdk.doc(db, "systemConfig", "facultyResearchSync");
  const lockId = crypto.randomUUID();
  let acquiredLockId: string | undefined = undefined;

  // 1. Concurrency guard & Lock Check
  if (!isDryRun) {
    const lockResult = await acquireFirestoreSyncLock(db, sdk, user);
    if (!lockResult.acquired) {
      return {
        skipped: true,
        reason: lockResult.message || "Một phiên đồng bộ khác đang chạy. Vui lòng thử lại sau.",
      };
    }
    acquiredLockId = lockResult.lockId;
  }

  try {
    if (!isDryRun) {
      // 1b. Check existing facultyResearchSync state to support running sessions
      let stateSnap: any = null;
      try {
        stateSnap = await sdk.getDoc(stateRef);
      } catch (readConfigErr: any) {
        throw new ResearchSyncStageError({
          stage: "READ_CONFIG",
          collectionName: "systemConfig",
          documentId: "facultyResearchSync",
          operationType: "get",
          originalError: readConfigErr,
          userSummary: "Không thể đọc cấu hình trạng thái đồng bộ hiện tại",
          actorUid: user.uid,
          actorRole: user.role,
        });
      }

      if (stateSnap?.exists && (typeof stateSnap.exists === "function" ? stateSnap.exists() : true)) {
        const state = typeof stateSnap.data === "function" ? stateSnap.data() : stateSnap;
        if (state) {
          const inProgress = Boolean(state.syncInProgress);
          const startedAtTime = state.syncStartedAtMs || (state.syncStartedAt ? new Date(state.syncStartedAt).getTime() : 0);
          const isFreshLock = inProgress && Date.now() - startedAtTime < RESEARCH_SYNC_LOCK_TTL_MS;

          if (isFreshLock) {
            return {
              skipped: true,
              reason: "Một phiên đồng bộ khác đang chạy. Vui lòng thử lại sau.",
            };
          }
        }
      }

      // Claim lock state in systemConfig/facultyResearchSync
      try {
        await sdk.setDoc(
          stateRef,
          {
            syncInProgress: true,
            lockId,
            syncStartedAt: new Date().toISOString(),
            syncStartedAtMs: startTime,
            syncStartedBy: user.email || "system",
            lastSyncStatus: "running",
            lastSyncSource: runSource,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (lockWriteErr: any) {
        console.warn("Cảnh báo: Không thể ghi lock đồng bộ vào systemConfig:", lockWriteErr);
        if (lockWriteErr?.code === "permission-denied" || String(lockWriteErr?.message || "").includes("permission")) {
          throw new ResearchSyncStageError({
            stage: "CLAIM_LOCK",
            collectionName: "systemConfig",
            documentId: "facultyResearchSync",
            operationType: "update",
            originalError: lockWriteErr,
            userSummary: "Không đủ quyền ghi nhận khóa phiên đồng bộ vào systemConfig",
            actorUid: user.uid,
            actorRole: user.role,
          });
        }
      }
    }

    // 2. Fetch rows: Google Drive JSON (default when dataSource === 'drive_json' or driveConfig provided) or Google Sheets
    let rows: any[] = [];
    let driveMeta: any = null;
    const isDriveSource = options.dataSource === "drive_json" || Boolean(options.driveConfig);
    const sourceLabel = isDriveSource ? "Google Drive JSON" : "Google Sheets";

    if (isDriveSource) {
      try {
        const driveResult = await fetchLatestConferencesFromDrive({
          folderId: options.driveConfig?.folderId,
          fileName: options.driveConfig?.fileName,
        });

        // Untrusted source guard: cached data can only be previewed, NEVER written to Firestore
        if (driveResult.isCached && !isDryRun) {
          throw new ResearchDriveJsonError(
            "Không thể thực hiện ghi đồng bộ Firestore khi dữ liệu hội thảo đang ở trạng thái cached fallback. Cần kết nối trực tiếp với file chính thức trên Google Drive.",
            "CACHED_SOURCE_WRITE_FORBIDDEN",
            403
          );
        }

        // Revision freshness guard: prevent executing against a stale preview
        if (options.expectedRevision !== undefined && driveResult.revision !== options.expectedRevision) {
          throw new ResearchDriveJsonError(
            `Revision của file JSON trên Google Drive (${driveResult.revision}) không khớp với phiên bản đã xem trước (${options.expectedRevision}). Vui lòng tải lại xem trước trước khi đồng bộ.`,
            "REVISION_MISMATCH",
            409
          );
        }

        driveMeta = {
          fileId: driveResult.fileId,
          fileName: driveResult.fileName,
          revision: driveResult.revision,
          generatedAt: driveResult.payload.generatedAt,
          runId: driveResult.payload.runId,
          isCached: driveResult.isCached,
        };
        rows = driveResult.payload.conferences.map((c, idx) =>
          mapJsonConferenceToRawRow(c, idx, driveResult.payload.runId)
        );
        if (rows.length === 0) {
          throw new Error("Không có hội thảo nào trong file Google Drive JSON.");
        }
      } catch (driveErr: any) {
        throw new ResearchSyncStageError({
          stage: "FETCH_SHEET",
          collectionName: "google_drive_json",
          operationType: "get",
          originalError: driveErr,
          userSummary: `Lỗi kết nối hoặc đọc Google Drive JSON: ${driveErr.message}`,
          actorUid: user.uid,
          actorRole: user.role,
        });
      }
    } else {
      try {
        rows = await fetchFacultyResearchSheetRows(options.sheetConfig);
        if (!Array.isArray(rows) || rows.length === 0) {
          throw new Error("Không có dữ liệu trả về từ Google Sheets IFA Faculty Research.");
        }
      } catch (sheetErr: any) {
        throw new ResearchSyncStageError({
          stage: "FETCH_SHEET",
          collectionName: "google_sheets",
          operationType: "get",
          originalError: sheetErr,
          userSummary: "Lỗi kết nối hoặc đọc Google Sheets IFA Faculty Research",
          actorUid: user.uid,
          actorRole: user.role,
        });
      }
    }

    // 3. Fetch existing Firestore records
    let candsSnap: any;
    let oppsSnap: any;
    try {
      [candsSnap, oppsSnap] = await Promise.all([
        sdk.getDocs(sdk.collection(db, "opportunityCandidates")),
        sdk.getDocs(sdk.collection(db, "opportunities")),
      ]);
    } catch (readDocsErr: any) {
      throw new ResearchSyncStageError({
        stage: "READ_CANDIDATES",
        collectionName: "opportunityCandidates / opportunities",
        operationType: "list",
        originalError: readDocsErr,
        userSummary: "Không đủ quyền đọc danh sách ứng viên AI hoặc cơ hội NCKH đã công bố",
        actorUid: user.uid,
        actorRole: user.role,
      });
    }

    const candidates: OpportunityCandidate[] = (candsSnap?.docs || []).map((d: any) => ({
      ...(typeof d.data === "function" ? d.data() : d),
      id: d.id,
    }));

    const opportunities: Opportunity[] = (oppsSnap?.docs || []).map((d: any) => ({
      ...(typeof d.data === "function" ? d.data() : d),
      id: d.id,
    }));

    // Build unified target list for matching
    const combinedTargets: ResearchMatchTarget[] = [
      ...opportunities.map((o) => ({ ...o, _targetType: "opportunity" as const })),
      ...candidates.map((c) => ({ ...c, _targetType: "candidate" as const })),
    ];

    const stats: ResearchSyncStats = {
      read: rows.length,
      valid: 0,
      created: 0,
      matched: 0,
      unchanged: 0,
      updated: 0,
      updateProposals: 0,
      preservedAdmin: 0,
      outOfScope: 0,
      duplicates: 0,
      successWrites: 0,
      errorCount: 0,
    };

    const diagnostics: ResearchSyncDiagnosticItem[] = [];
    const syncItems: NonNullable<ResearchSyncOutcome["items"]> = [];
    const seenMatchedIds = new Set<string>();

    const recordSyncItem = (
      row: RawFacultyResearchRow,
      index: number,
      diagItem: ResearchSyncDiagnosticItem,
      diff?: { changedKeys?: string[]; diffSummary?: any[] }
    ) => {
      diagnostics.push(diagItem);
      const code = (row as any).conferenceCode || (diagItem.stt ? `ROW_${diagItem.stt}` : "");
      const category = (row as any).category || (code.startsWith("QT") ? "QT" : "TN");
      syncItems.push({
        code,
        category,
        title: row.title || diagItem.title,
        organizer: row.organizer || "",
        status: diagItem.status,
        action: diagItem.action,
        reason: diagItem.reason,
        targetId: diagItem.targetId,
        changedKeys: diff?.changedKeys,
        diffSummary: diff?.diffSummary,
        row,
        candidate: mapRowToCandidate(row, index),
      });
    };

    // Reconcile existing out-of-scope candidates in opportunityCandidates
    for (const cand of candidates) {
      if (cand.isOutOfScope !== true) {
        const cls = classifyOutOfScopeRecord(cand);
        if (cls.isOutOfScope) {
          stats.outOfScope++;
          if (!isDryRun) {
            try {
              const candRef = sdk.doc(db, "opportunityCandidates", cand.id);
              const updates: any = {
                isOutOfScope: true,
                outOfScopeReason: cls.reason,
                updatedAt: new Date().toISOString(),
                updatedBy: "SPARK_SYNC",
              };
              if (cls.classifiedType && cand.type !== cls.classifiedType) {
                updates.type = cls.classifiedType;
              }
              await sdk.updateDoc(candRef, cleanUndefined(updates));
              stats.successWrites++;
            } catch (reconcileErr) {
              console.warn("Lỗi cập nhật out-of-scope cho ứng viên:", cand.id, reconcileErr);
            }
          }
        }
      }
    }

    // 4. Pre-write safety verification: verify lock TTL and ownership before committing any writes
    if (!isDryRun && acquiredLockId) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= RESEARCH_SYNC_LOCK_TTL_MS) {
        throw new ResearchSyncStageError({
          stage: "LOCK_EXPIRED",
          collectionName: "systemConfig",
          documentId: RESEARCH_SYNC_LOCK_DOC_ID,
          operationType: "update",
          userSummary: "Phiên đồng bộ đã vượt quá giới hạn thời gian (TTL 5 phút). Quá trình ghi đã bị dừng để tránh xung đột dữ liệu.",
          actorUid: user.uid,
          actorRole: user.role,
        });
      }

      if (sdk.getDoc) {
        try {
          const lockRef = sdk.doc(db, "systemConfig", RESEARCH_SYNC_LOCK_DOC_ID);
          const lockSnap = await sdk.getDoc(lockRef);
          if (lockSnap?.exists && (typeof lockSnap.exists === "function" ? lockSnap.exists() : true)) {
            const lockData = typeof lockSnap.data === "function" ? lockSnap.data() : lockSnap;
            if (lockData && lockData.isLocked && lockData.lockId !== acquiredLockId) {
              throw new ResearchSyncStageError({
                stage: "LOCK_LOST",
                collectionName: "systemConfig",
                documentId: RESEARCH_SYNC_LOCK_DOC_ID,
                operationType: "update",
                userSummary: `Khóa phiên đồng bộ đã bị chiếm bởi phiên khác (${lockData.lockedBy || "quản trị viên khác"}). Quá trình ghi đã được hủy để bảo vệ dữ liệu.`,
                actorUid: user.uid,
                actorRole: user.role,
              });
            }
          }
        } catch (checkErr: any) {
          if (checkErr instanceof ResearchSyncStageError) throw checkErr;
          console.warn("[ResearchSync] Cảnh báo kiểm tra khóa trước khi ghi:", checkErr);
        }
      }
    }

    // 5. Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // header is row 1
      const sttVal = row.stt || i + 1;

      // Skip test items
      if (
        String(row.statusText || "").toUpperCase() === "TEST" ||
        row.title.toLowerCase().startsWith("test")
      ) {
        recordSyncItem(row, i, {
          row: rowNum,
          stt: sttVal,
          title: row.title,
          status: "skipped",
          action: "Bỏ qua TEST",
          reason: "Bản ghi thử nghiệm (TEST)",
        });
        continue;
      }

      if (!row.title.trim()) {
        stats.errorCount++;
        recordSyncItem(row, i, {
          row: rowNum,
          stt: sttVal,
          title: "Chưa có tiêu đề",
          status: "invalid",
          action: "Lỗi",
          reason: "Dòng thiếu tiêu đề hội thảo",
        });
        continue;
      }

      stats.valid++;

      // Check match
      const matchResult = findMatchingResearchOpportunity(row, combinedTargets);

      if (matchResult.isMatch && matchResult.target) {
        const target = matchResult.target;

        if (seenMatchedIds.has(target.id)) {
          stats.duplicates++;
          recordSyncItem(row, i, {
            row: rowNum,
            stt: sttVal,
            title: row.title,
            status: "skipped",
            action: isDriveSource ? "Trùng JSON" : "Trùng Sheet",
            reason: `Trùng với bản ghi khác trong ${sourceLabel}`,
            targetId: target.id,
          });
          continue;
        }
        seenMatchedIds.add(target.id);

        // Check if Admin edited (Case D: Preserved Admin)
        if (isEditedByAdmin(target)) {
          stats.preservedAdmin++;
          stats.matched++;
          recordSyncItem(row, i, {
            row: rowNum,
            stt: sttVal,
            title: row.title,
            status: "preserved_admin",
            action: "Giữ sửa Admin",
            reason: `Khớp với ${target._targetType === "opportunity" ? "hội thảo đã công bố" : "ứng viên"}, bảo toàn các chỉnh sửa thủ công của Admin`,
            targetId: target.id,
          });
          continue;
        }

        // Compare diff
        const diff = computeOpportunityDiff(target, row);
        const isOpp = target._targetType === "opportunity";

        if (isOpp) {
          // TARGET IS A PUBLISHED OPPORTUNITY IN 'opportunities'
          // Core architectural rule: DO NOT automatically overwrite published opportunities in Firestore!
          if (!diff.hasChanges) {
            // Case B: Published & Unchanged -> DO NOT write to Firestore
            // If there is an existing pending update proposal created previously that now has NO differences,
            // auto-resolve it cleanly by setting status to rejected with a clear audit reason.
            const staleProposal = candidates.find(
              (c) =>
                c.publishedOpportunityId === target.id &&
                ["pending", "needs_review"].includes(c.status)
            );
            if (staleProposal && !isDryRun) {
              const docRef = sdk.doc(db, "opportunityCandidates", staleProposal.id);
              try {
                await sdk.updateDoc(
                  docRef,
                  cleanUndefined({
                    status: "rejected",
                    resolutionType: "AUTO_CLOSED",
                    rejectionReason: "Đồng bộ chuẩn hóa: Dữ liệu Google Sheets và hội thảo đã công bố đã hoàn toàn trùng khớp, không có thay đổi thực tế.",
                    reviewedBy: "SPARK_SYNC",
                    reviewedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    updatedBy: "SPARK_SYNC",
                  })
                );
                stats.successWrites++;
              } catch (cleanErr: any) {
                throw new ResearchSyncStageError({
                  stage: "UPDATE_CANDIDATE",
                  collectionName: "opportunityCandidates",
                  documentId: staleProposal.id,
                  operationType: "update",
                  originalError: cleanErr,
                  userSummary: `Không đủ quyền tự động đóng đề xuất cập nhật cho hội thảo "${row.title}" (ID: ${staleProposal.id})`,
                  actorUid: user.uid,
                  actorRole: user.role,
                });
              }
            }

            stats.matched++;
            stats.unchanged++;
            recordSyncItem(
              row,
              i,
              {
                row: rowNum,
                stt: sttVal,
                title: row.title,
                status: "matched",
                action: "Khớp (Không đổi)",
                reason: `Hội thảo đã công bố, dữ liệu ${sourceLabel} trùng khớp, không ghi Firestore`,
                targetId: target.id,
              },
              diff
            );
          } else {
            // Case C: Published & Changed in Sheet -> Create or update proposal candidate in 'opportunityCandidates'
            const existingProposal = candidates.find(
              (c) =>
                c.publishedOpportunityId === target.id &&
                ["pending", "needs_review"].includes(c.status)
            );

            if (existingProposal) {
              // 3-way check: Compare incoming Sheet row with existingProposal
              const proposalDiff = computeOpportunityDiff(existingProposal, row);
              const isDiffSummaryIdentical = (() => {
                if (!existingProposal.diffSummary || !Array.isArray(existingProposal.diffSummary)) return false;
                if (existingProposal.diffSummary.length !== diff.diffSummary.length) return false;
                return diff.diffSummary.every((d) =>
                  existingProposal.diffSummary!.some(
                    (ed) => ed.field === d.field && String(ed.newValue ?? "") === String(d.newValue ?? "")
                  )
                );
              })();

              const isProposalUnchanged = !proposalDiff.hasChanges || isDiffSummaryIdentical;

              if (isProposalUnchanged) {
                // Proposal already reflects the incoming changes from Google Sheet: 0 Firestore writes, do not bump stats.updated!
                stats.matched++;
                stats.unchanged++;
                recordSyncItem(
                  row,
                  i,
                  {
                    row: rowNum,
                    stt: sttVal,
                    title: row.title,
                    status: "proposal_unchanged",
                    action: "Khớp đề xuất (Không đổi)",
                    reason: `Dữ liệu ${sourceLabel} hoàn toàn trùng khớp với đề xuất cập nhật đang chờ duyệt (${diff.changedKeys.join(", ")}), giữ nguyên không ghi đè Firestore`,
                    targetId: existingProposal.id,
                  },
                  diff
                );
              } else {
                // Sheet row has genuinely new changes beyond what is pending in existingProposal -> Update proposal
                if (!isDryRun) {
                  const docRef = sdk.doc(db, "opportunityCandidates", existingProposal.id);
                  try {
                    const safeUpdates: Record<string, any> = {
                      ...diff.updates,
                      diffSummary: diff.diffSummary,
                      changeType: "update",
                      resolutionType: "PENDING_UPDATE",
                      publishedOpportunityId: target.id,
                      discoveredAt: target.discoveredAt || existingProposal.discoveredAt || row.discoveredAt,
                      updatedAt: new Date().toISOString(),
                      updatedBy: "SPARK_SYNC",
                    };
                    await sdk.updateDoc(docRef, cleanUndefined(safeUpdates));
                    stats.successWrites++;
                  } catch (updateCandErr: any) {
                    throw new ResearchSyncStageError({
                      stage: "UPDATE_CANDIDATE",
                      collectionName: "opportunityCandidates",
                      documentId: existingProposal.id,
                      operationType: "update",
                      originalError: updateCandErr,
                      userSummary: `Không đủ quyền cập nhật đề xuất thay đổi cho hội thảo "${row.title}" (ID: ${existingProposal.id})`,
                      actorUid: user.uid,
                      actorRole: user.role,
                    });
                  }
                }
                stats.matched++;
                stats.updated++;
                recordSyncItem(
                  row,
                  i,
                  {
                    row: rowNum,
                    stt: sttVal,
                    title: row.title,
                    status: "update_proposal",
                    action: "Cập nhật đề xuất",
                    reason: `Phát hiện thay đổi mới so với đề xuất trước đó (${proposalDiff.changedKeys.join(", ")})`,
                    targetId: existingProposal.id,
                  },
                  diff
                );
              }
            } else {
              // Check if there is an existing proposal for this opportunity that was already REJECTED by Admin
              const rejectedProposal = candidates.find(
                (c) =>
                  (c.publishedOpportunityId === target.id || c.id === `cand_upd_${target.id}`) &&
                  c.status === "rejected" &&
                  (c.resolutionType === "ADMIN_REJECTED" || (Boolean(c.reviewedBy) && c.reviewedBy !== "SPARK_SYNC"))
              );

              // If rejected by Admin, check if incoming row diff matches what was already reviewed and rejected
              const hasNewDiffBeyondRejection = (() => {
                if (!rejectedProposal) return true;
                if (rejectedProposal.diffSummary && rejectedProposal.diffSummary.length > 0) {
                  const rejDiffSummary = rejectedProposal.diffSummary;
                  if (rejDiffSummary.length !== diff.diffSummary.length) return true;
                  const rejKeys = new Set(rejDiffSummary.map((d: any) => d.field));
                  for (const key of diff.changedKeys) {
                    if (!rejKeys.has(key)) return true;
                    const incomingVal = (diff.updates as any)[key];
                    const rejField = rejDiffSummary.find((d: any) => d.field === key);
                    if (rejField && rejField.newValue !== incomingVal) return true;
                  }
                  return false;
                }
                for (const key of diff.changedKeys) {
                  const incomingVal = (diff.updates as any)[key];
                  const rejVal = (rejectedProposal as any)[key];
                  if (incomingVal !== rejVal) return true;
                }
                return false;
              })();

              if (rejectedProposal && !hasNewDiffBeyondRejection) {
                // Strictly preserve Admin's rejection! Do not overwrite, do not re-open!
                stats.matched++;
                stats.preservedAdmin++;
                recordSyncItem(
                  row,
                  i,
                  {
                    row: rowNum,
                    stt: sttVal,
                    title: row.title,
                    status: "preserved_rejection",
                    action: "Giữ quyết định từ chối",
                    reason: `Admin (${rejectedProposal.reviewedBy}) đã từ chối đề xuất này trước đó. Bảo toàn lịch sử kiểm duyệt, không tự ý mở lại`,
                    targetId: rejectedProposal.id,
                  },
                  diff
                );
                continue;
              }

              // Create new update candidate in opportunityCandidates with deterministic idempotent ID
              const candId = (rejectedProposal && hasNewDiffBeyondRejection)
                ? `cand_upd_${target.id}_${Date.now()}`
                : `cand_upd_${target.id}`;

              const { id: _ignoreSlugId, ...candidateFields } = mapRowToCandidate(row, i);
              const existingCand = candidates.find((c) => c.id === candId);
              const createdAt = existingCand?.createdAt || new Date().toISOString();
              const discoveredAt = target.discoveredAt || row.discoveredAt || candidateFields.discoveredAt;
              if (!isDryRun) {
                const docRef = sdk.doc(db, "opportunityCandidates", candId);
                try {
                  await sdk.setDoc(
                    docRef,
                    cleanUndefined({
                      ...candidateFields,
                      id: candId,
                      conferenceCode: (row as any).conferenceCode,
                      category: (row as any).category,
                      lastUpdated: (row as any).lastUpdated || (row as any).updatedAt,
                      status: "pending",
                      changeType: "update",
                      resolutionType: "PENDING_UPDATE",
                      publishedOpportunityId: target.id,
                      diffSummary: diff.diffSummary,
                      sourceType: "SPARK",
                      createdAt: createdAt,
                      discoveredAt: discoveredAt,
                      updatedAt: new Date().toISOString(),
                      updatedBy: "SPARK_SYNC",
                    })
                  );
                  stats.successWrites++;
                } catch (createProposalErr: any) {
                  throw new ResearchSyncStageError({
                    stage: "WRITE_UPDATE_CANDIDATE",
                    collectionName: "opportunityCandidates",
                    documentId: candId,
                    operationType: "create",
                    originalError: createProposalErr,
                    userSummary: `Không đủ quyền tạo đề xuất cập nhật cho hội thảo đã công bố "${row.title}" (Opportunity ID: ${target.id})`,
                    actorUid: user.uid,
                    actorRole: user.role,
                  });
                }
              }
              stats.matched++;
              stats.updateProposals++;
              recordSyncItem(
                row,
                i,
                {
                  row: rowNum,
                  stt: sttVal,
                  title: row.title,
                  status: "update_proposal",
                  action: "Đề xuất cập nhật",
                  reason: `Phát hiện dữ liệu mới trên ${sourceLabel} (${diff.changedKeys.join(", ")}). Đã tạo đề xuất chờ Admin duyệt`,
                  targetId: candId,
                },
                diff
              );
            }
          }
        } else {
          // TARGET IS AN EXISTING CANDIDATE IN 'opportunityCandidates'
          if (diff.hasChanges) {
            if (!isDryRun) {
              const docRef = sdk.doc(db, "opportunityCandidates", target.id);
              try {
                const safeUpdates: Record<string, any> = {
                  ...diff.updates,
                  updatedAt: new Date().toISOString(),
                  updatedBy: "SPARK_SYNC",
                };

                // Backfill normalizedTitle if candidate lacked it in older schema
                if (!target.normalizedTitle) {
                  safeUpdates.normalizedTitle = normalizeText(row.title || target.title);
                }

                // Backfill country if candidate lacked it
                if (!target.country) {
                  safeUpdates.country = row.country || "Việt Nam";
                }

                // Canonicalize type if target had raw/legacy conference type
                if (target.type && !["Hội thảo", "Hội nghị", "Call for Papers", "Special Issue", "Book Chapter", "Seminar", "Hợp tác nghiên cứu", "Đổi mới sáng tạo", "Khác"].includes(target.type)) {
                  safeUpdates.type = target.type.includes("Hội nghị") ? "Hội nghị" : "Hội thảo";
                }

                // Canonicalize status if target had raw sheet status (e.g. 'MỚI')
                if (target.status && !["pending", "approved", "rejected", "needs_review"].includes(target.status)) {
                  safeUpdates.status = "pending";
                }

                // Ensure internal id field (if present) always matches the real Firestore document ID
                safeUpdates.id = target.id;

                await sdk.updateDoc(
                  docRef,
                  cleanUndefined(safeUpdates)
                );
                stats.successWrites++;
              } catch (updateErr: any) {
                throw new ResearchSyncStageError({
                  stage: "UPDATE_CANDIDATE",
                  collectionName: "opportunityCandidates",
                  documentId: target.id,
                  operationType: "update",
                  originalError: updateErr,
                  userSummary: `Không đủ quyền cập nhật ứng viên "${row.title}" (ID: ${target.id})`,
                  actorUid: user.uid,
                  actorRole: user.role,
                });
              }
            }
            stats.updated++;
            stats.matched++;
            recordSyncItem(
              row,
              i,
              {
                row: rowNum,
                stt: sttVal,
                title: row.title,
                status: "updated",
                action: "Cập nhật ứng viên",
                reason: `Cập nhật thông tin mới từ nguồn (${diff.changedKeys.join(", ")})`,
                targetId: target.id,
              },
              diff
            );
          } else {
            stats.matched++;
            stats.unchanged++;
            recordSyncItem(
              row,
              i,
              {
                row: rowNum,
                stt: sttVal,
                title: row.title,
                status: "matched",
                action: "Khớp ứng viên (Không đổi)",
                reason: "Khớp ứng viên trong hệ thống, dữ liệu không đổi",
                targetId: target.id,
              },
              diff
            );
          }
        }
      } else {
        // Case A: Completely new record: create candidate
        const outOfScope = classifyOutOfScopeRecord(row);
        const { id: _ignoreSlugId, ...candidateFields } = mapRowToCandidate(row, i);
        let newCandidateId = "";

        const newCandData: any = {
          ...candidateFields,
          conferenceCode: (row as any).conferenceCode,
          category: (row as any).category,
          lastUpdated: (row as any).lastUpdated || (row as any).updatedAt,
          status: "pending",
          changeType: "create",
          sourceType: "SPARK",
          discoveredAt: row.discoveredAt || candidateFields.discoveredAt || new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (outOfScope.isOutOfScope) {
          newCandData.isOutOfScope = true;
          newCandData.outOfScopeReason = outOfScope.reason;
          if (outOfScope.classifiedType) {
            newCandData.type = outOfScope.classifiedType;
          }
          stats.outOfScope++;
        }

        if (!isDryRun) {
          const colRef = sdk.collection(db, "opportunityCandidates");
          try {
            const addedDoc = await sdk.addDoc(
              colRef,
              cleanUndefined(newCandData)
            );
            newCandidateId = addedDoc?.id || "";
            stats.successWrites++;
          } catch (createCandErr: any) {
            throw new ResearchSyncStageError({
              stage: "WRITE_NEW_CANDIDATE",
              collectionName: "opportunityCandidates",
              operationType: "create",
              originalError: createCandErr,
              userSummary: `Không đủ quyền tạo mới ứng viên cơ hội "${row.title}"`,
              actorUid: user.uid,
              actorRole: user.role,
            });
          }
        }

        stats.created++;
        recordSyncItem(
          row,
          i,
          {
            row: rowNum,
            stt: sttVal,
            title: row.title,
            status: outOfScope.isOutOfScope ? "out_of_scope" : "created",
            action: outOfScope.isOutOfScope ? "Ngoài phạm vi" : "Tạo mới",
            reason: outOfScope.isOutOfScope ? outOfScope.reason! : "Cơ hội NCKH mới, đã đưa vào hàng chờ duyệt AI",
            targetId: newCandidateId,
          }
        );
      }
    }

    const durationMs = Date.now() - startTime;
    const finalStatus: "success" | "partial_success" = stats.errorCount > 0 ? "partial_success" : "success";

    // 5. Finalize state
    if (!isDryRun) {
      try {
        const statePayload: any = {
          lastSyncAt: new Date().toISOString(),
          lastSyncDate: new Date().toISOString().split("T")[0],
          lastSyncStatus: finalStatus,
          lastSyncSource: runSource,
          lastSyncStats: stats,
          durationMs,
          diagnostics: diagnostics.slice(0, 30),
          syncInProgress: false,
          lockId: "",
          updatedAt: new Date().toISOString(),
        };
        if (driveMeta) {
          statePayload.driveMeta = driveMeta;
        }

        await sdk.setDoc(stateRef, statePayload, { merge: true });
      } catch (finalizeErr: any) {
        throw new ResearchSyncStageError({
          stage: "UPDATE_SYNC_STATE",
          collectionName: "systemConfig",
          documentId: "facultyResearchSync",
          operationType: "update",
          originalError: finalizeErr,
          userSummary: "Không đủ quyền cập nhật trạng thái đồng bộ hoàn tất vào systemConfig",
          actorUid: user.uid,
          actorRole: user.role,
        });
      }

      // Record in imports collection for audit history
      try {
        const importRef = sdk.doc(db, "imports", `imp_spark_${Date.now()}`);
        const importFileName = driveMeta
          ? `Google Drive JSON (${driveMeta.fileName} Rev ${driveMeta.revision})`
          : `IFA Faculty Research (${options.sheetConfig?.sheetName || DEFAULT_RESEARCH_SHEET_NAME})`;

        await sdk.setDoc(importRef, {
          id: importRef.id,
          timestamp: new Date().toISOString(),
          importedBy: user.email || "system",
          fileName: importFileName,
          type: "opportunities",
          totalRows: stats.read,
          successCount: stats.created + stats.updated + stats.updateProposals + stats.matched + stats.preservedAdmin,
          errorCount: stats.errorCount,
          skippedCount: stats.duplicates,
          errors: diagnostics
            .filter((d) => d.status === "invalid")
            .map((d) => ({ row: d.row, reason: d.reason })),
          createdAt: new Date().toISOString(),
        });
      } catch (impErr: any) {
        console.warn("[WRITE_IMPORT_HISTORY] Không ghi được lịch sử imports:", impErr);
      }

    }

    return {
      skipped: false,
      status: finalStatus,
      stats,
      diagnostics,
      items: syncItems,
      durationMs,
      driveMeta: driveMeta || undefined,
    };
  } catch (error: any) {
    console.error(`[ResearchSync] Lỗi trong phiên đồng bộ:`, error);
    // Mark failed status in facultyResearchSync
    if (!isDryRun) {
      try {
        await sdk.setDoc(
          stateRef,
          {
            syncInProgress: false,
            lastSyncStatus: "failed",
            lastError: String(error?.message || error).slice(0, 1000),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (unlockErr) {
        console.warn("Lỗi ghi nhận trạng thái thất bại:", unlockErr);
      }
    }
    throw error;
  } finally {
    // Distributed lock is ALWAYS released in finally block, but only if acquiredLockId belongs to current session
    if (acquiredLockId) {
      try {
        await releaseFirestoreSyncLock(db, sdk, acquiredLockId);
      } catch (finallyReleaseErr) {
        console.warn("[ResearchSync] Lỗi giải phóng khóa trong finally:", finallyReleaseErr);
      }
    }
  }
}
