/**
 * Format ISO date string or Date object to dd/mm/yyyy
 */
export function formatDateVN(dateInput?: string | Date | null): string {
  if (!dateInput) return "";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) {
    // If it's already in dd/mm/yyyy format
    if (typeof dateInput === "string" && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateInput)) {
      return dateInput;
    }
    return String(dateInput);
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
 * Determine deadline badge: MỚI, SẮP HẾT HẠN, CÒN HẠN, HẾT HẠN
 */
export function getDeadlineBadge(
  deadlineStr?: string | null,
  createdAtStr?: string | null
): { text: string; variant: "new" | "warning" | "success" | "neutral" } {
  if (!deadlineStr) return { text: "CÒN HẠN", variant: "neutral" };

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let deadline = new Date(deadlineStr);
  if (isNaN(deadline.getTime())) {
    const match = deadlineStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      deadline = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    }
  }

  if (isNaN(deadline.getTime())) {
    return { text: "CÒN HẠN", variant: "neutral" };
  }

  const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: "HẾT HẠN", variant: "neutral" };
  }

  // Check if created in past 7 days -> MỚI
  if (createdAtStr) {
    const created = new Date(createdAtStr);
    if (!isNaN(created.getTime())) {
      const createdDaysAgo = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      if (createdDaysAgo <= 7 && diffDays > 7) {
        return { text: "MỚI", variant: "new" };
      }
    }
  }

  if (diffDays <= 7) {
    return { text: `SẮP HẾT HẠN (${diffDays} ngày)`, variant: "warning" };
  }

  return { text: "CÒN HẠN", variant: "success" };
}
