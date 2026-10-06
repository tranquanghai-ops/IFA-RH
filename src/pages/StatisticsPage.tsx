import React, { useState, useEffect } from "react";
import {
  fetchPublications,
  fetchResearchWorks,
  fetchAllUsers,
} from "../firebase/firestore";
import type { Publication, ResearchWork, UserProfile } from "../types";
import { exportToExcel, exportToCsv } from "../utils/excel";
import { formatDateVN } from "../utils/date";
import {
  BarChart3,
  Filter,
  FileSpreadsheet,
  Download,
  Calendar,
  Users,
  BookOpen,
  Layers,
} from "lucide-react";

export const StatisticsPage: React.FC = () => {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [researchWorks, setResearchWorks] = useState<ResearchWork[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedYear, setSelectedYear] = useState<string>("Tất cả");
  const [selectedLecturer, setSelectedLecturer] = useState<string>("Tất cả");
  const [selectedType, setSelectedType] = useState<string>("Tất cả");
  const [selectedStatus, setSelectedStatus] = useState<string>("Tất cả");

  const loadData = async () => {
    setLoading(true);
    try {
      const [pubs, works, u] = await Promise.all([
        fetchPublications(),
        fetchResearchWorks(),
        fetchAllUsers(),
      ]);
      setPublications(pubs);
      setResearchWorks(works);
      setUsers(u);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Distinct filter values
  const years = Array.from(
    new Set([
      ...publications.map((p) => p.year),
      ...researchWorks
        .map((w) => (w.deadline ? new Date(w.deadline).getFullYear() : 0))
        .filter((y) => y > 2000),
    ])
  )
    .filter(Boolean)
    .sort((a, b) => b - a);

  // Filter publications
  const filteredPubs = publications.filter((p) => {
    const matchYear = selectedYear === "Tất cả" || String(p.year) === selectedYear;
    const matchLecturer =
      selectedLecturer === "Tất cả" ||
      p.userName === selectedLecturer ||
      p.userEmail === selectedLecturer;
    const matchType = selectedType === "Tất cả" || p.type === selectedType;
    return matchYear && matchLecturer && matchType;
  });

  // Filter in-progress research works
  const filteredWorks = researchWorks.filter((w) => {
    const workYear = w.deadline ? new Date(w.deadline).getFullYear() : 0;
    const matchYear = selectedYear === "Tất cả" || String(workYear) === selectedYear;
    const matchLecturer =
      selectedLecturer === "Tất cả" ||
      w.userName === selectedLecturer ||
      w.userEmail === selectedLecturer;
    const matchType = selectedType === "Tất cả" || w.category === selectedType;
    const matchStatus = selectedStatus === "Tất cả" || w.status === selectedStatus;
    return matchYear && matchLecturer && matchType && matchStatus;
  });

  // Summary counts
  const totalPublications = filteredPubs.length;
  const totalActiveWorks = filteredWorks.length;

  // Chart data: Distribution by Publication Type
  const pubTypeMap: Record<string, number> = {};
  filteredPubs.forEach((p) => {
    pubTypeMap[p.type] = (pubTypeMap[p.type] || 0) + 1;
  });

  // Chart data: Distribution by Status
  const statusMap: Record<string, number> = {};
  filteredWorks.forEach((w) => {
    statusMap[w.status] = (statusMap[w.status] || 0) + 1;
  });

  const handleExportExcel = async () => {
    const pubCols = [
      { header: "Năm", key: "year", width: 10 },
      { header: "Tên công trình", key: "title", width: 40 },
      { header: "Loại hình", key: "type", width: 18 },
      { header: "Giảng viên", key: "userName", width: 22 },
      { header: "Email", key: "userEmail", width: 25 },
      { header: "Vai trò", key: "role", width: 16 },
      { header: "Tạp chí / Hội thảo", key: "journalOrConference", width: 30 },
      { header: "NXB / Tổ chức", key: "publisher", width: 25 },
      { header: "Chỉ mục (Indexing)", key: "indexing", width: 18 },
      { header: "DOI", key: "doi", width: 20 },
      { header: "Ngày cập nhật", key: "formattedDate", width: 15 },
    ];

    const dataToExport = filteredPubs.map((p) => ({
      ...p,
      formattedDate: formatDateVN(p.createdAt),
    }));

    await exportToExcel(
      `Thong-ke-NCKH-MTCN-${selectedYear}-${new Date().toLocaleDateString("vi-VN").replace(/\//g, "-")}`,
      "Thống kê NCKH",
      pubCols,
      dataToExport
    );
  };

  const handleExportCsv = () => {
    const pubCols = [
      { header: "Năm", key: "year" },
      { header: "Tên công trình", key: "title" },
      { header: "Loại hình", key: "type" },
      { header: "Giảng viên", key: "userName" },
      { header: "Email", key: "userEmail" },
      { header: "Vai trò", key: "role" },
      { header: "Tạp chí / Hội thảo", key: "journalOrConference" },
      { header: "Indexing", key: "indexing" },
      { header: "DOI", key: "doi" },
    ];
    exportToCsv(
      `Thong-ke-NCKH-MTCN-${selectedYear}`,
      pubCols,
      filteredPubs
    );
  };

  return (
    <div className="app-container">
      {/* Page Title */}
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
          <h1 style={{ fontSize: "1.6rem", color: "var(--primary)" }}>Thống kê Nghiên cứu Khoa học theo Năm</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: 4 }}>
            Báo cáo tổng hợp số liệu công bố học thuật, đề tài và tiến độ nghiên cứu của toàn bộ giảng viên Khoa MTCN
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportExcel}
            disabled={totalPublications === 0}
          >
            <FileSpreadsheet size={16} /> Xuất Báo cáo Excel
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportCsv}
            disabled={totalPublications === 0}
          >
            <Download size={16} /> Xuất CSV
          </button>
        </div>
      </div>

      {/* Comprehensive Filter Bar */}
      <div className="card" style={{ marginBottom: 24, padding: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: "0.8125rem" }}>
              Năm báo cáo:
            </label>
            <select
              className="form-control"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="Tất cả">Tất cả các năm</option>
              {years.map((y) => (
                <option key={y} value={String(y)}>Năm {y}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: "0.8125rem" }}>
              Giảng viên:
            </label>
            <select
              className="form-control"
              value={selectedLecturer}
              onChange={(e) => setSelectedLecturer(e.target.value)}
            >
              <option value="Tất cả">Tất cả giảng viên</option>
              {users.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name} ({u.department || u.email})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: "0.8125rem" }}>
              Loại công trình:
            </label>
            <select
              className="form-control"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="Tất cả">Tất cả loại hình</option>
              <option value="Bài báo">Bài báo</option>
              <option value="Hội thảo">Hội thảo</option>
              <option value="Đề tài NCKH">Đề tài NCKH</option>
              <option value="Sách">Sách</option>
              <option value="Chương sách">Chương sách</option>
              <option value="Sản phẩm sáng tạo / nghệ thuật">Sản phẩm nghệ thuật</option>
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: "0.8125rem" }}>
              Trạng thái (Tiến độ):
            </label>
            <select
              className="form-control"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="Tất cả">Tất cả trạng thái</option>
              <option value="Đang viết">Đang viết</option>
              <option value="Đã gửi">Đã gửi</option>
              <option value="Chờ phản biện">Chờ phản biện</option>
              <option value="Được chấp nhận">Được chấp nhận</option>
              <option value="Đã xuất bản">Đã xuất bản</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#dcfce7", color: "#15803d" }}>
            <BookOpen size={22} />
          </div>
          <div>
            <div className="stat-val">{totalPublications}</div>
            <div className="stat-label">Công trình đã xuất bản / hoàn thành</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#e0f2fe", color: "#0369a1" }}>
            <Layers size={22} />
          </div>
          <div>
            <div className="stat-val">{totalActiveWorks}</div>
            <div className="stat-label">Đề tài / Bài viết đang trong tiến độ</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#f3e8ff", color: "#7e22ce" }}>
            <Users size={22} />
          </div>
          <div>
            <div className="stat-val">{users.length}</div>
            <div className="stat-label">Nhân sự tham gia NCKH</div>
          </div>
        </div>
      </div>

      {/* Visual Distribution Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24, marginBottom: 32 }}>
        <div className="card">
          <h3 style={{ fontSize: "1.1rem", color: "var(--primary)", marginBottom: 14 }}>
            Cơ cấu công trình đã hoàn thành ({selectedYear})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.keys(pubTypeMap).length === 0 ? (
              <div style={{ color: "var(--muted)", padding: 20, textAlign: "center" }}>Không có dữ liệu phù hợp</div>
            ) : (
              Object.entries(pubTypeMap).map(([type, count]) => {
                const pct = ((count / (totalPublications || 1)) * 100).toFixed(0);
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

        <div className="card">
          <h3 style={{ fontSize: "1.1rem", color: "var(--primary)", marginBottom: 14 }}>
            Trạng thái các công trình đang thực hiện ({selectedYear})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.keys(statusMap).length === 0 ? (
              <div style={{ color: "var(--muted)", padding: 20, textAlign: "center" }}>Không có dữ liệu phù hợp</div>
            ) : (
              Object.entries(statusMap).map(([st, count]) => {
                const pct = ((count / (totalActiveWorks || 1)) * 100).toFixed(0);
                return (
                  <div key={st}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", marginBottom: 4 }}>
                      <span>{st}</span>
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
      </div>

      {/* Detailed Publications Table (dd/mm/yyyy formatted) */}
      <div className="card">
        <h3 style={{ fontSize: "1.15rem", color: "var(--primary)", marginBottom: 16 }}>
          Bảng chi tiết Công trình Nghiên cứu Khoa học ({filteredPubs.length} bản ghi)
        </h3>

        {filteredPubs.length === 0 ? (
          <div style={{ color: "var(--muted)", textAlign: "center", padding: 32 }}>
            Không tìm thấy bản ghi nào phù hợp bộ lọc.
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Năm</th>
                  <th>Tên công trình</th>
                  <th>Loại hình</th>
                  <th>Giảng viên</th>
                  <th>Vai trò</th>
                  <th>Tạp chí / Hội thảo / NXB</th>
                  <th>Chỉ mục</th>
                  <th>Ngày cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {filteredPubs.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 800, color: "var(--primary)" }}>{p.year}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{p.title}</div>
                      {p.coAuthors && (
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          Đồng tác giả: {p.coAuthors}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontWeight: 600 }}>{p.type}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.userName}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{p.userEmail}</div>
                    </td>
                    <td>{p.role}</td>
                    <td>{p.journalOrConference || p.publisher || "—"}</td>
                    <td>
                      {p.indexing ? (
                        <span className="badge" style={{ background: "#e0f2fe", color: "#0369a1", fontWeight: 600 }}>
                          {p.indexing}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: "0.8125rem" }}>
                      {formatDateVN(p.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
