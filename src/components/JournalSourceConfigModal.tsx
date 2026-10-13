import React, { useState, useEffect } from "react";
import {
  X,
  Settings,
  FolderOpen,
  ExternalLink,
  Save,
  CheckCircle2,
} from "lucide-react";
import {
  DEFAULT_JOURNAL_DRIVE_FOLDER_URL,
  DEFAULT_JOURNAL_SHEET_NAME,
  DEFAULT_JOURNAL_SPREADSHEET_ID,
  EXPECTED_FILE_NAME,
  sanitizePublicJournalSpreadsheetId,
  sanitizePublicJournalSheetName,
} from "../services/journalGoogleSheetService";
import {
  getJournalSyncSettings,
  saveJournalSyncSettings,
} from "../services/journalCandidateService";
import type { JournalSyncSettings } from "../types/journal";

interface JournalSourceConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (newSettings: {
    sheetId: string;
    sheetName: string;
    multiCouncilSheetId?: string;
    multiCouncilSheetName?: string;
  }) => void;
}

export const JournalSourceConfigModal: React.FC<JournalSourceConfigModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [sheetId, setSheetId] = useState(DEFAULT_JOURNAL_SPREADSHEET_ID);
  const [sheetName, setSheetName] = useState(DEFAULT_JOURNAL_SHEET_NAME);
  const [lastSettings, setLastSettings] = useState<JournalSyncSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setSaveSuccess(false);
      setErrorMsg("");
      getJournalSyncSettings()
        .then((settings) => {
          if (settings) {
            setLastSettings(settings);
            setSheetId(sanitizePublicJournalSpreadsheetId(settings.sheetId));
            setSheetName(sanitizePublicJournalSheetName(settings.sheetName));
          } else {
            setSheetId(DEFAULT_JOURNAL_SPREADSHEET_ID);
            setSheetName(DEFAULT_JOURNAL_SHEET_NAME);
          }
        })
        .catch((err) => {
          console.warn("Không thể tải cấu hình sync:", err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!sheetId.trim() || !sheetName.trim()) {
      setErrorMsg("Vui lòng nhập đầy đủ Spreadsheet ID và Tên tab của Google Sheets IFA-RH.");
      return;
    }

    setIsSaving(true);
    setErrorMsg("");
    setSaveSuccess(false);

    try {
      const cleanSheetId = sanitizePublicJournalSpreadsheetId(sheetId.trim());
      const cleanSheetName = sanitizePublicJournalSheetName(sheetName.trim());
      const nextPayload = {
        sheetId: cleanSheetId,
        sheetName: cleanSheetName,
        multiCouncilSheetId: cleanSheetId,
        multiCouncilSheetName: cleanSheetName,
      };
      await saveJournalSyncSettings(nextPayload);
      setSaveSuccess(true);
      if (onSaved) {
        onSaved(nextPayload);
      }
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      setErrorMsg(err.message || "Không thể lưu cấu hình.");
    } finally {
      setIsSaving(false);
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
          maxWidth: "620px",
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
            padding: "16px 20px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#f8fafc",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                backgroundColor: "#eff6ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#1d4ed8",
              }}
            >
              <Settings size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
                Nguồn dữ liệu: Google Sheets IFA-RH
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                Nguồn công khai duy nhất dùng cho Đồng bộ Google Sheets và Cập nhật điểm HĐGSNN
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Drive Folder Notice */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "8px",
              backgroundColor: "#f0fdf4",
              border: "1px solid #bbf7d0",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}
          >
            <FolderOpen size={18} color="#16a34a" style={{ flexShrink: 0, marginTop: "2px" }} />
            <div style={{ flex: 1, fontSize: "0.82rem", color: "#166534" }}>
              <div style={{ fontWeight: 600 }}>Nguồn dữ liệu: Google Sheets IFA-RH</div>
              <div style={{ color: "#334155", margin: "2px 0 6px 0" }}>
                • Bảng tính chính thức của ứng dụng: <strong>{EXPECTED_FILE_NAME}</strong> (Tab <strong>{DEFAULT_JOURNAL_SHEET_NAME}</strong>, 53 cột A:BA)
              </div>
              <a
                href={DEFAULT_JOURNAL_DRIVE_FOLDER_URL}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  color: "#15803d",
                  fontWeight: 600,
                  textDecoration: "underline",
                }}
              >
                Mở thư mục Google Drive <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Form Fields */}
          {isLoading ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#64748b", fontSize: "0.88rem" }}>
              Đang tải cấu hình nguồn...
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  padding: "14px",
                  borderRadius: "8px",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "#1e3a8a" }}>
                  Cấu hình bảng Google Sheets IFA-RH (dùng chung cho cả 2 nút đồng bộ)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                      Spreadsheet ID
                    </label>
                    <input
                      type="text"
                      value={sheetId}
                      onChange={(e) => setSheetId(e.target.value)}
                      placeholder={DEFAULT_JOURNAL_SPREADSHEET_ID}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.82rem",
                        fontFamily: "monospace",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                      Tên tab
                    </label>
                    <input
                      type="text"
                      value={sheetName}
                      onChange={(e) => setSheetName(e.target.value)}
                      placeholder={DEFAULT_JOURNAL_SHEET_NAME}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.82rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
                {lastSettings?.lastSyncedAt && (
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    Đồng bộ danh mục gần nhất:{" "}
                    <strong>{new Date(lastSettings.lastSyncedAt).toLocaleString("vi-VN")}</strong>
                    {lastSettings.lastSyncedBy && <span> bởi {lastSettings.lastSyncedBy}</span>}
                  </div>
                )}
                {lastSettings?.lastMultiCouncilSyncedAt && (
                  <div style={{ fontSize: "0.75rem", color: "#1e40af" }}>
                    Cập nhật điểm HĐGSNN gần nhất:{" "}
                    <strong>{new Date(lastSettings.lastMultiCouncilSyncedAt).toLocaleString("vi-VN")}</strong>
                    {lastSettings.lastMultiCouncilSyncedBy && (
                      <span> bởi {lastSettings.lastMultiCouncilSyncedBy}</span>
                    )}
                  </div>
                )}
              </div>

              {errorMsg && (
                <div
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "#fef2f2",
                    borderRadius: "6px",
                    border: "1px solid #fecaca",
                    color: "#991b1b",
                    fontSize: "0.82rem",
                  }}
                >
                  {errorMsg}
                </div>
              )}

              {saveSuccess && (
                <div
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "#f0fdf4",
                    borderRadius: "6px",
                    border: "1px solid #bbf7d0",
                    color: "#166534",
                    fontSize: "0.82rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <CheckCircle2 size={16} />
                  Đã lưu cấu hình nguồn thành công!
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "7px 14px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              backgroundColor: "#ffffff",
              color: "#475569",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Đóng
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 16px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "#1e3a8a",
              color: "#ffffff",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: isSaving || isLoading ? "not-allowed" : "pointer",
              opacity: isSaving || isLoading ? 0.7 : 1,
            }}
          >
            <Save size={15} />
            {isSaving ? "Đang lưu..." : "Lưu cấu hình"}
          </button>
        </div>
      </div>
    </div>
  );
};
