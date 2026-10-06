import React from "react";
import type { Opportunity } from "../types";
import { formatDateVN, getDeadlineBadge } from "../utils/date";
import {
  Calendar,
  Building,
  Tag,
  ExternalLink,
  Clock,
  Sparkles,
} from "lucide-react";

interface OpportunityCardProps {
  opportunity: Opportunity;
  onViewDetail: (opp: Opportunity) => void;
}

export const OpportunityCard: React.FC<OpportunityCardProps> = ({
  opportunity,
  onViewDetail,
}) => {
  const badgeInfo = getDeadlineBadge(opportunity.deadline, opportunity.createdAt);

  return (
    <div className="card card-hover" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Top Header: Category & Deadline Badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
            {opportunity.type}
          </span>
          <span className="badge badge-neutral">
            {opportunity.level}
          </span>
          {opportunity.sourceType === "SPARK" && (
            <span
              className="badge"
              style={{ backgroundColor: "#f3e8ff", color: "#6b21a8", border: "1px solid #e9d5ff" }}
              title="Được AI / Spark tổng hợp"
            >
              <Sparkles size={12} style={{ marginRight: 2 }} />
              SPARK AI
            </span>
          )}
        </div>
        <span className={`badge badge-${badgeInfo.variant}`}>
          <Clock size={12} style={{ marginRight: 2 }} />
          {badgeInfo.text}
        </span>
      </div>

      {/* Title */}
      <h3
        style={{
          fontSize: "1.05rem",
          fontWeight: 700,
          color: "var(--primary)",
          marginBottom: 8,
          lineHeight: 1.4,
          flex: "0 0 auto",
        }}
      >
        {opportunity.title}
      </h3>

      {/* Organizer & Country */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: "0.8125rem",
          color: "var(--muted)",
          marginBottom: 12,
        }}
      >
        <Building size={14} />
        <span>{opportunity.organizer} {opportunity.country ? `(${opportunity.country})` : ""}</span>
      </div>

      {/* Field / Department suitability */}
      {opportunity.field && (
        <div
          style={{
            fontSize: "0.8125rem",
            color: "var(--teal)",
            fontWeight: 600,
            marginBottom: 12,
            background: "#f0fdfa",
            padding: "4px 8px",
            borderRadius: 4,
            display: "inline-block",
          }}
        >
          Ngành phù hợp: {opportunity.field}
        </div>
      )}

      {/* Content snippet */}
      <p
        style={{
          fontSize: "0.85rem",
          color: "var(--text-sub)",
          marginBottom: 16,
          flex: "1 1 auto",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {opportunity.content}
      </p>

      {/* Tags */}
      {opportunity.tags && opportunity.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 16 }}>
          {opportunity.tags.slice(0, 3).map((tag, idx) => (
            <span key={idx} className="badge badge-neutral" style={{ fontSize: "0.7rem" }}>
              <Tag size={10} style={{ marginRight: 2 }} />
              {tag}
            </span>
          ))}
          {opportunity.tags.length > 3 && (
            <span className="badge badge-neutral" style={{ fontSize: "0.7rem" }}>
              +{opportunity.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer Info & Action */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "1px solid var(--line)",
          paddingTop: 12,
          marginTop: "auto",
        }}
      >
        <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Calendar size={13} />
            <span>Hạn: <strong style={{ color: "var(--text-main)" }}>{formatDateVN(opportunity.deadline) || "Đang cập nhật"}</strong></span>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onViewDetail(opportunity)}
        >
          Xem chi tiết
          <ExternalLink size={14} />
        </button>
      </div>
    </div>
  );
};
