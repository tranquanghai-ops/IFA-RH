import React from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  RefreshCw,
} from "lucide-react";

export interface JournalSyncResultData {
  totalRead: number;
  newCandidatesCount: number;
  updatedCandidatesCount: number;
  unchangedCount: number;
  skippedDuplicates: number;
  manualReviewCount: number;
  warnings?: string[];
  batchId?: string;
}

export interface JournalSyncErrorData {
  message: string;
  stage?: string;
  collectionName?: string;
  operationType?: string;
  userSummary?: string;
  documentId?: string;
}

interface JournalSyncResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToQueue?: () => void;
  result: JournalSyncResultData | null;
  error: JournalSyncErrorData | null;
  onRetry?: () => void;
}

export const JournalSyncResultModal: React.FC<JournalSyncResultModalProps> = ({
  isOpen,
  onClose,
  onGoToQueue,
  result,
  error,
  onRetry,
}) => {
  if (!isOpen) return null;

  const isSuccess = !!result && !error;

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
          maxWidth: "600px",
          width: "100%",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: isSuccess ? "#f0fdf4" : "#fef2f2",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                backgroundColor: isSuccess ? "#dcfce7" : "#fee2e2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isSuccess ? "#166534" : "#991b1b",
              }}
            >
              {isSuccess ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  color: isSuccess ? "#14532d" : "#7f1d1d",
                }}
              >
                {isSuccess ? "Đồng bộ Google Sheets thành công" : "Lỗi đồng bộ Google Sheets"}
              </h3>
              <p
                style={{
                  margin: "2px 0 0 0",
                  fontSize: "0.8rem",
                  color: isSuccess ? "#166534" : "#991b1b",
                }}
              >
                {isSuccess
                  ? "Dữ liệu đã được nạp an toàn vào Hàng chờ duyệt"
                  : "Chẩn đoán chi tiết theo giai đoạn hệ thống"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* SUCCESS VIEW */}
          {isSuccess && result && (
            <>
              {/* Metrics Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                    TỔNG ĐỌC ĐƯỢC
                  </div>
                  <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "#0f172a", marginTop: "2px" }}>
                    {result.totalRead}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b" }}>hồ sơ từ Google Sheets</div>
                </div>

                <div
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    backgroundColor: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", color: "#1e40af", fontWeight: 600 }}>
                    TẠP CHÍ MỚI
                  </div>
                  <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "#1d4ed8", marginTop: "2px" }}>
                    {result.newCandidatesCount}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#3b82f6" }}>chờ Admin phê duyệt</div>
                </div>

                <div
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    backgroundColor: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", color: "#166534", fontWeight: 600 }}>
                    CẬP NHẬT
                  </div>
                  <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "#15803d", marginTop: "2px" }}>
                    {result.updatedCandidatesCount}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#22c55e" }}>có thay đổi nội dung</div>
                </div>
              </div>

              {/* Secondary metrics row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    backgroundColor: result.manualReviewCount > 0 ? "#fefce8" : "#f8fafc",
                    border: result.manualReviewCount > 0 ? "1px solid #fef08a" : "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: result.manualReviewCount > 0 ? "#854d0e" : "#475569" }}>
                      Cần kiểm tra thủ công
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                      Gắn cờ đối chiếu thông tin
                    </div>
                  </div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 800, color: result.manualReviewCount > 0 ? "#b45309" : "#64748b" }}>
                    {result.manualReviewCount}
                  </div>
                </div>

                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#475569" }}>
                      Bỏ qua / Không đổi
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                      Dữ liệu trùng khớp hoàn toàn
                    </div>
                  </div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#64748b" }}>
                    {result.skippedDuplicates + result.unchangedCount}
                  </div>
                </div>
              </div>

              {/* Informative notice */}
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "8px",
                  backgroundColor: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.82rem",
                  color: "#334155",
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: "3px" }}>
                  Nguyên tắc an toàn dữ liệu:
                </div>
                <div>
                  • Hồ sơ đồng bộ đã được đưa vào <strong>Hàng chờ duyệt</strong> và <strong>không tự động công bố</strong>.
                </div>
                <div>
                  • Các chỉnh sửa thủ công trước đó của Quản trị viên được giữ nguyên vẹn.
                </div>
                {result.manualReviewCount > 0 && (
                  <div style={{ marginTop: "4px", color: "#854d0e" }}>
                    • Có <strong>{result.manualReviewCount} hồ sơ</strong> cần Admin đối chiếu (nhiều khung điểm HĐGS hoặc thông tin website/thể lệ cần kiểm tra). Bạn có thể xem tại tab <strong>Cần hiệu chỉnh</strong>.
                  </div>
                )}
              </div>
            </>
          )}

          {/* ERROR VIEW */}
          {error && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div
                style={{
                  padding: "14px",
                  borderRadius: "8px",
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#991b1b", fontWeight: 700, fontSize: "0.9rem" }}>
                  <AlertCircle size={18} />
                  {error.userSummary || error.message}
                </div>
                {error.stage && (
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "10px",
                      backgroundColor: "#ffffff",
                      borderRadius: "6px",
                      border: "1px solid #fee2e2",
                      fontSize: "0.78rem",
                      fontFamily: "monospace",
                      color: "#7f1d1d",
                    }}
                  >
                    <div>Stage: <strong>{error.stage}</strong></div>
                    {error.collectionName && <div>Collection: <strong>{error.collectionName}</strong></div>}
                    {error.operationType && <div>Operation: <strong>{error.operationType}</strong></div>}
                    {error.documentId && <div>Document ID: <strong>{error.documentId}</strong></div>}
                    <div style={{ marginTop: "4px", color: "#991b1b" }}>Chi tiết: {error.message}</div>
                  </div>
                )}
              </div>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>
                Nếu gặp lỗi kết nối Google Sheets hoặc quyền hạn, bạn có thể kiểm tra lại cấu hình nguồn qua biểu tượng bánh răng.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "7px 14px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              backgroundColor: "#ffffff",
              color: "#475569",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Đóng
          </button>

          {isSuccess && onGoToQueue && (
            <button
              onClick={() => {
                onClose();
                onGoToQueue();
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 16px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#1e3a8a",
                color: "#ffffff",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
              }}
            >
              <span>Xem Hàng chờ duyệt</span>
              <ArrowRight size={15} />
            </button>
          )}

          {error && onRetry && (
            <button
              onClick={onRetry}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 16px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#1e3a8a",
                color: "#ffffff",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <RefreshCw size={15} />
              <span>Thử lại</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
