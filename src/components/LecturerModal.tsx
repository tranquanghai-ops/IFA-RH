import React, { useState, useEffect } from "react";
import type { UserProfile, UserRole } from "../types";
import { Modal } from "./Modal";

interface LecturerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    email: string;
    name: string;
    role: UserRole;
    department?: string;
    academicDegree?: string;
    active: boolean;
  }) => Promise<void>;
  initialData?: UserProfile | null;
  currentUserRole?: UserRole;
}

const DEPARTMENTS = [
  "Bộ môn Thiết kế Đồ họa",
  "Bộ môn Thiết kế Công nghiệp",
  "Bộ môn Thiết kế Nội thất",
  "Bộ môn Thiết kế Thời trang",
  "Bộ môn Mỹ thuật Cơ bản",
  "Văn phòng Khoa",
];

const DEGREES = ["Cử nhân", "Kỹ sư", "ThS", "TS", "PGS.TS", "GS.TS"];

export const LecturerModal: React.FC<LecturerModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  currentUserRole,
}) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [academicDegree, setAcademicDegree] = useState(DEGREES[2]); // ThS
  const [role, setRole] = useState<UserRole>("lecturer");
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setEmail(initialData.email || "");
      setDepartment(initialData.department || DEPARTMENTS[0]);
      setAcademicDegree(initialData.academicDegree || DEGREES[2]);
      setRole(initialData.role || "lecturer");
      setActive(initialData.active !== false);
    } else {
      setName("");
      setEmail("");
      setDepartment(DEPARTMENTS[0]);
      setAcademicDegree(DEGREES[2]);
      setRole("lecturer");
      setActive(true);
    }
    setError("");
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Vui lòng nhập họ và tên giảng viên!");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Vui lòng nhập địa chỉ email hợp lệ!");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await onSubmit({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        department,
        academicDegree,
        active,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Lỗi lưu giảng viên.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "Chỉnh sửa Giảng viên" : "Thêm mới Giảng viên"}
      footer={
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Hủy
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Đang lưu..." : initialData ? "Lưu thay đổi" : "Thêm giảng viên"}
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
            Họ và tên giảng viên <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            className="form-control"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Nguyễn Văn A"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            Email TDTU <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="email"
            className="form-control"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nguyenvana@tdtu.edu.vn"
            disabled={!!initialData} // Email immutable once created
            required
          />
          {initialData && <small style={{ color: "var(--muted)" }}>Email không thể thay đổi sau khi tạo.</small>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Bộ môn / Ngành</label>
            <select
              className="form-control"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Học vị</label>
            <select
              className="form-control"
              value={academicDegree}
              onChange={(e) => setAcademicDegree(e.target.value)}
            >
              {DEGREES.map((deg) => (
                <option key={deg} value={deg}>{deg}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Role selection - only Owner can make someone Admin */}
        {currentUserRole === "owner" && (
          <div className="form-group">
            <label className="form-label">Vai trò hệ thống</label>
            <select
              className="form-control"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              <option value="lecturer">Giảng viên</option>
              <option value="admin">Quản trị viên (Admin)</option>
            </select>
          </div>
        )}

        <div className="form-group" style={{ marginTop: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <span>Đang hoạt động (Kích hoạt đăng nhập và sử dụng hệ thống)</span>
          </label>
        </div>
      </form>
    </Modal>
  );
};
