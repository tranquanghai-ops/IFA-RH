import React from "react";
import type { Opportunity } from "../types";
import { formatDateVN, getDeadlineBadge } from "../utils/date";
import {
  Calendar,
  Building,
  MapPin,
  Clock,
  Sparkles,
  BookOpen,
  Award,
} from "lucide-react";

interface OpportunityCardProps {
  opportunity: Opportunity;
  onViewDetail: (opp: Opportunity) => void;
}

export const OpportunityCard: React.FC<OpportunityCardProps> = ({
  opportunity,
  onViewDetail,
}) => {
  const badgeInfo = getDeadlineBadge(
    opportunity.fullPaperDeadline || opportunity.deadline,
    opportunity.createdAt || opportunity.discoveredAt
  );

  // Parse suitability badge
  const getSuitabilityBadge = () => {
    if (!opportunity.suitability) return null;
    const suit = opportunity.suitability.trim();
    if (suit.toLowerCase().includes("rất phù hợp")) {
      return (
        <span
          className="badge"
          style={{
            backgroundColor: "#ecfdf5",
            color: "#047857",
            border: "1px solid #a7f3d0",
            fontWeight: 700,
            fontSize: "0.72rem",
          }}
        >
          ★ {suit}
        </span>
      );
    }
    if (suit.toLowerCase().includes("phù hợp")) {
      return (
        <span
          className="badge"
          style={{
            backgroundColor: "#eff6ff",
            color: "#1d4ed8",
            border: "1px solid #bfdbfe",
            fontWeight: 600,
            fontSize: "0.72rem",
          }}
        >
          {suit}
        </span>
      );
    }
    return (
      <span
        className="badge"
        style={{
          backgroundColor: "#f8fafc",
          color: "#475569",
          border: "1px solid #e2e8f0",
          fontSize: "0.72rem",
        }}
      >
        {suit}
      </span>
    );
  };

  // Majors / fields
  const fieldList = (opportunity.field || "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // URL priority: submissionUrl > sourceUrl
  const hasSubmission = !!opportunity.submissionUrl;
  const primaryUrl = opportunity.submissionUrl || opportunity.sourceUrl;
  const isMailto = primaryUrl?.startsWith("mailto:");
  const primaryBtnLabel = hasSubmission
    ? isMailto
      ? "Gửi bài qua email ↗"
      : "Đến trang đăng ký ↗"
    : "Đến nguồn ↗";

  const formattedDeadline = formatDateVN(
    opportunity.fullPaperDeadline || opportunity.deadline
  );
  const formattedAbstract = formatDateVN(opportunity.abstractDeadline);
  const formattedRegistration = formatDateVN(opportunity.registrationDeadline);
  const formattedEvent = formatDateVN(opportunity.eventDate);

  return (
    <article
      className="card card-hover"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "20px 20px 18px",
        borderRadius: 10,
        border: "1px solid var(--line-strong)",
        background: "#ffffff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      {/* 1. Top Badges Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {opportunity.type && (
            <span className="badge badge-neutral" style={{ fontWeight: 700, fontSize: "0.74rem" }}>
              {opportunity.type}
            </span>
          )}
          {opportunity.level && (
            <span className="badge badge-neutral" style={{ fontSize: "0.74rem" }}>
              {opportunity.level}
            </span>
          )}
          {opportunity.sourceType === "SPARK" && (
            <span
              className="badge"
              style={{
                backgroundColor: "#f3e8ff",
                color: "#6b21a8",
                border: "1px solid #e9d5ff",
                fontSize: "0.72rem",
                fontWeight: 700,
              }}
              title="Tổng hợp tự động bởi AI Spark"
            >
              <Sparkles size={11} style={{ marginRight: 3 }} />
              SPARK AI
            </span>
          )}
          {getSuitabilityBadge()}
        </div>

        <span className={`badge badge-${badgeInfo.variant}`} style={{ fontSize: "0.74rem" }}>
          <Clock size={11} style={{ marginRight: 3 }} />
          {badgeInfo.text}
        </span>
      </div>

      {/* 2. Title (Prominent, clamped to 3 lines) */}
      <h3
        style={{
          fontSize: "1.08rem",
          fontWeight: 700,
          color: "var(--primary)",
          marginBottom: 10,
          lineHeight: 1.45,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          minHeight: "2.9em",
        }}
        title={opportunity.title}
      >
        {opportunity.title}
      </h3>

      {/* 3. Organizer & Country */}
      {opportunity.organizer && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 7,
            fontSize: "0.83rem",
            color: "var(--text-sub)",
            marginBottom: 8,
            lineHeight: 1.4,
          }}
        >
          <Building size={15} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            {opportunity.organizer}
            {opportunity.country ? ` (${opportunity.country})` : ""}
          </span>
        </div>
      )}

      {/* 4. Location / Format if available */}
      {opportunity.location && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 7,
            fontSize: "0.8125rem",
            color: "var(--muted)",
            marginBottom: 10,
            lineHeight: 1.4,
          }}
        >
          <MapPin size={14} color="var(--teal)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{opportunity.location}</span>
        </div>
      )}

      {/* 5. Relevant majors / fields (Chips) */}
      {fieldList.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
          {fieldList.slice(0, 3).map((f, i) => (
            <span
              key={i}
              style={{
                fontSize: "0.72rem",
                color: "#0f766e",
                background: "#f0fdfa",
                border: "1px solid #ccfbf1",
                padding: "2px 7px",
                borderRadius: 4,
                fontWeight: 600,
              }}
            >
              {f}
            </span>
          ))}
          {fieldList.length > 3 && (
            <span
              style={{
                fontSize: "0.72rem",
                color: "var(--muted)",
                background: "#f1f5f9",
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              +{fieldList.length - 3}
            </span>
          )}
        </div>
      )}

      {/* 6. Indexing / Publication format badge */}
      {(opportunity.indexing || opportunity.publicationFormat) && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: "0.74rem",
              background: "#eff6ff",
              color: "#1e40af",
              border: "1px solid #dbeafe",
              padding: "3px 8px",
              borderRadius: 4,
              fontWeight: 600,
              lineHeight: 1.3,
            }}
          >
            <Award size={13} style={{ flexShrink: 0 }} />
            <span>{opportunity.indexing || opportunity.publicationFormat}</span>
          </div>
        </div>
      )}

      {/* 7. Deadlines & Schedule box */}
      <div
        style={{
          background: "#f8fafc",
          border: "1px solid var(--line)",
          borderRadius: 6,
          padding: "10px 12px",
          marginBottom: 16,
          marginTop: "auto",
          fontSize: "0.8rem",
          display: "flex",
          flexDirection: "column",
          gap: 5,
        }}
      >
        {formattedDeadline && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar size={13} />
              Hạn nộp toàn văn:
            </span>
            <strong style={{ color: "var(--danger)", fontWeight: 700 }}>{formattedDeadline}</strong>
          </div>
        )}

        {formattedAbstract && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar size={13} />
              Hạn tóm tắt:
            </span>
            <span style={{ color: "var(--text-main)", fontWeight: 600 }}>{formattedAbstract}</span>
          </div>
        )}

        {formattedRegistration && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar size={13} />
              Hạn đăng ký:
            </span>
            <span style={{ color: "var(--text-main)", fontWeight: 600 }}>{formattedRegistration}</span>
          </div>
        )}

        {formattedEvent && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <BookOpen size={13} />
              Ngày tổ chức:
            </span>
            <span style={{ color: "var(--teal)", fontWeight: 600 }}>{formattedEvent}</span>
          </div>
        )}
      </div>

      {/* 8. Action Buttons (IFAA Style: Dual CTAs) */}
      <div className="card-actions-row">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ flex: "1 1 0", minWidth: 110, justifyContent: "center" }}
          onClick={() => onViewDetail(opportunity)}
        >
          Xem chi tiết
        </button>

        {primaryUrl && (
          <a
            href={primaryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm"
            style={{
              flex: "1 1 0",
              minWidth: 130,
              justifyContent: "center",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>{primaryBtnLabel}</span>
          </a>
        )}
      </div>
    </article>
  );
};
