import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { firestore } from "../firebase/config";
import type {
  Journal,
  JournalCandidate,
  JournalCouncilScore,
  JournalStatus,
  JournalImportResult,
} from "../types/journal";
import {
  EXTENDED_COUNCIL_NAMES,
  normalizeCouncilIdentity,
  buildCouncilScoreCompositeKey,
} from "./journalGoogleSheetService";

export const DEFAULT_SELECTED_COUNCIL_ID = "HD24";
const DEFAULT_COUNCIL_ID = "HD24";
const DEFAULT_COUNCIL_NAME = "Văn hóa – Nghệ thuật – Thể dục thể thao (HD24)";

/**
 * Remove undefined values so Firestore does not reject writes.
 */
function cleanUndefined<T = any>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanUndefined(item)) as unknown as T;
  }
  const result: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      result[k] =
        typeof v === "object" && v !== null && !(v instanceof Date)
          ? cleanUndefined(v)
          : v;
    }
  }
  return result as T;
}

/**
 * Kiểm tra mã định danh (ISSN / E-ISSN / ISBN) có giá trị hợp lệ để hiển thị không.
 * Ẩn các trường rỗng hoặc chứa "Không công bố", "Chưa có", "N/A", "—", "---".
 */
export function isValidDisplayIdentifier(val?: string | null): boolean {
  if (!val) return false;
  const clean = String(val).trim();
  if (!clean) return false;
  if (/^[-—–_\s]+$/.test(clean)) return false;
  const lower = clean.toLowerCase();
  const invalidTokens = [
    "—",
    "-",
    "n/a",
    "na",
    "none",
    "null",
    "undefined",
    "không công bố",
    "khong cong bo",
    "chưa công bố",
    "chua cong bo",
    "chưa có",
    "chua co",
    "chưa rõ",
    "chua ro",
    "không có",
    "khong co",
  ];
  if (invalidTokens.includes(lower)) return false;
  if (
    lower.startsWith("không công bố") ||
    lower.startsWith("chưa công bố") ||
    lower.startsWith("chưa có") ||
    lower.startsWith("chưa rõ")
  ) {
    return false;
  }
  return true;
}

/**
 * Định dạng điểm số theo chuẩn hiển thị tiếng Việt (vd: 1,00 | 0,75 | 0,50 | 0,25 | 0,00).
 */
export function formatVietnameseScore(score: number | null | undefined): string {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return "—";
  }
  return score.toFixed(2).replace(".", ",");
}

export interface ScoreBadgePalette {
  tier: "score_100" | "score_075" | "score_050" | "score_025" | "unverified";
  bg: string;
  text: string;
  border: string;
  backgroundColor: string;
  color: string;
  borderColor: string;
  dotColor: string;
  formattedScore: string;
  tierLabel: string;
}

/**
 * Hệ màu mức điểm HĐGSNN theo Mục X:
 * - 1,00: đỏ đậm
 * - 0,75: đỏ nhạt
 * - 0,50: cam
 * - 0,25: vàng đậm
 * - Chưa có điểm xác minh / 0 / null: xám trung tính
 */
