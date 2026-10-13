import React, { useState, useEffect, useMemo } from "react";
import type {
  Journal,
  JournalCandidate,
  JournalSyncSettings,
} from "../types/journal";
import {
  subscribeJournals,
  createJournal,
  updateJournal,
  setJournalStatus,
  getAvailableCouncilsFromJournals,
  filterJournalsList,
  sortJournalsList,
  formatVietnameseScore,
} from "../services/journalService";
import {
  subscribeJournalCandidates,
  approveJournalCandidate,
  bulkApproveJournalCandidates,
  rejectJournalCandidate,
  markJournalCandidateNeedsReview,
  saveJournalCandidateDraft,
  getJournalSyncSettings,
  syncJournalsFromGoogleSheetsToQueue,
  JournalSyncStageError,
  type JournalSyncProgress,
} from "../services/journalCandidateService";
import {
  DEFAULT_JOURNAL_SPREADSHEET_ID,
  DEFAULT_JOURNAL_SHEET_NAME,
  DEFAULT_MULTI_COUNCIL_SPREADSHEET_ID,
  DEFAULT_MULTI_COUNCIL_SHEET_NAME,
  DEFAULT_FACULTY_COUNCIL_ID,
} from "../services/journalGoogleSheetService";
import { useAuth } from "../firebase/auth";
import { JournalCard } from "../components/JournalCard";
import { JournalDetailModal } from "../components/JournalDetailModal";
import { JournalFormModal } from "../components/JournalFormModal";
import { JournalExcelImportModal } from "../components/JournalExcelImportModal";
import { JournalSourceConfigModal } from "../components/JournalSourceConfigModal";
import {
  JournalSyncResultModal,
  type JournalSyncResultData,
  type JournalSyncErrorData,
} from "../components/JournalSyncResultModal";
import { JournalCandidateReviewModal } from "../components/JournalCandidateReviewModal";
import {
  BookOpen,
  Search,
  Plus,
  Award,
  Sparkles,
  RefreshCw,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  Settings,
  Layers,
  Edit,
} from "lucide-react";

export type CandidateQueueTab =
  | "pending"
  | "needs_review"
  | "approved"
  | "rejected"
  | "all";

export const isTodayDate = (dateStr?: string | null): boolean => {
  if (!dateStr) return false;
  try {
    const d = new Date(dateStr);
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  } catch {
    return false;
  }
};

export const getJournalCandidateCategory = (
  c: JournalCandidate
): "pending" | "needs_review" | "rejected" | "approved" => {
  if (c.status === "approved") return "approved";
  if (c.status === "rejected") return "rejected";
  if (
    c.status === "needs_review" ||
    c.scoreReconciliationStatus === "CAN_KIEM_TRA" ||
    c.identityMatchStatus === "AMBIGUOUS" ||
    c.identityMatchStatus === "CONFLICT" ||
    c.verification?.manualReviewNeeded
  ) {
    return "needs_review";
  }
  return "pending";
};

