import React, { useState, useEffect } from "react";
import {
  fetchAllUsers,
  fetchResearchWorks,
  fetchPublications,
  fetchAllOpportunities,
  fetchOpportunityCandidates,
} from "../firebase/firestore";
import type {
  UserProfile,
  ResearchWork,
  Publication,
  Opportunity,
  OpportunityCandidate,
} from "../types";
import {
  Users,
  Layers,
  Clock,
  CheckCircle2,
  BookOpen,
  Filter,
  BarChart3,
  Calendar,
  AlertTriangle,
  Sparkles,
  Send,
  FileEdit,
  Award,
  TrendingUp,
  Compass,
} from "lucide-react";
import { formatDateVN } from "../utils/date";

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [works, setWorks] = useState<ResearchWork[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [candidates, setCandidates] = useState<OpportunityCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>("Tất cả");

  const loadData = async () => {
    setLoading(true);
    try {
      const [u, w, p, opps, cands] = await Promise.all([
        fetchAllUsers(),
        fetchResearchWorks(),
        fetchPublications(),
        fetchAllOpportunities(),
        fetchOpportunityCandidates(),
      ]);
      setUsers(u);
      setWorks(w);
      setPublications(p);
      setOpportunities(opps);
      setCandidates(cands);
    } catch (err: any) {
      console.error("Lỗi khi tải dữ liệu tổng quan:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const currentYear = new Date().getFullYear();

  // Distinct publication years
  const availableYears = Array.from(new Set(publications.map((p) => p.year)))
    .filter(Boolean)
    .sort((a, b) => b - a);

  // Filtered publications
  const filteredPubs = publications.filter((p) =>
    selectedYear === "Tất cả" ? true : String(p.year) === selectedYear
  );

  // ======================== B. KPIS (8 METRICS) ========================
  const totalLecturers = users.filter((u) => u.active !== false).length;
  const inProgressCount = works.filter((w) => !w.isCompleted).length;
  const writingCount = works.filter((w) => w.status === "Đang viết").length;
  const submittedCount = works.filter((w) => w.status === "Đã gửi").length;
  const underReviewCount = works.filter((w) => w.status === "Chờ phản biện" || w.status === "Sửa theo phản biện").length;
  const acceptedCount = works.filter((w) => w.status === "Được chấp nhận").length;
  const publishedCount = filteredPubs.length;
  const completedThisYearCount = publications.filter((p) => p.year === currentYear).length;

  // Stale check: works not updated in > 60 days
  const now = new Date().getTime();
  const staleLecturers = Array.from(
    new Set(
      works
        .filter((w) => !w.isCompleted && w.updatedAt)
        .filter((w) => {
          const updatedTime = new Date(w.updatedAt).getTime();
          return now - updatedTime > 60 * 24 * 60 * 60 * 1000;
        })
        .map((w) => w.userName || w.userEmail)
    )
  );

  // Distribution by Type
  const typeMap: Record<string, number> = {};
  filteredPubs.forEach((p) => {
    typeMap[p.type] = (typeMap[p.type] || 0) + 1;
  });

  // Distribution by Status in Active Works
  const statusMap: Record<string, number> = {};
  works.forEach((w) => {
    statusMap[w.status] = (statusMap[w.status] || 0) + 1;
  });

  // Distribution by Lecturer (Top 6)
  const lecturerMap: Record<string, number> = {};
  filteredPubs.forEach((p) => {
    const key = p.userName || p.userEmail;
    lecturerMap[key] = (lecturerMap[key] || 0) + 1;
  });
  const topLecturers = Object.entries(lecturerMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Publications by Year (All Years)
  const pubsByYearMap: Record<number, number> = {};
  publications.forEach((p) => {
    if (p.year) {
      pubsByYearMap[p.year] = (pubsByYearMap[p.year] || 0) + 1;
    }
  });
  const sortedYears = Object.keys(pubsByYearMap)
    .map(Number)
    .sort((a, b) => b - a)
    .slice(0, 5);
  const maxYearPubs = Math.max(...Object.values(pubsByYearMap), 1);

  // D. Widgets Data
  const pendingSparkCount = candidates.filter((c) => c.status === "pending").length;
  
  // Opportunities with nearest deadline
  const todayStr = new Date().toISOString().split("T")[0];
  const upcomingDeadlines = opportunities
    .filter((o) => o.deadline && o.deadline >= todayStr)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 4);

  // Recent opportunities
  const recentOpportunities = opportunities
    .filter((o) => o.status === "published")
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 4);

  if (loading) {
    return (
      <div className="app-container" style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
        <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>Đang tải dữ liệu Tổng quan NCKH...</div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* A. PAGE HEADER (SCImago Academic Standard) */}
      <div className="page-header-block">
        <div className="page-header-text">
          <h1>Tổng quan NCKH Toàn Khoa</h1>
          <p>
            Thống kê chỉ số nghiên cứu, tiến độ bài báo và kết quả công bố của giảng viên Khoa MTCN
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Filter size={17} color="var(--primary)" />
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-main)" }}>
            Lọc năm:
          </span>
          <select
            className="form-control"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            style={{ width: "auto", minWidth: 150 }}
          >
            <option value="Tất cả">Tất cả các năm</option>
            {availableYears.map((yr) => (
              <option key={yr} value={String(yr)}>
                Năm {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* B. KPI GRID (8 Metrics - Strict 4-Col Desktop / 2-Col Tablet / 1-Col Mobile) */}
      <div className="stats-grid">
        {/* KPI 1: Tổng giảng viên */}
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#e0f2fe", color: "#0369a1" }}>
            <Users size={22} />
          </div>
          <div>
            <div className="stat-val">{totalLecturers}</div>
            <div className="stat-label">Tổng Giảng viên</div>
          </div>
        </div>

        {/* KPI 2: Đang thực hiện */}
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#fef3c7", color: "#b45309" }}>
            <Layers size={22} />
          </div>
          <div>
            <div className="stat-val">{inProgressCount}</div>
            <div className="stat-label">Đang thực hiện</div>
          </div>
        </div>

        {/* KPI 3: Đang viết */}
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#f1f5f9", color: "#475569" }}>
            <FileEdit size={22} />
          </div>
          <div>
            <div className="stat-val">{writingCount}</div>
            <div className="stat-label">Đang viết</div>
          </div>
        </div>

        {/* KPI 4: Đã gửi tạp chí */}
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#e0e7ff", color: "#4338ca" }}>
            <Send size={22} />
          </div>
          <div>
            <div className="stat-val">{submittedCount}</div>
            <div className="stat-label">Đã gửi tạp chí</div>
          </div>
        </div>

        {/* KPI 5: Chờ phản biện */}
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#ffedd5", color: "#c2410c" }}>
            <Clock size={22} />
          </div>
          <div>
            <div className="stat-val">{underReviewCount}</div>
            <div className="stat-label">Chờ phản biện</div>
          </div>
        </div>

        {/* KPI 6: Được chấp nhận */}
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#dcfce7", color: "#15803d" }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="stat-val">{acceptedCount}</div>
            <div className="stat-label">Được chấp nhận</div>
          </div>
        </div>

        {/* KPI 7: Đã xuất bản */}
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#f3e8ff", color: "#7e22ce" }}>
            <BookOpen size={22} />
          </div>
          <div>
            <div className="stat-val">{publishedCount}</div>
            <div className="stat-label">Đã xuất bản ({selectedYear})</div>
          </div>
        </div>

        {/* KPI 8: Nghiệm thu năm nay */}
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#ecfdf5", color: "#047857" }}>
            <Award size={22} />
          </div>
          <div>
            <div className="stat-val">{completedThisYearCount}</div>
            <div className="stat-label">Nghiệm thu {currentYear}</div>
          </div>
        </div>
      </div>

      {/* C. CHARTS & DATA BLOCKS (2x2 Grid) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 480px), 1fr))", gap: 20, marginBottom: 24 }}>
        {/* Block 1: Công trình theo năm */}
        <div className="card">
          <h3 style={{ fontSize: "1.05rem", color: "var(--primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <TrendingUp size={18} color="var(--teal)" /> Công trình công bố theo năm
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sortedYears.length === 0 ? (
              <div style={{ color: "var(--muted)", textAlign: "center", padding: 24, fontSize: "0.875rem" }}>
                Chưa có dữ liệu công bố theo năm
              </div>
            ) : (
              sortedYears.map((yr) => {
                const count = pubsByYearMap[yr] || 0;
                const pct = Math.round((count / maxYearPubs) * 100);
                return (
                  <div key={yr}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>Năm {yr}</span>
                      <strong style={{ color: "var(--primary)" }}>{count} công trình</strong>
                    </div>
                    <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden", border: "1px solid var(--line)" }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          background: yr === currentYear ? "var(--teal)" : "var(--primary)",
                          height: "100%",
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Block 2: Phân bố theo trạng thái đề tài */}
        <div className="card">
          <h3 style={{ fontSize: "1.05rem", color: "var(--primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Layers size={18} color="var(--primary)" /> Phân bố theo trạng thái đề tài đang thực hiện
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Object.keys(statusMap).length === 0 ? (
              <div style={{ color: "var(--muted)", textAlign: "center", padding: 24, fontSize: "0.875rem" }}>
                Không có đề tài đang thực hiện
              </div>
            ) : (
              Object.entries(statusMap).map(([status, count]) => {
                const totalActive = works.length || 1;
                const pct = ((count / totalActive) * 100).toFixed(0);
                return (
                  <div key={status}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", marginBottom: 4 }}>
                      <span>{status}</span>
                      <strong>{count} ({pct}%)</strong>
                    </div>
                    <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden", border: "1px solid var(--line)" }}>
                      <div style={{ width: `${pct}%`, background: "#0284c7", height: "100%" }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Block 3: Phân bố theo loại hình công trình */}
        <div className="card">
          <h3 style={{ fontSize: "1.05rem", color: "var(--primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <BarChart3 size={18} color="var(--secondary)" /> Phân bố theo loại công trình ({selectedYear})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Object.keys(typeMap).length === 0 ? (
              <div style={{ color: "var(--muted)", textAlign: "center", padding: 24, fontSize: "0.875rem" }}>
                Không có dữ liệu trong khoảng thời gian đã chọn
              </div>
            ) : (
              Object.entries(typeMap).map(([type, count]) => {
                const total = publishedCount || 1;
                const pct = ((count / total) * 100).toFixed(0);
                return (
                  <div key={type}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", marginBottom: 4 }}>
                      <span>{type}</span>
                      <strong>{count} ({pct}%)</strong>
                    </div>
                    <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden", border: "1px solid var(--line)" }}>
                      <div style={{ width: `${pct}%`, background: "#6366f1", height: "100%" }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Block 4: Giảng viên công bố hàng đầu */}
        <div className="card">
          <h3 style={{ fontSize: "1.05rem", color: "var(--primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={18} color="var(--teal)" /> Giảng viên công bố hàng đầu ({selectedYear})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topLecturers.length === 0 ? (
              <div style={{ color: "var(--muted)", padding: 24, textAlign: "center", fontSize: "0.875rem" }}>
                Chưa có dữ liệu công bố
              </div>
            ) : (
              topLecturers.map(([name, count], idx) => (
                <div
                  key={name}
                  style={{
                    background: "#f8fafc",
                    padding: "10px 14px",
                    borderRadius: 6,
                    border: "1px solid var(--line)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: idx === 0 ? "var(--teal)" : idx === 1 ? "var(--secondary)" : "#cbd5e1",
                        color: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                      }}
                    >
                      {idx + 1}
                    </span>
                    <span style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "0.875rem" }}>{name}</span>
                  </div>
                  <span className="badge" style={{ background: "#e0f2fe", color: "#0369a1", fontWeight: 700, fontSize: "0.78rem" }}>
                    {count} công trình
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* D. DATA WIDGETS (4-Column Grid) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 16, marginBottom: 24 }}>
        {/* Widget 1: Cảnh báo Giảng viên chưa cập nhật */}
        <div
          className="card"
          style={{
            borderColor: staleLecturers.length > 0 ? "#fde68a" : "var(--line)",
            background: staleLecturers.length > 0 ? "#fffdf5" : "#ffffff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <AlertTriangle size={18} color={staleLecturers.length > 0 ? "#b45309" : "var(--muted)"} />
            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: staleLecturers.length > 0 ? "#92400e" : "var(--primary)" }}>
              Tiến độ quá hạn cập nhật
            </span>
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: staleLecturers.length > 0 ? "#b45309" : "var(--muted)", marginBottom: 4 }}>
            {staleLecturers.length} GV
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: 0 }}>
            {staleLecturers.length > 0
              ? `Chưa ghi nhận cập nhật tiến độ NCKH trên 60 ngày`
              : "Tất cả đề tài đang được theo dõi định kỳ tốt"}
          </p>
        </div>

        {/* Widget 2: Hàng chờ Spark pending */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Sparkles size={18} color="#9333ea" />
            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--primary)" }}>
              Hàng chờ Spark AI
            </span>
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#9333ea", marginBottom: 4 }}>
            {pendingSparkCount} cơ hội
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: 0 }}>
            {pendingSparkCount > 0
              ? "Cần duyệt sơ bộ trước khi công bố giảng viên"
              : "Không có đề xuất Spark nào đang chờ duyệt"}
          </p>
        </div>

        {/* Widget 3: Hạn nộp gần nhất */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Clock size={18} color="var(--primary)" />
            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--primary)" }}>
              Hạn nộp NCKH sắp tới
            </span>
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--primary)", marginBottom: 4 }}>
            {upcomingDeadlines.length} hội thảo / san
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: 0 }}>
            {upcomingDeadlines.length > 0
              ? `Hạn gần nhất: ${formatDateVN(upcomingDeadlines[0].deadline)}`
              : "Chưa có hạn nộp sắp tới trong danh mục"}
          </p>
        </div>

        {/* Widget 4: Cơ hội NCKH tổng thể */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Compass size={18} color="var(--teal)" />
            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--primary)" }}>
              Cơ hội đang công bố
            </span>
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--teal)", marginBottom: 4 }}>
            {recentOpportunities.length} cơ hội
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: 0 }}>
            Sẵn sàng để giảng viên đăng ký bài báo và đề tài
          </p>
        </div>
      </div>
    </div>
  );
};
