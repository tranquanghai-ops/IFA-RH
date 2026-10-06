import React, { useState, useEffect } from "react";
import type { Opportunity } from "../types";
import { fetchPublishedOpportunities } from "../firebase/firestore";
import { OpportunityCard } from "../components/OpportunityCard";
import { OpportunityDetailModal } from "../components/OpportunityDetailModal";
import { Search, Filter, Sparkles, AlertCircle } from "lucide-react";

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
      {/* Hero Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #10394c 0%, #005696 100%)",
          color: "#ffffff",
          borderRadius: 12,
          padding: "36px 32px",
          marginBottom: 32,
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div style={{ maxWidth: 860 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255,255,255,0.15)",
              padding: "4px 12px",
              borderRadius: 9999,
              fontSize: "0.8125rem",
              fontWeight: 600,
              marginBottom: 14,
            }}
          >
            <Sparkles size={14} />
            CỔNG THÔNG TIN NCKH KHOA MỸ THUẬT CÔNG NGHIỆP
          </div>
          <h1 style={{ color: "#ffffff", fontSize: "2rem", marginBottom: 12 }}>
            Cơ hội Nghiên cứu Khoa học & Công bố Học thuật
          </h1>
          <p style={{ color: "#e0f2fe", fontSize: "1rem", lineHeight: 1.6 }}>
            Tổng hợp các hội thảo quốc gia và quốc tế, tạp chí Scopus/WoS, Special Issues, Call for Papers phù hợp định hướng nghiên cứu và đào tạo của giảng viên Khoa MTCN.
          </p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="card" style={{ marginBottom: 24, padding: "20px 24px" }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
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
              placeholder="Tìm kiếm hội thảo, đơn vị tổ chức, chủ đề, ngành..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Filter size={18} color="var(--primary)" />
            <select
              className="form-control"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{ width: "auto" }}
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
            padding: 16,
            borderRadius: 8,
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Grid of Opportunities */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>Đang tải danh sách cơ hội NCKH...</div>
        </div>
      ) : filteredOpportunities.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "var(--muted)",
          }}
        >
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--primary)", marginBottom: 8 }}>
            Chưa có cơ hội phù hợp với bộ lọc hiện tại
          </div>
          <p style={{ maxWidth: 500, margin: "0 auto", fontSize: "0.9rem" }}>
            Hãy thử tìm kiếm với từ khóa khác hoặc chọn "Tất cả" để xem toàn bộ danh mục hội thảo đã được công bố.
          </p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 16, fontSize: "0.9rem", color: "var(--muted)", fontWeight: 600 }}>
            Hiển thị {filteredOpportunities.length} cơ hội học thuật
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
              gap: 20,
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
