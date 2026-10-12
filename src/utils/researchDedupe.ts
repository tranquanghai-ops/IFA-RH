import { normalizeText } from "./dedupe";
import type { RawFacultyResearchRow } from "../services/facultyResearchData";

/**
 * Normalizes URL by removing protocol variations, trailing slashes, and common query trackers.
 */
export function normalizeCanonicalUrl(url?: string | null): string {
  if (!url) return "";
  let clean = url.trim().toLowerCase();
  clean = clean.replace(/^https?:\/\//, "");
  clean = clean.replace(/^www\./, "");
  clean = clean.replace(/[?#].*$/, "");
  clean = clean.replace(/\/+$/, "");
  return clean;
}

/**
 * Extracts 4-digit conference year from text, dates, or titles (e.g., 2026, 2027).
 */
export function extractConferenceYear(text?: string | null): string {
  if (!text) return "";
  // Look for 202x or 203x
  const match = text.match(/\b(202[4-9]|203[0-5])\b/);
  return match ? match[1] : "";
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
  [key: string]: any;
}

export interface ResearchMatchResult {
  isMatch: boolean;
  matchedId?: string;
  target?: ResearchMatchTarget;
  matchType?: "source_url" | "submission_url" | "exact_title_year" | "organizer_title_year";
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

  for (const existing of existingList) {
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

/**
 * Compares incoming row from Google Sheets with existing Firestore record to detect meaningful changes.
 */
export function computeOpportunityDiff(
  existing: ResearchMatchTarget,
  row: RawFacultyResearchRow
): {
  hasChanges: boolean;
  changedKeys: string[];
  updates: Record<string, any>;
} {
  const updates: Record<string, any> = {};
  const changedKeys: string[] = [];

  const compareField = (key: string, newVal: any, exVal: any) => {
    if (newVal === undefined || newVal === null) return;
    const strNew = String(newVal).trim();
    const strEx = String(exVal || "").trim();
    if (strNew && strNew !== strEx) {
      updates[key] = newVal;
      changedKeys.push(key);
    }
  };

  compareField("deadline", row.fullPaperDeadline || row.abstractDeadline || row.registrationDeadline, existing.deadline);
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
  compareField("sheetStatus", row.statusText, existing.sheetStatus);

  return {
    hasChanges: changedKeys.length > 0,
    changedKeys,
    updates,
  };
}
