import React, { useState, useEffect } from "react";
import type { Journal } from "../types/journal";
import {
  getEffectiveCouncilScores,
  getScoreBadgePalette,
  formatVietnameseScore,
  isValidDisplayIdentifier,
} from "../services/journalService";
import { normalizeCouncilIdentity } from "../services/journalGoogleSheetService";
import {
  X,
  ExternalLink,
  Award,
  Building,
  AlertCircle,
  FileText,
  Download,
  Mail,
  ShieldCheck,
  Link as LinkIcon,
  Globe,
  Filter,
} from "lucide-react";

interface JournalDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  journal: Journal | null;
  selectedCouncilId?: string;
}

export const JournalDetailModal: React.FC<JournalDetailModalProps> = ({
  isOpen,
  onClose,
  journal,
  selectedCouncilId = "HD24",
}) => {
  const [councilViewMode, setCouncilViewMode] = useState<"selected" | "all">("all");

  useEffect(() => {
    if (!journal) return;
    const allScores = getEffectiveCouncilScores(journal);
    if (!selectedCouncilId || selectedCouncilId === "ALL") {
      setCouncilViewMode("all");
      return;
    }
    const normSelected = normalizeCouncilIdentity(selectedCouncilId).councilId;
    const hasInSelected = allScores.some(
      (cs) => normalizeCouncilIdentity(cs.councilId || cs.councilName).councilId === normSelected
    );
    // Default to showing all councils if the journal has no record in the selected council,
    // or selected if it has records and multiple councils exist
    setCouncilViewMode(hasInSelected ? "selected" : "all");
  }, [journal, selectedCouncilId]);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.classList.add("modal-open");
    document.documentElement.classList.add("modal-open");

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.classList.remove("modal-open");
      document.documentElement.classList.remove("modal-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !journal) return null;

  const guidelines = journal.guidelines;
  const verification = journal.verification;
  const links = journal.links || [];
  const allCouncilScores = getEffectiveCouncilScores(journal);

  const normSelectedCouncil =
    selectedCouncilId && selectedCouncilId !== "ALL"
      ? normalizeCouncilIdentity(selectedCouncilId)
      : null;

  const displayedCouncilScores =
    councilViewMode === "selected" && normSelectedCouncil
      ? allCouncilScores.filter(
          (cs) =>
            normalizeCouncilIdentity(cs.councilId || cs.councilName).councilId ===
            normSelectedCouncil.councilId
        )
      : allCouncilScores;

  const isValidUrl = (url?: string) =>
    Boolean(url && (url.startsWith("http://") || url.startsWith("https://")));

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
        overscrollBehavior: "contain",
      }}
      onClick={onClose}
      onWheel={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
    >
      <div
        className="modal-content viewport-safe-modal"
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          maxWidth: "960px",
          width: "100%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          overflow: "hidden",
          overscrollBehavior: "contain",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            backgroundColor: "#f8fafc",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "#1e40af",
                backgroundColor: "#eff6ff",
                padding: "3px 8px",
                borderRadius: "4px",
                marginBottom: "6px",
              }}
            >
              <Award size={14} />
              KHUNG ĐIỂM HĐGSNN ({journal.decisionYear || journal.maxScoreYear || 2025}): TỐI ĐA{" "}
              {formatVietnameseScore(journal.maxScore)} ĐIỂM
            </div>
            <h2
              style={{
                fontSize: "1.35rem",
                fontWeight: 700,
                color: "#0f172a",
                lineHeight: "1.3",
                margin: 0,
              }}
            >
              {journal.name}
            </h2>
            {isValidDisplayIdentifier(journal.englishName) && (
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "#64748b",
                  fontStyle: "italic",
                  margin: "4px 0 0 0",
                }}
              >
                {journal.englishName}{" "}
                {isValidDisplayIdentifier(journal.abbreviation) ? `(${journal.abbreviation})` : ""}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#64748b",
              padding: "4px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Đóng modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div
          style={{
            padding: "24px",
            overflowY: "auto",
            overscrollBehavior: "contain",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          {/* Section 1: Định danh & Cơ quan xuất bản */}
          <div
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <h4
              style={{
                fontSize: "0.9rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                color: "#334155",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Building size={16} color="#2563eb" />
              1. Thông tin định danh & Cơ quan xuất bản
            </h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
                fontSize: "0.85rem",
              }}
            >
              <div>
                <span style={{ color: "#64748b" }}>Cơ quan xuất bản / Chủ quản:</span>
                <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                  {journal.publisher || "Đang cập nhật"}
                </div>
              </div>
              <div>
                <span style={{ color: "#64748b" }}>Phân loại:</span>
                <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                  {journal.category === "domestic" ? "Tạp chí trong nước" : "Tạp chí quốc tế"}
                </div>
              </div>
              {isValidDisplayIdentifier(journal.issnPrint) && (
                <div>
                  <span style={{ color: "#64748b" }}>ISSN bản in (Print):</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {journal.issnPrint}
                  </div>
                </div>
              )}
              {isValidDisplayIdentifier(journal.issnOnline) && (
                <div>
                  <span style={{ color: "#64748b" }}>E-ISSN (Điện tử):</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {journal.issnOnline}
                  </div>
                </div>
              )}
              {isValidDisplayIdentifier(journal.isbn) && (
                <div>
                  <span style={{ color: "#64748b" }}>ISBN chuyên đề:</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {journal.isbn}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Điểm HĐGSNN theo Hội đồng Giáo sư */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
                marginBottom: "8px",
              }}
            >
              <h4
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color: "#0f172a",
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Award size={17} color="#2563eb" />
                2. Điểm HĐGSNN theo Hội đồng Giáo sư
              </h4>

              {/* Filter Toggle: Hội đồng đang chọn vs Tất cả Hội đồng */}
              {normSelectedCouncil && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    backgroundColor: "#f1f5f9",
                    padding: "3px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setCouncilViewMode("selected")}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "5px 10px",
                      borderRadius: "6px",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                      backgroundColor: councilViewMode === "selected" ? "#ffffff" : "transparent",
                      color: councilViewMode === "selected" ? "#1e3a8a" : "#475569",
                      boxShadow:
                        councilViewMode === "selected"
                          ? "0 1px 2px rgba(0, 0, 0, 0.06)"
                          : "none",
                    }}
                  >
                    <Filter size={12} />
                    Hội đồng đang chọn ({normSelectedCouncil.councilName})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCouncilViewMode("all")}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                      backgroundColor: councilViewMode === "all" ? "#ffffff" : "transparent",
                      color: councilViewMode === "all" ? "#1e3a8a" : "#475569",
                      boxShadow:
                        councilViewMode === "all" ? "0 1px 2px rgba(0, 0, 0, 0.06)" : "none",
                    }}
                  >
                    Tất cả Hội đồng ({allCouncilScores.length})
                  </button>
                </div>
              )}
            </div>

            <p
              style={{
                fontSize: "0.82rem",
                color: "#475569",
                margin: "0 0 12px 0",
                lineHeight: 1.5,
              }}
            >
              Lưu ý: Mức điểm công trình khoa học được tính theo từng Hội đồng Giáo sư ngành/liên ngành, năm quyết định, loại ấn phẩm/chuyên mục và điều kiện hiệu lực dưới đây:
            </p>

            {/* List of Disciplines */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
              <span
                style={{
                  backgroundColor: "#eff6ff",
                  color: "#1e40af",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "1px solid #bfdbfe",
                }}
              >
                Lĩnh vực chính: {journal.primaryField}
              </span>
              {(journal.fields || [])
                .filter((f) => f !== journal.primaryField)
                .map((f, i) => (
                  <span
                    key={i}
                    style={{
                      backgroundColor: "#f1f5f9",
                      color: "#334155",
                      fontSize: "0.8rem",
                      padding: "4px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    {f}
                  </span>
                ))}
            </div>

            {/* Multi-Council Scores Table */}
            {displayedCouncilScores.length > 0 ? (
              <div
                style={{
                  overflowX: "auto",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.82rem",
                    textAlign: "left",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#475569" }}>
                        Hội đồng
                      </th>
                      <th style={{ padding: "10px 10px", fontWeight: 600, color: "#475569" }}>
                        Năm
                      </th>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#475569" }}>
                        Điểm
                      </th>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#475569" }}>
                        Ấn phẩm
                      </th>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#475569" }}>
                        Nhóm ngành
                      </th>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#475569" }}>
                        Hiệu lực
                      </th>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#475569" }}>
                        Điều kiện
                      </th>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#475569" }}>
                        Nguồn
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedCouncilScores.map((cs, idx) => {
                      const isVerified = cs.verificationStatus === "VERIFIED";
                      const palette = getScoreBadgePalette(cs.maxScore, isVerified);
                      const effRange =
                        cs.validFrom || cs.validTo
                          ? `${cs.validFrom || "Đầu kỳ"} → ${cs.validTo || "Hiện hành"}`
                          : "Theo kỳ quyết định";
                      const conditionText =
                        [cs.conditions, cs.note].filter(Boolean).join(" — ") || "—";

                      return (
                        <tr
                          key={idx}
                          style={{
                            borderBottom:
                              idx === displayedCouncilScores.length - 1
                                ? "none"
                                : "1px solid #f1f5f9",
                          }}
                        >
                          <td style={{ padding: "10px 12px", color: "#0f172a", fontWeight: 600 }}>
                            <div>{cs.councilName}</div>
                            <div style={{ fontSize: "0.73rem", color: "#64748b", fontWeight: 500 }}>
                              Mã: {cs.councilId}
                            </div>
                          </td>
                          <td style={{ padding: "10px 10px", fontWeight: 700, color: "#0f172a" }}>
                            {cs.decisionYear}
                          </td>
                          <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                display: "inline-block",
                                backgroundColor: palette.backgroundColor,
                                color: palette.color,
                                border: `1px solid ${palette.borderColor}`,
                                padding: "3px 8px",
                                borderRadius: "5px",
                                fontWeight: 700,
                                fontSize: "0.8rem",
                              }}
                            >
                              {cs.maxScore === 0
                                ? "0,00 (Dừng tính điểm)"
                                : cs.maxScore === null
                                ? "Chưa xác định"
                                : formatVietnameseScore(cs.maxScore)}
                            </span>
                            {!isVerified && (
                              <div
                                style={{
                                  fontSize: "0.7rem",
                                  color: "#b45309",
                                  marginTop: "3px",
                                  fontWeight: 600,
                                }}
                              >
                                Cần kiểm tra nguồn
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#334155" }}>
                            {cs.publicationType || "Toàn tạp chí"}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#334155", fontSize: "0.78rem" }}>
                            {(cs.scientificFields || []).length > 0
                              ? (cs.scientificFields || []).join(", ")
                              : journal.primaryField || "—"}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#475569", fontSize: "0.78rem" }}>
                            {effRange}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#475569", fontSize: "0.78rem" }}>
                            {conditionText}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#475569", fontSize: "0.78rem" }}>
                            <div>{cs.decisionNumber || "QĐ 26/QĐ-HĐGSNN"}</div>
                            {cs.sourcePage && (
                              <div style={{ color: "#64748b", fontSize: "0.74rem" }}>
                                {cs.sourcePage}
                              </div>
                            )}
                            {isValidUrl(cs.sourceUrl || undefined) && (
                              <a
                                href={cs.sourceUrl || undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                  color: "#2563eb",
                                  fontWeight: 600,
                                  textDecoration: "none",
                                  marginTop: "2px",
                                }}
                              >
                                <ExternalLink size={12} />
                                Xem văn bản
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "8px",
                  backgroundColor: "#f8fafc",
                  border: "1px dashed #cbd5e1",
                  color: "#475569",
                  fontSize: "0.84rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <span>
                  {councilViewMode === "selected" && normSelectedCouncil
                    ? `Tạp chí chưa có mức điểm được xác minh tại Hội đồng "${normSelectedCouncil.councilName}".`
                    : "Chưa có lịch sử điểm theo Hội đồng được ghi nhận."}
                </span>
                {councilViewMode === "selected" && allCouncilScores.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCouncilViewMode("all")}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      border: "1px solid #bfdbfe",
                      backgroundColor: "#eff6ff",
                      color: "#1e40af",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Xem tất cả {allCouncilScores.length} bản ghi Hội đồng khác
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Website & Liên kết chính thức */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "8px",
              backgroundColor: "#f0fdfa",
              border: "1px solid #ccfbf1",
            }}
          >
            <h4
              style={{
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "#0f766e",
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Globe size={16} />
              3. Website chính thức & Đường dẫn liên quan
            </h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
              {isValidUrl(journal.website) ? (
                <a
                  href={journal.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "6px 12px",
                    backgroundColor: "#0d9488",
                    color: "#ffffff",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  <ExternalLink size={15} />
                  Mở Trang chủ tạp chí ({journal.website})
                </a>
              ) : (
                <span
                  style={{
                    color: "#64748b",
                    fontSize: "0.85rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <AlertCircle size={15} />
                  Chưa có trang chủ được xác minh.
                </span>
              )}

              {/* Extra links */}
              {links.map((l, i) =>
                isValidUrl(l.url) ? (
                  <a
                    key={i}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "5px 10px",
                      backgroundColor: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      color: "#334155",
                      fontSize: "0.8rem",
                      fontWeight: 500,
                      textDecoration: "none",
                    }}
                  >
                    <LinkIcon size={13} />
                    {l.label || l.linkType}
                  </a>
                ) : null
              )}
            </div>
          </div>

          {/* Section 4: Thể lệ, quy cách đăng bài & file mẫu */}
          <div>
            <h4
              style={{
                fontSize: "0.95rem",
                fontWeight: 700,
                color: "#0f172a",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FileText size={17} color="#2563eb" />
              4. Thể lệ, quy cách bản thảo & Quy chuẩn xuất bản
            </h4>

            {guidelines && guidelines.hasGuidelines ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: "14px",
                  fontSize: "0.85rem",
                }}
              >
                {/* Summary */}
                {guidelines.summary && (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      backgroundColor: "#f8fafc",
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <span style={{ fontWeight: 600, color: "#334155" }}>
                      Tóm tắt thể lệ bài viết:
                    </span>
                    <p style={{ margin: "4px 0 0 0", color: "#1e293b", lineHeight: 1.5 }}>
                      {guidelines.summary}
                    </p>
                  </div>
                )}

                <div>
                  <span style={{ color: "#64748b" }}>Định dạng bản thảo:</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {guidelines.manuscriptFormat || "Microsoft Word / PDF"}
                  </div>
                </div>

                <div>
                  <span style={{ color: "#64748b" }}>Giới hạn số từ / số trang:</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {guidelines.wordLimitMin ? `${guidelines.wordLimitMin} - ` : ""}
                    {guidelines.wordLimitMax ? `${guidelines.wordLimitMax} từ` : "Theo quy định"}
                    {guidelines.pageLimit ? ` (${guidelines.pageLimit})` : ""}
                  </div>
                </div>

                <div>
                  <span style={{ color: "#64748b" }}>Chuẩn trích dẫn & TLTK:</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {guidelines.citationStyle || "APA 7th"}
                  </div>
                </div>

                <div>
                  <span style={{ color: "#64748b" }}>Ngôn ngữ công bố:</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {guidelines.publicationLanguage || "Tiếng Việt"}
                  </div>
                </div>

                <div>
                  <span style={{ color: "#64748b" }}>Tần suất xuất bản:</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {guidelines.publicationFrequency || "Đang cập nhật"}
                  </div>
                </div>

                <div>
                  <span style={{ color: "#64748b" }}>Thời gian phản biện ước tính:</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {guidelines.reviewTimeWeeks || "Chưa công bố"}
                  </div>
                </div>

                <div>
                  <span style={{ color: "#64748b" }}>Phí phản biện & Phí xuất bản:</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {guidelines.reviewFee ? `Phản biện: ${guidelines.reviewFee} · ` : ""}
                    {guidelines.publicationFee
                      ? `APC: ${guidelines.publicationFee}`
                      : "Miễn phí hoặc chưa công khai"}
                  </div>
                </div>

                {/* File Template Link */}
                {isValidUrl(guidelines.templateUrl) && (
                  <div>
                    <span style={{ color: "#64748b" }}>File mẫu bài viết:</span>
                    <div style={{ marginTop: "4px" }}>
                      <a
                        href={guidelines.templateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          color: "#2563eb",
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        <Download size={14} />
                        Tải file mẫu (.docx/.tex)
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  padding: "16px",
                  borderRadius: "8px",
                  backgroundColor: "#f8fafc",
                  border: "1px dashed #cbd5e1",
                  color: "#64748b",
                  fontSize: "0.85rem",
                  fontStyle: "italic",
                }}
              >
                Chưa có dữ liệu thể lệ đăng bài chi tiết cho tạp chí này. Vui lòng liên hệ trực tiếp tòa soạn hoặc chờ bản cập nhật từ Spark.
              </div>
            )}
          </div>

          {/* Section 5: Nộp bài trực tuyến & Liên hệ tòa soạn */}
          <div
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <h4
              style={{
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "#334155",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Mail size={16} color="#2563eb" />
              5. Nộp bài trực tuyến & Liên hệ tòa soạn
            </h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "12px",
                fontSize: "0.85rem",
              }}
            >
              {guidelines?.submissionUrl && isValidUrl(guidelines.submissionUrl) && (
                <div>
                  <span style={{ color: "#64748b" }}>Cổng nộp bài trực tuyến:</span>
                  <div style={{ marginTop: "4px" }}>
                    <a
                      href={guidelines.submissionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        color: "#2563eb",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      <ExternalLink size={14} />
                      Mở cổng nộp bài
                    </a>
                  </div>
                </div>
              )}

              {guidelines?.editorialEmail && (
                <div>
                  <span style={{ color: "#64748b" }}>Email tòa soạn:</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {guidelines.editorialEmail}
                  </div>
                </div>
              )}

              {guidelines?.contactPhone && (
                <div>
                  <span style={{ color: "#64748b" }}>Điện thoại:</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {guidelines.contactPhone}
                  </div>
                </div>
              )}

              {guidelines?.officeAddress && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ color: "#64748b" }}>Địa chỉ tòa soạn:</span>
                  <div style={{ fontWeight: 500, color: "#0f172a", marginTop: "2px" }}>
                    {guidelines.officeAddress}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 6: Nguồn xác minh & Trạng thái kiểm chứng */}
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "8px",
              backgroundColor: verification?.status === "verified" ? "#f0fdf4" : "#fefce8",
              border: `1px solid ${verification?.status === "verified" ? "#bbf7d0" : "#fef08a"}`,
              fontSize: "0.82rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <ShieldCheck
                size={16}
                color={verification?.status === "verified" ? "#166534" : "#854d0e"}
              />
              <span
                style={{
                  fontWeight: 600,
                  color: verification?.status === "verified" ? "#166534" : "#854d0e",
                }}
              >
                Trạng thái kiểm chứng:{" "}
                {verification?.status === "verified"
                  ? "Đã xác minh chính thức"
                  : "Chưa kiểm chứng toàn diện"}
              </span>
            </div>
            <div style={{ color: "#64748b" }}>
              Nguồn:{" "}
              {journal.scoreSourceNote ||
                verification?.sourceReference ||
                "Quyết định 26/QĐ-HĐGSNN"}{" "}
              · Ngày rà soát: {verification?.verifiedDate || journal.updatedAt?.split("T")[0]}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "flex-end",
            backgroundColor: "#f8fafc",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 18px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              backgroundColor: "#ffffff",
              color: "#334155",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
