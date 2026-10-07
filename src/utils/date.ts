/**
 * Format ISO date string or Date object to dd/mm/yyyy
 * Safely handles "Chưa xác minh", date ranges, and invalid strings.
 */
export function formatDateVN(dateInput?: string | Date | null): string {
  if (!dateInput) return "";
  const str = String(dateInput).trim();
  if (!str) return "";
  
  const lower = str.toLowerCase();
  if (lower === "chưa xác minh" || lower === "chua xac minh" || lower === "n/a" || lower === "unknown") {
    return "";
  }

  // If it's already a date range like "03/12/2026 - 04/12/2026" or "15/07/2026 - 20/07/2026"
  if (/^\d{1,2}\/\d{1,2}\/\d{4}\s*-\s*\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    return str;
  }

  // If it's already in dd/mm/yyyy format
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    return str;
  }

  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) {
    // If not a parseable date, check if it has valid text (not NaN or Invalid Date)
    if (str.includes("NaN") || str.toLowerCase().includes("invalid")) {
      return "";
    }
    return str;
  }

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Convert dd/mm/yyyy or yyyy-mm-dd to standard yyyy-mm-dd for input[type="date"]
 */
export function toInputDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
}

/**
 * Safely parse date from various formats (ISO string, YYYY-MM-DD, DD/MM/YYYY, Date object)
 */
export function parseDateSafe(dateInput?: string | Date | null): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  const str = String(dateInput).trim();
  if (!str) return null;
  const lower = str.toLowerCase();
  if (
    lower === "chưa xác minh" ||
    lower === "chua xac minh" ||
    lower === "n/a" ||
    lower === "unknown"
  ) {
    return null;
  }

  // If dd/mm/yyyy
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return isNaN(date.getTime()) ? null : date;
  }

  // Try standard Date parsing (ISO 8601, YYYY-MM-DD)
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d;
  }

  return null;
}

export interface OpportunityDeadlineInfo {
  nearestDeadlineType: "abstract" | "fullPaper" | "registration" | "none";
  nearestDeadlineLabel: string;
  nearestDateFormatted: string;
  diffDays: number | null;
  countdownText: string;
  statusBadge: {
    text: string;
    variant: "urgent" | "warning" | "success" | "expired" | "new" | "neutral";
    bg: string;
    color: string;
    border: string;
  };
  isUrgent: boolean;
  isWarning: boolean;
  isExpired: boolean;
}

/**
 * Calculates priority countdown and deadline status for an opportunity.
 * Priority order:
 * 1. Hạn nộp tóm tắt (abstractDeadline)
 * 2. Hạn nộp toàn văn (fullPaperDeadline || deadline)
 * 3. Hạn đăng ký (registrationDeadline)
 * Thresholds:
 * - <= 7 days: Đỏ nổi bật (SẮP HẾT HẠN)
 * - <= 14 days: Vàng / Cam (CÒN X NGÀY)
 * - > 14 days: Xanh lá (CÒN X NGÀY)
 * - Đã qua: Xám (HẾT HẠN)
 */
