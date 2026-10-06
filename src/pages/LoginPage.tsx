import React from "react";
import { useAuth } from "../firebase/auth";
import { LogIn, ShieldAlert, CheckCircle2 } from "lucide-react";

export const LoginPage: React.FC = () => {
  const { login, error, loading } = useAuth();

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
            <li>Chủ sở hữu (Owner) đầu tiên sẽ được khởi tạo tự động khi đăng nhập lần đầu bằng email quản trị được chỉ định.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
