import React, { useState, useEffect } from "react";
import type { Journal, JournalCategory } from "../types/journal";
import { X, Save, AlertCircle } from "lucide-react";

interface JournalFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  journal: Journal | null; // null if create new
  onSave: (data: Partial<Journal>) => Promise<void>;
}

export const JournalFormModal: React.FC<JournalFormModalProps> = ({
  isOpen,
  onClose,
  journal,
  onSave,
}) => {
  const isEditing = Boolean(journal);

  const [formData, setFormData] = useState<Partial<Journal>>({
    journalId: "",
    name: "",
    englishName: "",
    abbreviation: "",
    publisher: "",
    issnPrint: "",
    issnOnline: "",
    isbn: "",
    category: "domestic",
    primaryField: "",
    website: "",
    maxScore: 1.0,
    maxScoreYear: 2025,
    status: "active",
    fields: [],
  });

  const [guidelinesData, setGuidelinesData] = useState({
    hasGuidelines: false,
    summary: "",
    manuscriptFormat: "Microsoft Word (.docx)",
    citationStyle: "APA 7th",
    publicationLanguage: "Tiếng Việt",
    templateUrl: "",
    submissionUrl: "",
    editorialEmail: "",
    contactPhone: "",
    officeAddress: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (journal) {
      setFormData({
        journalId: journal.journalId || "",
        name: journal.name || "",
        englishName: journal.englishName || "",
        abbreviation: journal.abbreviation || "",
        publisher: journal.publisher || "",
        issnPrint: journal.issnPrint || "",
        issnOnline: journal.issnOnline || "",
        isbn: journal.isbn || "",
        category: journal.category || "domestic",
        primaryField: journal.primaryField || "",
        website: journal.website || "",
        maxScore: journal.maxScore || 0,
        maxScoreYear: journal.maxScoreYear || 2025,
        status: journal.status || "active",
        fields: journal.fields || [],
      });

      if (journal.guidelines) {
        setGuidelinesData({
          hasGuidelines: journal.guidelines.hasGuidelines || false,
          summary: journal.guidelines.summary || "",
          manuscriptFormat: journal.guidelines.manuscriptFormat || "Microsoft Word (.docx)",
          citationStyle: journal.guidelines.citationStyle || "APA 7th",
          publicationLanguage: journal.guidelines.publicationLanguage || "Tiếng Việt",
          templateUrl: journal.guidelines.templateUrl || "",
          submissionUrl: journal.guidelines.submissionUrl || "",
          editorialEmail: journal.guidelines.editorialEmail || "",
          contactPhone: journal.guidelines.contactPhone || "",
          officeAddress: journal.guidelines.officeAddress || "",
        });
      }
    } else {
      setFormData({
        journalId: `TC-${Date.now().toString().slice(-4)}`,
        name: "",
        englishName: "",
        abbreviation: "",
        publisher: "",
        issnPrint: "",
        issnOnline: "",
        isbn: "",
        category: "domestic",
        primaryField: "Văn hóa - Nghệ thuật",
        website: "",
        maxScore: 1.0,
        maxScoreYear: 2025,
        status: "active",
        fields: ["Văn hóa - Nghệ thuật"],
      });
      setGuidelinesData({
        hasGuidelines: false,
        summary: "",
        manuscriptFormat: "Microsoft Word (.docx)",
        citationStyle: "APA 7th",
        publicationLanguage: "Tiếng Việt",
        templateUrl: "",
        submissionUrl: "",
        editorialEmail: "",
        contactPhone: "",
        officeAddress: "",
      });
    }
    setErrorMsg("");
  }, [journal, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!formData.name?.trim()) {
      setErrorMsg("Vui lòng nhập tên tạp chí.");
      return;
    }
    if (!formData.publisher?.trim()) {
      setErrorMsg("Vui lòng nhập cơ quan xuất bản.");
      return;
    }
    if (!formData.journalId?.trim()) {
      setErrorMsg("Vui lòng nhập mã tạp chí.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: Partial<Journal> = {
        ...formData,
        fields: Array.from(new Set([formData.primaryField || "", ...(formData.fields || [])])).filter(Boolean),
        guidelines: guidelinesData,
        websiteVerified: Boolean(formData.website && formData.website.startsWith("http")),
      };
      await onSave(payload);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Không thể lưu dữ liệu.");
    } finally {
      setIsSubmitting(false);
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
          maxWidth: "760px",
          width: "100%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
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
          <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "#0f172a" }}>
            {isEditing ? `Chỉnh sửa tạp chí: ${journal?.journalId}` : "Thêm mới tạp chí khoa học"}
          </h3>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
            {errorMsg && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "6px",
                  backgroundColor: "#fef2f2",
                  color: "#991b1b",
                  border: "1px solid #fecaca",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <AlertCircle size={16} />
                {errorMsg}
              </div>
            )}

            {/* Basic Info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                  Mã tạp chí (journal_id) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.journalId}
                  onChange={(e) => setFormData({ ...formData, journalId: e.target.value.trim().toUpperCase() })}
                  disabled={isEditing}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    fontSize: "0.88rem",
                    backgroundColor: isEditing ? "#f3f4f6" : "#ffffff",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                  Tên tạp chí (Tiếng Việt) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.88rem" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                  Tên tiếng Anh (English Name)
                </label>
                <input
                  type="text"
                  value={formData.englishName}
                  onChange={(e) => setFormData({ ...formData, englishName: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.88rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                  Tên viết tắt (Abbreviation)
                </label>
                <input
                  type="text"
                  value={formData.abbreviation}
                  onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.88rem" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                  Cơ quan xuất bản / Chủ quản *
                </label>
                <input
                  type="text"
                  required
                  value={formData.publisher}
                  onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.88rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                  Phân loại địa lý
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as JournalCategory })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.88rem" }}
                >
                  <option value="domestic">Trong nước</option>
                  <option value="international">Quốc tế</option>
                </select>
              </div>
            </div>

            {/* Identifiers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                  ISSN (Bản in)
                </label>
                <input
                  type="text"
                  placeholder="0866-8639"
                  value={formData.issnPrint}
                  onChange={(e) => setFormData({ ...formData, issnPrint: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.88rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                  E-ISSN (Điện tử)
                </label>
                <input
                  type="text"
                  placeholder="2615-9589"
                  value={formData.issnOnline}
                  onChange={(e) => setFormData({ ...formData, issnOnline: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.88rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                  ISBN (nếu có)
                </label>
                <input
                  type="text"
                  value={formData.isbn}
                  onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.88rem" }}
                />
              </div>
            </div>

            {/* Field & Scores */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                  Lĩnh vực chuyên môn chính *
                </label>
                <input
                  type="text"
                  required
                  value={formData.primaryField}
                  onChange={(e) => setFormData({ ...formData, primaryField: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.88rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                  Điểm tối đa HĐGSNN
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="2.0"
                  value={formData.maxScore}
                  onChange={(e) => setFormData({ ...formData, maxScore: parseFloat(e.target.value) || 0 })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.88rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                  Năm công nhận
                </label>
                <input
                  type="number"
                  value={formData.maxScoreYear}
                  onChange={(e) => setFormData({ ...formData, maxScoreYear: parseInt(e.target.value, 10) || 2025 })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.88rem" }}
                />
              </div>
            </div>

            {/* Website */}
            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                Website chính thức (Chỉ điền khi có trang chủ chính thức hợp lệ)
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value.trim() })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.88rem" }}
              />
            </div>

            {/* Guidelines Section Toggle */}
            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "14px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600, fontSize: "0.88rem" }}>
                <input
                  type="checkbox"
                  checked={guidelinesData.hasGuidelines}
                  onChange={(e) => setGuidelinesData({ ...guidelinesData, hasGuidelines: e.target.checked })}
                />
                Có thông tin thể lệ và hướng dẫn đăng bài
              </label>

              {guidelinesData.hasGuidelines && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px", backgroundColor: "#f8fafc", padding: "14px", borderRadius: "8px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569", marginBottom: "3px" }}>
                      Tóm tắt thể lệ bài viết
                    </label>
                    <textarea
                      rows={2}
                      value={guidelinesData.summary}
                      onChange={(e) => setGuidelinesData({ ...guidelinesData, summary: e.target.value })}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569", marginBottom: "3px" }}>
                        Quy chuẩn trích dẫn
                      </label>
                      <input
                        type="text"
                        value={guidelinesData.citationStyle}
                        onChange={(e) => setGuidelinesData({ ...guidelinesData, citationStyle: e.target.value })}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569", marginBottom: "3px" }}>
                        Cổng gửi bài trực tuyến
                      </label>
                      <input
                        type="url"
                        value={guidelinesData.submissionUrl}
                        onChange={(e) => setGuidelinesData({ ...guidelinesData, submissionUrl: e.target.value })}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569", marginBottom: "3px" }}>
                        Email tòa soạn
                      </label>
                      <input
                        type="email"
                        value={guidelinesData.editorialEmail}
                        onChange={(e) => setGuidelinesData({ ...guidelinesData, editorialEmail: e.target.value })}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569", marginBottom: "3px" }}>
                        Link tải file mẫu (Template URL)
                      </label>
                      <input
                        type="url"
                        value={guidelinesData.templateUrl}
                        onChange={(e) => setGuidelinesData({ ...guidelinesData, templateUrl: e.target.value })}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              padding: "14px 24px",
              borderTop: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              backgroundColor: "#f8fafc",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
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
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: "8px 20px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#1e3a8a",
                color: "#ffffff",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Save size={16} />
              {isSubmitting ? "Đang lưu..." : "Lưu tạp chí"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
