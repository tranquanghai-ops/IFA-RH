import React, { useState, useEffect } from "react";
import {
  fetchAllUsers,
  fetchResearchWorks,
  fetchPublications,
} from "../firebase/firestore";
import type { UserProfile, ResearchWork, Publication } from "../types";
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
} from "lucide-react";

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [works, setWorks] = useState<ResearchWork[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>("Tất cả");

  const loadData = async () => {
    setLoading(true);
    try {
      const [u, w, p] = await Promise.all([
        fetchAllUsers(),
        fetchResearchWorks(),
        fetchPublications(),
      ]);
      setUsers(u);
      setWorks(w);
      setPublications(p);
    } catch (err: any) {
      console.error(err);
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

  // KPIs
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

  return (
    <div className="app-container">
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.6rem", color: "var(--primary)" }}>Tổng quan NCKH Toàn Khoa</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: 4 }}>
            Thống kê chỉ số nghiên cứu, tiến độ bài báo và kết quả công bố của giảng viên Khoa MTCN
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Filter size={18} color="var(--primary)" />
          <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Lọc năm:</span>
          <select
            className="form-control"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            style={{ width: "auto" }}
          >
            <option value="Tất cả">Tất cả các năm</option>
            {availableYears.map((yr) => (
              <option key={yr} value={String(yr)}>Năm {yr}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#e0f2fe", color: "#0369a1" }}>
            <Users size={22} />
          </div>
          <div>
            <div className="stat-val">{totalLecturers}</div>
            <div className="stat-label">Tổng Giảng viên</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#fef3c7", color: "#b45309" }}>
            <Layers size={22} />
          </div>
          <div>
            <div className="stat-val">{inProgressCount}</div>
            <div className="stat-label">Đang thực hiện</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#f1f5f9", color: "#475569" }}>
            <Layers size={22} />
          </div>
          <div>
            <div className="stat-val">{writingCount}</div>
            <div className="stat-label">Đang viết</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#e0e7ff", color: "#4338ca" }}>
            <Clock size={22} />
          </div>
          <div>
            <div className="stat-val">{submittedCount}</div>
            <div className="stat-label">Đã gửi tạp chí</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#ffedd5", color: "#c2410c" }}>
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
            <div className="stat-label">Được chấp nhận</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#f3e8ff", color: "#7e22ce" }}>
            <BookOpen size={22} />
          </div>
          <div>
            <div className="stat-val">{publishedCount}</div>
            <div className="stat-label">Đã công bố ({selectedYear})</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#ecfdf5", color: "#047857" }}>
            <Calendar size={22} />
          </div>
          <div>
            <div className="stat-val">{completedThisYearCount}</div>
            <div className="stat-label">Nghiệm thu {currentYear}</div>
          </div>
        </div>
      </div>

      {/* Warning on Stale Lecturers */}
      {staleLecturers.length > 0 && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            padding: 16,
            borderRadius: 8,
            marginBottom: 24,
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <AlertTriangle size={20} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong style={{ color: "#92400e" }}>Giảng viên chưa cập nhật tiến độ NCKH trên 60 ngày:</strong>
            <div style={{ color: "#78350f", fontSize: "0.875rem", marginTop: 4 }}>
              {staleLecturers.join(", ")}
            </div>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24 }}>
        {/* By Type */}
        <div className="card">
          <h3 style={{ fontSize: "1.1rem", color: "var(--primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <BarChart3 size={18} /> Phân bố theo loại công trình ({selectedYear})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Object.keys(typeMap).length === 0 ? (
              <div style={{ color: "var(--muted)", textAlign: "center", padding: 24 }}>Không có dữ liệu</div>
            ) : (
              Object.entries(typeMap).map(([type, count]) => {
                const pct = ((count / publishedCount) * 100).toFixed(0);
                return (
                  <div key={type}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", marginBottom: 4 }}>
                      <span>{type}</span>
                      <strong>{count} ({pct}%)</strong>
                    </div>
                    <div style={{ height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, background: "var(--secondary)", height: "100%" }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* By Status */}
        <div className="card">
          <h3 style={{ fontSize: "1.1rem", color: "var(--primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Layers size={18} /> Phân bố theo trạng thái đề tài đang thực hiện
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Object.keys(statusMap).length === 0 ? (
              <div style={{ color: "var(--muted)", textAlign: "center", padding: 24 }}>Không có dữ liệu</div>
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
                    <div style={{ height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, background: "#0284c7", height: "100%" }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Lecturers */}
        <div className="card" style={{ gridColumn: "span 2" }}>
          <h3 style={{ fontSize: "1.1rem", color: "var(--primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={18} /> Giảng viên có nhiều công trình công bố ({selectedYear})
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            {topLecturers.length === 0 ? (
              <div style={{ color: "var(--muted)", padding: 20 }}>Không có dữ liệu</div>
            ) : (
              topLecturers.map(([name, count]) => (
                <div key={name} style={{ background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{name}</span>
                  <span className="badge" style={{ background: "#e0f2fe", color: "#0369a1", fontWeight: 700 }}>
                    {count} công trình
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
