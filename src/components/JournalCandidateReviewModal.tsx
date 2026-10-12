import React, { useState } from "react";
import type { JournalCandidate } from "../types/journal";
import {
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Award,
  Globe,
  Building,
  Hash,
  FileText,
  Clock,
  ShieldAlert,
  ArrowRight,
  HelpCircle,
} from "lucide-react";

interface JournalCandidateReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: JournalCandidate | null;
  onApprove: (candidateId: string, options?: { overrideManual?: boolean }) => Promise<void>;
  onReject: (candidateId: string, reason: string) => Promise<void>;
  onMarkNeedsReview: (candidateId: string) => Promise<void>;
}

export const JournalCandidateReviewModal: React.FC<JournalCandidateReviewModalProps> = ({
  isOpen,
  onClose,
  candidate,
  onApprove,
  onReject,
  onMarkNeedsReview,
}) => {
  const [overrideManual, setOverrideManual] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejectingOpen, setIsRejectingOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen || !candidate) return null;

  const isUpdate = candidate.changeType === "update";
  const diffs = candidate.diffSummary || [];
  const scores = candidate.scores || [];

  const handleApprove = async () => {
    setErrorMsg("");
    setIsProcessing(true);
    try {
      await onApprove(candidate.id, { overrideManual });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Duyệt thất bại.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) {
      setErrorMsg("Vui lòng nhập lý do từ chối.");
      return;
    }
    setErrorMsg("");
    setIsProcessing(true);
    try {
      await onReject(candidate.id, rejectReason);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Từ chối thất bại.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNeedsReview = async () => {
    setErrorMsg("");
    setIsProcessing(true);
    try {
      await onMarkNeedsReview(candidate.id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Thao tác thất bại.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        className="modal-content viewport-safe-modal"
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          maxWidth: "880px",
          width: "100%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#f8fafc",
          }}
        >
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  backgroundColor: isUpdate ? "#eff6ff" : "#f0fdf4",
                  color: isUpdate ? "#1e40af" : "#166534",
                  border: isUpdate ? "1px solid #bfdbfe" : "1px solid #bbf7d0",
                }}
              >
                {isUpdate ? "YÊU CẦU CẬP NHẬT" : "TẠP CHÍ MỚI"}
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.35 }}>
              {candidate.name}
            </h3>
            {candidate.englishName && (
              <p style={{ margin: "3px 0 0 0", fontSize: "0.85rem", color: "#64748b", fontStyle: "italic" }}>
                {candidate.englishName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>
          {errorMsg && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "6px",
                backgroundColor: "#fef2f2",
                color: "#991b1b",
                border: "1px solid #fecaca",
                fontSize: "0.85rem",
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Manual Edit Protection Alert */}
          {candidate.isManualPreserved && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                backgroundColor: "#fefce8",
                border: "1px solid #fef08a",
                fontSize: "0.85rem",
                color: "#854d0e",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700 }}>
                <ShieldAlert size={18} />
                Bản ghi hiện có đã được Admin chỉnh sửa thủ công trên web!
              </div>
              <p style={{ margin: 0 }}>
                Hệ thống mặc định giữ nguyên các thông tin do Admin hiệu chỉnh và chỉ cập nhật thêm lịch sử điểm. Nếu bạn muốn thay thế hoàn toàn bằng dữ liệu mới từ Spark, vui lòng tick vào ô bên dưới.
              </p>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600, color: "#713f12" }}>
                <input
                  type="checkbox"
                  checked={overrideManual}
                  onChange={(e) => setOverrideManual(e.target.checked)}
                />
                Ghi đè thông tin đã sửa thủ công bằng dữ liệu mới từ Spark
              </label>
            </div>
          )}

          {/* Manual Inspection Needed Warning Alert */}
          {(candidate.verification?.manualReviewNeeded ||
            candidate.unverifiedFields?.some((f) => f.includes("Cần kiểm tra thủ công"))) && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                backgroundColor: "#fffbeb",
                border: "1px solid #fde68a",
                fontSize: "0.85rem",
                color: "#92400e",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, color: "#b45309" }}>
                <AlertTriangle size={18} />
                CẢNH BÁO ĐỐI SOÁT THỦ CÔNG (THEO ĐIỀU TRA SPARK / QUYẾT ĐỊNH 26):
              </div>
              <p style={{ margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                {candidate.verification?.manualReviewReason ||
                  candidate.unverifiedFields?.find((f) => f.includes("Cần kiểm tra thủ công")) ||
                  "Hồ sơ này có đặc thù về điểm số, mã ISSN hoặc lịch sử tên gọi cần Admin đối chiếu kỹ trước khi duyệt."}
              </p>
            </div>
          )}

          {/* Section 1: Diff comparison (If Update) */}
          {isUpdate && diffs.length > 0 && (

            <div>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>
                So sánh thay đổi dữ liệu (Trước vs Sau khi Spark cập nhật):
              </h4>
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  overflow: "hidden",
                  fontSize: "0.85rem",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "10px 12px", width: "160px" }}>Trường thông tin</th>
                      <th style={{ padding: "10px 12px", backgroundColor: "#fef2f2", color: "#991b1b" }}>
                        Dữ liệu hiện tại (Đang công khai)
                      </th>
                      <th style={{ padding: "10px 12px", width: "30px", textAlign: "center" }}></th>
                      <th style={{ padding: "10px 12px", backgroundColor: "#f0fdf4", color: "#166534" }}>
                        Dữ liệu đề xuất mới (Spark)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffs.map((d, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: "#334155" }}>
                          {d.label}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#475569" }}>{String(d.oldValue)}</td>
                        <td style={{ padding: "10px 6px", textAlign: "center", color: "#94a3b8" }}>
                          <ArrowRight size={14} />
                        </td>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: "#15803d" }}>
                          {String(d.newValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section 2: General Identification Details */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px",
              backgroundColor: "#f8fafc",
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              fontSize: "0.85rem",
            }}
          >
            <div>
              <span style={{ color: "#64748b" }}>Cơ quan xuất bản:</span>
              <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                {candidate.publisher}
              </div>
            </div>
            <div>
              <span style={{ color: "#64748b" }}>ISSN bản in:</span>
              <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                {candidate.issnPrint || "Chưa có"}
              </div>
            </div>
            <div>
              <span style={{ color: "#64748b" }}>E-ISSN điện tử:</span>
              <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                {candidate.issnOnline || "Chưa có"}
              </div>
            </div>
            <div>
              <span style={{ color: "#64748b" }}>Lĩnh vực chuyên môn:</span>
              <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                {candidate.primaryField}
              </div>
            </div>
            <div>
              <span style={{ color: "#64748b" }}>Trang chủ chính thức:</span>
              <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                {candidate.website ? (
                  <a href={candidate.website} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>
                    {candidate.website}
                  </a>
                ) : (
                  <span style={{ color: "#94a3b8" }}>Chưa có trang chủ</span>
                )}
              </div>
            </div>
            <div>
              <span style={{ color: "#64748b" }}>Điểm HĐGSNN tối đa:</span>
              <div style={{ fontWeight: 700, color: "#166534", marginTop: "2px" }}>
                {candidate.maxScore} ({candidate.maxScoreYear})
              </div>
            </div>
          </div>

          {/* Section 3: Scores List */}
          <div>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "0.9rem", fontWeight: 700, color: "#0f172a" }}>
              Danh sách điểm HĐGSNN ({scores.length} mốc):
            </h4>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", fontSize: "0.82rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "8px 10px" }}>Năm</th>
                    <th style={{ padding: "8px 10px" }}>Hội đồng ngành</th>
                    <th style={{ padding: "8px 10px" }}>Điểm tối đa</th>
                    <th style={{ padding: "8px 10px" }}>Văn bản căn cứ</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((s, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 700 }}>{s.year}</td>
                      <td style={{ padding: "8px 10px" }}>{s.councilName}</td>
                      <td style={{ padding: "8px 10px", fontWeight: 700, color: "#166534" }}>
                        {s.maxScore.toFixed(2)}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#64748b" }}>{s.decisionNumber || "QĐ 26"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Unverified Fields if any */}
          {candidate.unverifiedFields.length > 0 && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                backgroundColor: "#fffbeb",
                border: "1px solid #fef3c7",
                fontSize: "0.82rem",
                color: "#92400e",
              }}
            >
              <strong>Các thông tin chưa được xác minh toàn diện:</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                {candidate.unverifiedFields.map((f, i) => (
                  <span key={i} style={{ backgroundColor: "#fef3c7", padding: "2px 6px", borderRadius: "4px" }}>
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Rejection input box */}
          {isRejectingOpen && (
            <div style={{ padding: "14px", backgroundColor: "#fef2f2", borderRadius: "8px", border: "1px solid #fecaca" }}>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#991b1b", marginBottom: "4px" }}>
                Lý do từ chối bản ghi:
              </label>
              <textarea
                rows={2}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Nhập lý do (ví dụ: Thiếu văn bản công nhận, không đúng chuyên ngành, v.v.)..."
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #fca5a5", fontSize: "0.85rem" }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button
                  onClick={() => setIsRejectingOpen(false)}
                  style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff", fontSize: "0.8rem" }}
                >
                  Hủy
                </button>
                <button
                  onClick={handleRejectConfirm}
                  disabled={isProcessing}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "#dc2626",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  Xác nhận Từ chối
                </button>
              </div>
            </div>
          )}

          {/* Subtle Technical Metadata for Admin */}
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "6px",
              backgroundColor: "#f8fafc",
              border: "1px dashed #cbd5e1",
              fontSize: "0.75rem",
              color: "#64748b",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <span>
              Thông tin kỹ thuật nội bộ (Admin): Mã đối soát <code>{candidate.journalId}</code>
            </span>
            <span>
              Hàng nguồn Google Sheets: #{candidate.sheetRowIndex || "—"}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#f8fafc",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <button
            onClick={onClose}
            disabled={isProcessing}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              backgroundColor: "#ffffff",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Đóng
          </button>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {!isRejectingOpen && (
              <button
                onClick={() => setIsRejectingOpen(true)}
                disabled={isProcessing}
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  border: "1px solid #fca5a5",
                  backgroundColor: "#fef2f2",
                  color: "#991b1b",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <XCircle size={15} />
                Từ chối
              </button>
            )}

            <button
              onClick={handleNeedsReview}
              disabled={isProcessing}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                border: "1px solid #fde047",
                backgroundColor: "#fefce8",
                color: "#854d0e",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <HelpCircle size={15} />
              Cần hiệu chỉnh
            </button>

            <button
              onClick={handleApprove}
              disabled={isProcessing}
              style={{
                padding: "8px 22px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#166534",
                color: "#ffffff",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <CheckCircle2 size={16} />
              {isProcessing ? "Đang xử lý..." : "Duyệt & Công bố"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
