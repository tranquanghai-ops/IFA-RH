import React, { useState, useEffect } from "react";
import type { Opportunity } from "../types";
import { fetchPublishedOpportunities } from "../firebase/firestore";
import { OpportunityCard } from "../components/OpportunityCard";
import { OpportunityDetailModal } from "../components/OpportunityDetailModal";
import { formatDateVN, getDeadlineBadge } from "../utils/date";
import {
  Search,
  Filter,
  Sparkles,
  AlertCircle,
  LayoutGrid,
  List,
  Calendar,
  ExternalLink,
  Clock,
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

export const PublicHome: React.FC = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("Tất cả");
  const [selectedType, setSelectedType] = useState("Tất cả");
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await fetchPublishedOpportunities();
      setOpportunities(list);
    } catch (err: any) {
      console.error(err);
      setError("Không thể tải danh sách cơ hội NCKH. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredOpportunities = opportunities.filter((opp) => {
    // Search query
    const matchQuery =
      searchQuery.trim() === "" ||
      opp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opp.organizer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (opp.field && opp.field.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (opp.topic && opp.topic.toLowerCase().includes(searchQuery.toLowerCase()));

    // Tag
    const matchTag =
      selectedTag === "Tất cả" ||
      (selectedTag === "Quốc tế" && opp.level === "Quốc tế") ||
      (selectedTag === "Trong nước" && opp.level !== "Quốc tế") ||
      (opp.tags && opp.tags.includes(selectedTag));

    // Type
    const matchType = selectedType === "Tất cả" || opp.type === selectedType;

    return matchQuery && matchTag && matchType;
  });

  return (
    <div className="app-container">
      {/* Hero Banner (SCImago Academic Portal Header) */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f3557 0%, #005696 100%)",
          color: "#ffffff",
          borderRadius: 8,
          padding: "32px 28px",
          marginBottom: 24,
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div style={{ maxWidth: 860 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255,255,255,0.14)",
              padding: "4px 12px",
              borderRadius: 9999,
              fontSize: "0.78rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              marginBottom: 12,
            }}
          >
            <Sparkles size={14} />
            CỔNG CƠ HỘI NCKH KHOA MỸ THUẬT CÔNG NGHIỆP
          </div>
          <h1 style={{ color: "#ffffff", fontSize: "1.75rem", marginBottom: 10, letterSpacing: "-0.01em" }}>
            Cơ hội Nghiên cứu Khoa học & Công bố Học thuật
          </h1>
          <p style={{ color: "#e0f2fe", fontSize: "0.95rem", lineHeight: 1.6, margin: 0 }}>
            Hệ thống dữ liệu học thuật tổng hợp các hội thảo quốc tế & quốc gia, chuyên san Scopus/WoS, Special Issues, Call for Papers phù hợp định hướng nghiên cứu và đào tạo giảng viên Khoa MTCN.
          </p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="card" style={{ marginBottom: 20, padding: "18px 20px" }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          {/* Search box */}
          <div style={{ position: "relative", flex: "1 1 300px" }}>
            <Search
              size={18}
              color="var(--muted)"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: 38 }}
              placeholder="Tìm kiếm hội thảo, đơn vị tổ chức, chủ đề, chuyên ngành..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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

          {/* View mode toggle */}
          <div style={{ display: "flex", border: "1px solid var(--line-strong)", borderRadius: 6, overflow: "hidden" }}>
            <button
              type="button"
              className="btn btn-sm"
              style={{
                backgroundColor: viewMode === "table" ? "var(--primary)" : "#ffffff",
                color: viewMode === "table" ? "#ffffff" : "var(--text-sub)",
                borderRadius: 0,
                border: "none",
                padding: "6px 12px",
              }}
              onClick={() => setViewMode("table")}
              title="Chế độ bảng dữ liệu SCImago"
            >
              <List size={16} style={{ marginRight: 4 }} />
              Bảng dữ liệu
            </button>
            <button
              type="button"
              className="btn btn-sm"
              style={{
                backgroundColor: viewMode === "cards" ? "var(--primary)" : "#ffffff",
                color: viewMode === "cards" ? "#ffffff" : "var(--text-sub)",
                borderRadius: 0,
                border: "none",
                padding: "6px 12px",
              }}
              onClick={() => setViewMode("cards")}
              title="Chế độ ô vuông"
            >
              <LayoutGrid size={16} style={{ marginRight: 4 }} />
              Ô vuông
            </button>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="chip-group">
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
            gap: 10,
          }}
        >
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Opportunities Presentation */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
          <div style={{ fontSize: "1.05rem", fontWeight: 600 }}>Đang tải danh mục cơ hội NCKH...</div>
        </div>
      ) : filteredOpportunities.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "50px 20px",
            color: "var(--muted)",
          }}
        >
          <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--primary)", marginBottom: 8 }}>
            Không tìm thấy cơ hội phù hợp với tiêu chí lọc
          </div>
          <p style={{ maxWidth: 480, margin: "0 auto", fontSize: "0.875rem" }}>
            Hãy thử tìm kiếm với từ khóa khác hoặc bấm "Tất cả" để xem danh mục hội thảo và tạp chí đã công bố.
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, fontSize: "0.85rem", color: "var(--muted)" }}>
            <div>
              Hiển thị <strong>{filteredOpportunities.length}</strong> cơ hội học thuật phù hợp
            </div>
          </div>

          {viewMode === "table" ? (
            /* SCImago-style Academic Data Table */
            <div className="table-container" style={{ marginBottom: 32 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>Loại & Cấp độ</th>
                    <th>Cơ hội NCKH / Đơn vị tổ chức</th>
                    <th>Chuyên ngành phù hợp</th>
                    <th style={{ width: 160 }}>Hạn nộp & Tổ chức</th>
                    <th style={{ width: 120, textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOpportunities.map((opp) => {
                    const badgeInfo = getDeadlineBadge(opp.deadline, opp.createdAt);
                    return (
                      <tr key={opp.id}>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                            <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
                              {opp.type}
                            </span>
                            <span className="badge badge-neutral">
                              {opp.level}
                            </span>
                            {opp.sourceType === "SPARK" && (
                              <span
                                className="badge"
                                style={{ backgroundColor: "#f3e8ff", color: "#6b21a8", border: "1px solid #e9d5ff", fontSize: "0.7rem" }}
                                title="Thu thập bởi AI / Spark"
                              >
                                SPARK AI
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: "var(--primary)", fontSize: "0.95rem", marginBottom: 4 }}>
                            {opp.title}
                          </div>
                          <div style={{ fontSize: "0.82rem", color: "var(--text-sub)", display: "flex", alignItems: "center", gap: 8 }}>
                            <span>{opp.organizer}</span>
                            <span>·</span>
                            <span>{opp.country}</span>
                            {opp.indexing && (
                              <>
                                <span>·</span>
                                <strong style={{ color: "var(--teal)" }}>{opp.indexing}</strong>
                              </>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: "0.85rem", color: "var(--text-main)", marginBottom: 3 }}>
                            {opp.field}
                          </div>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {opp.tags?.slice(0, 3).map((tag) => (
                              <span key={tag} className="badge badge-neutral" style={{ fontSize: "0.7rem" }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                            <span className={`badge badge-${badgeInfo.variant}`}>
                              <Clock size={11} style={{ marginRight: 2 }} />
                              {badgeInfo.text}
                            </span>
                            <div style={{ fontSize: "0.8rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
                              <Calendar size={12} />
                              Hạn: {formatDateVN(opp.deadline)}
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedOpp(opp)}
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Card Grid View */
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
                gap: 20,
                marginBottom: 32,
              }}
            >
              {filteredOpportunities.map((opp) => (
                <OpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  onViewDetail={(item) => setSelectedOpp(item)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      <OpportunityDetailModal
        opportunity={selectedOpp}
        onClose={() => setSelectedOpp(null)}
      />
    </div>
  );
};
