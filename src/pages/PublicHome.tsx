import React, { useState, useEffect, useMemo } from "react";
import type { Opportunity } from "../types";
import type { Journal } from "../types/journal";
import { fetchPublishedOpportunities } from "../firebase/firestore";
import {
  subscribeJournals,
  filterJournalsList,
  sortJournalsList,
  getAvailableCouncilsFromJournals,
} from "../services/journalService";
import { DEFAULT_FACULTY_COUNCIL_ID } from "../services/journalGoogleSheetService";
import { getOpportunityDeadlineInfo } from "../utils/date";
import { OpportunityCard } from "../components/OpportunityCard";
import { OpportunityDetailModal } from "../components/OpportunityDetailModal";
import { JournalCard } from "../components/JournalCard";
import { JournalDetailModal } from "../components/JournalDetailModal";
import {
  Search,
  Filter,
  Award,
  AlertCircle,
  RefreshCw,
  Clock,
  Compass,
  BookOpen,
  X,
  Layers,
} from "lucide-react";

const FILTER_TAGS = [
  "Tất cả",
  "Rất phù hợp MTCN",
  "AI",
  "Thiết kế",
  "Nghệ thuật số",
  "Giáo dục",
  "Phát triển bền vững",
  "Văn hóa / nghệ thuật",
  "Quốc tế",
  "Trong nước",
];

const EXPIRED_TAB = "Hết hạn";

export type PublicHomeTab = "conferences" | "journals";

/**
 * Pure helper to resolve active home tab from URL search query or hash.
 * Defaults to "conferences" (Hội thảo).
 */
