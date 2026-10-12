import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { firestore } from "../firebase/config";
import type {
  Journal,
  JournalCandidate,
  JournalSyncSettings,
} from "../types/journal";
import {
  fetchJournalGoogleSheetRows,
  buildJournalCandidatesFromSheet,
  DEFAULT_JOURNAL_SHEET_NAME,
  DEFAULT_JOURNAL_SPREADSHEET_ID,
} from "./journalGoogleSheetService";
import { fetchJournals, createJournal, updateJournal } from "./journalService";

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
 * Subscribe to all journal candidates (Admin/Owner only).
 */
export function subscribeJournalCandidates(
  callback: (candidates: JournalCandidate[]) => void
) {
  const colRef = collection(firestore, "journalCandidates");
  const q = query(colRef, orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: JournalCandidate[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...(d.data() as any) });
      });
      callback(items);
    },
    (error) => {
      console.warn("subscribeJournalCandidates error:", error);
      callback([]);
    }
  );
}

/**
 * Fetch all journal candidates once.
 */
export async function fetchJournalCandidates(): Promise<JournalCandidate[]> {
  try {
    const colRef = collection(firestore, "journalCandidates");
    const q = query(colRef, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    const items: JournalCandidate[] = [];
    snap.forEach((d) => {
      items.push({ id: d.id, ...(d.data() as any) });
    });
    return items;
  } catch (error) {
    console.error("fetchJournalCandidates error:", error);
    return [];
  }
}

/**
 * Save Google Sheets sync settings to systemConfig/journal_sync.
 */
export async function saveJournalSyncSettings(
  settings: Partial<JournalSyncSettings>
): Promise<void> {
  const docRef = doc(firestore, "systemConfig", "journal_sync");
  await setDoc(docRef, cleanUndefined(settings), { merge: true });
}

/**
 * Get Google Sheets sync settings.
 */
export async function getJournalSyncSettings(): Promise<JournalSyncSettings | null> {
  try {
    const docRef = doc(firestore, "systemConfig", "journal_sync");
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as JournalSyncSettings;
  } catch (error) {
    console.warn("getJournalSyncSettings error:", error);
    return null;
  }
}

/**
 * Core engine: Syncs from Google Sheets single-tab into Review Queue (journalCandidates).
 * DOES NOT publish directly to public journals!
 */
export async function syncJournalsFromGoogleSheetsToQueue({
  sheetId = DEFAULT_JOURNAL_SPREADSHEET_ID,
  sheetName = DEFAULT_JOURNAL_SHEET_NAME,
  user,
}: {
  sheetId?: string;
  sheetName?: string;
  user: { uid: string; email?: string };
}): Promise<{
  success: boolean;
  totalRead: number;
  newCandidatesCount: number;
  updatedCandidatesCount: number;
  unchangedCount: number;
  skippedDuplicates: number;
  manualReviewCount: number;
  warnings: string[];
}> {
  const effectiveSheetId = sheetId || DEFAULT_JOURNAL_SPREADSHEET_ID;
  const effectiveSheetName = sheetName || DEFAULT_JOURNAL_SHEET_NAME;

  // 1. Fetch rows from Google Sheets
  const sheetResult = await fetchJournalGoogleSheetRows(effectiveSheetId, effectiveSheetName);

  // 2. Fetch existing journals and active pending candidates
  const [existingJournals, existingCandidates] = await Promise.all([
    fetchJournals({ includeHidden: true }),
    fetchJournalCandidates(),
  ]);

  // 3. Build candidate diffs
  const {
    candidatesToCreate,
    newCount,
    updatedCount,
    unchangedCount,
    skippedDuplicates,
  } = buildJournalCandidatesFromSheet(
    sheetResult.validJournals,
    existingJournals,
    existingCandidates
  );

  // 4. Write candidates to Firestore
  for (const cand of candidatesToCreate) {
    const docRef = doc(firestore, "journalCandidates", cand.id);
    await setDoc(docRef, cleanUndefined(cand));
  }

  // 5. Update sync settings and history log
  const now = new Date().toISOString();
  await saveJournalSyncSettings({
    sheetId,
    sheetName,
    lastSyncedAt: now,
    lastSyncedBy: user.email || user.uid,
    lastStats: {
      totalRead: sheetResult.totalRows,
      validRows: sheetResult.validJournals.length,
      newCount,
      updatedCount,
      unchangedCount,
      skippedCount: skippedDuplicates,
      errorCount: sheetResult.warnings.length,
    },
  });

  return {
    success: true,
    totalRead: sheetResult.totalRows,
    newCandidatesCount: newCount,
    updatedCandidatesCount: updatedCount,
    unchangedCount,
    skippedDuplicates,
    manualReviewCount: sheetResult.manualReviewCount,
    warnings: sheetResult.warnings,
  };
}

/**
 * Approve candidate: Publishes to public `journals` and marks candidate as approved.
 */
export async function approveJournalCandidate(
  candidateId: string,
  user: { uid: string; email?: string },
  options?: { overrideManual?: boolean }
): Promise<void> {
  const candRef = doc(firestore, "journalCandidates", candidateId);
  const candSnap = await getDoc(candRef);
  if (!candSnap.exists()) {
    throw new Error("Không tìm thấy bản ghi chờ duyệt: " + candidateId);
  }

  const cand = candSnap.data() as JournalCandidate;
  const now = new Date().toISOString();
  const reviewer = user.email || user.uid;

  if (cand.changeType === "create") {
    // A. Create new journal document
    const journalData: Omit<Journal, "id" | "createdAt" | "updatedAt"> = {
      journalId: cand.journalId,
      name: cand.name,
      englishName: cand.englishName,
      abbreviation: cand.abbreviation,
      publisher: cand.publisher,
      issnPrint: cand.issnPrint,
      issnOnline: cand.issnOnline,
      isbn: cand.isbn,
      category: cand.category,
      primaryField: cand.primaryField,
      fields: cand.fields,
      website: cand.website,
      websiteVerified: cand.websiteVerified,
      maxScore: cand.maxScore,
      maxScoreYear: cand.maxScoreYear,
      scores: cand.scores,
      guidelines: cand.guidelines,
      links: cand.links,
      verification: cand.verification,
      status: "active",
      isManualEdited: false,
      createdBy: reviewer,
    };

    await createJournal(journalData, user);
  } else {
    // B. Update existing journal document
    const existingDocId = cand.existingJournalId || cand.journalId;
    const existingRef = doc(firestore, "journals", existingDocId);
    const existingSnap = await getDoc(existingRef);

    if (existingSnap.exists()) {
      const existing = existingSnap.data() as Journal;

      // Merge scores without overwriting older history
      const mergedScores = [...(existing.scores || [])];
      (cand.scores || []).forEach((newScore) => {
        const idx = mergedScores.findIndex(
          (s) =>
            s.councilCode === newScore.councilCode &&
            s.year === newScore.year &&
            s.decisionNumber === newScore.decisionNumber
        );
        if (idx >= 0) {
          mergedScores[idx] = newScore;
        } else {
          mergedScores.push(newScore);
        }
      });

      // Prepare updates
      const updates: Partial<Journal> = {
        name: existing.isManualEdited && !options?.overrideManual ? existing.name : cand.name,
        englishName: cand.englishName || existing.englishName,
        abbreviation: cand.abbreviation || existing.abbreviation,
        publisher: existing.isManualEdited && !options?.overrideManual ? existing.publisher : cand.publisher,
        issnPrint: cand.issnPrint || existing.issnPrint,
        issnOnline: cand.issnOnline || existing.issnOnline,
        isbn: cand.isbn || existing.isbn,
        primaryField: existing.isManualEdited && !options?.overrideManual ? existing.primaryField : cand.primaryField,
        fields: Array.from(new Set([...(existing.fields || []), ...(cand.fields || [])])),
        website: cand.website || existing.website,
        websiteVerified: cand.websiteVerified || existing.websiteVerified,
        maxScore: Math.max(cand.maxScore, existing.maxScore || 0),
        maxScoreYear: cand.maxScoreYear || existing.maxScoreYear,
        scores: mergedScores,
        guidelines: cand.guidelines || existing.guidelines,
        verification: cand.verification || existing.verification,
      };

      await updateJournal(existingDocId, updates, user);
    }
  }

  // Mark candidate as approved
  await updateDoc(candRef, {
    status: "approved",
    reviewedAt: now,
    reviewedBy: reviewer,
    publishedJournalId: cand.journalId,
    updatedAt: now,
  });
}

/**
 * Bulk approve multiple candidates.
 */
export async function bulkApproveJournalCandidates(
  candidateIds: string[],
  user: { uid: string; email?: string }
): Promise<{ successCount: number; errorCount: number; skippedWarningCount: number }> {
  let successCount = 0;
  let errorCount = 0;
  let skippedWarningCount = 0;

  for (const id of candidateIds) {
    try {
      const candRef = doc(firestore, "journalCandidates", id);
      const candSnap = await getDoc(candRef);
      if (candSnap.exists()) {
        const cand = candSnap.data() as JournalCandidate;
        // Enforce rule: candidates with verification warning cannot be bulk approved
        const hasWarning =
          cand.status === "needs_review" ||
          cand.verification?.manualReviewNeeded === true ||
          cand.unverifiedFields?.some((f) => f.includes("Cần kiểm tra thủ công"));

        if (hasWarning) {
          skippedWarningCount++;
          continue;
        }
      }

      await approveJournalCandidate(id, user);
      successCount++;
    } catch (err) {
      console.error(`Error approving candidate ${id}:`, err);
      errorCount++;
    }
  }

  return { successCount, errorCount, skippedWarningCount };
}


/**
 * Reject candidate with reason.
 */
export async function rejectJournalCandidate(
  candidateId: string,
  rejectionReason: string,
  user: { uid: string; email?: string }
): Promise<void> {
  const candRef = doc(firestore, "journalCandidates", candidateId);
  const now = new Date().toISOString();

  await updateDoc(candRef, {
    status: "rejected",
    rejectionReason: rejectionReason.trim() || "Chưa phù hợp tiêu chí",
    reviewedAt: now,
    reviewedBy: user.email || user.uid,
    updatedAt: now,
  });
}

/**
 * Mark candidate as needs_review.
 */
export async function markJournalCandidateNeedsReview(
  candidateId: string,
  user: { uid: string; email?: string }
): Promise<void> {
  const candRef = doc(firestore, "journalCandidates", candidateId);
  const now = new Date().toISOString();

  await updateDoc(candRef, {
    status: "needs_review",
    updatedAt: now,
    reviewedBy: user.email || user.uid,
  });
}

/**
 * Delete candidate.
 */
export async function deleteJournalCandidate(candidateId: string): Promise<void> {
  const candRef = doc(firestore, "journalCandidates", candidateId);
  await deleteDoc(candRef);
}
