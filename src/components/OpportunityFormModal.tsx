import React, { useState, useEffect } from "react";
import type { Opportunity, OpportunityType, OpportunityLevel } from "../types";
import { Modal } from "./Modal";
import {
  OPPORTUNITY_TYPES,
  OPPORTUNITY_LEVELS,
  validateOpportunityForm,
  validateAndNormalizeDate,
} from "../utils/opportunityValidation";

interface OpportunityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Opportunity>) => Promise<void>;
  initialData?: Opportunity | null;
}

const DEFAULT_TAGS = [
  "Rất phù hợp MTCN",
  "AI",
  "Thiết kế",
  "Nghệ thuật số",
  "Giáo dục",
  "Phát triển bền vững",
  "Văn hóa / nghệ thuật",
  "Quốc tế",
  "Trong nước",
  "Scopus",
  "IEEE",
  "Springer",
];

export const OpportunityFormModal: React.FC<OpportunityFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const [formData, setFormData] = useState<Partial<Opportunity>>({
    title: "",
    organizer: "",
    country: "Việt Nam",
    type: "Hội thảo",
    level: "Quốc tế",
    category: "QT",
    topic: "",
    field: "Thiết kế đồ họa, Thiết kế công nghiệp, Thiết kế nội thất",
    tags: ["Rất phù hợp MTCN"],
    deadline: "",
    abstractDeadline: "",
    fullPaperDeadline: "",
    registrationDeadline: "",
    eventDate: "",
    location: "Trực tiếp & Online (Hybrid)",
    fee: "",
    publicationFee: "",
    registrationFee: "",
    feeStatus: "UNKNOWN",
    feeSourceUrl: "",
    publicationFormat: "Kỷ yếu có chỉ mục ISBN / Scopus",
    indexing: "Scopus / Web of Science",
    content: "",
    directions: "",
    submissionUrl: "",
    sourceUrl: "",
    status: "published",
    sourceType: "ADMIN",
  });

  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        category: initialData.category || (initialData.level === "Quốc tế" ? "QT" : "TN"),
      });
    } else {
      setFormData({
        title: "",
        organizer: "",
        country: "Việt Nam",
        type: "Hội thảo",
        level: "Quốc tế",
        category: "QT",
        topic: "",
        field: "Thiết kế đồ họa, Thiết kế công nghiệp, Thiết kế nội thất",
        tags: ["Rất phù hợp MTCN"],
        deadline: "",
        abstractDeadline: "",
        fullPaperDeadline: "",
        registrationDeadline: "",
        eventDate: "",
        location: "Trực tiếp & Online (Hybrid)",
        fee: "",
        publicationFee: "",
        registrationFee: "",
        feeStatus: "UNKNOWN",
        feeSourceUrl: "",
        publicationFormat: "Kỷ yếu có chỉ mục ISBN",
        indexing: "",
        content: "",
        directions: "",
        submissionUrl: "",
        sourceUrl: "",
        status: "published",
        sourceType: "ADMIN",
      });
    }
    setErrorBanner("");
    setFieldErrors({});
  }, [initialData, isOpen]);

  const handleChange = (field: keyof Opportunity, value: any) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-sync category when level changes
      if (field === "level") {
        next.category = value === "Quốc tế" ? "QT" : "TN";
      }
      return next;
    });
    // Clear error on this field when modified
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleDateBlur = (field: keyof Opportunity, val?: string | null) => {
    if (!val || !val.trim()) return;
    const check = validateAndNormalizeDate(val);
    if (check.valid && check.normalized) {
      handleChange(field, check.normalized);
    } else if (!check.valid && check.error) {
      setFieldErrors((prev) => ({ ...prev, [field]: check.error! }));
    }
  };

  const toggleTag = (tag: string) => {
    const cur = formData.tags || [];
    if (cur.includes(tag)) {
      handleChange("tags", cur.filter((t) => t !== tag));
    } else {
      handleChange("tags", [...cur, tag]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner("");

    // Pre-validate via opportunityValidation utility
    const validation = validateOpportunityForm(formData);
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      const firstError = Object.values(validation.errors)[0];
      setErrorBanner(`Vui lòng kiểm tra lại thông tin: ${firstError}`);
      return;
    }

    try {
      setLoading(true);
      setErrorBanner("");
      setFieldErrors({});
      await onSubmit(validation.sanitized!);
      onClose();
    } catch (err: any) {
      console.error("[OpportunityFormModal] Error saving opportunity:", {
        errorCode: err?.code,
        errorMessage: err?.message,
        originalError: err,
      });

      // Map Firebase error codes to polite, compliant Vietnamese text
      if (err?.code === "permission-denied" || err?.message?.includes("insufficient permissions")) {
        setErrorBanner(
          "Bạn không có quyền thực hiện thao tác này hoặc dữ liệu chưa đúng cấu trúc quy định. Vui lòng kiểm tra lại quyền Admin hoặc thông tin biểu mẫu."
        );
      } else if (err?.code === "unavailable" || err?.message?.includes("network")) {
        setErrorBanner("Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng.");
      } else {
        setErrorBanner(err?.message || "Không thể lưu cơ hội. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? `Chỉnh sửa cơ hội · ${initialData.conferenceCode || initialData.title}` : "Đăng tin cơ hội NCKH mới"}
      maxWidth="large"
      footer={
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", width: "100%" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Hủy
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Đang lưu..." : initialData ? "Lưu thay đổi" : "Đăng tin"}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {errorBanner && (
          <div
            style={{
              background: "#fee2e2",
              border: "1px solid #f87171",
              color: "#991b1b",
              padding: "12px 16px",
              borderRadius: 8,
              marginBottom: 16,
              fontSize: "0.9rem",
              fontWeight: 500,
            }}
          >
            {errorBanner}
          </div>
        )}

        {/* 1. Tiêu đề */}
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
            Tên hội thảo / cơ hội NCKH <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <input
            type="text"
            className={`form-control ${fieldErrors.title ? "border-danger" : ""}`}
            style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: fieldErrors.title ? "1px solid #dc2626" : "1px solid #cbd5e1" }}
            value={formData.title || ""}
            onChange={(e) => handleChange("title", e.target.value)}
            placeholder="Ví dụ: Hội thảo khoa học quốc tế về Thiết kế và Đổi mới Sáng tạo 2027 (ICDI 2027)"
            required
          />
          {fieldErrors.title && (
            <div style={{ color: "#dc2626", fontSize: "0.825rem", marginTop: 4 }}>{fieldErrors.title}</div>
          )}
        </div>

        {/* 2. Đơn vị tổ chức & Quốc gia */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
              Đơn vị tổ chức <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              type="text"
              className={`form-control ${fieldErrors.organizer ? "border-danger" : ""}`}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: fieldErrors.organizer ? "1px solid #dc2626" : "1px solid #cbd5e1" }}
              value={formData.organizer || ""}
              onChange={(e) => handleChange("organizer", e.target.value)}
              placeholder="Ví dụ: Đại học Tôn Đức Thắng / IEEE Section"
              required
            />
            {fieldErrors.organizer && (
              <div style={{ color: "#dc2626", fontSize: "0.825rem", marginTop: 4 }}>{fieldErrors.organizer}</div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
              Quốc gia
            </label>
            <input
              type="text"
              className="form-control"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}
              value={formData.country || ""}
              onChange={(e) => handleChange("country", e.target.value)}
              placeholder="Việt Nam, Anh, Ý, Đức, v.v."
            />
          </div>
        </div>

        {/* 3. Loại hình, Cấp độ & Phân loại TN/QT */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
              Loại cơ hội
            </label>
            <select
              className="form-control"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}
              value={formData.type || "Hội thảo"}
              onChange={(e) => handleChange("type", e.target.value as OpportunityType)}
            >
              {OPPORTUNITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
              Cấp độ
            </label>
            <select
              className="form-control"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}
              value={formData.level || "Quốc tế"}
              onChange={(e) => handleChange("level", e.target.value as OpportunityLevel)}
            >
              {OPPORTUNITY_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
              Phân loại danh mục
            </label>
            <select
              className="form-control"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}
              value={formData.category || "QT"}
              onChange={(e) => handleChange("category", e.target.value as "TN" | "QT")}
            >
              <option value="QT">Quốc tế (QT)</option>
              <option value="TN">Trong nước (TN)</option>
            </select>
          </div>
        </div>

        {/* 4. Quy ước ngày chuẩn: dd/mm/yyyy */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
              Hạn nộp bài chính (Deadline) <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              type="text"
              className={`form-control ${fieldErrors.deadline ? "border-danger" : ""}`}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: fieldErrors.deadline ? "1px solid #dc2626" : "1px solid #cbd5e1" }}
              value={formData.deadline || ""}
              onChange={(e) => handleChange("deadline", e.target.value)}
              onBlur={(e) => handleDateBlur("deadline", e.target.value)}
              placeholder="dd/mm/yyyy (ví dụ: 20/02/2027)"
              required
            />
            <div style={{ fontSize: "0.775rem", color: "#64748b", marginTop: 3 }}>
              Quy ước: Ngày/Tháng/Năm (năm từ 2020 đến 2050).
            </div>
            {fieldErrors.deadline && (
              <div style={{ color: "#dc2626", fontSize: "0.825rem", marginTop: 4 }}>{fieldErrors.deadline}</div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
              Hạn nộp tóm tắt (Abstract)
            </label>
            <input
              type="text"
              className={`form-control ${fieldErrors.abstractDeadline ? "border-danger" : ""}`}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: fieldErrors.abstractDeadline ? "1px solid #dc2626" : "1px solid #cbd5e1" }}
              value={formData.abstractDeadline || ""}
              onChange={(e) => handleChange("abstractDeadline", e.target.value)}
              onBlur={(e) => handleDateBlur("abstractDeadline", e.target.value)}
              placeholder="dd/mm/yyyy (ví dụ: 15/01/2027)"
            />
            <div style={{ fontSize: "0.775rem", color: "#64748b", marginTop: 3 }}>
              Để trống nếu không có hạn tóm tắt riêng.
            </div>
            {fieldErrors.abstractDeadline && (
              <div style={{ color: "#dc2626", fontSize: "0.825rem", marginTop: 4 }}>{fieldErrors.abstractDeadline}</div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
              Hạn nộp toàn văn (Full paper)
            </label>
            <input
              type="text"
              className={`form-control ${fieldErrors.fullPaperDeadline ? "border-danger" : ""}`}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: fieldErrors.fullPaperDeadline ? "1px solid #dc2626" : "1px solid #cbd5e1" }}
              value={formData.fullPaperDeadline || ""}
              onChange={(e) => handleChange("fullPaperDeadline", e.target.value)}
              onBlur={(e) => handleDateBlur("fullPaperDeadline", e.target.value)}
              placeholder="dd/mm/yyyy (ví dụ: 20/02/2027)"
            />
            {fieldErrors.fullPaperDeadline && (
              <div style={{ color: "#dc2626", fontSize: "0.825rem", marginTop: 4 }}>{fieldErrors.fullPaperDeadline}</div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
              Ngày tổ chức hội thảo
            </label>
            <input
              type="text"
              className={`form-control ${fieldErrors.eventDate ? "border-danger" : ""}`}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: fieldErrors.eventDate ? "1px solid #dc2626" : "1px solid #cbd5e1" }}
              value={formData.eventDate || ""}
              onChange={(e) => handleChange("eventDate", e.target.value)}
              onBlur={(e) => handleDateBlur("eventDate", e.target.value)}
              placeholder="dd/mm/yyyy hoặc dd/mm/yyyy - dd/mm/yyyy"
            />
            <div style={{ fontSize: "0.775rem", color: "#64748b", marginTop: 3 }}>
              Ví dụ: 14/06/2027 hoặc 14/06/2027 - 16/06/2027.
            </div>
            {fieldErrors.eventDate && (
              <div style={{ color: "#dc2626", fontSize: "0.825rem", marginTop: 4 }}>{fieldErrors.eventDate}</div>
            )}
          </div>
        </div>

        {/* 5. Địa điểm & Hình thức xuất bản */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
              Địa điểm / Hình thức
            </label>
            <input
              type="text"
              className="form-control"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}
              value={formData.location || ""}
              onChange={(e) => handleChange("location", e.target.value)}
              placeholder="Trực tiếp tại TP.HCM / Online / Hybrid"
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
              Hình thức xuất bản
            </label>
            <input
              type="text"
              className="form-control"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}
              value={formData.publicationFormat || ""}
              onChange={(e) => handleChange("publicationFormat", e.target.value)}
              placeholder="Kỷ yếu ISBN, Kỷ yếu IEEE Xplore, Springer LNCS..."
            />
          </div>
        </div>

        {/* 6. Ngành MTCN & Chỉ mục */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
              Ngành MTCN phù hợp
            </label>
            <input
              type="text"
              className="form-control"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}
              value={formData.field || ""}
              onChange={(e) => handleChange("field", e.target.value)}
              placeholder="Thiết kế Đồ họa, Nội thất, Công nghiệp, Nghệ thuật số..."
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
              Chỉ mục / Indexing
            </label>
            <input
              type="text"
              className="form-control"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}
              value={formData.indexing || ""}
              onChange={(e) => handleChange("indexing", e.target.value)}
              placeholder="Scopus, Web of Science, EI Compendex, ISBN..."
            />
          </div>
        </div>

        {/* 7. Thông tin chi phí */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
              Tình trạng chi phí
            </label>
            <select
              className="form-control"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}
              value={formData.feeStatus || "UNKNOWN"}
              onChange={(e) => handleChange("feeStatus", e.target.value)}
            >
              <option value="UNKNOWN">Không rõ chi phí</option>
              <option value="SPECIFIED">Có mức phí cụ thể</option>
              <option value="FREE">Miễn phí (Free)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
              Phí đăng bài (Publication Fee)
            </label>
            <input
              type="text"
              className="form-control"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}
              value={formData.publicationFee || ""}
              onChange={(e) => handleChange("publicationFee", e.target.value)}
              placeholder="Theo quy định BTC / Không rõ chi phí"
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
              Phí tham dự (Registration Fee)
            </label>
            <input
              type="text"
              className="form-control"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}
              value={formData.registrationFee || ""}
              onChange={(e) => handleChange("registrationFee", e.target.value)}
              placeholder="Theo quy định BTC / Không rõ chi phí"
            />
          </div>
        </div>

        {/* 8. Tags / Phân loại */}
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
            Tags phân loại
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {DEFAULT_TAGS.map((tag) => {
              const active = formData.tags?.includes(tag);
              return (
                <button
                  type="button"
                  key={tag}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 16,
                    border: active ? "1px solid #2563eb" : "1px solid #cbd5e1",
                    background: active ? "#eff6ff" : "#f8fafc",
                    color: active ? "#1d4ed8" : "#475569",
                    fontSize: "0.825rem",
                    fontWeight: active ? 600 : 400,
                    cursor: "pointer",
                  }}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* 9. Nội dung & Gợi ý hướng bài */}
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
            Nội dung tóm tắt & chủ đề chính
          </label>
          <textarea
            className="form-control"
            style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}
            value={formData.content || ""}
            onChange={(e) => handleChange("content", e.target.value)}
            placeholder="Mô tả phạm vi hội thảo, các tracks hoặc chủ đề chính (topics)..."
            rows={3}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
            Gợi ý hướng bài cho Giảng viên MTCN
          </label>
          <textarea
            className="form-control"
            style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}
            value={formData.directions || ""}
            onChange={(e) => handleChange("directions", e.target.value)}
            placeholder="Ví dụ: Phù hợp bài báo về ứng dụng AI tạo sinh trong Thiết kế Đồ họa; Trải nghiệm tương tác người - máy..."
            rows={2}
          />
        </div>

        {/* 10. Links */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
              Link nguồn chính thức
            </label>
            <input
              type="url"
              className="form-control"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}
              value={formData.sourceUrl || ""}
              onChange={(e) => handleChange("sourceUrl", e.target.value)}
              placeholder="https://conference-website.org"
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
              Link nộp bài (Submission)
            </label>
            <input
              type="url"
              className="form-control"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}
              value={formData.submissionUrl || ""}
              onChange={(e) => handleChange("submissionUrl", e.target.value)}
              placeholder="https://easychair.org/conferences/..."
            />
          </div>
        </div>
      </form>
    </Modal>
  );
};
