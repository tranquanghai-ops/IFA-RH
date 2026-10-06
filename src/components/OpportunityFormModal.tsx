import React, { useState, useEffect } from "react";
import type { Opportunity, OpportunityType, OpportunityLevel } from "../types";
import { Modal } from "./Modal";
import { toInputDate } from "../utils/date";

interface OpportunityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Opportunity>) => Promise<void>;
  initialData?: Opportunity | null;
}

const OPPORTUNITY_TYPES: OpportunityType[] = [
  "Hội thảo",
  "Hội nghị",
  "Call for Papers",
  "Special Issue",
  "Book Chapter",
  "Seminar",
  "Hợp tác nghiên cứu",
  "Đổi mới sáng tạo",
  "Khác",
];

const OPPORTUNITY_LEVELS: OpportunityLevel[] = [
  "Quốc tế",
  "Quốc gia",
  "Cấp Trường",
  "Cấp Khoa",
  "Khác",
];

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
    topic: "",
    field: "Thiết kế đồ họa, Thiết kế công nghiệp, Thiết kế nội thất",
    tags: ["Rất phù hợp MTCN"],
    deadline: "",
    abstractDeadline: "",
    fullPaperDeadline: "",
    registrationDeadline: "",
    eventDate: "",
    location: "Trực tiếp & Online (Hybrid)",
    fee: "Theo thông báo của BTC",
    publicationFormat: "Kỷ yếu có chỉ mục ISBN / Scopus",
    indexing: "Scopus / Web of Science",
    content: "",
    submissionUrl: "",
    sourceUrl: "",
    directions: "",
    status: "published",
    sourceType: "ADMIN",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        deadline: toInputDate(initialData.deadline),
        abstractDeadline: toInputDate(initialData.abstractDeadline),
        fullPaperDeadline: toInputDate(initialData.fullPaperDeadline),
        registrationDeadline: toInputDate(initialData.registrationDeadline),
        eventDate: toInputDate(initialData.eventDate),
      });
    } else {
      setFormData({
        title: "",
        organizer: "",
        country: "Việt Nam",
        type: "Hội thảo",
        level: "Quốc tế",
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
        publicationFormat: "Kỷ yếu có chỉ mục ISBN",
        indexing: "",
        content: "",
        submissionUrl: "",
        sourceUrl: "",
        directions: "",
        status: "published",
        sourceType: "ADMIN",
      });
    }
  }, [initialData, isOpen]);

  const handleChange = (field: keyof Opportunity, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
    if (!formData.title?.trim()) {
      setError("Vui lòng nhập tên hội thảo / cơ hội!");
      return;
    }
    if (!formData.deadline) {
      setError("Vui lòng chọn hạn nộp bài (deadline)!");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await onSubmit(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || "Lỗi lưu cơ hội.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "Chỉnh sửa Cơ hội NCKH" : "Đăng mới Cơ hội NCKH"}
      maxWidth="large"
      footer={
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Hủy
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Đang lưu..." : initialData ? "Lưu thay đổi" : "Đăng cơ hội"}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 6, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">
            Tên hội thảo / cơ hội NCKH <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            className="form-control"
            value={formData.title || ""}
            onChange={(e) => handleChange("title", e.target.value)}
            placeholder="Ví dụ: Hội thảo Quốc tế về Thiết kế và Đổi mới Sáng tạo 2026 (ICDI 2026)"
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Đơn vị tổ chức</label>
            <input
              type="text"
              className="form-control"
              value={formData.organizer || ""}
              onChange={(e) => handleChange("organizer", e.target.value)}
              placeholder="Ví dụ: Đại học Tôn Đức Thắng / ĐH Quốc tế RMIT"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Quốc gia</label>
            <input
              type="text"
              className="form-control"
              value={formData.country || ""}
              onChange={(e) => handleChange("country", e.target.value)}
              placeholder="Việt Nam, Singapore, Anh, v.v."
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Loại cơ hội</label>
            <select
              className="form-control"
              value={formData.type || "Hội thảo"}
              onChange={(e) => handleChange("type", e.target.value as OpportunityType)}
            >
              {OPPORTUNITY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Cấp độ</label>
            <select
              className="form-control"
              value={formData.level || "Quốc tế"}
              onChange={(e) => handleChange("level", e.target.value as OpportunityLevel)}
            >
              {OPPORTUNITY_LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Hạn nộp chính (Deadline) <span style={{ color: "red" }}>*</span></label>
            <input
              type="date"
              className="form-control"
              value={formData.deadline || ""}
              onChange={(e) => handleChange("deadline", e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Hạn nộp tóm tắt (Abstract)</label>
            <input
              type="date"
              className="form-control"
              value={formData.abstractDeadline || ""}
              onChange={(e) => handleChange("abstractDeadline", e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Hạn toàn văn (Full paper)</label>
            <input
              type="date"
              className="form-control"
              value={formData.fullPaperDeadline || ""}
              onChange={(e) => handleChange("fullPaperDeadline", e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Ngày tổ chức</label>
            <input
              type="date"
              className="form-control"
              value={formData.eventDate || ""}
              onChange={(e) => handleChange("eventDate", e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Địa điểm / Hình thức</label>
            <input
              type="text"
              className="form-control"
              value={formData.location || ""}
              onChange={(e) => handleChange("location", e.target.value)}
              placeholder="Trực tiếp tại TP.HCM / Online / Hybrid"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Hình thức xuất bản</label>
            <input
              type="text"
              className="form-control"
              value={formData.publicationFormat || ""}
              onChange={(e) => handleChange("publicationFormat", e.target.value)}
              placeholder="Kỷ yếu ISBN, Tạp chí Scopus Q2, v.v."
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Ngành MTCN phù hợp</label>
            <input
              type="text"
              className="form-control"
              value={formData.field || ""}
              onChange={(e) => handleChange("field", e.target.value)}
              placeholder="Thiết kế Đồ họa, Nội thất, Công nghiệp, Thời trang..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Chỉ mục / Indexing</label>
            <input
              type="text"
              className="form-control"
              value={formData.indexing || ""}
              onChange={(e) => handleChange("indexing", e.target.value)}
              placeholder="Scopus, WoS, ISBN..."
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Tags / Phân loại</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {DEFAULT_TAGS.map((tag) => {
              const active = formData.tags?.includes(tag);
              return (
                <button
                  type="button"
                  key={tag}
                  className={`chip ${active ? "active" : ""}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Nội dung tóm tắt & chủ đề</label>
          <textarea
            className="form-control"
            value={formData.content || ""}
            onChange={(e) => handleChange("content", e.target.value)}
            placeholder="Mô tả tóm tắt về hội thảo, các chủ đề chính (topics)..."
            rows={4}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Gợi ý hướng bài cho Giảng viên MTCN</label>
          <textarea
            className="form-control"
            value={formData.directions || ""}
            onChange={(e) => handleChange("directions", e.target.value)}
            placeholder="Ví dụ: Phù hợp bài báo về ứng dụng AI tạo sinh trong Thiết kế Bao bì; Nghiên cứu vật liệu sinh học trong Thiết kế Nội thất..."
            rows={3}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Link nguồn chính thức</label>
            <input
              type="url"
              className="form-control"
              value={formData.sourceUrl || ""}
              onChange={(e) => handleChange("sourceUrl", e.target.value)}
              placeholder="https://conference-website.org"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Link nộp bài (Submission)</label>
            <input
              type="url"
              className="form-control"
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