export const JournalDirectoryPage: React.FC = () => {
  const { profile, user } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "owner";

  // Main Page View Mode for Admin: "public_directory" vs "queue"
  const [adminViewMode, setAdminViewMode] = useState<"public_directory" | "queue">("public_directory");

  // Public Journals State
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Council & Search Filters for Public View
  const [selectedCouncilId, setSelectedCouncilId] = useState<string>(DEFAULT_FACULTY_COUNCIL_ID);
  const [councilScope, setCouncilScope] = useState<"has_score" | "all">("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedField, setSelectedField] = useState<string>("ALL");
  const [selectedMinScore, setSelectedMinScore] = useState<string>("ALL");
  const [selectedYear, setSelectedYear] = useState<string>("ALL");
  const [selectedInfoStatus, setSelectedInfoStatus] = useState<string>("ALL");
  const [showHidden, setShowHidden] = useState<boolean>(false);

  // Candidates Queue State (Admin)
  const [candidates, setCandidates] = useState<JournalCandidate[]>([]);
  const [candidateFilterTab, setCandidateFilterTab] = useState<CandidateQueueTab>("pending");
  const [candidateSearch, setCandidateSearch] = useState<string>("");
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [isBulkApproving, setIsBulkApproving] = useState<boolean>(false);

  // Modals state
  const [selectedJournalForDetail, setSelectedJournalForDetail] = useState<Journal | null>(null);
  const [journalForForm, setJournalForForm] = useState<Journal | null>(null);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [candidateForReview, setCandidateForReview] = useState<JournalCandidate | null>(null);
  const [reviewInitialEditMode, setReviewInitialEditMode] = useState<boolean>(false);

  // Direct sync & source configuration state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<JournalSyncProgress | null>(null);
  const [isConfigSourceOpen, setIsConfigSourceOpen] = useState<boolean>(false);
  const [isSyncResultOpen, setIsSyncResultOpen] = useState<boolean>(false);
  const [syncResultData, setSyncResultData] = useState<JournalSyncResultData | null>(null);
  const [syncErrorData, setSyncErrorData] = useState<JournalSyncErrorData | null>(null);
  const [syncSettings, setSyncSettings] = useState<JournalSyncSettings | null>(null);

  // Subscribe to Firestore journals
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeJournals(
      (data) => {
        setJournals(data);
        setLoading(false);
      },
      { includeHidden: isAdmin && showHidden }
    );

    return () => unsubscribe();
  }, [isAdmin, showHidden]);

  // Subscribe to Journal Candidates & load Sync Settings if Admin
  useEffect(() => {
    if (!isAdmin) return;
    getJournalSyncSettings()
      .then((s) => {
        if (s) setSyncSettings(s);
      })
      .catch(() => {});
    const unsub = subscribeJournalCandidates((cands) => {
      setCandidates(cands);
    });
    return () => unsub();
  }, [isAdmin]);

  // Keep candidateForReview fresh when Firestore updates (e.g., after Lưu nháp)
  useEffect(() => {
    if (!candidateForReview) return;
    const updated = candidates.find((c) => c.id === candidateForReview.id);
    if (updated) {
      setCandidateForReview(updated);
    }
  }, [candidates, candidateForReview?.id]);

  // Calculate candidate counts for review queue
  const candidateTabCounts = useMemo(() => {
    const counts: Record<CandidateQueueTab, number> = {
      pending: 0,
      needs_review: 0,
      approved: 0,
      rejected: 0,
      all: 0,
    };
    candidates.forEach((c) => {
      const cat = getJournalCandidateCategory(c);
      if (cat === "approved") {
        counts.approved++;
        return;
      }
      if (cat === "rejected") counts.rejected++;
      else if (cat === "needs_review") counts.needs_review++;
      else if (cat === "pending") counts.pending++;
      counts.all++;
    });
    return counts;
  }, [candidates]);

  const domesticJournals = useMemo(
    () =>
      journals.filter(
        (j) => j.category === "domestic" && (showHidden || j.status !== "hidden")
      ),
    [journals, showHidden]
  );

  const availableCouncils = useMemo(
    () => getAvailableCouncilsFromJournals(domesticJournals),
    [domesticJournals]
  );

  // Unique fields & years
  const uniqueFields = useMemo(() => {
    const set = new Set<string>();
    domesticJournals.forEach((j) => {
      if (j.primaryField) set.add(j.primaryField);
      (j.fields || []).forEach((f) => set.add(f));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [domesticJournals]);

  const uniqueYears = useMemo(() => {
    const set = new Set<number>();
    domesticJournals.forEach((j) => {
      if (j.maxScoreYear) set.add(j.maxScoreYear);
      if (j.decisionYear && Number.isFinite(Number(j.decisionYear))) set.add(Number(j.decisionYear));
      (j.scores || []).forEach((s) => {
        if (s.year) set.add(s.year);
      });
      (j.councilScores || []).forEach((cs) => {
        if (cs.decisionYear) set.add(cs.decisionYear);
      });
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [domesticJournals]);

  // Filtered public journals (domestic only)
  const filteredJournals = useMemo(() => {
    const list = filterJournalsList(domesticJournals, {
      category: "domestic",
      onlyActive: !showHidden,
      searchQuery: searchTerm,
      selectedField: selectedField === "ALL" ? "all" : selectedField,
      selectedScore: selectedMinScore === "ALL" ? "all" : selectedMinScore,
      selectedYear: selectedYear === "ALL" ? "all" : selectedYear,
      selectedGuidelineStatus:
        selectedInfoStatus === "has_guidelines" ? "has_guidelines" : "all",
      selectedCouncilId,
      councilScope,
    }).filter((j) => {
      if (selectedInfoStatus === "verified_website") {
        return Boolean(j.website && j.websiteVerified);
      }
      if (selectedInfoStatus === "no_website") {
        return !j.website || j.website.trim().length === 0;
      }
      return true;
    });

    return sortJournalsList(list, "score_desc", selectedCouncilId);
  }, [
    domesticJournals,
    searchTerm,
    selectedField,
    selectedMinScore,
    selectedYear,
    selectedInfoStatus,
    showHidden,
    selectedCouncilId,
    councilScope,
  ]);

  // Filtered candidate items
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const cat = getJournalCandidateCategory(c);

      if (candidateFilterTab === "all") {
        if (cat === "approved") return false;
      } else if (cat !== candidateFilterTab) {
        return false;
      }

      if (candidateSearch.trim()) {
        const q = candidateSearch.toLowerCase().trim();
        const matchTitle = c.name?.toLowerCase().includes(q) || false;
        const matchEng = c.englishName?.toLowerCase().includes(q) || false;
        const matchIssn =
          c.issnPrint?.toLowerCase().includes(q) ||
          c.issnOnline?.toLowerCase().includes(q) ||
          false;
        const matchId = c.journalId?.toLowerCase().includes(q) || false;
        const matchPub = c.publisher?.toLowerCase().includes(q) || false;
        const matchCouncil = (c.councilScores || []).some(
          (cs) =>
            cs.councilName.toLowerCase().includes(q) ||
            cs.councilId.toLowerCase().includes(q)
        );
        if (
          !matchTitle &&
          !matchEng &&
          !matchIssn &&
          !matchId &&
          !matchPub &&
          !matchCouncil
        ) {
          return false;
        }
      }

      return true;
    });
  }, [candidates, candidateFilterTab, candidateSearch]);

  // Bulk candidate actions
  const toggleSelectCandidate = (id: string) => {
    setSelectedCandidateIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllCandidates = () => {
    if (selectedCandidateIds.length === filteredCandidates.length) {
      setSelectedCandidateIds([]);
    } else {
      setSelectedCandidateIds(filteredCandidates.map((c) => c.id));
    }
  };

  const handleBulkApprove = async () => {
    if (!user || selectedCandidateIds.length === 0) return;
    const count = selectedCandidateIds.length;
    if (!confirm(`Xác nhận duyệt và công bố ${count} tạp chí đã chọn vào danh mục công khai?`)) {
      return;
    }

    setIsBulkApproving(true);
    try {
      const res = await bulkApproveJournalCandidates(selectedCandidateIds, {
        uid: user.uid,
        email: user.email || "",
      });
      if (res.skippedWarningCount > 0) {
        alert(
          `Đã duyệt thành công ${res.successCount} bản ghi! Lưu ý: ${res.skippedWarningCount} bản ghi có cảnh báo CAN_KIEM_TRA hoặc cần kiểm tra thủ công đã được giữ lại trong danh sách để Admin đối chiếu riêng.`
        );
      } else {
        alert(`Đã duyệt thành công ${res.successCount} bản ghi!`);
      }
      setSelectedCandidateIds([]);
    } catch (err: any) {
      alert("Lỗi duyệt hàng loạt: " + err.message);
    } finally {
      setIsBulkApproving(false);
    }
  };

  // Actions for public journal management
  const handleSaveJournal = async (payload: Partial<Journal>) => {
    if (!user) throw new Error("Chưa đăng nhập.");
    if (journalForForm) {
      await updateJournal(journalForForm.id, payload, { uid: user.uid, email: user.email || "" });
    } else {
      await createJournal(payload as any, { uid: user.uid, email: user.email || "" });
    }
  };

  const handleToggleStatus = async (journal: Journal) => {
    if (!user) return;
    const nextStatus = journal.status === "active" ? "hidden" : "active";
    await setJournalStatus(journal.id, nextStatus, { uid: user.uid, email: user.email || "" });
  };

  // Primary Action: Unified Google Sheets Catalog & Multi-Council Synchronization (53 columns)
  const handleDirectSync = async () => {
    if (!user || isSyncing) return;
    setIsSyncing(true);
    setSyncProgress({
      stage: 1,
      stageName: "Đọc Google Sheets",
      percent: 10,
      message: "Đang kết nối đến Google Sheets IFA-RH...",
    });
    setSyncErrorData(null);
    setSyncResultData(null);

    try {
      const savedSettings = await getJournalSyncSettings();
      const sheetId = savedSettings?.sheetId || DEFAULT_JOURNAL_SPREADSHEET_ID;
      const sheetName = savedSettings?.sheetName || DEFAULT_JOURNAL_SHEET_NAME;

      const res = await syncJournalsFromGoogleSheetsToQueue({
        sheetId,
        sheetName,
        user: { uid: user.uid, email: user.email || "" },
        onProgress: (p) => setSyncProgress(p),
      });

      const refreshedSettings = await getJournalSyncSettings();
      if (refreshedSettings) setSyncSettings(refreshedSettings);

      setSyncResultData({
        syncMode: "catalog",
        totalRead: res.totalRead,
        newCandidatesCount: res.newCandidatesCount,
        updatedCandidatesCount: res.updatedCandidatesCount,
        unchangedCount: res.unchangedCount,
        skippedDuplicates: res.skippedDuplicates,
        manualReviewCount: res.manualReviewCount,
        warnings: res.warnings,
        batchId: res.batchId,
        sourceSpreadsheetId: res.sourceSpreadsheetId,
        sourceSheetName: res.sourceSheetName,
        usedFallbackCatalogSheet: res.usedFallbackCatalogSheet,
        multiCouncilStats: res.multiCouncilStats,
        identityMatchStats: res.identityMatchStats,
      });
      setIsSyncResultOpen(true);
    } catch (err: any) {
      if (err instanceof JournalSyncStageError) {
        setSyncErrorData({
          message: err.message,
          stage: err.stage,
          collectionName: err.collectionName,
          operationType: err.operationType,
          userSummary: err.userSummary,
          documentId: err.documentId,
        });
      } else {
        setSyncErrorData({
          message: err.message || "Đồng bộ Google Sheets thất bại.",
          userSummary: "Lỗi kết nối hoặc đọc dữ liệu từ Google Sheets IFA-RH",
        });
      }
      setIsSyncResultOpen(true);
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  return (
    <div className="journal-directory-page" style={{ padding: "20px 24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Top Banner & Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "#eff6ff", color: "#1e40af", padding: "4px 10px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 700, marginBottom: "8px" }}>
            <Award size={15} />
            HỆ THỐNG DANH MỤC TẠP CHÍ KHOA HỌC (QĐ 26/QĐ-HĐGSNN)
          </div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
            Danh mục Tạp chí Khoa học
          </h1>
          <p style={{ margin: "6px 0 0 0", color: "#64748b", fontSize: "0.92rem", maxWidth: "780px" }}>
            Tra cứu hồ sơ định danh, chỉ số ISSN/E-ISSN, mức điểm theo từng Hội đồng Giáo sư ngành/liên ngành và thể lệ công bố dành cho giảng viên Khoa Mỹ thuật Công nghiệp — TDTU.
          </p>
        </div>

        {/* Admin Action Toolbar */}
        {isAdmin && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            {/* Unified 53-Column Sync: Catalog & Multi-Council HDGSNN Scores */}
            <button
              onClick={handleDirectSync}
              disabled={isSyncing}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                height: "38px",
                padding: "0 16px",
                backgroundColor: "#1e3a8a",
                border: "none",
                borderRadius: "6px",
                color: "#ffffff",
                fontSize: "0.86rem",
                fontWeight: 600,
                cursor: isSyncing ? "not-allowed" : "pointer",
                opacity: isSyncing ? 0.85 : 1,
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                transition: "all 0.15s ease",
              }}
              title="Đồng bộ toàn bộ 53 cột danh mục tạp chí và điểm đa Hội đồng từ Google Sheets IFA-RH vào Hàng chờ duyệt"
            >
              <RefreshCw
                size={15}
                style={{
                  animation: isSyncing ? "spin 1s linear infinite" : undefined,
                }}
              />
              <span>
                {isSyncing
                  ? syncProgress
                    ? `${syncProgress.stageName} (${syncProgress.percent}%)`
                    : "Đang đồng bộ..."
                  : "Đồng bộ Google Sheets"}
              </span>
            </button>

            {/* Minor Action: Source Config (Gear Icon) */}
            <button
              onClick={() => setIsConfigSourceOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: "38px",
                width: "38px",
                backgroundColor: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                color: "#475569",
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                transition: "all 0.15s ease",
              }}
              title="Cấu hình nguồn Google Sheets IFA-RH"
            >
              <Settings size={16} />
            </button>

            {/* Add Journal */}
            <button
              onClick={() => {
                setJournalForForm(null);
                setIsFormOpen(true);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                height: "38px",
                padding: "0 16px",
                backgroundColor: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                color: "#1e3a8a",
                fontSize: "0.86rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                transition: "all 0.15s ease",
              }}
            >
              <Plus size={16} />
              <span>Thêm tạp chí</span>
            </button>
          </div>
        )}
      </div>

      {/* Real-time 5-stage sync progress indicator */}
      {isAdmin && isSyncing && syncProgress && (
        <div
          style={{
            marginBottom: "16px",
            padding: "14px 18px",
            backgroundColor: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            boxShadow: "0 2px 4px rgba(37, 99, 235, 0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "#1e40af",
            }}
          >
            <span>
              Giai đoạn {syncProgress.stage}/5: {syncProgress.stageName}
            </span>
            <span style={{ fontFamily: "monospace" }}>{syncProgress.percent}%</span>
          </div>
          <div
            style={{
              width: "100%",
              height: "6px",
              backgroundColor: "#dbeafe",
              borderRadius: "3px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${syncProgress.percent}%`,
                height: "100%",
                backgroundColor: "#2563eb",
                borderRadius: "3px",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <div style={{ fontSize: "0.82rem", color: "#1e3a8a" }}>
            {syncProgress.message}
          </div>
        </div>
      )}

      {/* Admin Sync Status Bar (Requirement 6: Nguồn dữ liệu: Google Sheets IFA-RH) */}
      {isAdmin && (
        <div
          style={{
            marginBottom: "16px",
            padding: "10px 14px",
            borderRadius: "8px",
            backgroundColor: "#f8fafc",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            fontSize: "0.81rem",
            color: "#334155",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "3px 9px",
                borderRadius: "6px",
                backgroundColor: "#eff6ff",
                border: "1px solid #bfdbfe",
                color: "#1e40af",
                fontWeight: 700,
              }}
            >
              Nguồn dữ liệu: Google Sheets IFA-RH
            </span>
            <span style={{ color: "#64748b" }}>
              Tab: <strong>{syncSettings?.sheetName || DEFAULT_JOURNAL_SHEET_NAME}</strong>
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            <span>
              Đồng bộ gần nhất:{" "}
              <strong>
                {syncSettings?.lastMultiCouncilSyncedAt || syncSettings?.lastSyncedAt
                  ? new Date(
                      (syncSettings?.lastMultiCouncilSyncedAt || syncSettings?.lastSyncedAt)!
                    ).toLocaleString("vi-VN")
                  : "Chưa đồng bộ"}
              </strong>
            </span>
            <span>
              Đọc được:{" "}
              <strong>
                {syncSettings?.lastStats?.totalRead ??
                  syncSettings?.lastMultiCouncilStats?.totalRead ??
                  0}
              </strong>{" "}
              bản ghi
            </span>
            <span>
              Ứng viên mới / cập nhật:{" "}
              <strong style={{ color: "#1d4ed8" }}>
                {syncSettings?.lastStats
                  ? `${syncSettings.lastStats.newCount} mới / ${syncSettings.lastStats.updatedCount} cập nhật`
                  : `${candidateTabCounts.pending} chờ duyệt`}
              </strong>
            </span>
            <span>
              Cần kiểm tra / lỗi:{" "}
              <strong
                style={{
                  color:
                    (syncSettings?.lastMultiCouncilStats?.needsReviewCount ??
                      candidateTabCounts.needs_review) > 0
                      ? "#b45309"
                      : "#15803d",
                }}
              >
                {syncSettings?.lastMultiCouncilStats?.needsReviewCount ??
                  candidateTabCounts.needs_review}
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* Admin View Mode Switcher: Danh mục Công khai vs Hàng chờ duyệt */}
      {isAdmin && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "16px",
            padding: "4px",
            backgroundColor: "#f1f5f9",
            borderRadius: "8px",
            width: "fit-content",
          }}
        >
          <button
            onClick={() => setAdminViewMode("public_directory")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 16px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: adminViewMode === "public_directory" ? "#ffffff" : "transparent",
              color: adminViewMode === "public_directory" ? "#0f172a" : "#64748b",
              fontWeight: 700,
              fontSize: "0.88rem",
              cursor: "pointer",
              boxShadow: adminViewMode === "public_directory" ? "0 1px 3px rgba(0, 0, 0, 0.1)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <BookOpen size={16} />
            <span>Danh mục Công khai</span>
            <span
              style={{
                backgroundColor: adminViewMode === "public_directory" ? "#eff6ff" : "#e2e8f0",
                color: adminViewMode === "public_directory" ? "#1e40af" : "#64748b",
                padding: "1px 7px",
                borderRadius: "10px",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              {journals.length}
            </span>
          </button>

          <button
            onClick={() => setAdminViewMode("queue")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 16px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: adminViewMode === "queue" ? "#ffffff" : "transparent",
              color: adminViewMode === "queue" ? "#1e40af" : "#64748b",
              fontWeight: 700,
              fontSize: "0.88rem",
              cursor: "pointer",
              boxShadow: adminViewMode === "queue" ? "0 1px 3px rgba(0, 0, 0, 0.1)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <Clock size={16} />
            <span>Hàng chờ duyệt</span>
            {candidateTabCounts.pending + candidateTabCounts.needs_review > 0 && (
              <span
                style={{
                  backgroundColor: adminViewMode === "queue" ? "#eff6ff" : "#e2e8f0",
                  color: adminViewMode === "queue" ? "#1e40af" : "#64748b",
                  padding: "1px 7px",
                  borderRadius: "10px",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                }}
              >
                {candidateTabCounts.pending + candidateTabCounts.needs_review}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW A: ADMIN CANDIDATE QUEUE (HÀNG CHỜ DUYỆT)                           */}
      {/* ========================================================================= */}
      {isAdmin && adminViewMode === "queue" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Status Tabs Bar */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              padding: "4px",
              backgroundColor: "#f1f5f9",
              borderRadius: "8px",
              width: "fit-content",
              flexWrap: "wrap",
            }}
          >
            {(
              [
                { id: "pending", label: "Chờ duyệt", count: candidateTabCounts.pending },
                { id: "needs_review", label: "Cần hiệu chỉnh", count: candidateTabCounts.needs_review },
                { id: "approved", label: "Đã công bố", count: candidateTabCounts.approved },
                { id: "rejected", label: "Từ chối", count: candidateTabCounts.rejected },
                { id: "all", label: "Tất cả chờ xử lý", count: candidateTabCounts.all },
              ] as const
            ).map((t) => {
              const isActive = candidateFilterTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setCandidateFilterTab(t.id);
                    setSelectedCandidateIds([]);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 14px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: isActive ? "#ffffff" : "transparent",
                    color: isActive ? "#0f172a" : "#64748b",
                    fontWeight: 700,
                    fontSize: "0.86rem",
                    cursor: "pointer",
                    boxShadow: isActive ? "0 1px 3px rgba(0, 0, 0, 0.1)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{t.label}</span>
                  <span
                    style={{
                      backgroundColor: isActive ? "#eff6ff" : "#e2e8f0",
                      color: isActive ? "#1e40af" : "#64748b",
                      padding: "1px 7px",
                      borderRadius: "10px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                    }}
                  >
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Queue Filter & Actions Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              padding: "12px 16px",
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            {/* Search input */}
            <div style={{ position: "relative", minWidth: "280px", flex: "1 1 320px", maxWidth: "460px" }}>
              <Search
                size={16}
                style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
              />
              <input
                type="text"
                placeholder="Tìm theo tên tạp chí, ISSN, Hội đồng Giáo sư, cơ quan xuất bản..."
                value={candidateSearch}
                onChange={(e) => setCandidateSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 10px 7px 32px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.85rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Bulk actions */}
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              {candidateFilterTab === "pending" && selectedCandidateIds.length > 0 && (
                <button
                  onClick={handleBulkApprove}
                  disabled={isBulkApproving}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 14px",
                    backgroundColor: "#166534",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <CheckCircle2 size={15} />
                  {isBulkApproving
                    ? "Đang duyệt..."
                    : `Duyệt & Công bố (${selectedCandidateIds.length} mục)`}
                </button>
              )}
            </div>
          </div>

          {/* Responsive styles for Candidate Queue Table on Mobile */}
          <style>{`
            @media (max-width: 768px) {
              .journal-queue-table thead {
                display: none;
              }
              .journal-queue-table,
              .journal-queue-table tbody,
              .journal-queue-table tr,
              .journal-queue-table td {
                display: block;
                width: 100% !important;
                box-sizing: border-box;
              }
              .journal-queue-table tr {
                margin-bottom: 12px;
                border: 1px solid #e2e8f0 !important;
                border-radius: 8px;
                padding: 8px 4px;
              }
              .journal-queue-table td {
                text-align: left !important;
                padding: 6px 12px !important;
                border-bottom: none !important;
              }
            }
          `}</style>

          {/* Candidates Queue Table */}
          {filteredCandidates.length > 0 ? (
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                overflowX: "auto",
              }}
            >
              <table
                className="journal-queue-table"
                style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.84rem" }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "12px 10px", width: "36px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={
                          filteredCandidates.length > 0 &&
                          selectedCandidateIds.length === filteredCandidates.length
                        }
                        onChange={toggleSelectAllCandidates}
                      />
                    </th>
                    <th style={{ padding: "12px 12px", minWidth: "240px", width: "30%" }}>Tên tạp chí</th>
                    <th style={{ padding: "12px 10px", width: "140px" }}>Loại thay đổi</th>
                    <th style={{ padding: "12px 10px", width: "130px" }}>Số Hội đồng có điểm</th>
                    <th style={{ padding: "12px 10px", width: "150px" }}>Điểm mới / Thay đổi</th>
                    <th style={{ padding: "12px 10px", width: "135px" }}>Đối soát Spark</th>
                    <th style={{ padding: "12px 10px", width: "125px" }}>Kiểm duyệt Admin</th>
                    <th style={{ padding: "12px 12px", width: "175px", textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map((c) => {
                    const isSelected = selectedCandidateIds.includes(c.id);
                    const cScores = c.councilScores || [];
                    const councilCount =
                      c.recognizedCouncilCount ||
                      new Set(cScores.map((cs) => cs.councilId || cs.councilName)).size ||
                      (c.scores || []).length;
                    const newRecordsCount = c.newCouncilRecordsCount ?? cScores.length;
                    const updatedRecordsCount = c.updatedCouncilRecordsCount ?? 0;
                    const needsReviewRecordsCount =
                      c.needsReviewCouncilCount ??
                      cScores.filter((cs) => cs.verificationStatus === "NEEDS_REVIEW").length;

                    const sparkStatus = c.scoreReconciliationStatus || "HOAN_TAT";
                    const adminCat = getJournalCandidateCategory(c);

                    const hasMultiCouncilDiff = (c.diffSummary || []).some(
                      (d) =>
                        d.field === "councilScores" ||
                        d.field === "recognizedCouncilCount" ||
                        d.field === "scoreReconciliationStatus"
                    );

                    return (
                      <tr
                        key={c.id}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          backgroundColor: isSelected ? "#f0fdf4" : "#ffffff",
                        }}
                      >
                        <td style={{ padding: "12px 10px", textAlign: "center", verticalAlign: "top" }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectCandidate(c.id)}
                          />
                        </td>

                        {/* Col 1: Tên tạp chí (prominent, no Spark code) */}
                        <td style={{ padding: "12px 12px", verticalAlign: "top" }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: "0.94rem",
                              color: "#0f172a",
                              lineHeight: 1.4,
                            }}
                          >
                            {c.name}
                          </div>
                          {c.englishName && (
                            <div
                              style={{
                                fontSize: "0.8rem",
                                color: "#64748b",
                                fontStyle: "italic",
                                marginTop: "2px",
                                lineHeight: 1.35,
                              }}
                            >
                              {c.englishName}
                            </div>
                          )}
                          <div style={{ fontSize: "0.76rem", color: "#64748b", marginTop: "3px" }}>
                            {c.publisher}
                          </div>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "5px" }}>
                            {isTodayDate(c.createdAt) && (
                              <span
                                style={{
                                  fontSize: "0.68rem",
                                  fontWeight: 700,
                                  color: "#166534",
                                  backgroundColor: "#dcfce7",
                                  border: "1px solid #bbf7d0",
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                }}
                              >
                                MỚI
                              </span>
                            )}
                            {c.draftSavedAt && (
                              <span
                                style={{
                                  fontSize: "0.7rem",
                                  fontWeight: 600,
                                  color: "#1e40af",
                                  backgroundColor: "#eff6ff",
                                  border: "1px solid #bfdbfe",
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                }}
                              >
                                Đã lưu nháp
                              </span>
                            )}
                            {c.isManualPreserved && (
                              <span
                                style={{
                                  fontSize: "0.7rem",
                                  color: "#854d0e",
                                  backgroundColor: "#fefce8",
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                  border: "1px solid #fef08a",
                                  fontWeight: 600,
                                }}
                              >
                                Đã sửa thủ công
                              </span>
                            )}
                            {(c.identityMatchStatus === "AMBIGUOUS" ||
                              c.identityMatchStatus === "CONFLICT") && (
                              <span
                                style={{
                                  fontSize: "0.7rem",
                                  color: "#991b1b",
                                  backgroundColor: "#fef2f2",
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                  border: "1px solid #fecaca",
                                  fontWeight: 700,
                                }}
                              >
                                Định danh: {c.identityMatchStatus}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Col 2: Loại thay đổi */}
                        <td style={{ padding: "12px 10px", verticalAlign: "top" }}>
                          {c.changeType === "create" ? (
                            <span
                              style={{
                                display: "inline-block",
                                color: "#059669",
                                backgroundColor: "#ecfdf5",
                                border: "1px solid #a7f3d0",
                                padding: "2px 8px",
                                borderRadius: "5px",
                                fontWeight: 700,
                                fontSize: "0.78rem",
                              }}
                            >
                              Tạp chí mới
                            </span>
                          ) : hasMultiCouncilDiff ? (
                            <div>
                              <span
                                style={{
                                  display: "inline-block",
                                  color: "#1e40af",
                                  backgroundColor: "#eff6ff",
                                  border: "1px solid #bfdbfe",
                                  padding: "2px 8px",
                                  borderRadius: "5px",
                                  fontWeight: 700,
                                  fontSize: "0.78rem",
                                }}
                              >
                                Cập nhật điểm HĐGSNN
                              </span>
                              <div style={{ fontSize: "0.73rem", color: "#64748b", marginTop: 3 }}>
                                {c.diffSummary?.length || 0} mục thay đổi
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span
                                style={{
                                  display: "inline-block",
                                  color: "#0369a1",
                                  backgroundColor: "#f0f9ff",
                                  border: "1px solid #bae6fd",
                                  padding: "2px 8px",
                                  borderRadius: "5px",
                                  fontWeight: 700,
                                  fontSize: "0.78rem",
                                }}
                              >
                                Cập nhật thông tin
                              </span>
                              <div style={{ fontSize: "0.73rem", color: "#64748b", marginTop: 3 }}>
                                {c.diffSummary?.length || 0} trường thay đổi
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Col 3: Số Hội đồng có điểm */}
                        <td style={{ padding: "12px 10px", verticalAlign: "top" }}>
                          <div style={{ fontWeight: 700, color: "#0f172a" }}>
                            {councilCount} Hội đồng
                          </div>
                          <div style={{ fontSize: "0.74rem", color: "#166534", fontWeight: 600 }}>
                            Tối đa: {formatVietnameseScore(c.maxScore)} ({c.decisionYear || c.maxScoreYear || 2025})
                          </div>
                        </td>

                        {/* Col 4: Số bản ghi điểm mới / thay đổi */}
                        <td style={{ padding: "12px 10px", verticalAlign: "top", fontSize: "0.78rem" }}>
                          <div style={{ color: "#334155" }}>
                            Tổng: <strong>{cScores.length || (c.scores || []).length}</strong> bản ghi
                          </div>
                          {(newRecordsCount > 0 || updatedRecordsCount > 0) && (
                            <div style={{ color: "#15803d", fontWeight: 600 }}>
                              +{newRecordsCount} mới
                              {updatedRecordsCount > 0 ? ` · ${updatedRecordsCount} sửa` : ""}
                            </div>
                          )}
                          {needsReviewRecordsCount > 0 && (
                            <div style={{ color: "#b45309", fontWeight: 600 }}>
                              ⚠ {needsReviewRecordsCount} mục cần kiểm tra
                            </div>
                          )}
                        </td>

                        {/* Col 5: Trạng thái đối soát Spark */}
                        <td style={{ padding: "12px 10px", verticalAlign: "top" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: "5px",
                              fontSize: "0.74rem",
                              fontWeight: 700,
                              backgroundColor:
                                sparkStatus === "HOAN_TAT"
                                  ? "#ecfdf5"
                                  : sparkStatus === "CAN_KIEM_TRA"
                                  ? "#fef3c7"
                                  : "#f1f5f9",
                              color:
                                sparkStatus === "HOAN_TAT"
                                  ? "#065f46"
                                  : sparkStatus === "CAN_KIEM_TRA"
                                  ? "#92400e"
                                  : "#475569",
                              border:
                                sparkStatus === "HOAN_TAT"
                                  ? "1px solid #a7f3d0"
                                  : sparkStatus === "CAN_KIEM_TRA"
                                  ? "1px solid #fde68a"
                                  : "1px solid #cbd5e1",
                            }}
                          >
                            {sparkStatus}
                          </span>
                        </td>

                        {/* Col 6: Trạng thái kiểm duyệt Admin */}
                        <td style={{ padding: "12px 10px", verticalAlign: "top" }}>
                          {adminCat === "approved" ? (
                            <span style={{ color: "#166534", fontWeight: 700 }}>Đã công bố</span>
                          ) : adminCat === "rejected" ? (
                            <span style={{ color: "#991b1b", fontWeight: 700 }}>Từ chối</span>
                          ) : adminCat === "needs_review" ? (
                            <span style={{ color: "#b45309", fontWeight: 700 }}>Cần hiệu chỉnh</span>
                          ) : (
                            <span style={{ color: "#1e40af", fontWeight: 700 }}>Chờ duyệt</span>
                          )}
                        </td>

                        {/* Col 7: Thao tác (Xem & Duyệt / Chỉnh sửa) */}
                        <td style={{ padding: "12px 12px", textAlign: "right", verticalAlign: "top" }}>
                          <div style={{ display: "inline-flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              onClick={() => {
                                setReviewInitialEditMode(true);
                                setCandidateForReview(c);
                              }}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "6px 10px",
                                borderRadius: "6px",
                                backgroundColor: "#ffffff",
                                color: "#334155",
                                border: "1px solid #cbd5e1",
                                fontSize: "0.78rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <Edit size={13} />
                              Chỉnh sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReviewInitialEditMode(false);
                                setCandidateForReview(c);
                              }}
                              style={{
                                padding: "6px 11px",
                                borderRadius: "6px",
                                backgroundColor: "#1e3a8a",
                                color: "#ffffff",
                                border: "none",
                                fontSize: "0.78rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Xem &amp; Duyệt
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                backgroundColor: "#ffffff",
                borderRadius: "8px",
                border: "1px dashed #cbd5e1",
                color: "#64748b",
              }}
            >
              <Sparkles size={36} color="#94a3b8" style={{ marginBottom: "10px" }} />
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#334155", margin: 0 }}>
                Không có bản ghi nào trong mục này
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.82rem" }}>
                Bấm &ldquo;Đồng bộ Google Sheets&rdquo; hoặc &ldquo;Cập nhật điểm HĐGSNN&rdquo; ở đầu trang để nạp dữ liệu từ Spark.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW B: PUBLIC JOURNALS DIRECTORY (DANH MỤC TẠP CHÍ CÔNG KHAI)            */
        /* ========================================================================= */
        <div>
          {/* Domestic Journals Header */}
          <div
            style={{
              display: "flex",
              borderBottom: "2px solid #e2e8f0",
              marginBottom: "18px",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 20px",
                borderBottom: "3px solid #1e3a8a",
                color: "#1e3a8a",
                fontWeight: 700,
                fontSize: "0.95rem",
                marginBottom: "-2px",
              }}
            >
              <BookOpen size={18} />
              Tạp chí khoa học trong nước ({domesticJournals.length})
            </div>
          </div>

          {/* Professor Council Selector Bar */}
          <div
            style={{
              backgroundColor: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "10px",
              padding: "14px 18px",
              marginBottom: "16px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "14px",
              alignItems: "end",
            }}
          >
            <div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "#1e3a8a",
                  textTransform: "uppercase",
                  marginBottom: "5px",
                }}
              >
                <Layers size={14} />
                Hội đồng Giáo sư tra cứu điểm
              </label>
              <select
                value={selectedCouncilId}
                onChange={(e) => setSelectedCouncilId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #93c5fd",
                  fontSize: "0.86rem",
                  fontWeight: 700,
                  color: "#0f172a",
                  backgroundColor: "#ffffff",
                }}
              >
                {availableCouncils.map((c) => (
                  <option key={c.councilId} value={c.councilId}>
                    {c.councilName} ({c.councilId}) — {c.journalCount} tạp chí
                  </option>
                ))}
                <option value="ALL">
                  Tất cả Hội đồng Giáo sư (Hiển thị điểm cao nhất)
                </option>
              </select>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "#334155",
                  textTransform: "uppercase",
                  marginBottom: "5px",
                }}
              >
                Phạm vi hiển thị tạp chí
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "6px",
                  backgroundColor: "#dbeafe",
                  padding: "4px",
                  borderRadius: "8px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setCouncilScope("has_score")}
                  style={{
                    padding: "7px 10px",
                    borderRadius: "6px",
                    border: "none",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    backgroundColor: councilScope === "has_score" ? "#ffffff" : "transparent",
                    color: councilScope === "has_score" ? "#1e3a8a" : "#475569",
                  }}
                >
                  Có điểm tại Hội đồng đang chọn
                </button>
                <button
                  type="button"
                  onClick={() => setCouncilScope("all")}
                  style={{
                    padding: "7px 10px",
                    borderRadius: "6px",
                    border: "none",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    backgroundColor: councilScope === "all" ? "#ffffff" : "transparent",
                    color: councilScope === "all" ? "#1e3a8a" : "#475569",
                  }}
                >
                  Tất cả tạp chí ({domesticJournals.length})
                </button>
              </div>
            </div>
          </div>

          {/* Search Bar & Multi-filter Box */}
          <div>
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                padding: "16px 20px",
                marginBottom: "20px",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
              }}
            >
              {/* Search Input Row */}
              <div style={{ position: "relative", marginBottom: "14px" }}>
                <Search
                  size={18}
                  style={{
                    position: "absolute",
                    left: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                  }}
                />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên tạp chí, ISSN, cơ quan xuất bản, lĩnh vực chuyên môn..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px 10px 42px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.92rem",
                    boxSizing: "border-box",
                  }}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#94a3b8",
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Filter Dropdowns Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "12px",
                  alignItems: "center",
                }}
              >
                {/* Field filter */}
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "4px" }}>
                    Nhóm ngành
                  </label>
                  <select
                    value={selectedField}
                    onChange={(e) => setSelectedField(e.target.value)}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem", backgroundColor: "#ffffff" }}
                  >
                    <option value="ALL">Tất cả nhóm ngành</option>
                    {uniqueFields.map((f, i) => (
                      <option key={i} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Min score filter */}
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "4px" }}>
                    Mức điểm HĐGSNN
                  </label>
                  <select
                    value={selectedMinScore}
                    onChange={(e) => setSelectedMinScore(e.target.value)}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem", backgroundColor: "#ffffff" }}
                  >
                    <option value="ALL">Tất cả mức điểm</option>
                    <option value="1.0">Từ 1,00 điểm trở lên</option>
                    <option value="0.75">Từ 0,75 điểm trở lên</option>
                    <option value="0.5">Từ 0,50 điểm trở lên</option>
                    <option value="0.25">Từ 0,25 điểm trở lên</option>
                  </select>
                </div>

                {/* Year filter */}
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "4px" }}>
                    Năm công nhận
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem", backgroundColor: "#ffffff" }}
                  >
                    <option value="ALL">Tất cả các năm</option>
                    {uniqueYears.map((y) => (
                      <option key={y} value={y.toString()}>
                        Năm {y}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Info status filter */}
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "4px" }}>
                    Tình trạng thông tin
                  </label>
                  <select
                    value={selectedInfoStatus}
                    onChange={(e) => setSelectedInfoStatus(e.target.value)}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem", backgroundColor: "#ffffff" }}
                  >
                    <option value="ALL">Tất cả tình trạng</option>
                    <option value="has_guidelines">Có hướng dẫn đăng bài</option>
                    <option value="verified_website">Có trang chủ đã xác minh</option>
                    <option value="no_website">Chưa có trang chủ</option>
                  </select>
                </div>
              </div>

              {/* Admin Toggle Hidden Journals */}
              {isAdmin && (
                <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", fontWeight: 600, color: "#64748b", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={showHidden}
                      onChange={(e) => setShowHidden(e.target.checked)}
                    />
                    Hiển thị các tạp chí đang tạm ẩn ({journals.filter((j) => j.status === "hidden").length})
                  </label>
                </div>
              )}
            </div>

            {/* Results Summary Bar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
                fontSize: "0.88rem",
                color: "#475569",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <div>
                Hiển thị <strong>{filteredJournals.length}</strong> / {domesticJournals.length} tạp chí trong nước
              </div>

              {(searchTerm ||
                selectedField !== "ALL" ||
                selectedMinScore !== "ALL" ||
                selectedYear !== "ALL" ||
                selectedInfoStatus !== "ALL" ||
                selectedCouncilId !== DEFAULT_FACULTY_COUNCIL_ID ||
                councilScope !== "all") && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedField("ALL");
                    setSelectedMinScore("ALL");
                    setSelectedYear("ALL");
                    setSelectedInfoStatus("ALL");
                    setSelectedCouncilId(DEFAULT_FACULTY_COUNCIL_ID);
                    setCouncilScope("all");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#2563eb",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Đặt lại bộ lọc
                </button>
              )}
            </div>

            {/* Journals Cards Grid */}
            {loading ? (
              <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
                <RefreshCw size={24} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                <p style={{ marginTop: "8px", fontSize: "0.9rem" }}>Đang tải danh mục tạp chí khoa học...</p>
              </div>
            ) : filteredJournals.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
                  gap: "20px",
                }}
              >
                {filteredJournals.map((journal) => (
                  <JournalCard
                    key={journal.id || journal.journalId}
                    journal={journal}
                    selectedCouncilId={selectedCouncilId}
                    isAdmin={isAdmin}
                    onViewDetails={(j) => setSelectedJournalForDetail(j)}
                    onEdit={(j) => {
                      setJournalForForm(j);
                      setIsFormOpen(true);
                    }}
                    onToggleStatus={handleToggleStatus}
                  />
                ))}
              </div>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  backgroundColor: "#ffffff",
                  borderRadius: "10px",
                  border: "1px dashed #cbd5e1",
                  color: "#64748b",
                }}
              >
                <AlertCircle size={36} color="#94a3b8" style={{ marginBottom: "12px" }} />
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#334155", margin: 0 }}>
                  Không tìm thấy tạp chí phù hợp
                </h3>
                <p style={{ margin: "6px 0 0 0", fontSize: "0.85rem" }}>
                  Thử thay đổi từ khóa tìm kiếm, chọn &ldquo;Tất cả tạp chí&rdquo; hoặc bỏ bớt các tiêu chí lọc.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <JournalDetailModal
        isOpen={Boolean(selectedJournalForDetail)}
        onClose={() => setSelectedJournalForDetail(null)}
        journal={selectedJournalForDetail}
        selectedCouncilId={selectedCouncilId}
      />

      {isFormOpen && (
        <JournalFormModal
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setJournalForForm(null);
          }}
          journal={journalForForm}
          onSave={handleSaveJournal}
        />
      )}

      {isImportOpen && user && (
        <JournalExcelImportModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          existingJournals={journals}
          user={{ uid: user.uid, email: user.email || "" }}
          onImportComplete={() => {}}
        />
      )}

      {/* Google Sheets Source Configuration Modal (Gear Icon) */}
      <JournalSourceConfigModal
        isOpen={isConfigSourceOpen}
        onClose={() => setIsConfigSourceOpen(false)}
      />

      {/* Google Sheets Sync Result & Stage Diagnostics Modal */}
      <JournalSyncResultModal
        isOpen={isSyncResultOpen}
        onClose={() => setIsSyncResultOpen(false)}
        result={syncResultData}
        error={syncErrorData}
        onGoToQueue={() => {
          setAdminViewMode("queue");
          setCandidateFilterTab("pending");
        }}
        onRetry={handleDirectSync}
      />

      {candidateForReview && user && (
        <JournalCandidateReviewModal
          isOpen={Boolean(candidateForReview)}
          onClose={() => setCandidateForReview(null)}
          candidate={candidateForReview}
          initialEditMode={reviewInitialEditMode}
          selectedCouncilId={selectedCouncilId}
          onSaveDraft={async (id, updates, reason) => {
            await saveJournalCandidateDraft(
              id,
              updates,
              { uid: user.uid, email: user.email || "" },
              reason
            );
          }}
          onApprove={async (id, opts) => {
            await approveJournalCandidate(id, { uid: user.uid, email: user.email || "" }, opts);
          }}
          onReject={async (id, reason) => {
            await rejectJournalCandidate(id, reason, { uid: user.uid, email: user.email || "" });
          }}
          onMarkNeedsReview={async (id) => {
            await markJournalCandidateNeedsReview(id, { uid: user.uid, email: user.email || "" });
          }}
        />
      )}
    </div>
  );
};
