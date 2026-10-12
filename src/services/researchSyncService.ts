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
      const stateSnap = await sdk.getDoc(stateRef);
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
      await sdk.setDoc(
        stateRef,
        {
          syncInProgress: true,
          lockId,
          syncStartedAt: new Date().toISOString(),
          syncStartedAtMs: startTime,
          syncStartedBy: user.email,
          lastSyncStatus: "running",
          lastSyncSource: runSource,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (lockErr) {
      console.warn("Cảnh báo: Không thể ghi lock đồng bộ (tiếp tục đồng bộ):", lockErr);
    }
  }

  try {
    // 2. Fetch rows from Google Sheets
    const rows = await fetchFacultyResearchSheetRows(options.sheetConfig);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("Không có dữ liệu trả về từ Google Sheets IFA Faculty Research.");
    }

    // 3. Fetch existing Firestore records
    const [candsSnap, oppsSnap] = await Promise.all([
      sdk.getDocs(sdk.collection(db, "opportunityCandidates")),
      sdk.getDocs(sdk.collection(db, "opportunities")),
    ]);

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
            const colName = target._targetType === "opportunity" ? "opportunities" : "opportunityCandidates";
            const docRef = sdk.doc(db, colName, target.id);
            await sdk.updateDoc(
              docRef,
              cleanUndefined({
                ...diff.updates,
                updatedAt: new Date().toISOString(),
                updatedBy: "SPARK_SYNC",
              })
            );
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

      // Record in imports collection for audit history
      try {
        const importRef = sdk.doc(db, "imports", `imp_spark_${Date.now()}`);
        await sdk.setDoc(importRef, {
          id: importRef.id,
          timestamp: new Date().toISOString(),
          importedBy: user.email,
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
      } catch (impErr) {
        console.warn("Không ghi được lịch sử imports:", impErr);
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
