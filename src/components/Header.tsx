import React from "react";
import { useAuth } from "../firebase/auth";
import {
  Compass,
  FileText,
  User,
  Shield,
  Layers,
  Sparkles,
  Users,
  BarChart3,
  Upload,
  LogOut,
  LogIn,
  Settings,
} from "lucide-react";

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onSelectTab }) => {
  const { user, profile, login, logout } = useAuth();

  return (
    <header className="site-header">
      <div className="app-container">
        <div className="header-inner">
          {/* Logo & Brand */}
          <div
            className="brand-section"
            style={{ cursor: "pointer" }}
            onClick={() => onSelectTab("public")}
          >
            <img
              src="/tdtu-logo.png"
              alt="Đại học Tôn Đức Thắng"
              className="logo-tdtu"
            />
            <div className="brand-divider" />
            <div className="brand-text-block">
              <div className="brand-title">
                IFA-RH
                <span className="brand-title-badge">RESEARCH HUB</span>
              </div>
              <div className="brand-subtitle">
                Hệ thống Nghiên cứu Khoa học Giảng viên · Khoa Mỹ thuật Công nghiệp
              </div>
            </div>
          </div>

          {/* Navigation Links based on role */}
          <nav>
            <ul className="nav-links">
              <li>
                <button
                  type="button"
                  className={`nav-item-btn ${currentTab === "public" ? "active" : ""}`}
                  onClick={() => onSelectTab("public")}
                >
                  <Compass size={18} />
                  Cơ hội NCKH
                </button>
              </li>

              {/* Lecturer Links */}
              {profile && (
                <>
                  <li>
                    <button
                      type="button"
                      className={`nav-item-btn ${currentTab === "lecturer_dashboard" ? "active" : ""}`}
                      onClick={() => onSelectTab("lecturer_dashboard")}
                    >
                      <BarChart3 size={18} />
                      Dashboard GV
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className={`nav-item-btn ${currentTab === "research_progress" ? "active" : ""}`}
                      onClick={() => onSelectTab("research_progress")}
                    >
                      <Layers size={18} />
                      Tiến độ NCKH
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className={`nav-item-btn ${currentTab === "publications" ? "active" : ""}`}
                      onClick={() => onSelectTab("publications")}
                    >
                      <FileText size={18} />
                      Hồ sơ nghiên cứu
                    </button>
                  </li>
                </>
              )}

              {/* Admin & Owner Links */}
              {profile && (profile.role === "admin" || profile.role === "owner") && (
                <>
                  <li>
                    <button
                      type="button"
                      className={`nav-item-btn ${currentTab === "admin_dashboard" ? "active" : ""}`}
                      onClick={() => onSelectTab("admin_dashboard")}
                    >
                      <Shield size={18} />
                      Tổng quan Khoa
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className={`nav-item-btn ${currentTab === "admin_candidates" ? "active" : ""}`}
                      onClick={() => onSelectTab("admin_candidates")}
                    >
                      <Sparkles size={18} />
                      Hàng chờ Spark
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className={`nav-item-btn ${currentTab === "admin_opportunities" ? "active" : ""}`}
                      onClick={() => onSelectTab("admin_opportunities")}
                    >
                      <Compass size={18} />
                      Quản lý Cơ hội
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className={`nav-item-btn ${currentTab === "admin_lecturers" ? "active" : ""}`}
                      onClick={() => onSelectTab("admin_lecturers")}
                    >
                      <Users size={18} />
                      Giảng viên
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className={`nav-item-btn ${currentTab === "statistics" ? "active" : ""}`}
                      onClick={() => onSelectTab("statistics")}
                    >
                      <BarChart3 size={18} />
                      Thống kê NCKH
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className={`nav-item-btn ${currentTab === "admin_import" ? "active" : ""}`}
                      onClick={() => onSelectTab("admin_import")}
                    >
                      <Upload size={18} />
                      Import dữ liệu
                    </button>
                  </li>
                </>
              )}

              {/* Owner Area */}
              {profile && profile.role === "owner" && (
                <li>
                  <button
                    type="button"
                    className={`nav-item-btn ${currentTab === "owner" ? "active" : ""}`}
                    onClick={() => onSelectTab("owner")}
                    style={{ color: "#991b1b" }}
                  >
                    <Settings size={18} />
                    Khu vực Owner
                  </button>
                </li>
              )}
            </ul>
          </nav>

          {/* User Status / Login */}
          <div className="header-user-actions">
            {profile ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  className={`role-pill role-${profile.role}`}
                  title={`Vai trò: ${profile.role.toUpperCase()}`}
                >
                  {profile.role === "owner"
                    ? "OWNER"
                    : profile.role === "admin"
                    ? "ADMIN"
                    : "GIẢNG VIÊN"}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onSelectTab("profile")}
                  title="Hồ sơ cá nhân"
                >
                  <User size={16} />
                  {profile.name || profile.email}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm btn-icon"
                  onClick={logout}
                  title="Đăng xuất"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={login}
              >
                <LogIn size={16} />
                Đăng nhập TDTU
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
