import React from "react";
import type { Journal } from "../types/journal";
import {
  isValidDisplayIdentifier,
  getJournalScoreForCouncil,
  getScoreBadgePalette,
  formatVietnameseScore,
  getEffectiveCouncilScores,
} from "../services/journalService";
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
  Layers,
} from "lucide-react";

interface JournalCardProps {
  journal: Journal;
  selectedCouncilId?: string;
  isAdmin?: boolean;
  onViewDetails: (journal: Journal) => void;
  onEdit?: (journal: Journal) => void;
  onToggleStatus?: (journal: Journal) => void;
}

export const JournalCard: React.FC<JournalCardProps> = ({
  journal,
  selectedCouncilId = "HD24",
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

  // Evaluate score for the selected council
  const councilEval = getJournalScoreForCouncil(journal, selectedCouncilId);
  const effectiveCouncilScores = getEffectiveCouncilScores(journal);
  const totalRecognizedCouncils = new Set(
    effectiveCouncilScores
      .filter((cs) => cs.verificationStatus === "VERIFIED")
      .map((cs) => cs.councilId || cs.councilName)
  ).size;

  const hasValidCouncilScore =
    councilEval.hasRecordInCouncil &&
    councilEval.isVerified &&
    councilEval.maxScore !== null;

  const badgePalette = getScoreBadgePalette(
    hasValidCouncilScore ? councilEval.maxScore : null,
    hasValidCouncilScore
  );

  // Filter valid identifiers (hide empty / "Không công bố" / "N/A" / "—")
  const showIssnPrint = isValidDisplayIdentifier(journal.issnPrint);
  const showIssnOnline = isValidDisplayIdentifier(journal.issnOnline);
  const showIsbn = isValidDisplayIdentifier(journal.isbn);
  const hasAnyIdentifier = showIssnPrint || showIssnOnline || showIsbn;

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
        {/* Top Status Badges */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "6px",
            marginBottom: "12px",
            flexWrap: "wrap",
          }}
        >
          {/* Multi-Council Count Pill */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              backgroundColor: "#f8fafc",
              color: "#334155",
              padding: "3px 8px",
              borderRadius: "6px",
              fontSize: "0.75rem",
              fontWeight: 600,
              border: "1px solid #e2e8f0",
            }}
          >
            <Layers size={13} style={{ color: "#2563eb" }} />
            {totalRecognizedCouncils > 0
              ? `${totalRecognizedCouncils} Hội đồng công nhận`
              : "Chưa xác minh HĐ"}
          </span>

          <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
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

        {/* Journal Title: Centered, Bold, Multi-line, No Spark ID */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "14px",
            padding: "4px 4px 10px 4px",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <h3
            style={{
              fontSize: "1.08rem",
              fontWeight: 700,
              color: "#0f172a",
              lineHeight: "1.42",
              margin: 0,
              whiteSpace: "normal",
              wordBreak: "break-word",
            }}
          >
            {journal.name}
          </h3>

          {isValidDisplayIdentifier(journal.englishName) && (
            <p
              style={{
                fontSize: "0.84rem",
                color: "#64748b",
                fontStyle: "italic",
                margin: "5px 0 0 0",
                lineHeight: "1.35",
                whiteSpace: "normal",
                wordBreak: "break-word",
              }}
            >
              {journal.englishName}
            </p>
          )}
        </div>

        {/* Prominent Council-Specific Score Box */}
        <div
          style={{
            backgroundColor: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "10px 12px",
            marginBottom: "12px",
          }}
        >
          {hasValidCouncilScore ? (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  flexWrap: "wrap",
                  marginBottom: "6px",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    backgroundColor: badgePalette.backgroundColor,
                    color: badgePalette.color,
                    border: `1px solid ${badgePalette.borderColor}`,
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "0.84rem",
                    fontWeight: 700,
                  }}
                >
                  <Award size={15} />
                  <span>
                    Điểm HĐGSNN tối đa: {formatVietnameseScore(councilEval.maxScore)}
                  </span>
                </div>

                {councilEval.hasMultipleEntries && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      backgroundColor: "#fffbeb",
                      color: "#b45309",
                      border: "1px solid #fde68a",
                      padding: "2px 7px",
                      borderRadius: "5px",
                      fontSize: "0.73rem",
                      fontWeight: 600,
                    }}
                    title="Tạp chí có nhiều mức điểm khác nhau theo chuyên mục hoặc loại ấn phẩm trong Hội đồng này"
                  >
                    Có nhiều mức điểm
                  </span>
                )}
              </div>

              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#334155",
                  lineHeight: "1.45",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}
              >
                <div>
                  <span style={{ color: "#64748b" }}>Hội đồng: </span>
                  <strong style={{ color: "#0f172a" }}>{councilEval.councilName}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Năm: </span>
                  <strong style={{ color: "#0f172a" }}>
                    {councilEval.decisionYear || journal.maxScoreYear || 2025}
                  </strong>
                  {councilEval.entries[0]?.publicationType &&
                  councilEval.entries[0].publicationType !== "Toàn tạp chí" ? (
                    <span style={{ color: "#475569" }}>
                      {" "}
                      · Ấn phẩm: {councilEval.entries[0].publicationType}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  backgroundColor: badgePalette.backgroundColor,
                  color: badgePalette.color,
                  border: `1px solid ${badgePalette.borderColor}`,
                  padding: "5px 10px",
                  borderRadius: "6px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                }}
              >
                <AlertCircle size={14} />
                <span>Chưa có mức điểm được xác minh tại Hội đồng này</span>
              </div>
              {totalRecognizedCouncils > 0 && (
                <div style={{ fontSize: "0.76rem", color: "#64748b", paddingLeft: "2px" }}>
                  Có điểm tại {totalRecognizedCouncils} Hội đồng khác (tối đa{" "}
                  {formatVietnameseScore(journal.maxScore)} điểm) — Bấm &ldquo;Xem chi tiết&rdquo; để tra cứu.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Publisher */}
        {isValidDisplayIdentifier(journal.publisher) && (
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
        )}

        {/* Identifiers: Only display fields that have real values */}
        {hasAnyIdentifier && (
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
            {showIssnPrint && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Hash size={14} style={{ color: "#9ca3af" }} />
                <span>
                  ISSN in: <strong>{journal.issnPrint?.trim()}</strong>
                </span>
              </div>
            )}

            {showIssnOnline && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Hash size={14} style={{ color: "#9ca3af" }} />
                <span>
                  E-ISSN: <strong>{journal.issnOnline?.trim()}</strong>
                </span>
              </div>
            )}

            {showIsbn && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Hash size={14} style={{ color: "#9ca3af" }} />
                <span>
                  ISBN: <strong>{journal.isbn?.trim()}</strong>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Disciplines / Scientific Field */}
        <div style={{ marginBottom: "14px" }}>
          <div
            style={{
              fontSize: "0.76rem",
              fontWeight: 600,
              textTransform: "uppercase",
              color: "#6b7280",
              letterSpacing: "0.025em",
              marginBottom: "5px",
            }}
          >
            Lĩnh vực & Nhóm ngành
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
