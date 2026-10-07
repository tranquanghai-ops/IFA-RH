import React from "react";
import { useAuth } from "../firebase/auth";
import { Compass, LogIn, LayoutDashboard, LogOut } from "lucide-react";

interface PublicHeaderProps {
  onSelectTab: (tab: string) => void;
}

export const PublicHeader: React.FC<PublicHeaderProps> = ({ onSelectTab }) => {
  const { user, profile, login, logout } = useAuth();

  const handleGoToWorkspace = () => {
    if (!profile) return;
    if (profile.role === "admin" || profile.role === "owner") {
      onSelectTab("admin_dashboard");
    } else {
      onSelectTab("lecturer_dashboard");
    }
  };

  const getWorkspaceBtnLabel = () => {
    if (!profile) return "Không gian làm việc";
    if (profile.role === "owner" || profile.role === "admin") return "Quản trị";
    return "Không gian làm việc";
  };

  return (
    <header className="public-site-header">
      <div className="app-container">
        <div className="public-header-inner">
          {/* Brand section */}
          <div
            className="public-brand-section"
            onClick={() => onSelectTab("public")}
            style={{ cursor: "pointer" }}
            title="IFA-RH · Trang chủ"
          >
            <div className="public-logos-group">
              <img
                src="/tdtu-logo.png"
                alt="Đại học Tôn Đức Thắng"
                className="public-logo-tdtu"
              />
              <div className="public-logo-divider" />
              <img
                src="/ifa-logo.svg"
                alt="Khoa Mỹ thuật Công nghiệp"
                className="public-logo-ifa"
              />
            </div>
            <div className="public-brand-text">
              <div className="public-brand-title">
                IFA-RH
                <span className="public-brand-badge">RESEARCH HUB</span>
              </div>
              <div className="public-brand-subtitle">
                Hệ thống Nghiên cứu Khoa học Giảng viên · Khoa Mỹ thuật Công nghiệp
              </div>
            </div>
          </div>

          {/* Public Header Actions */}
          <div className="public-header-actions">
            {profile ? (
              /* Authenticated User Controls (IFA-SSR / Requirement 10) */
              <div className="public-auth-user-bar">
                {/* User Avatar */}
                <div
                  className="public-user-avatar-wrapper"
                  onClick={handleGoToWorkspace}
                  style={{ cursor: "pointer" }}
                  title="Đi đến Không gian làm việc"
                >
                  {profile.photoURL || user?.photoURL ? (
                    <img
                      src={profile.photoURL || user?.photoURL || ""}
                      alt={profile.name || "User"}
                      className="public-user-avatar"
                    />
                  ) : (
                    <div className="public-user-avatar-fallback">
                      {(profile.name || profile.email || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* User Name & Role (Desktop) */}
                <div className="public-user-identity" onClick={handleGoToWorkspace} style={{ cursor: "pointer" }}>
                  <span className="public-user-name" title={profile.name || profile.email}>
                    {profile.name || profile.email}
                  </span>
                  <span className={`role-pill role-${profile.role}`}>
                    {profile.role.toUpperCase()}
                  </span>
                </div>

                {/* Return to Workspace Button */}
                <button
                  type="button"
                  className="btn btn-primary btn-sm public-btn-workspace"
                  onClick={handleGoToWorkspace}
                  title="Mở bảng điều khiển quản trị"
                >
                  <LayoutDashboard size={15} />
                  <span>{getWorkspaceBtnLabel()}</span>
                </button>

                {/* Logout Button */}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm public-btn-logout"
                  onClick={logout}
                  title="Đăng xuất"
                >
                  <LogOut size={15} />
                  <span className="public-logout-text">Đăng xuất</span>
                </button>
              </div>
            ) : (
              /* Unauthenticated Visitor Actions */
              <>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm public-btn-portal"
                  onClick={() => onSelectTab("public")}
                >
                  <Compass size={16} />
                  <span>Cổng NCKH</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm public-btn-login"
                  onClick={login}
                >
                  <LogIn size={16} />
                  <span className="public-login-full">Đăng nhập TDTU</span>
                  <span className="public-login-short">Đăng nhập</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
