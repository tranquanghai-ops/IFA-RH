import React, { useState } from "react";
import type { UserProfile, UserRole } from "../types";
import { Modal } from "./Modal";
import { parseSpreadsheetFile } from "../utils/excel";
import { createOrProvisionUser, recordImportBatch } from "../firebase/firestore";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Users,
  Check,
  RefreshCw,
} from "lucide-react";

interface LecturerImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  existingUsers: UserProfile[];
  actor: { uid: string; email: string; role: UserRole };
}

interface RowItem {
  rowIndex: number;
  name: string;
  email: string;
  department: string;
  academicDegree: string;
  isValid: boolean;
  isDuplicate: boolean;
  reason?: string;
}

export const LecturerImportModal: React.FC<LecturerImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingUsers,
  actor,
}) => {
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<RowItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<{
    total: number;
    success: number;
    skipped: number;
    errorCount: number;
    errors: string[];
  } | null>(null);

  const resetState = () => {
    setStep("upload");
    setFileName("");
    setRows([]);
    setImporting(false);
    setReport(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setFileName(file.name);
      const parsed = await parseSpreadsheetFile(file);

      const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));

      const processed: RowItem[] = parsed.rows.map((r) => {
        const name = String(
          r["Họ tên"] || r["Họ và tên"] || r["Tên"] || r["name"] || ""
        ).trim();
        const rawEmail = String(
          r["Email"] || r["Email TDTU"] || r["email"] || ""
        ).trim().toLowerCase();
        const dept = String(
          r["Bộ môn"] || r["Ngành"] || r["department"] || "Khoa MTCN"
        ).trim();
        const degree = String(
          r["Học vị"] || r["academicDegree"] || "ThS"
        ).trim();

        if (!name) {
          return {
            rowIndex: r._rowIndex,
            name,
            email: rawEmail,
            department: dept,
            academicDegree: degree,
            isValid: false,
            isDuplicate: false,
            reason: "Thiếu họ và tên",
          };
        }

        if (!rawEmail || !rawEmail.includes("@")) {
          return {
            rowIndex: r._rowIndex,
            name,
            email: rawEmail,
            department: dept,
            academicDegree: degree,
            isValid: false,
            isDuplicate: false,
            reason: "Email không hợp lệ",
          };
        }

        if (!rawEmail.endsWith("@tdtu.edu.vn")) {
          return {
            rowIndex: r._rowIndex,
            name,
            email: rawEmail,
            department: dept,
            academicDegree: degree,
            isValid: false,
            isDuplicate: false,
            reason: "Không phải email @tdtu.edu.vn",
          };
        }

        if (existingEmails.has(rawEmail)) {
          return {
            rowIndex: r._rowIndex,
            name,
            email: rawEmail,
            department: dept,
            academicDegree: degree,
            isValid: false,
            isDuplicate: true,
            reason: "Email đã tồn tại trong hệ thống (Bỏ qua)",
          };
        }

        return {
          rowIndex: r._rowIndex,
          name,
          email: rawEmail,
          department: dept,
          academicDegree: degree,
          isValid: true,
          isDuplicate: false,
        };
      });

      setRows(processed);
      setStep("preview");
    } catch (err: any) {
      alert("Lỗi đọc file: " + err.message);
    } finally {
      e.target.value = "";
    }
  };

  const validRows = rows.filter((r) => r.isValid && !r.isDuplicate);
  const duplicateRows = rows.filter((r) => r.isDuplicate);
  const invalidRows = rows.filter((r) => !r.isValid && !r.isDuplicate);

  const handleExecuteImport = async () => {
    setImporting(true);
    setStep("importing");

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const r of validRows) {
      try {
        await createOrProvisionUser(
          {
            name: r.name,
            email: r.email,
            role: "lecturer",
            department: r.department,
            academicDegree: r.academicDegree,
            active: true,
          },
          actor
        );
        success++;
      } catch (err: any) {
        failed++;
        errors.push(`Dòng ${r.rowIndex} (${r.email}): ${err.message}`);
      }
    }

    // Record batch log
    try {
      await recordImportBatch(
        {
          id: `imp_lec_${Date.now()}`,
          timestamp: new Date().toISOString(),
          importedBy: actor.email,
          fileName,
          type: "lecturers",
          totalRows: rows.length,
          successCount: success,
          errorCount: failed + invalidRows.length,
          skippedCount: duplicateRows.length,
          errors: errors.map((err, idx) => ({ row: idx + 1, reason: err })),
        },
        actor
      );
    } catch (err) {
      console.warn("Failed to record import batch:", err);
    }

    setReport({
      total: rows.length,
      success,
      skipped: duplicateRows.length,
      errorCount: failed + invalidRows.length,
      errors,
    });

    setImporting(false);
    setStep("done");
    await onSuccess();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Quy trình Import Danh sách Giảng viên (Excel / CSV)"
      maxWidth="large"
    >
      {/* STEP 1: UPLOAD */}
      {step === "upload" && (
        <div style={{ textAlign: "center", padding: "32px 16px" }}>
          <FileSpreadsheet size={48} color="var(--primary)" style={{ margin: "0 auto 16px" }} />
          <h3 style={{ color: "var(--primary)", marginBottom: 8 }}>
            Tải lên bảng tính danh sách nhân sự Giảng viên
          </h3>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", maxWidth: 480, margin: "0 auto 20px" }}>
            File cần chứa các cột: <strong>Họ tên</strong>, <strong>Email</strong> (@tdtu.edu.vn),{" "}
            <strong>Bộ môn</strong>, <strong>Học vị</strong>.
          </p>

          <label className="btn btn-primary" style={{ cursor: "pointer", display: "inline-flex" }}>
            <Upload size={16} /> Chọn tệp Excel (.xlsx) hoặc .csv
            <input
              type="file"
              accept=".xlsx,.csv"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </label>
        </div>
      )}

      {/* STEP 2: PREVIEW & VALIDATION */}
      {step === "preview" && (
        <div>
          {/* Summary KPI Badges */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>{rows.length}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Tổng số dòng</div>
            </div>
            <div style={{ background: "#dcfce7", color: "#166534", padding: 12, borderRadius: 8, border: "1px solid #bbf7d0" }}>
              <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>{validRows.length}</div>
              <div style={{ fontSize: "0.75rem" }}>Hợp lệ (Sẵn sàng nạp)</div>
            </div>
            <div style={{ background: "#fef3c7", color: "#92400e", padding: 12, borderRadius: 8, border: "1px solid #fde68a" }}>
              <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>{duplicateRows.length}</div>
              <div style={{ fontSize: "0.75rem" }}>Trùng email (Bỏ qua)</div>
            </div>
            <div style={{ background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 8, border: "1px solid #fecaca" }}>
              <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>{invalidRows.length}</div>
              <div style={{ fontSize: "0.75rem" }}>Lỗi định dạng</div>
            </div>
          </div>

          {/* Detailed Preview Table */}
          <div className="table-container" style={{ maxHeight: 320, overflowY: "auto", marginBottom: 20 }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 50 }}>Dòng</th>
                  <th>Họ và tên</th>
                  <th>Email TDTU</th>
                  <th>Bộ môn</th>
                  <th>Học vị</th>
                  <th>Trạng thái kiểm tra</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.rowIndex}>
                    <td>#{r.rowIndex}</td>
                    <td style={{ fontWeight: 600 }}>{r.name || "—"}</td>
                    <td>{r.email || "—"}</td>
                    <td>{r.department}</td>
                    <td>{r.academicDegree}</td>
                    <td>
                      {r.isValid ? (
                        <span className="badge badge-success">Hợp lệ</span>
                      ) : r.isDuplicate ? (
                        <span className="badge badge-warning">Trùng (Bỏ qua)</span>
                      ) : (
                        <span className="badge badge-danger">{r.reason}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={resetState}
            >
              <RefreshCw size={14} /> Chọn file khác
            </button>

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={handleClose}>
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExecuteImport}
                disabled={validRows.length === 0}
              >
                <Check size={16} /> Xác nhận nạp {validRows.length} giảng viên
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: IMPORTING */}
      {step === "importing" && (
        <div style={{ textAlign: "center", padding: "40px 16px" }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--primary)" }}>
            Đang nạp danh sách giảng viên vào hệ thống...
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 8 }}>
            Vui lòng không đóng cửa sổ trình duyệt trong quá trình này.
          </p>
        </div>
      )}

      {/* STEP 4: REPORT */}
      {step === "done" && report && (
        <div style={{ textAlign: "center", padding: "24px 16px" }}>
          <CheckCircle size={48} color="var(--success)" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ color: "var(--primary)", marginBottom: 6 }}>Import Hoàn Tất!</h3>
          <p style={{ color: "var(--text-sub)", fontSize: "0.9rem", marginBottom: 20 }}>
            Đã thêm thành công <strong>{report.success}</strong> giảng viên mới vào IFA-RH.
            {report.skipped > 0 && ` Đã bỏ qua ${report.skipped} tài khoản trùng email.`}
          </p>

          {report.errors.length > 0 && (
            <div
              style={{
                background: "#fee2e2",
                color: "#991b1b",
                padding: 12,
                borderRadius: 6,
                textAlign: "left",
                fontSize: "0.8rem",
                maxHeight: 120,
                overflowY: "auto",
                marginBottom: 20,
              }}
            >
              <strong>Chi tiết lỗi ({report.errors.length}):</strong>
              <ul style={{ paddingLeft: 18, marginTop: 4 }}>
                {report.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <button type="button" className="btn btn-primary" onClick={handleClose}>
            Đóng và tải lại danh sách
          </button>
        </div>
      )}
    </Modal>
  );
};
