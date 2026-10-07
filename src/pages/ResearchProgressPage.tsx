import React, { useState, useEffect } from "react";
import { useAuth } from "../firebase/auth";
import {
  fetchResearchWorks,
  createResearchWork,
  updateResearchWork,
  updateResearchWorkOnBehalf,
  deleteResearchWork,
  fetchActiveLecturers,
} from "../firebase/firestore";
import type { ResearchWork, ResearchStatus, UserProfile } from "../types";
import { ResearchWorkModal } from "../components/ResearchWorkModal";
import { ProgressHistoryModal } from "../components/ProgressHistoryModal";
import { ConvertToPublicationModal } from "../components/ConvertToPublicationModal";
import { formatDateVN } from "../utils/date";
import { exportToExcel, exportToCsv } from "../utils/excel";
import {
  Plus,
  Search,
  Filter,
  History,
  CheckCircle,
  Edit2,
  Trash2,
  Calendar,
  Layers,
  ArrowRight,
  Download,
  FileSpreadsheet,
  Users,
} from "lucide-react";

const STATUS_FILTERS = [
  "Tất cả",
  "Ý tưởng",
  "Đang chuẩn bị",
  "Đang viết",
  "Đã gửi",
  "Chờ phản biện",
  "Sửa theo phản biện",
  "Được chấp nhận",
  "Đã xuất bản",
  "Nghiệm thu / Hoàn tất",
];

