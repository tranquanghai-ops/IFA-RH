import {
  fetchFacultyResearchSheetRows,
  DEFAULT_RESEARCH_SHEET_ID,
  DEFAULT_RESEARCH_SHEET_NAME,
} from "./researchSheetService";
import {
  findMatchingResearchOpportunity,
  isEditedByAdmin,
  computeOpportunityDiff,
  ResearchMatchTarget,
} from "../utils/researchDedupe";
import { mapRowToCandidate } from "./facultyResearchData";
import type { RawFacultyResearchRow } from "./facultyResearchData";
import type { OpportunityCandidate, Opportunity } from "../types";

export interface ResearchSyncStats {
  read: number;
  valid: number;
  created: number;
  matched: number;
  updated: number;
  preservedAdmin: number;
  duplicates: number;
  errorCount: number;
}

export interface ResearchSyncDiagnosticItem {
  row: number;
  stt: number | string;
  title: string;
  status: "created" | "matched" | "updated" | "preserved_admin" | "skipped" | "invalid";
  action: string;
  reason: string;
  targetId?: string;
}

export type SyncStage =
  | "READ_CONFIG"
  | "CLAIM_LOCK"
  | "FETCH_SHEET"
  | "READ_CANDIDATES"
  | "WRITE_NEW_CANDIDATE"
  | "UPDATE_CANDIDATE"
  | "UPDATE_OPPORTUNITY"
  | "UPDATE_SYNC_STATE"
  | "WRITE_IMPORT_HISTORY";

export class ResearchSyncStageError extends Error {
  stage: SyncStage;
  collectionName: string;
  documentId?: string;
  operationType: "get" | "list" | "create" | "update" | "delete";
  originalError: any;
  userSummary: string;
  actorUid?: string;
  actorRole?: string;

