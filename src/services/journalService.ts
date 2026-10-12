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
  serverTimestamp,
} from "firebase/firestore";
import { firestore } from "../firebase/config";
import type {
  Journal,
  JournalStatus,
  JournalImportResult,
} from "../types/journal";

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
 * Subscribes to journals collection.
 * Public/lecturers receive only active journals. Admins receive all.
 */
export function subscribeJournals(
  callback: (journals: Journal[]) => void,
  options?: { includeHidden?: boolean }
) {
  const journalsRef = collection(firestore, "journals");
  let q = query(journalsRef, orderBy("maxScore", "desc"));

  if (!options?.includeHidden) {
    q = query(journalsRef, where("status", "==", "active"), orderBy("maxScore", "desc"));
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Journal[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...(d.data() as any) });
      });
      callback(items);
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
    let q = query(journalsRef, orderBy("maxScore", "desc"));

    if (!options?.includeHidden) {
      q = query(journalsRef, where("status", "==", "active"), orderBy("maxScore", "desc"));
    }

    const snapshot = await getDocs(q);
    const items: Journal[] = [];
    snapshot.forEach((d) => {
      items.push({ id: d.id, ...(d.data() as any) });
    });
    return items;
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
    isManualEdited: true, // Manual create marks manual edit
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
    isManualEdited: true, // Flag as manually edited
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