export function getScoreBadgePalette(
  score: number | null | undefined,
  isVerified: boolean = true
): ScoreBadgePalette {
  if (!isVerified || score === null || score === undefined || !Number.isFinite(score) || score <= 0) {
    return {
      tier: "unverified",
      bg: "#f1f5f9",
      text: "#475569",
      border: "#cbd5e1",
      backgroundColor: "#f1f5f9",
      color: "#475569",
      borderColor: "#cbd5e1",
      dotColor: "#94a3b8",
      formattedScore: score === 0 ? "0,00" : "—",
      tierLabel:
        score === 0
          ? "0,00 (Dừng tính điểm)"
          : "Chưa có mức điểm được xác minh tại Hội đồng này",
    };
  }

  if (score >= 1.0) {
    return {
      tier: "score_100",
      bg: "#991b1b",
      text: "#ffffff",
      border: "#7f1d1d",
      backgroundColor: "#991b1b",
      color: "#ffffff",
      borderColor: "#7f1d1d",
      dotColor: "#fecaca",
      formattedScore: formatVietnameseScore(score),
      tierLabel: `${formatVietnameseScore(score)} điểm`,
    };
  }

  if (score >= 0.75) {
    return {
      tier: "score_075",
      bg: "#fee2e2",
      text: "#b91c1c",
      border: "#fca5a5",
      backgroundColor: "#fee2e2",
      color: "#b91c1c",
      borderColor: "#fca5a5",
      dotColor: "#dc2626",
      formattedScore: formatVietnameseScore(score),
      tierLabel: `${formatVietnameseScore(score)} điểm`,
    };
  }

  if (score >= 0.5) {
    return {
      tier: "score_050",
      bg: "#ffedd5",
      text: "#c2410c",
      border: "#fdba74",
      backgroundColor: "#ffedd5",
      color: "#c2410c",
      borderColor: "#fdba74",
      dotColor: "#ea580c",
      formattedScore: formatVietnameseScore(score),
      tierLabel: `${formatVietnameseScore(score)} điểm`,
    };
  }

  return {
    tier: "score_025",
    bg: "#fef3c7",
    text: "#92400e",
    border: "#f59e0b",
    backgroundColor: "#fef3c7",
    color: "#92400e",
    borderColor: "#f59e0b",
    dotColor: "#d97706",
    formattedScore: formatVietnameseScore(score),
    tierLabel: `${formatVietnameseScore(score)} điểm`,
  };
}

/**
 * Lấy danh sách bản ghi điểm theo Hội đồng Giáo sư đã chuẩn hóa từ một Journal hoặc JournalCandidate.
 * Hỗ trợ tương thích ngược 100% với các bản ghi cũ chỉ có trường `scores` (JournalScoreItem[]).
 */
export function getEffectiveCouncilScores(
  item: Pick<Journal, "scores" | "councilScores" | "maxScore" | "maxScoreYear" | "primaryField">
): JournalCouncilScore[] {
  if (Array.isArray(item.councilScores) && item.councilScores.length > 0) {
    return item.councilScores.map((cs) => {
      const norm = normalizeCouncilIdentity(cs.councilId, cs.councilName || cs.rawCouncilName);
      const normalizedItem: JournalCouncilScore = {
        ...cs,
        councilId: norm.councilId,
        councilName: norm.councilName,
        rawCouncilName: cs.rawCouncilName || cs.councilName,
        decisionNumber: cs.decisionNumber || "26/QĐ-HĐGSNN",
        decisionYear: Number(cs.decisionYear) || item.maxScoreYear || 2025,
        verificationStatus: cs.verificationStatus || "VERIFIED",
      };
      if (!normalizedItem.id) {
        normalizedItem.id = buildCouncilScoreCompositeKey(normalizedItem);
      }
      return normalizedItem;
    });
  }

  if (Array.isArray(item.scores) && item.scores.length > 0) {
    return item.scores.map((s) => {
      const norm = normalizeCouncilIdentity(s.councilCode, s.councilName);
      const maxVal =
        s.rawMaxScore !== undefined
          ? s.rawMaxScore
          : typeof s.maxScore === "number"
          ? s.maxScore
          : null;
      const cs: JournalCouncilScore = {
        id: s.id,
        councilId: norm.councilId,
        councilName: norm.councilName,
        rawCouncilName: s.councilName,
        decisionNumber: s.decisionNumber || "26/QĐ-HĐGSNN",
        decisionYear: Number(s.year) || item.maxScoreYear || 2025,
        sourceOrder: s.sourceOrder || null,
        publicationType: s.publicationType || "PRINT",
        minScore: s.minScore ?? 0,
        maxScore: maxVal,
        validFrom: s.validFrom || null,
        validTo: s.validTo || null,
        conditions: s.conditions || s.notes || null,
        sourceUrl: s.sourceUrl || null,
        sourcePage: s.sourcePage || "Phụ lục 24",
        verificationStatus: s.verificationStatus || "VERIFIED",
      };
      if (!cs.id) {
        cs.id = buildCouncilScoreCompositeKey(cs);
      }
      return cs;
    });
  }

  return [];
}

