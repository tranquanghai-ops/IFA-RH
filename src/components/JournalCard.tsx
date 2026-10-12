import React from "react";
import type { Journal } from "../types/journal";
import {
  ExternalLink,
  BookOpen,
  Award,
  Building,
  Hash,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Edit,
} from "lucide-react";

interface JournalCardProps {
  journal: Journal;
  isAdmin?: boolean;
  onViewDetails: (journal: Journal) => void;
  onEdit?: (journal: Journal) => void;
  onToggleStatus?: (journal: Journal) => void;
}

export const JournalCard: React.FC<JournalCardProps> = ({
  journal,
  isAdmin = false,
  onViewDetails,
  onEdit,
  onToggleStatus,
}) => {
  const hasWebsite = Boolean(journal.website && journal.website.trim().length > 0);
  const isValidUrl =
    hasWebsite &&
    journal.websiteVerified !== false &&
    (journal.website?.startsWith("http://") || journal.website?.startsWith("https://"));

  const hasGuidelines = journal.guidelines?.hasGuidelines === true;
  const isHidden = journal.status === "hidden";

  return (
    <div
      className={`journal-card ${isHidden ? "journal-card-hidden" : ""}`}
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "10px",
        border: isHidden ? "1px dashed #d1d5db" : "1px solid #e5e7eb",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        opacity: isHidden ? 0.75 : 1,
        transition: "all 0.2s ease-in-out",
      }}
    >
      <div>
        {/* Header Badges */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "8px",
            marginBottom: "12px",
            flexWrap: "wrap",
          }}
        >
          {/* Max Score & Year Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              backgroundColor: "#eff6ff",
              color: "#1e40af",
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "0.82rem",
              fontWeight: 700,
              border: "1px solid #bfdbfe",
            }}
          >
            <Award size={15} />
            <span>
              Điểm HĐGSNN: {journal.maxScore > 0 ? journal.maxScore.toFixed(2) : "0"} ({journal.maxScoreYear || 2025})
            </span>
          </div>

          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            {/* Guidelines Badge */}
            {hasGuidelines ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  backgroundColor: "#ecfdf5",
                  color: "#065f46",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  border: "1px solid #a7f3d0",
                }}
              >
                <CheckCircle2 size={13} />
                Có hướng dẫn đăng
              </span>
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  backgroundColor: "#f3f4f6",
                  color: "#4b5563",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  border: "1px solid #e5e7eb",
                }}
              >
                Chưa có thể lệ
              </span>
            )}

            {/* Hidden Badge for Admin */}
            {isHidden && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  backgroundColor: "#fef2f2",
                  color: "#991b1b",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  border: "1px solid #fecaca",
                }}
              >
                <EyeOff size={13} />
                Tạm ẩn
              </span>
            )}
          </div>
        </div>

        {/* Journal Title */}
        <h3
          style={{
            fontSize: "1.08rem",
            fontWeight: 700,
            color: "#111827",
            lineHeight: "1.4",
            marginBottom: "6px",
          }}
        >
          {journal.name}
        </h3>

        {journal.englishName && (
          <p
            style={{
              fontSize: "0.85rem",
              color: "#6b7280",
              fontStyle: "italic",
              marginBottom: "10px",
            }}
          >
            {journal.englishName}
          </p>
        )}

        {/* Publisher */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "7px",
            fontSize: "0.85rem",
            color: "#374151",
            marginBottom: "12px",
          }}
        >
          <Building size={16} style={{ color: "#6b7280", flexShrink: 0, marginTop: "2px" }} />
          <span style={{ fontWeight: 500 }}>{journal.publisher}</span>
        </div>

        {/* Identifiers: ISSN / E-ISSN / ISBN */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            fontSize: "0.82rem",
            color: "#4b5563",
            backgroundColor: "#f9fafb",
            padding: "8px 12px",
            borderRadius: "6px",
            marginBottom: "14px",
            border: "1px solid #f3f4f6",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Hash size={14} style={{ color: "#9ca3af" }} />
            <span>
              ISSN in: <strong>{journal.issnPrint || "—"}</strong>
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Hash size={14} style={{ color: "#9ca3af" }} />
            <span>
              E-ISSN: <strong>{journal.issnOnline || "—"}</strong>
            </span>
          </div>

          {journal.isbn && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Hash size={14} style={{ color: "#9ca3af" }} />
              <span>
                ISBN: <strong>{journal.isbn}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Disciplines / Scientific Field */}
        <div style={{ marginBottom: "14px" }}>
          <div
            style={{
              fontSize: "0.78rem",
              fontWeight: 600,
              textTransform: "uppercase",
              color: "#6b7280",
              letterSpacing: "0.025em",
              marginBottom: "5px",
            }}
          >
            Lĩnh vực & Hội đồng công nhận
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            <span
              style={{
                backgroundColor: "#f0fdf4",
                color: "#166534",
                padding: "3px 8px",
                borderRadius: "4px",
                fontSize: "0.78rem",
                fontWeight: 600,
                border: "1px solid #bbf7d0",
              }}
            >
              {journal.primaryField}
            </span>
            {(journal.fields || [])
              .filter((f) => f !== journal.primaryField)
              .slice(0, 2)
              .map((field, idx) => (
                <span
                  key={idx}
                  style={{
                    backgroundColor: "#f3f4f6",
                    color: "#374151",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                  }}
                >
                  {field}
                </span>
              ))}
            {(journal.fields || []).filter((f) => f !== journal.primaryField).length > 2 && (
              <span
                style={{
                  backgroundColor: "#f3f4f6",
                  color: "#6b7280",
                  padding: "3px 6px",
                  borderRadius: "4px",
                  fontSize: "0.72rem",
                }}
              >
                +{(journal.fields || []).filter((f) => f !== journal.primaryField).length - 2}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card Action Footer */}
      <div
        style={{
          borderTop: "1px solid #f3f4f6",
          paddingTop: "14px",
          marginTop: "6px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        {/* Left: Website Link or Verified Status */}
        <div>
          {isValidUrl ? (
            <a
              href={journal.website}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "0.82rem",
                color: "#2563eb",
                fontWeight: 600,
                textDecoration: "none",
                padding: "6px 10px",
                borderRadius: "6px",
                backgroundColor: "#eff6ff",
                border: "1px solid #dbeafe",
                transition: "all 0.15s ease",
              }}
              title="Mở trang chủ chính thức trong tab mới"
            >
              <ExternalLink size={14} />
              Trang chủ
            </a>
          ) : (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "0.78rem",
                color: "#9ca3af",
                padding: "6px 8px",
                backgroundColor: "#f9fafb",
                borderRadius: "6px",
                border: "1px dashed #e5e7eb",
              }}
              title="Tạp chí chưa có website chính thức được xác minh"
            >
              <AlertCircle size={13} />
              Chưa có trang chủ được xác minh
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {/* Admin Edit & Toggle */}
          {isAdmin && onEdit && (
            <button
              onClick={() => onEdit(journal)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "6px 9px",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                backgroundColor: "#ffffff",
                color: "#374151",
                fontSize: "0.8rem",
                cursor: "pointer",
                fontWeight: 500,
              }}
              title="Chỉnh sửa thông tin tạp chí"
            >
              <Edit size={14} />
              Sửa
            </button>
          )}

          {isAdmin && onToggleStatus && (
            <button
              onClick={() => onToggleStatus(journal)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "6px 9px",
                borderRadius: "6px",
                border: isHidden ? "1px solid #86efac" : "1px solid #fca5a5",
                backgroundColor: isHidden ? "#f0fdf4" : "#fef2f2",
                color: isHidden ? "#166534" : "#991b1b",
                fontSize: "0.8rem",
                cursor: "pointer",
                fontWeight: 500,
              }}
              title={isHidden ? "Khôi phục hiển thị cho giảng viên" : "Tạm ẩn tạp chí khỏi danh sách"}
            >
              {isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
              {isHidden ? "Hiện" : "Ẩn"}
            </button>
          )}

          {/* View Details Button */}
          <button
            onClick={() => onViewDetails(journal)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "6px 12px",
              borderRadius: "6px",
              backgroundColor: "#1e3a8a",
              color: "#ffffff",
              fontSize: "0.82rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
            }}
          >
            <BookOpen size={14} />
            Xem chi tiết
          </button>
        </div>
      </div>
    </div>
  );
};