export function resolveHomeTabFromUrl(
  search: string = typeof window !== "undefined" ? window.location.search : "",
  hash: string = typeof window !== "undefined" ? window.location.hash : ""
): PublicHomeTab {
  try {
    const params = new URLSearchParams(search);
    const tabParam = (params.get("tab") || "").toLowerCase().trim();
    if (
      tabParam === "journals" ||
      tabParam === "journal" ||
      tabParam === "tap-chi" ||
      tabParam === "tap_chi"
    ) {
      return "journals";
    }
  } catch {
    // ignore URLSearchParams error
  }

  const cleanHash = hash.replace(/^#\/?/, "").toLowerCase().trim();
  if (cleanHash === "journals" || cleanHash === "journal_directory") {
    return "journals";
  }

  return "conferences";
}

/**
 * Pure helper preserved for compatibility; note that PublicHome does NOT mutate window.location
 * when switching tabs or filters so it works seamlessly inside iframes.
 */
export function buildHomeTabUrl(tab: PublicHomeTab): string {
  return tab === "journals" ? "/?tab=journals" : "/";
}

export const getOpportunityCategory = (opp: Opportunity): "TN" | "QT" => {
  if (opp.category === "TN" || opp.category === "QT") return opp.category;
  if (opp.conferenceCode?.startsWith("QT")) return "QT";
  if (opp.conferenceCode?.startsWith("TN")) return "TN";
  const c = String(opp.country || "").trim().toLowerCase();
  if (c && c !== "việt nam" && c !== "vietnam" && c !== "vn" && c !== "viet nam") {
    return "QT";
  }
  return "TN";
};

export const PublicHome: React.FC = () => {
  // Active Main Tab: "conferences" (Hội thảo - default) | "journals" (Tạp chí)
  const [activeMainTab, setActiveMainTab] = useState<PublicHomeTab>(() =>
    resolveHomeTabFromUrl()
  );

  // ============================================================================
  // TAB 1 STATE: HỘI THẢO (CONFERENCES & ACADEMIC OPPORTUNITIES)
  // ============================================================================
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("Tất cả");
  const [selectedCategory, setSelectedCategory] = useState<"ALL" | "TN" | "QT">("ALL");
  const [selectedType, setSelectedType] = useState("Tất cả");
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);

  // ============================================================================
  // TAB 2 STATE: TẠP CHÍ (APPROVED DOMESTIC JOURNALS & MULTI-COUNCIL SCORES)
  // ============================================================================
  const [journals, setJournals] = useState<Journal[]>([]);
  const [journalsLoading, setJournalsLoading] = useState(true);
  const [selectedCouncilId, setSelectedCouncilId] = useState<string>(
    DEFAULT_FACULTY_COUNCIL_ID
  );
  const [councilScope, setCouncilScope] = useState<"has_score" | "all">("has_score");
  const [journalSearch, setJournalSearch] = useState("");
  const [journalField, setJournalField] = useState("all");
  const [journalScore, setJournalScore] = useState("all");
  const [journalYear, setJournalYear] = useState("all");
  const [journalGuidelineStatus, setJournalGuidelineStatus] = useState("all");
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await fetchPublishedOpportunities();
      setOpportunities(list);
    } catch (err: any) {
      console.error(err);
      setError("Không thể tải dữ liệu NCKH. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Subscribe to approved active journals from Firestore `journals` collection
  useEffect(() => {
    setJournalsLoading(true);
    const unsub = subscribeJournals(
      (data) => {
        setJournals(data);
        setJournalsLoading(false);
      },
      { includeHidden: false }
    );
    return () => unsub();
  }, []);

  // Sync activeMainTab with custom navigation events without mutating URL
  useEffect(() => {
    const syncTabFromLocation = () => {
      setActiveMainTab(
        resolveHomeTabFromUrl(window.location.search, window.location.hash)
      );
    };

    window.addEventListener("popstate", syncTabFromLocation);
    window.addEventListener("ifa-home-tab-change", syncTabFromLocation);
    return () => {
      window.removeEventListener("popstate", syncTabFromLocation);
      window.removeEventListener("ifa-home-tab-change", syncTabFromLocation);
    };
  }, []);

  /**
   * Switch main tab in React state only — NEVER mutate URL/query/hash
   * so iframe embedding on https://ifa.tdtu.edu.vn/ stays stable.
   */
  const handleSelectMainTab = (tab: PublicHomeTab) => {
    setActiveMainTab(tab);
  };

  // ============================================================================
  // DERIVED DATA FOR TAB 1: HỘI THẢO
  // ============================================================================
  const isExpiredOpp = (opp: Opportunity) =>
    getOpportunityDeadlineInfo(opp).isExpired;

  const activeOpportunities = opportunities.filter((opp) => !isExpiredOpp(opp));
  const expiredOpportunities = opportunities.filter((opp) => isExpiredOpp(opp));

  const isInExpiredTab = selectedTag === EXPIRED_TAB;
  const basePool = isInExpiredTab ? expiredOpportunities : activeOpportunities;

  const countTN = useMemo(
    () => basePool.filter((o) => getOpportunityCategory(o) === "TN").length,
    [basePool]
  );
  const countQT = useMemo(
    () => basePool.filter((o) => getOpportunityCategory(o) === "QT").length,
    [basePool]
  );

  const filteredOpportunities = basePool.filter((opp) => {
    const oppCat = getOpportunityCategory(opp);
    const matchCategory =
      selectedCategory === "ALL" || oppCat === selectedCategory;

    const matchQuery =
      searchQuery.trim() === "" ||
      (opp.conferenceCode && opp.conferenceCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
      opp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opp.organizer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (opp.field && opp.field.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (opp.topic && opp.topic.toLowerCase().includes(searchQuery.toLowerCase()));

    let matchTag = false;
    if (isInExpiredTab) {
      matchTag = true;
    } else if (selectedTag === "Tất cả") {
      matchTag = true;
    } else if (selectedTag === "Quốc tế") {
      matchTag = opp.level === "Quốc tế";
    } else if (selectedTag === "Trong nước") {
      matchTag = opp.level !== "Quốc tế";
    } else if (selectedTag === "Rất phù hợp MTCN") {
      matchTag =
        (opp.suitability || "").toLowerCase().includes("rất phù hợp") ||
        (opp.tags || []).some((t) => t.toLowerCase().includes("rất phù hợp"));
    } else if (opp.tags && opp.tags.length > 0) {
      matchTag = opp.tags.some(
        (t) =>
          t.toLowerCase() === selectedTag.toLowerCase() ||
          t.toLowerCase().includes(selectedTag.toLowerCase())
      );
    }

    const matchType = selectedType === "Tất cả" || opp.type === selectedType;

    return matchCategory && matchQuery && matchTag && matchType;
  });

  // ============================================================================
  // DERIVED DATA FOR TAB 2: TẠP CHÍ (DOMESTIC ACTIVE JOURNALS ONLY)
  // ============================================================================
  const domesticActiveJournals = useMemo(
    () =>
      journals.filter(
        (j) => j.category === "domestic" && j.status === "active"
      ),
    [journals]
  );

  // Dynamic list of Professor Councils from published journals (always includes HD24 first)
  const availableCouncils = useMemo(
    () => getAvailableCouncilsFromJournals(domesticActiveJournals),
    [domesticActiveJournals]
  );

  const selectedCouncilMeta = useMemo(
    () =>
      availableCouncils.find((c) => c.councilId === selectedCouncilId) || {
        councilId: selectedCouncilId,
        councilName:
          selectedCouncilId === "ALL"
            ? "Tất cả Hội đồng Giáo sư"
            : "Văn hóa – Nghệ thuật – Thể dục thể thao",
        journalCount: domesticActiveJournals.length,
      },
    [availableCouncils, selectedCouncilId, domesticActiveJournals.length]
  );

  const uniqueJournalFields = useMemo(() => {
    const set = new Set<string>();
    domesticActiveJournals.forEach((j) => {
      if (j.primaryField) set.add(j.primaryField);
      (j.fields || []).forEach((f) => set.add(f));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [domesticActiveJournals]);

  const uniqueJournalYears = useMemo(() => {
    const set = new Set<number>();
    domesticActiveJournals.forEach((j) => {
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
  }, [domesticActiveJournals]);

  const filteredJournals = useMemo(() => {
    const list = filterJournalsList(domesticActiveJournals, {
      category: "domestic",
      onlyActive: true,
      searchQuery: journalSearch,
      selectedField: journalField,
      selectedScore: journalScore,
      selectedYear: journalYear,
      selectedGuidelineStatus: journalGuidelineStatus,
      selectedCouncilId,
      councilScope,
    });
    return sortJournalsList(list, "score_desc", selectedCouncilId);
  }, [
    domesticActiveJournals,
    journalSearch,
    journalField,
    journalScore,
    journalYear,
    journalGuidelineStatus,
    selectedCouncilId,
    councilScope,
  ]);

  const hasActiveJournalFilters =
    journalSearch.trim().length > 0 ||
    journalField !== "all" ||
    journalScore !== "all" ||
    journalYear !== "all" ||
    journalGuidelineStatus !== "all" ||
    selectedCouncilId !== DEFAULT_FACULTY_COUNCIL_ID ||
    councilScope !== "has_score";

  return (
    <div className="app-container">
      {/* Hero Banner */}
      <section
        style={{
          background: "linear-gradient(135deg, #0f3557 0%, #005696 100%)",
          color: "#ffffff",
          borderRadius: 8,
          padding: "24px 26px 22px",
          marginBottom: 18,
          boxShadow: "var(--shadow-sm)",
        }}
        aria-label="Cổng thông tin NCKH Khoa MTCN"
      >
        <div style={{ maxWidth: 880 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255,255,255,0.16)",
              padding: "4px 12px",
              borderRadius: 9999,
              fontSize: "0.78rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              marginBottom: 10,
              textTransform: "uppercase",
            }}
          >
            <Award size={14} />
            CỔNG NCKH GIẢNG VIÊN KHOA MỸ THUẬT CÔNG NGHIỆP
          </div>
          <h1
            style={{
              color: "#ffffff",
              fontSize: "1.75rem",
              margin: 0,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              lineHeight: 1.25,
            }}
          >
            Nghiên cứu Khoa học &amp; Công bố Học thuật
          </h1>
        </div>
      </section>

      {/* Main Content Switcher: Hội thảo (50%) vs Tạp chí (50%) - Full Width */}
      <div
        role="tablist"
        aria-label="Danh mục học thuật chính"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          width: "100%",
          gap: "8px",
          backgroundColor: "#e2e8f0",
          padding: "6px",
          borderRadius: "10px",
          marginBottom: "18px",
          boxSizing: "border-box",
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeMainTab === "conferences"}
          onClick={() => handleSelectMainTab("conferences")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            width: "100%",
            padding: "12px 16px",
            borderRadius: "8px",
            border:
              activeMainTab === "conferences"
                ? "1px solid #bfdbfe"
                : "1px solid transparent",
            backgroundColor:
              activeMainTab === "conferences" ? "#ffffff" : "transparent",
            color: activeMainTab === "conferences" ? "#0f3557" : "#475569",
            fontWeight: 700,
            fontSize: "0.98rem",
            cursor: "pointer",
            boxShadow:
              activeMainTab === "conferences"
                ? "0 2px 4px rgba(15, 53, 87, 0.12)"
                : "none",
            transition: "all 0.15s ease",
          }}
        >
          <Compass size={18} />
          <span>Hội thảo</span>
          <span
            style={{
              fontSize: "0.75rem",
              padding: "2px 8px",
              borderRadius: "9999px",
              backgroundColor:
                activeMainTab === "conferences" ? "#eff6ff" : "#cbd5e1",
              color: activeMainTab === "conferences" ? "#1e40af" : "#334155",
              fontWeight: 700,
            }}
          >
            {activeOpportunities.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeMainTab === "journals"}
          onClick={() => handleSelectMainTab("journals")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            width: "100%",
            padding: "12px 16px",
            borderRadius: "8px",
            border:
              activeMainTab === "journals"
                ? "1px solid #bfdbfe"
                : "1px solid transparent",
            backgroundColor:
              activeMainTab === "journals" ? "#ffffff" : "transparent",
            color: activeMainTab === "journals" ? "#0f3557" : "#475569",
            fontWeight: 700,
            fontSize: "0.98rem",
            cursor: "pointer",
            boxShadow:
              activeMainTab === "journals"
                ? "0 2px 4px rgba(15, 53, 87, 0.12)"
                : "none",
            transition: "all 0.15s ease",
          }}
        >
          <BookOpen size={18} />
          <span>Tạp chí</span>
          <span
            style={{
              fontSize: "0.75rem",
              padding: "2px 8px",
              borderRadius: "9999px",
              backgroundColor:
                activeMainTab === "journals" ? "#eff6ff" : "#cbd5e1",
              color: activeMainTab === "journals" ? "#1e40af" : "#334155",
              fontWeight: 700,
            }}
          >
            {domesticActiveJournals.length}
          </span>
        </button>
      </div>

      {activeMainTab === "conferences" ? (
        /* ====================================================================== */
        /* TAB 1: HỘI THẢO (CONFERENCES & ACADEMIC OPPORTUNITIES)                 */
        /* ====================================================================== */
        <>
          {/* Search and Filters Bar for Conferences */}
          <div className="card" style={{ marginBottom: 20, padding: "16px 20px" }}>
            <div
              style={{
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              {/* Search box */}
              <div style={{ position: "relative", flex: "1 1 320px" }}>
                <Search
                  size={18}
                  color="var(--muted)"
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: 38 }}
                  placeholder="Tìm kiếm hội thảo, đơn vị tổ chức, chủ đề, chuyên ngành..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Tìm kiếm nghiên cứu khoa học"
                />
              </div>

              {/* Type filter */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Filter size={16} color="var(--primary)" />
                <select
                  className="form-control"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  style={{ width: "auto", minWidth: 160 }}
                  aria-label="Lọc theo loại hình"
                >
                  <option value="Tất cả">Tất cả hình thức</option>
                  <option value="Hội thảo">Hội thảo</option>
                  <option value="Hội nghị">Hội nghị</option>
                  <option value="Call for Papers">Call for Papers</option>
                  <option value="Special Issue">Special Issue</option>
                  <option value="Book Chapter">Book Chapter</option>
                  <option value="Seminar">Seminar</option>
                  <option value="Hợp tác nghiên cứu">Hợp tác nghiên cứu</option>
                </select>
              </div>
            </div>

            {/* Phân loại Hội thảo: Tất cả / Trong nước (TN) / Quốc tế (QT) */}
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
                marginBottom: 14,
                paddingBottom: 10,
                borderBottom: "1px dashed var(--line)",
              }}
            >
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-sub)", marginRight: 4 }}>
                Phạm vi tổ chức:
              </span>
              <button
                type="button"
                className={`btn btn-sm ${selectedCategory === "ALL" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setSelectedCategory("ALL")}
                style={{
                  borderRadius: "20px",
                  fontWeight: selectedCategory === "ALL" ? 700 : 500,
                  fontSize: "0.82rem",
                  padding: "4px 12px",
                }}
              >
                Tất cả ({basePool.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${selectedCategory === "TN" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setSelectedCategory("TN")}
                style={{
                  borderRadius: "20px",
                  fontWeight: selectedCategory === "TN" ? 700 : 500,
                  fontSize: "0.82rem",
                  padding: "4px 12px",
                }}
              >
                🇻🇳 Hội thảo trong nước (TN) ({countTN})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${selectedCategory === "QT" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setSelectedCategory("QT")}
                style={{
                  borderRadius: "20px",
                  fontWeight: selectedCategory === "QT" ? 700 : 500,
                  fontSize: "0.82rem",
                  padding: "4px 12px",
                }}
              >
                🌏 Hội thảo quốc tế (QT) ({countQT})
              </button>
            </div>

            {/* Filter Chips */}
            <div className="chip-group" role="group" aria-label="Bộ lọc chuyên đề">
              {FILTER_TAGS.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  className={`chip ${selectedTag === tag ? "active" : ""}`}
                  onClick={() => setSelectedTag(tag)}
                >
                  {tag}
                </button>
              ))}
              {/* Divider */}
              <span
                style={{
                  width: 1,
                  height: 18,
                  background: "var(--line)",
                  alignSelf: "center",
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
              {/* Expired tab — visual separated from active filter tags */}
              <button
                type="button"
                className={`chip ${selectedTag === EXPIRED_TAB ? "active" : ""}`}
                onClick={() => setSelectedTag(EXPIRED_TAB)}
                style={
                  selectedTag === EXPIRED_TAB
                    ? {
                        background: "#64748b",
                        color: "#ffffff",
                        borderColor: "#475569",
                      }
                    : {
                        background: "#f1f5f9",
                        color: "#64748b",
                        borderColor: "#e2e8f0",
                      }
                }
                aria-label={`Sự kiện hết hạn — ${expiredOpportunities.length} mục`}
              >
                <Clock size={12} style={{ flexShrink: 0 }} />
                {EXPIRED_TAB}
                {expiredOpportunities.length > 0 && (
                  <span
                    style={{
                      marginLeft: 4,
                      background:
                        selectedTag === EXPIRED_TAB
                          ? "rgba(255,255,255,0.25)"
                          : "#e2e8f0",
                      color:
                        selectedTag === EXPIRED_TAB ? "#ffffff" : "#475569",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      padding: "1px 5px",
                      borderRadius: 9999,
                      lineHeight: 1.4,
                    }}
                  >
                    {expiredOpportunities.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Error notification */}
          {error && (
            <div
              style={{
                background: "#fee2e2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                padding: 14,
                borderRadius: 8,
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
              role="alert"
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={loadData}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <RefreshCw size={14} /> Thử lại
              </button>
            </div>
          )}

          {/* Loading Skeleton */}
          {loading ? (
            <div style={{ marginBottom: 32 }}>
              <div
                style={{
                  textAlign: "center",
                  padding: "24px 20px",
                  color: "var(--muted)",
                  fontSize: "0.95rem",
                }}
              >
                Đang tải dữ liệu NCKH...
              </div>
              <div className="opportunity-grid">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div
                    key={n}
                    className="card"
                    style={{
                      minHeight: 280,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      padding: 20,
                      background: "#ffffff",
                      borderRadius: 10,
                      border: "1px solid var(--line)",
                    }}
                  >
                    <div
                      style={{
                        height: 20,
                        background: "#f1f5f9",
                        borderRadius: 4,
                        width: "50%",
                      }}
                    />
                    <div
                      style={{
                        height: 32,
                        background: "#f1f5f9",
                        borderRadius: 4,
                        width: "90%",
                      }}
                    />
                    <div
                      style={{
                        height: 16,
                        background: "#f1f5f9",
                        borderRadius: 4,
                        width: "70%",
                      }}
                    />
                    <div
                      style={{
                        height: 60,
                        background: "#f8fafc",
                        borderRadius: 6,
                        marginTop: "auto",
                      }}
                    />
                    <div
                      style={{
                        height: 34,
                        background: "#f1f5f9",
                        borderRadius: 6,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : filteredOpportunities.length === 0 ? (
            /* Empty State */
            <div
              className="card"
              style={{
                textAlign: "center",
                padding: "50px 20px",
                color: "var(--muted)",
                marginBottom: 32,
              }}
            >
              <div
                style={{
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  color: "var(--primary)",
                  marginBottom: 8,
                }}
              >
                {isInExpiredTab
                  ? "Chưa có sự kiện nào hết hạn."
                  : "Chưa có dữ liệu NCKH phù hợp."}
              </div>
              <p style={{ maxWidth: 480, margin: "0 auto", fontSize: "0.875rem" }}>
                {isInExpiredTab
                  ? "Tất cả các sự kiện hiện tại vẫn còn hiệu lực."
                  : "Hãy thử tìm kiếm với từ khóa khác hoặc bấm “Tất cả” để xem toàn bộ danh mục hội thảo và công bố học thuật."}
              </p>
            </div>
          ) : (
            /* Pure Card Grid Presentation */
            <>
              {isInExpiredTab && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginBottom: 14,
                    fontSize: "0.82rem",
                    color: "#64748b",
                  }}
                >
                  <Clock size={14} style={{ flexShrink: 0, color: "#94a3b8" }} />
                  <span>
                    Hiển thị{" "}
                    <strong style={{ color: "#475569" }}>
                      {filteredOpportunities.length}
                    </strong>{" "}
                    sự kiện đã hết hạn — Các sự kiện này không còn nhận bài / đăng ký nhưng vẫn được lưu lại để tham khảo.
                  </span>
                </div>
              )}

              {!isInExpiredTab && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 14,
                    fontSize: "0.85rem",
                    color: "var(--muted)",
                  }}
                >
                  <div>
                    Hiển thị <strong>{filteredOpportunities.length}</strong> công bố học thuật &amp; hội thảo phù hợp
                  </div>
                </div>
              )}

              <div className="opportunity-grid">
                {filteredOpportunities.map((opp) => (
                  <OpportunityCard
                    key={opp.id}
                    opportunity={opp}
                    onViewDetail={(item) => setSelectedOpp(item)}
                  />
                ))}
              </div>
            </>
          )}

          {/* Conference Detail Modal */}
          <OpportunityDetailModal
            opportunity={selectedOpp}
            onClose={() => setSelectedOpp(null)}
          />
        </>
      ) : (
        /* ====================================================================== */
        /* TAB 2: TẠP CHÍ (APPROVED DOMESTIC SCIENTIFIC JOURNALS)                 */
        /* ====================================================================== */
        <>
          {/* Professor Council Selector Banner */}
          <div
            className="card"
            style={{
              marginBottom: 14,
              padding: "16px 20px",
              background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)",
              border: "1px solid #bfdbfe",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 14,
                alignItems: "end",
              }}
            >
              {/* Council Selector Dropdown */}
              <div>
                <label
                  htmlFor="home-council-selector"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: "#1e3a8a",
                    textTransform: "uppercase",
                    letterSpacing: "0.02em",
                    marginBottom: 6,
                  }}
                >
                  <Layers size={15} />
                  Hội đồng Giáo sư tra cứu điểm
                </label>
                <select
                  id="home-council-selector"
                  className="form-control"
                  value={selectedCouncilId}
                  onChange={(e) => setSelectedCouncilId(e.target.value)}
                  style={{
                    fontWeight: 700,
                    color: "#0f172a",
                    borderColor: "#93c5fd",
                    backgroundColor: "#ffffff",
                  }}
                  aria-label="Chọn Hội đồng Giáo sư để xem điểm tạp chí"
                >
                  {availableCouncils.map((c) => (
                    <option key={c.councilId} value={c.councilId}>
                      {c.councilName} ({c.councilId}) — {c.journalCount} tạp chí
                    </option>
                  ))}
                  <option value="ALL">
                    Tất cả Hội đồng Giáo sư (Hiển thị điểm cao nhất toàn danh mục)
                  </option>
                </select>
              </div>

              {/* Scope Selector: Có điểm tại Hội đồng đang chọn vs Tất cả tạp chí */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "#334155",
                    textTransform: "uppercase",
                    letterSpacing: "0.02em",
                    marginBottom: 6,
                  }}
                >
                  Phạm vi hiển thị tạp chí
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 6,
                    backgroundColor: "#e2e8f0",
                    padding: 4,
                    borderRadius: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setCouncilScope("has_score")}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "none",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      backgroundColor:
                        councilScope === "has_score" ? "#ffffff" : "transparent",
                      color:
                        councilScope === "has_score" ? "#1e3a8a" : "#475569",
                      boxShadow:
                        councilScope === "has_score"
                          ? "0 1px 2px rgba(0, 0, 0, 0.08)"
                          : "none",
                    }}
                  >
                    Có điểm tại Hội đồng đang chọn
                  </button>
                  <button
                    type="button"
                    onClick={() => setCouncilScope("all")}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "none",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      backgroundColor:
                        councilScope === "all" ? "#ffffff" : "transparent",
                      color: councilScope === "all" ? "#1e3a8a" : "#475569",
                      boxShadow:
                        councilScope === "all"
                          ? "0 1px 2px rgba(0, 0, 0, 0.08)"
                          : "none",
                    }}
                  >
                    Tất cả tạp chí ({domesticActiveJournals.length})
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filters Bar for Journals */}
          <div className="card" style={{ marginBottom: 20, padding: "16px 20px" }}>
            {/* Search Input Row */}
            <div style={{ position: "relative", marginBottom: 14 }}>
              <Search
                size={18}
                color="var(--muted)"
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: 38, paddingRight: journalSearch ? 36 : 14 }}
                placeholder="Tìm kiếm theo tên tạp chí, ISSN, lĩnh vực, cơ quan xuất bản..."
                value={journalSearch}
                onChange={(e) => setJournalSearch(e.target.value)}
                aria-label="Tìm kiếm tạp chí khoa học"
              />
              {journalSearch && (
                <button
                  type="button"
                  onClick={() => setJournalSearch("")}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94a3b8",
                  }}
                  title="Xóa từ khóa tìm kiếm"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* 4 Independent Filter Dropdowns for Journals */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12,
                alignItems: "center",
              }}
            >
              {/* 1. Nhóm ngành */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Nhóm ngành
                </label>
                <select
                  className="form-control"
                  value={journalField}
                  onChange={(e) => setJournalField(e.target.value)}
                  aria-label="Lọc tạp chí theo nhóm ngành"
                >
                  <option value="all">Tất cả nhóm ngành</option>
                  {uniqueJournalFields.map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Điểm HĐGSNN */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Điểm tại Hội đồng đang chọn
                </label>
                <select
                  className="form-control"
                  value={journalScore}
                  onChange={(e) => setJournalScore(e.target.value)}
                  aria-label="Lọc tạp chí theo điểm HĐGSNN"
                >
                  <option value="all">Tất cả mức điểm</option>
                  <option value="1.0">Từ 1,00 điểm trở lên</option>
                  <option value="0.75">Từ 0,75 điểm trở lên</option>
                  <option value="0.5">Từ 0,50 điểm trở lên</option>
                  <option value="0.25">Từ 0,25 điểm trở lên</option>
                </select>
              </div>

              {/* 3. Năm áp dụng */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Năm áp dụng
                </label>
                <select
                  className="form-control"
                  value={journalYear}
                  onChange={(e) => setJournalYear(e.target.value)}
                  aria-label="Lọc tạp chí theo năm áp dụng"
                >
                  <option value="all">Tất cả các năm</option>
                  {uniqueJournalYears.map((y) => (
                    <option key={y} value={y.toString()}>
                      Năm {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Tình trạng hướng dẫn đăng bài */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Tình trạng hướng dẫn đăng bài
                </label>
                <select
                  className="form-control"
                  value={journalGuidelineStatus}
                  onChange={(e) => setJournalGuidelineStatus(e.target.value)}
                  aria-label="Lọc tạp chí theo tình trạng hướng dẫn đăng bài"
                >
                  <option value="all">Tất cả tình trạng</option>
                  <option value="has_guidelines">Có hướng dẫn đăng bài</option>
                  <option value="no_guidelines">Chưa có thể lệ</option>
                </select>
              </div>
            </div>
          </div>

          {/* Summary & Reset Filter Row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
              fontSize: "0.85rem",
              color: "var(--muted)",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div>
              Hiển thị <strong>{filteredJournals.length}</strong> /{" "}
              {domesticActiveJournals.length} tạp chí khoa học trong nước
              {selectedCouncilId !== "ALL" && (
                <span>
                  {" "}
                  · Hội đồng đang chọn:{" "}
                  <strong style={{ color: "#1e3a8a" }}>
                    {selectedCouncilMeta.councilName} ({selectedCouncilId})
                  </strong>
                </span>
              )}
            </div>
            {hasActiveJournalFilters && (
              <button
                type="button"
                onClick={() => {
                  setJournalSearch("");
                  setJournalField("all");
                  setJournalScore("all");
                  setJournalYear("all");
                  setJournalGuidelineStatus("all");
                  setSelectedCouncilId(DEFAULT_FACULTY_COUNCIL_ID);
                  setCouncilScope("has_score");
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
                Đặt lại bộ lọc tạp chí
              </button>
            )}
          </div>

          {/* Journals Loading / Empty / Grid */}
          {journalsLoading ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 20px",
                color: "var(--muted)",
                fontSize: "0.95rem",
              }}
            >
              Đang tải danh mục tạp chí khoa học trong nước...
            </div>
          ) : filteredJournals.length === 0 ? (
            <div
              className="card"
              style={{
                textAlign: "center",
                padding: "50px 20px",
                color: "var(--muted)",
                marginBottom: 32,
              }}
            >
              <div
                style={{
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  color: "var(--primary)",
                  marginBottom: 8,
                }}
              >
                {domesticActiveJournals.length === 0
                  ? "Chưa có tạp chí nào được công bố trong danh mục."
                  : councilScope === "has_score" && selectedCouncilId !== "ALL"
                  ? `Không có tạp chí nào phù hợp có mức điểm tại Hội đồng "${selectedCouncilMeta.councilName}".`
                  : "Không tìm thấy tạp chí khoa học phù hợp."}
              </div>
              <p style={{ maxWidth: 520, margin: "0 auto 14px auto", fontSize: "0.875rem" }}>
                {domesticActiveJournals.length === 0
                  ? "Danh mục tạp chí khoa học trong nước sẽ hiển thị tại đây ngay sau khi Admin phê duyệt và công bố."
                  : councilScope === "has_score" && selectedCouncilId !== "ALL"
                  ? "Bạn có thể chuyển sang chế độ “Tất cả tạp chí” hoặc chọn Hội đồng Giáo sư khác để tra cứu."
                  : "Hãy thử thay đổi từ khóa tìm kiếm hoặc đặt lại bộ lọc để xem toàn bộ danh mục tạp chí."}
              </p>
              {domesticActiveJournals.length > 0 && councilScope === "has_score" && (
                <button
                  type="button"
                  onClick={() => setCouncilScope("all")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "1px solid #2563eb",
                    backgroundColor: "#eff6ff",
                    color: "#1e40af",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  Xem tất cả {domesticActiveJournals.length} tạp chí trong danh mục
                </button>
              )}
            </div>
          ) : (
            <div className="opportunity-grid" style={{ marginBottom: 32 }}>
              {filteredJournals.map((journal) => (
                <JournalCard
                  key={journal.id || journal.journalId}
                  journal={journal}
                  selectedCouncilId={selectedCouncilId}
                  isAdmin={false}
                  onViewDetails={(item) => setSelectedJournal(item)}
                />
              ))}
            </div>
          )}

          {/* Journal Detail Modal */}
          <JournalDetailModal
            isOpen={Boolean(selectedJournal)}
            journal={selectedJournal}
            selectedCouncilId={selectedCouncilId}
            onClose={() => setSelectedJournal(null)}
          />
        </>
      )}
    </div>
  );
};
