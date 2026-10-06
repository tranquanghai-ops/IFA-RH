import React, { useState, useEffect } from "react";
import { useAuth } from "../firebase/auth";
import {
  fetchAllUsers,
  createOrProvisionUser,
  updateUserProfile,
} from "../firebase/firestore";
import type { UserProfile } from "../types";
import { LecturerModal } from "../components/LecturerModal";
import { LecturerImportModal } from "../components/LecturerImportModal";
import { exportToExcel, exportToCsv } from "../utils/excel";
import { formatDateVN } from "../utils/date";
import {
  Users,
  Plus,
  Search,
  Upload,
  UserCheck,
  UserX,
  Edit2,
  Mail,
  GraduationCap,
  Building,
  Download,
  FileSpreadsheet,
} from "lucide-react";

export const AdminLecturersPage: React.FC = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("Tất cả");

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importReport, setImportReport] = useState<string | null>(null);
  const [editingLecturer, setEditingLecturer] = useState<UserProfile | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const list = await fetchAllUsers();
      setUsers(list);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  if (!profile) return null;

  // Department list
  const departments = Array.from(new Set(users.map((u) => u.department).filter(Boolean)));

  const filteredUsers = users.filter((u) => {
    const matchDept = departmentFilter === "Tất cả" || u.department === departmentFilter;
    const matchSearch =
      searchQuery.trim() === "" ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchDept && matchSearch;
  });

  const handleToggleActive = async (target: UserProfile) => {
    const newActive = !target.active;
    const actionName = newActive ? "kích hoạt" : "vô hiệu hóa";
    if (!window.confirm(`Bạn có chắc muốn ${actionName} tài khoản "${target.name} (${target.email})"? (Lịch sử NCKH và bài báo vẫn được bảo lưu)`)) {
      return;
    }
    try {
      await updateUserProfile(
        target.id,
        { active: newActive },
        { uid: profile.uid, email: profile.email, role: profile.role }
      );
      await loadUsers();
    } catch (err: any) {
      alert("Lỗi cập nhật trạng thái: " + err.message);
    }
  };

  const handleExportExcel = async () => {
    const cols = [
      { header: "Họ và tên", key: "name", width: 25 },
      { header: "Email TDTU", key: "email", width: 28 },
      { header: "Bộ môn / Ngành", key: "department", width: 22 },
      { header: "Học vị", key: "academicDegree", width: 14 },
      { header: "Vai trò", key: "role", width: 14 },
      { header: "Trạng thái", key: "statusText", width: 16 },
      { header: "ORCID", key: "orcid", width: 20 },
      { header: "Ngày tạo", key: "formattedCreated", width: 16 },
    ];
    const data = filteredUsers.map((u) => ({
      ...u,
      statusText: u.active !== false ? "Hoạt động" : "Vô hiệu hóa",
      formattedCreated: formatDateVN(u.createdAt || ""),
    }));
    await exportToExcel("Danh-sach-giang-vien-MTCN", "Giảng viên", cols, data);
  };

  const handleExportCsv = () => {
    const cols = [
      { header: "Họ và tên", key: "name" },
      { header: "Email TDTU", key: "email" },
      { header: "Bộ môn / Ngành", key: "department" },
      { header: "Học vị", key: "academicDegree" },
      { header: "Vai trò", key: "role" },
      { header: "Trạng thái", key: "statusText" },
    ];
    const data = filteredUsers.map((u) => ({
      ...u,
      statusText: u.active !== false ? "Hoạt động" : "Vô hiệu hóa",
    }));
    exportToCsv("Danh-sach-giang-vien-MTCN", cols, data);
  };

  return (
    <div className="app-container">
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.6rem", color: "var(--primary)" }}>Quản lý Nhân sự Giảng viên</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: 4 }}>
            Danh sách nhân sự được phân quyền sử dụng hệ thống IFA-RH (Chỉ các tài khoản được thêm trước mới có thể đăng nhập)
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportExcel}
            title="Xuất danh sách ra file Excel"
          >
            <FileSpreadsheet size={15} /> Xuất Excel
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportCsv}
            title="Xuất danh sách ra file CSV"
          >
            <Download size={15} /> Xuất CSV
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsImportOpen(true)}
          >
            <Upload size={16} /> Import Excel nhiều GV
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsAddOpen(true)}
          >
            <Plus size={16} /> Thêm một GV
          </button>
        </div>
      </div>

      {/* Import Report Banner */}
      {importReport && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#166534",
            padding: 16,
            borderRadius: 8,
            marginBottom: 20,
            whiteSpace: "pre-line",
            fontSize: "0.875rem",
          }}
        >
          {importReport}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 280px" }}>
            <Search
              size={18}
              color="var(--muted)"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: 38 }}
              placeholder="Tìm kiếm giảng viên theo tên, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>Bộ môn:</span>
            <select
              className="form-control"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              style={{ width: "auto" }}
            >
              <option value="Tất cả">Tất cả bộ môn</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lecturers Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
          Đang tải danh sách giảng viên...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
          <Users size={36} color="var(--muted)" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ color: "var(--primary)", marginBottom: 6 }}>Chưa có giảng viên nào</h3>
          <p style={{ fontSize: "0.9rem", maxWidth: 450, margin: "0 auto 16px" }}>
            Hãy thêm giảng viên đầu tiên hoặc tải lên file Excel danh sách nhân sự Khoa.
          </p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Họ và tên</th>
                <th>Email TDTU</th>
                <th>Bộ môn / Ngành</th>
                <th>Học vị</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--primary)" }}>
                      {u.name}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}>
                      <Mail size={13} color="var(--muted)" />
                      <span>{u.email}</span>
                    </div>
                  </td>
                  <td>{u.department || "—"}</td>
                  <td>
                    <span className="badge badge-neutral" style={{ fontWeight: 600 }}>
                      {u.academicDegree || "—"}
                    </span>
                  </td>
                  <td>
                    <span className={`role-pill role-${u.role}`}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    {u.active !== false ? (
                      <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <UserCheck size={12} /> Hoạt động
                      </span>
                    ) : (
                      <span className="badge badge-warning" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <UserX size={12} /> Vô hiệu
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-icon"
                        onClick={() => setEditingLecturer(u)}
                        title="Sửa thông tin"
                      >
                        <Edit2 size={14} />
                      </button>

                      {/* Do not allow deactivating Owner */}
                      {u.role !== "owner" && (
                        <button
                          type="button"
                          className={`btn ${u.active !== false ? "btn-outline-danger" : "btn-success"} btn-sm btn-icon`}
                          onClick={() => handleToggleActive(u)}
                          title={u.active !== false ? "Vô hiệu hóa tài khoản" : "Kích hoạt lại"}
                        >
                          {u.active !== false ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lecturer Modal */}
      <LecturerModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        currentUserRole={profile.role}
        onSubmit={async (data) => {
          await createOrProvisionUser(
            data,
            { uid: profile.uid, email: profile.email, role: profile.role }
          );
          await loadUsers();
        }}
      />

      <LecturerModal
        isOpen={!!editingLecturer}
        onClose={() => setEditingLecturer(null)}
        initialData={editingLecturer}
        currentUserRole={profile.role}
        onSubmit={async (data) => {
          if (!editingLecturer) return;
          await updateUserProfile(
            editingLecturer.id,
            data,
            { uid: profile.uid, email: profile.email, role: profile.role }
          );
          await loadUsers();
        }}
      />

      <LecturerImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={loadUsers}
        existingUsers={users}
        actor={{ uid: profile.uid, email: profile.email, role: profile.role }}
      />
    </div>
  );
};
