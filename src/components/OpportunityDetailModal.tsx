import React from "react";
import type { Opportunity } from "../types";
import { Modal } from "./Modal";
import { formatDateVN, getOpportunityDeadlineInfo } from "../utils/date";
import {
  getPublicationFeeDisplay,
  getRegistrationFeeDisplay,
  getFeeStatusInfo,
  UNKNOWN_FEE_TEXT,
  FREE_FEE_TEXT,
} from "../utils/fee";
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
  FileText,
  CheckCircle2,
  HelpCircle,
  BookOpen,
  Layers,
  AlertCircle,
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
  const feeStatusInfo = getFeeStatusInfo(opportunity);
  const publicationFee = getPublicationFeeDisplay(opportunity);
  const registrationFee = getRegistrationFeeDisplay(opportunity);

  // Formatted deadline values with fallback
  const abstractFormatted = formatDateVN(opportunity.abstractDeadline);
  const fullPaperFormatted = formatDateVN(
    opportunity.fullPaperDeadline || opportunity.deadline
  );
  const registrationDeadlineFormatted = formatDateVN(
    opportunity.registrationDeadline
  );
  const eventDateFormatted = formatDateVN(opportunity.eventDate);

  // Topics list extraction
  const topicsList =
    opportunity.topicsDetailed && opportunity.topicsDetailed.length > 0
      ? opportunity.topicsDetailed
      : opportunity.topic
      ? opportunity.topic
          .split(/[\n;]/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      : [];

  // Directions list extraction
  const directionsLines = opportunity.directions
    ? opportunity.directions
        .split(/\n|(?=\b\d+\.\s)/)
        .map((d) => d.trim())
        .filter((d) => d.length > 0)
    : [];

  return (
    <Modal
      isOpen={!!opportunity}
      onClose={onClose}
      title="Chi tiết Thông tin Nghiên cứu Khoa học"
      maxWidth="large"
      footer={
        <div
          style={{
            display: "flex",
            gap: 10,
            width: "100%",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            Nguồn: <strong style={{ color: "var(--text-main)" }}>Ban biên tập NCKH Khoa MTCN</strong>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {opportunity.sourceUrl && (
              <a
                href={opportunity.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
              >
                <span>Đến trang gốc</span>
                <ExternalLink size={14} />
              </a>
            )}
            {opportunity.submissionUrl &&
              !opportunity.submissionUrl.startsWith("mailto:") &&
              /^https?:\/\//i.test(opportunity.submissionUrl) && (
                <a
                  href={opportunity.submissionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                >
                  <span>Cổng nộp bài (Submission)</span>
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
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {/* ========================================================= */}
        {/* 1. Header Block & Metadata */}
        {/* ========================================================= */}
        <div>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 10,
              flexWrap: "wrap",
            }}
          >
            {opportunity.type && (
              <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
                {opportunity.type}
              </span>
            )}
            {opportunity.level && (
              <span className="badge badge-neutral">
                {opportunity.level}
              </span>
            )}
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
            <span
              className="badge"
              style={{
                backgroundColor: feeStatusInfo.bg,
                color: feeStatusInfo.color,
                borderColor: feeStatusInfo.border,
                fontWeight: 600,
                fontSize: "0.75rem",
              }}
            >
              <DollarSign size={12} style={{ marginRight: 2 }} />
              {feeStatusInfo.label}
            </span>
          </div>

          <h2
            style={{
              fontSize: "1.35rem",
              color: "var(--primary)",
              lineHeight: 1.4,
              marginBottom: 12,
              fontWeight: 700,
            }}
          >
            {opportunity.title}
          </h2>

          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              color: "var(--text-sub)",
              fontSize: "0.875rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Building size={16} color="var(--primary)" />
              <span>
                Đơn vị tổ chức: <strong>{opportunity.organizer}</strong>
              </span>
            </div>
            {opportunity.country && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Globe size={16} color="var(--primary)" />
                <span>
                  Quốc gia: <strong>{opportunity.country}</strong>
                </span>
              </div>
            )}
            {opportunity.location && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <MapPin size={16} color="var(--teal)" />
                <span>
                  Địa điểm / Hình thức: <strong>{opportunity.location}</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. Mục THỜI HẠN (Tách bạch rõ ràng 4 mốc quan trọng) */}
        {/* ========================================================= */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: "16px 18px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 700,
              fontSize: "0.95rem",
              color: "var(--primary)",
              marginBottom: 12,
            }}
          >
            <Calendar size={18} />
            <span>Các mốc thời hạn quan trọng</span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 12,
            }}
          >
            {/* Mốc 1: Hạn nộp tóm tắt */}
            <div
              style={{
                background:
                  deadlineInfo.nearestDeadlineType === "abstract" && deadlineInfo.isUrgent
                    ? "#fee2e2"
                    : "#f8fafc",
                border:
                  deadlineInfo.nearestDeadlineType === "abstract" && deadlineInfo.isUrgent
                    ? "1px solid #fecaca"
                    : "1px solid var(--line)",
                padding: "12px 14px",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                }}
              >
                Hạn nộp tóm tắt (Abstract)
              </div>
              <div
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color:
                    deadlineInfo.nearestDeadlineType === "abstract" && deadlineInfo.isUrgent
                      ? "#b91c1c"
                      : abstractFormatted
                      ? "var(--text-main)"
                      : "var(--muted)",
                  marginTop: 4,
                }}
              >
                {abstractFormatted || "Chưa có thông tin"}
              </div>
            </div>

            {/* Mốc 2: Hạn nộp toàn văn */}
            <div
              style={{
                background:
                  deadlineInfo.nearestDeadlineType === "fullPaper" && deadlineInfo.isUrgent
                    ? "#fee2e2"
                    : "#fff7ed",
                border:
                  deadlineInfo.nearestDeadlineType === "fullPaper" && deadlineInfo.isUrgent
                    ? "1px solid #fecaca"
                    : "1px solid #fed7aa",
                padding: "12px 14px",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#9a3412",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                }}
              >
                Hạn nộp toàn văn (Full paper)
              </div>
              <div
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "var(--danger)",
                  marginTop: 4,
                }}
              >
                {fullPaperFormatted || "Chưa có thông tin"}
              </div>
            </div>

            {/* Mốc 3: Hạn đăng ký */}
            <div
              style={{
                background:
                  deadlineInfo.nearestDeadlineType === "registration" && deadlineInfo.isUrgent
                    ? "#fee2e2"
                    : "#f8fafc",
                border:
                  deadlineInfo.nearestDeadlineType === "registration" && deadlineInfo.isUrgent
                    ? "1px solid #fecaca"
                    : "1px solid var(--line)",
                padding: "12px 14px",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                }}
              >
                Hạn đăng ký (Registration)
              </div>
              <div
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color:
                    deadlineInfo.nearestDeadlineType === "registration" && deadlineInfo.isUrgent
                      ? "#b91c1c"
                      : registrationDeadlineFormatted
                      ? "var(--text-main)"
                      : "var(--muted)",
                  marginTop: 4,
                }}
              >
                {registrationDeadlineFormatted || "Chưa có thông tin"}
              </div>
            </div>

            {/* Mốc 4: Ngày diễn ra sự kiện */}
            <div
              style={{
                background: "#f0fdfa",
                border: "1px solid #ccfbf1",
                padding: "12px 14px",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#0f766e",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                }}
              >
                Ngày tổ chức / Xuất bản
              </div>
              <div
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color: "#0d9488",
                  marginTop: 4,
                }}
              >
                {eventDateFormatted || "Chưa có thông tin"}
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 3. Mục CHI PHÍ (Dedicated Section per User Requirement) */}
        {/* ========================================================= */}
        <section
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: "16px 18px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 700,
                fontSize: "0.95rem",
                color: "#1e3a8a",
              }}
            >
              <DollarSign size={18} color="#2563eb" />
              <span>Chi phí tham dự & Xuất bản bài báo</span>
            </div>

            {opportunity.feeSourceUrl && (
              <a
                href={opportunity.feeSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--primary)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontWeight: 600,
                }}
              >
                <span>Xem thông báo phí chính thức</span>
                <ExternalLink size={13} />
              </a>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 12,
            }}
          >
            {/* Phí đăng bài / xuất bản (APC / Author Fee) */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: "14px 16px",
              }}
            >
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "var(--muted)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Phí đăng bài / xuất bản (APC / Author Fee)
              </div>
              <div
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  color:
                    publicationFee === FREE_FEE_TEXT
                      ? "#16a34a"
                      : publicationFee === UNKNOWN_FEE_TEXT
                      ? "#64748b"
                      : "var(--text-main)",
                }}
              >
                {publicationFee}
              </div>
              {publicationFee === UNKNOWN_FEE_TEXT && (
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 6, fontStyle: "italic" }}>
                  Nguồn chính thức chưa công bố mức phí xuất bản cụ thể; tác giả vui lòng liên hệ Ban tổ chức.
                </div>
              )}
            </div>

            {/* Phí tham dự / đăng ký (Attendee / Registration Fee) */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: "14px 16px",
              }}
            >
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "var(--muted)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Phí tham dự / đăng ký (Attendee Fee)
              </div>
              <div
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  color:
                    registrationFee === FREE_FEE_TEXT
                      ? "#16a34a"
                      : registrationFee === UNKNOWN_FEE_TEXT
                      ? "#64748b"
                      : "var(--text-main)",
                }}
              >
                {registrationFee}
              </div>
              {registrationFee === UNKNOWN_FEE_TEXT && (
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 6, fontStyle: "italic" }}>
                  Nguồn chính thức chưa công bố mức phí đại biểu cụ thể.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 4. Mục XUẤT BẢN & CHỈ MỤC & PHÙ HỢP */}
        {/* ========================================================= */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            background: "#fafafa",
            padding: "14px 16px",
            borderRadius: 8,
            border: "1px solid var(--line)",
          }}
        >
          {opportunity.publicationFormat && (
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                Hình thức xuất bản
              </div>
              <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--teal)", marginTop: 2 }}>
                {opportunity.publicationFormat}
              </div>
            </div>
          )}

          {opportunity.indexing && (
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                Chỉ mục / Indexing
              </div>
              <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#1d4ed8", marginTop: 2 }}>
                {opportunity.indexing}
              </div>
            </div>
          )}

          {opportunity.suitability && (
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                Mức độ phù hợp MTCN
              </div>
              <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#059669", marginTop: 2 }}>
                {opportunity.suitability}
              </div>
            </div>
          )}

          {opportunity.field && (
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                Ngành MTCN phù hợp
              </div>
              <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--text-main)", marginTop: 2 }}>
                {opportunity.field}
              </div>
            </div>
          )}
        </section>

        {/* ========================================================= */}
        {/* 5. Mục NỘI DUNG & CHỦ ĐỀ CHI TIẾT */}
        {/* ========================================================= */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 700,
              fontSize: "1rem",
              color: "var(--primary)",
              marginBottom: 10,
            }}
          >
            <FileText size={18} />
            <span>Nội dung & Chủ đề chi tiết</span>
          </div>

          {/* Tóm tắt nội dung */}
          <div
            style={{
              fontSize: "0.9375rem",
              lineHeight: 1.7,
              color: "var(--text-main)",
              whiteSpace: "pre-line",
              marginBottom: 12,
            }}
          >
            {opportunity.content}
          </div>

          {/* Phân tích nội dung chi tiết nếu có */}
          {opportunity.detailedContent && opportunity.detailedContent !== opportunity.content && (
            <div
              style={{
                fontSize: "0.9rem",
                lineHeight: 1.65,
                color: "var(--text-sub)",
                background: "#f8fafc",
                borderLeft: "3px solid var(--primary)",
                padding: "10px 14px",
                borderRadius: "0 6px 6px 0",
                marginBottom: 14,
              }}
            >
              {opportunity.detailedContent}
            </div>
          )}

          {/* Danh sách chủ đề / Tracks chi tiết */}
          {topicsList.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "var(--text-main)",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Layers size={15} color="var(--primary)" />
                <span>Các phân ban / Chủ đề nghiên cứu chính (Tracks):</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {topicsList.map((tp, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "#f1f5f9",
                      padding: "8px 12px",
                      borderRadius: 6,
                      fontSize: "0.875rem",
                      color: "#1e293b",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    {tp}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 6. Mục GỢI Ý ĐỊNH HƯỚNG BÀI VIẾT CHO GIẢNG VIÊN MTCN */}
        {/* ========================================================= */}
        {opportunity.directions && (
          <div
            style={{
              background: "#f0f9ff",
              border: "1px solid #bae6fd",
              padding: "16px",
              borderRadius: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 700,
                color: "#0369a1",
                marginBottom: 10,
              }}
            >
              <Lightbulb size={20} />
              <span>Gợi ý định hướng bài viết cho Giảng viên Khoa MTCN:</span>
            </div>

            {directionsLines.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {directionsLines.map((line, idx) => (
                  <div
                    key={idx}
                    style={{
                      fontSize: "0.875rem",
                      lineHeight: 1.6,
                      color: "#0c4a6e",
                      background: "#ffffff",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #e0f2fe",
                    }}
                  >
                    {line}
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  color: "#0c4a6e",
                  fontSize: "0.9rem",
                  lineHeight: 1.6,
                  whiteSpace: "pre-line",
                }}
              >
                {opportunity.directions}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* 7. Ghi chú chuyên gia & Từ khóa */}
        {/* ========================================================= */}
        {opportunity.notes && (
          <div
            style={{
              background: "#fffbeb",
              border: "1px solid #fde68a",
              padding: "12px 16px",
              borderRadius: 8,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                color: "#92400e",
                marginBottom: 4,
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <AlertCircle size={15} />
              <span>Ghi chú lưu ý:</span>
            </div>
            <div style={{ color: "#78350f", fontSize: "0.875rem", lineHeight: 1.5 }}>
              {opportunity.notes}
            </div>
          </div>
        )}

        {/* Tags */}
        {opportunity.tags && opportunity.tags.length > 0 && (
          <div>
            <h5 style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: 6 }}>
              Từ khóa phân loại:
            </h5>
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
