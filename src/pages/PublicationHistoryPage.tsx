import React, { useState, useEffect } from "react";
import { useAuth } from "../firebase/auth";
import {
  fetchPublications,
  createPublication,
  updatePublication,
  deletePublication,
  fetchActiveLecturers,
} from "../firebase/firestore";
import type { Publication, UserProfile } from "../types";
import { PublicationModal } from "../components/PublicationModal";
import { exportToExcel, exportToCsv } from "../utils/excel";
import {
  Plus,
  Search,
  Filter,
  Download,
  FileSpreadsheet,
  Edit2,
  Trash2,
  BookOpen,
  ExternalLink,
  Users,
} from "lucide-react";

export const PublicationHistoryPage: React.FC = () => {
  const { profile } = useAuth();
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("Tất cả");
  const [selectedYear, setSelectedYear] = useState<string>("Tất cả");

  // Staff and Scope Filter
  const isStaff = profile?.role === "admin" || profile?.role === "owner";
  const [activeLecturers, setActiveLecturers] = useState<UserProfile[]>([]);
  const [selectedLecturerId, setSelectedLecturerId] = useState<string>("all");
  const [viewScope, setViewScope] = useState<"personal" | "faculty">("personal");

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingPub, setEditingPub] = useState<Publication | null>(null);

  const loadLecturers = async () => {
    if (isStaff) {
      try {
        const list = await fetchActiveLecturers();
        setActiveLecturers(list);
      } catch (err) {
        console.error("Error loading lecturers:", err);
      }
    }
  };

  const loadPublications = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      if (isStaff) {
        const targetIdentifier = selectedLecturerId === "all" ? undefined : selectedLecturerId;
        const data = await fetchPublications(targetIdentifier, isStaff);
        setPublications(data);
      } else {
        const targetUid = viewScope === "personal" ? profile.uid : undefined;
        const data = await fetchPublications(targetUid, false);
        setPublications(data);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLecturers();
  }, [profile]);

  useEffect(() => {
    loadPublications();
  }, [profile, selectedLecturerId, viewScope]);

  if (!profile) return null;

  // Distinct years for filter
  const years = Array.from(new Set(publications.map((p) => p.year)))
    .filter(Boolean)
    .sort((a, b) => b - a);

  const filteredPublications = publications.filter((p) => {
    const matchQuery =
      searchQuery.trim() === "" ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.userName && p.userName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.journalOrConference && p.journalOrConference.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.publisher && p.publisher.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchType = selectedType === "Tất cả" || p.type === selectedType;
    const matchYear = selectedYear === "Tất cả" || String(p.year) === selectedYear;

    return matchQuery && matchType && matchYear;
  });

  const showFacultyMeta = isStaff || viewScope === "faculty";

  const handleExportExcel = async () => {
    const columns: Array<{ header: string; key: string; width: number }> = [
      { header: "Năm", key: "year", width: 10 },
      { header: "Tên công trình", key: "title", width: 40 },
      { header: "Loại hình", key: "type", width: 18 },
    ];

    if (showFacultyMeta) {
      columns.push(
        { header: "Giảng viên", key: "userName", width: 22 },
        { header: "Email", key: "userEmail", width: 25 }
      );
    }

    columns.push(
      { header: "Vai trò", key: "role", width: 16 },
      { header: "Tác giả / Đồng tác giả", key: "coAuthors", width: 25 },
      { header: "Tạp chí / Hội thảo", key: "journalOrConference", width: 30 },
      { header: "NXB / Tổ chức", key: "publisher", width: 25 },
      { header: "Tập", key: "volume", width: 10 },
      { header: "Số", key: "issue", width: 10 },
      { header: "Trang", key: "pages", width: 12 },
      { header: "ISBN/ISSN", key: "isbn", width: 18 },
      { header: "DOI", key: "doi", width: 20 },
      { header: "Chỉ mục (Indexing)", key: "indexing", width: 18 },
      { header: "Link", key: "link", width: 30 },
      { header: "Ghi chú", key: "notes", width: 25 }
    );

    await exportToExcel(
      `Ho-so-NCKH-${showFacultyMeta ? "MTCN" : profile.name}-${new Date().getFullYear()}`,
      "Hồ sơ NCKH",
      columns,
      filteredPublications
    );
  };

  const handleExportCsv = () => {
    const columns: Array<{ header: string; key: string }> = [
      { header: "Năm", key: "year" },
      { header: "Tên công trình", key: "title" },
      { header: "Loại hình", key: "type" },
    ];

    if (showFacultyMeta) {
      columns.push(
        { header: "Giảng viên", key: "userName" },
        { header: "Email", key: "userEmail" }
      );
    }

    columns.push(
      { header: "Vai trò", key: "role" },
      { header: "Tác giả / Đồng tác giả", key: "coAuthors" },
      { header: "Tạp chí / Hội thảo", key: "journalOrConference" },
      { header: "NXB / Tổ chức", key: "publisher" },
      { header: "ISBN/ISSN", key: "isbn" },
      { header: "DOI", key: "doi" },
      { header: "Indexing", key: "indexing" },
      { header: "Link", key: "link" }
    );

    exportToCsv(
      `Ho-so-NCKH-${showFacultyMeta ? "MTCN" : profile.name}-${new Date().getFullYear()}`,
      columns,
      filteredPublications
    );
  };

  const handleDelete = async (pub: Publication) => {
    if (!window.confirm(`Bạn có chắc muốn xóa công trình "${pub.title}" khỏi hồ sơ?`)) {
      return;
    }
    try {
      await deletePublication(
        pub.id,
        pub.title,
        { uid: profile.uid, email: profile.email, role: profile.role }
      );
      await loadPublications();
    } catch (err: any) {
      alert("Lỗi xóa công trình: " + err.message);
    }
  };


  return (
    <div className="app-container">
      {/* Top Header */}
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
          <h1 style={{ fontSize: "1.6rem", color: "var(--primary)" }}>Hồ sơ Nghiên cứu Khoa học</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: 4 }}>
            Toàn bộ các bài báo, hội thảo, đề tài và sách đã hoàn thành hoặc xuất bản của giảng viên
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportExcel}
            disabled={filteredPublications.length === 0}
          >
            <FileSpreadsheet size={16} /> Xuất Excel
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportCsv}
            disabled={filteredPublications.length === 0}
          >
            <Download size={16} /> Xuất CSV
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsAddOpen(true)}
          >
            <Plus size={16} /> Thêm công trình
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 280px" }}>
            <Search
              size={18}
              color="var(--muted)"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: 38 }}
              placeholder="Tìm kiếm công trình, giảng viên, tạp chí..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Staff: Lecturer Filter */}
          {isStaff ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Users size={16} color="var(--primary)" />
              <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>Giảng viên:</span>
              <select
                className="form-control"
                value={selectedLecturerId}
                onChange={(e) => setSelectedLecturerId(e.target.value)}
                style={{ width: "auto" }}
              >
                <option value="all">Toàn bộ khoa ({activeLecturers.length} GV)</option>
                {activeLecturers.map((l) => (
                  <option key={l.id} value={l.email || l.uid || l.id}>
                    {l.name} ({l.email})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            /* Lecturer: Personal vs Faculty Toggle */
            <div style={{ display: "flex", gap: 4, background: "#f1f5f9", padding: 3, borderRadius: 6 }}>
              <button
                type="button"
                className={`btn btn-sm ${viewScope === "personal" ? "btn-primary" : "btn-secondary"}`}
                style={{ minHeight: 32, padding: "4px 10px", fontSize: "0.8125rem" }}
                onClick={() => setViewScope("personal")}
              >
                Hồ sơ của tôi
              </button>
              <button
                type="button"
                className={`btn btn-sm ${viewScope === "faculty" ? "btn-primary" : "btn-secondary"}`}
                style={{ minHeight: 32, padding: "4px 10px", fontSize: "0.8125rem" }}
                onClick={() => setViewScope("faculty")}
              >
                Toàn khoa
              </button>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Filter size={16} color="var(--primary)" />
            <select
              className="form-control"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{ width: "auto" }}
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

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>Năm:</span>
            <select
              className="form-control"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{ width: "auto" }}
            >
              <option value="Tất cả">Tất cả các năm</option>
              {years.map((y) => (
                <option key={y} value={String(y)}>Năm {y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Publications Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
          Đang tải hồ sơ nghiên cứu...
        </div>
      ) : filteredPublications.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
          <BookOpen size={36} color="var(--muted)" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ color: "var(--primary)", marginBottom: 6 }}>
            {isStaff && selectedLecturerId !== "all"
              ? "Chưa có công trình nào trong hồ sơ của giảng viên này"
              : "Chưa có công trình nào trong hồ sơ"}
          </h3>
          <p style={{ fontSize: "0.9rem", maxWidth: 450, margin: "0 auto 16px" }}>
            {isStaff && selectedLecturerId !== "all"
              ? "Giảng viên được chọn hiện chưa có bài báo, đề tài hoặc sản phẩm khoa học nào được ghi nhận."
              : "Bạn có thể nhập các công trình đã công bố trước đây hoặc chuyển từ mục Tiến độ NCKH khi công trình được xuất bản."}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsAddOpen(true)}
          >
            <Plus size={16} /> Thêm công trình vào hồ sơ
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>Năm</th>
                {showFacultyMeta && <th>Giảng viên</th>}
                <th>Tên công trình</th>
                <th>Loại hình</th>
                <th>Vai trò</th>
                <th>Tạp chí / Hội thảo / NXB</th>
                <th>Chỉ mục (Indexing)</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredPublications.map((pub) => {
                const canModify = isStaff || pub.userId === profile.uid;
                return (
                  <tr key={pub.id}>
                    <td style={{ fontWeight: 800, color: "var(--primary)" }}>{pub.year}</td>
                    {showFacultyMeta && (
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--primary)", fontSize: "0.875rem" }}>
                          {pub.userName}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          {pub.userEmail}
                        </div>
                      </td>
                    )}
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-main)", marginBottom: 4 }}>
                        {pub.title}
                      </div>
                      {pub.coAuthors && (
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          Tác giả: {pub.coAuthors}
                        </div>
                      )}
                      {pub.link && (
                        <a
                          href={pub.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: 3, marginTop: 2 }}
                        >
                          Xem bài báo <ExternalLink size={10} />
                        </a>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontWeight: 600 }}>{pub.type}</span>
                    </td>
                    <td>{pub.role}</td>
                    <td>
                      <div style={{ fontSize: "0.85rem" }}>
                        {pub.journalOrConference || pub.publisher || "—"}
                      </div>
                      {(pub.volume || pub.issue) && (
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          {pub.volume ? `Vol. ${pub.volume} ` : ""}{pub.issue ? `No. ${pub.issue}` : ""}
                        </div>
                      )}
                    </td>
                    <td>
                      {pub.indexing ? (
                        <span className="badge" style={{ background: "#e0f2fe", color: "#0369a1", fontWeight: 600 }}>
                          {pub.indexing}
                        </span>
                      ) : (
                        <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {canModify ? (
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm btn-icon"
                            onClick={() => setEditingPub(pub)}
                            title="Sửa công trình"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm btn-icon"
                            onClick={() => handleDelete(pub)}
                            title="Xóa công trình"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Chỉ đọc</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <PublicationModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSubmit={async (data) => {
          await createPublication(
            data as any,
            { uid: profile.uid, email: profile.email, role: profile.role }
          );
          await loadPublications();
        }}
        userId={profile.uid}
        userEmail={profile.email}
        userName={profile.name}
        lecturers={isStaff ? activeLecturers : undefined}
      />

      <PublicationModal
        isOpen={!!editingPub}
        onClose={() => setEditingPub(null)}
        initialData={editingPub}
        onSubmit={async (data) => {
          if (!editingPub) return;
          await updatePublication(
            editingPub.id,
            data,
            { uid: profile.uid, email: profile.email, role: profile.role }
          );
          await loadPublications();
        }}
        userId={profile.uid}
        userEmail={profile.email}
        userName={profile.name}
      />
    </div>
  );
};
