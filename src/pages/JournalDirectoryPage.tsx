import React, { useState, useEffect, useMemo } from "react";
import type { Journal, JournalCategory } from "../types/journal";
import {
  subscribeJournals,
  createJournal,
  updateJournal,
  setJournalStatus,
  deleteJournal,
} from "../services/journalService";
import { useAuth } from "../firebase/auth";
import { JournalCard } from "../components/JournalCard";
import { JournalDetailModal } from "../components/JournalDetailModal";
import { JournalFormModal } from "../components/JournalFormModal";
import { JournalExcelImportModal } from "../components/JournalExcelImportModal";
import {
  BookOpen,
  Search,
  Filter,
  Plus,
  Upload,
  Globe,
  Award,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
  X,
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
    website: "", // Không có website
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

export const JournalDirectoryPage: React.FC = () => {
  const { profile, user } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "owner";

  // Tab: domestic | international
  const [activeTab, setActiveTab] = useState<JournalCategory>("domestic");

  // State for journals list
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedField, setSelectedField] = useState<string>("ALL");
  const [selectedMinScore, setSelectedMinScore] = useState<string>("ALL");
  const [selectedYear, setSelectedYear] = useState<string>("ALL");
  const [selectedInfoStatus, setSelectedInfoStatus] = useState<string>("ALL");
  const [showHidden, setShowHidden] = useState<boolean>(false);

  // Modals state
  const [selectedJournalForDetail, setSelectedJournalForDetail] = useState<Journal | null>(null);
  const [journalForForm, setJournalForForm] = useState<Journal | null>(null);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);

  // Subscribe to Firestore journals
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeJournals(
      (data) => {
        if (data.length === 0) {
          // If Firestore is empty initially, fallback to official QĐ 26 seeds
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

  // Extract unique fields & years for dropdown filters
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

  // Filter journals
  const filteredJournals = useMemo(() => {
    return journals.filter((j) => {
      // 1. Tab match
      if (j.category !== activeTab) return false;

      // 2. Hidden filter
      if (!showHidden && j.status === "hidden") return false;

      // 3. Search term (title, publisher, issn, field)
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

      // 4. Field filter
      if (selectedField !== "ALL") {
        const hasField =
          j.primaryField === selectedField || (j.fields || []).includes(selectedField);
        if (!hasField) return false;
      }

      // 5. Min score filter
      if (selectedMinScore !== "ALL") {
        const minVal = parseFloat(selectedMinScore);
        if (isNaN(minVal) || j.maxScore < minVal) return false;
      }

      // 6. Year filter
      if (selectedYear !== "ALL") {
        const y = parseInt(selectedYear, 10);
        const hasYear =
          j.maxScoreYear === y || (j.scores || []).some((s) => s.year === y);
        if (!hasYear) return false;
      }

      // 7. Info status filter
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
    activeTab,
    searchTerm,
    selectedField,
    selectedMinScore,
    selectedYear,
    selectedInfoStatus,
    showHidden,
  ]);

  // Actions
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
          onClick={() => setActiveTab("domestic")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "domestic" ? "3px solid #1e3a8a" : "3px solid transparent",
            color: activeTab === "domestic" ? "#1e3a8a" : "#64748b",
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
          onClick={() => setActiveTab("international")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 20px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "international" ? "3px solid #1e3a8a" : "3px solid transparent",
            color: activeTab === "international" ? "#1e3a8a" : "#64748b",
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
      {activeTab === "international" ? (
        /* Tab Quốc tế: Placeholder chuẩn bị cấu trúc */
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
            onClick={() => setActiveTab("domestic")}
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
        /* Tab Trong nước: Triển khai đầy đủ */
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
          onImportComplete={() => {
            // Subscription will refresh automatically
          }}
        />
      )}
    </div>
  );
};
