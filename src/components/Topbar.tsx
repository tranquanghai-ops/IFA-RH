import React from "react";
import { useAuth } from "../firebase/auth";
import { Menu, Globe, LogOut } from "lucide-react";

interface TopbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenMobile: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenMobile,
}) => {
  const { user, profile, logout } = useAuth();

  if (!profile) return null;

  const getBreadcrumb = (tab: string) => {
    switch (tab) {
      case "admin_dashboard":
        return { root: "Quản trị", leaf: "Tổng quan NCKH Toàn Khoa" };
      case "lecturer_dashboard":
        return { root: "IFA-RH", leaf: "Bảng điều khiển Giảng viên" };
      case "admin_opportunities":
        return { root: "Quản trị", leaf: "Quản lý Cơ hội NCKH" };
      case "research_progress":
        return { root: "Nghiên cứu", leaf: "Tiến độ NCKH" };
      case "publications":
        return { root: "Nghiên cứu", leaf: "Hồ sơ nghiên cứu & Công bố" };
      case "admin_candidates":
        return { root: "Quản trị", leaf: "Dữ liệu AI tìm" };
      case "admin_lecturers":
        return { root: "Quản trị", leaf: "Danh sách Giảng viên" };
      case "admin_import":
        return { root: "Quản trị", leaf: "Import dữ liệu NCKH" };
      case "statistics":
        return { root: "Báo cáo", leaf: "Thống kê NCKH" };
      case "owner":
        return { root: "Chủ sở hữu", leaf: "Khu vực Owner & Cấu hình" };
      case "profile":
        return { root: "Cá nhân", leaf: "Thông tin Giảng viên" };
      default:
        return { root: "IFA-RH", leaf: "Không gian làm việc" };
    }
  };

  const { root, leaf } = getBreadcrumb(currentTab);

  const getRoleLabel = () => {
    if (profile.role === "owner") return "OWNER";
    if (profile.role === "admin") return "ADMIN";
    return "GIẢNG VIÊN";
  };

  return (
    <header className="admin-topbar">
      {/* Left side: Mobile Toggle & Breadcrumb */}
      <div className="admin-topbar-left">
        <button
          type="button"
          className="icon-button mobile-toggle"
          aria-label="Menu quản trị"
          onClick={onOpenMobile}
        >
          <Menu size={20} />
        </button>

        <div className="admin-breadcrumb">
          <span className="breadcrumb-root">{root}</span>
          <span className="breadcrumb-slash">/</span>
          <span className="breadcrumb-leaf">{leaf}</span>
        </div>
      </div>

      {/* Right side: Trang chung & Account (IFA-SSR style) */}
      <div className="account">
        {/* Nút Trang chung */}
        <button
          type="button"
          className="btn btn-secondary btn-sm admin-public-btn"
          onClick={() => onSelectTab("public")}
          title="Xem trang công khai"
        >
          <Globe size={15} />
          <span className="admin-public-btn-text">Trang chung</span>
        </button>

        {/* User Google Avatar */}
        <div
          className="account-avatar-wrapper"
          onClick={() => onSelectTab("profile")}
          style={{ cursor: "pointer" }}
          title="Hồ sơ cá nhân"
        >
          {profile.photoURL || user?.photoURL ? (
            <img
              src={profile.photoURL || user?.photoURL || ""}
              alt={profile.name || "User"}
              className="account-avatar"
            />
          ) : (
            <div className="account-avatar-fallback">
              {(profile.name || profile.email || "U").charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Account Identity (Desktop) */}
        <div className="account-identity">
          <div className="account-name-line">
            <span
              className="account-name"
              onClick={() => onSelectTab("profile")}
              style={{ cursor: "pointer" }}
              title="Xem hồ sơ"
            >
              {profile.name || profile.email}
            </span>
            <span className={`role-pill role-${profile.role}`}>
              {getRoleLabel()}
            </span>
          </div>
          <small className="account-email" title={profile.email}>
            {profile.email}
          </small>
        </div>

        {/* Account Mobile Role (Tablet & Mobile) */}
        <span className="account-mobile-role">
          <span className={`role-pill role-${profile.role}`}>
            {getRoleLabel()}
          </span>
        </span>

        {/* Nút Logout */}
        <button
          type="button"
          className="icon-button account-logout-btn"
          aria-label="Đăng xuất"
          onClick={logout}
          title="Đăng xuất khỏi hệ thống"
        >
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
};
