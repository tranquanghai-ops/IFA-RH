import React, { useState, useMemo } from "react";
import { Modal } from "./Modal";
import type { OpportunityCandidate, Opportunity } from "../types";
import {
  OFFICIAL_FACULTY_RESEARCH_RECORDS,
  mapRowToCandidate,
  RawFacultyResearchRow,
} from "../services/facultyResearchData";
import { isDuplicateOpportunity } from "../utils/dedupe";
import { formatDateVN } from "../utils/date";
import { addCandidate } from "../firebase/firestore";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Calendar,
  Building,
  RefreshCw,
  Award,
} from "lucide-react";

interface FacultyResearchSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCandidates: OpportunityCandidate[];
  publishedOpportunities: Opportunity[];
  onSuccess: () => void;
}

export const FacultyResearchSyncModal: React.FC<FacultyResearchSyncModalProps> = ({
  isOpen,
  onClose,
  existingCandidates,
  publishedOpportunities,
  onSuccess,
}) => {
  const [sourceData, setSourceData] = useState<RawFacultyResearchRow[]>(
    OFFICIAL_FACULTY_RESEARCH_RECORDS
  );
  const [sourceName, setSourceName] = useState("Dataset chính thức IFA Faculty Research (8 bản ghi Spark)");
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ added: number; skipped: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Build combined existing list for deduplication check
  const allExisting = useMemo(() => {
    return [
      ...publishedOpportunities.map((o) => ({
        title: o.title,
        sourceUrl: o.sourceUrl,
        submissionUrl: o.submissionUrl,
        organizer: o.organizer,
        deadline: o.deadline,
        eventDate: o.eventDate,
      })),
      ...existingCandidates.map((c) => ({
        title: c.title,
        sourceUrl: c.sourceUrl,
        submissionUrl: c.submissionUrl,
        organizer: c.organizer,
        deadline: c.deadline,
        eventDate: c.eventDate,
      })),
    ];
  }, [publishedOpportunities, existingCandidates]);

  // Map and analyze duplicates
  const analyzedItems = useMemo(() => {
    return sourceData.map((row, idx) => {
      const candidate = mapRowToCandidate(row, idx);
      const dedupeResult = isDuplicateOpportunity(
        {
          title: candidate.title,
          sourceUrl: candidate.sourceUrl,
          submissionUrl: candidate.submissionUrl,
          organizer: candidate.organizer,
          deadline: candidate.deadline,
          eventDate: candidate.eventDate,
        },
        allExisting
      );

      return {
        candidate,
        isDuplicate: dedupeResult.isDuplicate,
        matchReason: dedupeResult.matchReason,
      };
    });
  }, [sourceData, allExisting]);

  const newCount = analyzedItems.filter((i) => !i.isDuplicate).length;
  const duplicateCount = analyzedItems.filter((i) => i.isDuplicate).length;

  // Handle uploading custom JSON file from Spark export
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg("");
    setSaveResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSourceData(parsed);
          setSourceName(`Tệp JSON tùy chọn: ${file.name} (${parsed.length} bản ghi)`);
        } else {
          setErrorMsg("Tệp JSON không chứa danh sách bản ghi hợp lệ.");
        }
      } catch (err: any) {
        setErrorMsg("Lỗi khi đọc file JSON: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleSyncCommit = async () => {
    setSaving(true);
    setErrorMsg("");
    let added = 0;
    let skipped = 0;

    try {
      for (const item of analyzedItems) {
        if (item.isDuplicate) {
          skipped++;
          continue;
        }

        await addCandidate(item.candidate);
        added++;
      }

      setSaveResult({ added, skipped });
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Lỗi khi lưu vào Firestore: " + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Đồng bộ từ IFA Faculty Research (Spark)"
      maxWidth="large"
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            Sẽ thêm mới: <strong style={{ color: "var(--success)" }}>{newCount}</strong> · Bỏ qua do trùng lặp:{" "}
            <strong>{duplicateCount}</strong>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>
              {saveResult ? "Đóng" : "Hủy"}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSyncCommit}
              disabled={saving || newCount === 0}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {saving ? (
                <>
                  <RefreshCw size={14} className="spin" /> Đang ghi Firestore...
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Ghi nhận {newCount} bản ghi vào Hàng chờ Spark
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Source info block */}
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            padding: "12px 16px",
            borderRadius: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: "#166534", fontSize: "0.9rem" }}>
              Nguồn dữ liệu: {sourceName}
            </div>
            <div style={{ color: "#15803d", fontSize: "0.8125rem", marginTop: 2 }}>
              Thu thập từ Google Sheet &ldquo;IFA Faculty Research Opportunities&rdquo; (Sheet Cơ hội NCKH)
            </div>
          </div>

          <label
            className="btn btn-secondary btn-sm"
            style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Upload size={14} /> Nạp file JSON khác
            <input
              type="file"
              accept=".json"
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />
          </label>
        </div>

        {/* Success / Error notification */}
        {saveResult && (
          <div
            style={{
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
              padding: 12,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.875rem",
            }}
          >
            <CheckCircle2 size={18} color="#059669" />
            <span>
              Đồng bộ thành công! Đã thêm <strong>{saveResult.added}</strong> cơ hội vào Hàng chờ Spark ({saveResult.skipped} bản ghi bỏ qua do đã có).
            </span>
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              padding: 12,
              borderRadius: 6,
              fontSize: "0.875rem",
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Diff Preview Table */}
        <div>
          <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--primary)", marginBottom: 8 }}>
            Xem trước dữ liệu ({analyzedItems.length} bản ghi):
          </div>

          <div className="table-container" style={{ maxHeight: 380, overflowY: "auto" }}>
            <table className="table" style={{ fontSize: "0.82rem" }}>
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Trạng thái</th>
                  <th>Tên hội thảo / cơ hội</th>
                  <th>Đơn vị tổ chức</th>
                  <th>Hạn nộp</th>
                  <th>Mức phù hợp</th>
                  <th style={{ width: 130 }}>Kết quả kiểm tra</th>
                </tr>
              </thead>
              <tbody>
                {analyzedItems.map(({ candidate, isDuplicate, matchReason }) => (
                  <tr key={candidate.id} style={{ opacity: isDuplicate ? 0.65 : 1 }}>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background:
                            candidate.sheetStatus === "MỚI"
                              ? "#e0f2fe"
                              : candidate.sheetStatus === "SẮP HẾT HẠN"
                              ? "#fef3c7"
                              : "#f1f5f9",
                          color:
                            candidate.sheetStatus === "MỚI"
                              ? "#0369a1"
                              : candidate.sheetStatus === "SẮP HẾT HẠN"
                              ? "#b45309"
                              : "#64748b",
                          fontWeight: 700,
                          fontSize: "0.7rem",
                        }}
                      >
                        {candidate.sheetStatus || "Đang mở"}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: "var(--primary)", lineHeight: 1.3 }}>
                        {candidate.title}
                      </div>
                      {candidate.indexing && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--teal)", marginTop: 2 }}>
                          <Award size={12} />
                          <span>{candidate.indexing}</span>
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Building size={12} color="var(--muted)" />
                        <span>{candidate.organizer}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                        <Calendar size={12} color="var(--danger)" />
                        <strong>{formatDateVN(candidate.deadline) || "Chưa công bố"}</strong>
                      </div>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: candidate.suitability?.includes("Rất phù hợp") ? "#ecfdf5" : "#eff6ff",
                          color: candidate.suitability?.includes("Rất phù hợp") ? "#047857" : "#1d4ed8",
                          fontSize: "0.7rem",
                        }}
                      >
                        {candidate.suitability || "Phù hợp"}
                      </span>
                    </td>
                    <td>
                      {isDuplicate ? (
                        <span
                          className="badge"
                          style={{ background: "#fef3c7", color: "#b45309", fontSize: "0.7rem" }}
                          title={matchReason}
                        >
                          <AlertTriangle size={10} style={{ marginRight: 2 }} /> Đã tồn tại
                        </span>
                      ) : (
                        <span
                          className="badge"
                          style={{ background: "#ecfdf5", color: "#059669", fontSize: "0.7rem" }}
                        >
                          <CheckCircle2 size={10} style={{ marginRight: 2 }} /> Sẽ thêm mới
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
};
