import React, { useState, useEffect } from "react";
import { useAuth } from "../firebase/auth";
import {
  fetchAllUsers,
  fetchSharedPersonnel,
  fetchLatestPersonnelSyncLog,
} from "../firebase/firestore";
import type { UserProfile, SharedPersonnelRecord, PersonnelSyncLog } from "../types";
import { PersonnelJsonSyncModal } from "../components/PersonnelJsonSyncModal";
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

  // Modals
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sharedList, usersList, syncLog] = await Promise.all([
        fetchSharedPersonnel(),
        fetchAllUsers(),
        fetchLatestPersonnelSyncLog(),
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
              });
            } else if ((u.role === "admin" || u.role === "owner") && existing.role === "lecturer") {
              itemMap.set(emailNorm, {
                ...existing,
                role: u.role,
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

  const filteredItems = items.filter((u) => {
    const matchDept = departmentFilter === "Tất cả" || u.department === departmentFilter;
    const matchSearch =
      searchQuery.trim() === "" ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.employeeId && u.employeeId.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && u.active) ||
      (statusFilter === "INACTIVE" && !u.active);

    return matchDept && matchSearch && matchStatus;
  });

  const isOwner = profile?.role === "owner";

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
      { header: "Trạng thái", key: "statusText", width: 16 },
    ];
    const data = filteredItems.map((u) => ({
      ...u,
      lecturerTypeText: lecturerTypeMap[u.lecturerType] || u.lecturerType,
      statusText: u.active ? "Đang công tác" : "Ngừng công tác",
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
      { header: "Trạng thái", key: "statusText" },
    ];
    const data = filteredItems.map((u) => ({
      ...u,
      lecturerTypeText: lecturerTypeMap[u.lecturerType] || u.lecturerType,
      statusText: u.active ? "Đang công tác" : "Ngừng công tác",
    }));
    exportToCsv("Danh-sach-giang-vien-MTCN", cols, data);
  };

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
              style={{ width: "auto" }}
            >
              <option value="Tất cả">Tất cả bộ môn</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>Trạng thái:</span>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{ width: "auto" }}
            >
              <option value="ALL">Tất cả ({items.length})</option>
              <option value="ACTIVE">Đang công tác ({items.filter(i => i.active).length})</option>
              <option value="INACTIVE">Ngừng công tác ({items.filter(i => !i.active).length})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lecturers Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
          Đang tải danh sách giảng viên...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
          <Users size={36} color="var(--muted)" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ color: "var(--primary)", marginBottom: 6 }}>Chưa có giảng viên nào phù hợp</h3>
          <p style={{ fontSize: "0.9rem", maxWidth: 450, margin: "0 auto 16px" }}>
            Hãy bấm nút <strong>"Cập nhật từ IFA-WORK (JSON)"</strong> ở góc trên để nạp danh bạ nhân sự vào IFA-RH.
          </p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Họ và tên</th>
                <th>Mã NV</th>
                <th>Email TDTU</th>
                <th>Bộ môn / Ngành</th>
                <th>Học vị</th>
                <th>Loại hình GV</th>
                <th>Vai trò IFA-RH</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((lecturer) => {
                let roleBadge = <span className="badge badge-secondary">Giảng viên</span>;
                if (lecturer.role === "owner") {
                  roleBadge = <span className="badge badge-primary">Chủ sở hữu</span>;
                } else if (lecturer.role === "admin") {
                  roleBadge = <span className="badge badge-info">Admin</span>;
                }

                return (
                  <tr key={lecturer.email} style={{ opacity: lecturer.active ? 1 : 0.65 }}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--foreground)" }}>
                        {lecturer.name}
                      </div>
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "var(--muted)" }}>
                      {lecturer.employeeId || "—"}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.875rem" }}>
                        <Mail size={13} color="var(--muted)" />
                        <span style={{ fontFamily: "monospace" }}>{lecturer.email}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Building size={13} color="var(--muted)" />
                        <span>{lecturer.department}</span>
                      </div>
                    </td>
                    <td>
                      {lecturer.academicDegree ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <GraduationCap size={13} color="var(--muted)" />
                          <span>{lecturer.academicDegree}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span className="badge badge-secondary" style={{ fontSize: "0.75rem" }}>
                        {lecturerTypeMap[lecturer.lecturerType] || lecturer.lecturerType}
                      </span>
                    </td>
                    <td>{roleBadge}</td>
                    <td>
                      {lecturer.active ? (
                        <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <CheckCircle2 size={12} /> Đang công tác
                        </span>
                      ) : (
                        <span className="badge badge-danger" style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title="Lịch sử NCKH luôn được bảo lưu">
                          <XCircle size={12} /> Ngừng công tác
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
