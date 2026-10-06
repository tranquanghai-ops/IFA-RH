import React from "react";
import { useAuth } from "../firebase/auth";
import { LogIn, ShieldAlert, AlertTriangle, LogOut, RefreshCw } from "lucide-react";

export const LoginPage: React.FC = () => {
  const { user, login, logout, error, loading, authStatus } = useAuth();

  // Handle unprovisioned TDTU account
  if (authStatus === "unprovisioned" && user) {
    return (
      <div className="app-container" style={{ maxWidth: 540, margin: "60px auto" }}>
        <div className="card" style={{ padding: "40px 32px", textAlign: "center", borderTop: "4px solid #f59e0b" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              backgroundColor: "#fef3c7",
              color: "#d97706",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <AlertTriangle size={32} />
          </div>

          <h2 style={{ fontSize: "1.35rem", color: "#92400e", marginBottom: 12 }}>
            Tài khoản này chưa được cấp quyền sử dụng IFA-RH.
          </h2>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 20,
              fontSize: "0.9rem",
              color: "var(--text-main)",
            }}
          >
            Đang đăng nhập bằng: <strong>{user.email}</strong>
          </div>

          <p style={{ color: "var(--muted)", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: 24, textAlign: "left" }}>
            Tài khoản email TDTU này hiện chưa có trong danh sách giảng viên / nghiên cứu viên được cấp quyền truy cập hệ thống IFA-RH.
            Vui lòng liên hệ <strong>Quản trị viên Khoa Mỹ thuật Công nghiệp</strong> hoặc Ban Chủ nhiệm Khoa để được cấp quyền vào hệ thống.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={logout}
              style={{ flex: 1 }}
            >
              <LogOut size={18} />
              Đăng xuất
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                await logout();
                await login();
              }}
              style={{ flex: 1 }}
            >
              <RefreshCw size={18} />
              Đổi tài khoản khác
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Handle external non-TDTU email
  if (authStatus === "invalid_domain" && user) {
    return (
      <div className="app-container" style={{ maxWidth: 540, margin: "60px auto" }}>
        <div className="card" style={{ padding: "40px 32px", textAlign: "center", borderTop: "4px solid #ef4444" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              backgroundColor: "#fee2e2",
              color: "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <ShieldAlert size={32} />
          </div>

          <h2 style={{ fontSize: "1.35rem", color: "#991b1b", marginBottom: 12 }}>
            Email không hợp lệ
          </h2>

          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 20,
              fontSize: "0.9rem",
              color: "#991b1b",
            }}
          >
            Đang đăng nhập bằng: <strong>{user.email}</strong>
          </div>

          <p style={{ color: "var(--muted)", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: 24, textAlign: "left" }}>
            Hệ thống IFA-RH chỉ dành riêng cho cán bộ, giảng viên Trường Đại học Tôn Đức Thắng sử dụng tài khoản email đuôi <code>@tdtu.edu.vn</code>.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={logout}
              style={{ flex: 1 }}
            >
              <LogOut size={18} />
              Đăng xuất
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                await logout();
                await login();
              }}
              style={{ flex: 1 }}
            >
              <RefreshCw size={18} />
              Đăng nhập bằng email TDTU
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Handle standard unauthenticated state
  return (
    <div className="app-container" style={{ maxWidth: 520, margin: "60px auto" }}>
      <div className="card" style={{ padding: "40px 32px", textAlign: "center" }}>
        <img
          src="/tdtu-logo.png"
          alt="TDTU"
          style={{ height: 60, margin: "0 auto 16px", objectFit: "contain" }}
        />

        <h2 style={{ fontSize: "1.5rem", color: "var(--primary)", marginBottom: 8 }}>
          Đăng nhập IFA-RH
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: 24, lineHeight: 1.5 }}>
          Hệ thống Nghiên cứu Khoa học Giảng viên<br />
          Khoa Mỹ thuật Công nghiệp — Đại học Tôn Đức Thắng
        </p>

        {error && (
          <div
            style={{
              background: "#fee2e2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              padding: 14,
              borderRadius: 8,
              marginBottom: 20,
              fontSize: "0.875rem",
              textAlign: "left",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>{error}</div>
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary"
          style={{ width: "100%", padding: "12px 20px", fontSize: "1rem" }}
          onClick={login}
          disabled={loading}
        >
          <LogIn size={20} />
          {loading ? "Đang xác thực..." : "Đăng nhập với Google (@tdtu.edu.vn)"}
        </button>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--line)", fontSize: "0.8125rem", color: "var(--muted)", textAlign: "left" }}>
          <div style={{ fontWeight: 600, color: "var(--text-main)", marginBottom: 6 }}>
            Quy định quyền truy cập:
          </div>
          <ul style={{ paddingLeft: 18, lineHeight: 1.6 }}>
            <li>Chỉ chấp nhận địa chỉ email giảng viên đuôi <code>@tdtu.edu.vn</code>.</li>
            <li>Tài khoản phải được phân quyền trước bởi Ban Chủ nhiệm Khoa hoặc Quản trị viên hệ thống.</li>
            <li>Chủ sở hữu (Owner) đầu tiên sẽ được khởi tạo an toàn tự động khi đăng nhập bằng email quản trị được chỉ định.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
