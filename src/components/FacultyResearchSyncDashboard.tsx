import React, { useState, useEffect } from "react";
import {
  fetchFacultyResearchSyncState,
  subscribeFacultyResearchSyncState,
  runFacultyResearchSyncClient,
  type FacultyResearchSyncState,
} from "../firebase/firestore";
import {
  OFFICIAL_RESEARCH_SPREADSHEET_URL,
  DEFAULT_RESEARCH_SPREADSHEET_TITLE,
  DEFAULT_RESEARCH_SHEET_NAME_TN,
  DEFAULT_RESEARCH_SHEET_NAME_QT,
} from "../services/researchSheetService";
import { useAuth } from "../firebase/auth";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  Sparkles,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sliders,
  ShieldCheck,
  Check,
  AlertCircle,
  ExternalLink,
  FileSpreadsheet,
} from "lucide-react";

interface FacultyResearchSyncDashboardProps {
  onSyncComplete?: () => void;
  onOpenSyncModal?: () => void;
}

export const FacultyResearchSyncDashboard: React.FC<FacultyResearchSyncDashboardProps> = ({
  onSyncComplete,
  onOpenSyncModal,
}) => {
  const { profile } = useAuth();
  const [syncState, setSyncState] = useState<FacultyResearchSyncState | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showForceConfirm, setShowForceConfirm] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Subscribe to real-time sync state
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeFacultyResearchSyncState((state) => {
      setSyncState(state);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const executeSync = async () => {
    if (!profile) return;
    setSyncing(true);
    setMessage(null);
    setShowForceConfirm(false);

    try {
      const outcome = await runFacultyResearchSyncClient(profile, {
        force: true,
        dataSource: "sheets",
      });

      if (outcome.skipped) {
        setMessage({
          type: "info",
          text: outcome.reason || "Phiên đồng bộ đã được bỏ qua.",
        });
      } else {
        const stats = outcome.stats;
        setMessage({
          type: "success",
          text: `Đồng bộ hoàn tất thành công từ Google Sheets! Mới: ${stats?.created || 0}, Đề xuất cập nhật: ${stats?.updateProposals || 0}, Cập nhật: ${stats?.updated || 0}, Khớp: ${stats?.matched || 0}, Giữ sửa Admin: ${stats?.preservedAdmin || 0}.`,
        });
        if (onSyncComplete) {
          onSyncComplete();
        }
      }
    } catch (err: any) {
      console.error(err);
      setMessage({
        type: "error",
        text: `Lỗi đồng bộ: ${err.message || String(err)}`,
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleManualSyncNow = () => {
    if (!profile) return;
    if (syncState?.syncInProgress) {
      setShowForceConfirm(true);
      return;
    }
    executeSync();
  };

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return "Chưa thực hiện";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return iso;
    }
  };

  const getSourceLabel = (src?: string) => {
    switch (src) {
      case "github_schedule":
        return "Tự động (GitHub Actions hằng tuần)";
      case "github_dispatch":
        return "GitHub Actions kích hoạt";
      case "manual_admin":
        return "Admin thao tác";
      case "manual_cli":
        return "Dòng lệnh (CLI)";
      default:
        return src || "Không xác định";
    }
  };

  const stats = syncState?.lastSyncStats;
  const sheetMeta = syncState?.sheetMeta;
  const isRunning = Boolean(syncState?.syncInProgress || syncing);

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
        border: "1px solid #cbd5e1",
        borderRadius: 12,
        padding: "16px 20px",
        marginBottom: 24,
        boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          paddingBottom: 12,
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "#e0e7ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#4338ca",
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#1e293b" }}>
                Đồng bộ NCKH tự động (SPAK → IFA-RH)
              </h3>
              <span
                style={{
                  fontSize: "0.72rem",
                  padding: "2px 8px",
                  borderRadius: 12,
                  fontWeight: 600,
                  background: "#dbeafe",
                  color: "#1e40af",
                }}
              >
                Nguồn: Google Sheets — Spark
              </span>
              <span
                style={{
                  fontSize: "0.75rem",
                  padding: "2px 8px",
                  borderRadius: 12,
                  fontWeight: 600,
                  background: isRunning
                    ? "#fef3c7"
                    : syncState?.lastSyncStatus === "failed"
                    ? "#fee2e2"
                    : "#dcfce7",
                  color: isRunning
                    ? "#92400e"
                    : syncState?.lastSyncStatus === "failed"
                    ? "#991b1b"
                    : "#166534",
                }}
              >
                {isRunning
                  ? "Đang đồng bộ..."
                  : syncState?.lastSyncStatus === "failed"
                  ? "Thất bại"
                  : "Hoạt động"}
              </span>
            </div>
            <p style={{ margin: "3px 0 0", fontSize: "0.82rem", color: "#64748b" }}>
              Bảng tính: <strong>{sheetMeta?.sheetTitle || DEFAULT_RESEARCH_SPREADSHEET_TITLE}</strong> · Tabs:{" "}
              <code>{DEFAULT_RESEARCH_SHEET_NAME_TN}</code> (Trong nước) & <code>{DEFAULT_RESEARCH_SHEET_NAME_QT}</code> (Quốc tế) · Lịch định kỳ: <strong>03:00 Thứ Hai hằng tuần</strong>
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <a
            href={OFFICIAL_RESEARCH_SPREADSHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
            title="Mở bảng tính Google Sheets của Spark trên tab mới"
          >
            <FileSpreadsheet size={14} color="#059669" />
            <span>Mở Google Sheets</span>
            <ExternalLink size={12} color="#64748b" />
          </a>

          {onOpenSyncModal && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onOpenSyncModal}
              disabled={isRunning}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              title="Xem trước đối chiếu chi tiết hoặc cấu hình đồng bộ"
            >
              <Sliders size={14} /> Xem trước / Chi tiết...
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleManualSyncNow}
            disabled={isRunning}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#4f46e5",
              borderColor: "#4338ca",
            }}
          >
            <RefreshCw size={14} className={isRunning ? "spin" : ""} />
            {isRunning ? "Đang đồng bộ..." : "Đồng bộ ngay"}
          </button>
        </div>
      </div>

      {/* Alert message if any */}
      {message && (
        <div
          style={{
            marginTop: 12,
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background:
              message.type === "success"
                ? "#f0fdf4"
                : message.type === "error"
                ? "#fef2f2"
                : "#eff6ff",
            color:
              message.type === "success"
                ? "#15803d"
                : message.type === "error"
                ? "#b91c1c"
                : "#1d4ed8",
            border: `1px solid ${
              message.type === "success"
                ? "#bbf7d0"
                : message.type === "error"
                ? "#fecaca"
                : "#bfdbfe"
            }`,
          }}
        >
          {message.type === "success" ? (
            <CheckCircle2 size={16} />
          ) : message.type === "error" ? (
            <AlertTriangle size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Meta info & Stats bar */}
      <div style={{ marginTop: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
            fontSize: "0.82rem",
            color: "#475569",
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={14} color="#64748b" />
            <span>Lần đồng bộ gần nhất: </span>
            <strong style={{ color: "#1e293b" }}>{formatDateTime(syncState?.lastSyncAt)}</strong>
            {syncState?.lastSyncSource && (
              <span style={{ color: "#64748b" }}>({getSourceLabel(syncState.lastSyncSource)})</span>
            )}
          </div>
          {syncState?.durationMs !== undefined && (
            <div style={{ color: "#64748b" }}>
              Thời gian chạy: <strong>{(syncState.durationMs / 1000).toFixed(2)}s</strong>
            </div>
          )}
        </div>

        {/* Badges / Stats Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: 8,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase" }}>
              Đọc từ Sheet
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#1e293b" }}>
              {stats?.read ?? "-"}
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "0.72rem", color: "#15803d", textTransform: "uppercase" }}>
              Mới tạo
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#15803d" }}>
              {stats?.created ?? 0}
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "0.72rem", color: "#0284c7", textTransform: "uppercase" }}>
              Đề xuất cập nhật
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0284c7" }}>
              {stats?.updateProposals ?? 0}
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "0.72rem", color: "#475569", textTransform: "uppercase" }}>
              Khớp dữ liệu
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#475569" }}>
              {stats?.matched ?? 0}
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "0.72rem", color: "#d97706", textTransform: "uppercase" }}>
              Cập nhật trực tiếp
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#d97706" }}>
              {stats?.updated ?? 0}
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "0.72rem",
                color: "#7c3aed",
                textTransform: "uppercase",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
              }}
              title="Bảo tồn tuyệt đối các chỉnh sửa thủ công của Quản trị viên"
            >
              <ShieldCheck size={11} /> Giữ sửa Admin
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#7c3aed" }}>
              {stats?.preservedAdmin ?? 0}
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase" }}>
              Trùng / Bỏ qua
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#64748b" }}>
              {stats?.duplicates ?? 0}
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "0.72rem", color: "#dc2626", textTransform: "uppercase" }}>
              Lỗi
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#dc2626" }}>
              {stats?.errorCount ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* Diagnostics Toggle */}
      {syncState?.diagnostics && syncState.diagnostics.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.82rem",
              fontWeight: 600,
              color: "#4f46e5",
            }}
          >
            {showDiagnostics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showDiagnostics
              ? "Ẩn chi tiết kết quả đối chiếu theo từng dòng"
              : `Xem chi tiết đối chiếu ${syncState.diagnostics.length} cơ hội NCKH gần nhất`}
          </button>

          {showDiagnostics && (
            <div
              style={{
                marginTop: 10,
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                overflowX: "auto",
                maxHeight: 280,
                overflowY: "auto",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", width: 50 }}>STT</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Tên hội thảo / cơ hội</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", width: 130 }}>Trạng thái</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Kết quả xử lý</th>
                  </tr>
                </thead>
                <tbody>
                  {syncState.diagnostics.map((d, idx) => {
                    let badgeBg = "#f1f5f9";
                    let badgeColor = "#475569";
                    if (d.status === "created") {
                      badgeBg = "#dcfce7";
                      badgeColor = "#15803d";
                    } else if (d.status === "update_proposal") {
                      badgeBg = "#e0f2fe";
                      badgeColor = "#0284c7";
                    } else if (d.status === "proposal_unchanged") {
                      badgeBg = "#f0f9ff";
                      badgeColor = "#0369a1";
                    } else if (d.status === "updated") {
                      badgeBg = "#fef3c7";
                      badgeColor = "#b45309";
                    } else if (d.status === "preserved_admin") {
                      badgeBg = "#ede9fe";
                      badgeColor = "#6d28d9";
                    } else if (d.status === "matched") {
                      badgeBg = "#f1f5f9";
                      badgeColor = "#475569";
                    } else if (d.status === "invalid") {
                      badgeBg = "#fee2e2";
                      badgeColor = "#b91c1c";
                    }

                    return (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        <td style={{ padding: "6px 12px", color: "#64748b" }}>{d.stt}</td>
                        <td style={{ padding: "6px 12px", fontWeight: 600, color: "#1e293b" }}>
                          {d.title}
                        </td>
                        <td style={{ padding: "6px 12px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              background: badgeBg,
                              color: badgeColor,
                            }}
                          >
                            {d.action}
                          </span>
                        </td>
                        <td style={{ padding: "6px 12px", color: "#475569" }}>{d.reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={showForceConfirm}
        title="Xác nhận ép buộc đồng bộ"
        message="Hệ thống đang ghi nhận một phiên đồng bộ khác đang chạy. Bạn có chắc chắn muốn ép buộc giải phóng khóa và bắt đầu phiên đồng bộ mới ngay lập tức?"
        confirmText="Ép buộc đồng bộ"
        variant="warning"
        isLoading={syncing}
        onConfirm={executeSync}
        onCancel={() => setShowForceConfirm(false)}
      />
    </div>
  );
};