export function getOpportunityDeadlineInfo(opp: {
  abstractDeadline?: string | null;
  fullPaperDeadline?: string | null;
  deadline?: string | null;
  registrationDeadline?: string | null;
  createdAt?: string | null;
  discoveredAt?: string | null;
}): OpportunityDeadlineInfo {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  interface Milestone {
    type: "abstract" | "fullPaper" | "registration";
    label: string;
    dateObj: Date;
    formatted: string;
    diffDays: number;
  }

  const milestones: Milestone[] = [];

  // 1. Abstract deadline
  if (opp.abstractDeadline) {
    const d = parseDateSafe(opp.abstractDeadline);
    if (d) {
      d.setHours(0, 0, 0, 0);
      milestones.push({
        type: "abstract",
        label: "Hạn nộp tóm tắt",
        dateObj: d,
        formatted: formatDateVN(d),
        diffDays: Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      });
    }
  }

  // 2. Full paper deadline (or general deadline)
  const fullPaperRaw = opp.fullPaperDeadline || opp.deadline;
  if (fullPaperRaw) {
    const d = parseDateSafe(fullPaperRaw);
    if (d) {
      d.setHours(0, 0, 0, 0);
      milestones.push({
        type: "fullPaper",
        label: "Hạn nộp toàn văn",
        dateObj: d,
        formatted: formatDateVN(d),
        diffDays: Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      });
    }
  }

  // 3. Registration deadline
  if (opp.registrationDeadline) {
    const d = parseDateSafe(opp.registrationDeadline);
    if (d) {
      d.setHours(0, 0, 0, 0);
      milestones.push({
        type: "registration",
        label: "Hạn đăng ký",
        dateObj: d,
        formatted: formatDateVN(d),
        diffDays: Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      });
    }
  }

  // If no milestones at all
  if (milestones.length === 0) {
    return {
      nearestDeadlineType: "none",
      nearestDeadlineLabel: "Hạn nộp",
      nearestDateFormatted: "",
      diffDays: null,
      countdownText: "Chưa công bố",
      statusBadge: {
        text: "CHƯA CÔNG BỐ",
        variant: "neutral",
        bg: "#f1f5f9",
        color: "#64748b",
        border: "#e2e8f0",
      },
      isUrgent: false,
      isWarning: false,
      isExpired: false,
    };
  }

  // Find upcoming milestones (diffDays >= 0)
  const upcoming = milestones.filter((m) => m.diffDays >= 0);

  // Check if created recently (<= 7 days ago)
  const creationStr = opp.createdAt || opp.discoveredAt;
  let isCreatedRecently = false;
  if (creationStr) {
    const createdDate = parseDateSafe(creationStr);
    if (createdDate) {
      const daysSinceCreated = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreated <= 7) {
        isCreatedRecently = true;
      }
    }
  }

  if (upcoming.length > 0) {
    // Pick the earliest upcoming deadline
    upcoming.sort((a, b) => a.diffDays - b.diffDays);
    const nearest = upcoming[0];
    const diff = nearest.diffDays;

    if (diff === 0) {
      return {
        nearestDeadlineType: nearest.type,
        nearestDeadlineLabel: nearest.label,
        nearestDateFormatted: nearest.formatted,
        diffDays: 0,
        countdownText: "Hôm nay hết hạn",
        statusBadge: {
          text: "HÔM NAY HẾT HẠN",
          variant: "urgent",
          bg: "#fef2f2",
          color: "#b91c1c",
          border: "#fca5a5",
        },
        isUrgent: true,
        isWarning: false,
        isExpired: false,
      };
    }

    if (diff <= 7) {
      return {
        nearestDeadlineType: nearest.type,
        nearestDeadlineLabel: nearest.label,
        nearestDateFormatted: nearest.formatted,
        diffDays: diff,
        countdownText: `Còn ${diff} ngày`,
        statusBadge: {
          text: `SẮP HẾT HẠN (${diff} ngày)`,
          variant: "urgent",
          bg: "#fef2f2",
          color: "#b91c1c",
          border: "#fca5a5",
        },
        isUrgent: true,
        isWarning: false,
        isExpired: false,
      };
    }

    if (diff <= 14) {
      return {
        nearestDeadlineType: nearest.type,
        nearestDeadlineLabel: nearest.label,
        nearestDateFormatted: nearest.formatted,
        diffDays: diff,
        countdownText: `Còn ${diff} ngày`,
        statusBadge: {
          text: `CÒN ${diff} NGÀY`,
          variant: "warning",
          bg: "#fffbeb",
          color: "#b45309",
          border: "#fde68a",
        },
        isUrgent: false,
        isWarning: true,
        isExpired: false,
      };
    }

    // > 14 days
    const badgeText = isCreatedRecently ? `MỚI · Còn ${diff} ngày` : `CÒN ${diff} NGÀY`;
    return {
      nearestDeadlineType: nearest.type,
      nearestDeadlineLabel: nearest.label,
      nearestDateFormatted: nearest.formatted,
      diffDays: diff,
      countdownText: `Còn ${diff} ngày`,
      statusBadge: {
        text: badgeText,
        variant: isCreatedRecently ? "new" : "success",
        bg: isCreatedRecently ? "#eff6ff" : "#f0fdf4",
        color: isCreatedRecently ? "#1d4ed8" : "#166534",
        border: isCreatedRecently ? "#bfdbfe" : "#bbf7d0",
      },
      isUrgent: false,
      isWarning: false,
      isExpired: false,
    };
  }

  // If all milestones passed (diffDays < 0)
  milestones.sort((a, b) => b.diffDays - a.diffDays);
  const lastPassed = milestones[0];
  return {
    nearestDeadlineType: lastPassed.type,
    nearestDeadlineLabel: lastPassed.label,
    nearestDateFormatted: lastPassed.formatted,
    diffDays: lastPassed.diffDays,
    countdownText: "Hết hạn",
    statusBadge: {
      text: "HẾT HẠN",
      variant: "expired",
      bg: "#f1f5f9",
      color: "#64748b",
      border: "#e2e8f0",
    },
    isUrgent: false,
    isWarning: false,
    isExpired: true,
  };
}

/**
 * Determine deadline badge (legacy wrapper for backward compatibility)
 */
export function getDeadlineBadge(
  deadlineStr?: string | null,
  createdAtStr?: string | null
): { text: string; variant: "new" | "warning" | "success" | "neutral" | "urgent" } {
  const info = getOpportunityDeadlineInfo({
    deadline: deadlineStr,
    createdAt: createdAtStr,
  });

  const variantMap: Record<string, "new" | "warning" | "success" | "neutral" | "urgent"> = {
    urgent: "urgent",
    warning: "warning",
    success: "success",
    new: "new",
    expired: "neutral",
    neutral: "neutral",
  };

  return {
    text: info.statusBadge.text,
    variant: variantMap[info.statusBadge.variant] || "neutral",
  };
}

