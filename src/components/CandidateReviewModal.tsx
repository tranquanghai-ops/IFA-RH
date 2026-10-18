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
  Sparkles,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Link2,
} from "lucide-react";
import { useAuth } from "../firebase/auth";
import { useToast } from "../context/ToastContext";
import {
  getOrCreateCandidatePreview,
  revokeCandidatePreview,
  fetchOpportunityPreview,
} from "../firebase/firestore";
import {
  buildOpportunityShareUrl,
  buildCandidatePreviewUrl,
  copyTextToClipboard,
} from "../utils/share";

interface CandidateReviewModalProps {
  candidate: OpportunityCandidate | null;
  onClose: () => void;
  onApprove: (cand: OpportunityCandidate) => Promise<void>;
  onReject: (candId: string, candTitle: string, reason: string) => Promise<void>;
  onDelete: (candId: string, candTitle: string) => Promise<void>;
  onNeedsReview?: (candId: string, candTitle: string, reason: string) => Promise<void>;
  onRecall?: (cand: OpportunityCandidate) => Promise<void>;
}

export const CandidateReviewModal: React.FC<CandidateReviewModalProps> = ({
  candidate,
  onClose,
  onApprove,
  onReject,
  onDelete,
  onNeedsReview,
  onRecall,
}) => {
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [needsReviewing, setNeedsReviewing] = useState(false);
  const [needsReviewReason, setNeedsReviewReason] = useState("");
  const [confirmingRecall, setConfirmingRecall] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { profile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [hasActivePreview, setHasActivePreview] = useState(false);
  const [copyingLink, setCopyingLink] = useState(false);

  // Track expanded state for long diff fields
  const [expandedDiffs, setExpandedDiffs] = useState<Record<number, boolean>>({});
  // Track expanded state for description & directions
  const [showFullContent, setShowFullContent] = useState(false);
  const [showFullDirections, setShowFullDirections] = useState(false);
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);

  React.useEffect(() => {
    setError("");
    setRejecting(false);
    setRejectReason("");
    setNeedsReviewing(false);
    setNeedsReviewReason("");
    setConfirmingRecall(false);
    setConfirmingDelete(false);
    setLoading(false);
    setExpandedDiffs({});
    setShowFullContent(false);
    setShowFullDirections(false);
    setShowAdditionalInfo(false);

    if (candidate) {
      let isMounted = true;
      fetchOpportunityPreview(`prev_${candidate.id}`)
        .then((prev) => {
          if (isMounted) setHasActivePreview(Boolean(prev && prev.status === "active"));
        })
        .catch(() => {
          if (isMounted) setHasActivePreview(false);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [candidate?.id]);

  if (!candidate) return null;

  const isUpdate =
    candidate.changeType === "update" ||
    candidate.resolutionType === "PENDING_UPDATE" ||
    Boolean(candidate.publishedOpportunityId && candidate.diffSummary && candidate.diffSummary.length > 0);

  const modalTitle = isUpdate
    ? `Đề xuất cập nhật · ${candidate.conferenceCode || "Hội thảo"}`
    : `Hồ sơ hội thảo · ${candidate.conferenceCode || candidate.title}`;

  const toggleDiffExpand = (idx: number) => {
    setExpandedDiffs((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleApprove = async () => {
    try {
      setLoading(true);
      setError("");
      await onApprove(candidate);
      onClose();
    } catch (err: any) {
      console.error("[CandidateReviewModal] Approve Error:", {
        candidateId: candidate?.id,
        conferenceCode: candidate?.conferenceCode,
        title: candidate?.title,
        errorCode: err?.code,
        errorMessage: err?.message,
        originalError: err,
      });
      setError("Không thể duyệt hội thảo. Hệ thống chưa thể lưu thay đổi. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      setError("Vui lòng nhập lý do từ chối.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      await onReject(candidate.id, candidate.title, rejectReason);
      setRejecting(false);
      onClose();
    } catch (err: any) {
      console.error("[CandidateReviewModal] Reject Error:", err);
      setError("Không thể từ chối hội thảo. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmNeedsReview = async () => {
    if (!onNeedsReview) return;
    try {
      setLoading(true);
      setError("");
      await onNeedsReview(candidate.id, candidate.title, needsReviewReason);
      setNeedsReviewing(false);
      onClose();
    } catch (err: any) {
      console.error("[CandidateReviewModal] NeedsReview Error:", err);
      setError("Không thể cập nhật trạng thái cần hiệu chỉnh. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRecall = async () => {
    if (!onRecall) return;
    try {
      setLoading(true);
      setError("");
      await onRecall(candidate);
      setConfirmingRecall(false);
      onClose();
    } catch (err: any) {
      console.error("[CandidateReviewModal] Recall Error:", err);
      setError("Không thể thu hồi hội thảo. Hệ thống chưa thể lưu thay đổi. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    try {
      setLoading(true);
      setError("");
      await onDelete(candidate.id, candidate.title);
      setConfirmingDelete(false);
      onClose();
    } catch (err: any) {
      console.error("[CandidateReviewModal] Delete Error:", err);
      setError("Không thể xóa hồ sơ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!candidate || !profile) return;
    try {
      setCopyingLink(true);
      if (candidate.publishedOpportunityId) {
        const url = buildOpportunityShareUrl(candidate.publishedOpportunityId);
        await copyTextToClipboard(url);
        showSuccess("Đã sao chép liên kết hội thảo.");
        return;
      }

      const preview = await getOrCreateCandidatePreview(candidate, {
        uid: profile.uid,
        email: profile.email,
        role: profile.role,
      });
      setHasActivePreview(true);
      const url = buildCandidatePreviewUrl(preview.id);
      await copyTextToClipboard(url);
      showSuccess("Đã sao chép liên kết xem trước.");
    } catch (err: any) {
      console.error("[CandidateReviewModal] Copy link error:", err);
      showError("Không thể tạo liên kết xem trước.", err);
    } finally {
      setCopyingLink(false);
    }
  };

  const handleRevokePreview = async () => {
    if (!candidate || !profile) return;
    try {
      setLoading(true);
      await revokeCandidatePreview(candidate.id, {
        uid: profile.uid,
        email: profile.email,
        role: profile.role,
      });
      setHasActivePreview(false);
      showSuccess("Đã thu hồi liên kết xem trước.");
    } catch (err: any) {
      console.error("[CandidateReviewModal] Revoke preview error:", err);
      showError("Không thể thu hồi liên kết xem trước.", err);
    } finally {
      setLoading(false);
    }
  };

  const hasSubstantiveDiffs = Boolean(candidate.diffSummary && candidate.diffSummary.length > 0);

  return (
    <Modal
      isOpen={!!candidate}
      onClose={onClose}
      title={modalTitle}
      maxWidth="large"
      footer={
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
          {error && (
            <div
              style={{
                background: "#fff1f2",
                color: "#9f1239",
                border: "1px solid #fecdd3",
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#9f1239", fontWeight: "bold" }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Inline Action Confirmations */}
          {confirmingRecall && (
            <div
              style={{
                background: "#fff1f2",
                border: "1px solid #fecdd3",
                borderRadius: 8,
                padding: "12px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div style={{ fontSize: "0.85rem", color: "#9f1239" }}>
                <strong>Thu hồi hội thảo?</strong> Hội thảo sẽ được gỡ khỏi trang công khai và chuyển về danh sách chờ duyệt.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setConfirmingRecall(false)}
                  disabled={loading}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleConfirmRecall}
                  disabled={loading}
                  style={{ background: "#e11d48", color: "#fff", border: "none", fontWeight: 600 }}
                >
                  {loading ? "Đang thu hồi..." : "Thu hồi"}
                </button>
              </div>
            </div>
          )}

          {confirmingDelete && (
            <div
              style={{
                background: "#fff1f2",
                border: "1px solid #fecdd3",
                borderRadius: 8,
                padding: "12px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div style={{ fontSize: "0.85rem", color: "#9f1239" }}>
                <strong>Xóa hồ sơ?</strong> Thao tác này sẽ xóa ứng viên khỏi hệ thống và không thể hoàn tác.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={loading}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleConfirmDelete}
                  disabled={loading}
                  style={{ background: "#e11d48", color: "#fff", border: "none", fontWeight: 600 }}
                >
                  {loading ? "Đang xóa..." : "Xóa vĩnh viễn"}
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons Row */}
          {!confirmingRecall && !confirmingDelete && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {candidate.status !== "approved" && (
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => setConfirmingDelete(true)}
                    disabled={loading}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                  >
                    <Trash2 size={14} />
                    Xóa
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopyLink}
                  disabled={loading || copyingLink}
                  title={candidate.publishedOpportunityId ? "Sao chép liên kết hội thảo" : "Lấy liên kết xem trước"}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                >
                  <Link2 size={14} />
                  {copyingLink
                    ? "Đang tạo..."
                    : candidate.publishedOpportunityId
                    ? "Sao chép liên kết"
                    : "Lấy link xem trước"}
                </button>

                {!candidate.publishedOpportunityId && hasActivePreview && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleRevokePreview}
                    disabled={loading}
                    title="Thu hồi liên kết xem trước công khai"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      background: "#fff1f2",
                      color: "#e11d48",
                      border: "1px solid #fecdd3",
                      fontSize: "0.8rem",
                    }}
                  >
                    Thu hồi link xem trước
                  </button>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {candidate.status !== "approved" && !rejecting && !needsReviewing && (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setRejecting(true)}
                      disabled={loading}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                    >
                      <XCircle size={15} />
                      Từ chối
                    </button>

                    {onNeedsReview && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setNeedsReviewing(true)}
                        disabled={loading}
                        style={{ color: "#d97706" }}
                      >
                        Cần hiệu chỉnh
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn btn-success btn-sm"
                      onClick={handleApprove}
                      disabled={loading}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
                    >
                      <CheckCircle size={16} />
                      {loading
                        ? "Đang lưu thay đổi..."
                        : isUpdate
                        ? "Duyệt cập nhật"
                        : "Duyệt công bố"}
                    </button>
                  </>
                )}

                {candidate.status === "approved" && onRecall && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setConfirmingRecall(true)}
                    disabled={loading}
                    style={{
                      background: "#fff1f2",
                      color: "#be123c",
                      border: "1px solid #fecdd3",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <RotateCcw size={15} />
                    Thu hồi về hàng chờ
                  </button>
                )}

                <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
                  Đóng
                </button>
              </div>
            </div>
          )}
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Update Proposal Comparison Table */}
        {isUpdate && hasSubstantiveDiffs && (
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 8,
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#166534",
                fontWeight: 700,
                fontSize: "0.95rem",
                marginBottom: 8,
              }}
            >
              <Sparkles size={17} />
              Bảng so sánh đề xuất cập nhật ({candidate.diffSummary!.length} trường thay đổi)
            </div>

            <div
              style={{
                overflowX: "auto",
                background: "#ffffff",
                borderRadius: 6,
                border: "1px solid #cbd5e1",
              }}
            >
              <table style={{ width: "100%", fontSize: "0.82rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", width: "24%", fontWeight: 650 }}>
                      Thông tin
                    </th>
                    <th style={{ padding: "8px 12px", textAlign: "left", width: "38%", color: "#64748b" }}>
                      Hiện tại
                    </th>
                    <th style={{ padding: "8px 12px", textAlign: "left", width: "38%", color: "#166534" }}>
                      Đề xuất
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {candidate.diffSummary!.map((d, idx) => {
                    const isLongText =
                      (d.oldValue && String(d.oldValue).length > 90) ||
                      (d.newValue && String(d.newValue).length > 90);
                    const isExpanded = expandedDiffs[idx];

                    return (
                      <tr
                        key={idx}
                        style={{
                          borderBottom:
                            idx < candidate.diffSummary!.length - 1 ? "1px solid #f1f5f9" : "none",
                        }}
                      >
                        <td style={{ padding: "8px 12px", fontWeight: 600, verticalAlign: "top" }}>
                          {d.label || d.field}
                        </td>
                        <td style={{ padding: "8px 12px", color: "#64748b", verticalAlign: "top" }}>
                          <div
                            style={
                              isLongText && !isExpanded
                                ? {
                                    display: "-webkit-box",
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                  }
                                : {}
                            }
                          >
                            {String(d.oldValue || "(Chưa có)")}
                          </div>
                        </td>
                        <td style={{ padding: "8px 12px", fontWeight: 600, color: "#15803d", verticalAlign: "top" }}>
                          <div
                            style={
                              isLongText && !isExpanded
                                ? {
                                    display: "-webkit-box",
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                  }
                                : {}
                            }
                          >
                            {String(d.newValue || "")}
                          </div>
                          {isLongText && (
                            <button
                              type="button"
                              onClick={() => toggleDiffExpand(idx)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#2563eb",
                                fontSize: "0.75rem",
                                padding: 0,
                                marginTop: 4,
                                cursor: "pointer",
                                fontWeight: 500,
                              }}
                            >
                              {isExpanded ? "Thu gọn" : "Xem đầy đủ"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reject reason input prompt */}
        {rejecting && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: 14, borderRadius: 8 }}>
            <h4 style={{ color: "#92400e", marginBottom: 6, fontSize: "0.95rem" }}>Xác nhận từ chối cơ hội</h4>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label" style={{ fontSize: "0.85rem", fontWeight: 600 }}>Lý do từ chối:</label>
              <input
                type="text"
                className="form-control"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ví dụ: Không đúng ngành MTCN / Phí quá cao / Trang web nguồn không uy tín..."
                autoFocus
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
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

        {/* Needs review input prompt */}
        {needsReviewing && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: 14, borderRadius: 8 }}>
            <h4 style={{ color: "#92400e", marginBottom: 6, fontSize: "0.95rem" }}>Yêu cầu hiệu chỉnh thông tin</h4>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label" style={{ fontSize: "0.85rem", fontWeight: 600 }}>Ghi chú hiệu chỉnh:</label>
              <input
                type="text"
                className="form-control"
                value={needsReviewReason}
                onChange={(e) => setNeedsReviewReason(e.target.value)}
                placeholder="Ví dụ: Cần bổ sung mức phí chính thức / Cần cập nhật đúng deadline..."
                autoFocus
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-warning btn-sm"
                onClick={handleConfirmNeedsReview}
                disabled={loading}
              >
                Xác nhận yêu cầu hiệu chỉnh
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setNeedsReviewing(false)}
              >
                Hủy
              </button>
            </div>
          </div>
        )}

        {/* Header & Badges */}
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
            {candidate.conferenceCode && (
              <span
                className="badge"
                style={{
                  backgroundColor: candidate.conferenceCode.startsWith("QT") ? "#fef3c7" : "#e0e7ff",
                  color: candidate.conferenceCode.startsWith("QT") ? "#92400e" : "#3730a3",
                  border: `1px solid ${candidate.conferenceCode.startsWith("QT") ? "#fde68a" : "#c7d2fe"}`,
                  fontWeight: 800,
                  fontSize: "0.75rem",
                  padding: "3px 8px",
                  letterSpacing: "0.5px",
                }}
              >
                {candidate.conferenceCode}
              </span>
            )}
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
              {candidate.status === "approved"
                ? "Đã duyệt"
                : candidate.status === "rejected"
                ? "Đã từ chối"
                : isUpdate
                ? "Cập nhật chờ duyệt"
                : "Chờ duyệt"}
            </span>
          </div>

          <h2 style={{ fontSize: "1.25rem", color: "var(--primary)", lineHeight: 1.35, margin: "6px 0 8px 0" }}>
            {candidate.title}
          </h2>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", color: "var(--text-sub)", fontSize: "0.85rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Building size={15} />
              <span>Đơn vị tổ chức: <strong>{candidate.organizer}</strong></span>
            </div>
            {candidate.country && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Globe size={15} />
                <span>Quốc gia: <strong>{candidate.country}</strong></span>
              </div>
            )}
            {candidate.location && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <MapPin size={15} />
                <span>Địa điểm: <strong>{candidate.location}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Timelines and Deadlines */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
            background: "#f8fafc",
            padding: 14,
            borderRadius: 8,
            border: "1px solid var(--line)",
          }}
        >
          <div>
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 700 }}>HẠN NỘP TOÀN VĂN</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--danger)" }}>
              {formatDateVN(candidate.fullPaperDeadline || candidate.deadline) || "Chưa có thông tin"}
            </div>
          </div>
          {candidate.abstractDeadline && (
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 700 }}>HẠN ABSTRACT</div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{formatDateVN(candidate.abstractDeadline)}</div>
            </div>
          )}
          {candidate.eventDate && (
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 700 }}>NGÀY TỔ CHỨC</div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--teal)" }}>{formatDateVN(candidate.eventDate)}</div>
            </div>
          )}
          {candidate.publicationFormat && (
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 700 }}>HÌNH THỨC XUẤT BẢN</div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--teal)" }}>{candidate.publicationFormat}</div>
            </div>
          )}
        </div>

        {/* Fees Section */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "10px 14px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 700 }}>PHÍ ĐĂNG BÀI / XUẤT BẢN</div>
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-main)", marginTop: 2 }}>
              {getPublicationFeeDisplay(candidate)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 700 }}>PHÍ THAM DỰ / ĐẠI BIỂU</div>
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-main)", marginTop: 2 }}>
              {getRegistrationFeeDisplay(candidate)}
            </div>
          </div>
        </div>

        {/* Suitability Field */}
        {candidate.field && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "10px 14px", borderRadius: 8, fontSize: "0.85rem" }}>
            <strong style={{ color: "#166534" }}>Ngành MTCN phù hợp:</strong> {candidate.field}
          </div>
        )}

        {/* Content with Collapsible Reading */}
        {candidate.content && (
          <div>
            <h4 style={{ marginBottom: 4, color: "var(--primary)", fontSize: "0.9rem" }}>Mô tả nội dung</h4>
            <div
              style={{
                fontSize: "0.85rem",
                color: "var(--text-main)",
                whiteSpace: "pre-line",
                lineHeight: 1.5,
                ...(showFullContent
                  ? {}
                  : {
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }),
              }}
            >
              {candidate.content}
            </div>
            {candidate.content.length > 180 && (
              <button
                type="button"
                onClick={() => setShowFullContent(!showFullContent)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#2563eb",
                  fontSize: "0.78rem",
                  padding: 0,
                  marginTop: 4,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {showFullContent ? "Thu gọn mô tả" : "Xem đầy đủ mô tả"}
              </button>
            )}
          </div>
        )}

        {/* Directions with Collapsible Reading */}
        {candidate.directions && (
          <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", padding: "10px 14px", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: "#0369a1", marginBottom: 3, fontSize: "0.85rem" }}>
              <Lightbulb size={16} />
              Gợi ý bài viết cho GV MTCN:
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                color: "#0c4a6e",
                lineHeight: 1.5,
                ...(showFullDirections
                  ? {}
                  : {
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }),
              }}
            >
              {candidate.directions}
            </div>
            {candidate.directions.length > 140 && (
              <button
                type="button"
                onClick={() => setShowFullDirections(!showFullDirections)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#0369a1",
                  fontSize: "0.78rem",
                  padding: 0,
                  marginTop: 4,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {showFullDirections ? "Thu gọn gợi ý" : "Xem đầy đủ gợi ý"}
              </button>
            )}
          </div>
        )}

        {/* Links */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", borderTop: "1px solid var(--line)", paddingTop: 10 }}>
          {candidate.sourceUrl && (
            <a
              href={candidate.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              Link nguồn chính thức
              <ExternalLink size={13} />
            </a>
          )}
          {candidate.submissionUrl && (
            <a
              href={candidate.submissionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              Link nộp bài
              <ExternalLink size={13} />
            </a>
          )}
        </div>

        {/* Collapsible Additional Metadata */}
        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 8 }}>
          <button
            type="button"
            onClick={() => setShowAdditionalInfo(!showAdditionalInfo)}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              fontSize: "0.78rem",
              fontWeight: 600,
              padding: "4px 0",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {showAdditionalInfo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Thông tin kỹ thuật & bổ sung
          </button>

          {showAdditionalInfo && (
            <div
              style={{
                marginTop: 6,
                padding: "8px 12px",
                background: "#f8fafc",
                borderRadius: 6,
                fontSize: "0.78rem",
                color: "#64748b",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 6,
              }}
            >
              <div>Thời điểm phát hiện: <strong>{formatDateVN(candidate.discoveredAt || candidate.createdAt)}</strong></div>
              {candidate.lastUpdated && <div>Spark cập nhật: <strong>{candidate.lastUpdated}</strong></div>}
              {candidate.indexing && <div>Chỉ mục kỷ yếu: <strong>{candidate.indexing}</strong></div>}
              {candidate.runId && <div>Mã phiên chạy Spark: <strong>{candidate.runId}</strong></div>}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
