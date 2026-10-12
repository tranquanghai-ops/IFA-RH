import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../firebase/auth";
import {
  fetchOpportunityCandidates,
  fetchPublishedOpportunities,
  approveCandidate,
  rejectCandidate,
  deleteCandidate,
  markCandidateNeedsReview,
} from "../firebase/firestore";
import type { OpportunityCandidate, Opportunity } from "../types";
import { CandidateReviewModal } from "../components/CandidateReviewModal";
import { FacultyResearchSyncModal } from "../components/FacultyResearchSyncModal";
import { FacultyResearchSyncDashboard } from "../components/FacultyResearchSyncDashboard";
import { formatDateVN, parseDateSafe, getOpportunityDeadlineInfo } from "../utils/date";
import { isDuplicateOpportunity } from "../utils/dedupe";
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
} from "lucide-react";

export type CandidateFilterTab =
  | "today"
  | "pending"
  | "needs_review"
  | "approved"
  | "expired"
  | "rejected"
  | "all";

const isTodayDate = (dateStr?: string | null): boolean => {
  if (!dateStr) return false;
  const d = parseDateSafe(dateStr);
  if (!d) return false;
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
};

export const getCandidatePrimaryCategory = (
  c: OpportunityCandidate
): "today" | "pending" | "needs_review" | "approved" | "expired" | "rejected" => {
  if (c.status === "rejected") return "rejected";
  if (c.status === "approved") return "approved";
  if (c.sheetStatus === "HẾT HẠN" || getOpportunityDeadlineInfo(c).isExpired) {
    return "expired";
  }
  if (c.status === "needs_review") return "needs_review";
  if (isTodayDate(c.createdAt) || isTodayDate(c.discoveredAt)) {
    return "today";
  }
  return "pending";
};

const FILTER_TABS: Array<{ id: CandidateFilterTab; label: string }> = [
  { id: "today", label: "Mới hôm nay" },
  { id: "pending", label: "Chờ duyệt" },
  { id: "needs_review", label: "Cần hiệu chỉnh" },
  { id: "approved", label: "Đã duyệt" },
  { id: "expired", label: "Hết hạn" },
  { id: "rejected", label: "Từ chối" },
  { id: "all", label: "Tất cả" },
];

