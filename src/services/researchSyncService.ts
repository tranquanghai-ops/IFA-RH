import {
  fetchFacultyResearchSheetRows,
  DEFAULT_RESEARCH_SHEET_ID,
  DEFAULT_RESEARCH_SHEET_NAME,
} from "./researchSheetService";
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
    const seenMatchedIds = new Set<string>();

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

        // Check if Admin edited (Case D: Preserved Admin)
        if (isEditedByAdmin(target)) {
          stats.preservedAdmin++;
          stats.matched++;
          diagnostics.push({
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
            diagnostics.push({
              row: rowNum,
              stt: sttVal,
              title: row.title,
              status: "matched",
              action: "Khớp (Không đổi)",
              reason: "Hội thảo đã công bố, dữ liệu Google Sheets trùng khớp, không ghi Firestore",
              targetId: target.id,
            });
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
                diagnostics.push({
                  row: rowNum,
                  stt: sttVal,
                  title: row.title,
                  status: "proposal_unchanged",
                  action: "Khớp đề xuất (Không đổi)",
                  reason: `Dữ liệu Google Sheets hoàn toàn trùng khớp với đề xuất cập nhật đang chờ duyệt (${diff.changedKeys.join(", ")}), giữ nguyên không ghi đè Firestore`,
                  targetId: existingProposal.id,
                });
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
                diagnostics.push({
                  row: rowNum,
                  stt: sttVal,
                  title: row.title,
                  status: "update_proposal",
                  action: "Cập nhật đề xuất",
                  reason: `Phát hiện thay đổi mới so với đề xuất trước đó (${proposalDiff.changedKeys.join(", ")})`,
                  targetId: existingProposal.id,
                });
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
                diagnostics.push({
                  row: rowNum,
                  stt: sttVal,
                  title: row.title,
                  status: "preserved_rejection",
                  action: "Giữ quyết định từ chối",
                  reason: `Admin (${rejectedProposal.reviewedBy}) đã từ chối đề xuất này trước đó. Bảo toàn lịch sử kiểm duyệt, không tự ý mở lại`,
                  targetId: rejectedProposal.id,
                });
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
              diagnostics.push({
                row: rowNum,
                stt: sttVal,
                title: row.title,
                status: "update_proposal",
                action: "Đề xuất cập nhật",
                reason: `Phát hiện dữ liệu mới trên Google Sheet (${diff.changedKeys.join(", ")}). Đã tạo đề xuất chờ Admin duyệt`,
                targetId: candId,
              });
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
            diagnostics.push({
              row: rowNum,
              stt: sttVal,
              title: row.title,
              status: "updated",
              action: "Cập nhật ứng viên",
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
              action: "Khớp ứng viên",
              reason: "Khớp ứng viên trong hệ thống, dữ liệu không đổi",
              targetId: target.id,
            });
          }
        }
      } else {
        // Case A: Completely new record: create candidate
        const outOfScope = classifyOutOfScopeRecord(row);
        const { id: _ignoreSlugId, ...candidateFields } = mapRowToCandidate(row, i);
        let newCandidateId = "";

        const newCandData: any = {
          ...candidateFields,
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
        diagnostics.push({
          row: rowNum,
          stt: sttVal,
          title: row.title,
          status: outOfScope.isOutOfScope ? "out_of_scope" : "created",
          action: outOfScope.isOutOfScope ? "Ngoài phạm vi" : "Tạo mới",
          reason: outOfScope.isOutOfScope ? outOfScope.reason! : "Cơ hội NCKH mới, đã đưa vào hàng chờ duyệt AI",
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
