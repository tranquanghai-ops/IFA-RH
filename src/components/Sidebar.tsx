import React from "react";
import { useAuth } from "../firebase/auth";
import {
  LayoutDashboard,
  Compass,
  Layers,
  FileText,
  Sparkles,
  Users,
  Upload,
  BarChart2,
  Shield,
  BookOpen,
  User,
  LogOut,
  X,
} from "lucide-react";

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenUserGuide: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  tabTarget?: string;
  action?: () => void;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  onOpenUserGuide,
}) => {
  const { user, profile, logout } = useAuth();

  if (!profile) return null;

  const role = profile.role;
  const isOwner = role === "owner";
  const isAdmin = role === "admin" || isOwner;

  // Build navigation groups strictly per requirements
  const navGroups: NavGroup[] = [];

  // Group 1: TỔNG QUAN
  navGroups.push({
    title: "TỔNG QUAN",
    items: [
      {
        id: "overview",
        label: "Tổng quan",
        icon: <LayoutDashboard size={18} />,
        tabTarget: isOwner || isAdmin ? "admin_dashboard" : "lecturer_dashboard",
      },
    ],
  });

  // Group 2: NGHIÊN CỨU
  navGroups.push({
    title: "NGHIÊN CỨU",
    items: [
      {
        id: "opportunities",
        label: "Cơ hội NCKH",
        icon: <Compass size={18} />,
        tabTarget: isOwner || isAdmin ? "admin_opportunities" : "public",
      },
      {
        id: "research_progress",
        label: "Tiến độ NCKH",
        icon: <Layers size={18} />,
        tabTarget: "research_progress",
      },
      {
        id: "publications",
        label: "Hồ sơ nghiên cứu",
        icon: <FileText size={18} />,
        tabTarget: "publications",
      },
    ],
  });

  // Group 3: QUẢN TRỊ (Only for Admin & Owner)
  if (isAdmin) {
    navGroups.push({
      title: "QUẢN TRỊ",
      items: [
        {
          id: "admin_candidates",
          label: "Hàng chờ Spark",
          icon: <Sparkles size={18} />,
          tabTarget: "admin_candidates",
        },
        {
          id: "admin_lecturers",
          label: "Giảng viên",
          icon: <Users size={18} />,
          tabTarget: "admin_lecturers",
        },
        {
          id: "admin_import",
          label: "Import dữ liệu",
          icon: <Upload size={18} />,
          tabTarget: "admin_import",
        },
      ],
    });
  }

  // Group 4: BÁO CÁO (All roles have statistics)
  navGroups.push({
    title: "BÁO CÁO",
    items: [
      {
        id: "statistics",
        label: "Thống kê NCKH",
        icon: <BarChart2 size={18} />,
        tabTarget: "statistics",
      },
    ],
  });

  // Group 5: HỆ THỐNG
  const systemItems: NavItem[] = [];
  if (isOwner) {
    systemItems.push({
      id: "owner",
      label: "Khu vực Owner",
      icon: <Shield size={18} />,
      tabTarget: "owner",
    });
  }
  systemItems.push({
    id: "user_guide",
    label: "Hướng dẫn sử dụng",
    icon: <BookOpen size={18} />,
    action: onOpenUserGuide,
  });

  navGroups.push({
    title: "HỆ THỐNG",
    items: systemItems,
  });

  const handleItemClick = (item: NavItem) => {
    if (item.action) {
      item.action();
    } else if (item.tabTarget) {
      onSelectTab(item.tabTarget);
    }
    onCloseMobile();
  };

  const getRoleBadgeLabel = () => {
    if (role === "owner") return "OWNER";
    if (role === "admin") return "ADMIN";
    return "GIẢNG VIÊN";
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`workspace-backdrop ${isOpenMobile ? "active" : ""}`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      {/* Fixed Left Sidebar */}
      <aside
        className={`workspace-sidebar ${isOpenMobile ? "drawer-open" : ""}`}
        aria-label="Thanh điều hướng chính"
      >
        {/* Brand Header */}
        <div className="sidebar-brand-container">
          <div className="sidebar-brand-top">
            <div className="sidebar-logos">
              <img
                src="/tdtu-logo.png"
                alt="Đại học Tôn Đức Thắng"
                className="sidebar-logo-tdtu"
              />
              <div className="sidebar-logo-sep" />
              <img
                src="/ifa-logo.svg"
                alt="Khoa Mỹ thuật Công nghiệp"
                className="sidebar-logo-ifa"
              />
            </div>
            {/* Mobile close button */}
            <button
              type="button"
              className="sidebar-mobile-close"
              onClick={onCloseMobile}
              aria-label="Đóng menu"
            >
              <X size={20} />
            </button>
          </div>

          <div className="sidebar-brand-text">
            <div className="sidebar-brand-title">
              IFA-RH
              <span className="sidebar-badge-academic">HUB</span>
            </div>
            <div className="sidebar-brand-en">IFA Research Hub</div>
            <div className="sidebar-brand-vn">Hệ thống Nghiên cứu Khoa học Giảng viên</div>
          </div>
        </div>

        {/* Navigation Item Groups */}
        <nav className="sidebar-nav-scroll" aria-label="Menu chức năng">
          {navGroups.map((group) => (
            <div key={group.title} className="sidebar-nav-group">
              <div className="sidebar-group-title">{group.title}</div>
              <ul className="sidebar-group-list">
                {group.items.map((item) => {
                  const isActive = item.tabTarget === currentTab;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`sidebar-nav-btn ${isActive ? "active" : ""}`}
                        onClick={() => handleItemClick(item)}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <span className="sidebar-nav-icon">{item.icon}</span>
                        <span className="sidebar-nav-label">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User Area at Bottom */}
        <div className="sidebar-user-footer">
          <div className="sidebar-user-info">
            {profile.photoURL || user?.photoURL ? (
              <img
                src={profile.photoURL || user?.photoURL || ""}
                alt={profile.name || "User"}
                className="sidebar-user-avatar"
              />
            ) : (
              <div className="sidebar-user-avatar-fallback">
                {(profile.name || profile.email || "U").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="sidebar-user-meta">
              <div className="sidebar-user-name" title={profile.name || profile.email}>
                {profile.name || profile.email}
              </div>
              <div className="sidebar-user-sub">
                <span className={`role-pill role-${role}`} style={{ fontSize: "0.68rem", padding: "2px 7px" }}>
                  {getRoleBadgeLabel()}
                </span>
                <span className="sidebar-user-email" title={profile.email}>
                  {profile.email}
                </span>
              </div>
            </div>
          </div>

          <div className="sidebar-user-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm sidebar-action-btn"
              onClick={() => {
                onSelectTab("profile");
                onCloseMobile();
              }}
              title="Hồ sơ cá nhân"
            >
              <User size={15} />
              <span>Hồ sơ</span>
            </button>
            <button
              type="button"
              className="btn btn-outline-danger btn-sm sidebar-action-btn"
              onClick={logout}
              title="Đăng xuất khỏi hệ thống"
            >
              <LogOut size={15} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
