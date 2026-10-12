import React, { useState, useEffect, useMemo } from "react";
import type {
  Journal,
  JournalCategory,
  JournalCandidate,
  JournalCandidateStatus,
} from "../types/journal";
import {
  subscribeJournals,
  createJournal,
  updateJournal,
  setJournalStatus,
} from "../services/journalService";
import {
  subscribeJournalCandidates,
  approveJournalCandidate,
  bulkApproveJournalCandidates,
  rejectJournalCandidate,
  markJournalCandidateNeedsReview,
} from "../services/journalCandidateService";
import { useAuth } from "../firebase/auth";
import { JournalCard } from "../components/JournalCard";
import { JournalDetailModal } from "../components/JournalDetailModal";
import { JournalFormModal } from "../components/JournalFormModal";
import { JournalExcelImportModal } from "../components/JournalExcelImportModal";
import { JournalSyncModal } from "../components/JournalSyncModal";
import { JournalCandidateReviewModal } from "../components/JournalCandidateReviewModal";
import {
  BookOpen,
  Search,
  Plus,
  Upload,
  Globe,
  Award,
  Sparkles,
  RefreshCw,
  X,
  UploadCloud,
  CheckCircle2,
  Clock,
  HelpCircle,
  XCircle,
  Eye,
  CheckSquare,
  Square,
  AlertCircle,
} from "lucide-react";

