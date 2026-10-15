import React, { useState, useEffect, useMemo } from "react";
import { Modal } from "./Modal";
import type { OpportunityCandidate, Opportunity } from "../types";
import {
  OFFICIAL_FACULTY_RESEARCH_RECORDS,
  mapRowToCandidate,
  RawFacultyResearchRow,
} from "../services/facultyResearchData";
import {
  fetchLatestConferencesFromDrive,
  mapJsonConferenceToRawRow,
  DEFAULT_DRIVE_FOLDER_ID,
  DEFAULT_DRIVE_FILE_NAME,
} from "../services/researchDriveJsonService";
import {
  findMatchingResearchOpportunity,
  isEditedByAdmin,
  computeOpportunityDiff,
  classifyOutOfScopeRecord,
  type ResearchMatchTarget,
} from "../utils/researchDedupe";
import { formatDateVN } from "../utils/date";
import { runFacultyResearchSyncClient } from "../firebase/firestore";
import { useAuth } from "../firebase/auth";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Building,
  RefreshCw,
  Award,
  ShieldCheck,
  RotateCw,
} from "lucide-react";

interface FacultyResearchSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCandidates: OpportunityCandidate[];
  publishedOpportunities: Opportunity[];
  onSuccess: () => void;
}

export const FacultyResearchSyncModal: React.FC<FacultyResearchSyncModalProps> = ({
  isOpen,
  onClose,
  existingCandidates,
  publishedOpportunities,
  onSuccess,
}) => {
  const { profile } = useAuth();
  const [sourceData, setSourceData] = useState<RawFacultyResearchRow[]>([]);
  const [sourceName, setSourceName] = useState("Đang tải dữ liệu từ Google Drive JSON...");
  const [driveMeta, setDriveMeta] = useState<{
    folderId: string;
    fileId: string;
    fileName: string;
    revision: number;
    runId?: string;
    generatedAt?: string;
    isCached?: boolean;
  } | null>(null);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [isLiveSheet, setIsLiveSheet] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    added: number;
    updated: number;
    updateProposals: number;
    preservedAdmin: number;
    matched: number;
    skipped: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Load latest conferences from Google Drive JSON
  const loadDriveData = async () => {
    setLoadingSheet(true);
    setErrorMsg("");
    setSaveResult(null);
    try {
      const res = await fetchLatestConferencesFromDrive({
        folderId: DEFAULT_DRIVE_FOLDER_ID,
        fileName: DEFAULT_DRIVE_FILE_NAME,
      });

      const rows = res.payload.conferences.map((c, i) =>
        mapJsonConferenceToRawRow(c, i, res.payload.runId)
      );

      setSourceData(rows);
      setDriveMeta({
        folderId: DEFAULT_DRIVE_FOLDER_ID,
        fileId: res.fileId,
        fileName: res.fileName,
        revision: res.revision,
        runId: res.payload.runId,
        generatedAt: res.payload.generatedAt,
        isCached: res.isCached,
      });

      const tnCount = res.payload.conferences.filter((c) => (c.code || "").startsWith("TN")).length;
      const qtCount = res.payload.conferences.filter((c) => (c.code || "").startsWith("QT")).length;
      setSourceName(`Google Drive JSON — ${res.fileName} (Rev ${res.revision}: ${tnCount} TN, ${qtCount} QT)`);
      setIsLiveSheet(true);
    } catch (err: any) {
      console.warn("Không tải được Google Drive JSON:", err);
      setErrorMsg(`Không tải được Google Drive JSON (${err.message}). Đang chuyển sang dataset dự phòng.`);
      setSourceData(OFFICIAL_FACULTY_RESEARCH_RECORDS);
      setSourceName("Dataset dự phòng chính thức (8 bản ghi Spark)");
      setIsLiveSheet(false);
    } finally {
      setLoadingSheet(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDriveData();
    }
  }, [isOpen]);

  // Combined targets for matching
  const combinedTargets = useMemo<ResearchMatchTarget[]>(() => {
    return [
      ...publishedOpportunities.map((o) => ({ ...o, _targetType: "opportunity" as const })),
      ...existingCandidates.map((c) => ({ ...c, _targetType: "candidate" as const })),
    ];
  }, [publishedOpportunities, existingCandidates]);

  // Analyze rows
  const analyzedItems = useMemo(() => {
    const seenTargetIds = new Set<string>();

    return sourceData.map((row, idx) => {
      const candidate = mapRowToCandidate(row, idx);

      if (String(row.statusText || "").toUpperCase() === "TEST" || row.title.toLowerCase().startsWith("test")) {
        return {
          row,
          candidate,
          status: "skipped" as const,
          action: "Bỏ qua",
          reason: "Bản ghi thử nghiệm (TEST)",
        };
      }

      const match = findMatchingResearchOpportunity(row, combinedTargets);

      if (match.isMatch && match.target) {
        const target = match.target;
        if (seenTargetIds.has(target.id)) {
          return {
            row,
            candidate,
            status: "skipped" as const,
            action: "Trùng Sheet",
            reason: "Trùng lặp với dòng khác trong sheet",
          };
        }
        seenTargetIds.add(target.id);

        if (isEditedByAdmin(target)) {
          return {
            row,
            candidate,
            status: "preserved_admin" as const,
            action: "Giữ sửa Admin",
            reason: "Giữ nguyên các chỉnh sửa thủ công của Quản trị viên",
          };
        }

        const diff = computeOpportunityDiff(target, row);
        if (diff.hasChanges) {
          const isOpp = target._targetType === "opportunity";
          return {
            row,
            candidate,
            status: isOpp ? ("update_proposal" as const) : ("updated" as const),
            action: isOpp ? "Đề xuất cập nhật" : "Cập nhật ứng viên",
            reason: isOpp
              ? `Đề xuất cập nhật hội thảo đã công bố: ${diff.changedKeys.join(", ")}`
              : `Cập nhật thông tin ứng viên: ${diff.changedKeys.join(", ")}`,
          };
        }

        return {
          row,
          candidate,
          status: "matched" as const,
          action: "Đã khớp",
          reason: "Dữ liệu trùng khớp, không thay đổi (Không ghi Firestore)",
        };
      }

      const outOfScope = classifyOutOfScopeRecord(row);
      if (outOfScope.isOutOfScope) {
        return {
          row,
          candidate,
          status: "out_of_scope" as const,
          action: "Ngoài phạm vi",
          reason: outOfScope.reason || "Bản ghi ngoài phạm vi hội thảo trong nước",
        };
      }

      return {
        row,
        candidate,
        status: "created" as const,
        action: "Sẽ thêm mới",
        reason: "Cơ hội NCKH mới được phát hiện",
      };
    });
  }, [sourceData, combinedTargets]);

  const newCount = analyzedItems.filter((i) => i.status === "created").length;
  const updateProposalCount = analyzedItems.filter((i) => i.status === "update_proposal").length;
  const updateCount = analyzedItems.filter((i) => i.status === "updated").length;
  const preservedCount = analyzedItems.filter((i) => i.status === "preserved_admin").length;
  const matchedCount = analyzedItems.filter((i) => i.status === "matched").length;
  const duplicateCount = analyzedItems.filter((i) => i.status === "skipped").length;

  const handleSyncCommit = async () => {
    if (!profile) return;
    setSaving(true);
    setErrorMsg("");

    try {
      // Run full sync engine directly against Google Drive JSON
      const outcome = await runFacultyResearchSyncClient(profile, {
        force: true,
        dataSource: "drive_json",
      });
      if (outcome.skipped) {
        setErrorMsg(outcome.reason || "Phiên đồng bộ đã bị bỏ qua.");
      } else {
        const stats = outcome.stats;
        setSaveResult({
          added: stats?.created || 0,
          updated: stats?.updated || 0,
          updateProposals: stats?.updateProposals || 0,
          preservedAdmin: stats?.preservedAdmin || 0,
          matched: stats?.matched || 0,
          skipped: stats?.duplicates || 0,
        });
        onSuccess();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Lỗi khi lưu vào Firestore: " + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Đồng bộ cơ hội NCKH từ Google Drive JSON (Spark)"
      maxWidth="large"
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            Mới: <strong style={{ color: "var(--success)" }}>{newCount}</strong> · Đề xuất:{" "}
            <strong style={{ color: "#0284c7" }}>{updateProposalCount}</strong> · Cập nhật:{" "}
            <strong style={{ color: "#d97706" }}>{updateCount}</strong> · Giữ sửa Admin:{" "}
            <strong style={{ color: "#7c3aed" }}>{preservedCount}</strong> · Đã khớp:{" "}
            <strong style={{ color: "var(--text-main)" }}>{matchedCount}</strong>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>
              {saveResult ? "Đóng" : "Hủy"}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSyncCommit}
              disabled={saving}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {saving ? (
                <>
                  <RefreshCw size={14} className="spin" /> Đang đồng bộ...
                </>
              ) : (
                <>
                  <Sparkles size={14} />{" "}
                  {newCount + updateCount + updateProposalCount > 0
                    ? `Đồng bộ ${newCount + updateCount + updateProposalCount} bản ghi vào hệ thống`
                    : "Đồng bộ (Kiểm tra & Cập nhật)"}
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Source info block */}
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            padding: "12px 16px",
            borderRadius: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ flex: "1 1 280px" }}>
            <div style={{ fontWeight: 700, color: "#166534", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span>{sourceName}</span>
              {driveMeta?.isCached && (
                <span style={{ fontSize: "0.75rem", background: "#fef3c7", color: "#92400e", padding: "1px 6px", borderRadius: 4 }}>
                  Bản nhớ đệm
                </span>
              )}
            </div>
            <div style={{ color: "#15803d", fontSize: "0.8125rem", marginTop: 4, display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
              <span>Thư mục: <code>IFA_RH_DATA</code> (<code>{driveMeta?.folderId || DEFAULT_DRIVE_FOLDER_ID}</code>)</span>
              {driveMeta?.fileId && <span>File ID: <code>{driveMeta.fileId}</code></span>}
              {driveMeta?.generatedAt && <span>Tạo lúc: {formatDateVN(driveMeta.generatedAt)}</span>}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={loadDriveData}
              disabled={loadingSheet}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <RotateCw size={14} className={loadingSheet ? "spin" : ""} />
              {loadingSheet ? "Đang tải..." : "Tải lại Drive"}
            </button>
          </div>
        </div>

        {/* Success / Error notification */}
        {saveResult && (
          <div
            style={{
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
              padding: 12,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.875rem",
            }}
          >
            <CheckCircle2 size={18} color="#059669" />
            <span>
              Đồng bộ hoàn tất! Thêm mới: <strong>{saveResult.added}</strong> · Đề xuất cập nhật:{" "}
              <strong>{saveResult.updateProposals}</strong> · Khớp dữ liệu:{" "}
              <strong>{saveResult.matched}</strong> · Giữ sửa Admin: <strong>{saveResult.preservedAdmin}</strong>.
            </span>
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              padding: 12,
              borderRadius: 6,
              fontSize: "0.875rem",
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Diff Preview Table */}
        <div>
          <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--primary)", marginBottom: 8 }}>
            Xem trước kết quả đối chiếu ({analyzedItems.length} bản ghi):
          </div>

          <div className="table-container" style={{ maxHeight: 380, overflowY: "auto" }}>
            <table className="table" style={{ fontSize: "0.82rem" }}>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Trạng thái</th>
                  <th>Tên hội thảo / cơ hội</th>
                  <th>Đơn vị tổ chức</th>
                  <th>Hạn nộp</th>
                  <th>Mức phù hợp</th>
                  <th style={{ width: 140 }}>Kết quả kiểm tra</th>
                </tr>
              </thead>
              <tbody>
                {analyzedItems.map(({ candidate, status, action, reason }, idx) => {
                  let badgeBg = "#ecfdf5";
                  let badgeColor = "#059669";
                  let rowOpacity = 1;

                  if (status === "created") {
                    badgeBg = "#dcfce7";
                    badgeColor = "#15803d";
                  } else if (status === "updated") {
                    badgeBg = "#fef3c7";
                    badgeColor = "#b45309";
                  } else if (status === "preserved_admin") {
                    badgeBg = "#ede9fe";
                    badgeColor = "#6d28d9";
                  } else if (status === "matched") {
                    badgeBg = "#e0f2fe";
                    badgeColor = "#0369a1";
                    rowOpacity = 0.7;
                  } else if (status === "skipped") {
                    badgeBg = "#f1f5f9";
                    badgeColor = "#64748b";
                    rowOpacity = 0.55;
                  }

                  return (
                    <tr key={idx} style={{ opacity: rowOpacity }}>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background:
                              candidate.sheetStatus === "MỚI"
                                ? "#e0f2fe"
                                : candidate.sheetStatus === "SẮP HẾT HẠN"
                                ? "#fef3c7"
                                : "#f1f5f9",
                            color:
                              candidate.sheetStatus === "MỚI"
                                ? "#0369a1"
                                : candidate.sheetStatus === "SẮP HẾT HẠN"
                                ? "#b45309"
                                : "#64748b",
                            fontWeight: 700,
                            fontSize: "0.7rem",
                          }}
                        >
                          {candidate.sheetStatus || "Đang mở"}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: "var(--primary)", lineHeight: 1.3 }}>
                          {candidate.title}
                        </div>
                        {candidate.indexing && (
                          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--teal)", marginTop: 2 }}>
                            <Award size={12} />
                            <span>{candidate.indexing}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Building size={12} color="var(--muted)" />
                          <span>{candidate.organizer}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                          <Calendar size={12} color="var(--danger)" />
                          <strong>{formatDateVN(candidate.deadline) || "Chưa công bố"}</strong>
                        </div>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: candidate.suitability?.includes("Rất phù hợp") ? "#ecfdf5" : "#eff6ff",
                            color: candidate.suitability?.includes("Rất phù hợp") ? "#047857" : "#1d4ed8",
                            fontSize: "0.7rem",
                          }}
                        >
                          {candidate.suitability || "Phù hợp"}
                        </span>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{ background: badgeBg, color: badgeColor, fontSize: "0.7rem" }}
                          title={reason}
                        >
                          {status === "created" && <CheckCircle2 size={10} style={{ marginRight: 2 }} />}
                          {status === "updated" && <RotateCw size={10} style={{ marginRight: 2 }} />}
                          {status === "preserved_admin" && <ShieldCheck size={10} style={{ marginRight: 2 }} />}
                          {status === "skipped" && <AlertTriangle size={10} style={{ marginRight: 2 }} />}
                          {action}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
};
