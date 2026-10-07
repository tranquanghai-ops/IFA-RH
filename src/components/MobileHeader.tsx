import React from "react";
import { useAuth } from "../firebase/auth";
import { Menu } from "lucide-react";

interface MobileHeaderProps {
  currentTab: string;
  onOpenMobile: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ currentTab, onOpenMobile }) => {
  const { user, profile } = useAuth();

  const getPageTitle = (tab: string) => {
    switch (tab) {
      case "lecturer_dashboard":
      case "admin_dashboard":
        return "Tổng quan";
      case "public":
      case "admin_opportunities":
        return "Cơ hội NCKH";
      case "research_progress":
        return "Tiến độ NCKH";
      case "publications":
        return "Hồ sơ nghiên cứu";
      case "admin_candidates":
        return "Dữ liệu AI tìm";
      case "admin_lecturers":
        return "Giảng viên";
      case "admin_import":
        return "Import dữ liệu";
      case "statistics":
        return "Thống kê NCKH";
      case "owner":
        return "Khu vực Owner";
      case "profile":
        return "Hồ sơ cá nhân";
      default:
        return "IFA-RH";
    }
  };

  return (
    <header className="mobile-workspace-header">
      <div className="mobile-header-left">
        <button
          type="button"
          className="mobile-hamburger-btn"
          onClick={onOpenMobile}
          aria-label="Mở menu quản trị"
        >
          <Menu size={22} />
        </button>
        <div className="mobile-brand-inline">
          <img src="/ifa-logo.svg" alt="IFA" className="mobile-brand-logo" />
          <span className="mobile-brand-title">IFA-RH</span>
        </div>
      </div>

      <div className="mobile-header-center">
        <span className="mobile-page-badge">{getPageTitle(currentTab)}</span>
      </div>

      <div className="mobile-header-right">
        {profile && (
          <span className={`role-pill role-${profile.role}`} style={{ fontSize: "0.68rem", padding: "2px 8px" }}>
            {profile.role.toUpperCase()}
          </span>
        )}
      </div>
    </header>
  );
};