// Default initial seeds matching Quyết định 26/QĐ-HĐGSNN if database is completely empty
const DEFAULT_SAMPLE_JOURNALS: Journal[] = [
  {
    id: "TC-VHNT-001",
    journalId: "TC-VHNT-001",
    name: "Tạp chí Văn hóa Nghệ thuật",
    englishName: "Journal of Culture and Arts",
    abbreviation: "JCA",
    publisher: "Bộ Văn hóa, Thể thao và Du lịch",
    issnPrint: "0866-8639",
    issnOnline: "2615-9589",
    category: "domestic",
    primaryField: "Văn hóa - Nghệ thuật",
    fields: [
      "Văn hóa - Nghệ thuật",
      "HĐGS Liên ngành Văn hóa - Nghệ thuật - TDTT",
      "HĐGS Ngành Triết học - Xã hội học - Xã hội",
    ],
    website: "http://vanhoanghethuat.vn",
    websiteVerified: true,
    maxScore: 1.0,
    maxScoreYear: 2025,
    scores: [
      {
        id: "PTS-001",
        journalId: "TC-VHNT-001",
        councilCode: "HDGS_VHNT",
        councilName: "HĐGS Liên ngành Văn hóa - Nghệ thuật - TDTT",
        year: 2025,
        maxScore: 1.0,
        minScore: 0,
        decisionNumber: "26/QĐ-HĐGSNN",
        decisionDate: "2025-07-11",
        notes: "Tính điểm tất cả các bài nghiên cứu mỹ thuật, văn hóa",
      },
      {
        id: "PTS-002",
        journalId: "TC-VHNT-001",
        councilCode: "HDGS_TRIETHOC",
        councilName: "HĐGS Ngành Triết học - Xã hội học - Xã hội",
        year: 2025,
        maxScore: 0.75,
        minScore: 0,
        decisionNumber: "26/QĐ-HĐGSNN",
        decisionDate: "2025-07-11",
        notes: "Tính điểm chuyên mục nghiên cứu lý luận văn hóa",
      },
      {
        id: "PTS-003",
        journalId: "TC-VHNT-001",
        councilCode: "HDGS_VHNT",
        councilName: "HĐGS Liên ngành Văn hóa - Nghệ thuật - TDTT",
        year: 2024,
        maxScore: 0.75,
        minScore: 0,
        decisionNumber: "22/QĐ-HĐGSNN",
        decisionDate: "2024-07-05",
      },
    ],
    guidelines: {
      hasGuidelines: true,
      summary:
        "Bài nghiên cứu gốc, cấu trúc chuẩn gồm Đặt vấn đề, Phương pháp nghiên cứu, Kết quả, Thảo luận và Kết luận. Có tóm tắt tiếng Anh 150-250 từ.",
      manuscriptFormat: "Microsoft Word (.docx)",
      wordLimitMin: 4000,
      wordLimitMax: 7000,
      pageLimit: "8 - 14 trang",
      templateUrl: "http://vanhoanghethuat.vn/templates/mau-bai-bao-vhnt.docx",
      citationStyle: "APA 7th",
      publicationLanguage: "Tiếng Việt, Tiếng Anh",
      reviewFee: "Miễn phí",
      publicationFee: "Theo quy định tòa soạn",
      publicationFrequency: "12 kỳ/năm (Hằng tháng)",
      reviewTimeWeeks: "4 - 6 tuần",
      submissionUrl: "http://vanhoanghethuat.vn/gui-bai-truc-tuyen",
      editorialEmail: "toasoan@vanhoanghethuat.vn",
      contactPhone: "024.38221844",
      officeAddress: "Số 32 Hào Nam, Đống Đa, Hà Nội",
    },
    links: [
      {
        id: "LINK-001",
        journalId: "TC-VHNT-001",
        linkType: "Trang chủ",
        label: "Website Tòa soạn Văn hóa Nghệ thuật",
        url: "http://vanhoanghethuat.vn",
        isVerified: true,
        verifiedAt: "2025-07-15",
      },
    ],
    verification: {
      status: "verified",
      verifiedBy: "Spark Agent",
      verifiedDate: "2025-07-15",
      sourceReference: "Quyết định 26/QĐ-HĐGSNN, Phụ lục ngành VHNT-TDTT",
      schemaVersion: 1,
    },
    status: "active",
    isManualEdited: false,
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
    createdBy: "Spark Official Template",
  },
  {
    id: "TC-KT-002",
    journalId: "TC-KT-002",
    name: "Tạp chí Kiến trúc",
    englishName: "Architecture Magazine",
    abbreviation: "TAPCHIKIENTRUC",
    publisher: "Hội Kiến trúc sư Việt Nam",
    issnPrint: "0866-8612",
    category: "domestic",
    primaryField: "Kiến trúc - Quy hoạch",
    fields: [
      "Kiến trúc - Quy hoạch",
      "HĐGS Ngành Kiến trúc",
      "HĐGS Ngành Xây dựng",
    ],
    website: "https://www.tapchikientruc.com.vn",
    websiteVerified: true,
    maxScore: 1.0,
    maxScoreYear: 2025,
    scores: [
      {
        id: "PTS-004",
        journalId: "TC-KT-002",
        councilCode: "HDGS_KIENTRUC",
        councilName: "HĐGS Ngành Kiến trúc",
        year: 2025,
        maxScore: 1.0,
        minScore: 0,
        decisionNumber: "26/QĐ-HĐGSNN",
        decisionDate: "2025-07-11",
      },
      {
        id: "PTS-005",
        journalId: "TC-KT-002",
        councilCode: "HDGS_XAYDUNG",
        councilName: "HĐGS Ngành Xây dựng",
        year: 2025,
        maxScore: 0.5,
        minScore: 0,
        decisionNumber: "26/QĐ-HĐGSNN",
        decisionDate: "2025-07-11",
      },
    ],
    guidelines: {
      hasGuidelines: true,
      summary:
        "Bài viết chuyên sâu về kiến trúc, nội thất, bảo tồn di sản hoặc công trình xanh. Yêu cầu hình ảnh, bản vẽ chất lượng cao tối thiểu 300 DPI.",
      manuscriptFormat: "Microsoft Word (.docx) kèm ảnh rời",
      wordLimitMin: 2500,
      wordLimitMax: 5000,
      pageLimit: "4 - 8 trang",
      templateUrl: "https://www.tapchikientruc.com.vn/bieu-mau/mau-bai.docx",
      citationStyle: "Chicago / TCVN",
      publicationLanguage: "Tiếng Việt",
      reviewFee: "Miễn phí",
      publicationFee: "Miễn phí",
      publicationFrequency: "12 kỳ/năm",
      reviewTimeWeeks: "3 - 5 tuần",
      submissionUrl: "https://www.tapchikientruc.com.vn/gui-bai",
      editorialEmail: "tapchikientruc@kientrucvn.org.vn",
      contactPhone: "024.38246361",
      officeAddress: "40 Tăng Bạt Hổ, Hai Bà Trưng, Hà Nội",
    },
    verification: {
      status: "verified",
      verifiedBy: "Spark Agent",
      verifiedDate: "2025-07-15",
      sourceReference: "Quyết định 26/QĐ-HĐGSNN, Phụ lục ngành Kiến trúc",
      schemaVersion: 1,
    },
    status: "active",
    isManualEdited: false,
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
    createdBy: "Spark Official Template",
  },
  {
    id: "TC-NCMT-003",
    journalId: "TC-NCMT-003",
    name: "Tạp chí Nghiên cứu Mỹ thuật",
    englishName: "Journal of Fine Arts Research",
    abbreviation: "JFAR",
    publisher: "Viện Mỹ thuật - Trường Đại học Mỹ thuật Việt Nam",
    issnPrint: "1859-3283",
    category: "domestic",
    primaryField: "Mỹ thuật ứng dụng",
    fields: ["Mỹ thuật ứng dụng", "HĐGS Liên ngành Văn hóa - Nghệ thuật - TDTT"],
    website: "",
    websiteVerified: false,
    maxScore: 0.75,
    maxScoreYear: 2025,
    scores: [
      {
        id: "PTS-006",
        journalId: "TC-NCMT-003",
        councilCode: "HDGS_VHNT",
        councilName: "HĐGS Liên ngành Văn hóa - Nghệ thuật - TDTT",
        year: 2025,
        maxScore: 0.75,
        minScore: 0,
        decisionNumber: "26/QĐ-HĐGSNN",
        decisionDate: "2025-07-11",
      },
    ],
    guidelines: {
      hasGuidelines: false,
      summary: "Liên hệ trực tiếp tòa soạn Viện Mỹ thuật để nhận bản thể lệ chi tiết.",
      publicationLanguage: "Tiếng Việt",
      editorialEmail: "vienmythuat@mythuatvietnam.edu.vn",
      contactPhone: "024.38263008",
      officeAddress: "42 Yết Kiêu, Hoàn Kiếm, Hà Nội",
    },
    verification: {
      status: "unverified",
      verifiedBy: "Spark Agent",
      verifiedDate: "2025-07-15",
      sourceReference: "Quyết định 26/QĐ-HĐGSNN",
      schemaVersion: 1,
    },
    status: "active",
    isManualEdited: false,
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
    createdBy: "Spark Official Template",
  },
];

