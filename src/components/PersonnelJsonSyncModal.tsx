import React, { useState } from "react";
import type {
  SharedPersonnelRecord,
  SharedPersonnelExportPayload,
  PersonnelSyncLog,
  UserRole,
} from "../types";
import { Modal } from "./Modal";
import { syncSharedPersonnelBatch } from "../firebase/firestore";
import { formatDateVN } from "../utils/date";
import {
  Upload,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Users,
  Check,
  RefreshCw,
  Info,
  ShieldCheck,
  UserPlus,
  UserMinus,
  Sparkles,
} from "lucide-react";

interface PersonnelJsonSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (log: PersonnelSyncLog) => Promise<void>;
  existingPersonnel: SharedPersonnelRecord[];
  actor: { uid: string; email: string; role: UserRole };
}

interface DiffItem {
  record: SharedPersonnelRecord;
  status: "create" | "update" | "unchanged" | "deactivate" | "reactivate";
  changes: string[];
}

export const PersonnelJsonSyncModal: React.FC<PersonnelJsonSyncModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingPersonnel,
  actor,
}) => {
  const [step, setStep] = useState<"upload" | "preview" | "syncing" | "done">("upload");
  const [fileName, setFileName] = useState("");
  const [payload, setPayload] = useState<SharedPersonnelExportPayload | null>(null);
  const [diffItems, setDiffItems] = useState<DiffItem[]>([]);
  const [filterTab, setFilterTab] = useState<"all" | "changes" | "create" | "deactivate">("all");
  const [syncing, setSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultLog, setResultLog] = useState<PersonnelSyncLog | null>(null);

  const resetState = () => {
    setStep("upload");
    setFileName("");
    setPayload(null);
    setDiffItems([]);
    setFilterTab("all");
    setSyncing(false);
    setErrorMsg(null);
    setResultLog(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setFileName(file.name);

    try {
      const text = await file.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch (parseErr) {
        throw new Error("Tệp không đúng định dạng JSON hợp lệ.");
      }

      // Validate root schema
      if (!json || typeof json !== "object") {
        throw new Error("Nội dung tệp JSON không hợp lệ.");
      }
      if (json.schemaVersion !== 1) {
        throw new Error(
          `Phiên bản schema không được hỗ trợ (${json.schemaVersion ?? "không có"}). Yêu cầu schemaVersion: 1.`
        );
      }
      if (json.source !== "IFA-WORK") {
        throw new Error(
          `Nguồn tệp không hợp lệ (${json.source ?? "không rõ"}). Tệp phải được xuất từ hệ thống IFA-WORK.`
        );
      }
      if (!Array.isArray(json.personnel)) {
        throw new Error("Trường 'personnel' trong tệp JSON phải là một mảng danh sách nhân sự.");
      }

      const rawList = json.personnel as any[];
      if (rawList.length === 0) {
        throw new Error("Tệp danh bạ không chứa bất kỳ bản ghi nhân sự nào.");
      }

      // Build existing lookup map by emailNormalized
      const existingMap = new Map<string, SharedPersonnelRecord>();
      existingPersonnel.forEach((p) => {
        const key = (p.emailNormalized || p.displayName || "").trim().toLowerCase();
        if (key) existingMap.set(key, p);
      });

      const parsedRecords: SharedPersonnelRecord[] = [];
      const computedDiffs: DiffItem[] = [];

      for (let i = 0; i < rawList.length; i++) {
        const item = rawList[i];
        const email = String(item.emailNormalized || item.email || "").trim().toLowerCase();
        const displayName = String(item.displayName || item.name || "").trim();

        if (!email || !email.endsWith("@tdtu.edu.vn")) {
          throw new Error(
            `Dòng #${i + 1}: Email "${email}" không hợp lệ hoặc không thuộc tên miền @tdtu.edu.vn.`
          );
        }
        if (!displayName) {
          throw new Error(`Dòng #${i + 1} (${email}): Họ tên không được để trống.`);
        }

        const validRecord: SharedPersonnelRecord = {
          emailNormalized: email,
          displayName,
          departmentId: String(item.departmentId || "").trim(),
          departmentName: String(item.departmentName || item.department || "Chưa phân ngành").trim(),
          lecturerType: String(item.lecturerType || "lecturer").trim(),
          academicDegree: String(item.academicDegree || item.title || "").trim(),
          employeeId: item.employeeId ? String(item.employeeId).trim() : undefined,
          active: Boolean(item.active !== false),
          inactiveAt: item.inactiveAt || null,
          sourceUpdatedAt: item.sourceUpdatedAt || new Date().toISOString(),
          sharedUpdatedAt: new Date().toISOString(),
        };

        parsedRecords.push(validRecord);

        // Diff computation
        const existing = existingMap.get(email);
        if (!existing) {
          computedDiffs.push({
            record: validRecord,
            status: "create",
            changes: ["Hồ sơ mới hoàn toàn"],
          });
        } else {
          const changes: string[] = [];
          if (existing.displayName !== validRecord.displayName) {
            changes.push(`Họ tên: "${existing.displayName}" -> "${validRecord.displayName}"`);
          }
          if (existing.departmentName !== validRecord.departmentName) {
            changes.push(`Đơn vị: "${existing.departmentName}" -> "${validRecord.departmentName}"`);
          }
          if (existing.academicDegree !== validRecord.academicDegree) {
            changes.push(`Học vị: "${existing.academicDegree || "—"}" -> "${validRecord.academicDegree || "—"}"`);
          }
          if (existing.lecturerType !== validRecord.lecturerType) {
            changes.push(`Loại GV: "${existing.lecturerType}" -> "${validRecord.lecturerType}"`);
          }
          if ((existing.employeeId || "") !== (validRecord.employeeId || "")) {
            changes.push(`Mã NV: "${existing.employeeId || "—"}" -> "${validRecord.employeeId || "—"}"`);
          }

          let status: DiffItem["status"] = "unchanged";
          if (existing.active === true && validRecord.active === false) {
            status = "deactivate";
            changes.unshift("Chuyển trạng thái: Ngừng công tác (Inactive)");
          } else if (existing.active === false && validRecord.active === true) {
            status = "reactivate";
            changes.unshift("Chuyển trạng thái: Kích hoạt lại (Active)");
          } else if (changes.length > 0) {
            status = "update";
          }

          computedDiffs.push({
            record: validRecord,
            status,
            changes,
          });
        }
      }

      setPayload({
        schemaVersion: 1,
        source: "IFA-WORK",
        generatedAt: json.generatedAt || new Date().toISOString(),
        totalRecords: parsedRecords.length,
        personnel: parsedRecords,
      });
      setDiffItems(computedDiffs);
      setStep("preview");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Không thể đọc tệp danh bạ JSON.");
    }
  };

  const handleApplySync = async () => {
    if (!payload || !payload.personnel.length) return;
    if (actor.role !== "owner") {
      setErrorMsg("Chỉ Owner mới có quyền cập nhật danh bạ từ IFA-WORK.");
      return;
    }
    setSyncing(true);
    setStep("syncing");
    setErrorMsg(null);

    try {
      const log = await syncSharedPersonnelBatch(
        payload.personnel,
        fileName || "IFA-PERSONNEL.json",
        actor
      );
      setResultLog(log);
      setStep("done");
      await onSuccess(log);
    } catch (err: any) {
      console.error("Sync error:", err);
      setErrorMsg(err.message || "Lỗi khi đồng bộ dữ liệu vào Firestore.");
      setStep("preview");
    } finally {
      setSyncing(false);
    }
  };

  // Diff stats
  const countCreate = diffItems.filter((d) => d.status === "create").length;
  const countUpdate = diffItems.filter((d) => d.status === "update").length;
  const countDeactivate = diffItems.filter((d) => d.status === "deactivate").length;
  const countReactivate = diffItems.filter((d) => d.status === "reactivate").length;
  const countUnchanged = diffItems.filter((d) => d.status === "unchanged").length;

  const filteredItems = diffItems.filter((d) => {
    if (filterTab === "all") return true;
    if (filterTab === "changes") return d.status !== "unchanged";
    if (filterTab === "create") return d.status === "create";
    if (filterTab === "deactivate") return d.status === "deactivate" || d.status === "reactivate";
    return true;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Cập nhật Danh bạ Giảng viên từ IFA-WORK"
      maxWidth="large"
      footer={
        step === "preview" ? (
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStep("upload")}
              disabled={syncing}
            >
              Chọn tệp khác
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClose}
                disabled={syncing}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleApplySync}
                disabled={syncing || diffItems.length === 0}
              >
                {syncing ? (
                  <>
                    <RefreshCw size={16} className="spin-animate" /> Đang đồng bộ...
                  </>
                ) : (
                  <>
                    <Check size={16} /> Xác nhận đồng bộ ({diffItems.length} bản ghi)
                  </>
                )}
              </button>
            </div>
          </div>
        ) : step === "done" ? (
          <button type="button" className="btn btn-primary" onClick={handleClose}>
            Hoàn tất & Đóng
          </button>
        ) : undefined
      }
    >
      {/* STEP 1: UPLOAD JSON FILE */}
      {step === "upload" && (
        <div style={{ padding: "12px 0" }}>
          <div
            style={{
              background: "#f0f9ff",
              border: "1px solid #bae6fd",
              borderRadius: 8,
              padding: 16,
              marginBottom: 20,
              fontSize: "0.875rem",
              color: "#0369a1",
              lineHeight: 1.6,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginBottom: 4 }}>
              <Info size={18} /> Cơ chế đồng bộ nhân sự IFA-WORK (Master) &rarr; IFA-RH (Mirror)
            </div>
            Danh bạ Giảng viên được quản lý tập trung tại <strong>IFA-WORK</strong>. Để cập nhật vào IFA-RH:
            <ol style={{ margin: "8px 0 0 20px", padding: 0 }}>
              <li>
                Mở <strong>IFA-WORK</strong> &rarr; trang <em>Nhân sự</em> &rarr; bấm <strong>"Xuất danh bạ dùng chung"</strong> để tải về tệp <code>IFA-PERSONNEL.json</code>.
              </li>
              <li>Chọn và tải tệp JSON đó vào khung bên dưới.</li>
              <li>Hệ thống sẽ đối soát (diff preview) và cho bạn xem trước các thay đổi trước khi ghi dữ liệu.</li>
            </ol>
          </div>

          {errorMsg && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: 12,
                color: "#991b1b",
                fontSize: "0.875rem",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <XCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div
            style={{
              border: "2px dashed var(--border)",
              borderRadius: 12,
              padding: "48px 24px",
              textAlign: "center",
              background: "var(--surface)",
              cursor: "pointer",
            }}
            onClick={() => document.getElementById("personnel-json-file-input")?.click()}
          >
            <FileJson size={48} color="var(--primary)" style={{ margin: "0 auto 12px" }} />
            <h4 style={{ margin: "0 0 6px", color: "var(--foreground)" }}>
              Chọn tệp IFA-PERSONNEL.json
            </h4>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>
              Nhấp để duyệt tệp từ máy tính của bạn (định dạng .json, schemaVersion: 1)
            </p>
            <input
              id="personnel-json-file-input"
              type="file"
              accept=".json,application/json"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </div>
        </div>
      )}

      {/* STEP 2: DIFF PREVIEW */}
      {step === "preview" && payload && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Metadata Card */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "var(--surface)",
              padding: "12px 16px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: "0.875rem",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div>
              <span style={{ color: "var(--muted)" }}>Tệp: </span>
              <strong>{fileName}</strong>
            </div>
            <div>
              <span style={{ color: "var(--muted)" }}>Nguồn: </span>
              <span className="badge badge-info">{payload.source} (v{payload.schemaVersion})</span>
            </div>
            <div>
              <span style={{ color: "var(--muted)" }}>Xuất lúc: </span>
              <strong>{formatDateVN(payload.generatedAt)}</strong>
            </div>
          </div>

          {/* Safety Rule Notice */}
          <div
            style={{
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: "0.85rem",
              color: "#065f46",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <ShieldCheck size={18} style={{ flexShrink: 0 }} />
            <span>
              <strong>Chính sách an toàn:</strong> Giảng viên hiện có trong IFA-RH nhưng không có tên trong tệp này sẽ được <strong>giữ nguyên</strong> (không tự ý vô hiệu hóa). Lịch sử NCKH luôn được bảo lưu tuyệt đối.
            </span>
          </div>

          {/* KPI Summary Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: 10,
            }}
          >
            <div className="card" style={{ padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Tổng trong file</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--foreground)" }}>{payload.totalRecords}</div>
            </div>
            <div className="card" style={{ padding: "10px 12px", textAlign: "center", borderColor: countCreate > 0 ? "#86efac" : undefined }}>
              <div style={{ fontSize: "0.75rem", color: "#16a34a", textTransform: "uppercase" }}>Mới (Thêm)</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#16a34a" }}>+{countCreate}</div>
            </div>
            <div className="card" style={{ padding: "10px 12px", textAlign: "center", borderColor: countUpdate > 0 ? "#93c5fd" : undefined }}>
              <div style={{ fontSize: "0.75rem", color: "#2563eb", textTransform: "uppercase" }}>Cập nhật</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#2563eb" }}>{countUpdate}</div>
            </div>
            <div className="card" style={{ padding: "10px 12px", textAlign: "center", borderColor: countDeactivate > 0 ? "#fca5a5" : undefined }}>
              <div style={{ fontSize: "0.75rem", color: "#dc2626", textTransform: "uppercase" }}>Ngừng CT</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#dc2626" }}>{countDeactivate}</div>
            </div>
            <div className="card" style={{ padding: "10px 12px", textAlign: "center", borderColor: countReactivate > 0 ? "#d8b4fe" : undefined }}>
              <div style={{ fontSize: "0.75rem", color: "#9333ea", textTransform: "uppercase" }}>Tái kích hoạt</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#9333ea" }}>{countReactivate}</div>
            </div>
            <div className="card" style={{ padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Không đổi</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--muted)" }}>{countUnchanged}</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
            <button
              type="button"
              className={`btn btn-sm ${filterTab === "all" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFilterTab("all")}
            >
              Tất cả ({diffItems.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${filterTab === "changes" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFilterTab("changes")}
            >
              Có thay đổi ({countCreate + countUpdate + countDeactivate + countReactivate})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${filterTab === "create" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFilterTab("create")}
            >
              Thêm mới ({countCreate})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${filterTab === "deactivate" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFilterTab("deactivate")}
            >
              Trạng thái ({countDeactivate + countReactivate})
            </button>
          </div>

          {/* Preview Table */}
          <div className="table-container" style={{ maxHeight: 340, overflowY: "auto" }}>
            <table className="table" style={{ fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Trạng thái</th>
                  <th>Họ và tên</th>
                  <th>Email TDTU</th>
                  <th>Đơn vị / Ngành</th>
                  <th>Học vị</th>
                  <th>Chi tiết thay đổi</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  let badge = <span className="badge badge-secondary">Không đổi</span>;
                  if (item.status === "create") {
                    badge = <span className="badge badge-success">+ Tạo mới</span>;
                  } else if (item.status === "update") {
                    badge = <span className="badge badge-info">Cập nhật</span>;
                  } else if (item.status === "deactivate") {
                    badge = <span className="badge badge-danger">Ngừng CT</span>;
                  } else if (item.status === "reactivate") {
                    badge = <span className="badge badge-warning">Kích hoạt</span>;
                  }

                  return (
                    <tr key={item.record.emailNormalized}>
                      <td>{badge}</td>
                      <td>
                        <strong>{item.record.displayName}</strong>
                        {!item.record.active && (
                          <span style={{ color: "#dc2626", fontSize: "0.75rem", marginLeft: 6 }}>
                            (Nghỉ)
                          </span>
                        )}
                      </td>
                      <td style={{ color: "var(--muted)", fontFamily: "monospace" }}>
                        {item.record.emailNormalized}
                      </td>
                      <td>{item.record.departmentName}</td>
                      <td>{item.record.academicDegree || "—"}</td>
                      <td style={{ maxWidth: 220 }}>
                        {item.changes.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: 14, color: "var(--foreground)" }}>
                            {item.changes.map((c, i) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ul>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>Dữ liệu khớp hoàn toàn</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STEP 3: SYNCING IN PROGRESS */}
      {step === "syncing" && (
        <div style={{ textAlign: "center", padding: "48px 24px" }}>
          <RefreshCw size={42} className="spin-animate" color="var(--primary)" style={{ margin: "0 auto 16px" }} />
          <h3 style={{ margin: "0 0 8px", color: "var(--foreground)" }}>Đang đồng bộ danh bạ vào IFA-RH...</h3>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
            Hệ thống đang ghi dữ liệu vào Firestore collection <code>sharedPersonnel</code> và lập nhật ký kiểm toán.
          </p>
        </div>
      )}

      {/* STEP 4: DONE */}
      {step === "done" && resultLog && (
        <div style={{ textAlign: "center", padding: "32px 16px" }}>
          <CheckCircle2 size={56} color="#16a34a" style={{ margin: "0 auto 16px" }} />
          <h3 style={{ margin: "0 0 8px", color: "var(--foreground)" }}>Đồng bộ danh bạ thành công!</h3>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: 24 }}>
            Đã đồng bộ {resultLog.totalRecords} bản ghi từ IFA-WORK vào IFA-RH trong {resultLog.durationMs ?? 0}ms.
          </p>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 16,
              maxWidth: 420,
              margin: "0 auto",
              textAlign: "left",
              fontSize: "0.875rem",
              lineHeight: 1.8,
            }}
          >
            <div><strong>Thời gian:</strong> {formatDateVN(resultLog.timestamp)}</div>
            <div><strong>Phương thức:</strong> {resultLog.method === "manual_json" ? "Tệp JSON thủ công" : "GitHub Action"}</div>
            <div><strong>Tạo mới:</strong> <span style={{ color: "#16a34a", fontWeight: 700 }}>+{resultLog.createdCount}</span></div>
            <div><strong>Cập nhật:</strong> <span style={{ color: "#2563eb", fontWeight: 700 }}>{resultLog.updatedCount}</span></div>
            <div><strong>Ngừng công tác:</strong> <span style={{ color: "#dc2626", fontWeight: 700 }}>{resultLog.deactivatedCount}</span></div>
            <div><strong>Kích hoạt lại:</strong> <span style={{ color: "#9333ea", fontWeight: 700 }}>{resultLog.reactivatedCount}</span></div>
            <div><strong>Không đổi:</strong> {resultLog.unchangedCount}</div>
          </div>
        </div>
      )}
    </Modal>
  );
};
