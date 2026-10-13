import React, { useState } from "react";
import type { Journal, JournalImportPreviewItem, JournalImportResult } from "../types/journal";
import {
  parseJournalWorkbook,
  calculateJournalImportDiff,
  executeBatchJournalImport,
} from "../services/journalExcelService";
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Info,
  ShieldAlert,
  ChevronDown,
  Check,
} from "lucide-react";

interface JournalExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingJournals: Journal[];
  user: { uid: string; email?: string };
  onImportComplete: () => void;
}

export const JournalExcelImportModal: React.FC<JournalExcelImportModalProps> = ({
  isOpen,
  onClose,
  existingJournals,
  user,
  onImportComplete,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [previewItems, setPreviewItems] = useState<JournalImportPreviewItem[]>([]);
  const [overrideManual, setOverrideManual] = useState(false);
  const [filterTab, setFilterTab] = useState<"all" | "create" | "update" | "skip" | "unverified">("all");
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<JournalImportResult | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.classList.add("modal-open");
    document.documentElement.classList.add("modal-open");

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.classList.remove("modal-open");
      document.documentElement.classList.remove("modal-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setParseError("");
    setPreviewItems([]);
    setImportResult(null);
    setIsParsing(true);

    try {
      const buffer = await selected.arrayBuffer();
      const parseResult = await parseJournalWorkbook(buffer);

      if (parseResult.errors.length > 0) {
        console.warn("Parse warnings:", parseResult.errors);
      }

      const diff = calculateJournalImportDiff(parseResult.journals, existingJournals, overrideManual);
      setPreviewItems(diff);
    } catch (err: any) {
      setParseError(err.message || "Không thể đọc tệp Excel.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleOverrideToggle = (checked: boolean) => {
    setOverrideManual(checked);
    if (previewItems.length > 0) {
      const rawJournals = previewItems.map((p) => p.parsedJournal);
      const diff = calculateJournalImportDiff(rawJournals, existingJournals, checked);
      setPreviewItems(diff);
    }
  };

  const toggleSelectAll = (select: boolean) => {
    setPreviewItems((prev) =>
      prev.map((item) => (item.action !== "skip" ? { ...item, selected: select } : item))
    );
  };

  const toggleItemSelect = (journalId: string) => {
    setPreviewItems((prev) =>
      prev.map((item) =>
        item.journalId === journalId ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleExecuteImport = async () => {
    if (!file) return;
    const selectedCount = previewItems.filter((i) => i.selected).length;
    if (selectedCount === 0) {
      alert("Vui lòng chọn ít nhất 1 dòng để nhập.");
      return;
    }

    try {
      setIsImporting(true);
      const res = await executeBatchJournalImport(previewItems, file.name, user);
      setImportResult(res);
      onImportComplete();
    } catch (err: any) {
      alert("Lỗi nhập dữ liệu: " + (err.message || "Thao tác thất bại"));
    } finally {
      setIsImporting(false);
    }
  };

  // Stats counters
  const totalCount = previewItems.length;
  const newCount = previewItems.filter((i) => i.action === "create").length;
  const updateCount = previewItems.filter((i) => i.action === "update").length;
  const skippedCount = previewItems.filter((i) => i.action === "skip" || i.action === "unchanged").length;
  const unverifiedCount = previewItems.filter((i) => i.unverifiedFields.length > 0).length;
  const selectedCount = previewItems.filter((i) => i.selected).length;

  const filteredItems = previewItems.filter((item) => {
    if (filterTab === "all") return true;
    if (filterTab === "create") return item.action === "create";
    if (filterTab === "update") return item.action === "update";
    if (filterTab === "skip") return item.action === "skip" || item.action === "unchanged";
    if (filterTab === "unverified") return item.unverifiedFields.length > 0;
    return true;
  });

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
        overscrollBehavior: "contain",
      }}
      onClick={onClose}
      onWheel={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
    >
      <div
        className="modal-content viewport-safe-modal"
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          maxWidth: "1000px",
          width: "100%",
          maxHeight: "94vh",
          display: "flex",
          overscrollBehavior: "contain",
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
              Nhập danh mục tạp chí từ Excel (.xlsx)
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#64748b" }}>
              Chuẩn dữ liệu hợp đồng schema_version = 1 (QĐ 26/QĐ-HĐGSNN)
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
          {/* File Picker & Template Download Box */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "14px",
              padding: "16px 20px",
              backgroundColor: "#f1f5f9",
              borderRadius: "8px",
              border: "1px dashed #cbd5e1",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <FileSpreadsheet size={32} color="#1e3a8a" />
              <div>
                <label
                  htmlFor="journal-excel-upload"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 16px",
                    backgroundColor: "#1e3a8a",
                    color: "#ffffff",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Upload size={16} />
                  {file ? "Chọn tệp khác..." : "Chọn tệp Excel (.xlsx)"}
                </label>
                <input
                  id="journal-excel-upload"
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
                {file && (
                  <span style={{ marginLeft: "12px", fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>
                    {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>
            </div>

            {/* Template Download */}
            <a
              href="/templates/IFA_RH_Journal_Directory_Template_v1.xlsx"
              download="IFA_RH_Journal_Directory_Template_v1.xlsx"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                backgroundColor: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                color: "#1e40af",
                fontSize: "0.82rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              <Download size={15} />
              Tải file template mẫu (.xlsx)
            </a>
          </div>

          {/* Loading or Parse Error */}
          {isParsing && (
            <div style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
              <RefreshCw size={24} className="spin" style={{ animation: "spin 1s linear infinite" }} />
              <p style={{ marginTop: "8px", fontSize: "0.9rem" }}>Đang phân tích cấu trúc 5 sheets của Excel...</p>
            </div>
          )}

          {parseError && (
            <div
              style={{
                padding: "14px 18px",
                borderRadius: "8px",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                fontSize: "0.88rem",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
              }}
            >
              <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong>Lỗi kiểm tra cấu trúc tệp Excel:</strong>
                <p style={{ margin: "4px 0 0 0" }}>{parseError}</p>
              </div>
            </div>
          )}

          {/* Result Report if Completed */}
          {importResult && (
            <div
              style={{
                padding: "16px 20px",
                borderRadius: "8px",
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#166534",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <CheckCircle2 size={20} color="#166534" />
                <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
                  Đã hoàn thành nhập dữ liệu thành công!
                </h4>
              </div>
              <p style={{ margin: 0, fontSize: "0.85rem" }}>
                Mã đợt nhập: <strong>{importResult.batchId}</strong> · Tạo mới: <strong>{importResult.createdCount}</strong> · Cập nhật: <strong>{importResult.updatedCount}</strong> · Bỏ qua: <strong>{importResult.skippedCount}</strong> · Lỗi: <strong>{importResult.errorCount}</strong>
              </p>
            </div>
          )}

          {/* Preview Section */}
          {previewItems.length > 0 && !importResult && (
            <div>
              {/* Option checkboxes & Safeguards */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                  padding: "10px 14px",
                  backgroundColor: "#fefce8",
                  borderRadius: "8px",
                  border: "1px solid #fef08a",
                  fontSize: "0.82rem",
                  marginBottom: "14px",
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600, color: "#854d0e" }}>
                  <input
                    type="checkbox"
                    checked={overrideManual}
                    onChange={(e) => handleOverrideToggle(e.target.checked)}
                  />
                  Ghi đè bản ghi Admin đã sửa thủ công (Mặc định không tick để bảo toàn dữ liệu chỉnh sửa trên web)
                </label>
              </div>

              {/* Stats Filter Tabs */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginBottom: "12px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() => setFilterTab("all")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: filterTab === "all" ? "#1e3a8a" : "#f1f5f9",
                    color: filterTab === "all" ? "#ffffff" : "#334155",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Tất cả ({totalCount})
                </button>
                <button
                  onClick={() => setFilterTab("create")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: filterTab === "create" ? "#059669" : "#f1f5f9",
                    color: filterTab === "create" ? "#ffffff" : "#334155",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Mới ({newCount})
                </button>
                <button
                  onClick={() => setFilterTab("update")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: filterTab === "update" ? "#2563eb" : "#f1f5f9",
                    color: filterTab === "update" ? "#ffffff" : "#334155",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cập nhật ({updateCount})
                </button>
                <button
                  onClick={() => setFilterTab("skip")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: filterTab === "skip" ? "#64748b" : "#f1f5f9",
                    color: filterTab === "skip" ? "#ffffff" : "#334155",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Trùng / Bỏ qua ({skippedCount})
                </button>
                <button
                  onClick={() => setFilterTab("unverified")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: filterTab === "unverified" ? "#d97706" : "#f1f5f9",
                    color: filterTab === "unverified" ? "#ffffff" : "#334155",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Chưa xác minh ({unverifiedCount})
                </button>
              </div>

              {/* Table Controls */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                  fontSize: "0.82rem",
                  color: "#64748b",
                }}
              >
                <div>
                  Đã chọn: <strong style={{ color: "#0f172a" }}>{selectedCount}</strong> / {totalCount} bản ghi
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => toggleSelectAll(true)}
                    style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontWeight: 600 }}
                  >
                    Chọn tất cả
                  </button>
                  <span>·</span>
                  <button
                    onClick={() => toggleSelectAll(false)}
                    style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}
                  >
                    Bỏ chọn tất cả
                  </button>
                </div>
              </div>

              {/* Preview Table */}
              <div
                style={{
                  maxHeight: "360px",
                  overflowY: "auto",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.82rem",
                    textAlign: "left",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", position: "sticky", top: 0, zIndex: 1, borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "8px 10px", width: "36px" }}></th>
                      <th style={{ padding: "8px 10px" }}>Mã / Tên tạp chí</th>
                      <th style={{ padding: "8px 10px" }}>Cơ quan xuất bản</th>
                      <th style={{ padding: "8px 10px" }}>ISSN</th>
                      <th style={{ padding: "8px 10px" }}>Điểm HĐGS</th>
                      <th style={{ padding: "8px 10px" }}>Hành động dự kiến</th>
                      <th style={{ padding: "8px 10px" }}>Trường chưa xác minh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item, idx) => (
                      <tr
                        key={item.journalId + idx}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          backgroundColor: !item.selected ? "#fafafa" : item.action === "create" ? "#f0fdf4" : item.action === "update" ? "#eff6ff" : "#ffffff",
                        }}
                      >
                        <td style={{ padding: "8px 10px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={item.selected}
                            disabled={item.action === "skip"}
                            onChange={() => toggleItemSelect(item.journalId)}
                          />
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <div style={{ fontWeight: 700, color: "#0f172a" }}>{item.journalId}</div>
                          <div style={{ color: "#334155" }}>{item.name}</div>
                        </td>
                        <td style={{ padding: "8px 10px", color: "#475569" }}>{item.publisher}</td>
                        <td style={{ padding: "8px 10px", color: "#475569" }}>
                          {item.issnPrint || item.issnOnline || "—"}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <span style={{ fontWeight: 700, color: "#166534" }}>
                            {item.maxScore > 0 ? item.maxScore.toFixed(2) : "0"} ({item.maxScoreYear})
                          </span>
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          {item.action === "create" ? (
                            <span style={{ color: "#059669", fontWeight: 700 }}>Thêm mới</span>
                          ) : item.action === "update" ? (
                            <span style={{ color: "#2563eb", fontWeight: 700 }}>Cập nhật</span>
                          ) : item.isManualPreserved ? (
                            <span style={{ color: "#854d0e", fontWeight: 600 }}>Bảo toàn dữ liệu thủ công</span>
                          ) : (
                            <span style={{ color: "#64748b" }}>Bỏ qua</span>
                          )}
                          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>
                            {item.reasons.join("; ")}
                          </div>
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          {item.unverifiedFields.length > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
                              {item.unverifiedFields.map((u, i) => (
                                <span
                                  key={i}
                                  style={{
                                    backgroundColor: "#fef3c7",
                                    color: "#92400e",
                                    fontSize: "0.7rem",
                                    padding: "2px 5px",
                                    borderRadius: "3px",
                                  }}
                                >
                                  {u}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: "#166534", fontSize: "0.75rem" }}>Đầy đủ</span>
                          )}
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

          {previewItems.length > 0 && !importResult && (
            <button
              onClick={handleExecuteImport}
              disabled={isImporting || selectedCount === 0}
              style={{
                padding: "8px 24px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#1e3a8a",
                color: "#ffffff",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: isImporting || selectedCount === 0 ? "not-allowed" : "pointer",
                opacity: isImporting || selectedCount === 0 ? 0.6 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {isImporting ? <RefreshCw size={16} className="spin" /> : <Check size={16} />}
              {isImporting ? "Đang nhập dữ liệu..." : `Xác nhận nhập (${selectedCount} dòng)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
