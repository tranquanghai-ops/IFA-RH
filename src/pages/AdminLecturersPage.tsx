import React, { useState, useEffect } from "react";
import { useAuth } from "../firebase/auth";
import {
  fetchAllUsers,
  fetchSharedPersonnel,
  fetchLatestPersonnelSyncLog,
  fetchResearchPersonnelSettings,
  setResearchTrackingStatus,
  setResearchTrackingStatusBatch,
} from "../firebase/firestore";
import type {
  UserProfile,
  SharedPersonnelRecord,
  PersonnelSyncLog,
  ResearchTrackingStatus,
  ResearchPersonnelSettings,
} from "../types";
import { PersonnelJsonSyncModal } from "../components/PersonnelJsonSyncModal";
import { Modal } from "../components/Modal";
import { exportToExcel, exportToCsv } from "../utils/excel";
import { formatDateVN } from "../utils/date";
import {
  Users,
  Search,
  ExternalLink,
  ShieldCheck,
  Building,
  GraduationCap,
  Mail,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Info,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Archive,
  RotateCcw,
  AlertTriangle,
  BookmarkCheck,
  CheckSquare,
} from "lucide-react";

interface LecturerViewItem {
  email: string;
  name: string;
  department: string;
  academicDegree: string;
  lecturerType: string;
  employeeId?: string;
  active: boolean;
  role: "owner" | "admin" | "lecturer";
  userId?: string;
  sharedUpdatedAt?: string;
  researchTrackingStatus: ResearchTrackingStatus;
  archivedAt?: string | null;
  archivedBy?: string | null;
  archiveReason?: string | null;
}

const lecturerTypeMap: Record<string, string> = {
  visiting: "Thỉnh giảng",
  teaching_officer: "Viên chức giảng dạy",
  lecturer: "Giảng viên",
  core_2: "Cơ hữu 2",
  trainee_lecturer: "Tập sự",
  teaching_assistant: "Trợ giảng",
};

