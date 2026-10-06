import React, { useState, useEffect } from "react";
import { useAuth } from "../firebase/auth";
import {
  fetchAllUsers,
  setUserRole,
  revokeAdminRole,
  fetchAuditLogs,
  fetchImports,
} from "../firebase/firestore";
import type { UserProfile, AuditLog, ImportBatch, UserRole } from "../types";
import { formatDateVN } from "../utils/date";
import { AddAdminModal } from "../components/AddAdminModal";
import {
  ShieldAlert,
  Users,
  Activity,
  History,
  CheckCircle,
  Database,
  Lock,
  Search,
  FileSpreadsheet,
  UserPlus,
  UserMinus,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";

export const OwnerPage: React.FC = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"admins" | "all_users" | "audit" | "imports" | "infra">("admins");

  // Search & Filter
  const [adminSearch, setAdminSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");

  // Modals & Feedback
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadOwnerData = async () => {
    setLoading(true);
    try {
      const [u, logs, imp] = await Promise.all([
        fetchAllUsers(),
        fetchAuditLogs(150),
        fetchImports(50),
      ]);
      setUsers(u);
      setAuditLogs(logs);
      setImportBatches(imp);
    } catch (err: any) {
      console.error(err);
      setError("Lỗi tải dữ liệu Quản trị Owner.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOwnerData();
  }, []);

  if (!profile || profile.role !== "owner") {
    return (
      <div className="app-container" style={{ textAlign: "center", padding: 60 }}>
        <ShieldAlert size={48} color="#b91c1c" style={{ margin: "0 auto 16px" }} />
        <h2 style={{ color: "var(--danger)" }}>Khu vực hạn chế</h2>
        <p style={{ color: "var(--muted)" }}>
          Chỉ có tài khoản với quyền <strong>Owner</strong> mới có thể truy cập khu vực này.
        </p>
      </div>
    );
  }

  // Admins & Owners list
  const adminList = users.filter((u) => u.role === "admin" || u.role === "owner");
  const filteredAdmins = adminList.filter((a) => {
    if (!adminSearch.trim()) return true;
    const q = adminSearch.toLowerCase();
    return a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
  });

  // All Users filtered
  const filteredUsers = users.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  // Revoke Admin
  const handleRevokeAdmin = async (targetUser: UserProfile) => {
    if (targetUser.email === "tranquanghai@tdtu.edu.vn" || targetUser.role === "owner") {
      alert("Không thể gỡ quyền hoặc thay đổi vai trò của Owner sáng lập hệ thống!");
      return;
    }
    if (targetUser.uid === profile.uid) {
      alert("Bạn không thể tự gỡ quyền của chính mình!");
      return;
    }

    const confirmMsg =
      `Xác nhận gỡ quyền Admin của "${targetUser.name} (${targetUser.email})"?\n\n` +
      `- Vai trò mới: Giảng viên\n` +
      `- Dữ liệu cá nhân, lịch sử NCKH và bài báo được bảo toàn nguyên vẹn.\n` +
      `- Hành động này sẽ được ghi vào nhật ký an toàn (Audit Log).`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      setError("");
      setMessage("");
      await revokeAdminRole(targetUser, {
        uid: profile.uid,
        email: profile.email,
        role: profile.role,
      });
      setMessage(`Đã gỡ quyền Admin của ${targetUser.name} (${targetUser.email}) thành công.`);
      await loadOwnerData();
    } catch (err: any) {
      setError(err.message || "Lỗi khi gỡ quyền Admin.");
    }
  };

  // Quick Role Change from All Users table
  const handleRoleChange = async (targetUser: UserProfile, newRole: UserRole) => {
    if (targetUser.uid === profile.uid && newRole !== "owner") {
      alert("Bạn không thể tự hạ quyền Owner của chính mình!");
      return;
    }

    if (
      (targetUser.email === "tranquanghai@tdtu.edu.vn" || targetUser.role === "owner") &&
      newRole !== "owner"
    ) {
      alert("Không thể thay đổi hoặc hạ quyền của tài khoản Owner sáng lập hệ thống!");
      return;
    }

    if (newRole === "owner") {
      alert("Hệ thống chỉ duy trì 1 tài khoản Owner sáng lập duy nhất. Không thể tạo thêm Owner!");
      return;
    }

    if (
      !window.confirm(
        `Xác nhận thay đổi vai trò của "${targetUser.name} (${targetUser.email})" thành [${newRole.toUpperCase()}]?`
      )
    ) {
      return;
    }

    try {
      setError("");
      setMessage("");
      await setUserRole(
        targetUser.id,
        targetUser.email,
        newRole,
        { uid: profile.uid, email: profile.email, role: profile.role },
        targetUser.name,
        targetUser.role
      );
      setMessage(`Đã cập nhật vai trò cho ${targetUser.email} thành ${newRole}.`);
      await loadOwnerData();
    } catch (err: any) {
      setError(err.message || "Lỗi cập nhật vai trò.");
    }
  };

  // Filtered Audit Logs
  const filteredLogs = auditLogs.filter((log) => {
    if (!auditSearch.trim()) return true;
    const q = auditSearch.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.actorEmail.toLowerCase().includes(q) ||
      log.summary.toLowerCase().includes(q) ||
      log.entityType.toLowerCase().includes(q)
    );
  });

  return (
    <div className="app-container">
      {/* Top Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          color: "#ffffff",
          borderRadius: 12,
          padding: "24px 28px",
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ color: "#ffffff", fontSize: "1.6rem", margin: 0 }}>
              Khu vực Quản trị Hệ thống (Owner Area)
            </h1>
            <span className="role-pill role-owner">OWNER PRIVILEGES</span>
          </div>
          <p style={{ color: "#94a3b8", fontSize: "0.875rem", marginTop: 4, marginBottom: 0 }}>
            Quản trị phân quyền Admin, giám sát nhật ký an toàn (Audit Logs) và bảo vệ an ninh hệ thống
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.1)", padding: "8px 16px", borderRadius: 8 }}>
          <Activity size={18} color="#4ade80" />
          <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Cloud Firestore: KẾT NỐI AN TOÀN</span>
        </div>
      </div>

      {message && (
        <div style={{ background: "#dcfce7", color: "#15803d", padding: 14, borderRadius: 8, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")} style={{ background: "none", border: "none", color: "#15803d", cursor: "pointer", fontWeight: 700 }}>✕</button>
        </div>
      )}

      {error && (
        <div style={{ background: "#fee2e2", color: "#991b1b", padding: 14, borderRadius: 8, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} style={{ background: "none", border: "none", color: "#991b1b", cursor: "pointer", fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--line)", marginBottom: 24, overflowX: "auto" }}>
        <button
          type="button"
          className={`btn ${activeTab === "admins" ? "btn-primary" : "btn-secondary"}`}
          style={{ borderRadius: "8px 8px 0 0", borderBottom: activeTab === "admins" ? "2px solid var(--primary)" : "none" }}
          onClick={() => setActiveTab("admins")}
        >
          <Lock size={16} /> Quản lý Admin ({adminList.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === "all_users" ? "btn-primary" : "btn-secondary"}`}
          style={{ borderRadius: "8px 8px 0 0" }}
          onClick={() => setActiveTab("all_users")}
        >
          <Users size={16} /> Toàn bộ Nhân sự ({users.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === "audit" ? "btn-primary" : "btn-secondary"}`}
          style={{ borderRadius: "8px 8px 0 0" }}
          onClick={() => setActiveTab("audit")}
        >
          <History size={16} /> Nhật ký An toàn ({auditLogs.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === "imports" ? "btn-primary" : "btn-secondary"}`}
          style={{ borderRadius: "8px 8px 0 0" }}
          onClick={() => setActiveTab("imports")}
        >
          <FileSpreadsheet size={16} /> Lịch sử Import ({importBatches.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === "infra" ? "btn-primary" : "btn-secondary"}`}
          style={{ borderRadius: "8px 8px 0 0" }}
          onClick={() => setActiveTab("infra")}
        >
          <Database size={16} /> Hạ tầng & Cấu hình
        </button>
      </div>

      {/* TAB 1: QUẢN LÝ ADMIN */}
      {activeTab === "admins" && (
        <div className="card" style={{ padding: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 14,
              marginBottom: 18,
            }}
          >
            <div>
              <h2 style={{ fontSize: "1.25rem", color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldCheck size={20} color="var(--primary)" /> Danh sách Quản trị viên (Admin)
              </h2>
              <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "4px 0 0" }}>
                Chỉ duy nhất Owner mới có quyền chỉ định đồng nghiệp làm Admin hoặc thu hồi quyền Admin.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ position: "relative", minWidth: 240 }}>
                <Search
                  size={16}
                  color="var(--muted)"
                  style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
                />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: 34, fontSize: "0.85rem" }}
                  placeholder="Tìm admin theo tên, email..."
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsAddAdminOpen(true)}
              >
                <UserPlus size={16} /> + Thêm Admin
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
              Đang tải danh sách Admin...
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Họ tên</th>
                    <th>Email</th>
                    <th>Role hiện tại</th>
                    <th>Trạng thái</th>
                    <th>Ngày cấp quyền</th>
                    <th>Người cấp quyền</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdmins.map((u) => {
                    const isFounder = u.email === "tranquanghai@tdtu.edu.vn" || u.role === "owner";
                    const isSelf = u.uid === profile.uid;

                    return (
                      <tr key={u.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: "var(--primary)" }}>{u.name}</div>
                          {u.department && (
                            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                              {u.department} {u.academicDegree ? `· ${u.academicDegree}` : ""}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: "0.85rem" }}>
                          <code>{u.email}</code>
                        </td>
                        <td>
                          <span className={`role-pill role-${u.role}`}>
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          {u.active ? (
                            <span className="badge-status badge-approved" style={{ fontSize: "0.75rem" }}>
                              ACTIVE
                            </span>
                          ) : (
                            <span
                              className="badge-status badge-rejected"
                              style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: 4 }}
                              title="Tài khoản này chưa kích hoạt nhưng quyền Admin vẫn được lưu giữ"
                            >
                              <AlertTriangle size={12} /> INACTIVE (Chưa kích hoạt)
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: "0.8125rem", color: "var(--text-main)" }}>
                          {u.promotedAt
                            ? formatDateVN(u.promotedAt)
                            : u.updatedAt
                            ? formatDateVN(u.updatedAt)
                            : isFounder
                            ? "Khởi tạo hệ thống"
                            : "Mặc định"}
                        </td>
                        <td style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                          {u.promotedBy
                            ? u.promotedBy
                            : isFounder
                            ? "Hệ thống"
                            : "Owner"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {isFounder ? (
                            <span
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--muted)",
                                background: "#f1f5f9",
                                padding: "4px 8px",
                                borderRadius: 4,
                                fontWeight: 600,
                              }}
                            >
                              Chủ sở hữu hệ thống
                            </span>
                          ) : isSelf ? (
                            <span
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--muted)",
                                background: "#f1f5f9",
                                padding: "4px 8px",
                                borderRadius: 4,
                              }}
                            >
                              Tài khoản của bạn
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              style={{
                                color: "var(--danger)",
                                borderColor: "#fca5a5",
                                fontSize: "0.8rem",
                                padding: "4px 10px",
                              }}
                              onClick={() => handleRevokeAdmin(u)}
                              title="Thu hồi quyền Admin và chuyển về Giảng viên"
                            >
                              <UserMinus size={14} /> Gỡ quyền Admin
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TOÀN BỘ NHÂN SỰ & VAI TRÒ */}
      {activeTab === "all_users" && (
        <div className="card" style={{ padding: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 14,
              marginBottom: 18,
            }}
          >
            <div>
              <h2 style={{ fontSize: "1.25rem", color: "var(--primary)", margin: 0 }}>
                Toàn bộ Nhân sự & Phân quyền
              </h2>
              <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "4px 0 0" }}>
                Xem danh sách tất cả tài khoản trong hệ thống và phân bổ vai trò
              </p>
            </div>

            <div style={{ position: "relative", minWidth: 260 }}>
              <Search
                size={16}
                color="var(--muted)"
                style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: 34, fontSize: "0.85rem" }}
                placeholder="Tìm theo tên hoặc email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Email</th>
                  <th>Bộ môn</th>
                  <th>Trạng thái</th>
                  <th>Vai trò</th>
                  <th style={{ textAlign: "right" }}>Gán quyền</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isFounder = u.email === "tranquanghai@tdtu.edu.vn" || u.role === "owner";
                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.name}</td>
                      <td style={{ fontSize: "0.85rem" }}>{u.email}</td>
                      <td style={{ fontSize: "0.85rem" }}>{u.department || "—"}</td>
                      <td>
                        <span className={u.active ? "badge-status badge-approved" : "badge-status badge-rejected"}>
                          {u.active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                      <td>
                        <span className={`role-pill role-${u.role}`}>{u.role.toUpperCase()}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {isFounder ? (
                          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Chủ sở hữu</span>
                        ) : (
                          <select
                            className="form-control"
                            style={{ width: "auto", fontSize: "0.8rem", padding: "4px 8px" }}
                            value={u.role}
                            onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                          >
                            <option value="lecturer">Giảng viên</option>
                            <option value="admin">Quản trị viên (Admin)</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT LOGS */}
      {activeTab === "audit" && (
        <div className="card" style={{ padding: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 14,
              marginBottom: 16,
            }}
          >
            <div>
              <h2 style={{ fontSize: "1.25rem", color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <History size={18} /> Nhật ký Hoạt động An toàn (Audit Logs)
              </h2>
              <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "4px 0 0" }}>
                Ghi nhận bất biến các thao tác thay đổi phân quyền, cập nhật tiến độ, duyệt cơ hội
              </p>
            </div>

            <div style={{ position: "relative", minWidth: 260 }}>
              <Search
                size={16}
                color="var(--muted)"
                style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: 34, fontSize: "0.85rem" }}
                placeholder="Tìm hành động, người thực hiện..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
              />
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div style={{ color: "var(--muted)", padding: 24, textAlign: "center" }}>
              Không có bản ghi audit nào.
            </div>
          ) : (
            <div className="table-container" style={{ maxHeight: 500, overflowY: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>Thời gian</th>
                    <th>Người thực hiện</th>
                    <th>Hành động</th>
                    <th>Đối tượng</th>
                    <th>Nội dung tóm tắt</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: "0.8rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
                        {new Date(log.timestamp).toLocaleString("vi-VN")}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{log.actorEmail}</div>
                        <span className={`role-pill role-${log.actorRole}`} style={{ fontSize: "0.65rem", padding: "1px 6px" }}>
                          {log.actorRole}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: "var(--primary)", fontSize: "0.8rem" }}>
                        {log.action}
                      </td>
                      <td>
                        <span className="badge badge-neutral" style={{ fontSize: "0.75rem" }}>
                          {log.entityType}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.85rem" }}>{log.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: LỊCH SỬ IMPORT */}
      {activeTab === "imports" && (
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: "1.25rem", color: "var(--primary)", margin: 0, display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <FileSpreadsheet size={18} /> Lịch sử các Đợt Import Dữ liệu
          </h2>

          {importBatches.length === 0 ? (
            <div style={{ color: "var(--muted)", padding: 24, textAlign: "center" }}>
              Chưa có đợt import dữ liệu nào được ghi nhận.
            </div>
          ) : (
            <div className="table-container" style={{ maxHeight: 420, overflowY: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>Thời gian</th>
                    <th>Tên tệp</th>
                    <th>Phân loại</th>
                    <th>Người thực hiện</th>
                    <th>Tổng dòng</th>
                    <th>Thành công</th>
                    <th>Lỗi / Bỏ qua</th>
                  </tr>
                </thead>
                <tbody>
                  {importBatches.map((b) => (
                    <tr key={b.id}>
                      <td style={{ fontSize: "0.8rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
                        {new Date(b.timestamp).toLocaleString("vi-VN")}
                      </td>
                      <td style={{ fontWeight: 600 }}>{b.fileName}</td>
                      <td>
                        <span className="badge badge-neutral">{b.type}</span>
                      </td>
                      <td style={{ fontSize: "0.85rem" }}>{b.importedBy}</td>
                      <td>{b.totalRows}</td>
                      <td>
                        <span className="badge badge-success">{b.successCount}</span>
                      </td>
                      <td>
                        {b.errorCount > 0 ? (
                          <span className="badge badge-danger">{b.errorCount}</span>
                        ) : (
                          <span className="badge badge-neutral">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: HẠ TẦNG */}
      {activeTab === "infra" && (
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: "1.25rem", color: "var(--primary)", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
            <Database size={18} /> Trạng thái Hạ tầng & Cấu hình Hệ thống
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <div style={{ background: "#f8fafc", padding: 16, borderRadius: 8, border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 600 }}>FIREBASE PROJECT ID:</div>
              <div style={{ fontWeight: 800, color: "var(--primary)", fontSize: "1.1rem", marginTop: 4 }}>ifa-rh</div>
            </div>

            <div style={{ background: "#f8fafc", padding: 16, borderRadius: 8, border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 600 }}>PRODUCTION HOSTING TARGET:</div>
              <div style={{ fontWeight: 800, color: "var(--secondary)", fontSize: "1.1rem", marginTop: 4 }}>https://ifa-rh.web.app</div>
            </div>

            <div style={{ background: "#f8fafc", padding: 16, borderRadius: 8, border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 600 }}>FIRESTORE RULES STATUS:</div>
              <div style={{ fontWeight: 700, color: "var(--success)", display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <CheckCircle size={16} /> Đã bảo vệ phân quyền (Owner Protection Active)
              </div>
            </div>

            <div style={{ background: "#f8fafc", padding: 16, borderRadius: 8, border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 600 }}>GOOGLE AUTH DOMAIN POLICY:</div>
              <div style={{ fontWeight: 700, color: "var(--primary)", marginTop: 4 }}>@tdtu.edu.vn (Pre-provisioned Only)</div>
            </div>
          </div>
        </div>
      )}

      {/* Add Admin Modal */}
      <AddAdminModal
        isOpen={isAddAdminOpen}
        onClose={() => setIsAddAdminOpen(false)}
        onSuccess={() => {
          setMessage("Đã cấp quyền Admin thành công.");
          loadOwnerData();
        }}
        allUsers={users}
        currentActor={{ uid: profile.uid, email: profile.email, role: profile.role }}
      />
    </div>
  );
};
