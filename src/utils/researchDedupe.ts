import { normalizeText } from "./dedupe";
import { parseDateSafe } from "./date";
import type { RawFacultyResearchRow } from "../services/facultyResearchData";

/**
 * Normalizes URL by removing protocol variations, trailing slashes, and common query trackers.
 */
export function normalizeCanonicalUrl(url?: string | null): string {
  if (!url) return "";
  let clean = url.trim().toLowerCase();
  clean = clean.replace(/^(?:https?:\/\/|mailto:)/, "");
  clean = clean.replace(/^www\./, "");
  clean = clean.replace(/[?#].*$/, "");
  clean = clean.replace(/\/+$/, "");
  return clean;
}

/**
 * Extracts 4-digit conference year from text, dates, or titles (e.g., 2026, 2027, '27).
 */
export function extractConferenceYear(text?: string | null): string {
  if (!text) return "";
  // Look for 4-digit year 2024-2035
  const match4 = text.match(/\b(202[4-9]|203[0-5])\b/);
  if (match4) return match4[1];

  // Look for 2-digit apostrophe year like '26, '27
  const match2 = text.match(/['’](\d{2})\b/);
  if (match2) {
    const yr = Number(match2[1]);
    if (yr >= 24 && yr <= 35) {
      return `20${yr}`;
    }
  }
  return "";
}

export interface ResearchMatchTarget {
  id: string;
  title: string;
  sourceUrl?: string;
  submissionUrl?: string;
  organizer?: string;
  deadline?: string;
  eventDate?: string;
  fullPaperDeadline?: string;
  editedByAdmin?: boolean;
  manualOverrides?: string[];
  updatedBy?: string;
  status?: string;
  candidateId?: string;
  publishedOpportunityId?: string;
  [key: string]: any;
}

export interface ResearchMatchResult {
  isMatch: boolean;
  matchedId?: string;
  target?: ResearchMatchTarget;
  matchType?: "id_match" | "source_url" | "submission_url" | "exact_title_year" | "organizer_title_year";
  reason?: string;
}

/**
 * Finds matching candidate or published opportunity using multi-level matching rules.
 * Strictly prevents incorrect merging across different conference years (e.g., 2026 vs 2027).
 */
export function findMatchingResearchOpportunity(
  row: RawFacultyResearchRow,
  existingList: ResearchMatchTarget[]
): ResearchMatchResult {
  const normTitle = normalizeText(row.title);
  const rowYear =
    extractConferenceYear(row.title) ||
    extractConferenceYear(row.eventDate) ||
    extractConferenceYear(row.fullPaperDeadline);

  const rowSourceUrl = normalizeCanonicalUrl(row.sourceUrl);
  const rowSubUrl = normalizeCanonicalUrl(row.submissionUrl);
  const rowOrg = normalizeText(row.organizer);

  const rowId = (row as any).id;

  for (const existing of existingList) {
    // Rule 0a: Match by conferenceCode (e.g. TN0001, QT0001) or known historical records
    const rowCode = (row as any).conferenceCode || (row as any).code;
    const exCode = existing.conferenceCode || existing.code;
    if (rowCode && exCode && String(rowCode).trim().toUpperCase() === String(exCode).trim().toUpperCase()) {
      return {
        isMatch: true,
        matchedId: existing.id,
        target: existing,
        matchType: "code_match" as any,
        reason: `Khớp chính xác mã hội thảo (${rowCode})`,
      };
    }

    // Direct mapping for historical published record QT0003 -> opp_global_south_2026
    if (
      String(rowCode || "").toUpperCase() === "QT0003" &&
      (existing.id === "opp_global_south_2026" || existing.candidateId === "spark_opp_20261006-01_6")
    ) {
      return {
        isMatch: true,
        matchedId: existing.id,
        target: existing,
        matchType: "code_match" as any,
        reason: `Khớp mã hội thảo QT0003 với hội thảo đã công bố (${existing.id})`,
      };
    }

    // Rule 0b: Match by explicit Document ID, candidateId, or publishedOpportunityId
    if (rowId) {
      if (
        existing.id === rowId ||
        existing.candidateId === rowId ||
        existing.publishedOpportunityId === rowId
      ) {
        return {
          isMatch: true,
          matchedId: existing.id,
          target: existing,
          matchType: "id_match",
          reason: `Khớp theo mã định danh (${existing.id})`,
        };
      }
    }

    const exTitle = normalizeText(existing.title);
    const exYear =
      extractConferenceYear(existing.title) ||
      extractConferenceYear(existing.eventDate) ||
      extractConferenceYear(existing.fullPaperDeadline);

    // Rule 1: Canonical sourceUrl match (if valid and not homepage)
    const exSourceUrl = normalizeCanonicalUrl(existing.sourceUrl);
    if (
      rowSourceUrl &&
      exSourceUrl &&
      rowSourceUrl === exSourceUrl &&
      rowSourceUrl.length > 8 &&
      !isGenericPortalUrl(rowSourceUrl)
    ) {
      // If both have explicit different years in title, do not merge!
      if (rowYear && exYear && rowYear !== exYear) {
        continue;
      }
      return {
        isMatch: true,
        matchedId: existing.id,
        target: existing,
        matchType: "source_url",
        reason: `Khớp link nguồn chính thức (${rowSourceUrl})`,
      };
    }

    // Rule 2: Web portal submissionUrl match (if not email or generic link)
    const exSubUrl = normalizeCanonicalUrl(existing.submissionUrl);
    if (
      rowSubUrl &&
      exSubUrl &&
      rowSubUrl === exSubUrl &&
      rowSubUrl.length > 12 &&
      !rowSubUrl.includes("@") &&
      !isGenericPortalUrl(rowSubUrl)
    ) {
      if (rowYear && exYear && rowYear !== exYear) {
        continue;
      }
      return {
        isMatch: true,
        matchedId: existing.id,
        target: existing,
        matchType: "submission_url",
        reason: `Khớp link nộp bài / đăng ký (${rowSubUrl})`,
      };
    }

    // Rule 3: Exact title match + Same Year Check
    if (normTitle && exTitle && normTitle === exTitle) {
      // If years differ, do not merge
      if (rowYear && exYear && rowYear !== exYear) {
        continue;
      }
      return {
        isMatch: true,
        matchedId: existing.id,
        target: existing,
        matchType: "exact_title_year",
        reason: `Khớp chính xác tiêu đề "${existing.title}"`,
      };
    }

    // Rule 4: Same Organizer + Substantial title overlap + Same Year
    const exOrg = normalizeText(existing.organizer);
    if (rowOrg && exOrg && rowOrg === exOrg) {
      const titlesOverlap =
        (normTitle.length > 15 && exTitle.includes(normTitle)) ||
        (exTitle.length > 15 && normTitle.includes(exTitle));

      if (titlesOverlap) {
        // Enforce same year to distinguish annual occurrences
        if (rowYear && exYear && rowYear !== exYear) {
          continue;
        }
        return {
          isMatch: true,
          matchedId: existing.id,
          target: existing,
          matchType: "organizer_title_year",
          reason: `Cùng đơn vị tổ chức và trùng phần lớn tiêu đề`,
        };
      }
    }
  }

  return { isMatch: false };
}

function isGenericPortalUrl(url: string): boolean {
  return [
    "neu.edu.vn",
    "ueh.edu.vn",
    "tdtu.edu.vn",
    "vnu.edu.vn",
    "docs.google.com",
    "drive.google.com",
  ].some((domain) => url === domain || url.startsWith(`${domain}/`));
}

/**
 * Checks if a target record has been manually edited by an Admin.
 */
export function isEditedByAdmin(record: ResearchMatchTarget): boolean {
  if (record.editedByAdmin === true) return true;
  if (Array.isArray(record.manualOverrides) && record.manualOverrides.length > 0) return true;
  
  // If updatedBy is a real administrator email
  const updatedBy = String(record.updatedBy || record.reviewedBy || "").toLowerCase();
  if (
    updatedBy &&
    !updatedBy.includes("spark") &&
    !updatedBy.includes("bot") &&
    !updatedBy.includes("github-actions") &&
    !updatedBy.includes("system")
  ) {
    // If the record was reviewed or updated manually
    if (record.status === "approved" || record.status === "rejected" || record.status === "published") {
      return true;
    }
  }
  return false;
}

export const FIELD_LABELS_VN: Record<string, string> = {
  deadline: "Hạn nộp",
  fullPaperDeadline: "Hạn nộp toàn văn",
  abstractDeadline: "Hạn nộp tóm tắt",
  registrationDeadline: "Hạn đăng ký",
  eventDate: "Ngày tổ chức",
  location: "Địa điểm",
  fee: "Phí",
  publicationFee: "Phí xuất bản",
  registrationFee: "Phí tham dự",
  feeStatus: "Trạng thái phí",
  publicationFormat: "Hình thức xuất bản",
  indexing: "Chỉ mục (Indexing)",
  content: "Tóm tắt / Nội dung",
  directions: "Gợi ý viết bài",
  suitability: "Độ phù hợp",
  notes: "Ghi chú",
  sourceUrl: "Link nguồn chính thức",
  submissionUrl: "Link nộp bài",
  sheetStatus: "Trạng thái Sheet",
};

export interface OpportunityDiffField {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
}

/**
 * Normalizes date to canonical YYYY-MM-DD or canonical range for stable diff comparison.
 */
export function normalizeDateForComparison(val?: string | null): string {
  if (!val) return "";
  let str = String(val).trim();
  if (!str) return "";

  // Replace non-breaking spaces and collapse whitespace
  str = str.replace(/\u00A0/g, " ").replace(/\s+/g, " ");

  // Handle date range (e.g. "20/03/2027 - 21/03/2027" or "2027-03-20 - 2027-03-21")
  if (str.includes(" - ")) {
    const parts = str.split(" - ");
    if (parts.length === 2) {
      const p1 = normalizeDateForComparison(parts[0]);
      const p2 = normalizeDateForComparison(parts[1]);
      if (p1 && p2) {
        return `${p1} - ${p2}`;
      }
    }
  }

  // If ISO 8601 with T: e.g. "2026-11-15T00:00:00.000Z" or YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // If DD/MM/YYYY: e.g. "15/11/2026"
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Fallback to parseDateSafe
  const parsed = parseDateSafe(str);
  if (parsed && !isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return normalizeText(str);
}

const EQUIVALENT_EMPTY_STRINGS = new Set([
  "",
  "chua co",
  "khong ro chi phi",
  "dang cap nhat",
  "chua ro",
  "chua xac minh",
  "n/a",
  "na",
  "none",
  "null",
  "undefined",
  "unknown",
  "khong co",
]);

/**
 * Checks if a value is effectively empty or represents an unknown/unspecified placeholder.
 */
export function isEquivalentEmpty(val?: any): boolean {
  if (val === undefined || val === null) return true;
  const str = normalizeText(String(val)).trim();
  return str === "" || EQUIVALENT_EMPTY_STRINGS.has(str);
}

/**
 * Normalizes general text by stripping non-breaking spaces and collapsing whitespace.
 */
export function normalizeTextForComparison(text?: string | null): string {
  if (!text) return "";
  return String(text)
    .replace(/\u00A0/g, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strips transient countdown phrasing from notes (e.g. "Còn 24 ngày", "(tính từ 06/10/2026)", "HẠN NỘP GẤP:", "(còn 131 ngày)").
 */
export function stripTransientCountdownNotes(note?: string | null): string {
  if (!note) return "";
  let clean = normalizeTextForComparison(note);
  clean = clean.replace(/\(tính từ \d{1,2}\/\d{1,2}\/\d{4}\)/gi, "");
  clean = clean.replace(/\(tính từ \d{4}-\d{2}-\d{2}\)/gi, "");
  clean = clean.replace(/\b(?:sắp hết hạn|hạn nộp rất gấp|hạn nộp gấp):?/gi, "");
  clean = clean.replace(/\(?\b(?:chỉ\s+)?còn\s+\d+\s+ngày(?:\s+đến\s+hạn[^)]*)?\)?/gi, "");
  clean = clean.replace(/\(?\bhạn\s+nộp\s+còn\s+\d+\s+ngày\)?/gi, "");
  clean = clean.replace(/\(?\bhạn\s+nộp\s+\d{1,2}\/\d{1,2}\/\d{4}\s*\(còn\s+\d+\s+ngày\)\)?/gi, "");
  clean = clean.replace(/\(còn\s+\d+\s+ngày\)/gi, "");
  clean = clean.replace(/[;,.\s]+$/, "").replace(/^[;,.\s]+/, "");
  return normalizeTextForComparison(clean);
}

/**
 * Normalizes location strings by collapsing hybrid variations (e.g. "Hybrid" vs "Trực tiếp kết hợp trực tuyến").
 */
export function normalizeLocationForComparison(loc?: string | null): string {
  if (!loc) return "";
  let clean = normalizeText(String(loc)).toLowerCase();
  clean = clean.replace(/\b(?:hybrid|truc tiep ket hop truc tuyen|ket hop truc tuyen)\b/g, "hybrid");
  clean = clean.replace(/[\/|,;-]\s*hybrid/g, " hybrid");
  clean = clean.replace(/\s+/g, " ").trim();
  return clean;
}

/**
 * Evaluates whether a detected difference between Google Sheet row and existing record
 * represents a substantive, actionable change worthy of creating an update proposal.
 */
export function isMeaningfulFieldChange(
  key: string,
  newVal: any,
  exVal: any,
  manualOverrides: Set<string>
): boolean {
  if (manualOverrides.has(key)) return false;

  // Ignore transient or non-substantive attributes from sheet
  if (
    key === "sheetStatus" ||
    key === "statusText" ||
    key === "stt" ||
    key === "runId" ||
    key === "discoveredAt"
  ) {
    return false;
  }

  // If new value is undefined or null, do not propose overwriting existing valid data
  if (newVal === undefined || newVal === null) return false;

  // Both equivalent empty (e.g. "" vs "Không rõ chi phí" vs undefined)
  if (isEquivalentEmpty(newVal) && isEquivalentEmpty(exVal)) {
    return false;
  }

  // If new value is empty string, don't wipe out existing meaningful record
  if (typeof newVal === "string" && !newVal.trim() && exVal) {
    return false;
  }

  // Date comparison (normalizes ISO vs DD/MM/YYYY vs YYYY-MM-DD vs date ranges)
  if (
    key === "deadline" ||
    key === "fullPaperDeadline" ||
    key === "abstractDeadline" ||
    key === "registrationDeadline" ||
    key === "eventDate"
  ) {
    const normNew = normalizeDateForComparison(newVal);
    const normEx = normalizeDateForComparison(exVal);
    if (!normNew && !normEx) return false;
    return normNew !== normEx;
  }

  // URL comparison (normalizes protocol, www, trailing slashes, tracking queries)
  if (key === "sourceUrl" || key === "submissionUrl" || key === "feeSourceUrl") {
    const canonNew = normalizeCanonicalUrl(newVal);
    const canonEx = normalizeCanonicalUrl(exVal);
    if (!canonNew && !canonEx) return false;
    return canonNew !== canonEx;
  }

  // Notes comparison (strip dynamic countdown phrases)
  if (key === "notes") {
    const normNew = stripTransientCountdownNotes(newVal);
    const normEx = stripTransientCountdownNotes(exVal);
    if (!normNew && !normEx) return false;
    return normNew !== normEx;
  }

  // Location comparison (normalizes hybrid phrasing variations)
  if (key === "location") {
    const locNew = normalizeLocationForComparison(newVal);
    const locEx = normalizeLocationForComparison(exVal);
    if (!locNew && !locEx) return false;
    return locNew !== locEx;
  }

  // Fee status comparison
  if (key === "feeStatus") {
    const sNew = String(newVal || "").toUpperCase().trim();
    const sEx = String(exVal || "").toUpperCase().trim();
    if ((sNew === "UNKNOWN" || !sNew) && (sEx === "UNKNOWN" || !sEx)) return false;
    return sNew !== sEx;
  }

  // General text fields (location, content, directions, suitability, publicationFormat, indexing, etc.)
  const normNew = normalizeTextForComparison(newVal);
  const normEx = normalizeTextForComparison(exVal);
  return normNew !== normEx;
}

/**
 * Compares incoming row from Google Sheets with existing Firestore record to detect meaningful changes.
 * Strictly respects Admin manualOverrides.
 */
export function computeOpportunityDiff(
  existing: ResearchMatchTarget,
  row: RawFacultyResearchRow
): {
  hasChanges: boolean;
  changedKeys: string[];
  updates: Record<string, any>;
  diffSummary: OpportunityDiffField[];
} {
  const updates: Record<string, any> = {};
  const changedKeys: string[] = [];
  const diffSummary: OpportunityDiffField[] = [];
  const manualOverrides = new Set<string>(existing.manualOverrides || []);

  const compareField = (key: string, newVal: any, exVal: any) => {
    if (isMeaningfulFieldChange(key, newVal, exVal, manualOverrides)) {
      updates[key] = newVal;
      changedKeys.push(key);
      diffSummary.push({
        field: key,
        label: FIELD_LABELS_VN[key] || key,
        oldValue: exVal ?? "",
        newValue: newVal,
      });
    }
  };

  const rowDeadline =
    row.fullPaperDeadline || row.abstractDeadline || row.registrationDeadline || row.deadline;
  compareField("deadline", rowDeadline, existing.deadline);
  compareField("fullPaperDeadline", row.fullPaperDeadline, existing.fullPaperDeadline);
  compareField("abstractDeadline", row.abstractDeadline, existing.abstractDeadline);
  compareField("registrationDeadline", row.registrationDeadline, existing.registrationDeadline);
  compareField("eventDate", row.eventDate, existing.eventDate);
  compareField("location", row.location, existing.location);
  compareField("fee", row.fee, existing.fee);
  compareField("publicationFee", row.publicationFee, existing.publicationFee);
  compareField("registrationFee", row.registrationFee, existing.registrationFee);
  compareField("feeStatus", row.feeStatus, existing.feeStatus);
  compareField("publicationFormat", row.publicationFormat, existing.publicationFormat);
  compareField("indexing", row.indexing, existing.indexing);
  compareField("content", row.content, existing.content);
  compareField("directions", row.directions, existing.directions);
  compareField("suitability", row.suitability, existing.suitability);
  compareField("notes", row.notes, existing.notes);
  compareField("sourceUrl", row.sourceUrl, existing.sourceUrl);
  compareField("submissionUrl", row.submissionUrl, existing.submissionUrl);

  return {
    hasChanges: changedKeys.length > 0,
    changedKeys,
    updates,
    diffSummary,
  };
}

export interface OutOfScopeClassification {
  isOutOfScope: boolean;
  reason?: string;
  classifiedType?: string;
}

/**
 * Classifies legacy or foreign conference records that fall outside the domestic conference scope.
 * Preserves history and classifies JOISA as a Call for Papers / Special Issue invitation.
 */
export function classifyOutOfScopeRecord(record: {
  title?: string;
  country?: string;
  type?: string;
  category?: "TN" | "QT" | string;
  isOutOfScope?: boolean;
  outOfScopeReason?: string;
  status?: string;
  conferenceCode?: string;
  [key: string]: any;
}): OutOfScopeClassification {
  // Giai đoạn C: Hội thảo đã duyệt / đã công bố hoặc thuộc nhóm QT hoặc TN chính thức luôn là hợp lệ (in-scope)
  if (record.status === "approved" || record.status === "published") {
    return { isOutOfScope: false };
  }

  const rowCategory = record.category || (record as any).category;
  const rowCode = String(record.conferenceCode || (record as any).code || "").toUpperCase();
  if (rowCategory === "QT" || rowCategory === "TN" || rowCode.startsWith("QT") || rowCode.startsWith("TN")) {
    return { isOutOfScope: false };
  }

  if (record.isOutOfScope === true) {
    return {
      isOutOfScope: true,
      reason: record.outOfScopeReason || "Ngoài phạm vi hội thảo trong nước",
      classifiedType: record.type,
    };
  }

  const rawTitle = String(record.title || (record as any).name || "");
  const normTitle = normalizeText(rawTitle);

  // 1. JOISA - Journal CFP / Special Issue invitation (thư mời viết bài tạp chí)
  if (normTitle.includes("joisa")) {
    return {
      isOutOfScope: true,
      reason: "Thư mời viết bài đặc san tạp chí (Call for Papers / Special Issue), không phải hội thảo",
      classifiedType: "Call for Papers",
    };
  }

  // 2. Specific foreign conferences
  if (
    normTitle.includes("haxd") ||
    normTitle.includes("evomusart") ||
    normTitle.includes("shaping the future of the global south")
  ) {
    return {
      isOutOfScope: true,
      reason: "Hội thảo quốc tế tổ chức tại nước ngoài (thuộc tab HOI THAO QT)",
      classifiedType: record.type || "Hội thảo",
    };
  }

  // 3. Country explicitly outside Vietnam
  const c = normalizeText(String(record.country || ""));
  if (c && c !== "viet nam" && c !== "vietnam" && c !== "vn") {
    return {
      isOutOfScope: true,
      reason: `Hội thảo quốc tế tổ chức tại ${record.country} (ngoài lãnh thổ Việt Nam)`,
      classifiedType: record.type || "Hội thảo",
    };
  }

  return { isOutOfScope: false };
}
