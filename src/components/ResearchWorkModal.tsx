import React, { useState, useEffect } from "react";
import type { ResearchWork, ResearchStatus, UserProfile } from "../types";
import { Modal } from "./Modal";
import { toInputDate } from "../utils/date";

interface ResearchWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<ResearchWork>, note?: string) => Promise<void>;
  initialData?: ResearchWork | null;
  userId: string;
  userEmail: string;
  userName: string;
  lecturers?: UserProfile[];
}

const CATEGORIES = [
  "Bài báo",
  "Hội thảo",
  "Đề tài NCKH",
  "Sách",
  "Chương sách",
  "Sản phẩm sáng tạo / nghệ thuật",
  "Khác",
];

const ROLES = [
  "Tác giả chính",
  "Đồng tác giả",
  "Tác giả liên hệ",
  "Chủ nhiệm đề tài",
  "Thư ký đề tài",
  "Thành viên nghiên cứu",
];

const STATUS_OPTIONS: ResearchStatus[] = [
  "Ý tưởng",
  "Đang chuẩn bị",
  "Đang viết",
  "Đã gửi",
  "Chờ phản biện",
  "Sửa theo phản biện",
  "Được chấp nhận",
  "Đã xuất bản",
  "Nghiệm thu / Hoàn tất",
];

