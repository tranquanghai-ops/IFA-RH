import React, { useState, useEffect } from "react";
import { useAuth } from "../firebase/auth";
import {
  fetchResearchWorks,
  fetchPublications,
  fetchPublishedOpportunities,
  createResearchWork,
  updateResearchWork,
} from "../firebase/firestore";
import type { ResearchWork, Publication, Opportunity } from "../types";
import { ResearchWorkModal } from "../components/ResearchWorkModal";
import { ProgressHistoryModal } from "../components/ProgressHistoryModal";
import { ConvertToPublicationModal } from "../components/ConvertToPublicationModal";
import { formatDateVN, getDeadlineBadge } from "../utils/date";
import {
  Layers,
  Clock,
  CheckCircle2,
  BookOpen,
  Calendar,
  Sparkles,
  Plus,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

interface LecturerDashboardProps {
  onNavigate: (tab: string) => void;
}

export const LecturerDashboard: React.FC<LecturerDashboardProps> = ({ onNavigate }) => {
  const { profile } = useAuth();
  const [researchWorks, setResearchWorks] = useState<ResearchWork[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingWork, setEditingWork] = useState<ResearchWork | null>(null);
  const [historyWork, setHistoryWork] = useState<ResearchWork | null>(null);
  const [convertingWork, setConvertingWork] = useState<ResearchWork | null>(null);

  const loadDashboardData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [works, pubs, opps] = await Promise.all([
        fetchResearchWorks(profile.uid),
        fetchPublications(profile.uid),
        fetchPublishedOpportunities(),
      ]);
      setResearchWorks(works);
      setPublications(pubs);
      setOpportunities(opps);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [profile]);

  if (!profile) return null;

  // KPIs
  const inProgressCount = researchWorks.filter((w) => !w.isCompleted).length;
  const underReviewCount = researchWorks.filter(
    (w) => w.status === "Chờ phản biện" || w.status === "Sửa theo phản biện"
  ).length;
  const acceptedCount = researchWorks.filter((w) => w.status === "Được chấp nhận").length;

  const currentYear = new Date().getFullYear();
  const publishedThisYearCount = publications.filter((p) => p.year === currentYear).length;

  // Closest deadline
  const upcomingDeadlines = researchWorks
    .filter((w) => !w.isCompleted && w.deadline)
    .sort((a, b) => (a.deadline || "").localeCompare(b.deadline || ""));
  const closestDeadlineWork = upcomingDeadlines[0];

  // Chart data: Distribution by type over recent years
  const pastThreeYears = [currentYear - 2, currentYear - 1, currentYear];
  const chartData = pastThreeYears.map((yr) => {
    const yearPubs = publications.filter((p) => p.year === yr);
    return {
      year: yr,
      journal: yearPubs.filter((p) => p.type === "Bài báo").length,
      conference: yearPubs.filter((p) => p.type === "Hội thảo").length,
      project: yearPubs.filter((p) => p.type === "Đề tài NCKH").length,
      other: yearPubs.filter((p) => !["Bài báo", "Hội thảo", "Đề tài NCKH"].includes(p.type)).length,
      total: yearPubs.length,
    };
  });

  return (
    <div className="app-container">
      {/* Welcome Banner */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: "24px 28px",
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.6rem", color: "var(--primary)" }}>
            Xin chào, {profile.name}!
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.9375rem", marginTop: 4 }}>
            {profile.department || "Khoa Mỹ thuật Công nghiệp"} · {profile.academicDegree || "Giảng viên"}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus size={16} />
            Tạo công trình mới
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#e0f2fe", color: "#0369a1" }}>
            <Layers size={22} />
          </div>
          <div>
            <div className="stat-val">{inProgressCount}</div>
            <div className="stat-label">Đang thực hiện</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#fef3c7", color: "#b45309" }}>
            <Clock size={22} />
          </div>
          <div>
            <div className="stat-val">{underReviewCount}</div>
            <div className="stat-label">Chờ phản biện</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#dcfce7", color: "#15803d" }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="stat-val">{acceptedCount}</div>
            <div className="stat-label">Đã Accepted</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#f3e8ff", color: "#7e22ce" }}>
            <BookOpen size={22} />
          </div>
          <div>
            <div className="stat-val">{publishedThisYearCount}</div>
            <div className="stat-label">Đã xuất bản {currentYear}</div>
          </div>
        </div>

        <div className="stat-card" style={{ gridColumn: "span 2" }}>
          <div className="stat-icon" style={{ background: "#fee2e2", color: "#b91c1c" }}>
            <Calendar size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700 }}>DEADLINE GẦN NHẤT:</div>
            {closestDeadlineWork ? (
              <div>
                <div style={{ fontWeight: 700, color: "var(--danger)", fontSize: "0.95rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {formatDateVN(closestDeadlineWork.deadline)} — {closestDeadlineWork.title}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Trạng thái: {closestDeadlineWork.status}
                </div>
              </div>
            ) : (
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Không có deadline sắp tới</div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Active Works & Annual Chart */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 24, marginBottom: 32 }}>
        {/* Recent In-Progress Works */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: "1.1rem", color: "var(--primary)" }}>Công trình đang thực hiện</h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate("research_progress")}
            >
              Xem tất cả ({researchWorks.length})
              <ArrowRight size={14} />
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>Đang tải...</div>
          ) : researchWorks.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
              Chưa có công trình nào. Nhấn <strong>"Tạo công trình mới"</strong> để bắt đầu ghi nhận tiến độ NCKH.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {researchWorks.slice(0, 4).map((work) => (
                <div
                  key={work.id}
                  style={{
                    padding: 12,
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    background: "#f8fafc",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--primary)", flex: 1 }}>
                      {work.title}
                    </div>
                    <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
                      {work.status}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 12, fontSize: "0.8125rem", color: "var(--muted)", marginTop: 6, flexWrap: "wrap" }}>
                    <span>Loại: <strong>{work.category}</strong></span>
                    {work.deadline && (
                      <span>Hạn: <strong style={{ color: "var(--danger)" }}>{formatDateVN(work.deadline)}</strong></span>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setHistoryWork(work)}
                    >
                      Lịch sử tiến độ
                    </button>
                    {(work.status === "Đã xuất bản" || work.status === "Nghiệm thu / Hoàn tất") && !work.isCompleted && (
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={() => setConvertingWork(work)}
                      >
                        Chuyển vào Hồ sơ
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Annual Chart: Số lượng công trình theo năm */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: "1.1rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: 6 }}>
              <TrendingUp size={18} />
              Thống kê NCKH cá nhân theo năm
            </h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate("publications")}
            >
              Xem Hồ sơ ({publications.length})
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {chartData.map((item) => (
              <div key={item.year} style={{ background: "#f8fafc", padding: 14, borderRadius: 8, border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontWeight: 800, color: "var(--primary)", fontSize: "1.05rem" }}>Năm {item.year}</span>
                  <span className="badge badge-neutral" style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                    Tổng cộng: {item.total} công trình
                  </span>
                </div>

                {/* Progress bar visual */}
                <div style={{ height: 10, borderRadius: 5, background: "#e2e8f0", display: "flex", overflow: "hidden", marginBottom: 10 }}>
                  {item.total > 0 ? (
                    <>
                      <div style={{ width: `${(item.journal / item.total) * 100}%`, background: "#0284c7" }} title={`Bài báo: ${item.journal}`} />
                      <div style={{ width: `${(item.conference / item.total) * 100}%`, background: "#10b981" }} title={`Hội thảo: ${item.conference}`} />
                      <div style={{ width: `${(item.project / item.total) * 100}%`, background: "#f59e0b" }} title={`Đề tài: ${item.project}`} />
                      <div style={{ width: `${(item.other / item.total) * 100}%`, background: "#8b5cf6" }} title={`Khác: ${item.other}`} />
                    </>
                  ) : (
                    <div style={{ width: "100%", background: "#cbd5e1" }} />
                  )}
                </div>

                {/* Legend items */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: "0.8125rem" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0284c7" }} />
                    Bài báo: <strong>{item.journal}</strong>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                    Hội thảo: <strong>{item.conference}</strong>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
                    Đề tài: <strong>{item.project}</strong>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#8b5cf6" }} />
                    Khác: <strong>{item.other}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recommended Opportunities for Lecturer */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: "1.1rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={18} color="#7e22ce" />
            Cơ hội NCKH mới & phù hợp giảng viên
          </h3>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate("public")}
          >
            Khám phá thêm
            <ArrowRight size={14} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {opportunities.slice(0, 3).map((opp) => {
            const badge = getDeadlineBadge(opp.deadline, opp.createdAt);
            return (
              <div
                key={opp.id}
                style={{
                  padding: 14,
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  background: "#ffffff",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="badge badge-neutral">{opp.type}</span>
                  <span className={`badge badge-${badge.variant}`}>{badge.text}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--primary)", marginTop: 4 }}>
                  {opp.title}
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                  {opp.organizer}
                </div>
                <div style={{ marginTop: "auto", paddingTop: 8, fontSize: "0.8125rem" }}>
                  Hạn: <strong style={{ color: "var(--danger)" }}>{formatDateVN(opp.deadline)}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      <ResearchWorkModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={async (data, note) => {
          await createResearchWork(
            data as any,
            { uid: profile.uid, email: profile.email, role: profile.role }
          );
          await loadDashboardData();
        }}
        userId={profile.uid}
        userEmail={profile.email}
        userName={profile.name}
      />

      <ProgressHistoryModal
        research={historyWork}
        onClose={() => setHistoryWork(null)}
        onStatusUpdated={loadDashboardData}
      />

      <ConvertToPublicationModal
        research={convertingWork}
        onClose={() => setConvertingWork(null)}
        onSuccess={async () => {
          await loadDashboardData();
        }}
      />
    </div>
  );
};
