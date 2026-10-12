import React from "react";
import type { Journal } from "../types/journal";
import {
  X,
  ExternalLink,
  BookOpen,
  Award,
  Building,
  Hash,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
  Mail,
  Phone,
  MapPin,
  Clock,
  DollarSign,
  ShieldCheck,
  Link as LinkIcon,
  Globe,
  Calendar,
} from "lucide-react";

interface JournalDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  journal: Journal | null;
}

export const JournalDetailModal: React.FC<JournalDetailModalProps> = ({
  isOpen,
  onClose,
  journal,
}) => {
  if (!isOpen || !journal) return null;

  const guidelines = journal.guidelines;
  const verification = journal.verification;
  const scores = journal.scores || [];
  const links = journal.links || [];

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
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          overflow: "hidden",
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
              KHUNG ĐIỂM HĐGSNN ({journal.maxScoreYear || 2025}): TỐI ĐA {journal.maxScore > 0 ? journal.maxScore.toFixed(2) : "0"} ĐIỂM
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
            {journal.englishName && (
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "#64748b",
                  fontStyle: "italic",
                  margin: "4px 0 0 0",
                }}
              >
                {journal.englishName} {journal.abbreviation ? `(${journal.abbreviation})` : ""}
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
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          {/* Section 1 & 2: Định danh & Mã ấn phẩm */}
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
                  {journal.publisher}
                </div>
              </div>
              <div>
                <span style={{ color: "#64748b" }}>Phân loại:</span>
                <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                  {journal.category === "domestic" ? "Tạp chí trong nước" : "Tạp chí quốc tế"}
                </div>
              </div>
              <div>
                <span style={{ color: "#64748b" }}>ISSN bản in (Print):</span>
                <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                  {journal.issnPrint || "Chưa có"}
                </div>
              </div>
              <div>
                <span style={{ color: "#64748b" }}>E-ISSN (Điện tử):</span>
                <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                  {journal.issnOnline || "Chưa có"}
                </div>
              </div>
              {journal.isbn && (
                <div>
                  <span style={{ color: "#64748b" }}>ISBN chuyên đề:</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {journal.isbn}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3 & 4: Danh sách nhóm ngành & Lịch sử điểm HĐGSNN */}
          <div>
            <h4
              style={{
                fontSize: "0.95rem",
                fontWeight: 700,
                color: "#0f172a",
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Award size={17} color="#2563eb" />
              2. Điểm công trình theo từng Hội đồng Giáo sư ngành / liên ngành
            </h4>
            <p
              style={{
                fontSize: "0.82rem",
                color: "#475569",
                margin: "0 0 12px 0",
                lineHeight: 1.5,
              }}
            >
              Lưu ý: Khung điểm tối đa trên thẻ là mức điểm cao nhất được ghi nhận. Mức điểm cụ thể của bài báo phụ thuộc vào từng Hội đồng Giáo sư ngành/liên ngành và phân loại ấn phẩm/chuyên mục được công nhận dưới đây:
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

            {/* Scores Table */}
            {scores.length > 0 ? (
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
                    fontSize: "0.85rem",
                    textAlign: "left",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#475569" }}>Năm</th>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#475569" }}>
                        Hội đồng Giáo sư Ngành / Liên ngành
                      </th>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#475569" }}>
                        Điểm tối đa
                      </th>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#475569" }}>
                        Văn bản phê duyệt
                      </th>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#475569" }}>
                        Loại ấn phẩm / Ghi chú
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map((sc, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: idx === scores.length - 1 ? "none" : "1px solid #f1f5f9",
                        }}
                      >
                        <td style={{ padding: "10px 12px", fontWeight: 700, color: "#0f172a" }}>
                          {sc.year}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#1e293b" }}>{sc.councilName}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span
                            style={{
                              backgroundColor: "#f0fdf4",
                              color: "#166534",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontWeight: 700,
                            }}
                          >
                            {sc.maxScore.toFixed(2)}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", color: "#64748b" }}>
                          {sc.decisionNumber || "QĐ HĐGSNN"}
                          {sc.decisionDate ? ` (${sc.decisionDate})` : ""}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#64748b", fontSize: "0.8rem" }}>
                          {sc.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ fontSize: "0.85rem", color: "#64748b", fontStyle: "italic" }}>
                Chưa có lịch sử điểm được ghi nhận.
              </p>
            )}
          </div>

          {/* Section 5: Website & Liên kết chính thức */}
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

          {/* Section 6 - 12: Thể lệ, quy cách đăng bài & file mẫu */}
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
                  <div style={{ gridColumn: "1 / -1", backgroundColor: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontWeight: 600, color: "#334155" }}>Tóm tắt thể lệ bài viết:</span>
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
                    {guidelines.publicationFee ? `APC: ${guidelines.publicationFee}` : "Miễn phí hoặc chưa công khai"}
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

          {/* Section 13 & 14: Gửi bài trực tuyến & Liên hệ tòa soạn */}
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

          {/* Section 15: Nguồn xác minh & Trạng thái kiểm chứng */}
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
              <span style={{ fontWeight: 600, color: verification?.status === "verified" ? "#166534" : "#854d0e" }}>
                Trạng thái kiểm chứng: {verification?.status === "verified" ? "Đã xác minh chính thức" : "Chưa kiểm chứng toàn diện"}
              </span>
            </div>
            <div style={{ color: "#64748b" }}>
              Nguồn: {verification?.sourceReference || "Quyết định 26/QĐ-HĐGSNN"} · Ngày rà soát: {verification?.verifiedDate || journal.updatedAt?.split("T")[0]}
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
