import React, { useState, useMemo } from "react";
import type { UserProfile, UserRole } from "../types";
import { promoteLecturerToAdmin } from "../firebase/firestore";
import {
  X,
  Search,
  UserCheck,
  AlertTriangle,
  ShieldCheck,
  Building,
  GraduationCap,
} from "lucide-react";

interface AddAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  allUsers: UserProfile[];
  currentActor: { uid: string; email: string; role: UserRole };
}

export const AddAdminModal: React.FC<AddAdminModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  allUsers,
  currentActor,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter only lecturers for selection candidate list
  const lecturers = useMemo(() => {
    return allUsers.filter((u) => u.role === "lecturer");
  }, [allUsers]);

  // Search results
  const filteredLecturers = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.trim().toLowerCase();
    return lecturers
      .filter(
        (l) =>
          l.name.toLowerCase().includes(term) ||
          l.email.toLowerCase().includes(term)
      )
      .slice(0, 8); // Top 8 matches
  }, [lecturers, searchTerm]);

  // Check if typed email exists anywhere in system
  const typedEmail = searchTerm.trim().toLowerCase();
  const isDirectEmail = typedEmail.includes("@");
  const existingUserByEmail = useMemo(() => {
    if (!isDirectEmail) return null;
    return allUsers.find((u) => u.email.toLowerCase() === typedEmail);
  }, [allUsers, isDirectEmail, typedEmail]);

  if (!isOpen) return null;

  const handleSelectUser = (u: UserProfile) => {
    setSelectedUser(u);
    setError(null);
  };

  const handlePromote = async () => {
    const target = selectedUser || existingUserByEmail;

    if (!target) {
      if (isDirectEmail) {
        if (!typedEmail.endsWith("@tdtu.edu.vn")) {
          setError("Chỉ chấp nhận email cơ quan kết thúc bằng @tdtu.edu.vn!");
          return;
        }
        setError(
          "Tài khoản chưa có trong danh sách người dùng. Hãy thêm người này vào hệ thống trước hoặc provision từ danh bạ nhân sự."
        );
      } else {
        setError("Vui lòng tìm kiếm và chọn một giảng viên để cấp quyền Admin.");
      }
      return;
    }

    const cleanEmail = target.email.trim().toLowerCase();

    // Validation
    if (!cleanEmail.endsWith("@tdtu.edu.vn")) {
      setError("Email của tài khoản này không thuộc miền @tdtu.edu.vn!");
      return;
    }

    if (target.role === "admin") {
      setError(`Tài khoản "${target.name} (${cleanEmail})" đã có quyền Admin!`);
      return;
    }

    if (target.role === "owner") {
      setError(`Tài khoản "${target.name} (${cleanEmail})" là Owner hệ thống!`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await promoteLecturerToAdmin(target, currentActor);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Lỗi khi cấp quyền Admin.");
    } finally {
      setSubmitting(false);
    }
  };

  const targetToPreview = selectedUser || (existingUserByEmail?.role === "lecturer" ? existingUserByEmail : null);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: 620 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "#e0f2fe",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0369a1",
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "var(--primary)" }}>
                Thêm Quản trị viên (Admin)
              </h2>
              <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)" }}>
                Chỉ định giảng viên khoa MTCN làm Admin đồng hành quản lý hệ thống
              </p>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {error && (
            <div
              style={{
                background: "#fee2e2",
                border: "1px solid #fca5a5",
                color: "#991b1b",
                padding: "12px 16px",
                borderRadius: 8,
                fontSize: "0.875rem",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>{error}</div>
            </div>
          )}

          {/* Search Input */}
          <div>
            <label className="form-label" style={{ fontWeight: 600 }}>
              Tìm kiếm giảng viên (theo Họ tên hoặc Email @tdtu.edu.vn):
            </label>
            <div style={{ position: "relative" }}>
              <Search
                size={18}
                color="var(--muted)"
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: 38 }}
                placeholder="Nhập tên giảng viên hoặc địa chỉ email @tdtu.edu.vn..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSelectedUser(null);
                  setError(null);
                }}
                autoFocus
              />
            </div>
            <div style={{ fontSize: "0.775rem", color: "var(--muted)", marginTop: 4 }}>
              Ưu tiên chọn từ danh sách giảng viên đã được kích hoạt/provision trong hệ thống.
            </div>
          </div>

          {/* Search Dropdown / Suggestions */}
          {!selectedUser && filteredLecturers.length > 0 && (
            <div
              style={{
                border: "1px solid var(--line)",
                borderRadius: 8,
                background: "#f8fafc",
                maxHeight: 200,
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  padding: "6px 12px",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  background: "#f1f5f9",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                Giảng viên phù hợp ({filteredLecturers.length})
              </div>
              {filteredLecturers.map((lec) => (
                <div
                  key={lec.id}
                  onClick={() => handleSelectUser(lec)}
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid var(--line)",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#e2e8f0")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--primary)" }}>
                      {lec.name}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                      {lec.email} {lec.department ? `· ${lec.department}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                  >
                    Chọn
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* If typed email not found anywhere */}
          {!targetToPreview && isDirectEmail && !existingUserByEmail && (
            <div
              style={{
                background: "#fef3c7",
                border: "1px solid #fde68a",
                color: "#92400e",
                padding: "12px 16px",
                borderRadius: 8,
                fontSize: "0.85rem",
              }}
            >
              <strong>Thông báo:</strong> Tài khoản <code>{typedEmail}</code> chưa có trong danh sách người dùng.
              Hãy thêm người này vào hệ thống trước hoặc provision từ danh bạ nhân sự tại mục <em>Quản lý Giảng viên</em>.
            </div>
          )}

          {/* If typed email is already admin/owner */}
          {!targetToPreview && existingUserByEmail && existingUserByEmail.role !== "lecturer" && (
            <div
              style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                color: "#1e40af",
                padding: "12px 16px",
                borderRadius: 8,
                fontSize: "0.85rem",
              }}
            >
              Tài khoản <strong>{existingUserByEmail.name}</strong> ({existingUserByEmail.email}) hiện đã giữ vai trò{" "}
              <span className={`role-pill role-${existingUserByEmail.role}`}>
                {existingUserByEmail.role.toUpperCase()}
              </span>.
            </div>
          )}

          {/* Preview Card of Selected / Found Lecturer */}
          {targetToPreview && (
            <div
              style={{
                border: "2px solid #bae6fd",
                borderRadius: 10,
                background: "#f0f9ff",
                padding: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 10,
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: "#0369a1",
                      background: "#e0f2fe",
                      padding: "2px 8px",
                      borderRadius: 4,
                    }}
                  >
                    Giảng viên được chọn để nâng quyền
                  </span>
                  <h3
                    style={{
                      margin: "6px 0 2px",
                      fontSize: "1.1rem",
                      color: "var(--primary)",
                      fontWeight: 700,
                    }}
                  >
                    {targetToPreview.name}
                  </h3>
                  <div style={{ fontSize: "0.875rem", color: "#0369a1", fontWeight: 500 }}>
                    {targetToPreview.email}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span
                    className={
                      targetToPreview.active
                        ? "badge-status badge-approved"
                        : "badge-status badge-rejected"
                    }
                    style={{ fontSize: "0.75rem" }}
                  >
                    {targetToPreview.active ? "ĐANG HOẠT ĐỘNG" : "CHƯA KÍCH HOẠT"}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  fontSize: "0.8125rem",
                  color: "var(--text-main)",
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px dashed #bae6fd",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <GraduationCap size={15} color="#0284c7" />
                  <span>Học vị: <strong>{targetToPreview.academicDegree || "Chưa cập nhật"}</strong></span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Building size={15} color="#0284c7" />
                  <span>Bộ môn: <strong>{targetToPreview.department || "Chưa cập nhật"}</strong></span>
                </div>
              </div>

              {!targetToPreview.active && (
                <div
                  style={{
                    marginTop: 12,
                    fontSize: "0.775rem",
                    color: "#b45309",
                    background: "#fef3c7",
                    padding: "6px 10px",
                    borderRadius: 6,
                  }}
                >
                  ⚠️ <strong>Lưu ý:</strong> Tài khoản này hiện đang ở trạng thái <em>Inactive</em>.
                  Việc cấp quyền Admin sẽ bảo lưu trạng thái và không tự động kích hoạt tài khoản.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Hủy
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePromote}
            disabled={!targetToPreview || submitting}
          >
            <UserCheck size={16} />
            {submitting ? "Đang xử lý..." : "Xác nhận nâng quyền Admin"}
          </button>
        </div>
      </div>
    </div>
  );
};
