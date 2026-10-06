import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
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

  // Sync tab with URL path or hash (/own)
  useEffect(() => {
    const checkPath = () => {
      const pathname = window.location.pathname;
      const hash = window.location.hash;
      if (pathname === "/own" || hash === "#own") {
        setCurrentTab("owner");
      }
    };
    checkPath();
    window.addEventListener("popstate", checkPath);
    return () => window.removeEventListener("popstate", checkPath);
  }, []);

  const handleSelectTab = (tab: string) => {
    setCurrentTab(tab);
    if (tab === "owner") {
      window.history.pushState(null, "", "/own");
    } else {
      window.history.pushState(null, "", "/");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <Header currentTab={currentTab} onSelectTab={handleSelectTab} />

      <main className="main-content">
        {loading ? (
          <div style={{ textAlign: "center", padding: "100px 20px", color: "var(--muted)" }}>
            <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>Đang khởi tạo hệ thống IFA-RH...</div>
          </div>
        ) : (
          <>
            {currentTab === "public" && <PublicHome />}

            {currentTab === "lecturer_dashboard" && (
              profile ? <LecturerDashboard onNavigate={handleSelectTab} /> : <LoginPage />
            )}

            {currentTab === "research_progress" && (
              profile ? <ResearchProgressPage /> : <LoginPage />
            )}

            {currentTab === "publications" && (
              profile ? <PublicationHistoryPage /> : <LoginPage />
            )}

            {currentTab === "profile" && (
              profile ? <LecturerProfilePage /> : <LoginPage />
            )}

            {currentTab === "admin_dashboard" && (
              profile && (profile.role === "admin" || profile.role === "owner") ? (
                <AdminDashboard />
              ) : (
                <LoginPage />
              )
            )}

            {currentTab === "admin_candidates" && (
              profile && (profile.role === "admin" || profile.role === "owner") ? (
                <AdminCandidatesPage />
              ) : (
                <LoginPage />
              )
            )}

            {currentTab === "admin_opportunities" && (
              profile && (profile.role === "admin" || profile.role === "owner") ? (
                <AdminOpportunitiesPage />
              ) : (
                <LoginPage />
              )
            )}

            {currentTab === "admin_lecturers" && (
              profile && (profile.role === "admin" || profile.role === "owner") ? (
                <AdminLecturersPage />
              ) : (
                <LoginPage />
              )
            )}

            {currentTab === "statistics" && (
              profile && (profile.role === "admin" || profile.role === "owner") ? (
                <StatisticsPage />
              ) : (
                <LoginPage />
              )
            )}

            {currentTab === "admin_import" && (
              profile && (profile.role === "admin" || profile.role === "owner") ? (
                <AdminImportPage />
              ) : (
                <LoginPage />
              )
            )}

            {currentTab === "owner" && (
              profile && profile.role === "owner" ? (
                <OwnerPage />
              ) : (
                <LoginPage />
              )
            )}
          </>
        )}
      </main>

      <Footer />
    </>
  );
};
