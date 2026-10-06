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

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setIsAddOpen(true)}
        >
          <Plus size={16} /> Đăng cơ hội mới
        </button>
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