export interface CouncilScoreLookupResult {
  councilId: string;
  councilName: string;
  entries: JournalCouncilScore[];
  verifiedEntries: JournalCouncilScore[];
  primaryEntry: JournalCouncilScore | null;
  hasEntryInCouncil: boolean;
  hasRecordInCouncil: boolean;
  hasVerifiedScore: boolean;
  isVerified: boolean;
  hasStoppedScoring: boolean;
  maxScore: number | null;
  decisionYear: number;
  hasMultipleEntries: boolean;
  conditionsSummary?: string;
}

/**
 * Truy vấn mức điểm của một tạp chí tại Hội đồng Giáo sư đang chọn (mặc định HD24).
 */
export function getJournalScoreForCouncil(
  journal: Pick<Journal, "scores" | "councilScores" | "maxScore" | "maxScoreYear" | "primaryField">,
  councilId: string = DEFAULT_COUNCIL_ID,
  selectedYear?: string | number
): CouncilScoreLookupResult {
  const allScores = getEffectiveCouncilScores(journal);
  const normCouncil =
    councilId && councilId.toUpperCase() !== "ALL"
      ? normalizeCouncilIdentity(councilId, EXTENDED_COUNCIL_NAMES[councilId.toUpperCase()])
      : { councilId: "ALL", councilName: "Tất cả Hội đồng Giáo sư" };

  let matching =
    normCouncil.councilId === "ALL"
      ? allScores
      : allScores.filter((s) => s.councilId === normCouncil.councilId);

  if (
    selectedYear !== undefined &&
    selectedYear !== null &&
    String(selectedYear).toLowerCase() !== "all" &&
    String(selectedYear).trim() !== ""
  ) {
    const yNum = Number(selectedYear);
    if (Number.isFinite(yNum)) {
      matching = matching.filter((s) => s.decisionYear === yNum);
    }
  }

  const verifiedEntries = matching.filter((s) => s.verificationStatus === "VERIFIED");
  const numericVerifiedScores = verifiedEntries
    .map((s) => s.maxScore)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const hasStoppedScoring = matching.some(
    (s) =>
      s.maxScore === 0 ||
      /điểm về 0|dừng tính điểm/i.test(String(s.conditions || ""))
  );

  let maxScore: number | null = null;
  if (numericVerifiedScores.length > 0) {
    maxScore = Math.max(...numericVerifiedScores);
  } else if (hasStoppedScoring) {
    maxScore = 0;
  }

  const years = matching.map((s) => s.decisionYear).filter((y) => Number.isFinite(y));
  const decisionYear = years.length > 0 ? Math.max(...years) : journal.maxScoreYear || 2025;

  // Check if multiple distinct scores or publication types exist in this council
  const distinctScoresOrTypes = new Set(
    matching.map((s) => `${s.maxScore ?? "null"}__${s.publicationType || "PRINT"}__${s.conditions || ""}`)
  );
  const hasMultipleEntries = matching.length > 1 && distinctScoresOrTypes.size > 1;

  const condList = matching
    .map((s) => {
      const parts: string[] = [];
      if (s.publicationType === "ONLINE") parts.push("Bản điện tử");
      else if (s.publicationType === "PRINT" && matching.some((m) => m.publicationType === "ONLINE"))
        parts.push("Bản in");
      if (s.conditions) parts.push(s.conditions);
      return parts.join(": ");
    })
    .filter(Boolean);

  const hasEntryInCouncil = matching.length > 0;
  const hasVerifiedScore = maxScore !== null && maxScore > 0;
  const primaryEntry = verifiedEntries[0] || matching[0] || null;

  return {
    councilId: normCouncil.councilId,
    councilName: normCouncil.councilName,
    entries: matching,
    verifiedEntries,
    primaryEntry,
    hasEntryInCouncil,
    hasRecordInCouncil: hasEntryInCouncil,
    hasVerifiedScore,
    isVerified: hasVerifiedScore,
    hasStoppedScoring,
    maxScore,
    decisionYear,
    hasMultipleEntries,
    conditionsSummary: condList.length > 0 ? condList.join(" | ") : undefined,
  };
}

