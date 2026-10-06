import React, { useState, useEffect } from "react";
import { useAuth } from "../firebase/auth";
import {
  fetchOpportunityCandidates,
  fetchPublishedOpportunities,
  approveCandidate,
  rejectCandidate,
  deleteCandidate,
  addCandidate,
} from "../firebase/firestore";
import type { OpportunityCandidate, Opportunity } from "../types";
import { CandidateReviewModal } from "../components/CandidateReviewModal";
import { formatDateVN } from "../utils/date";
import { isDuplicateOpportunity } from "../utils/dedupe";
import {
  Sparkles,
  LayoutGrid,
  List,
  CheckCircle,
  XCircle,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Search,
  Filter,
} from "lucide-react";

export const AdminCandidatesPage: React.FC = () => {
  const { profile } = useAuth();
  const [candidates, setCandidates] = useState<OpportunityCandidate[]>([]);
  const [publishedOpps, setPublishedOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal
  const [selectedCandidate, setSelectedCandidate] = useState<OpportunityCandidate | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cands, opps] = await Promise.all([
        fetchOpportunityCandidates(),
        fetchPublishedOpportunities(),
      ]);
      setCandidates(cands);
      setPublishedOpps(opps);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (!profile) return null;

  const filteredCandidates = candidates.filter((c) => {
    const matchStatus = statusFilter === "all" ? true : c.status === statusFilter;
    const matchSearch =
      searchQuery.trim() === "" ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.organizer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

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
            <h1 style={{ fontSize: "1.6rem", color: "var(--primary)" }}>Hàng chờ Cơ hội AI / Spark tìm được</h1>
            <span
              className="badge"
              style={{ background: "#f3e8ff", color: "#6b21a8", fontWeight: 700, padding: "4px 8px" }}
            >
              SPARK QUEUE
            </span>
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: 4 }}>
            Các hội thảo, Call for Papers do AI Spark thu thập tự động. Quản trị viên duyệt trước khi công bố ra công chúng.
          </p>
        </div>

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

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 280px" }}>
            <Search
              size={18}
              color="var(--muted)"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: 38 }}
              placeholder="Tìm kiếm ứng viên theo tiêu đề, đơn vị tổ chức..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Filter size={16} color="var(--primary)" />
            <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>Trạng thái:</span>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{ width: "auto" }}
            >
              <option value="pending">Chờ duyệt (Pending)</option>
              <option value="approved">Đã duyệt (Approved)</option>
              <option value="rejected">Từ chối (Rejected)</option>
              <option value="all">Tất cả</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
          Đang tải hàng chờ Spark...
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
          <Sparkles size={36} color="#7e22ce" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ color: "var(--primary)", marginBottom: 6 }}>Hàng chờ trống</h3>
          <p style={{ fontSize: "0.9rem", maxWidth: 450, margin: "0 auto" }}>
            Hiện tại không có ứng viên nào ở trạng thái "{statusFilter}".
          </p>
        </div>
      ) : viewMode === "table" ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Tiêu đề hội thảo / cơ hội</th>
                <th>Đơn vị tổ chức</th>
                <th>Loại / Cấp độ</th>
                <th>Hạn nộp (Deadline)</th>
                <th>Trùng lặp?</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
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

                return (
                  <tr key={cand.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--primary)", marginBottom: 2 }}>
                        {cand.title}
                      </div>
                      {cand.sourceUrl && (
                        <a
                          href={cand.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: 3, color: "var(--secondary)" }}
                        >
                          Nguồn chính thức <ExternalLink size={10} />
                        </a>
                      )}
                    </td>
                    <td>{cand.organizer} {cand.country ? `(${cand.country})` : ""}</td>
                    <td>
                      <span className="badge badge-neutral">{cand.type}</span>{" "}
                      <span className="badge badge-neutral">{cand.level}</span>
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--danger)" }}>
                      {formatDateVN(cand.deadline) || "Chưa rõ"}
                    </td>
                    <td>
                      {dedupe.isDuplicate ? (
                        <span
                          className="badge"
                          style={{ background: "#fee2e2", color: "#991b1b", display: "inline-flex", alignItems: "center", gap: 4 }}
                          title={dedupe.matchReason}
                        >
                          <AlertTriangle size={12} />
                          Nghi trùng
                        </span>
                      ) : (
                        <span style={{ color: "var(--success)", fontSize: "0.8rem", fontWeight: 600 }}>Mới</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          cand.status === "approved"
                            ? "badge-success"
                            : cand.status === "rejected"
                            ? "badge-warning"
                            : "badge-new"
                        }`}
                      >
                        {cand.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 20 }}>
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

            return (
              <div key={cand.id} className="card card-hover" style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span className="badge badge-neutral">{cand.type}</span>
                  <span
                    className={`badge ${
                      cand.status === "approved"
                        ? "badge-success"
                        : cand.status === "rejected"
                        ? "badge-warning"
                        : "badge-new"
                    }`}
                  >
                    {cand.status.toUpperCase()}
                  </span>
                </div>

                <h3 style={{ fontSize: "1.05rem", color: "var(--primary)", marginBottom: 8, lineHeight: 1.4 }}>
                  {cand.title}
                </h3>

                <div style={{ fontSize: "0.8125rem", color: "var(--muted)", marginBottom: 12 }}>
                  Đơn vị: <strong>{cand.organizer}</strong>
                </div>

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

                <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: "0.8125rem" }}>
                    Hạn: <strong style={{ color: "var(--danger)" }}>{formatDateVN(cand.deadline)}</strong>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSelectedCandidate(cand)}
                  >
                    Chi tiết & Duyệt
                  </button>
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
          await approveCandidate(
            cand,
            { uid: profile.uid, email: profile.email, role: profile.role }
          );
          await loadData();
        }}
        onReject={async (candId, candTitle, reason) => {
          await rejectCandidate(
            candId,
            candTitle,
            reason,
            { uid: profile.uid, email: profile.email, role: profile.role }
          );
          await loadData();
        }}
        onDelete={async (candId, candTitle) => {
          await deleteCandidate(
            candId,
            candTitle,
            { uid: profile.uid, email: profile.email, role: profile.role }
          );
          await loadData();
        }}
      />
    </div>
  );
};