export const ResearchWorkModal: React.FC<ResearchWorkModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  userId,
  userEmail,
  userName,
  lecturers,
}) => {
  const [formData, setFormData] = useState<Partial<ResearchWork>>({
    title: "",
    category: "Bài báo",
    topic: "",
    venue: "",
    deadline: "",
    plannedSubmissionDate: "",
    actualSubmissionDate: "",
    eventDate: "",
    plannedPublishDate: "",
    role: "Tác giả chính",
    coAuthors: "",
    status: "Ý tưởng",
    notes: "",
    reminderMilestone: "",
    isCompleted: false,
    userId,
    userEmail,
    userName,
  });

  const [progressNote, setProgressNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        deadline: toInputDate(initialData.deadline),
        plannedSubmissionDate: toInputDate(initialData.plannedSubmissionDate),
        actualSubmissionDate: toInputDate(initialData.actualSubmissionDate),
        eventDate: toInputDate(initialData.eventDate),
        plannedPublishDate: toInputDate(initialData.plannedPublishDate),
      });
      setProgressNote("");
    } else {
      setFormData({
        title: "",
        category: "Bài báo",
        topic: "",
        venue: "",
        deadline: "",
        plannedSubmissionDate: "",
        actualSubmissionDate: "",
        eventDate: "",
        plannedPublishDate: "",
        role: "Tác giả chính",
        coAuthors: "",
        status: "Ý tưởng",
        notes: "",
        reminderMilestone: "",
        isCompleted: false,
        userId,
        userEmail,
        userName,
      });
      setProgressNote("");
    }
  }, [initialData, isOpen, userId, userEmail, userName]);

  const handleChange = (field: keyof ResearchWork, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) {
      setError("Vui lòng nhập tên đề tài / bài nghiên cứu!");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await onSubmit(formData, progressNote);
      onClose();
    } catch (err: any) {
      setError(err.message || "Lỗi lưu công trình NCKH.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "Cập nhật Công trình NCKH" : "Thêm mới Công trình NCKH"}
      maxWidth="large"
      footer={
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Hủy
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Đang lưu..." : initialData ? "Lưu thay đổi" : "Tạo công trình"}
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

        {/* If Admin/Owner creates for a lecturer */}
        {lecturers && lecturers.length > 0 && !initialData && (
          <div className="form-group">
            <label className="form-label">
              Giảng viên thực hiện <span style={{ color: "red" }}>*</span>
            </label>
            <select
              className="form-control"
              value={formData.userId}
              onChange={(e) => {
                const selected = lecturers.find(
                  (l) => l.uid === e.target.value || l.id === e.target.value
                );
                if (selected) {
                  setFormData((prev) => ({
                    ...prev,
                    userId: selected.uid || selected.id,
                    userEmail: selected.email,
                    userName: selected.name,
                  }));
                }
              }}
            >
              {lecturers.map((l) => (
                <option key={l.id} value={l.uid || l.id}>
                  {l.name} — {l.email} ({l.department || "MTCN"})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">
            Tên đề tài / bài nghiên cứu <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            className="form-control"
            value={formData.title || ""}
            onChange={(e) => handleChange("title", e.target.value)}
            placeholder="Ví dụ: Nghiên cứu ứng dụng ngôn ngữ tạo hình dân gian trong bao bì nông sản Việt Nam"
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Loại hình</label>
            <select
              className="form-control"
              value={formData.category || "Bài báo"}
              onChange={(e) => handleChange("category", e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Trạng thái tiến độ</label>
            <select
              className="form-control"
              value={formData.status || "Ý tưởng"}
              onChange={(e) => handleChange("status", e.target.value as ResearchStatus)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Chủ đề nghiên cứu</label>
            <input
              type="text"
              className="form-control"
              value={formData.topic || ""}
              onChange={(e) => handleChange("topic", e.target.value)}
              placeholder="Thiết kế bền vững, AI trong nghệ thuật, Typography..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Hội thảo / Tạp chí dự kiến</label>
            <input
              type="text"
              className="form-control"
              value={formData.venue || ""}
              onChange={(e) => handleChange("venue", e.target.value)}
              placeholder="Tạp chí Khoa học TDTU / Hội thảo Quốc tế ICAD 2026..."
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Vai trò</label>
            <select
              className="form-control"
              value={formData.role || "Tác giả chính"}
              onChange={(e) => handleChange("role", e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Đồng tác giả (nếu có)</label>
            <input
              type="text"
              className="form-control"
              value={formData.coAuthors || ""}
              onChange={(e) => handleChange("coAuthors", e.target.value)}
              placeholder="Nguyễn Văn A, Trần Thị B..."
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Hạn nộp (Deadline)</label>
            <input
              type="date"
              className="form-control"
              value={formData.deadline || ""}
              onChange={(e) => handleChange("deadline", e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Ngày dự kiến nộp</label>
            <input
              type="date"
              className="form-control"
              value={formData.plannedSubmissionDate || ""}
              onChange={(e) => handleChange("plannedSubmissionDate", e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Ngày đã nộp</label>
            <input
              type="date"
              className="form-control"
              value={formData.actualSubmissionDate || ""}
              onChange={(e) => handleChange("actualSubmissionDate", e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Ngày tổ chức (nếu là Hội thảo)</label>
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
            <label className="form-label">Ngày dự kiến xuất bản</label>
            <input
              type="date"
              className="form-control"
              value={formData.plannedPublishDate || ""}
              onChange={(e) => handleChange("plannedPublishDate", e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mốc cần nhắc</label>
            <input
              type="text"
              className="form-control"
              value={formData.reminderMilestone || ""}
              onChange={(e) => handleChange("reminderMilestone", e.target.value)}
              placeholder="Nhắc hoàn thiện bản thảo trước ngày 15..."
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Ghi chú chi tiết</label>
          <textarea
            className="form-control"
            value={formData.notes || ""}
            onChange={(e) => handleChange("notes", e.target.value)}
            placeholder="Các ghi chú phát sinh, liên hệ ban biên tập, v.v."
            rows={3}
          />
        </div>

        {initialData && (
          <div className="form-group" style={{ background: "#f8fafc", padding: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
            <label className="form-label">Ghi chú tiến độ mới (sẽ thêm vào Lịch sử mốc thời gian):</label>
            <input
              type="text"
              className="form-control"
              value={progressNote}
              onChange={(e) => setProgressNote(e.target.value)}
              placeholder="Ví dụ: Đã nhận thư chấp nhận bài viết; Chuẩn bị bản camera-ready..."
            />
          </div>
        )}
      </form>
    </Modal>
  );
};
