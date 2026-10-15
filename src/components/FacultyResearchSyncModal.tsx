import React, { useState, useEffect } from "react";
import { Modal } from "./Modal";
import type { OpportunityCandidate, Opportunity } from "../types";
import { DEFAULT_DRIVE_FOLDER_ID } from "../services/researchDriveJsonService";
import type { ResearchSyncOutcome } from "../services/researchSyncService";
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
  onSuccess,
}) => {
  const { profile } = useAuth();
  const [sourceName, setSourceName] = useState("Đang tải dữ liệu từ Google Drive JSON...");
  const [dryRunOutcome, setDryRunOutcome] = useState<ResearchSyncOutcome | null>(null);
  const [loading, setLoading] = useState(false);
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

  // Load preview data directly from the unified executeResearchSync engine (dryRun: true)
  const loadDrivePreview = async () => {
    if (!profile) return;
    setLoading(true);
    setErrorMsg("");
    setSaveResult(null);

    try {
      const outcome = await runFacultyResearchSyncClient(profile, {
        dryRun: true,
        dataSource: "drive_json",
      });

      if (outcome.skipped) {
        setErrorMsg(outcome.reason || "Không thể thực hiện xem trước đồng bộ.");
        setDryRunOutcome(null);
        setSourceName("Phiên đồng bộ bị bỏ qua");
        return;
      }

      setDryRunOutcome(outcome);

      const meta = outcome.driveMeta;
      if (meta) {
        const tnCount = (outcome.items || []).filter((item) => item.category === "TN").length;
        const qtCount = (outcome.items || []).filter((item) => item.category === "QT").length;
        setSourceName(
          `Google Drive JSON — ${meta.fileName} (Rev ${meta.revision}: ${tnCount} TN, ${qtCount} QT)`
        );
      }
    } catch (err: any) {
      console.error("Lỗi khi tải dữ liệu xem trước Google Drive:", err);
      // Untrusted source rule: NEVER fall back to old dataset, report error clearly
      setErrorMsg(
        `Không thể đọc file JSON chính thức từ Google Drive: ${err.message || String(err)}. Tính năng đồng bộ đã bị khóa để bảo vệ an toàn dữ liệu.`
      );
      setDryRunOutcome(null);
      setSourceName("Không thể kết nối Google Drive");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDrivePreview();
    }
  }, [isOpen]);

  const stats = dryRunOutcome?.stats;
  const driveMeta = dryRunOutcome?.driveMeta;
  const items = dryRunOutcome?.items || [];

  const newCount = stats?.created || 0;
  const updateProposalCount = stats?.updateProposals || 0;
  const updateCount = stats?.updated || 0;
  const preservedCount = stats?.preservedAdmin || 0;
  const matchedCount = (stats?.matched || 0) + (stats?.unchanged || 0);

  const isCachedSource = Boolean(driveMeta?.isCached);
  const canCommit = !loading && !saving && Boolean(dryRunOutcome) && !isCachedSource && items.length > 0;

  const handleSyncCommit = async () => {
    if (!profile || !dryRunOutcome) return;

    if (isCachedSource) {
      setErrorMsg(
        "Nguồn dữ liệu hiện đang là bản nhớ đệm (cache fallback). Tuyệt đối không cho phép ghi vào Firestore khi nguồn JSON chưa được xác thực trực tiếp từ Google Drive."
      );
      return;
    }

    setSaving(true);
    setErrorMsg("");

    try {
      // Execute live sync using identical engine with expectedRevision verification
      const outcome = await runFacultyResearchSyncClient(profile, {
        dryRun: false,
        dataSource: "drive_json",
        expectedRevision: driveMeta?.revision,
      });

      if (outcome.skipped) {
        setErrorMsg(outcome.reason || "Phiên đồng bộ đã bị bỏ qua.");
      } else {
        const outStats = outcome.stats;
        setSaveResult({
          added: outStats?.created || 0,
          updated: outStats?.updated || 0,
          updateProposals: outStats?.updateProposals || 0,
          preservedAdmin: outStats?.preservedAdmin || 0,
          matched: outStats?.matched || 0,
          skipped: outStats?.duplicates || 0,
        });
        onSuccess();
      }
    } catch (err: any) {
      console.error("[FacultyResearchSyncModal] Lỗi khi ghi đồng bộ:", err);
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
              disabled={!canCommit}
              title={isCachedSource ? "Không thể đồng bộ khi dùng bản nhớ đệm" : undefined}
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
                    ? `Đồng bộ ${newCount + updateCount + updateProposalCount} thay đổi vào Firestore`
                    : "Xác nhận đồng bộ (0 thay đổi mới)"}
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
            background: isCachedSource ? "#fffbeb" : "#f0fdf4",
            border: `1px solid ${isCachedSource ? "#fde68a" : "#bbf7d0"}`,
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
            <div
              style={{
                fontWeight: 700,
                color: isCachedSource ? "#92400e" : "#166534",
                fontSize: "0.9rem",
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              <span>{sourceName}</span>
              {isCachedSource && (
                <span style={{ fontSize: "0.75rem", background: "#fef3c7", color: "#92400e", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                  Bản nhớ đệm (Chỉ xem)
                </span>
              )}
            </div>
            <div style={{ color: isCachedSource ? "#b45309" : "#15803d", fontSize: "0.8125rem", marginTop: 4, display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
              <span>Thư mục: <code>IFA_RH_DATA</code> (<code>{DEFAULT_DRIVE_FOLDER_ID}</code>)</span>
              {driveMeta?.fileId && <span>File ID: <code>{driveMeta.fileId}</code></span>}
              {driveMeta?.revision && <span>Revision: <strong>{driveMeta.revision}</strong></span>}
              {driveMeta?.generatedAt && <span>Tạo lúc: {formatDateVN(driveMeta.generatedAt)}</span>}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={loadDrivePreview}
              disabled={loading}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <RotateCw size={14} className={loading ? "spin" : ""} />
              {loading ? "Đang tải..." : "Tải lại Drive"}
            </button>
          </div>
        </div>

        {/* Cached Source Warning Banner */}
        {isCachedSource && (
          <div
            style={{
              background: "#fffbeb",
              border: "1px solid #fde68a",
              color: "#92400e",
              padding: 12,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.875rem",
            }}
          >
            <AlertTriangle size={20} color="#d97706" style={{ flexShrink: 0 }} />
            <span>
              <strong>Cảnh báo nguồn dữ liệu:</strong> Dữ liệu hội thảo đang được lấy từ bộ nhớ đệm (cache fallback) do không kết nối trực tiếp được với Google Drive API. Hệ thống chỉ cho phép xem trước đối chiếu (dry-run); tính năng ghi đồng bộ vào Firestore đã bị khóa để bảo đảm an toàn dữ liệu.
            </span>
          </div>
        )}

        {/* Success notification */}
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

        {/* Error notification */}
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
          <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--primary)", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Xem trước kết quả đối chiếu ({items.length} hội thảo):</span>
            <span style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: "normal" }}>
              Được tính toán trực tiếp bởi công cụ đồng bộ chuẩn hóa (Dry-Run)
            </span>
          </div>

          <div className="table-container" style={{ maxHeight: 380, overflowY: "auto" }}>
            <table className="table" style={{ fontSize: "0.82rem" }}>
              <thead>
                <tr>
                  <th style={{ width: 85 }}>Mã & Loại</th>
                  <th>Tên hội thảo / cơ hội</th>
                  <th>Đơn vị tổ chức</th>
                  <th>Hạn nộp</th>
                  <th>Mức phù hợp</th>
                  <th style={{ width: 145 }}>Kết quả đối chiếu</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                      {loading ? "Đang tải dữ liệu hội thảo từ Google Drive..." : "Không có dữ liệu hội thảo nào để hiển thị."}
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const { candidate, status, action, reason, code, category } = item;
                    let badgeBg = "#ecfdf5";
                    let badgeColor = "#059669";
                    let rowOpacity = 1;

                    if (status === "created") {
                      badgeBg = "#dcfce7";
                      badgeColor = "#15803d";
                    } else if (status === "update_proposal") {
                      badgeBg = "#e0f2fe";
                      badgeColor = "#0284c7";
                    } else if (status === "proposal_unchanged") {
                      badgeBg = "#f0f9ff";
                      badgeColor = "#0369a1";
                      rowOpacity = 0.8;
                    } else if (status === "updated") {
                      badgeBg = "#fef3c7";
                      badgeColor = "#b45309";
                    } else if (status === "preserved_admin" || status === "preserved_rejection") {
                      badgeBg = "#ede9fe";
                      badgeColor = "#6d28d9";
                    } else if (status === "matched") {
                      badgeBg = "#f1f5f9";
                      badgeColor = "#475569";
                      rowOpacity = 0.75;
                    } else if (status === "skipped" || status === "out_of_scope") {
                      badgeBg = "#f1f5f9";
                      badgeColor = "#64748b";
                      rowOpacity = 0.55;
                    }

                    const isTN = category === "TN" || code.startsWith("TN");

                    return (
                      <tr key={idx} style={{ opacity: rowOpacity }}>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span
                              className="badge"
                              style={{
                                background: isTN ? "#dcfce7" : "#dbeafe",
                                color: isTN ? "#166534" : "#1e40af",
                                fontWeight: 700,
                                fontSize: "0.72rem",
                                padding: "2px 6px",
                              }}
                            >
                              {code || (isTN ? "TN" : "QT")}
                            </span>
                            <span style={{ fontSize: "0.68rem", color: "var(--muted)" }}>
                              {isTN ? "Trong nước" : "Quốc tế"}
                            </span>
                          </div>
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
                            {status === "update_proposal" && <RotateCw size={10} style={{ marginRight: 2 }} />}
                            {(status === "preserved_admin" || status === "preserved_rejection") && (
                              <ShieldCheck size={10} style={{ marginRight: 2 }} />
                            )}
                            {(status === "skipped" || status === "out_of_scope") && (
                              <AlertTriangle size={10} style={{ marginRight: 2 }} />
                            )}
                            {action}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
};