export type CandidateQueueTab = "today" | "pending" | "needs_review" | "approved" | "rejected" | "all";

const isTodayDate = (dateStr?: string | null): boolean => {
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
): "today" | "pending" | "needs_review" | "approved" | "rejected" => {
  if (c.status === "rejected") return "rejected";
  if (c.status === "approved") return "approved";
  if (c.status === "needs_review" || c.verification?.manualReviewNeeded) return "needs_review";
  if (isTodayDate(c.createdAt)) return "today";
  return "pending";
};


export const JournalDirectoryPage: React.FC = () => {
  const { profile, user } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "owner";

  // Main Page View Mode for Admin: "public_directory" vs "queue"
  const [adminViewMode, setAdminViewMode] = useState<"public_directory" | "queue">("public_directory");

  // Tab: domestic | international
  const [activeCategoryTab, setActiveCategoryTab] = useState<JournalCategory>("domestic");

  // Public Journals State
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filters for Public View
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
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [candidateForReview, setCandidateForReview] = useState<JournalCandidate | null>(null);

  // Subscribe to Firestore journals
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeJournals(
      (data) => {
        if (data.length === 0) {
          setJournals(DEFAULT_SAMPLE_JOURNALS);
        } else {
          setJournals(data);
        }
        setLoading(false);
      },
      { includeHidden: isAdmin && showHidden }
    );

    return () => unsubscribe();
  }, [isAdmin, showHidden]);

  // Subscribe to Journal Candidates if Admin
  useEffect(() => {
    if (!isAdmin) return;
    const unsub = subscribeJournalCandidates((cands) => {
      setCandidates(cands);
    });
    return () => unsub();
  }, [isAdmin]);

  // Calculate candidate non-overlapping counts
  const candidateTabCounts = useMemo(() => {
    const counts: Record<CandidateQueueTab, number> = {
      today: 0,
      pending: 0,
      needs_review: 0,
      approved: 0,
      rejected: 0,
      all: candidates.length,
    };
    candidates.forEach((c) => {
      const cat = getJournalCandidateCategory(c);
      counts[cat]++;
    });
    return counts;
  }, [candidates]);

  // Unique fields & years
  const uniqueFields = useMemo(() => {
    const set = new Set<string>();
    journals.forEach((j) => {
      if (j.primaryField) set.add(j.primaryField);
      (j.fields || []).forEach((f) => set.add(f));
    });
    return Array.from(set).sort();
  }, [journals]);

  const uniqueYears = useMemo(() => {
    const set = new Set<number>();
    journals.forEach((j) => {
      if (j.maxScoreYear) set.add(j.maxScoreYear);
      (j.scores || []).forEach((s) => {
        if (s.year) set.add(s.year);
      });
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [journals]);

  // Filtered public journals
  const filteredJournals = useMemo(() => {
    return journals.filter((j) => {
      if (j.category !== activeCategoryTab) return false;
      if (!showHidden && j.status === "hidden") return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchTitle = j.name?.toLowerCase().includes(q) || false;
        const matchEnglish = j.englishName?.toLowerCase().includes(q) || false;
        const matchPub = j.publisher?.toLowerCase().includes(q) || false;
        const matchIssn =
          (j.issnPrint && j.issnPrint.toLowerCase().includes(q)) ||
          (j.issnOnline && j.issnOnline.toLowerCase().includes(q)) ||
          false;
        const matchField =
          j.primaryField?.toLowerCase().includes(q) ||
          (j.fields || []).some((f) => f.toLowerCase().includes(q));

        if (!matchTitle && !matchEnglish && !matchPub && !matchIssn && !matchField) {
          return false;
        }
      }

      if (selectedField !== "ALL") {
        const hasField =
          j.primaryField === selectedField || (j.fields || []).includes(selectedField);
        if (!hasField) return false;
      }

      if (selectedMinScore !== "ALL") {
        const minVal = parseFloat(selectedMinScore);
        if (isNaN(minVal) || j.maxScore < minVal) return false;
      }

      if (selectedYear !== "ALL") {
        const y = parseInt(selectedYear, 10);
        const hasYear =
          j.maxScoreYear === y || (j.scores || []).some((s) => s.year === y);
        if (!hasYear) return false;
      }

      if (selectedInfoStatus !== "ALL") {
        if (selectedInfoStatus === "has_guidelines") {
          if (!j.guidelines?.hasGuidelines) return false;
        } else if (selectedInfoStatus === "verified_website") {
          if (!j.website || !j.websiteVerified) return false;
        } else if (selectedInfoStatus === "no_website") {
          if (j.website && j.website.trim().length > 0) return false;
        }
      }

      return true;
    });
  }, [
    journals,
    activeCategoryTab,
    searchTerm,
    selectedField,
    selectedMinScore,
    selectedYear,
    selectedInfoStatus,
    showHidden,
  ]);

  // Filtered candidate items
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      // Tab filter
      if (candidateFilterTab !== "all") {
        const cat = getJournalCandidateCategory(c);
        if (cat !== candidateFilterTab) return false;
      }

      // Search filter
      if (candidateSearch.trim()) {
        const q = candidateSearch.toLowerCase().trim();
        const matchTitle = c.name?.toLowerCase().includes(q) || false;
        const matchId = c.journalId?.toLowerCase().includes(q) || false;
        const matchPub = c.publisher?.toLowerCase().includes(q) || false;
        if (!matchTitle && !matchId && !matchPub) return false;
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
          `Đã duyệt thành công ${res.successCount} bản ghi! Lưu ý: ${res.skippedWarningCount} bản ghi có cảnh báo kiểm tra thủ công đã được giữ lại trong danh sách để Admin đối chiếu riêng.`
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

  return (
    <div className="journal-directory-page" style={{ padding: "20px 24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Top Banner & Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          marginBottom: "20px",
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
            Tra cứu hồ sơ định danh, chỉ số ISSN/E-ISSN, khung điểm Hội đồng Giáo sư Nhà nước và thể lệ công bố dành cho giảng viên Khoa Mỹ thuật Công nghiệp — TDTU.
          </p>
        </div>

        {/* Admin Action Toolbar */}
        {isAdmin && (
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => setIsSyncModalOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "6px",
                color: "#166534",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
              }}
              title="Đồng bộ dữ liệu điều tra từ Google Sheets của Khoa"
            >
              <UploadCloud size={16} />
              Đồng bộ Google Sheets
            </button>

            <button
              onClick={() => setIsImportOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                backgroundColor: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                color: "#1e3a8a",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
              }}
            >
              <Upload size={16} />
              Nhập Excel
            </button>

            <button
              onClick={() => {
                setJournalForForm(null);
                setIsFormOpen(true);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                backgroundColor: "#1e3a8a",
                border: "none",
                borderRadius: "6px",
                color: "#ffffff",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
              }}
            >
              <Plus size={16} />
              Thêm tạp chí
            </button>
          </div>
        )}
      </div>

      {/* Admin View Mode Switcher: Công khai vs Hàng chờ duyệt */}
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
            }}
          >
            <BookOpen size={16} />
            Danh mục Công khai ({journals.length})
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
            }}
          >
            <Sparkles size={16} color="#2563eb" />
            Hàng chờ Duyệt (Spark)
            {candidateTabCounts.pending + candidateTabCounts.today > 0 && (
              <span
                style={{
                  backgroundColor: "#dc2626",
                  color: "#ffffff",
                  fontSize: "0.75rem",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  fontWeight: 700,
                }}
              >
                {candidateTabCounts.pending + candidateTabCounts.today}
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
              borderBottom: "1px solid #e2e8f0",
              gap: "6px",
              flexWrap: "wrap",
            }}
          >
            {(
              [
                { id: "pending", label: "Chờ duyệt", count: candidateTabCounts.pending, color: "#2563eb" },
                { id: "today", label: "Mới hôm nay", count: candidateTabCounts.today, color: "#16a34a" },
                { id: "needs_review", label: "Cần hiệu chỉnh", count: candidateTabCounts.needs_review, color: "#d97706" },
                { id: "approved", label: "Đã duyệt", count: candidateTabCounts.approved, color: "#059669" },
                { id: "rejected", label: "Từ chối", count: candidateTabCounts.rejected, color: "#dc2626" },
                { id: "all", label: "Tất cả", count: candidateTabCounts.all, color: "#475569" },
              ] as const
            ).map((t) => (
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
                  padding: "10px 16px",
                  background: "none",
                  border: "none",
                  borderBottom: candidateFilterTab === t.id ? `3px solid ${t.color}` : "3px solid transparent",
                  color: candidateFilterTab === t.id ? t.color : "#64748b",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                  marginBottom: "-1px",
                }}
              >
                <span>{t.label}</span>
                <span
                  style={{
                    backgroundColor: candidateFilterTab === t.id ? "#eff6ff" : "#f1f5f9",
                    color: candidateFilterTab === t.id ? t.color : "#64748b",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                  }}
                >
                  {t.count}
                </span>
              </button>
            ))}
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
            <div style={{ position: "relative", minWidth: "280px" }}>
              <Search
                size={16}
                style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}
              />
              <input
                type="text"
                placeholder="Tìm theo tên tạp chí, mã định danh, cơ quan xuất bản..."
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
              {(candidateFilterTab === "pending" || candidateFilterTab === "today") && selectedCandidateIds.length > 0 && (
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

              <button
                onClick={() => setIsSyncModalOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  color: "#1e3a8a",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <RefreshCw size={14} />
                Đồng bộ Sheet mới
              </button>
            </div>
          </div>

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
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "10px 12px", width: "36px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={
                          filteredCandidates.length > 0 &&
                          selectedCandidateIds.length === filteredCandidates.length
                        }
                        onChange={toggleSelectAllCandidates}
                      />
                    </th>
                    <th style={{ padding: "10px 12px" }}>Mã & Tên tạp chí</th>
                    <th style={{ padding: "10px 12px" }}>Loại thay đổi</th>
                    <th style={{ padding: "10px 12px" }}>Cơ quan xuất bản</th>
                    <th style={{ padding: "10px 12px" }}>Điểm HĐGS</th>
                    <th style={{ padding: "10px 12px" }}>Trạng thái</th>
                    <th style={{ padding: "10px 12px", textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map((c) => {
                    const isSelected = selectedCandidateIds.includes(c.id);
                    return (
                      <tr
                        key={c.id}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          backgroundColor: isSelected ? "#f0fdf4" : "#ffffff",
                        }}
                      >
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectCandidate(c.id)}
                          />
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ fontWeight: 700, color: "#0f172a" }}>{c.journalId}</div>
                          <div style={{ color: "#334155" }}>{c.name}</div>
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "3px" }}>
                            {c.isManualPreserved && (
                              <span style={{ fontSize: "0.72rem", color: "#854d0e", backgroundColor: "#fefce8", padding: "1px 5px", borderRadius: "3px" }}>
                                Đã sửa thủ công
                              </span>
                            )}
                            {c.verification?.manualReviewNeeded && (
                              <span
                                style={{
                                  fontSize: "0.72rem",
                                  color: "#92400e",
                                  backgroundColor: "#fef3c7",
                                  padding: "1px 6px",
                                  borderRadius: "3px",
                                  border: "1px solid #fde68a",
                                  fontWeight: 600,
                                }}
                                title={c.verification.manualReviewReason || "Cần kiểm tra thủ công"}
                              >
                                ⚠ Cần kiểm tra thủ công
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: "10px 12px" }}>
                          {c.changeType === "create" ? (
                            <span style={{ color: "#059669", fontWeight: 700 }}>Tạp chí mới</span>
                          ) : (
                            <div>
                              <span style={{ color: "#2563eb", fontWeight: 700 }}>Cập nhật</span>
                              <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                                {c.diffSummary?.length || 0} trường thay đổi
                              </div>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#475569" }}>{c.publisher}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ fontWeight: 700, color: "#166534" }}>
                            {c.maxScore > 0 ? c.maxScore.toFixed(2) : "0"} ({c.maxScoreYear})
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          {c.status === "approved" ? (
                            <span style={{ color: "#166534", fontWeight: 600 }}>Đã duyệt</span>
                          ) : c.status === "rejected" ? (
                            <span style={{ color: "#991b1b", fontWeight: 600 }}>Từ chối</span>
                          ) : c.status === "needs_review" ? (
                            <span style={{ color: "#854d0e", fontWeight: 600 }}>Cần hiệu chỉnh</span>
                          ) : (
                            <span style={{ color: "#1e40af", fontWeight: 600 }}>Chờ duyệt</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                          <button
                            onClick={() => setCandidateForReview(c)}
                            style={{
                              padding: "5px 12px",
                              borderRadius: "6px",
                              backgroundColor: "#1e3a8a",
                              color: "#ffffff",
                              border: "none",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Xem & Duyệt
                          </button>
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
                Bấm "Đồng bộ Sheet mới" để nạp dữ liệu điều tra từ Google Sheets của Spark.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW B: PUBLIC JOURNALS DIRECTORY (DANH MỤC TẠP CHÍ CÔNG KHAI)            */
        /* ========================================================================= */
        <div>
          {/* Main Tabs: Trong nước vs Quốc tế */}
          <div
            style={{
              display: "flex",
              borderBottom: "2px solid #e2e8f0",
              marginBottom: "20px",
              gap: "8px",
            }}
          >
            <button
              onClick={() => setActiveCategoryTab("domestic")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 20px",
                background: "none",
                border: "none",
                borderBottom: activeCategoryTab === "domestic" ? "3px solid #1e3a8a" : "3px solid transparent",
                color: activeCategoryTab === "domestic" ? "#1e3a8a" : "#64748b",
                fontWeight: 700,
                fontSize: "0.95rem",
                cursor: "pointer",
                marginBottom: "-2px",
                transition: "all 0.15s ease",
              }}
            >
              <BookOpen size={18} />
              Tạp chí trong nước ({journals.filter((j) => j.category === "domestic").length})
            </button>

            <button
              onClick={() => setActiveCategoryTab("international")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 20px",
                background: "none",
                border: "none",
                borderBottom: activeCategoryTab === "international" ? "3px solid #1e3a8a" : "3px solid transparent",
                color: activeCategoryTab === "international" ? "#1e3a8a" : "#64748b",
                fontWeight: 700,
                fontSize: "0.95rem",
                cursor: "pointer",
                marginBottom: "-2px",
                transition: "all 0.15s ease",
              }}
            >
              <Globe size={18} />
              Tạp chí quốc tế
              <span
                style={{
                  fontSize: "0.72rem",
                  backgroundColor: "#fef3c7",
                  color: "#92400e",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontWeight: 600,
                }}
              >
                Sắp ra mắt
              </span>
            </button>
          </div>

          {/* Tab Content */}
          {activeCategoryTab === "international" ? (
            /* Tab Quốc tế: Placeholder */
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                backgroundColor: "#f8fafc",
                borderRadius: "12px",
                border: "1px dashed #cbd5e1",
                maxWidth: "700px",
                margin: "40px auto",
              }}
            >
              <Globe size={48} color="#94a3b8" style={{ marginBottom: "16px" }} />
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>
                Danh mục Tạp chí Quốc tế (Scopus, WoS, ESCI)
              </h3>
              <p style={{ color: "#64748b", fontSize: "0.9rem", lineHeight: 1.6, maxWidth: "520px", margin: "0 auto 20px auto" }}>
                Cấu trúc danh mục quốc tế đang được chuẩn bị để tích hợp dữ liệu chỉ số SJR, CiteScore, Q-ranking và các tạp chí uy tín thuộc ngành Thiết kế & Nghệ thuật ứng dụng trong giai đoạn tiếp theo.
              </p>
              <button
                onClick={() => setActiveCategoryTab("domestic")}
                style={{
                  padding: "8px 18px",
                  backgroundColor: "#1e3a8a",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Xem danh mục Tạp chí trong nước
              </button>
            </div>
          ) : (
            /* Tab Trong nước */
            <div>
              {/* Search Bar & Multi-filter Box */}
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
                      Nhóm ngành / Hội đồng
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
                      <option value="1.0">Từ 1.00 điểm trở lên</option>
                      <option value="0.75">Từ 0.75 điểm trở lên</option>
                      <option value="0.5">Từ 0.50 điểm trở lên</option>
                      <option value="0.25">Từ 0.25 điểm trở lên</option>
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
                }}
              >
                <div>
                  Hiển thị <strong>{filteredJournals.length}</strong> / {journals.filter((j) => j.category === "domestic").length} tạp chí trong nước
                </div>

                {(searchTerm || selectedField !== "ALL" || selectedMinScore !== "ALL" || selectedYear !== "ALL" || selectedInfoStatus !== "ALL") && (
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedField("ALL");
                      setSelectedMinScore("ALL");
                      setSelectedYear("ALL");
                      setSelectedInfoStatus("ALL");
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
                    Thử thay đổi từ khóa tìm kiếm hoặc bỏ bớt các tiêu chí lọc.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <JournalDetailModal
        isOpen={Boolean(selectedJournalForDetail)}
        onClose={() => setSelectedJournalForDetail(null)}
        journal={selectedJournalForDetail}
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

      {isSyncModalOpen && user && (
        <JournalSyncModal
          isOpen={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
          user={{ uid: user.uid, email: user.email || "" }}
          onSyncComplete={() => {
            setAdminViewMode("queue");
            setCandidateFilterTab("pending");
          }}
        />
      )}

      {candidateForReview && user && (
        <JournalCandidateReviewModal
          isOpen={Boolean(candidateForReview)}
          onClose={() => setCandidateForReview(null)}
          candidate={candidateForReview}
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
