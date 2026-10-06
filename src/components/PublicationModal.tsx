import React, { useState, useEffect } from "react";
import type { Publication, UserProfile } from "../types";
import { Modal } from "./Modal";

interface PublicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Publication>) => Promise<void>;
  initialData?: Publication | null;
  userId: string;
  userEmail: string;
  userName: string;
  lecturers?: UserProfile[];
}

const PUBLICATION_TYPES = [
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

export const PublicationModal: React.FC<PublicationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  userId,
  userEmail,
  userName,
  lecturers,
}) => {
  const [formData, setFormData] = useState<Partial<Publication>>({
    year: new Date().getFullYear(),
    title: "",
    type: "Bài báo",
    role: "Tác giả chính",
    coAuthors: "",
    publisher: "",
    journalOrConference: "",
    volume: "",
    issue: "",
    pages: "",
    isbn: "",
    issn: "",
    doi: "",
    indexing: "",
    link: "",
    notes: "",
    userId,
    userEmail,
    userName,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        year: new Date().getFullYear(),
        title: "",
        type: "Bài báo",
        role: "Tác giả chính",
        coAuthors: "",
        publisher: "",
        journalOrConference: "",
        volume: "",
        issue: "",
        pages: "",
        isbn: "",
        issn: "",
        doi: "",
        indexing: "",
        link: "",
        notes: "",
        userId,
        userEmail,
        userName,
      });
    }
    setError("");
  }, [initialData, isOpen, userId, userEmail, userName]);

  const handleChange = (field: keyof Publication, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) {
      setError("Vui lòng nhập tên công trình nghiên cứu!");
      return;
    }
    if (!formData.year) {
      setError("Vui lòng nhập năm xuất bản / thực hiện!");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await onSubmit(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || "Lỗi lưu công trình.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "Chỉnh sửa Công trình trong Hồ sơ" : "Thêm Công trình vào Hồ sơ nghiên cứu"}
      maxWidth="large"
      footer={
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Hủy
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Đang lưu..." : initialData ? "Lưu thay đổi" : "Thêm vào Hồ sơ"}
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
            Tên công trình nghiên cứu <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            className="form-control"
            value={formData.title || ""}
            onChange={(e) => handleChange("title", e.target.value)}
            placeholder="Ví dụ: Định hướng phát triển thiết kế đồ họa bao bì thân thiện môi trường tại Việt Nam"
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Năm hoàn thành / xuất bản <span style={{ color: "red" }}>*</span></label>
            <input
              type="number"
              className="form-control"
              value={formData.year || new Date().getFullYear()}
              onChange={(e) => handleChange("year", Number(e.target.value))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Loại công trình</label>
            <select
              className="form-control"
              value={formData.type || "Bài báo"}
              onChange={(e) => handleChange("type", e.target.value)}
            >
              {PUBLICATION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
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
            <label className="form-label">Tác giả / Đồng tác giả</label>
            <input
              type="text"
              className="form-control"
              value={formData.coAuthors || ""}
              onChange={(e) => handleChange("coAuthors", e.target.value)}
              placeholder="Nguyễn Văn A, Trần Văn B..."
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Tên Tạp chí / Hội thảo</label>
            <input
              type="text"
              className="form-control"
              value={formData.journalOrConference || ""}
              onChange={(e) => handleChange("journalOrConference", e.target.value)}
              placeholder="Tạp chí Khoa học TDTU / Hội thảo Quốc tế ICAD..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Đơn vị xuất bản / Tổ chức</label>
            <input
              type="text"
              className="form-control"
              value={formData.publisher || ""}
              onChange={(e) => handleChange("publisher", e.target.value)}
              placeholder="Nhà xuất bản Tổng hợp, Trường ĐH Tôn Đức Thắng..."
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Tập (Volume)</label>
            <input
              type="text"
              className="form-control"
              value={formData.volume || ""}
              onChange={(e) => handleChange("volume", e.target.value)}
              placeholder="Vol. 15"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Số (Issue)</label>
            <input
              type="text"
              className="form-control"
              value={formData.issue || ""}
              onChange={(e) => handleChange("issue", e.target.value)}
              placeholder="No. 2"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Trang (Pages)</label>
            <input
              type="text"
              className="form-control"
              value={formData.pages || ""}
              onChange={(e) => handleChange("pages", e.target.value)}
              placeholder="45-56"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">DOI</label>
            <input
              type="text"
              className="form-control"
              value={formData.doi || ""}
              onChange={(e) => handleChange("doi", e.target.value)}
              placeholder="10.1016/..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Chỉ mục (Indexing)</label>
            <input
              type="text"
              className="form-control"
              value={formData.indexing || ""}
              onChange={(e) => handleChange("indexing", e.target.value)}
              placeholder="Scopus, WoS, ACI, VAST, Không chỉ mục..."
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">ISBN</label>
            <input
              type="text"
              className="form-control"
              value={formData.isbn || ""}
              onChange={(e) => handleChange("isbn", e.target.value)}
              placeholder="978-604-..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">ISSN</label>
            <input
              type="text"
              className="form-control"
              value={formData.issn || ""}
              onChange={(e) => handleChange("issn", e.target.value)}
              placeholder="2615-..."
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Link bài báo / Kỷ yếu công khai</label>
          <input
            type="url"
            className="form-control"
            value={formData.link || ""}
            onChange={(e) => handleChange("link", e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="form-group">
          <label className="form-label">Ghi chú</label>
          <textarea
            className="form-control"
            value={formData.notes || ""}
            onChange={(e) => handleChange("notes", e.target.value)}
            placeholder="Ghi chú thêm nếu có..."
            rows={2}
          />
        </div>
      </form>
    </Modal>
  );
};
