import React from "react";
import type { Opportunity } from "../types";
import { formatDateVN, getOpportunityDeadlineInfo } from "../utils/date";
import { getFeeStatusInfo } from "../utils/fee";
import {
  Calendar,
  Building,
  MapPin,
  Clock,
  BookOpen,
  Award,
  DollarSign,
} from "lucide-react";

interface OpportunityCardProps {
  opportunity: Opportunity;
  onViewDetail: (opp: Opportunity) => void;
}

export const OpportunityCard: React.FC<OpportunityCardProps> = ({
  opportunity,
  onViewDetail,
}) => {
  const deadlineInfo = getOpportunityDeadlineInfo(opportunity);
  const feeStatusInfo = getFeeStatusInfo(opportunity);

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
            fontSize: "0.7rem",
            padding: "2px 6px",
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
            fontSize: "0.7rem",
            padding: "2px 6px",
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
          fontSize: "0.7rem",
          padding: "2px 6px",
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

  // URL priority:
  // - Eliminate all "mailto:" (replace with original page / source website)
  // - If submissionUrl is a web URL (http/https), link to it with "Đến trang đăng ký ↗"
  // - If submissionUrl is mailto: or missing, link to sourceUrl with "Đến trang gốc ↗"
  const isWebSubmission =
    opportunity.submissionUrl &&
    !opportunity.submissionUrl.startsWith("mailto:") &&
    /^https?:\/\//i.test(opportunity.submissionUrl);

  const primaryUrl = isWebSubmission
    ? opportunity.submissionUrl
    : opportunity.sourceUrl || (opportunity.submissionUrl && !opportunity.submissionUrl.startsWith("mailto:") ? opportunity.submissionUrl : undefined);

  const primaryBtnLabel = isWebSubmission
    ? "Đến trang đăng ký ↗"
    : "Đến trang gốc ↗";

  // Formatted dates in priority order: 1. Abstract -> 2. Full paper -> 3. Registration -> 4. Event
  const formattedAbstract = formatDateVN(opportunity.abstractDeadline);
  const formattedFullPaper = formatDateVN(
    opportunity.fullPaperDeadline || opportunity.deadline
  );
  const formattedRegistration = formatDateVN(opportunity.registrationDeadline);
  const formattedEvent = formatDateVN(opportunity.eventDate);

  const isUrgent = deadlineInfo.isUrgent;

  return (
    <article
      className={`card-opportunity ${isUrgent ? "card-opportunity-urgent" : ""}`}
    >
      {/* 1. Top Badges Header - Organized in max 2 rows */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 6,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 5,
            flexWrap: "wrap",
            alignItems: "center",
            maxWidth: "calc(100% - 110px)",
          }}
        >
          {opportunity.type && (
            <span
              className="badge badge-neutral"
              style={{ fontWeight: 700, fontSize: "0.72rem", padding: "2px 7px" }}
            >
              {opportunity.type}
            </span>
          )}
          {opportunity.level && (
            <span
              className="badge badge-neutral"
              style={{ fontSize: "0.72rem", padding: "2px 7px" }}
            >
              {opportunity.level}
            </span>
          )}
          {getSuitabilityBadge()}
        </div>

        <span
          className={`badge badge-${deadlineInfo.statusBadge.variant}`}
          style={{
            fontSize: "0.72rem",
            padding: "3px 8px",
            fontWeight: 700,
            whiteSpace: "nowrap",
            flexShrink: 0,
            backgroundColor: deadlineInfo.statusBadge.bg,
            color: deadlineInfo.statusBadge.color,
            borderColor: deadlineInfo.statusBadge.border,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Clock size={11} style={{ flexShrink: 0 }} />
          {deadlineInfo.statusBadge.text}
        </span>
      </div>

      {/* 2. Title (Prominent, clamped to 3 lines) */}
      <h3
        style={{
          fontSize: "1.08rem",
          fontWeight: 700,
          color: isUrgent ? "#991b1b" : "var(--primary)",
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

      {/* 6. Indexing & Fee badges */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        {(opportunity.indexing || opportunity.publicationFormat) && (
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
        )}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: "0.74rem",
            background: feeStatusInfo.bg,
            color: feeStatusInfo.color,
            border: `1px solid ${feeStatusInfo.border}`,
            padding: "3px 8px",
            borderRadius: 4,
            fontWeight: 600,
            lineHeight: 1.3,
          }}
        >
          <DollarSign size={12} style={{ flexShrink: 0 }} />
          <span>{feeStatusInfo.label}</span>
        </div>
      </div>

      {/* 7. Deadlines & Schedule box (Priority: Abstract -> Full Paper -> Registration -> Event) */}
      <div
        style={{
          background: isUrgent ? "#fff8f8" : "#f8fafc",
          border: isUrgent ? "1px solid #fecaca" : "1px solid var(--line)",
          borderRadius: 8,
          padding: "10px 12px",
          marginBottom: 16,
          marginTop: "auto",
          fontSize: "0.8rem",
          display: "flex",
          flexDirection: "column",
          gap: 5,
        }}
      >
        {/* Hạn nộp tóm tắt (Priority 1) */}
        {formattedAbstract && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: deadlineInfo.nearestDeadlineType === "abstract" ? "2px 6px" : undefined,
              borderRadius: 4,
              background:
                deadlineInfo.nearestDeadlineType === "abstract" && isUrgent
                  ? "#fee2e2"
                  : undefined,
            }}
          >
            <span style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar
                size={13}
                color={
                  deadlineInfo.nearestDeadlineType === "abstract" && isUrgent
                    ? "#dc2626"
                    : undefined
                }
              />
              Hạn nộp tóm tắt:
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <strong
                style={{
                  color:
                    deadlineInfo.nearestDeadlineType === "abstract" && isUrgent
                      ? "#b91c1c"
                      : "var(--text-main)",
                  fontWeight: 700,
                }}
              >
                {formattedAbstract}
              </strong>
              {deadlineInfo.nearestDeadlineType === "abstract" && (
                <span
                  style={{
                    fontSize: "0.68rem",
                    padding: "1px 5px",
                    borderRadius: 3,
                    background: isUrgent ? "#dc2626" : "#0284c7",
                    color: "#ffffff",
                    fontWeight: 700,
                  }}
                >
                  {deadlineInfo.countdownText}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Hạn nộp toàn văn (Priority 2) */}
        {formattedFullPaper && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: deadlineInfo.nearestDeadlineType === "fullPaper" ? "2px 6px" : undefined,
              borderRadius: 4,
              background:
                deadlineInfo.nearestDeadlineType === "fullPaper" && isUrgent
                  ? "#fee2e2"
                  : undefined,
            }}
          >
            <span style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar
                size={13}
                color={
                  deadlineInfo.nearestDeadlineType === "fullPaper" && isUrgent
                    ? "#dc2626"
                    : undefined
                }
              />
              Hạn nộp toàn văn:
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <strong
                style={{
                  color:
                    deadlineInfo.nearestDeadlineType === "fullPaper" && isUrgent
                      ? "#b91c1c"
                      : "var(--danger)",
                  fontWeight: 700,
                }}
              >
                {formattedFullPaper}
              </strong>
              {deadlineInfo.nearestDeadlineType === "fullPaper" && (
                <span
                  style={{
                    fontSize: "0.68rem",
                    padding: "1px 5px",
                    borderRadius: 3,
                    background: isUrgent ? "#dc2626" : "#0284c7",
                    color: "#ffffff",
                    fontWeight: 700,
                  }}
                >
                  {deadlineInfo.countdownText}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Hạn đăng ký (Priority 3) */}
        {formattedRegistration && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: deadlineInfo.nearestDeadlineType === "registration" ? "2px 6px" : undefined,
              borderRadius: 4,
              background:
                deadlineInfo.nearestDeadlineType === "registration" && isUrgent
                  ? "#fee2e2"
                  : undefined,
            }}
          >
            <span style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar
                size={13}
                color={
                  deadlineInfo.nearestDeadlineType === "registration" && isUrgent
                    ? "#dc2626"
                    : undefined
                }
              />
              Hạn đăng ký:
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  color:
                    deadlineInfo.nearestDeadlineType === "registration" && isUrgent
                      ? "#b91c1c"
                      : "var(--text-main)",
                  fontWeight: 600,
                }}
              >
                {formattedRegistration}
              </span>
              {deadlineInfo.nearestDeadlineType === "registration" && (
                <span
                  style={{
                    fontSize: "0.68rem",
                    padding: "1px 5px",
                    borderRadius: 3,
                    background: isUrgent ? "#dc2626" : "#0284c7",
                    color: "#ffffff",
                    fontWeight: 700,
                  }}
                >
                  {deadlineInfo.countdownText}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Ngày tổ chức */}
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

      {/* 8. Action Buttons (Dual CTAs) */}
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