export const AdminLecturersPage: React.FC = () => {
  const { profile } = useAuth();
  const [items, setItems] = useState<LecturerViewItem[]>([]);
  const [rawShared, setRawShared] = useState<SharedPersonnelRecord[]>([]);
  const [latestSyncLog, setLatestSyncLog] = useState<PersonnelSyncLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("Tất cả");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Research Tracking Archival Tabs and Actions
  const [trackingTab, setTrackingTab] = useState<ResearchTrackingStatus>("ACTIVE");
  const [archiveTarget, setArchiveTarget] = useState<LecturerViewItem | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<LecturerViewItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Bulk Selection for Archiving / Restoring
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  // Modals
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sharedList, usersList, syncLog, settingsMap] = await Promise.all([
        fetchSharedPersonnel(),
        fetchAllUsers(),
        fetchLatestPersonnelSyncLog(),
        fetchResearchPersonnelSettings(),
      ]);

      setRawShared(sharedList);
      setLatestSyncLog(syncLog);

      const usersMap = new Map<string, UserProfile>();
      usersList.forEach((u) => {
        if (u.email) usersMap.set(u.email.toLowerCase().trim(), u);
      });

      if (sharedList.length > 0) {
        const itemMap = new Map<string, LecturerViewItem>();
        sharedList.forEach((p) => {
          const emailNorm = p.emailNormalized.toLowerCase().trim();
          if (!emailNorm) return;
          const user = usersMap.get(emailNorm);
          const setting = settingsMap.get(emailNorm);
          const researchTrackingStatus: ResearchTrackingStatus =
            setting?.researchTrackingStatus || "ACTIVE";

          itemMap.set(emailNorm, {
            email: p.emailNormalized,
            name: p.displayName,
            department: p.departmentName || "Chưa phân ngành",
            academicDegree: p.academicDegree || "",
            lecturerType: p.lecturerType || "lecturer",
            employeeId: p.employeeId,
            active: p.active !== false,
            role: user?.role || "lecturer",
            userId: user?.id,
            sharedUpdatedAt: p.sharedUpdatedAt,
            researchTrackingStatus,
            archivedAt: setting?.archivedAt,
            archivedBy: setting?.archivedBy,
            archiveReason: setting?.archiveReason,
          });
        });
        setItems(Array.from(itemMap.values()).sort((a, b) => a.name.localeCompare(b.name, "vi")));
      } else {
        // Fallback to existing users collection if sharedPersonnel hasn't been synced yet
        const itemMap = new Map<string, LecturerViewItem>();
        usersList.forEach((u) => {
          const emailNorm = (u.email || "").toLowerCase().trim();
          if (!emailNorm) return;
          const existing = itemMap.get(emailNorm);
          const setting = settingsMap.get(emailNorm);
          const researchTrackingStatus: ResearchTrackingStatus =
            setting?.researchTrackingStatus || "ACTIVE";

          if (!existing) {
            itemMap.set(emailNorm, {
              email: u.email,
              name: u.name,
              department: u.department || "Chưa phân ngành",
              academicDegree: u.academicDegree || "",
              lecturerType: "lecturer",
              active: u.active !== false,
              role: u.role || "lecturer",
              userId: u.id,
              researchTrackingStatus,
              archivedAt: setting?.archivedAt,
              archivedBy: setting?.archivedBy,
              archiveReason: setting?.archiveReason,
            });
          } else {
            const isUReal = !u.id.startsWith("prov_");
            const isExReal = !existing.userId?.startsWith("prov_");
            if (isUReal && !isExReal) {
              itemMap.set(emailNorm, {
                ...existing,
                userId: u.id,
                role: u.role === "admin" || u.role === "owner" ? u.role : existing.role,
                active: u.active !== false,
                researchTrackingStatus,
                archivedAt: setting?.archivedAt,
                archivedBy: setting?.archivedBy,
                archiveReason: setting?.archiveReason,
              });
            } else if ((u.role === "admin" || u.role === "owner") && existing.role === "lecturer") {
              itemMap.set(emailNorm, {
                ...existing,
                role: u.role,
                researchTrackingStatus,
                archivedAt: setting?.archivedAt,
                archivedBy: setting?.archivedBy,
                archiveReason: setting?.archiveReason,
              });
            }
          }
        });
        setItems(Array.from(itemMap.values()).sort((a, b) => a.name.localeCompare(b.name, "vi")));
      }
    } catch (err: any) {
      console.error("Error loading lecturer data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (!profile) return null;

  // Department list for dropdown
  const departments = Array.from(new Set(items.map((u) => u.department).filter(Boolean)));

  const isSuggestedForArchive = (u: LecturerViewItem) => {
    if (u.researchTrackingStatus === "ARCHIVED") return false;
    const degree = (u.academicDegree || "").toLowerCase().trim();
    const isCore2 = u.lecturerType === "core_2";
    const isVisiting = u.lecturerType === "visiting";
    const isBachelorOnly =
      degree.includes("cử nhân") ||
      degree.includes("bachelor") ||
      degree.includes("kỹ sư") ||
      (degree !== "" &&
        !degree.includes("thạc sĩ") &&
        !degree.includes("tiến sĩ") &&
        !degree.includes("ths") &&
        !degree.includes("ts") &&
        !degree.includes("pgs") &&
        !degree.includes("gs"));
    return isCore2 || isVisiting || isBachelorOnly;
  };

  const activeCount = items.filter((i) => i.researchTrackingStatus !== "ARCHIVED").length;
  const archivedCount = items.filter((i) => i.researchTrackingStatus === "ARCHIVED").length;

  const filteredItems = items.filter((u) => {
    const matchTab =
      trackingTab === "ACTIVE"
        ? u.researchTrackingStatus !== "ARCHIVED"
        : u.researchTrackingStatus === "ARCHIVED";

    const matchDept = departmentFilter === "Tất cả" || u.department === departmentFilter;
    const matchSearch =
      searchQuery.trim() === "" ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.employeeId && u.employeeId.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchTab && matchDept && matchSearch;
  });

  const isOwner = profile?.role === "owner";

  const handleConfirmArchive = async () => {
    if (!archiveTarget || !profile || !isOwner) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await setResearchTrackingStatus(
        archiveTarget.email,
        "ARCHIVED",
        { uid: profile.uid, email: profile.email, role: profile.role }
      );
      setArchiveTarget(null);
      await loadData();
    } catch (err: any) {
      console.error("Error archiving lecturer:", err);
      setActionError(err.message || "Lỗi khi lưu trữ giảng viên.");
    } finally {
      setActionLoading(false);
    }
  };


  const handleConfirmBatchAction = async () => {
    if (!profile || !isOwner || selectedEmails.size === 0) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const targetStatus: ResearchTrackingStatus =
        trackingTab === "ACTIVE" ? "ARCHIVED" : "ACTIVE";

      await setResearchTrackingStatusBatch(
        Array.from(selectedEmails),
        targetStatus,
        { uid: profile.uid, email: profile.email, role: profile.role }
      );

      setSelectedEmails(new Set());
      setIsBatchModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error("Error batch updating research tracking status:", err);
      setActionError(err.message || "Lỗi khi xử lý hàng loạt.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreTarget || !profile || !isOwner) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await setResearchTrackingStatus(
        restoreTarget.email,
        "ACTIVE",
        { uid: profile.uid, email: profile.email, role: profile.role }
      );
      setRestoreTarget(null);
      await loadData();
    } catch (err: any) {
      console.error("Error restoring lecturer:", err);
      setActionError(err.message || "Lỗi khi khôi phục giảng viên.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (!isOwner) return;
    const cols = [
      { header: "Họ và tên", key: "name", width: 25 },
      { header: "Email TDTU", key: "email", width: 28 },
      { header: "Bộ môn / Ngành", key: "department", width: 22 },
      { header: "Học vị", key: "academicDegree", width: 14 },
      { header: "Loại hình GV", key: "lecturerTypeText", width: 20 },
      { header: "Mã NV", key: "employeeId", width: 14 },
      { header: "Vai trò IFA-RH", key: "role", width: 14 },
      { header: "Nhân sự", key: "statusText", width: 16 },
      { header: "Theo dõi NCKH", key: "trackingText", width: 20 },
    ];
    const data = filteredItems.map((u) => ({
      ...u,
      lecturerTypeText: lecturerTypeMap[u.lecturerType] || u.lecturerType,
      statusText: u.active ? "Đang công tác" : "Ngừng công tác",
      trackingText: u.researchTrackingStatus === "ARCHIVED" ? "Lưu trữ NCKH" : "Đang theo dõi",
    }));
    await exportToExcel("Danh-sach-giang-vien-MTCN", "Giảng viên", cols, data);
  };

  const handleExportCsv = () => {
    if (!isOwner) return;
    const cols = [
      { header: "Họ và tên", key: "name" },
      { header: "Email TDTU", key: "email" },
      { header: "Bộ môn / Ngành", key: "department" },
      { header: "Học vị", key: "academicDegree" },
      { header: "Loại hình GV", key: "lecturerTypeText" },
      { header: "Mã NV", key: "employeeId" },
      { header: "Vai trò IFA-RH", key: "role" },
      { header: "Nhân sự", key: "statusText" },
      { header: "Theo dõi NCKH", key: "trackingText" },
    ];
    const data = filteredItems.map((u) => ({
      ...u,
      lecturerTypeText: lecturerTypeMap[u.lecturerType] || u.lecturerType,
      statusText: u.active ? "Đang công tác" : "Ngừng công tác",
      trackingText: u.researchTrackingStatus === "ARCHIVED" ? "Lưu trữ NCKH" : "Đang theo dõi",
    }));
    exportToCsv("Danh-sach-giang-vien-MTCN", cols, data);
  };

  return (
    <div className="app-container" style={{ maxWidth: "100%", paddingLeft: 0, paddingRight: 0 }}>
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.6rem", color: "var(--primary)" }}>Danh bạ Giảng viên MTCN</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: 4 }}>
            Bản sao danh bạ nhân sự phục vụ phân quyền và quản lý Nghiên cứu Khoa học tại IFA-RH
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {isOwner && (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleExportExcel}
                title="Xuất danh sách ra file Excel (Chỉ Owner)"
              >
                <FileSpreadsheet size={15} /> Xuất Excel
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleExportCsv}
                title="Xuất danh sách ra file CSV (Chỉ Owner)"
              >
                <Download size={15} /> Xuất CSV
              </button>
            </>
          )}
          <a
            href="https://ifa-work.web.app/personnel"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
            title="Mở ứng dụng IFA-WORK để quản lý nhân sự gốc"
          >
            <ExternalLink size={14} /> Mở IFA-WORK
          </a>
          {isOwner && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsSyncModalOpen(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              title="Cập nhật danh bạ từ tệp JSON IFA-WORK (Chỉ Owner)"
            >
              <RefreshCw size={14} /> Cập nhật từ IFA-WORK (JSON)
            </button>
          )}
        </div>
      </div>

      {/* Architecture Master/Mirror Banner */}
      <div
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: "14px 18px",
          marginBottom: 16,
          fontSize: "0.875rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 6 }}>
              <Building size={16} color="var(--primary)" /> Nguồn danh bạ gốc: IFA-WORK (Master Personnel Directory)
            </div>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>
              IFA-RH đóng vai trò là bản sao phục vụ NCKH. Để thêm nhân sự mới, điều chuyển bộ môn hoặc thay đổi loại hình giảng viên, vui lòng thao tác trên <strong>IFA-WORK</strong> rồi xuất tệp JSON hoặc chờ GitHub Actions tự động đồng bộ hàng tuần.
            </p>
          </div>
        </div>
      </div>

      {/* Sync Status Banner */}
      {latestSyncLog && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            padding: "10px 16px",
            marginBottom: 20,
            fontSize: "0.85rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#166534" }}>
            <ShieldCheck size={18} style={{ flexShrink: 0 }} />
            <span>
              Đồng bộ lần cuối: <strong>{formatDateVN(latestSyncLog.timestamp)}</strong> ({latestSyncLog.method === "manual_json" ? "Tệp JSON thủ công" : "GitHub Actions"}) bởi <code>{latestSyncLog.triggeredBy}</code>
            </span>
          </div>
          <div style={{ display: "flex", gap: 12, color: "#166534", fontSize: "0.825rem", flexWrap: "wrap" }}>
            <span>Tổng: <strong>{latestSyncLog.totalRecords}</strong></span>
            <span>Mới: <strong style={{ color: "#16a34a" }}>+{latestSyncLog.createdCount}</strong></span>
            <span>Cập nhật: <strong style={{ color: "#2563eb" }}>{latestSyncLog.updatedCount}</strong></span>
            <span>Ngừng CT: <strong style={{ color: "#dc2626" }}>{latestSyncLog.deactivatedCount}</strong></span>
            <span>Kích hoạt lại: <strong style={{ color: "#9333ea" }}>{latestSyncLog.reactivatedCount}</strong></span>
          </div>
        </div>
      )}

      {/* Research Tracking Status Tabs */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 16,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className={`btn ${trackingTab === "ACTIVE" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => { setTrackingTab("ACTIVE"); setSelectedEmails(new Set()); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
        >
          <BookmarkCheck size={16} /> Đang theo dõi NCKH ({activeCount})
        </button>
        <button
          type="button"
          className={`btn ${trackingTab === "ARCHIVED" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => { setTrackingTab("ARCHIVED"); setSelectedEmails(new Set()); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
        >
          <Archive size={16} /> Lưu trữ NCKH ({archivedCount})
        </button>
      </div>

      {/* Notice for Archived Tab */}
      {trackingTab === "ARCHIVED" && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fef3c7",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
            fontSize: "0.875rem",
            color: "#92400e",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>Khu vực Lưu trữ NCKH:</strong> Giảng viên trong mục này được miễn theo dõi nhiệm vụ NCKH (ví dụ: chỉ có trình độ Cử nhân, cơ hữu 2, thỉnh giảng hoặc trường hợp đặc thù). Hồ sơ nhân sự và toàn bộ lịch sử bài báo/NCKH đã công bố vẫn được bảo lưu trọn vẹn.
          </div>
        </div>
      )}

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
              placeholder="Tìm theo họ tên, email, mã nhân viên..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>Bộ môn:</span>
            <select
              className="form-control"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              style={{ width: "auto", minWidth: 180 }}
            >
              <option value="Tất cả">Tất cả bộ môn</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {isOwner && selectedEmails.size > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 16px",
            marginBottom: 14,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 8,
            color: "#1e40af",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <CheckSquare size={18} color="#2563eb" />
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>
              Đã chọn <strong>{selectedEmails.size}</strong> giảng viên
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedEmails(new Set())}
              style={{ fontSize: "0.75rem", padding: "2px 8px" }}
            >
              Bỏ chọn tất cả
            </button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {trackingTab === "ACTIVE" ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setActionError(null);
                  setIsBatchModalOpen(true);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#d97706",
                  borderColor: "#b45309",
                }}
              >
                <Archive size={15} /> Lưu trữ NCKH hàng loạt ({selectedEmails.size})
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setActionError(null);
                  setIsBatchModalOpen(true);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#059669",
                  borderColor: "#047857",
                }}
              >
                <RotateCcw size={15} /> Khôi phục theo dõi hàng loạt ({selectedEmails.size})
              </button>
            )}
          </div>
        </div>
      )}
      {/* Lecturers Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
          Đang tải danh sách giảng viên...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
          <Users size={36} color="var(--muted)" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ color: "var(--primary)", marginBottom: 6 }}>
            {trackingTab === "ARCHIVED" ? "Chưa có giảng viên nào trong mục Lưu trữ NCKH" : "Chưa có giảng viên nào phù hợp"}
          </h3>
          <p style={{ fontSize: "0.9rem", maxWidth: 450, margin: "0 auto 16px" }}>
            {trackingTab === "ARCHIVED"
              ? "Chỉ Owner mới có thể đưa giảng viên vào diện lưu trữ khi không thuộc diện theo dõi NCKH."
              : "Hãy bấm nút 'Cập nhật từ IFA-WORK (JSON)' ở góc trên để nạp danh bạ nhân sự vào IFA-RH."}
          </p>
        </div>
      ) : (
        <div className="table-container" style={{ overflowX: "auto" }}>
          <table className="table-compact">
            <thead>
              <tr>
                {isOwner && (
                  <th style={{ width: 38, textAlign: "center", paddingLeft: 10, paddingRight: 6 }}>
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả giảng viên"
                      checked={filteredItems.length > 0 && selectedEmails.size === filteredItems.length}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate =
                            selectedEmails.size > 0 && selectedEmails.size < filteredItems.length;
                        }
                      }}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEmails(new Set(filteredItems.map((i) => i.email)));
                        } else {
                          setSelectedEmails(new Set());
                        }
                      }}
                      style={{ cursor: "pointer", width: 16, height: 16 }}
                    />
                  </th>
                )}
                <th>Họ và tên</th>
                <th>Email TDTU</th>
                <th>Bộ môn / Ngành</th>
                <th>Học vị</th>
                <th>Loại hình GV</th>
                {isOwner && <th style={{ textAlign: "right" }}>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((lecturer) => {
                const isSuggested = isSuggestedForArchive(lecturer);
                const isSelected = selectedEmails.has(lecturer.email);

                return (
                  <tr
                    key={lecturer.email}
                    style={{
                      opacity: lecturer.active ? 1 : 0.65,
                      background: isSelected ? "rgba(37, 99, 235, 0.05)" : undefined,
                    }}
                  >
                    {isOwner && (
                      <td style={{ width: 38, textAlign: "center", paddingLeft: 10, paddingRight: 6 }}>
                        <input
                          type="checkbox"
                          aria-label={`Chọn ${lecturer.name}`}
                          checked={isSelected}
                          onChange={(e) => {
                            const next = new Set(selectedEmails);
                            if (e.target.checked) {
                              next.add(lecturer.email);
                            } else {
                              next.delete(lecturer.email);
                            }
                            setSelectedEmails(next);
                          }}
                          style={{ cursor: "pointer", width: 16, height: 16 }}
                        />
                      </td>
                    )}
                    <td style={{ minWidth: 140, maxWidth: 200 }}>
                      <div style={{ fontWeight: 600, color: "var(--foreground)", lineHeight: 1.3 }}>
                        {lecturer.name}
                      </div>
                    </td>
                    <td style={{ minWidth: 170, whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.78rem" }}>
                        <Mail size={12} color="var(--muted)" style={{ flexShrink: 0 }} />
                        <span style={{ fontFamily: "monospace" }}>{lecturer.email}</span>
                      </div>
                    </td>
                    <td style={{ minWidth: 120, maxWidth: 160 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 5, fontSize: "0.78rem", lineHeight: 1.3 }}>
                        <Building size={12} color="var(--muted)" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{lecturer.department}</span>
                      </div>
                    </td>
                    <td style={{ minWidth: 70, maxWidth: 100 }}>
                      {lecturer.academicDegree ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.78rem" }}>
                          <GraduationCap size={12} color="var(--muted)" style={{ flexShrink: 0 }} />
                          <span>{lecturer.academicDegree}</span>
                        </div>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                    <td style={{ minWidth: 110, maxWidth: 160 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span className="badge badge-secondary" style={{ fontSize: "0.72rem", padding: "2px 6px", whiteSpace: "normal", lineHeight: 1.25 }}>
                          {lecturerTypeMap[lecturer.lecturerType] || lecturer.lecturerType}
                        </span>
                        {trackingTab === "ACTIVE" && isSuggested && (
                          <span
                            className="badge badge-warning"
                            style={{
                              fontSize: "0.68rem",
                              background: "#fffbeb",
                              color: "#b45309",
                              border: "1px solid #fde68a",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 2,
                              padding: "1px 4px",
                            }}
                            title="Gợi ý: Cử nhân, Cơ hữu 2 hoặc Thỉnh giảng có thể không thuộc diện theo dõi NCKH"
                          >
                            <HelpCircle size={10} /> Gợi ý
                          </span>
                        )}
                        {trackingTab === "ARCHIVED" && lecturer.archivedAt && (
                          <span style={{ fontSize: "0.68rem", color: "var(--muted)" }}>
                            ({formatDateVN(lecturer.archivedAt)})
                          </span>
                        )}
                      </div>
                    </td>
                    {isOwner && (
                      <td style={{ textAlign: "right", whiteSpace: "nowrap", minWidth: 75 }}>
                        {trackingTab === "ACTIVE" ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setArchiveTarget(lecturer);
                              setActionError(null);
                            }}
                            style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.75rem", padding: "3px 7px" }}
                            title="Đưa vào diện lưu trữ NCKH (Chỉ Owner)"
                          >
                            <Archive size={12} /> Lưu trữ
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setRestoreTarget(lecturer);
                              setActionError(null);
                            }}
                            style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.75rem", padding: "3px 7px" }}
                            title="Khôi phục vào diện theo dõi NCKH (Chỉ Owner)"
                          >
                            <RotateCcw size={12} /> Khôi phục
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Archive Lecturer Confirmation Modal - Owner Only */}
      {archiveTarget && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (!actionLoading) {
              setArchiveTarget(null);
              setActionError(null);
            }
          }}
          title="Xác nhận Lưu trữ NCKH Giảng viên"
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, width: "100%" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setArchiveTarget(null);
                  setActionError(null);
                }}
                disabled={actionLoading}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmArchive}
                disabled={actionLoading}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {actionLoading ? (
                  <>
                    <RefreshCw size={15} className="spin-animate" /> Đang lưu trữ...
                  </>
                ) : (
                  <>
                    <Archive size={15} /> Xác nhận lưu trữ
                  </>
                )}
              </button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {actionError && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 6,
                  padding: 10,
                  color: "#991b1b",
                  fontSize: "0.85rem",
                }}
              >
                {actionError}
              </div>
            )}

            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 14,
                fontSize: "0.875rem",
                lineHeight: 1.6,
              }}
            >
              <div><strong>Họ và tên:</strong> {archiveTarget.name}</div>
              <div><strong>Email TDTU:</strong> <code>{archiveTarget.email}</code></div>
              <div><strong>Đơn vị / Ngành:</strong> {archiveTarget.department}</div>
              <div><strong>Học vị:</strong> {archiveTarget.academicDegree || "—"}</div>
              <div><strong>Loại hình:</strong> {lecturerTypeMap[archiveTarget.lecturerType] || archiveTarget.lecturerType}</div>
            </div>

            <div
              style={{
                background: "#f0f9ff",
                border: "1px solid #bae6fd",
                borderRadius: 8,
                padding: 12,
                fontSize: "0.85rem",
                color: "#0369a1",
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <Info size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Chính sách an toàn & Bảo toàn dữ liệu:</strong>
                <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
                  <li>Giảng viên sẽ được chuyển sang tab <strong>"Lưu trữ NCKH"</strong> và miễn theo dõi KPI nghiên cứu.</li>
                  <li><strong>Không xóa dữ liệu:</strong> Hồ sơ nhân sự và toàn bộ công trình NCKH đã có vẫn được bảo lưu trọn vẹn.</li>
                  <li>Chủ sở hữu (Owner) có thể <strong>khôi phục lại bất kỳ lúc nào</strong>.</li>
                </ul>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Restore Lecturer Confirmation Modal - Owner Only */}
      {restoreTarget && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (!actionLoading) {
              setRestoreTarget(null);
              setActionError(null);
            }
          }}
          title="Xác nhận Khôi phục Theo dõi NCKH"
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, width: "100%" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setRestoreTarget(null);
                  setActionError(null);
                }}
                disabled={actionLoading}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmRestore}
                disabled={actionLoading}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {actionLoading ? (
                  <>
                    <RefreshCw size={15} className="spin-animate" /> Đang khôi phục...
                  </>
                ) : (
                  <>
                    <RotateCcw size={15} /> Xác nhận khôi phục
                  </>
                )}
              </button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {actionError && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 6,
                  padding: 10,
                  color: "#991b1b",
                  fontSize: "0.85rem",
                }}
              >
                {actionError}
              </div>
            )}

            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 14,
                fontSize: "0.875rem",
                lineHeight: 1.6,
              }}
            >
              <div><strong>Họ và tên:</strong> {restoreTarget.name}</div>
              <div><strong>Email TDTU:</strong> <code>{restoreTarget.email}</code></div>
              <div><strong>Đơn vị / Ngành:</strong> {restoreTarget.department}</div>
            </div>

            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 8,
                padding: 12,
                fontSize: "0.85rem",
                color: "#166534",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <span>
                Giảng viên sẽ được chuyển trở lại tab <strong>"Đang theo dõi NCKH"</strong> và đưa vào thống kê KPI giảng viên NCKH hiện hành.
              </span>
            </div>
          </div>
        </Modal>
      )}


      {/* Batch Archive / Restore Confirmation Modal - Owner Only */}
      {isBatchModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (!actionLoading) {
              setIsBatchModalOpen(false);
              setActionError(null);
            }
          }}
          title={
            trackingTab === "ACTIVE"
              ? `Xác nhận Lưu trữ NCKH hàng loạt (${selectedEmails.size} giảng viên)`
              : `Xác nhận Khôi phục theo dõi NCKH hàng loạt (${selectedEmails.size} giảng viên)`
          }
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, width: "100%" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsBatchModalOpen(false);
                  setActionError(null);
                }}
                disabled={actionLoading}
              >
                Hủy
              </button>
              <button
                type="button"
                className={`btn ${trackingTab === "ACTIVE" ? "btn-danger" : "btn-primary"}`}
                onClick={handleConfirmBatchAction}
                disabled={actionLoading}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {actionLoading ? (
                  <>
                    <RefreshCw size={15} className="spin-animate" /> Đang xử lý...
                  </>
                ) : trackingTab === "ACTIVE" ? (
                  <>
                    <Archive size={15} /> Xác nhận lưu trữ (${selectedEmails.size} GV)
                  </>
                ) : (
                  <>
                    <RotateCcw size={15} /> Xác nhận khôi phục (${selectedEmails.size} GV)
                  </>
                )}
              </button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {actionError && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 6,
                  padding: 10,
                  color: "#991b1b",
                  fontSize: "0.85rem",
                }}
              >
                {actionError}
              </div>
            )}

            <p style={{ fontSize: "0.9rem", margin: 0 }}>
              {trackingTab === "ACTIVE" ? (
                <>
                  Bạn đang chọn <strong>{selectedEmails.size} giảng viên</strong> để đưa vào diện <strong>Lưu trữ NCKH</strong>. Các giảng viên này sẽ được miễn chỉ tiêu theo dõi NCKH (tiến độ, hồ sơ, thống kê) trong IFA-RH.
                </>
              ) : (
                <>
                  Bạn đang chọn <strong>{selectedEmails.size} giảng viên</strong> để <strong>Khôi phục theo dõi NCKH</strong>. Các giảng viên này sẽ quay trở lại danh sách theo dõi tiến độ và báo cáo NCKH.
                </>
              )}
            </p>

            {/* List of Selected Lecturers */}
            <div
              style={{
                maxHeight: 220,
                overflowY: "auto",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: "0.825rem",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Array.from(selectedEmails).map((email, idx) => {
                  const item = items.find((i) => i.email === email);
                  return (
                    <div
                      key={email}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottom: idx < selectedEmails.size - 1 ? "1px solid #f1f5f9" : "none",
                        paddingBottom: 4,
                      }}
                    >
                      <div>
                        <strong>{item?.name || email}</strong>
                        <span style={{ color: "var(--muted)", marginLeft: 6, fontSize: "0.78rem" }}>
                          ({email})
                        </span>
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                        {item?.department || ""} · {item?.academicDegree || "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                background: trackingTab === "ACTIVE" ? "#f0f9ff" : "#f0fdf4",
                border: `1px solid ${trackingTab === "ACTIVE" ? "#bae6fd" : "#bbf7d0"}`,
                borderRadius: 8,
                padding: 12,
                fontSize: "0.85rem",
                color: trackingTab === "ACTIVE" ? "#0369a1" : "#166534",
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <Info size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Chính sách an toàn & Bảo toàn dữ liệu:</strong>
                <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
                  <li><strong>Không xóa dữ liệu:</strong> Hồ sơ nhân sự và toàn bộ công trình NCKH đã có của các giảng viên vẫn được bảo lưu trọn vẹn.</li>
                  <li>Chủ sở hữu (Owner) có thể <strong>khôi phục lại bất kỳ lúc nào</strong>.</li>
                </ul>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* JSON Sync Modal - Owner only */}
      {isOwner && (
        <PersonnelJsonSyncModal
          isOpen={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
          onSuccess={async () => {
            await loadData();
          }}
          existingPersonnel={rawShared}
          actor={{ uid: profile.uid, email: profile.email, role: profile.role }}
        />
      )}
    </div>
  );
};
