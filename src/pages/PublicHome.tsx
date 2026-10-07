import React, { useState, useEffect } from "react";
import type { Opportunity } from "../types";
import { fetchPublishedOpportunities } from "../firebase/firestore";
import { OpportunityCard } from "../components/OpportunityCard";
import { OpportunityDetailModal } from "../components/OpportunityDetailModal";
import {
  Search,
  Filter,
  Sparkles,
  AlertCircle,
  RefreshCw,
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

  const filteredOpportunities = opportunities.filter((opp) => {
    // Search query
    const matchQuery =
      searchQuery.trim() === "" ||
      opp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opp.organizer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (opp.field && opp.field.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (opp.topic && opp.topic.toLowerCase().includes(searchQuery.toLowerCase()));

    // Tag
    let matchTag = selectedTag === "Tất cả";
    if (selectedTag === "Quốc tế") {
      matchTag = opp.level === "Quốc tế";
    } else if (selectedTag === "Trong nước") {
      matchTag = opp.level !== "Quốc tế";
    } else if (selectedTag === "Rất phù hợp MTCN") {
      matchTag = (opp.suitability || "").toLowerCase().includes("rất phù hợp");
    } else if (opp.tags && opp.tags.length > 0) {
      matchTag = opp.tags.some(
        (t) => t.toLowerCase() === selectedTag.toLowerCase() || t.toLowerCase().includes(selectedTag.toLowerCase())
      );
    }

    // Type
    const matchType = selectedType === "Tất cả" || opp.type === selectedType;

    return matchQuery && matchTag && matchType;
  });

  return (
    <div className="app-container">
      {/* Hero Banner (SCImago Academic Portal Header: Clean, Compact, Zero "Cơ hội") */}
      <section
        style={{
          background: "linear-gradient(135deg, #0f3557 0%, #005696 100%)",
          color: "#ffffff",
          borderRadius: 8,
          padding: "24px 26px 22px",
          marginBottom: 20,
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
            <Sparkles size={14} />
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

      {/* Search and Filters Bar */}
      <div className="card" style={{ marginBottom: 20, padding: "16px 20px" }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          {/* Search box */}
          <div style={{ position: "relative", flex: "1 1 320px" }}>
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
          <div style={{ textAlign: "center", padding: "24px 20px", color: "var(--muted)", fontSize: "0.95rem" }}>
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
                <div style={{ height: 20, background: "#f1f5f9", borderRadius: 4, width: "50%" }} />
                <div style={{ height: 32, background: "#f1f5f9", borderRadius: 4, width: "90%" }} />
                <div style={{ height: 16, background: "#f1f5f9", borderRadius: 4, width: "70%" }} />
                <div style={{ height: 60, background: "#f8fafc", borderRadius: 6, marginTop: "auto" }} />
                <div style={{ height: 34, background: "#f1f5f9", borderRadius: 6 }} />
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
          <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--primary)", marginBottom: 8 }}>
            Chưa có dữ liệu NCKH phù hợp.
          </div>
          <p style={{ maxWidth: 480, margin: "0 auto", fontSize: "0.875rem" }}>
            Hãy thử tìm kiếm với từ khóa khác hoặc bấm &ldquo;Tất cả&rdquo; để xem toàn bộ danh mục hội thảo và công bố học thuật.
          </p>
        </div>
      ) : (
        /* Pure Card Grid Presentation */
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, fontSize: "0.85rem", color: "var(--muted)" }}>
            <div>
              Hiển thị <strong>{filteredOpportunities.length}</strong> công bố học thuật &amp; hội thảo phù hợp
            </div>
          </div>

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

      {/* Detail Modal */}
      <OpportunityDetailModal
        opportunity={selectedOpp}
        onClose={() => setSelectedOpp(null)}
      />
    </div>
  );
};