export interface CouncilOptionItem {
  councilId: string;
  councilName: string;
  journalCount: number;
}

/**
 * Tổng hợp danh sách các Hội đồng Giáo sư có trong danh mục tạp chí đã công bố.
 * Luôn đặt Hội đồng Văn hóa – Nghệ thuật – Thể dục thể thao (HD24) làm mặc định đầu tiên.
 */
export function getAvailableCouncilsFromJournals(journals: Journal[]): CouncilOptionItem[] {
  const countsMap = new Map<string, { councilName: string; journalIds: Set<string> }>();

  // Ensure default HD24 is always present
  countsMap.set(DEFAULT_COUNCIL_ID, {
    councilName: DEFAULT_COUNCIL_NAME,
    journalIds: new Set<string>(),
  });

  journals.forEach((j) => {
    const cScores = getEffectiveCouncilScores(j);
    cScores.forEach((cs) => {
      const norm = normalizeCouncilIdentity(cs.councilId, cs.councilName);
      if (!countsMap.has(norm.councilId)) {
        countsMap.set(norm.councilId, {
          councilName: norm.councilName,
          journalIds: new Set<string>(),
        });
      }
      countsMap.get(norm.councilId)!.journalIds.add(j.id || j.journalId);
    });
  });

  const list: CouncilOptionItem[] = Array.from(countsMap.entries()).map(([councilId, info]) => ({
    councilId,
    councilName: info.councilName,
    journalCount: info.journalIds.size,
  }));

  return list.sort((a, b) => {
    if (a.councilId === DEFAULT_COUNCIL_ID) return -1;
    if (b.councilId === DEFAULT_COUNCIL_ID) return 1;
    if (b.journalCount !== a.journalCount) return b.journalCount - a.journalCount;
    return a.councilName.localeCompare(b.councilName, "vi");
  });
}

/**
 * Sort journals by maxScore descending (or council-specific maxScore if councilId is provided),
 * then by Vietnamese name ascending.
 */
