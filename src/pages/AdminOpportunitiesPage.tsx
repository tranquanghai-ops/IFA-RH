import React, { useState, useEffect } from "react";
import { useAuth } from "../firebase/auth";
import {
  fetchAllOpportunities,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
} from "../firebase/firestore";
import type { Opportunity } from "../types";
import { OpportunityFormModal } from "../components/OpportunityFormModal";
import { OpportunityDetailModal } from "../components/OpportunityDetailModal";
import { exportToExcel, exportToCsv } from "../utils/excel";
import { formatDateVN } from "../utils/date";
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  ExternalLink,
  Eye,
  Compass,
  Download,
  FileSpreadsheet,
} from "lucide-react";

export const AdminOpportunitiesPage: React.FC = () => {
  const { profile } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "archived">("published");

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null);
  const [viewingOpp, setViewingOpp] = useState<Opportunity | null>(null);

  const loadOpportunities = async () => {
    setLoading(true);
    try {
      const list = await fetchAllOpportunities();
      setOpportunities(list);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOpportunities();
  }, []);

  if (!profile) return null;

  const filtered = opportunities.filter((opp) => {
    const matchStatus = statusFilter === "all" ? true : opp.status === statusFilter;
    const matchSearch =
      searchQuery.trim() === "" ||
      opp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opp.organizer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (opp.field && opp.field.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchStatus && matchSearch;
  });

  const handleDelete = async (opp: Opportunity) => {
    if (!window.confirm(`Bạn có chắc muốn xóa cơ hội "${opp.title}"?`)) {
      return;
    }
    try {
      await deleteOpportunity(
        opp.id,
        opp.title,
        { uid: profile.uid, email: profile.email, role: profile.role }
      );
      await loadOpportunities();
    } catch (err: any) {
      alert("Lỗi xóa cơ hội: " + err.message);
    }
  };

  const handleExportExcel = async () => {
    if (filtered.length === 0) {
      alert("Không có dữ liệu để xuất");
      return;
    }
    const cols = [
      { header: "Tên hội thảo / Tạp chí", key: "title", width: 35 },
      { header: "Loại hình", key: "type", width: 15 },
      { header: "Đơn vị tổ chức", key: "organizer", width: 25 },
      { header: "Lĩnh vực / Chuyên ngành", key: "field", width: 20 },
      { header: "Hạn nộp bài", key: "deadline", width: 15 },
      { header: "Thời gian diễn ra", key: "eventDate", width: 15 },
      { header: "Địa điểm", key: "location", width: 20 },
      { header: "Trạng thái", key: "status", width: 12 },
      { header: "Website", key: "sourceUrl", width: 30 },
      { header: "Tags", key: "tagsStr", width: 20 },
    ];
    const data = filtered.map((o) => ({
      ...o,
      tagsStr: (o.tags || []).join(", "),
    }));
    await exportToExcel(
      `IFA_RH_Co_Hoi_NCKH_${new Date().toISOString().slice(0, 10)}`,
      "Cơ hội NCKH",
      cols,
      data
    );
  };

  const handleExportCsv = () => {
    if (filtered.length === 0) {
      alert("Không có dữ liệu để xuất");
      return;
    }
    const cols = [
      { header: "Tên hội thảo / Tạp chí", key: "title" },
      { header: "Loại hình", key: "type" },
      { header: "Đơn vị tổ chức", key: "organizer" },
      { header: "Lĩnh vực / Chuyên ngành", key: "field" },
      { header: "Hạn nộp bài", key: "deadline" },
      { header: "Thời gian diễn ra", key: "eventDate" },
      { header: "Địa điểm", key: "location" },
      { header: "Trạng thái", key: "status" },
      { header: "Website", key: "sourceUrl" },
      { header: "Tags", key: "tagsStr" },
    ];
    const data = filtered.map((o) => ({
      ...o,
      tagsStr: (o.tags || []).join(", "),
    }));
    exportToCsv(
      `IFA_RH_Co_Hoi_NCKH_${new Date().toISOString().slice(0, 10)}`,
      cols,
      data
    );
  };

  return (
    <div className="app-container">
      {/* Header */}
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
          <h1 style={{ fontSize: "1.6rem", color: "var(--primary)" }}>Quản lý Cơ hội NCKH & Hội thảo</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: 4 }}>
            Quản trị danh sách hội thảo, Call for Papers, tạp chí công bố ra trang chủ cho giảng viên
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportCsv}
            title="Xuất danh sách ra file CSV UTF-8"
          >
            <Download size={16} /> Xuất CSV
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportExcel}
            title="Xuất danh sách ra file Excel (.xlsx)"
          >
            <FileSpreadsheet size={16} /> Xuất Excel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsAddOpen(true)}
          >
            <Plus size={16} /> Đăng cơ hội mới
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
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
              placeholder="Tìm kiếm theo tiêu đề, đơn vị tổ chức, ngành..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Filter size={16} color="var(--primary)" />
            <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>Trạng thái:</span>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{ width: "auto" }}
            >
              <option value="published">Đã công bố (Published)</option>
              <option value="archived">Lưu trữ (Archived)</option>
              <option value="all">Tất cả</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
          Đang tải danh sách cơ hội...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
          <Compass size={36} color="var(--muted)" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ color: "var(--primary)", marginBottom: 6 }}>Chưa có cơ hội nào</h3>
          <p style={{ fontSize: "0.9rem", maxWidth: 450, margin: "0 auto 16px" }}>
            Bấm vào nút bên dưới để tạo bài đăng cơ hội NCKH mới cho giảng viên.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsAddOpen(true)}
          >
            <Plus size={16} /> Đăng cơ hội mới
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Tiêu đề hội thảo / Cơ hội</th>
                <th>Đơn vị tổ chức</th>
                <th>Loại hình</th>
                <th>Cấp độ</th>
                <th>Hạn nộp (Deadline)</th>
                <th>Nguồn gốc</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((opp) => (
                <tr key={opp.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--primary)", marginBottom: 2 }}>
                      {opp.title}
                    </div>
                    {opp.field && (
                      <div style={{ fontSize: "0.75rem", color: "var(--teal)" }}>
                        Phù hợp: {opp.field}
                      </div>
                    )}
                  </td>
                  <td>{opp.organizer}</td>
                  <td>
                    <span className="badge badge-neutral" style={{ fontWeight: 600 }}>{opp.type}</span>
                  </td>
                  <td>{opp.level}</td>
                  <td style={{ fontWeight: 700, color: "var(--danger)" }}>
                    {formatDateVN(opp.deadline) || "Chưa rõ"}
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={
                        opp.sourceType === "SPARK"
                          ? { background: "#f3e8ff", color: "#6b21a8" }
                          : { background: "#e0f2fe", color: "#0369a1" }
                      }
                    >
                      {opp.sourceType}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-icon"
                        onClick={() => setViewingOpp(opp)}
                        title="Xem chi tiết"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-icon"
                        onClick={() => setEditingOpp(opp)}
                        title="Sửa cơ hội"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm btn-icon"
                        onClick={() => handleDelete(opp)}
                        title="Xóa cơ hội"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <OpportunityFormModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSubmit={async (data) => {
          await createOpportunity(
            data as any,
            { uid: profile.uid, email: profile.email, role: profile.role }
          );
          await loadOpportunities();
        }}
      />

      <OpportunityFormModal
        isOpen={!!editingOpp}
        onClose={() => setEditingOpp(null)}
        initialData={editingOpp}
        onSubmit={async (data) => {
          if (!editingOpp) return;
          await updateOpportunity(
            editingOpp.id,
            data,
            { uid: profile.uid, email: profile.email, role: profile.role }
          );
          await loadOpportunities();
        }}
      />

      <OpportunityDetailModal
        opportunity={viewingOpp}
        onClose={() => setViewingOpp(null)}
      />
    </div>
  );
};
