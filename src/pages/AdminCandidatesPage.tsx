import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../firebase/auth";
import {
  fetchOpportunityCandidates,
  fetchPublishedOpportunities,
  approveCandidate,
  rejectCandidate,
  deleteCandidate,
  markCandidateNeedsReview,
  recallOpportunityCandidate,
} from "../firebase/firestore";
import type { OpportunityCandidate, Opportunity } from "../types";
import { CandidateReviewModal } from "../components/CandidateReviewModal";
import { FacultyResearchSyncModal } from "../components/FacultyResearchSyncModal";
import { FacultyResearchSyncDashboard } from "../components/FacultyResearchSyncDashboard";
import { formatDateVN, parseDateSafe, getOpportunityDeadlineInfo } from "../utils/date";
import { isDuplicateOpportunity } from "../utils/dedupe";
import { classifyOutOfScopeRecord } from "../utils/researchDedupe";
import {
  Sparkles,
  LayoutGrid,
  List,
  CheckCircle,
  ExternalLink,
  AlertTriangle,
  Search,
  Calendar,
  Clock,
  RotateCcw,
} from "lucide-react";

export type CandidateFilterTab =
  | "pending"
  | "updates"
  | "needs_review"
  | "approved"
  | "expired"
  | "rejected"
  | "closed"
  | "out_of_scope"
  | "all";

export type CandidateCategoryFilter = "ALL" | "TN" | "QT";

export const getCandidateCategory = (c: OpportunityCandidate): "TN" | "QT" => {
  if (c.category === "TN" || c.category === "QT") return c.category;
  if (c.conferenceCode?.startsWith("QT")) return "QT";
  if (c.conferenceCode?.startsWith("TN")) return "TN";
  const country = String(c.country || "").trim().toLowerCase();
  if (country && country !== "việt nam" && country !== "vietnam" && country !== "vn" && country !== "viet nam") {
    return "QT";
  }
  return "TN";
};

/**
 * Returns date formatted as YYYY-MM-DD in Vietnam timezone (Asia/Ho_Chi_Minh).
 */
