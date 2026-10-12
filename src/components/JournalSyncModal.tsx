import React, { useState, useEffect } from "react";
import {
  X,
  RefreshCw,
  FolderOpen,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  FileSpreadsheet,
  Check,
} from "lucide-react";
import {
  fetchJournalGoogleSheetRows,
  buildJournalCandidatesFromSheet,
  DEFAULT_JOURNAL_DRIVE_FOLDER_URL,
  DEFAULT_JOURNAL_SHEET_NAME,
  EXPECTED_FILE_NAME,
} from "../services/journalGoogleSheetService";
import {
  syncJournalsFromGoogleSheetsToQueue,
  getJournalSyncSettings,
} from "../services/journalCandidateService";
import { fetchJournals } from "../services/journalService";
import { fetchJournalCandidates } from "../services/journalCandidateService";
import type { JournalCandidate, JournalSyncSettings } from "../types/journal";

interface JournalSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: { uid: string; email?: string };
  onSyncComplete: () => void;
}

export const JournalSyncModal: React.FC<JournalSyncModalProps> = ({
  isOpen,
  onClose,
  user,
  onSyncComplete,
}) => {
  const [sheetId, setSheetId] = useState("");
  const [sheetName, setSheetName] = useState(DEFAULT_JOURNAL_SHEET_NAME);
  const [lastSettings, setLastSettings] = useState<JournalSyncSettings | null>(null);

  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [previewResult, setPreviewResult] = useState<{
    totalRead: number;
    newCount: number;
    updatedCount: number;
    unchangedCount: number;
    skippedDuplicates: number;
    warnings: string[];
    sampleCandidates: JournalCandidate[];
  } | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncOutcome, setSyncOutcome] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingSettings(true);
      getJournalSyncSettings().then((settings) => {
        if (settings) {
          setLastSettings(settings);
          if (settings.sheetId) setSheetId(settings.sheetId);
          if (settings.sheetName) setSheetName(settings.sheetName);
        }
        setIsLoadingSettings(false);
      });
      setCheckError("");
      setPreviewResult(null);
      setSyncOutcome(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCheckSheet = async () => {
    if (!sheetId.trim()) {
      setCheckError("Vui lòng nhập Spreadsheet ID do Spark cung cấp.");
      return;
    }

    setCheckError("");
    setPreviewResult(null);
    setSyncOutcome(null);
    setIsChecking(true);

    try {
      // 1. Fetch rows from Google Sheets
      const sheetData = await fetchJournalGoogleSheetRows(sheetId, sheetName);

      // 2. Fetch existing journals & pending candidates
      const [existingJournals, existingCandidates] = await Promise.all([
        fetchJournals({ includeHidden: true }),
        fetchJournalCandidates(),
      ]);

      // 3. Diff analysis
      const analysis = buildJournalCandidatesFromSheet(
        sheetData.validJournals,
        existingJournals,
        existingCandidates
      );

      setPreviewResult({
        totalRead: sheetData.totalRows,
        newCount: analysis.newCount,
        updatedCount: analysis.updatedCount,
        unchangedCount: analysis.unchangedCount,
        skippedDuplicates: analysis.skippedDuplicates,
        warnings: sheetData.warnings,
        sampleCandidates: analysis.candidatesToCreate.slice(0, 15),
      });
    } catch (err: any) {
      setCheckError(err.message || "Không thể nạp dữ liệu từ Google Sheets.");
    } finally {
      setIsChecking(false);
    }
  };

  const handleExecuteSync = async () => {
    if (!sheetId.trim()) return;

    setIsSyncing(true);
    setCheckError("");
    try {
      const res = await syncJournalsFromGoogleSheetsToQueue({
        sheetId,
        sheetName,
        user,
      });

      setSyncOutcome(
        `Đã đưa thành công ${res.newCandidatesCount} tạp chí mới và ${res.updatedCandidatesCount} yêu cầu cập nhật vào Hàng chờ duyệt!`
      );
      onSyncComplete();
    } catch (err: any) {
      setCheckError(err.message || "Đồng bộ thất bại.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        className="modal-content viewport-safe-modal"
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          maxWidth: "850px",
          width: "100%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#f8fafc",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "#0f172a" }}>
              Đồng bộ Danh mục Tạp chí từ Google Sheets
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#64748b" }}>
              Nguồn dữ liệu Spark điều tra theo QĐ 26/QĐ-HĐGSNN · Đưa vào Hàng chờ duyệt (Không tự công bố)
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Drive Folder Link Notice */}
          <div
            style={{
              padding: "14px 18px",
              borderRadius: "8px",
              backgroundColor: "#eff6ff",
              border: "1px solid #bfdbfe",
              fontSize: "0.85rem",
              color: "#1e40af",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FolderOpen size={18} />
              <span>
                Thư mục Google Drive Khoa: <strong>{EXPECTED_FILE_NAME}</strong> (Tab: <code>{DEFAULT_JOURNAL_SHEET_NAME}</code>)
              </span>
            </div>
            <a
              href={DEFAULT_JOURNAL_DRIVE_FOLDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                color: "#1d4ed8",
                fontWeight: 600,
                textDecoration: "none",
                fontSize: "0.82rem",
              }}
            >
              Mở thư mục Google Drive <ExternalLink size={13} />
            </a>
          </div>

          {/* Config Form */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                Spreadsheet ID (hoặc link đầy đủ) do Spark cung cấp *
              </label>
              <input
                type="text"
                placeholder="Ví dụ: 1ug0b4Holu6nGp6NwO-JViqe7XexeDLlwirqRELGwh4U..."
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.88rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                Tên Tab dữ liệu (Mặc định: TAP_CHI)
              </label>
              <input
                type="text"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.88rem",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Last sync stats */}
          {lastSettings && lastSettings.lastSyncedAt && (
            <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
              Lần đồng bộ gần nhất: <strong>{new Date(lastSettings.lastSyncedAt).toLocaleString("vi-VN")}</strong> bởi{" "}
              <strong>{lastSettings.lastSyncedBy || "Admin"}</strong>
              {lastSettings.lastStats && (
                <span>
                  {" "}· Đọc được: <strong>{lastSettings.lastStats.totalRead}</strong> dòng (Mới:{" "}
                  <strong>{lastSettings.lastStats.newCount}</strong>, Cập nhật:{" "}
                  <strong>{lastSettings.lastStats.updatedCount}</strong>)
                </span>
              )}
            </div>
          )}

          {/* Action Check button */}
          <div>
            <button
              onClick={handleCheckSheet}
              disabled={isChecking || !sheetId.trim()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: "#1e3a8a",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: isChecking ? "not-allowed" : "pointer",
              }}
            >
              <RefreshCw size={15} className={isChecking ? "spin" : ""} />
              {isChecking ? "Đang đọc Google Sheets..." : "Tải lại Google Sheets & Phân tích thay đổi"}
            </button>
          </div>

          {/* Error display */}
          {checkError && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong>Lỗi kết nối / Đọc dữ liệu:</strong>
                <p style={{ margin: "2px 0 0 0" }}>{checkError}</p>
              </div>
            </div>
          )}

          {/* Success Outcome */}
          {syncOutcome && (
            <div
              style={{
                padding: "14px 18px",
                borderRadius: "8px",
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#166534",
                fontSize: "0.88rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <CheckCircle2 size={20} color="#166534" />
              <span>{syncOutcome}</span>
            </div>
          )}

          {/* Preview Analysis Results */}
          {previewResult && !syncOutcome && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: "10px",
                }}
              >
                <div style={{ backgroundColor: "#f8fafc", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Tổng đọc được</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0f172a" }}>
                    {previewResult.totalRead}
                  </div>
                </div>
                <div style={{ backgroundColor: "#f0fdf4", padding: "10px 14px", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                  <div style={{ fontSize: "0.75rem", color: "#166534" }}>Tạp chí mới</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#166534" }}>
                    {previewResult.newCount}
                  </div>
                </div>
                <div style={{ backgroundColor: "#eff6ff", padding: "10px 14px", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
                  <div style={{ fontSize: "0.75rem", color: "#1e40af" }}>Có thay đổi</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#1e40af" }}>
                    {previewResult.updatedCount}
                  </div>
                </div>
                <div style={{ backgroundColor: "#f1f5f9", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.75rem", color: "#475569" }}>Không đổi</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#475569" }}>
                    {previewResult.unchangedCount}
                  </div>
                </div>
                <div style={{ backgroundColor: "#fafaf9", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e7e5e4" }}>
                  <div style={{ fontSize: "0.75rem", color: "#78716c" }}>Bỏ qua / Trùng</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#78716c" }}>
                    {previewResult.skippedDuplicates}
                  </div>
                </div>
              </div>

              {/* Sample list of items that will be queued */}
              <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#374151" }}>
                Danh sách dự kiến đưa vào Hàng chờ duyệt ({previewResult.newCount + previewResult.updatedCount} bản ghi):
              </div>
              <div
                style={{
                  maxHeight: "220px",
                  overflowY: "auto",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "8px 10px" }}>Mã / Tên tạp chí</th>
                      <th style={{ padding: "8px 10px" }}>Loại thay đổi</th>
                      <th style={{ padding: "8px 10px" }}>Chi tiết thay đổi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.sampleCandidates.map((c) => (
                      <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 10px" }}>
                          <span style={{ fontWeight: 700 }}>{c.journalId}</span>: {c.name}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          {c.changeType === "create" ? (
                            <span style={{ color: "#059669", fontWeight: 700 }}>Tạp chí mới</span>
                          ) : (
                            <span style={{ color: "#2563eb", fontWeight: 700 }}>Cập nhật</span>
                          )}
                        </td>
                        <td style={{ padding: "8px 10px", color: "#64748b" }}>
                          {c.changeType === "create"
                            ? `Điểm: ${c.maxScore} (${c.maxScoreYear}) · ${c.primaryField}`
                            : c.diffSummary?.map((d) => `${d.label}: ${d.oldValue} ➔ ${d.newValue}`).join("; ") || "Cập nhật dữ liệu"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#f8fafc",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              backgroundColor: "#ffffff",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Đóng
          </button>

          {previewResult && previewResult.newCount + previewResult.updatedCount > 0 && !syncOutcome && (
            <button
              onClick={handleExecuteSync}
              disabled={isSyncing}
              style={{
                padding: "8px 22px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#1e3a8a",
                color: "#ffffff",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: isSyncing ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {isSyncing ? <RefreshCw size={16} className="spin" /> : <UploadCloud size={16} />}
              {isSyncing
                ? "Đang đồng bộ vào hàng chờ..."
                : `Đồng bộ vào Hàng chờ duyệt (${previewResult.newCount + previewResult.updatedCount} mục)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
