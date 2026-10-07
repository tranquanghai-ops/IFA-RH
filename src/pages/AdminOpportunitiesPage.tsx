import React, { useState, useEffect } from "react";
import { useAuth } from "../firebase/auth";
import {
  fetchAllOpportunities,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  hideOpportunity,
  republishOpportunity,
  recallOpportunityToCandidateQueue,
} from "../firebase/firestore";
import type { Opportunity } from "../types";
import { OpportunityFormModal } from "../components/OpportunityFormModal";
import { OpportunityDetailModal } from "../components/OpportunityDetailModal";
import { Modal } from "../components/Modal";
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
  EyeOff,
  RotateCcw,
  Globe,
  Compass,
  Download,
  FileSpreadsheet,
  AlertTriangle,
} from "lucide-react";

export const AdminOpportunitiesPage: React.FC = () => {
  const { profile } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "hidden" | "recalled" | "archived">("published");

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null);
  const [viewingOpp, setViewingOpp] = useState<Opportunity | null>(null);
  const [hidingOpp, setHidingOpp] = useState<Opportunity | null>(null);
  const [recallingOpp, setRecallingOpp] = useState<Opportunity | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

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

  const handleConfirmHide = async () => {
    if (!hidingOpp || !profile) return;
    setActionLoading(true);
    try {
      await hideOpportunity(hidingOpp.id, {
        uid: profile.uid,
        email: profile.email,
        role: profile.role,
      });
      setHidingOpp(null);
      await loadOpportunities();
    } catch (err: any) {
      alert("Lỗi ẩn tin: " + (err.message || err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRepublish = async (opp: Opportunity) => {
    if (!profile) return;
    try {
      await republishOpportunity(opp.id, {
        uid: profile.uid,
        email: profile.email,
        role: profile.role,
      });
      await loadOpportunities();
    } catch (err: any) {
      alert("Lỗi công bố lại tin: " + (err.message || err));
    }
  };

  const handleConfirmRecall = async () => {
    if (!recallingOpp || !profile) return;
    setActionLoading(true);
    try {
      await recallOpportunityToCandidateQueue(recallingOpp, {
        uid: profile.uid,
        email: profile.email,
        role: profile.role,
      });
      setRecallingOpp(null);
      await loadOpportunities();
    } catch (err: any) {
      alert("Lỗi thu hồi tin: " + (err.message || err));
    } finally {
      setActionLoading(false);
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
    <div className="app-container" style={{ maxWidth: "100%", paddingLeft: 0, paddingRight: 0 }}>
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
            <Plus size={16} /> Đăng tin mới
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
              <option value="hidden">Đã ẩn (Hidden)</option>
              <option value="recalled">Đã thu hồi (Recalled)</option>
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
          <h3 style={{ color: "var(--primary)", marginBottom: 6 }}>Chưa có tin nào</h3>
          <p style={{ fontSize: "0.9rem", maxWidth: 450, margin: "0 auto 16px" }}>
            Bấm vào nút bên dưới để tạo bài đăng tin mới cho giảng viên.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsAddOpen(true)}
          >
            <Plus size={16} /> Đăng tin mới
          </button>
        </div>
      ) : (
        <div className="table-container" style={{ overflowX: "auto" }}>
          <table className="table-compact" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ minWidth: 240 }}>Tiêu đề hội thảo / Cơ hội</th>
                <th style={{ width: 170, minWidth: 150, maxWidth: 190 }}>Đơn vị tổ chức</th>
                <th style={{ width: 75, textAlign: "center", whiteSpace: "nowrap" }}>Loại hình</th>
                <th style={{ width: 70, textAlign: "center", whiteSpace: "nowrap" }}>Cấp độ</th>
                <th style={{ width: 95, textAlign: "center", whiteSpace: "nowrap" }}>Hạn nộp</th>
                <th style={{ width: 75, textAlign: "center", whiteSpace: "nowrap" }}>Nguồn gốc</th>
                <th style={{ width: 90, textAlign: "center", whiteSpace: "nowrap" }}>Trạng thái</th>
                <th style={{ width: 165, textAlign: "right", whiteSpace: "nowrap" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((opp) => (
                <tr key={opp.id}>
                  <td style={{ minWidth: 240 }}>
                    <div style={{ fontWeight: 600, color: "var(--primary)", fontSize: "0.82rem", lineHeight: 1.35, marginBottom: 2 }}>
                      {opp.title}
                    </div>
                    {opp.field && (
                      <div style={{ fontSize: "0.72rem", color: "var(--teal)", lineHeight: 1.3 }}>
                        Phù hợp: {opp.field}
                      </div>
                    )}
                  </td>
                  <td style={{ width: 170, minWidth: 150, maxWidth: 190, fontSize: "0.8rem", lineHeight: 1.35 }}>
                    {opp.organizer}
                  </td>
                  <td style={{ width: 75, textAlign: "center", whiteSpace: "nowrap" }}>
                    <span className="badge badge-neutral" style={{ fontWeight: 600, fontSize: "0.72rem", padding: "2px 6px" }}>{opp.type}</span>
                  </td>
                  <td style={{ width: 70, textAlign: "center", whiteSpace: "nowrap", fontSize: "0.8rem" }}>
                    {opp.level}
                  </td>
                  <td style={{ width: 95, textAlign: "center", whiteSpace: "nowrap", fontWeight: 700, color: "var(--danger)", fontSize: "0.8rem" }}>
                    {formatDateVN(opp.deadline) || "Chưa rõ"}
                  </td>
                  <td style={{ width: 75, textAlign: "center", whiteSpace: "nowrap" }}>
                    <span
                      className="badge"
                      style={
                        opp.sourceType === "SPARK"
                          ? { background: "#f3e8ff", color: "#6b21a8", fontSize: "0.72rem", padding: "2px 6px", fontWeight: 600 }
                          : { background: "#e0f2fe", color: "#0369a1", fontSize: "0.72rem", padding: "2px 6px", fontWeight: 600 }
                      }
                    >
                      {opp.sourceType}
                    </span>
                  </td>
                  <td style={{ width: 90, textAlign: "center", whiteSpace: "nowrap" }}>
                    {opp.status === "published" && (
                      <span className="badge" style={{ background: "#dcfce7", color: "#15803d", fontWeight: 600, fontSize: "0.72rem", padding: "2px 6px" }}>
                        Đã công bố
                      </span>
                    )}
                    {opp.status === "hidden" && (
                      <span className="badge" style={{ background: "#fef3c7", color: "#b45309", fontWeight: 600, fontSize: "0.72rem", padding: "2px 6px" }}>
                        Đã ẩn
                      </span>
                    )}
                    {opp.status === "recalled" && (
                      <span className="badge" style={{ background: "#f3e8ff", color: "#7e22ce", fontWeight: 600, fontSize: "0.72rem", padding: "2px 6px" }}>
                        Đã thu hồi
                      </span>
                    )}
                    {opp.status === "archived" && (
                      <span className="badge badge-neutral" style={{ fontWeight: 600, fontSize: "0.72rem", padding: "2px 6px" }}>
                        Lưu trữ
                      </span>
                    )}
                  </td>
                  <td style={{ width: 165, textAlign: "right", whiteSpace: "nowrap" }}>
                    <div style={{ display: "inline-flex", gap: 4, alignItems: "center", justifyContent: "flex-end" }}>
                      {/* Ẩn tin (áp dụng cho tin đang công bố) */}
                      {opp.status === "published" && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setHidingOpp(opp)}
                          title="Ẩn tin khỏi trang công khai"
                          style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 6px", fontSize: "0.74rem" }}
                        >
                          <EyeOff size={12} /> Ẩn tin
                        </button>
                      )}

                      {/* Công bố lại (áp dụng cho tin đang ẩn) */}
                      {opp.status === "hidden" && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleRepublish(opp)}
                          title="Công bố lại tin lên trang công khai"
                          style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 6px", fontSize: "0.74rem", color: "var(--teal)" }}
                        >
                          <Globe size={12} /> Công bố lại
                        </button>
                      )}

                      {/* Thu hồi về chờ duyệt (chỉ cho bài nguồn SPARK/AI, khi chưa bị thu hồi) */}
                      {opp.sourceType === "SPARK" && opp.status !== "recalled" && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setRecallingOpp(opp)}
                          title="Thu hồi tin này về danh sách Dữ liệu AI tìm để duyệt lại"
                          style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 6px", fontSize: "0.74rem", color: "#7e22ce" }}
                        >
                          <RotateCcw size={12} /> Thu hồi
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-icon"
                        onClick={() => setViewingOpp(opp)}
                        title="Xem chi tiết"
                        style={{ width: 26, height: 26, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm btn-icon"
                        onClick={() => setEditingOpp(opp)}
                        title="Sửa tin"
                        style={{ width: 26, height: 26, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm btn-icon"
                        onClick={() => handleDelete(opp)}
                        title="Xóa tin"
                        style={{ width: 26, height: 26, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <Trash2 size={13} />
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

      {/* Modal xác nhận Ẩn tin */}
      <Modal
        isOpen={!!hidingOpp}
        onClose={() => setHidingOpp(null)}
        title="Xác nhận ẩn tin"
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setHidingOpp(null)}
              disabled={actionLoading}
            >
              Hủy
            </button>
            <button
              type="button"
              className="btn btn-warning"
              onClick={handleConfirmHide}
              disabled={actionLoading}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <EyeOff size={16} />
              {actionLoading ? "Đang xử lý..." : "Xác nhận ẩn tin"}
            </button>
          </div>
        }
      >
        <div style={{ padding: "8px 0" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "#fef3c7",
                color: "#b45309",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={22} />
            </div>
            <div>
              <h4 style={{ margin: "0 0 6px", color: "var(--primary)", fontSize: "1rem" }}>
                Ẩn tin này khỏi trang công khai?
              </h4>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.5 }}>
                Tin sẽ không còn hiển thị với giảng viên nhưng toàn bộ dữ liệu vẫn được giữ lại.
              </p>
            </div>
          </div>
          {hidingOpp && (
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid var(--line)",
                borderRadius: 6,
                padding: 12,
                fontSize: "0.88rem",
              }}
            >
              <div><strong>Tiêu đề:</strong> {hidingOpp.title}</div>
              <div style={{ marginTop: 4 }}><strong>Đơn vị tổ chức:</strong> {hidingOpp.organizer}</div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal xác nhận Thu hồi về chờ duyệt (AI / Spark) */}
      <Modal
        isOpen={!!recallingOpp}
        onClose={() => setRecallingOpp(null)}
        title="Xác nhận thu hồi tin về chờ duyệt"
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setRecallingOpp(null)}
              disabled={actionLoading}
            >
              Hủy
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmRecall}
              disabled={actionLoading}
              style={{
                background: "#7e22ce",
                borderColor: "#7e22ce",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <RotateCcw size={16} />
              {actionLoading ? "Đang xử lý..." : "Xác nhận thu hồi"}
            </button>
          </div>
        }
      >
        <div style={{ padding: "8px 0" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "#f3e8ff",
                color: "#7e22ce",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <RotateCcw size={22} />
            </div>
            <div>
              <h4 style={{ margin: "0 0 6px", color: "var(--primary)", fontSize: "1rem" }}>
                Thu hồi tin này về danh sách Dữ liệu AI tìm để duyệt lại?
              </h4>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.5 }}>
                Tin sẽ ngay lập tức ngừng hiển thị trên trang công khai và chuyển về trạng thái chờ duyệt.
              </p>
            </div>
          </div>
          {recallingOpp && (
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid var(--line)",
                borderRadius: 6,
                padding: 12,
                fontSize: "0.88rem",
              }}
            >
              <div><strong>Tiêu đề:</strong> {recallingOpp.title}</div>
              <div style={{ marginTop: 4 }}><strong>Đơn vị tổ chức:</strong> {recallingOpp.organizer}</div>
              <div style={{ marginTop: 4 }}><strong>Nguồn gốc:</strong> SPARK / AI</div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