export const getVietnamDateString = (dateInput: Date | string | number): string => {
  const d = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (!d || isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};

/**
 * Checks if a candidate was genuinely discovered today (VN timezone Asia/Ho_Chi_Minh).
 * Strictly requires status === "pending" and creation type (not an update proposal or approved opp).
 * Uses discoveredAt (fallback createdAt). Never uses updatedAt or lastUpdated.
 */
export const isDiscoveredTodayVN = (c: OpportunityCandidate): boolean => {
  if (c.status !== "pending") return false;
  if (c.changeType === "update" || Boolean(c.publishedOpportunityId)) return false;

  const rawDate = c.discoveredAt || c.createdAt;
  if (!rawDate) return false;

  const discoveryVNDate = getVietnamDateString(rawDate);
  const todayVNDate = getVietnamDateString(new Date());

  return Boolean(discoveryVNDate && todayVNDate && discoveryVNDate === todayVNDate);
};

export const isAutoClosedProposal = (c: OpportunityCandidate): boolean => {
  // 1. Explicit resolutionType check
  if (c.resolutionType === "AUTO_CLOSED") return true;
  if (c.resolutionType === "ADMIN_REJECTED") return false;

  // 2. Fallback check for legacy records
  if (c.status !== "rejected" && (c.status as string) !== "closed") return false;
  if (!c.publishedOpportunityId) return false;

  // If an actual admin/user email reviewed it, it's definitely an ADMIN rejection, NEVER auto-closed
  if (c.reviewedBy && c.reviewedBy !== "SPARK_SYNC" && c.reviewedBy.includes("@")) {
    return false;
  }

  // Must have clear auto-closed textual indicator from system sync
  const hasAutoClosedReason =
    Boolean(c.rejectionReason?.includes("Đồng bộ chuẩn hóa")) ||
    Boolean(c.rejectionReason?.includes("Tự động đóng")) ||
    Boolean(c.rejectionReason?.includes("trùng khớp"));

  return hasAutoClosedReason && (!c.reviewedBy || c.reviewedBy === "SPARK_SYNC");
};

export const isAdminRejectedProposal = (c: OpportunityCandidate): boolean => {
  if (c.status !== "rejected") return false;
  return !isAutoClosedProposal(c);
};

export const getCandidatePrimaryCategory = (
  c: OpportunityCandidate
): "updates" | "pending" | "needs_review" | "approved" | "expired" | "rejected" | "closed" | "out_of_scope" => {
  // 1. Hồ sơ đã duyệt (hội thảo đã được Admin duyệt và công bố)
  if (c.status === "approved") {
    return "approved";
  }

  // 2. Ngoài phạm vi / JOISA (chỉ áp dụng cho hồ sơ chưa duyệt và không thuộc nhóm hội thảo chính thức TN/QT)
  const isOfficial =
    c.category === "QT" ||
    c.category === "TN" ||
    (c.conferenceCode && (c.conferenceCode.startsWith("QT") || c.conferenceCode.startsWith("TN")));
  if (!isOfficial && (c.isOutOfScope === true || classifyOutOfScopeRecord(c).isOutOfScope)) {
    return "out_of_scope";
  }

  // 3. Phân biệt: Tự đóng vì trùng khớp vs Admin từ chối (tránh làm sai thống kê "Từ chối")
  if (isAutoClosedProposal(c)) {
    return "closed";
  }
  if (c.status === "rejected") {
    return "rejected";
  }

  // 4. Đề xuất cập nhật CÒN CHỜ XỬ LÝ (pending / needs_review)
  // Ưu tiên cao hơn hết hạn: kể cả khi hội thảo gốc đã hết hạn, đề xuất cập nhật vẫn phải vào "Cập nhật chờ duyệt"
  if (c.changeType === "update" || Boolean(c.publishedOpportunityId)) {
    return "updates";
  }

  // 5. Hồ sơ hết hạn (chỉ dành cho hồ sơ mới chưa duyệt mà quá hạn)
  if (c.sheetStatus === "HẾT HẠN" || getOpportunityDeadlineInfo(c).isExpired) {
    return "expired";
  }

  // 6. Cần hiệu chỉnh
  if (c.status === "needs_review") {
    return "needs_review";
  }

  // 7. Chờ duyệt (tất cả hội thảo mới chưa duyệt)
  return "pending";
};

export const FILTER_TABS: Array<{ id: CandidateFilterTab; label: string }> = [
  { id: "pending", label: "Chờ duyệt" },
  { id: "updates", label: "Cập nhật chờ duyệt" },
  { id: "needs_review", label: "Cần hiệu chỉnh" },
  { id: "approved", label: "Đã duyệt" },
  { id: "expired", label: "Hết hạn" },
  { id: "rejected", label: "Từ chối" },
  { id: "closed", label: "Tự đóng (Trùng khớp)" },
  { id: "out_of_scope", label: "Ngoài phạm vi / JOISA" },
  { id: "all", label: "Tất cả" },
];

export const matchesCandidateSearch = (cand: OpportunityCandidate, queryText: string): boolean => {
  const q = queryText.trim().toLowerCase();
  if (!q) return true;
  const matchCode = !!(cand.conferenceCode && cand.conferenceCode.toLowerCase().includes(q));
  const matchTitle = (cand.title || "").toLowerCase().includes(q);
  const matchOrg = (cand.organizer || "").toLowerCase().includes(q);
  const matchField = !!(cand.field && cand.field.toLowerCase().includes(q));
  const matchLevel = !!(cand.level && cand.level.toLowerCase().includes(q));
  const matchType = !!(cand.type && cand.type.toLowerCase().includes(q));
  return matchCode || matchTitle || matchOrg || matchField || matchLevel || matchType;
};

export const AdminCandidatesPage: React.FC = () => {
  const { profile } = useAuth();
  const [candidates, setCandidates] = useState<OpportunityCandidate[]>([]);
  const [publishedOpps, setPublishedOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [activeTab, setActiveTab] = useState<CandidateFilterTab>("pending");
  const [selectedCategory, setSelectedCategory] = useState<CandidateCategoryFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals & Actions
  const [selectedCandidate, setSelectedCandidate] = useState<OpportunityCandidate | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [recallingId, setRecallingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [hasInitializedTab, setHasInitializedTab] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cands, opps] = await Promise.all([
        fetchOpportunityCandidates(),
        fetchPublishedOpportunities(),
      ]);
      setCandidates(cands);
      setPublishedOpps(opps);
      if (!hasInitializedTab) {
        const pendingCount = cands.filter((c) => getCandidatePrimaryCategory(c) === "pending").length;
        const updatesCount = cands.filter((c) => getCandidatePrimaryCategory(c) === "updates").length;
        const needsReviewCount = cands.filter((c) => getCandidatePrimaryCategory(c) === "needs_review").length;
        if (pendingCount === 0 && updatesCount > 0) {
          setActiveTab("updates");
        } else if (pendingCount === 0 && needsReviewCount > 0) {
          setActiveTab("needs_review");
        }
        setHasInitializedTab(true);
      }
    } catch (err: any) {
      console.error(err);
      setActionMessage({
        type: "error",
        text: "Không thể tải danh sách ứng viên: " + (err?.message || String(err)),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 1. Filter candidates by search query
  const searchedCandidates = useMemo(() => {
    if (!searchQuery.trim()) return candidates;
    return candidates.filter((c) => matchesCandidateSearch(c, searchQuery));
  }, [candidates, searchQuery]);

  // 2. Compute category counts based on searchedCandidates
  const categoryCounts = useMemo(() => {
    let tn = 0;
    let qt = 0;
    for (const c of searchedCandidates) {
      if (getCandidateCategory(c) === "QT") qt++;
      else tn++;
    }
    return { all: searchedCandidates.length, tn, qt };
  }, [searchedCandidates]);

  // 3. Candidates matching BOTH search and selectedCategory
  const categoryFilteredCandidates = useMemo(() => {
    return searchedCandidates.filter((cand) => {
      if (selectedCategory === "ALL") return true;
      return getCandidateCategory(cand) === selectedCategory;
    });
  }, [searchedCandidates, selectedCategory]);

  // 4. Tab counts strictly based on categoryFilteredCandidates (updates dynamically when category or search changes!)
  const tabCounts = useMemo(() => {
    const counts: Record<CandidateFilterTab, number> = {
      pending: 0,
      updates: 0,
      needs_review: 0,
      approved: 0,
      expired: 0,
      rejected: 0,
      closed: 0,
      out_of_scope: 0,
      all: categoryFilteredCandidates.length,
    };
    for (const cand of categoryFilteredCandidates) {
      const cat = getCandidatePrimaryCategory(cand);
      counts[cat]++;
    }
    return counts;
  }, [categoryFilteredCandidates]);

  // 5. Final list filtered by activeTab
  const filteredCandidates = useMemo(() => {
    if (activeTab === "all") return categoryFilteredCandidates;
    return categoryFilteredCandidates.filter((cand) => {
      return getCandidatePrimaryCategory(cand) === activeTab;
    });
  }, [categoryFilteredCandidates, activeTab]);

  // 6. Unique conferences summary dynamically reflecting selectedCategory and search
  const uniqueSummary = useMemo(() => {
    const filteredPublished = publishedOpps.filter((o) => {
      if (o.status !== "published") return false;
      const cat = o.category || (o.conferenceCode?.startsWith("QT") ? "QT" : "TN");
      if (selectedCategory !== "ALL" && cat !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = !!(o.conferenceCode && o.conferenceCode.toLowerCase().includes(q));
        const matchTitle = (o.title || "").toLowerCase().includes(q);
        const matchOrg = (o.organizer || "").toLowerCase().includes(q);
        if (!matchCode && !matchTitle && !matchOrg) return false;
      }
      return true;
    });

    const publishedCount = filteredPublished.length;

    const newPendingCount = categoryFilteredCandidates.filter(
      (c) => c.status === "pending" && (c.changeType === "create" || !c.publishedOpportunityId)
    ).length;

    const updateProposalsCount = categoryFilteredCandidates.filter(
      (c) =>
        (c.changeType === "update" || Boolean(c.publishedOpportunityId)) &&
        ["pending", "needs_review"].includes(c.status)
    ).length;

    const totalConferences = publishedCount + newPendingCount;
    return {
      publishedCount,
      newPendingCount,
      updateProposalsCount,
      totalConferences,
    };
  }, [publishedOpps, categoryFilteredCandidates, selectedCategory, searchQuery]);

  const approvableInView = useMemo(
    () => filteredCandidates.filter((c) => c.status !== "approved"),
    [filteredCandidates]
  );

  if (!profile) return null;

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllInView = () => {
    if (approvableInView.length === 0) return;
    const allSelected = approvableInView.every((c) => selectedIds.has(c.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        approvableInView.forEach((c) => next.delete(c.id));
      } else {
        approvableInView.forEach((c) => next.add(c.id));
      }
      return next;
    });
  };

  const handleQuickApprove = async (cand: OpportunityCandidate) => {
    setApprovingId(cand.id);
    setActionMessage(null);
    try {
      await approveCandidate(cand, {
        uid: profile.uid,
        email: profile.email,
        role: profile.role,
      });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(cand.id);
        return next;
      });
      setActionMessage({
        type: "success",
        text: `Đã duyệt và công bố "${cand.title}" lên Cổng thông tin NCKH.`,
      });
      await loadData();
    } catch (err: any) {
      console.error("Failed to quick approve candidate:", err);
      setActionMessage({
        type: "error",
        text: `Lỗi khi duyệt "${cand.title}": ${err?.message || String(err)}`,
      });
    } finally {
      setApprovingId(null);
    }
  };

  const handleRecallCandidate = async (cand: OpportunityCandidate) => {
    if (!profile) return;
    const confirmRecall = window.confirm(
      `Bạn có chắc chắn muốn thu hồi hội thảo "${cand.title}" về hàng chờ duyệt?\nHội thảo này sẽ được gỡ khỏi Cổng thông tin công khai và chuyển về trạng thái 'Chờ duyệt'.`
    );
    if (!confirmRecall) return;

    setRecallingId(cand.id);
    setActionMessage(null);
    try {
      await recallOpportunityCandidate(cand, {
        uid: profile.uid,
        email: profile.email,
        role: profile.role,
      });
      setActionMessage({
        type: "success",
        text: `Đã thu hồi thành công "${cand.title}" về hàng chờ duyệt.`,
      });
      await loadData();
    } catch (err: any) {
      console.error("Failed to recall candidate:", err);
      setActionMessage({
        type: "error",
        text: `Lỗi khi thu hồi "${cand.title}": ${err?.message || String(err)}`,
      });
    } finally {
      setRecallingId(null);
    }
  };

  const handleApproveSelected = async () => {
    const selectedCands = candidates.filter(
      (c) => selectedIds.has(c.id) && c.status !== "approved"
    );
    if (selectedCands.length === 0) return;

    setBulkApproving(true);
    setActionMessage(null);
    let okCount = 0;
    try {
      for (const cand of selectedCands) {
        await approveCandidate(cand, {
          uid: profile.uid,
          email: profile.email,
          role: profile.role,
        });
        okCount++;
      }
      setSelectedIds(new Set());
      setActionMessage({
        type: "success",
        text: `Đã duyệt và công bố thành công ${okCount} hội thảo / cơ hội NCKH.`,
      });
      await loadData();
    } catch (err: any) {
      console.error("Failed to approve selected candidates:", err);
      setActionMessage({
        type: "error",
        text: `Đã duyệt ${okCount}/${selectedCands.length} mục. Lỗi: ${err?.message || String(err)}`,
      });
      await loadData();
    } finally {
      setBulkApproving(false);
    }
  };

  const handleBulkApproveOpen = async () => {
    const openCandidates = candidates.filter((c) => {
      const cat = getCandidatePrimaryCategory(c);
      return cat === "pending";
    });
    if (openCandidates.length === 0) return;

    setBulkApproving(true);
    setActionMessage(null);
    let okCount = 0;
    try {
      for (const cand of openCandidates) {
        await approveCandidate(cand, {
          uid: profile.uid,
          email: profile.email,
          role: profile.role,
        });
        okCount++;
      }
      setSelectedIds(new Set());
      setActionMessage({
        type: "success",
        text: `Đã duyệt và công bố thành công toàn bộ ${okCount} cơ hội đang mở sang Cổng NCKH công khai.`,
      });
      await loadData();
    } catch (err: any) {
      console.error(err);
      setActionMessage({
        type: "error",
        text: `Lỗi khi duyệt hàng loạt (${okCount}/${openCandidates.length}): ${err?.message || String(err)}`,
      });
      await loadData();
    } finally {
      setBulkApproving(false);
    }
  };

  return (
    <div className="app-container">
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ fontSize: "1.6rem", color: "var(--primary)" }}>Dữ liệu AI tìm</h1>
            <span
              className="badge"
              style={{ background: "#f3e8ff", color: "#6b21a8", fontWeight: 700, padding: "4px 8px" }}
            >
              SPAK / AI
            </span>
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: 4 }}>
            Quản trị và kiểm duyệt toàn bộ dữ liệu hội thảo, cơ hội NCKH do hệ thống AI đồng bộ từ Google Sheets.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsSyncModalOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Sparkles size={14} /> Đồng bộ từ IFA Faculty Research
          </button>

          {selectedIds.size > 0 && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleApproveSelected}
              disabled={bulkApproving}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "#16a34a",
                color: "#ffffff",
                border: "none",
                fontWeight: 600,
              }}
            >
              <CheckCircle size={14} />
              {bulkApproving ? "Đang duyệt..." : `Duyệt & Công bố (${selectedIds.size} mục)`}
            </button>
          )}

          {candidates.some((c) => {
            const cat = getCandidatePrimaryCategory(c);
            return cat === "pending";
          }) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleBulkApproveOpen}
              disabled={bulkApproving}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--teal)" }}
            >
              <CheckCircle size={14} />
              {bulkApproving ? "Đang xuất bản..." : "Duyệt tất cả đang mở"}
            </button>
          )}

          {/* View Switcher */}
          <div style={{ display: "flex", gap: 6, background: "#e2e8f0", padding: 4, borderRadius: 6 }}>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === "table" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setViewMode("table")}
              style={{ padding: "4px 10px", minHeight: 32 }}
            >
              <List size={16} /> Bảng
            </button>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === "grid" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setViewMode("grid")}
              style={{ padding: "4px 10px", minHeight: 32 }}
            >
              <LayoutGrid size={16} /> Lưới
            </button>
          </div>
        </div>
      </div>

      {/* Automated Research Sync Dashboard */}
      <FacultyResearchSyncDashboard
        onSyncComplete={loadData}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
      />

      {/* 10 Unique Conferences Governance Summary */}
      <div
        className="card"
        style={{
          marginBottom: 16,
          padding: "12px 18px",
          background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 700, fontSize: "0.92rem", color: "#1e293b" }}>
              Hội thảo Khoa MTCN ({selectedCategory === "TN" ? "Trong nước" : selectedCategory === "QT" ? "Quốc tế" : "Spark JSON"}):
            </span>
            <span
              className="badge"
              style={{
                background: "#0284c7",
                color: "#ffffff",
                padding: "3px 10px",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: "0.82rem",
              }}
            >
              {uniqueSummary.totalConferences} hội thảo duy nhất
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: "0.84rem", flexWrap: "wrap" }}>
            <span style={{ color: "#166534", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
              <strong>{uniqueSummary.publishedCount}</strong> Đã công bố
            </span>
            <span style={{ color: "#b45309", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
              <strong>{uniqueSummary.newPendingCount}</strong> Mới chờ duyệt {selectedCategory === "ALL" || selectedCategory === "QT" ? "(QT0001, QT0002)" : ""}
            </span>
            <span style={{ color: "#0369a1", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0ea5e9", display: "inline-block" }} />
              <strong>{uniqueSummary.updateProposalsCount}</strong> Đề xuất cập nhật {selectedCategory === "ALL" || selectedCategory === "QT" ? "(gắn với QT0003)" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* 3-Level Filter Hierarchy Card: Search -> Categories -> Status Tabs */}
      <div className="filter-card">
        {/* 1. Search Box */}
        <div className="search-input-wrapper">
          <Search
            size={18}
            color="var(--muted)"
            style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: 42 }}
            placeholder="Tìm kiếm ứng viên theo tiêu đề, đơn vị tổ chức, ngành, cấp độ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* 2. Nhóm hội thảo (Segmented Control) */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-sub)", minWidth: 100 }}>
            Nhóm hội thảo:
          </span>
          <div className="category-segmented-control" role="group" aria-label="Phân loại hội thảo">
            <button
              type="button"
              onClick={() => setSelectedCategory("ALL")}
              className={`category-segment-btn ${selectedCategory === "ALL" ? "active" : ""}`}
            >
              <span>Tất cả</span>
              <span className="count-badge">{categoryCounts.all}</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory("TN")}
              className={`category-segment-btn ${selectedCategory === "TN" ? "active" : ""}`}
            >
              <span>🇻🇳 Trong nước</span>
              <span className="count-badge">{categoryCounts.tn}</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory("QT")}
              className={`category-segment-btn ${selectedCategory === "QT" ? "active" : ""}`}
            >
              <span>🌐 Quốc tế</span>
              <span className="count-badge">{categoryCounts.qt}</span>
            </button>
          </div>
        </div>

        {/* 3. Thanh trạng thái (Status Tabs) */}
        <div className="status-tabs-container">
          {FILTER_TABS.filter((tab) => {
            // Standard workflow tabs always show (even if count is 0)
            if (["closed", "out_of_scope"].includes(tab.id)) {
              return tabCounts[tab.id] > 0;
            }
            return true;
          }).map((tab) => {
            const isActive = activeTab === tab.id;
            const count = tabCounts[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`status-tab-btn ${isActive ? "active" : ""}`}
              >
                <span>{tab.label}</span>
                <span className="tab-count-badge">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Status Banner */}
      {actionMessage && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            background: actionMessage.type === "success" ? "#dcfce7" : "#fee2e2",
            color: actionMessage.type === "success" ? "#166534" : "#991b1b",
            border:
              actionMessage.type === "success"
                ? "1px solid #86efac"
                : "1px solid #fca5a5",
            fontSize: "0.9rem",
            fontWeight: 500,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {actionMessage.type === "success" ? (
              <CheckCircle size={18} />
            ) : (
              <AlertTriangle size={18} />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setActionMessage(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              fontWeight: 700,
              padding: "2px 8px",
            }}
          >
            Đóng
          </button>
        </div>
      )}

      {/* Content Area */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
          Đang tải dữ liệu AI tìm...
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 20px", color: "var(--muted)" }}>
          <Sparkles size={36} color="#7e22ce" style={{ margin: "0 auto 12px", opacity: 0.8 }} />
          <h3 style={{ color: "var(--primary)", marginBottom: 8, fontSize: "1.1rem" }}>Danh sách trống</h3>
          <p style={{ fontSize: "0.9rem", maxWidth: 520, margin: "0 auto 16px", color: "#64748b" }}>
            {searchQuery.trim()
              ? `Không tìm thấy hội thảo ${selectedCategory === "TN" ? "Trong nước " : selectedCategory === "QT" ? "Quốc tế " : ""}nào phù hợp với từ khóa "${searchQuery}".`
              : selectedCategory === "TN"
              ? `Không có hội thảo Trong nước nào đang ở trạng thái "${FILTER_TABS.find((t) => t.id === activeTab)?.label || activeTab}".`
              : selectedCategory === "QT"
              ? `Không có hội thảo Quốc tế nào đang ở trạng thái "${FILTER_TABS.find((t) => t.id === activeTab)?.label || activeTab}".`
              : `Không có hội thảo nào đang ở trạng thái "${FILTER_TABS.find((t) => t.id === activeTab)?.label || activeTab}".`}
          </p>
          {(searchQuery || selectedCategory !== "ALL" || activeTab !== "pending") && (
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {searchQuery && (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setSearchQuery("")}
                >
                  Xóa tìm kiếm
                </button>
              )}
              {selectedCategory !== "ALL" && (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setSelectedCategory("ALL")}
                >
                  Xem tất cả nhóm
                </button>
              )}
              {activeTab !== "all" && (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setActiveTab("all")}
                >
                  Xem tất cả trạng thái
                </button>
              )}
            </div>
          )}
        </div>
      ) : viewMode === "table" ? (
        <div className="table-container" style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={
                      approvableInView.length > 0 &&
                      approvableInView.every((c) => selectedIds.has(c.id))
                    }
                    onChange={toggleSelectAllInView}
                    disabled={approvableInView.length === 0}
                    title="Chọn tất cả mục chưa duyệt trong trang này"
                  />
                </th>
                <th style={{ minWidth: 260 }}>Tiêu đề hội thảo / Cơ hội</th>
                <th style={{ minWidth: 160 }}>Đơn vị tổ chức</th>
                <th style={{ width: 140, textAlign: "center" }}>Loại / Cấp độ</th>
                <th style={{ width: 160 }}>Hạn nộp & Diễn ra</th>
                <th style={{ width: 90, textAlign: "center" }}>Trùng lặp?</th>
                <th style={{ width: 120, textAlign: "center" }}>Trạng thái</th>
                <th style={{ width: 190, textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.map((cand) => {
                const isApproved = cand.status === "approved";
                const isApprovingThis = approvingId === cand.id;

                // Exclude matching candidate's own published opportunity to avoid self-duplication false positives
                const otherPublishedOpps = publishedOpps.filter(
                  (opp) => opp.id !== cand.publishedOpportunityId && opp.candidateId !== cand.id
                );
                const dedupe = isDuplicateOpportunity(
                  {
                    title: cand.title,
                    sourceUrl: cand.sourceUrl,
                    organizer: cand.organizer,
                    deadline: cand.deadline,
                    eventDate: cand.eventDate,
                  },
                  otherPublishedOpps
                );

                const primaryCat = getCandidatePrimaryCategory(cand);

                return (
                  <tr key={cand.id}>
                    <td style={{ textAlign: "center" }}>
                      {!isApproved && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(cand.id)}
                          onChange={() => toggleSelectOne(cand.id)}
                        />
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                        {cand.conferenceCode && (
                          <span
                            className="badge"
                            style={{
                              backgroundColor: cand.conferenceCode.startsWith("QT") ? "#fef3c7" : "#e0e7ff",
                              color: cand.conferenceCode.startsWith("QT") ? "#92400e" : "#3730a3",
                              border: `1px solid ${cand.conferenceCode.startsWith("QT") ? "#fde68a" : "#c7d2fe"}`,
                              fontWeight: 800,
                              fontSize: "0.72rem",
                              padding: "2px 6px",
                              letterSpacing: "0.5px",
                            }}
                          >
                            {cand.conferenceCode}
                          </span>
                        )}
                        {cand.changeType === "update" && (
                          <span
                            className="badge"
                            style={{
                              backgroundColor: "#e0f2fe",
                              color: "#0369a1",
                              border: "1px solid #bae6fd",
                              fontWeight: 700,
                              fontSize: "0.70rem",
                              padding: "2px 6px",
                            }}
                          >
                            Đề xuất cập nhật
                          </span>
                        )}
                        {isDiscoveredTodayVN(cand) && (
                          <span className="badge-new-spark" title="Mới phát hiện trong ngày hôm nay (giờ VN)">
                            <Sparkles size={10} /> NEW
                          </span>
                        )}
                        <span style={{ fontWeight: 600, color: "var(--primary)" }}>
                          {cand.title}
                        </span>
                      </div>
                      {cand.sourceUrl && (
                        <a
                          href={cand.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: "0.75rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            color: "var(--secondary)",
                          }}
                        >
                          Nguồn chính thức <ExternalLink size={10} />
                        </a>
                      )}
                      {cand.field && (
                        <div style={{ fontSize: "0.75rem", color: "var(--teal)", marginTop: 2 }}>
                          {cand.field}
                        </div>
                      )}
                      {cand.publishedOpportunityId && (
                        <div
                          style={{
                            fontSize: "0.74rem",
                            color: "#0369a1",
                            marginTop: 4,
                            display: "flex",
                            flexDirection: "column",
                            gap: 3,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span>
                              Hồ sơ gốc:{" "}
                              <strong>
                                {(() => {
                                  const orig = publishedOpps.find((o) => o.id === cand.publishedOpportunityId);
                                  return orig ? `[${orig.conferenceCode || "Đã duyệt"}] ${orig.title}` : cand.publishedOpportunityId;
                                })()}
                              </strong>
                            </span>
                            {cand.diffSummary && cand.diffSummary.length > 0 && (
                              <span
                                style={{
                                  color: "#475569",
                                  background: "#f1f5f9",
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                }}
                              >
                                Thay đổi: {cand.diffSummary.map((d) => d.label || d.field).join(", ")}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "0.71rem", color: "#64748b" }}>
                            Phát hiện gốc: {formatDateVN(cand.discoveredAt || cand.createdAt)}
                            {cand.updatedAt && ` • Cập nhật: ${formatDateVN(cand.updatedAt)}`}
                          </div>
                        </div>
                      )}
                      {primaryCat === "closed" && (
                        <div
                          style={{
                            fontSize: "0.72rem",
                            color: "#475569",
                            background: "#f8fafc",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            padding: "3px 6px",
                            marginTop: 4,
                          }}
                        >
                          <strong>Tự đóng:</strong> {cand.rejectionReason || "Dữ liệu trùng khớp với hội thảo đã công bố"}
                        </div>
                      )}
                      {primaryCat === "rejected" && (
                        <div
                          style={{
                            fontSize: "0.72rem",
                            color: "#991b1b",
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            borderRadius: 4,
                            padding: "3px 6px",
                            marginTop: 4,
                          }}
                        >
                          <strong>Từ chối bởi {cand.reviewedBy || "Admin"}:</strong> {cand.rejectionReason || "Không có lý do"}
                        </div>
                      )}
                    </td>
                    <td>
                      <div>{cand.organizer}</div>
                      {cand.country && (
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          {cand.country}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                        <span className="badge badge-neutral">{cand.type}</span>
                        {cand.level && (
                          <span
                            className="badge"
                            style={{
                              background: "#f0fdf4",
                              color: "#166534",
                              border: "1px solid #bbf7d0",
                              fontSize: "0.72rem",
                            }}
                          >
                            {cand.level}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--danger)" }}>
                          Hạn: {formatDateVN(cand.deadline) || "Chưa rõ"}
                        </div>
                        {cand.eventDate && (
                          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                            Diễn ra: {formatDateVN(cand.eventDate)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {isApproved ? (
                        <span
                          className="badge"
                          style={{
                            background: "#dcfce7",
                            color: "#15803d",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                          title="Hồ sơ đã được phê duyệt và đang công bố trên Cổng thông tin"
                        >
                          <CheckCircle size={12} />
                          Đã công bố
                        </span>
                      ) : cand.changeType === "update" ? (
                        <span
                          className="badge"
                          style={{
                            background: "#e0f2fe",
                            color: "#0369a1",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                          title="Đề xuất cập nhật dữ liệu cho hồ sơ đã công bố"
                        >
                          Cập nhật gốc
                        </span>
                      ) : dedupe.isDuplicate ? (
                        <span
                          className="badge"
                          style={{
                            background: "#fee2e2",
                            color: "#991b1b",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                          title={dedupe.matchReason}
                        >
                          <AlertTriangle size={12} />
                          Nghi trùng
                        </span>
                      ) : (
                        <span style={{ color: "var(--success)", fontSize: "0.8rem", fontWeight: 600 }}>
                          Mới
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "center" }}>
                        {primaryCat === "out_of_scope" ? (
                          <span className="badge" style={{ background: "#f3e8ff", color: "#7e22ce" }}>
                            NGOÀI PHẠM VI
                          </span>
                        ) : primaryCat === "expired" ? (
                          <span className="badge" style={{ background: "#f1f5f9", color: "#64748b" }}>
                            HẾT HẠN
                          </span>
                        ) : primaryCat === "approved" ? (
                          <span className="badge badge-success">ĐÃ DUYỆT</span>
                        ) : primaryCat === "closed" ? (
                          <span
                            className="badge"
                            style={{
                              background: "#f1f5f9",
                              color: "#475569",
                              border: "1px solid #cbd5e1",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                            }}
                            title={cand.rejectionReason}
                          >
                            TỰ ĐỘNG ĐÓNG
                          </span>
                        ) : primaryCat === "rejected" ? (
                          <span className="badge badge-warning">TỪ CHỐI</span>
                        ) : primaryCat === "updates" || cand.changeType === "update" ? (
                          <span
                            className="badge"
                            style={{
                              background: "#e0f2fe",
                              color: "#0369a1",
                              border: "1px solid #bae6fd",
                              fontWeight: 700,
                              fontSize: "0.72rem",
                            }}
                          >
                            ĐỀ XUẤT CẬP NHẬT
                          </span>
                        ) : primaryCat === "needs_review" ? (
                          <span className="badge" style={{ background: "#fef3c7", color: "#b45309" }}>
                            CẦN HIỆU CHỈNH
                          </span>
                        ) : (
                          <span className="badge badge-new">CHỜ DUYỆT</span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                        {!isApproved ? (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleQuickApprove(cand)}
                            disabled={isApprovingThis || bulkApproving}
                            style={{
                              background: "#16a34a",
                              color: "#ffffff",
                              border: "none",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <CheckCircle size={13} />
                            {isApprovingThis ? "Đang duyệt..." : "Duyệt"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleRecallCandidate(cand)}
                            disabled={recallingId === cand.id}
                            style={{
                              background: "#fff1f2",
                              color: "#be123c",
                              border: "1px solid #fecdd3",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                            title="Thu hồi hội thảo về hàng chờ duyệt"
                          >
                            <RotateCcw size={13} />
                            {recallingId === cand.id ? "Đang thu hồi..." : "Thu hồi"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setSelectedCandidate(cand)}
                        >
                          Kiểm duyệt
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
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
            gap: 20,
          }}
        >
          {filteredCandidates.map((cand) => {
            const isApproved = cand.status === "approved";
            const isApprovingThis = approvingId === cand.id;
            const primaryCat = getCandidatePrimaryCategory(cand);

            // Exclude matching candidate's own published opportunity to avoid self-duplication false positives
            const otherPublishedOpps = publishedOpps.filter(
              (opp) => opp.id !== cand.publishedOpportunityId && opp.candidateId !== cand.id
            );
            const dedupe = isDuplicateOpportunity(
              {
                title: cand.title,
                sourceUrl: cand.sourceUrl,
                organizer: cand.organizer,
                deadline: cand.deadline,
                eventDate: cand.eventDate,
              },
              otherPublishedOpps
            );

            return (
              <div
                key={cand.id}
                className="card card-hover"
                style={{ display: "flex", flexDirection: "column" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                    flexWrap: "wrap",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    {!isApproved && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(cand.id)}
                        onChange={() => toggleSelectOne(cand.id)}
                      />
                    )}
                    {cand.conferenceCode && (
                      <span
                        className="badge"
                        style={{
                          backgroundColor: cand.conferenceCode.startsWith("QT") ? "#fef3c7" : "#e0e7ff",
                          color: cand.conferenceCode.startsWith("QT") ? "#92400e" : "#3730a3",
                          border: `1px solid ${cand.conferenceCode.startsWith("QT") ? "#fde68a" : "#c7d2fe"}`,
                          fontWeight: 800,
                          fontSize: "0.72rem",
                          padding: "2px 6px",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {cand.conferenceCode}
                      </span>
                    )}
                    {isDiscoveredTodayVN(cand) && (
                      <span className="badge-new-spark" title="Mới phát hiện trong ngày hôm nay (giờ VN)">
                        <Sparkles size={10} /> NEW
                      </span>
                    )}
                    {cand.changeType === "update" && (
                      <span
                        className="badge"
                        style={{
                          backgroundColor: "#e0f2fe",
                          color: "#0369a1",
                          border: "1px solid #bae6fd",
                          fontWeight: 700,
                          fontSize: "0.70rem",
                          padding: "2px 6px",
                        }}
                      >
                        Đề xuất cập nhật
                      </span>
                    )}
                    <span className="badge badge-neutral">{cand.type}</span>
                    {cand.level && (
                      <span
                        className="badge"
                        style={{
                          background: "#f0fdf4",
                          color: "#166534",
                          border: "1px solid #bbf7d0",
                          fontSize: "0.72rem",
                        }}
                      >
                        {cand.level}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end" }}>
                    {primaryCat === "out_of_scope" ? (
                      <span className="badge" style={{ background: "#f3e8ff", color: "#7e22ce" }}>
                        NGOÀI PHẠM VI
                      </span>
                    ) : primaryCat === "expired" ? (
                      <span className="badge" style={{ background: "#f1f5f9", color: "#64748b" }}>
                        HẾT HẠN
                      </span>
                    ) : primaryCat === "approved" ? (
                      <span className="badge badge-success">ĐÃ DUYỆT</span>
                    ) : primaryCat === "closed" ? (
                      <span
                        className="badge"
                        style={{
                          background: "#f1f5f9",
                          color: "#475569",
                          border: "1px solid #cbd5e1",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                        }}
                        title={cand.rejectionReason}
                      >
                        TỰ ĐỘNG ĐÓNG
                      </span>
                    ) : primaryCat === "rejected" ? (
                      <span className="badge badge-warning">TỪ CHỐI</span>
                    ) : primaryCat === "updates" || cand.changeType === "update" ? (
                      <span
                        className="badge"
                        style={{
                          background: "#e0f2fe",
                          color: "#0369a1",
                          border: "1px solid #bae6fd",
                          fontWeight: 700,
                          fontSize: "0.72rem",
                        }}
                      >
                        ĐỀ XUẤT CẬP NHẬT
                      </span>
                    ) : primaryCat === "needs_review" ? (
                      <span className="badge" style={{ background: "#fef3c7", color: "#b45309" }}>
                        CẦN HIỆU CHỈNH
                      </span>
                    ) : (
                      <span className="badge badge-new">CHỜ DUYỆT</span>
                    )}
                  </div>
                </div>

                <h3
                  style={{
                    fontSize: "1.05rem",
                    color: "var(--primary)",
                    marginBottom: 8,
                    lineHeight: 1.4,
                  }}
                >
                  {cand.title}
                </h3>

                <div style={{ fontSize: "0.8125rem", color: "var(--muted)", marginBottom: 8 }}>
                  Đơn vị: <strong>{cand.organizer}</strong>
                  {cand.country ? ` (${cand.country})` : ""}
                </div>

                {cand.field && (
                  <div style={{ fontSize: "0.78rem", color: "var(--teal)", marginBottom: 8 }}>
                    Chuyên ngành: {cand.field}
                  </div>
                )}

                {cand.publishedOpportunityId && (
                  <div
                    style={{
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      border: "1px solid #bfdbfe",
                      padding: "8px 10px",
                      borderRadius: 6,
                      fontSize: "0.75rem",
                      marginBottom: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div>
                      Hồ sơ gốc:{" "}
                      <strong>
                        {(() => {
                          const orig = publishedOpps.find((o) => o.id === cand.publishedOpportunityId);
                          return orig ? `[${orig.conferenceCode || "Đã duyệt"}] ${orig.title}` : cand.publishedOpportunityId;
                        })()}
                      </strong>
                    </div>
                    {cand.diffSummary && cand.diffSummary.length > 0 && (
                      <div style={{ color: "#475569", fontSize: "0.72rem" }}>
                        Thay đổi: {cand.diffSummary.map((d) => d.label || d.field).join(", ")}
                      </div>
                    )}
                    <div style={{ color: "#64748b", fontSize: "0.71rem" }}>
                      Phát hiện gốc: {formatDateVN(cand.discoveredAt || cand.createdAt)}
                      {cand.updatedAt && ` • Cập nhật: ${formatDateVN(cand.updatedAt)}`}
                    </div>
                  </div>
                )}

                {primaryCat === "closed" && (
                  <div
                    style={{
                      background: "#f8fafc",
                      color: "#475569",
                      border: "1px solid #cbd5e1",
                      padding: "6px 10px",
                      borderRadius: 6,
                      fontSize: "0.75rem",
                      marginBottom: 12,
                    }}
                  >
                    <strong>Tự đóng (Hệ thống):</strong> {cand.rejectionReason || "Dữ liệu trùng khớp với hội thảo công bố"}
                  </div>
                )}

                {primaryCat === "rejected" && (
                  <div
                    style={{
                      background: "#fef2f2",
                      color: "#991b1b",
                      border: "1px solid #fecaca",
                      padding: "6px 10px",
                      borderRadius: 6,
                      fontSize: "0.75rem",
                      marginBottom: 12,
                    }}
                  >
                    <div><strong>Người từ chối:</strong> {cand.reviewedBy || "Admin"}</div>
                    <div><strong>Lý do:</strong> {cand.rejectionReason || "Chưa có lý do"}</div>
                  </div>
                )}

                {!isApproved && cand.changeType !== "update" && dedupe.isDuplicate && (
                  <div
                    style={{
                      background: "#fee2e2",
                      color: "#991b1b",
                      padding: "6px 10px",
                      borderRadius: 6,
                      fontSize: "0.75rem",
                      marginBottom: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <AlertTriangle size={13} />
                    <span>{dedupe.matchReason}</span>
                  </div>
                )}

                <div
                  style={{
                    marginTop: "auto",
                    paddingTop: 12,
                    borderTop: "1px solid var(--line)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.8125rem" }}>
                      Hạn:{" "}
                      <strong style={{ color: "var(--danger)" }}>
                        {formatDateVN(cand.deadline) || "Chưa rõ"}
                      </strong>
                    </div>
                    {cand.eventDate && (
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        Diễn ra: {formatDateVN(cand.eventDate)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {!isApproved ? (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => handleQuickApprove(cand)}
                        disabled={isApprovingThis || bulkApproving}
                        style={{
                          background: "#16a34a",
                          color: "#ffffff",
                          border: "none",
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <CheckCircle size={13} />
                        {isApprovingThis ? "Đang duyệt..." : "Duyệt"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => handleRecallCandidate(cand)}
                        disabled={recallingId === cand.id}
                        style={{
                          background: "#fff1f2",
                          color: "#be123c",
                          border: "1px solid #fecdd3",
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                        title="Thu hồi hội thảo về hàng chờ duyệt"
                      >
                        <RotateCcw size={13} />
                        {recallingId === cand.id ? "Đang thu hồi..." : "Thu hồi"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedCandidate(cand)}
                    >
                      Chi tiết
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      <CandidateReviewModal
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
        onRecall={handleRecallCandidate}
        onApprove={async (cand) => {
          await approveCandidate(cand, {
            uid: profile.uid,
            email: profile.email,
            role: profile.role,
          });
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(cand.id);
            return next;
          });
          setActionMessage({
            type: "success",
            text: `Đã duyệt và công bố "${cand.title}" lên Cổng thông tin NCKH.`,
          });
          await loadData();
        }}
        onReject={async (candId, candTitle, reason) => {
          await rejectCandidate(candId, candTitle, reason, {
            uid: profile.uid,
            email: profile.email,
            role: profile.role,
          });
          setActionMessage({
            type: "success",
            text: `Đã từ chối ứng viên "${candTitle}".`,
          });
          await loadData();
        }}
        onNeedsReview={async (candId, candTitle, reason) => {
          await markCandidateNeedsReview(candId, candTitle, reason, {
            uid: profile.uid,
            email: profile.email,
            role: profile.role,
          });
          setActionMessage({
            type: "success",
            text: `Đã chuyển "${candTitle}" sang trạng thái Cần hiệu chỉnh.`,
          });
          await loadData();
        }}
        onDelete={async (candId, candTitle) => {
          await deleteCandidate(candId, candTitle, {
            uid: profile.uid,
            email: profile.email,
            role: profile.role,
          });
          setActionMessage({
            type: "success",
            text: `Đã xóa ứng viên "${candTitle}".`,
          });
          await loadData();
        }}
      />

      {/* Sync from IFA Faculty Research (Spark) Modal */}
      <FacultyResearchSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        existingCandidates={candidates}
        publishedOpportunities={publishedOpps}
        onSuccess={async () => {
          await loadData();
        }}
      />
    </div>
  );
};
