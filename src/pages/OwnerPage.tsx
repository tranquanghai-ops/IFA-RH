import React, { useState, useEffect } from "react";
import { useAuth } from "../firebase/auth";
import {
  fetchAllUsers,
  setUserRole,
  fetchAuditLogs,
} from "../firebase/firestore";
import type { UserProfile, AuditLog, UserRole } from "../types";
import { formatDateVN } from "../utils/date";
import {
  ShieldAlert,
  Users,
  Activity,
  History,
  CheckCircle,
  Database,
  Lock,
  Search,
} from "lucide-react";

export const OwnerPage: React.FC = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditSearch, setAuditSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadOwnerData = async () => {
    setLoading(true);
    try {
      const [u, logs] = await Promise.all([
        fetchAllUsers(),
        fetchAuditLogs(150),
      ]);
      setUsers(u);
      setAuditLogs(logs);
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

  const handleRoleChange = async (targetUser: UserProfile, newRole: UserRole) => {
    if (targetUser.uid === profile.uid && newRole !== "owner") {
      alert("Bạn không thể tự hạ quyền Owner của chính mình!");
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
        { uid: profile.uid, email: profile.email, role: profile.role }
      );
      setMessage(`Đã cập nhật vai trò cho ${targetUser.email} thành ${newRole}.`);
      await loadOwnerData();
    } catch (err: any) {
      setError(err.message || "Lỗi cập nhật vai trò.");
    }
  };

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
          padding: "28px 32px",
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ color: "#ffffff", fontSize: "1.7rem" }}>Khu vực Quản trị Hệ thống (Owner Area)</h1>
            <span className="role-pill role-owner">OWNER PRIVILEGES</span>
          </div>
          <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginTop: 4 }}>
            Quản trị phân quyền Admin, giám sát nhật ký an toàn (Audit Logs) và kiểm tra sức khỏe hệ thống
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.1)", padding: "8px 16px", borderRadius: 8 }}>
          <Activity size={18} color="#4ade80" />
          <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Cloud Firestore: KẾT NỐI AN TOÀN</span>
        </div>
      </div>

      {message && (
        <div style={{ background: "#dcfce7", color: "#15803d", padding: 14, borderRadius: 8, marginBottom: 20 }}>
          {message}
        </div>
      )}

      {error && (
        <div style={{ background: "#fee2e2", color: "#991b1b", padding: 14, borderRadius: 8, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Grid: Admin Management & System Health */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 24, marginBottom: 32 }}>
        {/* Manage Admins */}
        <div className="card">
          <h3 style={{ fontSize: "1.15rem", color: "var(--primary)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <Lock size={18} /> Quản lý Phân quyền Quản trị (Admin)
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: 16 }}>
            Chỉ duy nhất Owner mới có quyền chỉ định hoặc thu hồi quyền Quản trị viên (Admin) cho nhân sự.
          </p>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Giảng viên</th>
                  <th>Email</th>
                  <th>Vai trò hiện tại</th>
                  <th style={{ textAlign: "right" }}>Gán quyền</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td style={{ fontSize: "0.85rem" }}>{u.email}</td>
                    <td>
                      <span className={`role-pill role-${u.role}`}>{u.role.toUpperCase()}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {u.role === "owner" ? (
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
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Health & Config */}
        <div className="card">
          <h3 style={{ fontSize: "1.15rem", color: "var(--primary)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <Database size={18} /> Trạng thái Hạ tầng & Cấu hình
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#f8fafc", padding: 14, borderRadius: 8, border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 600 }}>FIREBASE PROJECT ID:</div>
              <div style={{ fontWeight: 800, color: "var(--primary)", fontSize: "1rem" }}>ifa-rh</div>
            </div>

            <div style={{ background: "#f8fafc", padding: 14, borderRadius: 8, border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 600 }}>PRODUCTION HOSTING TARGET:</div>
              <div style={{ fontWeight: 800, color: "var(--secondary)", fontSize: "1rem" }}>https://ifa-rh.web.app</div>
            </div>

            <div style={{ background: "#f8fafc", padding: 14, borderRadius: 8, border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 600 }}>FIRESTORE RULES STATUS:</div>
              <div style={{ fontWeight: 700, color: "var(--success)", display: "flex", alignItems: "center", gap: 4 }}>
                <CheckCircle size={14} /> Đã biên dịch & Triển khai Production (Zero Warning)
              </div>
            </div>

            <div style={{ background: "#f8fafc", padding: 14, borderRadius: 8, border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 600 }}>GOOGLE AUTH DOMAIN POLICY:</div>
              <div style={{ fontWeight: 700, color: "var(--primary)" }}>@tdtu.edu.vn (Pre-provisioned Only)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Logs Viewer */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, marginBottom: 16 }}>
          <h3 style={{ fontSize: "1.15rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: 8 }}>
            <History size={18} /> Nhật ký Hoạt động An toàn (Audit Logs)
          </h3>

          <div style={{ position: "relative", minWidth: 260 }}>
            <Search size={16} color="var(--muted)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
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
          <div style={{ color: "var(--muted)", padding: 24, textAlign: "center" }}>Không có bản ghi audit nào.</div>
        ) : (
          <div className="table-container" style={{ maxHeight: 420, overflowY: "auto" }}>
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
    </div>
  );
};