export function sortJournalsList(
  items: Journal[],
  sortOrCouncilId?: string,
  thirdCouncilId?: string
): Journal[] {
  const isSortMode =
    sortOrCouncilId === "score_desc" ||
    sortOrCouncilId === "name_asc" ||
    sortOrCouncilId === "year_desc";
  const effectiveCouncilId = isSortMode ? thirdCouncilId : sortOrCouncilId;
  const sortMode = isSortMode ? sortOrCouncilId : "score_desc";

  return [...items].sort((a, b) => {
    if (sortMode === "name_asc") {
      return (a.name || "").localeCompare(b.name || "", "vi");
    }
    if (
      effectiveCouncilId &&
      effectiveCouncilId.toUpperCase() !== "ALL" &&
      effectiveCouncilId !== "all"
    ) {
      const scA = getJournalScoreForCouncil(a, effectiveCouncilId).maxScore ?? -1;
      const scB = getJournalScoreForCouncil(b, effectiveCouncilId).maxScore ?? -1;
      if (scB !== scA) return scB - scA;
    }
    const scoreDiff = (b.maxScore || 0) - (a.maxScore || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (a.name || "").localeCompare(b.name || "", "vi");
  });
}

export interface JournalFilterCriteria {
  category?: "domestic" | "international" | "all";
  onlyActive?: boolean;
  searchQuery?: string;
  selectedField?: string;
  selectedScore?: string;
  selectedYear?: string;
  selectedGuidelineStatus?: string;
  selectedCouncilId?: string;
  councilFilterMode?: "has_score" | "all";
  councilScope?: "only_selected" | "has_score" | "all";
  onlySelectedCouncil?: boolean;
  onlyWithScoreInCouncil?: boolean;
}

/**
 * Pure helper to filter and sort journals according to UI search/filter criteria.
 */
export function filterJournalsList(
  journals: Journal[],
  criteria: JournalFilterCriteria
): Journal[] {
  const {
    category = "domestic",
    onlyActive = false,
    searchQuery = "",
    selectedField = "all",
    selectedScore = "all",
    selectedYear = "all",
    selectedGuidelineStatus = "all",
    selectedCouncilId,
    councilFilterMode,
    councilScope,
    onlySelectedCouncil,
    onlyWithScoreInCouncil,
  } = criteria;

  const requireCouncilScore =
    councilFilterMode === "has_score" ||
    councilScope === "only_selected" ||
    councilScope === "has_score" ||
    onlySelectedCouncil === true ||
    onlyWithScoreInCouncil === true;

  const activeCouncilId =
    selectedCouncilId && selectedCouncilId !== "all" && selectedCouncilId !== "ALL"
      ? selectedCouncilId
      : undefined;

  const filtered = journals.filter((j) => {
    if (onlyActive && j.status !== "active") return false;
    if (category !== "all" && j.category !== category) return false;

    const councilLookup = activeCouncilId
      ? getJournalScoreForCouncil(j, activeCouncilId, selectedYear)
      : null;

    if (activeCouncilId && requireCouncilScore) {
      if (!councilLookup?.hasEntryInCouncil) return false;
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = j.name?.toLowerCase().includes(q);
      const matchEng = j.englishName?.toLowerCase().includes(q);
      const matchPub = j.publisher?.toLowerCase().includes(q);
      const matchIssnP = j.issnPrint?.toLowerCase().includes(q);
      const matchIssnO = j.issnOnline?.toLowerCase().includes(q);
      const matchField =
        j.primaryField?.toLowerCase().includes(q) ||
        (j.fields || []).some((f) => f.toLowerCase().includes(q)) ||
        (j.scores || []).some((s) => s.councilName?.toLowerCase().includes(q)) ||
        (j.councilScores || []).some(
          (cs) =>
            cs.councilName?.toLowerCase().includes(q) ||
            cs.councilId?.toLowerCase().includes(q) ||
            cs.conditions?.toLowerCase().includes(q)
        );
      if (!matchName && !matchEng && !matchPub && !matchIssnP && !matchIssnO && !matchField) {
        return false;
      }
    }

    if (selectedField !== "all") {
      const inPrimary = j.primaryField === selectedField;
      const inFields = (j.fields || []).includes(selectedField);
      const inScores = (j.scores || []).some((s) => s.councilName === selectedField);
      const inCouncilScores = (j.councilScores || []).some(
        (cs) => cs.councilName === selectedField || cs.councilId === selectedField
      );
      if (!inPrimary && !inFields && !inScores && !inCouncilScores) return false;
    }

    if (selectedScore !== "all") {
      const targetScore = parseFloat(selectedScore);
      if (!isNaN(targetScore)) {
        if (councilLookup) {
          const cMax = councilLookup.maxScore;
          if (cMax === null || cMax < targetScore) return false;
        } else {
          if (j.maxScore < targetScore) return false;
        }
      }
    }

    if (selectedYear !== "all") {
      const targetYear = parseInt(selectedYear, 10);
      const hasYearInScores = (j.scores || []).some((s) => s.year === targetYear);
      const hasYearInCouncilScores = (j.councilScores || []).some(
        (cs) => cs.decisionYear === targetYear
      );
      if (j.maxScoreYear !== targetYear && !hasYearInScores && !hasYearInCouncilScores) {
        return false;
      }
    }

    if (selectedGuidelineStatus === "has_guidelines") {
      if (!j.guidelines?.hasGuidelines) return false;
    } else if (selectedGuidelineStatus === "no_guidelines") {
      if (j.guidelines?.hasGuidelines) return false;
    }

    return true;
  });

  return sortJournalsList(filtered, activeCouncilId);
}

/**
 * Subscribes to journals collection.
 * Public/lecturers receive only active journals. Admins receive all.
 */
export function subscribeJournals(
  callback: (journals: Journal[]) => void,
  options?: { includeHidden?: boolean }
) {
  const journalsRef = collection(firestore, "journals");
  const q = !options?.includeHidden
    ? query(journalsRef, where("status", "==", "active"))
    : query(journalsRef);

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Journal[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...(d.data() as any) });
      });
      callback(sortJournalsList(items));
    },
    (error) => {
      console.warn("subscribeJournals snapshot error:", error);
      // Fallback empty on permission error
      callback([]);
    }
  );
}