  constructor(params: {
    stage: SyncStage;
    collectionName: string;
    documentId?: string;
    operationType: "get" | "list" | "create" | "update" | "delete";
    originalError: any;
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
    runSource?: "github_schedule" | "github_dispatch" | "manual_admin" | "manual_cli";
    sheetConfig?: { sheetId?: string; sheetName?: string };
  };
}): Promise<ResearchSyncOutcome> {
  const startTime = Date.now();
  const runSource = options.runSource || (options.manual ? "manual_admin" : "github_schedule");
  const isDryRun = Boolean(options.dryRun);

  const stateRef = sdk.doc(db, "systemConfig", "facultyResearchSync");
  const lockId = crypto.randomUUID();

  // 1. Concurrency guard & Lock Check
  if (!isDryRun) {
    try {
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
          const isFreshLock = inProgress && Date.now() - startedAtTime < 15 * 60 * 1000; // 15 mins lock timeout

          if (isFreshLock && !options.force) {
            return {
              skipped: true,
              reason: "Một phiên đồng bộ khác đang chạy. Vui lòng thử lại sau.",
            };
          }
        }
      }

      // Claim lock
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
        // If claiming lock fails with permission-denied, raise diagnostic error
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
    } catch (concurrencyErr: any) {
      if (concurrencyErr instanceof ResearchSyncStageError) {
        throw concurrencyErr;
      }
      console.warn("Lỗi kiểm tra lock:", concurrencyErr);
    }
  }

  try {
    // 2. Fetch rows from Google Sheets
    let rows: any[] = [];
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
      id: d.id,
      ...(typeof d.data === "function" ? d.data() : d),
    }));

    const opportunities: Opportunity[] = (oppsSnap?.docs || []).map((d: any) => ({
      id: d.id,
      ...(typeof d.data === "function" ? d.data() : d),
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
      updated: 0,
      preservedAdmin: 0,
      duplicates: 0,
      errorCount: 0,
    };

    const diagnostics: ResearchSyncDiagnosticItem[] = [];
    const seenMatchedIds = new Set<string>();

    // 4. Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // header is row 1
      const sttVal = row.stt || i + 1;

      // Skip test items
      if (
        String(row.statusText || "").toUpperCase() === "TEST" ||
        row.title.toLowerCase().startsWith("test")
      ) {
        diagnostics.push({
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
        diagnostics.push({
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
          diagnostics.push({
            row: rowNum,
            stt: sttVal,
            title: row.title,
            status: "skipped",
            action: "Trùng Sheet",
            reason: "Trùng với dòng khác trong Google Sheet",
            targetId: target.id,
          });
          continue;
        }
        seenMatchedIds.add(target.id);

        // Check if Admin edited
        if (isEditedByAdmin(target)) {
          stats.preservedAdmin++;
          diagnostics.push({
            row: rowNum,
            stt: sttVal,
            title: row.title,
            status: "preserved_admin",
            action: "Giữ sửa Admin",
            reason: `Khớp với ${target._targetType === "opportunity" ? "cơ hội đã công bố" : "ứng viên"}, giữ nguyên các chỉnh sửa thủ công của Admin`,
            targetId: target.id,
          });
          continue;
        }

        // Compare diff
        const diff = computeOpportunityDiff(target, row);
        if (diff.hasChanges) {
          if (!isDryRun) {
            const isOpp = target._targetType === "opportunity";
            const colName = isOpp ? "opportunities" : "opportunityCandidates";
            const docRef = sdk.doc(db, colName, target.id);
            try {
              await sdk.updateDoc(
                docRef,
                cleanUndefined({
                  ...diff.updates,
                  updatedAt: new Date().toISOString(),
                  updatedBy: "SPARK_SYNC",
                })
              );
            } catch (updateErr: any) {
              throw new ResearchSyncStageError({
                stage: isOpp ? "UPDATE_OPPORTUNITY" : "UPDATE_CANDIDATE",
                collectionName: colName,
                documentId: target.id,
                operationType: "update",
                originalError: updateErr,
                userSummary: `Không đủ quyền cập nhật ${isOpp ? "cơ hội" : "ứng viên"} "${row.title}" (ID: ${target.id})`,
                actorUid: user.uid,
                actorRole: user.role,
              });
            }
          }
          stats.updated++;
          diagnostics.push({
            row: rowNum,
            stt: sttVal,
            title: row.title,
            status: "updated",
            action: "Cập nhật",
            reason: `Cập nhật thông tin mới từ nguồn (${diff.changedKeys.join(", ")})`,
            targetId: target.id,
          });
        } else {
          stats.matched++;
          diagnostics.push({
            row: rowNum,
            stt: sttVal,
            title: row.title,
            status: "matched",
            action: "Khớp",
            reason: "Khớp cơ hội trong hệ thống, dữ liệu không đổi",
            targetId: target.id,
          });
        }
      } else {
        // Completely new record: create candidate
        const candidate = mapRowToCandidate(row, i);
        let newCandidateId = "";

        if (!isDryRun) {
          const colRef = sdk.collection(db, "opportunityCandidates");
          try {
            const addedDoc = await sdk.addDoc(
              colRef,
              cleanUndefined({
                ...candidate,
                status: "pending",
                sourceType: "SPARK",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })
            );
            newCandidateId = addedDoc?.id || "";
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
        diagnostics.push({
          row: rowNum,
          stt: sttVal,
          title: row.title,
          status: "created",
          action: "Tạo mới",
          reason: "Cơ hội NCKH mới, đã đưa vào hàng chờ duyệt AI",
          targetId: newCandidateId,
        });
      }
    }

    const durationMs = Date.now() - startTime;
    const finalStatus: "success" | "partial_success" = stats.errorCount > 0 ? "partial_success" : "success";

    // 5. Finalize state
    if (!isDryRun) {
      try {
        await sdk.setDoc(
          stateRef,
          {
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
          },
          { merge: true }
        );
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
        await sdk.setDoc(importRef, {
          id: importRef.id,
          timestamp: new Date().toISOString(),
          importedBy: user.email || "system",
          fileName: `IFA Faculty Research (${options.sheetConfig?.sheetName || DEFAULT_RESEARCH_SHEET_NAME})`,
          type: "opportunities",
          totalRows: stats.read,
          successCount: stats.created + stats.updated + stats.matched + stats.preservedAdmin,
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
      durationMs,
    };
  } catch (error: any) {
    console.error(`[ResearchSync] Lỗi trong phiên đồng bộ:`, error);
    // Unlock on error
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
        console.warn("Lỗi mở khóa sau thất bại:", unlockErr);
      }
    }
    throw error;
  }
}
