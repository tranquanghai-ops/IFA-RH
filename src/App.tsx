import React, { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { PublicHeader } from "./components/PublicHeader";
import { Footer } from "./components/Footer";
import { UserGuideModal } from "./components/UserGuideModal";
import { useAuth } from "./firebase/auth";

// Pages
import { PublicHome } from "./pages/PublicHome";
import { LecturerDashboard } from "./pages/LecturerDashboard";
import { ResearchProgressPage } from "./pages/ResearchProgressPage";
import { PublicationHistoryPage } from "./pages/PublicationHistoryPage";
import { LecturerProfilePage } from "./pages/LecturerProfilePage";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminCandidatesPage } from "./pages/AdminCandidatesPage";
import { AdminOpportunitiesPage } from "./pages/AdminOpportunitiesPage";
import { AdminLecturersPage } from "./pages/AdminLecturersPage";
import { StatisticsPage } from "./pages/StatisticsPage";
import { AdminImportPage } from "./pages/AdminImportPage";
import { OwnerPage } from "./pages/OwnerPage";
import { LoginPage } from "./pages/LoginPage";

export const App: React.FC = () => {
  const { profile, loading, user } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>("public");
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  // Sync tab with URL pathname or hash (/own, #research_progress, etc.)
  useEffect(() => {
    const parseUrlRoute = () => {
      const pathname = window.location.pathname;
      const hash = window.location.hash.replace("#", "");

      if (pathname === "/own" || hash === "own") {
        setCurrentTab("owner");
        return;
      }

      if (hash) {
        setCurrentTab(hash);
        return;
      }

      // Root path
      if (profile) {
        // Default home for authenticated users
        if (profile.role === "admin" || profile.role === "owner") {
          setCurrentTab("admin_dashboard");
        } else {
          setCurrentTab("lecturer_dashboard");
        }
      } else {
        setCurrentTab("public");
      }
    };

    if (!loading) {
      parseUrlRoute();
    }

    const handlePopState = () => parseUrlRoute();
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [profile, loading]);

  const handleSelectTab = (tab: string) => {
    setCurrentTab(tab);
    if (tab === "owner") {
      window.history.pushState({ tab }, "", "/own");
    } else if (tab === "public") {
      window.history.pushState({ tab }, "", "/");
    } else {
      window.history.pushState({ tab }, "", `/#${tab}`);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Render individual page component based on currentTab & role
  const renderContent = () => {
    switch (currentTab) {
      case "public":
        return <PublicHome />;

      case "lecturer_dashboard":
        return profile ? <LecturerDashboard onNavigate={handleSelectTab} /> : <LoginPage />;

      case "research_progress":
        return profile ? <ResearchProgressPage /> : <LoginPage />;

      case "publications":
        return profile ? <PublicationHistoryPage /> : <LoginPage />;

      case "profile":
        return profile ? <LecturerProfilePage /> : <LoginPage />;

      case "admin_dashboard":
        return profile && (profile.role === "admin" || profile.role === "owner") ? (
          <AdminDashboard />
        ) : (
          <LoginPage />
        );

      case "admin_candidates":
        return profile && (profile.role === "admin" || profile.role === "owner") ? (
          <AdminCandidatesPage />
        ) : (
          <LoginPage />
        );

      case "admin_opportunities":
        return profile && (profile.role === "admin" || profile.role === "owner") ? (
          <AdminOpportunitiesPage />
        ) : (
          <LoginPage />
        );

      case "admin_lecturers":
        return profile && (profile.role === "admin" || profile.role === "owner") ? (
          <AdminLecturersPage />
        ) : (
          <LoginPage />
        );

      case "statistics":
        return profile ? <StatisticsPage /> : <LoginPage />;

      case "admin_import":
        return profile && (profile.role === "admin" || profile.role === "owner") ? (
          <AdminImportPage />
        ) : (
          <LoginPage />
        );

      case "owner":
        return profile && profile.role === "owner" ? <OwnerPage /> : <LoginPage />;

      default:
        return <PublicHome />;
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "120px 20px", color: "var(--muted)" }}>
        <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>Đang khởi tạo hệ thống IFA-RH...</div>
        <p style={{ fontSize: "0.85rem", marginTop: 8 }}>Hệ thống Nghiên cứu Khoa học Giảng viên · Khoa Mỹ thuật Công nghiệp</p>
      </div>
    );
  }

  // A. PUBLIC PORTAL VIEW (Homepage / Opportunities Portal)
  if (currentTab === "public" || !profile) {
    return (
      <div className="public-portal-layout">
        <PublicHeader onSelectTab={handleSelectTab} />
        <main className="public-main-content">
          {currentTab === "public" ? <PublicHome /> : <LoginPage />}
        </main>
        <Footer />
        <UserGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      </div>
    );
  }

  // B. PRIVATE / ADMIN WORKSPACE (Authenticated with role profile)
  return (
    <div className="workspace-layout">
      {/* Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        isOpenMobile={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
        onOpenUserGuide={() => setIsGuideOpen(true)}
      />

      {/* Main Workspace Area */}
      <div className="workspace-main">
        {/* IFA-SSR Style Admin Topbar */}
        <Topbar
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          onOpenMobile={() => setIsMobileOpen(true)}
        />

        {/* Content Pane */}
        <main className="workspace-content">
          {renderContent()}
        </main>

        <Footer />
      </div>

      {/* User Guide Modal */}
      <UserGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
};
