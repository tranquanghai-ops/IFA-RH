import React from "react";
import type { Opportunity } from "../types";
import { Modal } from "./Modal";
import { formatDateVN, getOpportunityDeadlineInfo } from "../utils/date";
import {
  ExternalLink,
  Calendar,
  Building,
  Globe,
  MapPin,
  FileCheck,
  Lightbulb,
  DollarSign,
  Tag,
  Clock,
  Award,
} from "lucide-react";

interface OpportunityDetailModalProps {
  opportunity: Opportunity | null;
  onClose: () => void;
}

export const OpportunityDetailModal: React.FC<OpportunityDetailModalProps> = ({
  opportunity,
  onClose,
}) => {
  if (!opportunity) return null;

  const deadlineInfo = getOpportunityDeadlineInfo(opportunity);

  return (
    <Modal
      isOpen={!!opportunity}
      onClose={onClose}
      title="Chi tiết Thông tin Nghiên cứu Khoa học"
      maxWidth="large"
      footer={
        <div style={{ display: "flex", gap: 10, width: "100%", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            Nguồn: <strong style={{ color: "var(--text-main)" }}>Ban biên tập NCKH MTCN</strong>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {opportunity.sourceUrl && (
              <a
                href={opportunity.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
              >
                Trang web chính thức
                <ExternalLink size={14} />
              </a>
            )}
            {opportunity.submissionUrl && (
              <a
                href={opportunity.submissionUrl}
                target={opportunity.submissionUrl.startsWith("mailto:") ? undefined : "_blank"}
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm"
              >
                {opportunity.submissionUrl.startsWith("mailto:") ? "Gửi email nộp bài" : "Cổng nộp bài (Submission)"}
                <ExternalLink size={14} />
              </a>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header Block */}
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
            <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
              {opportunity.type}
            </span>
            <span className="badge badge-neutral">
              {opportunity.level}
            </span>
            <span
              className={`badge badge-${deadlineInfo.statusBadge.variant}`}
              style={{
                backgroundColor: deadlineInfo.statusBadge.bg,
                color: deadlineInfo.statusBadge.color,
                borderColor: deadlineInfo.statusBadge.border,
                fontWeight: 700,
              }}
            >
              <Clock size={12} style={{ marginRight: 2 }} />
              {deadlineInfo.statusBadge.text}
            </span>
          </div>

          <h2 style={{ fontSize: "1.4rem", color: "var(--primary)", lineHeight: 1.35, marginBottom: 10 }}>
            {opportunity.title}
          </h2>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", color: "var(--text-sub)", fontSize: "0.875rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Building size={16} color="var(--primary)" />
              <span>Đơn vị tổ chức: <strong>{opportunity.organizer}</strong></span>
            </div>
            {opportunity.country && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Globe size={16} color="var(--primary)" />
                <span>Quốc gia: <strong>{opportunity.country}</strong></span>
              </div>
            )}
            {opportunity.location && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <MapPin size={16} color="var(--primary)" />
                <span>Địa điểm / Hình thức: <strong>{opportunity.location}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Highlight Metadata Grid - Priority Order of Deadlines */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            background: "#f8fafc",
            padding: 16,
            borderRadius: 8,
            border: "1px solid var(--line)",
          }}
        >
          {/* Priority 1: Hạn nộp tóm tắt */}
          {opportunity.abstractDeadline && (
            <div
              style={{
                background: deadlineInfo.nearestDeadlineType === "abstract" && deadlineInfo.isUrgent ? "#fee2e2" : undefined,
                padding: deadlineInfo.nearestDeadlineType === "abstract" && deadlineInfo.isUrgent ? "6px 10px" : undefined,
                borderRadius: 6,
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                Hạn nộp tóm tắt (Abstract)
              </div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: deadlineInfo.nearestDeadlineType === "abstract" && deadlineInfo.isUrgent ? "#b91c1c" : "var(--text-main)", marginTop: 2 }}>
                {formatDateVN(opportunity.abstractDeadline)}
              </div>
            </div>
          )}

          {/* Priority 2: Hạn nộp toàn văn */}
          {(opportunity.fullPaperDeadline || opportunity.deadline) && (
            <div
              style={{
                background: deadlineInfo.nearestDeadlineType === "fullPaper" && deadlineInfo.isUrgent ? "#fee2e2" : undefined,
                padding: deadlineInfo.nearestDeadlineType === "fullPaper" && deadlineInfo.isUrgent ? "6px 10px" : undefined,
                borderRadius: 6,
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                Hạn nộp toàn văn (Full paper)
              </div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--danger)", marginTop: 2 }}>
                {formatDateVN(opportunity.fullPaperDeadline || opportunity.deadline) || "Chưa công bố"}
              </div>
            </div>
          )}

          {/* Priority 3: Hạn đăng ký */}
          {opportunity.registrationDeadline && (
            <div
              style={{
                background: deadlineInfo.nearestDeadlineType === "registration" && deadlineInfo.isUrgent ? "#fee2e2" : undefined,
                padding: deadlineInfo.nearestDeadlineType === "registration" && deadlineInfo.isUrgent ? "6px 10px" : undefined,
                borderRadius: 6,
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                Hạn đăng ký (Registration)
              </div>
              <div style={{ fontSize: "0.95rem", fontWeight: 600, color: deadlineInfo.nearestDeadlineType === "registration" && deadlineInfo.isUrgent ? "#b91c1c" : "var(--text-main)", marginTop: 2 }}>
                {formatDateVN(opportunity.registrationDeadline)}
              </div>
            </div>
          )}

          {/* Priority 4: Thời gian tổ chức */}
          {opportunity.eventDate && (
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                Thời gian tổ chức
              </div>
              <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--teal)", marginTop: 2 }}>
                {formatDateVN(opportunity.eventDate)}
              </div>
            </div>
          )}

          {opportunity.publicationFormat && (
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                Hình thức xuất bản
              </div>
              <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--teal)", marginTop: 2 }}>
                {opportunity.publicationFormat}
              </div>
            </div>
          )}

          {opportunity.indexing && (
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                Chỉ mục / Indexing
              </div>
              <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--secondary)", marginTop: 2 }}>
                {opportunity.indexing}
              </div>
            </div>
          )}

          {opportunity.fee && (
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                Lệ phí
              </div>
              <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-main)", marginTop: 2 }}>
                {opportunity.fee}
              </div>
            </div>
          )}
        </div>

        {/* Suitability for MTCN Faculty */}
        {opportunity.suitability && (
          <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "12px 16px", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: "#065f46", marginBottom: 4 }}>
              <Award size={18} />
              Mức độ phù hợp với Khoa Mỹ thuật Công nghiệp:
            </div>
            <div style={{ color: "#047857", fontSize: "0.95rem", fontWeight: 600 }}>{opportunity.suitability}</div>
          </div>
        )}

        {/* Field of MTCN */}
        {opportunity.field && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "12px 16px", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: "#166534", marginBottom: 4 }}>
              <FileCheck size={18} />
              Ngành đào tạo MTCN phù hợp:
            </div>
            <div style={{ color: "#14532d", fontSize: "0.9rem" }}>{opportunity.field}</div>
          </div>
        )}

        {/* Content */}
        <div>
          <h4 style={{ marginBottom: 8, color: "var(--primary)" }}>Nội dung & Chủ đề chi tiết</h4>
          <div
            style={{
              fontSize: "0.9375rem",
              lineHeight: 1.7,
              color: "var(--text-main)",
              whiteSpace: "pre-line",
            }}
          >
            {opportunity.content}
          </div>
        </div>

        {/* Directions / Advice for MTCN Lecturers */}
        {opportunity.directions && (
          <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", padding: "16px", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "#0369a1", marginBottom: 6 }}>
              <Lightbulb size={20} />
              Gợi ý định hướng bài viết cho Giảng viên MTCN:
            </div>
            <div style={{ color: "#0c4a6e", fontSize: "0.9rem", lineHeight: 1.6, whiteSpace: "pre-line" }}>
              {opportunity.directions}
            </div>
          </div>
        )}

        {/* Editorial / Curator Notes */}
        {opportunity.notes && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: "14px 16px", borderRadius: 8 }}>
            <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 4, fontSize: "0.85rem" }}>
              Ghi chú của chuyên gia tổng hợp:
            </div>
            <div style={{ color: "#78350f", fontSize: "0.875rem", lineHeight: 1.5 }}>
              {opportunity.notes}
            </div>
          </div>
        )}

        {/* Tags */}
        {opportunity.tags && opportunity.tags.length > 0 && (
          <div>
            <h5 style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: 6 }}>Từ khóa phân loại:</h5>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {opportunity.tags.map((tag, idx) => (
                <span key={idx} className="badge badge-neutral">
                  <Tag size={12} style={{ marginRight: 3 }} />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
