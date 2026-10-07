import type { Opportunity, OpportunityCandidate, OpportunityFeeStatus } from "../types";

/**
 * Standard fee fallback when official source does not specify fees.
 * Never default to 0đ or "Miễn phí" unless verified from official source.
 */
export const UNKNOWN_FEE_TEXT = "Không rõ chi phí";
export const FREE_FEE_TEXT = "Miễn phí";

/**
 * Normalizes and formats a fee string with strict safety checks.
 */
export function formatFeeValue(fee?: string | null): string {
  if (!fee || typeof fee !== "string") {
    return UNKNOWN_FEE_TEXT;
  }
  const trimmed = fee.trim();
  if (trimmed === "" || trimmed === "0" || trimmed === "0đ" || trimmed === "0 VND") {
    return UNKNOWN_FEE_TEXT;
  }
  const lower = trimmed.toLowerCase();
  if (lower.includes("không rõ") || lower.includes("chưa rõ") || lower.includes("chưa có")) {
    return UNKNOWN_FEE_TEXT;
  }
  if (lower === "free" || lower.includes("miễn phí")) {
    return FREE_FEE_TEXT;
  }
  return trimmed;
}

/**
 * Resolves the publication / APC fee for an opportunity.
 */
export function getPublicationFeeDisplay(
  opp?: Partial<Opportunity | OpportunityCandidate> | null
): string {
  if (!opp) return UNKNOWN_FEE_TEXT;

  if (opp.feeStatus === "FREE") {
    return FREE_FEE_TEXT;
  }

  if (opp.publicationFee && opp.publicationFee.trim()) {
    return formatFeeValue(opp.publicationFee);
  }

  // Fallback to legacy fee field if it specifies author/publication fee or is explicitly free
  if (opp.fee && opp.fee.trim()) {
    const feeFormatted = formatFeeValue(opp.fee);
    if (feeFormatted === FREE_FEE_TEXT) {
      return FREE_FEE_TEXT;
    }
    // If the legacy fee mentions general fee or author fee
    return feeFormatted;
  }

  return UNKNOWN_FEE_TEXT;
}

/**
 * Resolves the attendee / registration fee for an opportunity.
 */
export function getRegistrationFeeDisplay(
  opp?: Partial<Opportunity | OpportunityCandidate> | null
): string {
  if (!opp) return UNKNOWN_FEE_TEXT;

  if (opp.feeStatus === "FREE") {
    return FREE_FEE_TEXT;
  }

  if (opp.registrationFee && opp.registrationFee.trim()) {
    return formatFeeValue(opp.registrationFee);
  }

  // Fallback to legacy fee if explicitly free
  if (opp.fee && opp.fee.trim()) {
    const feeFormatted = formatFeeValue(opp.fee);
    if (feeFormatted === FREE_FEE_TEXT) {
      return FREE_FEE_TEXT;
    }
  }

  return UNKNOWN_FEE_TEXT;
}

/**
 * Determines fee status badge styling.
 */
export function getFeeStatusInfo(opp?: Partial<Opportunity | OpportunityCandidate> | null): {
  label: string;
  variant: "free" | "specified" | "unknown";
  bg: string;
  color: string;
  border: string;
} {
  const pubFee = getPublicationFeeDisplay(opp);
  const regFee = getRegistrationFeeDisplay(opp);

  if (pubFee === FREE_FEE_TEXT && regFee === FREE_FEE_TEXT) {
    return {
      label: "Miễn phí tham dự & đăng bài",
      variant: "free",
      bg: "#ecfdf5",
      color: "#047857",
      border: "#a7f3d0",
    };
  }

  if (pubFee !== UNKNOWN_FEE_TEXT || regFee !== UNKNOWN_FEE_TEXT) {
    return {
      label: "Có biểu phí công bố",
      variant: "specified",
      bg: "#eff6ff",
      color: "#1d4ed8",
      border: "#bfdbfe",
    };
  }

  return {
    label: "Không rõ chi phí",
    variant: "unknown",
    bg: "#f8fafc",
    color: "#64748b",
    border: "#e2e8f0",
  };
}