export const ResearchProgressPage: React.FC = () => {
  const { profile } = useAuth();
  const [works, setWorks] = useState<ResearchWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Tất cả");

  // Lecturer list & filter for Admin/Owner
  const [activeLecturers, setActiveLecturers] = useState<UserProfile[]>([]);
  const [selectedLecturerId, setSelectedLecturerId] = useState<string>("all");

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingWork, setEditingWork] = useState<ResearchWork | null>(null);
  const [historyWork, setHistoryWork] = useState<ResearchWork | null>(null);
  const [convertingWork, setConvertingWork] = useState<ResearchWork | null>(null);

  const isStaff = profile?.role === "admin" || profile?.role === "owner";

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

  const loadWorks = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const targetIdentifier = isStaff
        ? selectedLecturerId === "all"
          ? undefined
          : selectedLecturerId
        : profile.uid;
      const data = await fetchResearchWorks(targetIdentifier, isStaff);
      setWorks(data);
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
    loadWorks();
  }, [profile, selectedLecturerId]);

  if (!profile) return null;

  const filteredWorks = works.filter((w) => {
    const matchQuery =
      searchQuery.trim() === "" ||
      w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.userName && w.userName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (w.venue && w.venue.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (w.category && w.category.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchStatus =
      selectedStatus === "Tất cả" || w.status === selectedStatus;

    return matchQuery && matchStatus;
  });

  const handleQuickStatusChange = async (work: ResearchWork, newStatus: ResearchStatus) => {
    try {
      if (isStaff && work.userId !== profile.uid) {
        await updateResearchWorkOnBehalf(
          work.id,
          { status: newStatus },
          `Chuyển nhanh trạng thái thành: ${newStatus}`,
          { uid: profile.uid, email: profile.email, role: profile.role }
        );
      } else {
        await updateResearchWork(
          work.id,
          { status: newStatus },
          `Chuyển nhanh trạng thái thành: ${newStatus}`,
          { uid: profile.uid, email: profile.email, role: profile.role }
        );
      }
      await loadWorks();
    } catch (err: any) {
      alert("Lỗi cập nhật trạng thái: " + err.message);
    }
  };

  const handleDelete = async (work: ResearchWork) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa công trình "${work.title}"?`)) {
      return;
    }
    try {
      await deleteResearchWork(
        work.id,
        work.title,
        { uid: profile.uid, email: profile.email, role: profile.role }
      );
      await loadWorks();
    } catch (err: any) {
      alert("Lỗi xóa công trình: " + err.message);
    }
  };

  const handleExportExcel = async () => {
    const cols = [
      { header: "Tên công trình", key: "title", width: 40 },
      { header: "Loại hình", key: "category", width: 18 },
      { header: "Giảng viên", key: "userName", width: 22 },
      { header: "Email", key: "userEmail", width: 25 },
      { header: "Trạng thái", key: "status", width: 18 },
      { header: "Hội thảo / Tạp chí", key: "venue", width: 30 },
      { header: "Hạn nộp", key: "deadline", width: 15 },
      { header: "Vai trò", key: "role", width: 16 },
      { header: "Đồng tác giả", key: "coAuthors", width: 25 },
      { header: "Ghi chú", key: "notes", width: 25 },
    ];
    await exportToExcel(
      `Tien-do-NCKH-${isStaff ? "MTCN" : profile.name}-${new Date().getFullYear()}`,
      "Tiến độ NCKH",
      cols,
      filteredWorks
    );
  };

  const handleExportCsv = () => {
    const cols = [
      { header: "Tên công trình", key: "title" },
      { header: "Loại hình", key: "category" },
      { header: "Giảng viên", key: "userName" },
      { header: "Email", key: "userEmail" },
      { header: "Trạng thái", key: "status" },
      { header: "Hội thảo / Tạp chí", key: "venue" },
      { header: "Hạn nộp", key: "deadline" },
      { header: "Vai trò", key: "role" },
      { header: "Đồng tác giả", key: "coAuthors" },
    ];
    exportToCsv(
      `Tien-do-NCKH-${isStaff ? "MTCN" : profile.name}-${new Date().getFullYear()}`,
      cols,
      filteredWorks
    );
  };

  return (
    <div className="app-container">
      {/* Header bar */}
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
          <h1 style={{ fontSize: "1.6rem", color: "var(--primary)" }}>Tiến độ NCKH Giảng viên</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: 4 }}>
            Theo dõi vòng đời các đề tài, bài báo, hội thảo từ giai đoạn ý tưởng đến khi xuất bản nghiệm thu
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportExcel}
            title="Xuất file Excel"
          >
            <FileSpreadsheet size={15} /> Xuất Excel
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportCsv}
            title="Xuất file CSV"
          >
            <Download size={15} /> Xuất CSV
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsAddOpen(true)}
          >
            <Plus size={16} />
            Tạo công trình NCKH mới
          </button>
        </div>
      </div>

      {/* Filter and search bar */}
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
              placeholder="Tìm kiếm theo tên đề tài, giảng viên, hội thảo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Lecturer Selector for Staff */}
          {isStaff && (
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
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Filter size={16} color="var(--primary)" />
            <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>Trạng thái:</span>
            <select
              className="form-control"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{ width: "auto" }}
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Research Works List / Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
          Đang tải danh sách công trình...
        </div>
      ) : filteredWorks.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
          <Layers size={36} color="var(--muted)" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ color: "var(--primary)", marginBottom: 6 }}>
            {isStaff && selectedLecturerId !== "all"
              ? "Chưa có tiến độ NCKH cho giảng viên này"
              : "Chưa có công trình NCKH nào"}
          </h3>
          <p style={{ fontSize: "0.9rem", maxWidth: 450, margin: "0 auto 16px" }}>
            {isStaff && selectedLecturerId !== "all"
              ? "Giảng viên được chọn hiện chưa có đề tài, bài báo hoặc dự án nào đang theo dõi tiến độ."
              : "Bạn chưa tạo đề tài hoặc bài báo nào trong tiến độ. Bấm vào nút bên dưới để bắt đầu quản lý."}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsAddOpen(true)}
          >
            <Plus size={16} /> Tạo công trình ngay
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {filteredWorks.map((work) => {
            const isCompletedState =
              work.status === "Đã xuất bản" || work.status === "Nghiệm thu / Hoàn tất";
            const canConvert = isCompletedState && !work.convertedToPublicationId;

            return (
              <div key={work.id} className="card card-hover" style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
                        {work.category}
                      </span>
                      <span className="badge" style={{ background: "#e0f2fe", color: "#0369a1", fontWeight: 600 }}>
                        {work.role}
                      </span>
                      {isStaff && (
                        <span className="badge badge-primary" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Users size={12} /> {work.userName} ({work.userEmail})
                        </span>
                      )}
                      {work.convertedToPublicationId && (
                        <span className="badge badge-success">
                          ĐÃ VÀO HỒ SƠ NGHIÊN CỨU
                        </span>
                      )}
                    </div>

                    <h3 style={{ fontSize: "1.15rem", color: "var(--primary)", lineHeight: 1.4, marginBottom: 8 }}>
                      {work.title}
                    </h3>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: "0.85rem", color: "var(--text-sub)" }}>
                      {work.venue && (
                        <div>Hội thảo / Tạp chí: <strong>{work.venue}</strong></div>
                      )}
                      {work.deadline && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Calendar size={14} color="var(--danger)" />
                          <span>Hạn nộp: <strong style={{ color: "var(--danger)" }}>{formatDateVN(work.deadline)}</strong></span>
                        </div>
                      )}
                      {work.coAuthors && (
                        <div>Đồng tác giả: {work.coAuthors}</div>
                      )}
                    </div>
                  </div>

                  {/* Status Dropdown & Fast action */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>Trạng thái:</span>
                      <select
                        className="form-control"
                        value={work.status}
                        onChange={(e) => handleQuickStatusChange(work, e.target.value as ResearchStatus)}
                        style={{
                          width: "auto",
                          fontWeight: 700,
                          fontSize: "0.875rem",
                          borderColor: "var(--secondary)",
                          color: "var(--primary)",
                        }}
                      >
                        {STATUS_FILTERS.slice(1).map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setHistoryWork(work)}
                        title="Xem và thêm mốc thời gian cập nhật tiến độ"
                      >
                        <History size={14} />
                        Lịch sử ({work.status})
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditingWork(work)}
                        title="Sửa thông tin công trình"
                      >
                        <Edit2 size={14} />
                        Sửa
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => handleDelete(work)}
                        title="Xóa công trình"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {canConvert && (
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        style={{ marginTop: 4 }}
                        onClick={() => setConvertingWork(work)}
                      >
                        <CheckCircle size={14} />
                        Chuyển vào Hồ sơ nghiên cứu
                      </button>
                    )}
                  </div>
                </div>

                {work.notes && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line)", fontSize: "0.85rem", color: "var(--muted)" }}>
                    <strong>Ghi chú:</strong> {work.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <ResearchWorkModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSubmit={async (data, note) => {
          await createResearchWork(
            data as any,
            { uid: profile.uid, email: profile.email, role: profile.role }
          );
          await loadWorks();
        }}
        userId={profile.uid}
        userEmail={profile.email}
        userName={profile.name}
        lecturers={isStaff ? activeLecturers : undefined}
      />

      <ResearchWorkModal
        isOpen={!!editingWork}
        onClose={() => setEditingWork(null)}
        initialData={editingWork}
        onSubmit={async (data, note) => {
          if (!editingWork) return;
          if (isStaff && editingWork.userId !== profile.uid) {
            await updateResearchWorkOnBehalf(
              editingWork.id,
              data,
              note || "Cập nhật công trình bởi Admin",
              { uid: profile.uid, email: profile.email, role: profile.role }
            );
          } else {
            await updateResearchWork(
              editingWork.id,
              data,
              note,
              { uid: profile.uid, email: profile.email, role: profile.role }
            );
          }
          await loadWorks();
        }}
        userId={profile.uid}
        userEmail={profile.email}
        userName={profile.name}
      />

      <ProgressHistoryModal
        research={historyWork}
        onClose={() => setHistoryWork(null)}
        onStatusUpdated={loadWorks}
      />

      <ConvertToPublicationModal
        research={convertingWork}
        onClose={() => setConvertingWork(null)}
        onSuccess={async () => {
          await loadWorks();
        }}
      />
    </div>
  );
};