/**
 * Fetch all journals once.
 */
export async function fetchJournals(options?: {
  includeHidden?: boolean;
}): Promise<Journal[]> {
  try {
    const journalsRef = collection(firestore, "journals");
    const q = !options?.includeHidden
      ? query(journalsRef, where("status", "==", "active"))
      : query(journalsRef);

    const snapshot = await getDocs(q);
    const items: Journal[] = [];
    snapshot.forEach((d) => {
      items.push({ id: d.id, ...(d.data() as any) });
    });
    return sortJournalsList(items);
  } catch (error) {
    console.error("fetchJournals error:", error);
    return [];
  }
}

/**
 * Get single journal by ID.
 */
export async function getJournalById(id: string): Promise<Journal | null> {
  try {
    const docRef = doc(firestore, "journals", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as any) };
  } catch (error) {
    console.error("getJournalById error:", error);
    return null;
  }
}

/**
 * Create a new journal document (Admin/Owner only).
 */
export async function createJournal(
  journalData: Omit<Journal, "id" | "createdAt" | "updatedAt">,
  user: { uid: string; email?: string }
): Promise<Journal> {
  const docId = journalData.journalId || `tc_${Date.now()}`;
  const docRef = doc(firestore, "journals", docId);

  const now = new Date().toISOString();
  const newJournal: Journal = {
    ...journalData,
    id: docId,
    createdAt: now,
    updatedAt: now,
    createdBy: user.email || user.uid,
    isManualEdited: Boolean(journalData.isManualEdited),
  };

  await setDoc(docRef, cleanUndefined(newJournal));
  return newJournal;
}

/**
 * Update an existing journal document (Admin/Owner only).
 * Sets isManualEdited = true so future imports protect manual changes.
 */
export async function updateJournal(
  id: string,
  updates: Partial<Journal>,
  user: { uid: string; email?: string }
): Promise<void> {
  const docRef = doc(firestore, "journals", id);
  const now = new Date().toISOString();

  const payload: any = {
    ...updates,
    updatedAt: now,
    updatedBy: user.email || user.uid,
    isManualEdited: updates.isManualEdited !== undefined ? updates.isManualEdited : true,
  };

  // Prevent modifying immutable creation metadata
  delete payload.id;
  delete payload.createdAt;
  delete payload.createdBy;

  await updateDoc(docRef, cleanUndefined(payload));
}

/**
 * Toggle journal status (active / hidden).
 */
export async function setJournalStatus(
  id: string,
  status: JournalStatus,
  user: { uid: string; email?: string }
): Promise<void> {
  await updateJournal(id, { status }, user);
}

/**
 * Delete a journal document (Admin/Owner only).
 */
export async function deleteJournal(id: string): Promise<void> {
  const docRef = doc(firestore, "journals", id);
  await deleteDoc(docRef);
}

/**
 * Record an import batch log in `journalImports`.
 */
export async function recordJournalImport(
  result: JournalImportResult
): Promise<string> {
  const docRef = doc(firestore, "journalImports", result.batchId);
  await setDoc(docRef, cleanUndefined(result));
  return result.batchId;
}

/**
 * Fetch past import batches.
 */
export async function fetchJournalImports(): Promise<JournalImportResult[]> {
  try {
    const q = query(
      collection(firestore, "journalImports"),
      orderBy("importedAt", "desc")
    );
    const snap = await getDocs(q);
    const list: JournalImportResult[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as any) }));
    return list;
  } catch (error) {
    console.error("fetchJournalImports error:", error);
    return [];
  }
}
