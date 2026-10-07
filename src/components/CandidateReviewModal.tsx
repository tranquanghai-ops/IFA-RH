import React, { useState } from "react";
import type { OpportunityCandidate } from "../types";
import { Modal } from "./Modal";
import { formatDateVN } from "../utils/date";
import { getPublicationFeeDisplay, getRegistrationFeeDisplay } from "../utils/fee";
import {
  ExternalLink,
  CheckCircle,
  XCircle,
  Building,
  Globe,
  MapPin,
  Calendar,
  FileText,
  Lightbulb,
  DollarSign,
  Layers,
} from "lucide-react";

interface CandidateReviewModalProps {
  candidate: OpportunityCandidate | null;
  onClose: () => void;
  onApprove: (cand: OpportunityCandidate) => Promise<void>;
  onReject: (candId: string, candTitle: string, reason: string) => Promise<void>;
  onDelete: (candId: string, candTitle: string) => Promise<void>;
}

export const CandidateReviewModal: React.FC<CandidateReviewModalProps> = ({
  candidate,
  onClose,
  onApprove,
  onReject,
  onDelete,
}) => {
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!candidate) return null;

  const handleApprove = async () => {
    try {
      setLoading(true);
      setError("");
      await onApprove(candidate);
      onClose();
    } catch (err: any) {
      setError(err.message || "Lỗi duyệt cơ hội.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      setError("Vui lòng nhập lý do từ chối!");
      return;
    }
    try {
      setLoading(true);
      setError("");
      await onReject(candidate.id, candidate.title, rejectReason);
      setRejecting(false);
      onClose();
    } catch (err: any) {
      setError(err.message || "Lỗi từ chối cơ hội.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn ứng viên "${candidate.title}"?`)) {
      return;
    }
    try {
      setLoading(true);
      setError("");
      await onDelete(candidate.id, candidate.title);
      onClose();
    } catch (err: any) {
      setError(err.message || "Lỗi xóa ứng viên.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={!!candidate}
      onClose={onClose}
      title="Kiểm duyệt Cơ hội AI / Spark tìm được"
      maxWidth="large"
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <div>
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              onClick={handleDelete}
              disabled={loading}
            >
              Xóa bỏ
            </button>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            {candidate.status === "pending" && !rejecting && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setRejecting(true)}
                  disabled={loading}
                >
                  <XCircle size={16} />
                  Từ chối
                </button>
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  onClick={handleApprove}
                  disabled={loading}
                >
                  <CheckCircle size={16} />
                  Duyệt & Công bố Public
                </button>
              </>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {error && (
          <div style={{ background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 6 }}>
            {error}
          </div>
        )}

        {/* Reject reason input prompt */}
        {rejecting && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: 16, borderRadius: 8 }}>
            <h4 style={{ color: "#92400e", marginBottom: 8 }}>Xác nhận từ chối cơ hội</h4>
            <div className="form-group">
              <label className="form-label">Lý do từ chối:</label>
              <input
                type="text"
                className="form-control"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ví dụ: Không đúng ngành MTCN / Phí quá cao / Trang web nguồn không uy tín..."
                autoFocus
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleConfirmReject}
                disabled={loading}
              >
                Xác nhận từ chối
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setRejecting(false)}
              >
                Hủy
              </button>
            </div>
          </div>
        )}

        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
            <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
              {candidate.type}
            </span>
            <span className="badge badge-neutral">{candidate.level}</span>
            <span
              className={`badge ${
                candidate.status === "approved"
                  ? "badge-success"
                  : candidate.status === "rejected"
                  ? "badge-warning"
                  : "badge-new"
              }`}
            >
              Trạng thái: {candidate.status.toUpperCase()}
            </span>
          </div>

          <h2 style={{ fontSize: "1.35rem", color: "var(--primary)", lineHeight: 1.35, marginBottom: 10 }}>
            {candidate.title}
          </h2>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", color: "var(--text-sub)", fontSize: "0.875rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Building size={16} />
              <span>Đơn vị tổ chức: <strong>{candidate.organizer}</strong></span>
            </div>
            {candidate.country && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Globe size={16} />
                <span>Quốc gia: <strong>{candidate.country}</strong></span>
              </div>
            )}
            {candidate.location && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <MapPin size={16} />
                <span>Địa điểm: <strong>{candidate.location}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Timelines and Metadata */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
            background: "#f8fafc",
            padding: 16,
            borderRadius: 8,
            border: "1px solid var(--line)",
          }}
        >
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700 }}>HẠN NỘP TOÀN VĂN</div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--danger)" }}>
              {formatDateVN(candidate.fullPaperDeadline || candidate.deadline) || "Chưa có thông tin"}
            </div>
          </div>
          {candidate.abstractDeadline && (
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700 }}>HẠN ABSTRACT</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>{formatDateVN(candidate.abstractDeadline)}</div>
            </div>
          )}
          {candidate.registrationDeadline && (
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700 }}>HẠN ĐĂNG KÝ</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>{formatDateVN(candidate.registrationDeadline)}</div>
            </div>
          )}
          {candidate.eventDate && (
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700 }}>NGÀY TỔ CHỨC</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--teal)" }}>{formatDateVN(candidate.eventDate)}</div>
            </div>
          )}
          {candidate.publicationFormat && (
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700 }}>HÌNH THỨC XUẤT BẢN</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--teal)" }}>{candidate.publicationFormat}</div>
            </div>
          )}
        </div>

        {/* Fees Section */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "12px 16px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700 }}>PHÍ ĐĂNG BÀI / XUẤT BẢN</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-main)", marginTop: 2 }}>
              {getPublicationFeeDisplay(candidate)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700 }}>PHÍ THAM DỰ / ĐẠI BIỂU</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-main)", marginTop: 2 }}>
              {getRegistrationFeeDisplay(candidate)}
            </div>
          </div>
        </div>

        {/* Suitability */}
        {candidate.field && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "12px 16px", borderRadius: 8 }}>
            <strong style={{ color: "#166534" }}>Ngành MTCN phù hợp:</strong> {candidate.field}
          </div>
        )}

        {/* Content */}
        <div>
          <h4 style={{ marginBottom: 6, color: "var(--primary)" }}>Mô tả nội dung</h4>
          <p style={{ fontSize: "0.9rem", color: "var(--text-main)", whiteSpace: "pre-line" }}>
            {candidate.content}
          </p>
        </div>

        {/* Directions */}
        {candidate.directions && (
          <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", padding: 14, borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: "#0369a1", marginBottom: 4 }}>
              <Lightbulb size={18} />
              Gợi ý bài viết cho GV MTCN:
            </div>
            <div style={{ fontSize: "0.875rem", color: "#0c4a6e" }}>{candidate.directions}</div>
          </div>
        )}

        {/* Links */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          {candidate.sourceUrl && (
            <a
              href={candidate.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              Mở link nguồn chính thức
              <ExternalLink size={14} />
            </a>
          )}
          {candidate.submissionUrl && (
            <a
              href={candidate.submissionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              Mở link nộp bài
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
    </Modal>
  );
};