export const AdminCandidatesPage: React.FC = () => {
  const { profile } = useAuth();
  const [candidates, setCandidates] = useState<OpportunityCandidate[]>([]);
  const [publishedOpps, setPublishedOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [activeTab, setActiveTab] = useState<CandidateFilterTab>("pending");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals & Actions
  const [selectedCandidate, setSelectedCandidate] = useState<OpportunityCandidate | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
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
        const todayCount = cands.filter((c) => getCandidatePrimaryCategory(c) === "today").length;
        const needsReviewCount = cands.filter((c) => getCandidatePrimaryCategory(c) === "needs_review").length;
        if (pendingCount === 0 && todayCount > 0) {
          setActiveTab("today");
        } else if (pendingCount === 0 && todayCount === 0 && needsReviewCount > 0) {
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

  // Compute non-overlapping counts for each tab
  const tabCounts = useMemo(() => {
    const counts: Record<CandidateFilterTab, number> = {
      today: 0,
      pending: 0,
      needs_review: 0,
      approved: 0,
      expired: 0,
      rejected: 0,
      all: candidates.length,
    };
    for (const cand of candidates) {
      const cat = getCandidatePrimaryCategory(cand);
      counts[cat]++;
    }
    return counts;
  }, [candidates]);

  // Filter candidates based on activeTab and searchQuery
  const filteredCandidates = useMemo(() => {
    return candidates.filter((cand) => {
      // 1. Tab filter
      if (activeTab !== "all") {
        const cat = getCandidatePrimaryCategory(cand);
        if (cat !== activeTab) return false;
      }
      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = cand.title.toLowerCase().includes(q);
        const matchOrg = cand.organizer.toLowerCase().includes(q);
        const matchField = !!(cand.field && cand.field.toLowerCase().includes(q));
        const matchLevel = !!(cand.level && cand.level.toLowerCase().includes(q));
        const matchType = !!(cand.type && cand.type.toLowerCase().includes(q));
        if (!matchTitle && !matchOrg && !matchField && !matchLevel && !matchType) {
          return false;
        }
      }
      return true;
    });
  }, [candidates, activeTab, searchQuery]);

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
      return cat === "pending" || cat === "today";
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
            return cat === "pending" || cat === "today";
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

      {/* Search Bar & Horizontal Responsive Filter Buttons */}
      <div className="card" style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Search Box */}
          <div style={{ position: "relative", width: "100%" }}>
            <Search
              size={18}
              color="var(--muted)"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: 38 }}
              placeholder="Tìm kiếm ứng viên theo tiêu đề, đơn vị tổ chức, ngành, cấp độ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Horizontal Filter Buttons */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
            }}
          >
            {FILTER_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const count = tabCounts[tab.id];
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    border: isActive ? "1px solid var(--primary)" : "1px solid #cbd5e1",
                    background: isActive ? "var(--primary)" : "#ffffff",
                    color: isActive ? "#ffffff" : "var(--text-main)",
                    fontWeight: isActive ? 600 : 500,
                    fontSize: "0.84rem",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "all 0.15s ease",
                    boxShadow: isActive ? "0 2px 4px rgba(0,0,0,0.12)" : "none",
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      background: isActive ? "rgba(255, 255, 255, 0.25)" : "#f1f5f9",
                      color: isActive ? "#ffffff" : "#475569",
                      padding: "1px 7px",
                      borderRadius: 10,
                      fontSize: "0.75rem",
                      fontWeight: 700,
                    }}
                  >
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>
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
        <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
          <Sparkles size={36} color="#7e22ce" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ color: "var(--primary)", marginBottom: 6 }}>Danh sách trống</h3>
          <p style={{ fontSize: "0.9rem", maxWidth: 450, margin: "0 auto" }}>
            Không có ứng viên nào thuộc nhóm "
            {FILTER_TABS.find((t) => t.id === activeTab)?.label || activeTab}
            " phù hợp với điều kiện tìm kiếm.
          </p>
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
                const dedupe = isDuplicateOpportunity(
                  {
                    title: cand.title,
                    sourceUrl: cand.sourceUrl,
                    organizer: cand.organizer,
                    deadline: cand.deadline,
                    eventDate: cand.eventDate,
                  },
                  publishedOpps
                );

                const primaryCat = getCandidatePrimaryCategory(cand);
                const isApproved = cand.status === "approved";
                const isApprovingThis = approvingId === cand.id;

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
                      <div style={{ fontWeight: 600, color: "var(--primary)", marginBottom: 2 }}>
                        {cand.title}
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
                      {dedupe.isDuplicate ? (
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
                      {primaryCat === "expired" ? (
                        <span className="badge" style={{ background: "#f1f5f9", color: "#64748b" }}>
                          HẾT HẠN
                        </span>
                      ) : primaryCat === "approved" ? (
                        <span className="badge badge-success">ĐÃ DUYỆT</span>
                      ) : primaryCat === "rejected" ? (
                        <span className="badge badge-warning">TỪ CHỐI</span>
                      ) : primaryCat === "needs_review" ? (
                        <span className="badge" style={{ background: "#fef3c7", color: "#b45309" }}>
                          CẦN HIỆU CHỈNH
                        </span>
                      ) : primaryCat === "today" ? (
                        <span className="badge" style={{ background: "#dcfce7", color: "#15803d" }}>
                          MỚI HÔM NAY
                        </span>
                      ) : (
                        <span className="badge badge-new">CHỜ DUYỆT</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                        {!isApproved && (
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
            const dedupe = isDuplicateOpportunity(
              {
                title: cand.title,
                sourceUrl: cand.sourceUrl,
                organizer: cand.organizer,
                deadline: cand.deadline,
                eventDate: cand.eventDate,
              },
              publishedOpps
            );

            const primaryCat = getCandidatePrimaryCategory(cand);
            const isApproved = cand.status === "approved";
            const isApprovingThis = approvingId === cand.id;

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
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {!isApproved && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(cand.id)}
                        onChange={() => toggleSelectOne(cand.id)}
                      />
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
                  {primaryCat === "expired" ? (
                    <span className="badge" style={{ background: "#f1f5f9", color: "#64748b" }}>
                      HẾT HẠN
                    </span>
                  ) : primaryCat === "approved" ? (
                    <span className="badge badge-success">ĐÃ DUYỆT</span>
                  ) : primaryCat === "rejected" ? (
                    <span className="badge badge-warning">TỪ CHỐI</span>
                  ) : primaryCat === "needs_review" ? (
                    <span className="badge" style={{ background: "#fef3c7", color: "#b45309" }}>
                      CẦN HIỆU CHỈNH
                    </span>
                  ) : primaryCat === "today" ? (
                    <span className="badge" style={{ background: "#dcfce7", color: "#15803d" }}>
                      MỚI HÔM NAY
                    </span>
                  ) : (
                    <span className="badge badge-new">CHỜ DUYỆT</span>
                  )}
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

                {dedupe.isDuplicate && (
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
                    {!isApproved && (
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
