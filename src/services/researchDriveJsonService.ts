import type { RawFacultyResearchRow } from "./facultyResearchData";
import type { OpportunityFeeStatus } from "../types";

export const GOOGLE_DRIVE_PUBLIC_API_KEY = "AIzaSyC992nRuw5qkBpy7-AtC3BjbbnB1uoX1gA";

export const DEFAULT_DRIVE_FOLDER_ID = "1bizJ43wLrsSWUIRBpBsBi2NpMZZ9bidI";
export const ARCHIVE_DRIVE_FOLDER_ID = "13tIOy7JhNM8iI4L9gVGHl6DxFmWfQvTc";
export const DEFAULT_DRIVE_FILE_NAME = "IFA_RH_CONFERENCES.json";
export const TEST_DRIVE_FILE_NAME = "IFA_RH_CONFERENCES_TEST.json";

export interface JsonConference {
  code: string; // "TN0001", "QT0001"
  category: "TN" | "QT";
  title: string;
  organizer: string;
  country: string;
  year?: number;
  type?: string;
  level?: string;
  topic?: string;
  field?: string;
  // Spark 28-field schema & IFA-RH compatibility
  relevance?: string;
  suitability?: string;
  abstractDeadline?: string;
  submissionDeadline?: string;
  fullPaperDeadline?: string;
  registrationDeadline?: string;
  deadline?: string;
  conferenceDate?: string;
  eventDate?: string;
  location?: string;
  fee?: string;
  publicationFee?: string;
  registrationFee?: string;
  feeStatus?: OpportunityFeeStatus;
  feeSourceUrl?: string;
  publication?: string;
  publicationFormat?: string;
  indexing?: string;
  content: string;
  detailedContent?: string;
  suggestedTopics?: string[] | string;
  topicsDetailed?: string[];
  directions?: string;
  sourceUrl?: string;
  submissionUrl?: string;
  notes?: string;
  keywords?: string[] | string;
  tags?: string[] | string;
  status?: string;
  detectedAt?: string;
  discoveredAt?: string;
  lastUpdated?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface ConferencesJsonPayload {
  schemaVersion: number;
  revision: number;
  runId: string;
  generatedAt: string;
  nextCodes?: {
    TN?: string;
    QT?: string;
    [key: string]: string | undefined;
  };
  conferences: JsonConference[];
}

export interface DriveJsonFetchOptions {
  folderId?: string;
  fileName?: string;
  apiKey?: string;
  accessToken?: string;
  signal?: AbortSignal;
  allowFallback?: boolean;
}

export interface DriveJsonFetchResult {
  status: "success" | "cached_fallback";
  payload: ConferencesJsonPayload;
  fileId: string;
  fileName: string;
  revision: number;
  isCached: boolean;
  warning?: string;
}

export class ResearchDriveJsonError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly details?: any;

  constructor(message: string, code = "DRIVE_JSON_ERROR", statusCode?: number, details?: any) {
    super(message);
    this.name = "ResearchDriveJsonError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// In-memory cache for reliable fallback
let inMemoryCache: {
  payload: ConferencesJsonPayload;
  fileId: string;
  fileName: string;
  cachedAt: string;
} | null = null;

// Concurrency lock to prevent overlapping sync executions
let isDriveSyncingLocked = false;

export function acquireDriveSyncLock(): boolean {
  if (isDriveSyncingLocked) return false;
  isDriveSyncingLocked = true;
  return true;
}

export function releaseDriveSyncLock(): void {
  isDriveSyncingLocked = false;
}

export function clearDriveConferencesCache(): void {
  inMemoryCache = null;
}

export function getDriveConferencesCache() {
  return inMemoryCache;
}

export function setDriveConferencesCache(cache: typeof inMemoryCache): void {
  inMemoryCache = cache;
}

/**
 * Normalizes date formats without timezone conversion.
 * - Single ISO or YYYY-MM-DD HH:mm:ss -> DD/MM/YYYY
 * - Date ranges (e.g. 2027-02-25 - 2027-02-27 or 25/02/2027 - 27/02/2027) -> DD/MM/YYYY - DD/MM/YYYY
 * - Existing DD/MM/YYYY preserved as-is.
 */
export function normalizeConferenceDate(rawDate?: string | null): string {
  if (!rawDate) return "";
  const str = String(rawDate).trim();
  if (!str) return "";

  // Date range (e.g. "03/12/2026 - 04/12/2026" or "2026-12-03 - 2026-12-04")
  if (str.includes(" - ")) {
    const parts = str.split(" - ");
    if (parts.length === 2) {
      const p1 = normalizeConferenceDate(parts[0]);
      const p2 = normalizeConferenceDate(parts[1]);
      if (p1 && p2) {
        return `${p1} - ${p2}`;
      }
    }
    return str;
  }

  // If already DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split("/");
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }

  // If YYYY-MM-DD or YYYY-MM-DD HH:mm:ss or ISO
  const m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const [, yyyy, mm, dd] = m;
    return `${dd.padStart(2, "0")}/${mm.padStart(2, "0")}/${yyyy}`;
  }

  return str;
}

export interface FirestoreLockSdk {
  doc: (db: any, col: string, id: string) => any;
  runTransaction?: <T>(db: any, updateFunction: (transaction: any) => Promise<T>) => Promise<T>;
  getDoc?: (ref: any) => Promise<any>;
  setDoc?: (ref: any, data: any, options?: any) => Promise<any>;
}

export interface FirestoreLockResult {
  acquired: boolean;
  lockId?: string;
  message?: string;
  lockedBy?: string;
  lockedAt?: string;
  remainingSeconds?: number;
}

export interface FirestoreUnlockResult {
  released: boolean;
  reason?: string;
}

export const RESEARCH_SYNC_LOCK_DOC_ID = "research_sync_lock";
export const RESEARCH_SYNC_LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Acquires a distributed session lock in Firestore systemConfig collection
 * with a 5-minute TTL via Firestore Transaction to prevent concurrent sync executions
 * across admins/browsers atomically without race conditions.
 */
export async function acquireFirestoreSyncLock(
  db: any,
  sdk: FirestoreLockSdk,
  actor: { email?: string; uid?: string }
): Promise<FirestoreLockResult> {
  const lockRef = sdk.doc(db, "systemConfig", RESEARCH_SYNC_LOCK_DOC_ID);
  const now = Date.now();
  const actorName = actor.email || actor.uid || "unknown";

  if (typeof sdk.runTransaction === "function") {
    try {
      return await sdk.runTransaction(db, async (transaction: any) => {
        const snap = await transaction.get(lockRef);
        let data: any = null;
        if (snap?.exists && (typeof snap.exists === "function" ? snap.exists() : true)) {
          data = typeof snap.data === "function" ? snap.data() : snap;
        }

        if (data && data.isLocked) {
          const lockTime = Number(data.lockTimestampMs) || (data.lockedAt ? new Date(data.lockedAt).getTime() : 0);
          const elapsed = now - lockTime;
          // Within 5-minute TTL: strictly deny acquisition, no force bypass
          if (elapsed < RESEARCH_SYNC_LOCK_TTL_MS) {
            const remainingSeconds = Math.max(1, Math.ceil((RESEARCH_SYNC_LOCK_TTL_MS - elapsed) / 1000));
            return {
              acquired: false,
              message: `Một phiên đồng bộ khác đang chạy bởi ${data.lockedBy || "quản trị viên khác"}. Khóa sẽ tự hết hạn sau ${remainingSeconds} giây.`,
              lockedBy: data.lockedBy,
              lockedAt: data.lockedAt,
              remainingSeconds,
            };
          }
          // If elapsed >= TTL, the lock is expired and will be atomically reclaimed below
        }

        const lockId = `lock_${now}_${Math.random().toString(36).substring(2, 9)}`;
        const lockPayload = {
          isLocked: true,
          lockId,
          lockedBy: actorName,
          lockedAt: new Date(now).toISOString(),
          lockTimestampMs: now,
          ttlMs: RESEARCH_SYNC_LOCK_TTL_MS,
          updatedAt: new Date(now).toISOString(),
        };

        transaction.set(lockRef, lockPayload, { merge: true });

        return {
          acquired: true,
          lockId,
          lockedBy: lockPayload.lockedBy,
          lockedAt: lockPayload.lockedAt,
        };
      });
    } catch (err: any) {
      console.warn("[FirestoreLock] Lỗi khi tạo khóa đồng bộ qua transaction:", err);
      return {
        acquired: false,
        message: `Không thể thiết lập khóa đồng bộ trên Firestore: ${err.message || String(err)}`,
      };
    }
  }

  // Fallback for mocks without runTransaction
  try {
    if (!sdk.getDoc || !sdk.setDoc) {
      throw new Error("SDK lacks both runTransaction and getDoc/setDoc");
    }
    const snap = await sdk.getDoc(lockRef);
    if (snap?.exists && (typeof snap.exists === "function" ? snap.exists() : true)) {
      const data = typeof snap.data === "function" ? snap.data() : snap;
      if (data && data.isLocked) {
        const lockTime = Number(data.lockTimestampMs) || (data.lockedAt ? new Date(data.lockedAt).getTime() : 0);
        const elapsed = now - lockTime;
        if (elapsed < RESEARCH_SYNC_LOCK_TTL_MS) {
          const remainingSeconds = Math.max(1, Math.ceil((RESEARCH_SYNC_LOCK_TTL_MS - elapsed) / 1000));
          return {
            acquired: false,
            message: `Một phiên đồng bộ khác đang chạy bởi ${data.lockedBy || "quản trị viên khác"}. Khóa sẽ tự hết hạn sau ${remainingSeconds} giây.`,
            lockedBy: data.lockedBy,
            lockedAt: data.lockedAt,
            remainingSeconds,
          };
        }
      }
    }

    const lockId = `lock_${now}_${Math.random().toString(36).substring(2, 9)}`;
    await sdk.setDoc(
      lockRef,
      {
        isLocked: true,
        lockId,
        lockedBy: actorName,
        lockedAt: new Date(now).toISOString(),
        lockTimestampMs: now,
        ttlMs: RESEARCH_SYNC_LOCK_TTL_MS,
        updatedAt: new Date(now).toISOString(),
      },
      { merge: true }
    );

    return {
      acquired: true,
      lockId,
      lockedBy: actorName,
      lockedAt: new Date(now).toISOString(),
    };
  } catch (err: any) {
    console.warn("[FirestoreLock] Lỗi khi tạo khóa đồng bộ:", err);
    return {
      acquired: false,
      message: `Không thể thiết lập khóa đồng bộ trên Firestore: ${err.message || String(err)}`,
    };
  }
}

/**
 * Releases the distributed session lock in Firestore systemConfig collection.
 * Strictly verifies ownership via lockId using Firestore Transaction so a stale session
 * cannot inadvertently clear another session's valid lock.
 */
export async function releaseFirestoreSyncLock(
  db: any,
  sdk: FirestoreLockSdk,
  lockId?: string
): Promise<FirestoreUnlockResult> {
  if (!lockId) {
    return { released: false, reason: "Thiếu lockId để giải phóng khóa." };
  }

  const lockRef = sdk.doc(db, "systemConfig", RESEARCH_SYNC_LOCK_DOC_ID);

  if (typeof sdk.runTransaction === "function") {
    try {
      return await sdk.runTransaction(db, async (transaction: any) => {
        const snap = await transaction.get(lockRef);
        let data: any = null;
        if (snap?.exists && (typeof snap.exists === "function" ? snap.exists() : true)) {
          data = typeof snap.data === "function" ? snap.data() : snap;
        }

        if (data && data.isLocked) {
          if (data.lockId !== lockId) {
            console.warn(
              `[FirestoreLock] Không thể giải phóng khóa: lockId không khớp (Hiện tại: "${data.lockId}", Yêu cầu: "${lockId}").`
            );
            return {
              released: false,
              reason: "lock_id_mismatch",
            };
          }

          transaction.set(
            lockRef,
            {
              isLocked: false,
              lockId: "",
              lastReleasedLockId: lockId,
              releasedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
          return { released: true };
        }

        // If not locked, nothing to release
        return { released: true };
      });
    } catch (err: any) {
      console.warn("[FirestoreLock] Lỗi khi giải phóng khóa qua transaction:", err);
      return { released: false, reason: err.message || String(err) };
    }
  }

  // Fallback for mocks
  try {
    if (!sdk.getDoc || !sdk.setDoc) {
      return { released: false, reason: "No getDoc/setDoc available" };
    }
    const snap = await sdk.getDoc(lockRef);
    if (snap?.exists && (typeof snap.exists === "function" ? snap.exists() : true)) {
      const data = typeof snap.data === "function" ? snap.data() : snap;
      if (data && data.isLocked && data.lockId !== lockId) {
        return { released: false, reason: "lock_id_mismatch" };
      }
    }

    await sdk.setDoc(
      lockRef,
      {
        isLocked: false,
        lockId: "",
        lastReleasedLockId: lockId,
        releasedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return { released: true };
  } catch (err: any) {
    console.warn("[FirestoreLock] Lỗi khi giải phóng khóa:", err);
    return { released: false, reason: err.message || String(err) };
  }
}

/**
 * Validates the schema of a Conferences JSON payload from Google Drive.
 */
export function validateConferencesJsonPayload(data: any): { isValid: boolean; error?: string } {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { isValid: false, error: "Nội dung JSON không phải là một đối tượng hợp lệ." };
  }

  if (typeof data.schemaVersion !== "number" || data.schemaVersion !== 1) {
    return {
      isValid: false,
      error: `schemaVersion không hợp lệ (${data.schemaVersion}). Yêu cầu schemaVersion === 1.`,
    };
  }

  if (typeof data.revision !== "number" || !Number.isInteger(data.revision) || data.revision <= 0) {
    return {
      isValid: false,
      error: `revision phải là số nguyên dương hợp lệ (${data.revision}).`,
    };
  }

  if (!Array.isArray(data.conferences)) {
    return {
      isValid: false,
      error: "Trường 'conferences' phải là một mảng danh sách hội thảo.",
    };
  }

  if (data.conferences.length === 0) {
    return {
      isValid: false,
      error: "Mảng 'conferences' rỗng, không chứa dữ liệu hội thảo.",
    };
  }

  const seenCodes = new Set<string>();
  const codeRegex = /^(TN|QT)\d{4}$/;

  for (let i = 0; i < data.conferences.length; i++) {
    const c = data.conferences[i];
    if (!c || typeof c !== "object") {
      return { isValid: false, error: `Phần tử conferences[${i}] không hợp lệ.` };
    }

    if (!c.code || typeof c.code !== "string" || !codeRegex.test(c.code.trim().toUpperCase())) {
      return {
        isValid: false,
        error: `conferences[${i}] có mã 'code' không hợp lệ ("${c.code}"). Yêu cầu định dạng TNxxxx hoặc QTxxxx (VD: TN0001, QT0001).`,
      };
    }

    const normCode = c.code.trim().toUpperCase();
    if (seenCodes.has(normCode)) {
      return {
        isValid: false,
        error: `Phát hiện mã trùng lặp trong file JSON: "${normCode}" xuất hiện nhiều lần.`,
      };
    }
    seenCodes.add(normCode);

    if (c.category !== "TN" && c.category !== "QT") {
      return {
        isValid: false,
        error: `conferences[${i}] (${normCode}) có category không hợp lệ ("${c.category}"). Bắt buộc là "TN" hoặc "QT".`,
      };
    }

    const prefix = normCode.substring(0, 2);
    if (prefix !== c.category) {
      return {
        isValid: false,
        error: `conferences[${i}] (${normCode}) có category ("${c.category}") không khớp với tiền tố mã ("${prefix}").`,
      };
    }

    if (!c.title || typeof c.title !== "string" || !c.title.trim()) {
      return {
        isValid: false,
        error: `conferences[${i}] (${normCode}) thiếu tên hội thảo ('title').`,
      };
    }

    if (!c.organizer || typeof c.organizer !== "string" || !c.organizer.trim()) {
      return {
        isValid: false,
        error: `conferences[${i}] (${normCode}) thiếu đơn vị tổ chức ('organizer').`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Fetches the latest conference JSON file from Google Drive folder by querying file name,
 * inspecting candidates, verifying schemas, and selecting the one with highest revision.
 */
export async function fetchLatestConferencesFromDrive(
  options: DriveJsonFetchOptions = {}
): Promise<DriveJsonFetchResult> {
  const folderId = options.folderId || DEFAULT_DRIVE_FOLDER_ID;
  const targetFileName = options.fileName || DEFAULT_DRIVE_FILE_NAME;
  const apiKey = options.apiKey || GOOGLE_DRIVE_PUBLIC_API_KEY;
  const allowFallback = options.allowFallback !== false;

  try {
    // 1. List files in target folder with pagination support
    let allFiles: Array<{ id: string; name: string; modifiedTime?: string }> = [];
    let pageToken: string | undefined = undefined;

    const requestHeaders: Record<string, string> = {};
    let authParam = "";
    if (options.accessToken) {
      requestHeaders["Authorization"] = `Bearer ${options.accessToken}`;
    } else {
      authParam = `&key=${apiKey}`;
    }

    do {
      const pageParam: string = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
      const q: string = encodeURIComponent(`'${folderId}' in parents and trashed=false and mimeType != 'application/vnd.google-apps.folder'`);
      const listUrl: string = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name,mimeType,size,version,modifiedTime)&pageSize=100${authParam}${pageParam}`;

      const listRes: Response = await fetch(listUrl, { headers: requestHeaders, signal: options.signal });
      if (!listRes.ok) {
        throw new ResearchDriveJsonError(
          `Không thể liệt kê file trong thư mục Google Drive (${folderId}). Trạng thái: ${listRes.status} ${listRes.statusText}`,
          "DRIVE_LIST_FAILED",
          listRes.status
        );
      }

      const listData: any = await listRes.json();
      if (Array.isArray(listData.files)) {
        allFiles.push(...listData.files);
      }
      pageToken = listData.nextPageToken;
    } while (pageToken);

    // Strictly filter files matching targetFileName (case-insensitive)
    // Never fall back to test file if targetFileName is not found
    const candidateFiles = allFiles.filter(
      (f) => f.name.trim().toLowerCase() === targetFileName.trim().toLowerCase()
    );

    if (candidateFiles.length === 0) {
      throw new ResearchDriveJsonError(
        `Không tìm thấy file nào có tên "${targetFileName}" trong thư mục Google Drive (${folderId}). Vui lòng đảm bảo file được chia sẻ quyền xem (Viewer) và đặt đúng trong thư mục IFA_RH_DATA.`,
        "FILE_NOT_FOUND",
        404
      );
    }

    // 2. Download and evaluate each candidate to find the valid one with highest revision
    let bestResult: {
      file: { id: string; name: string };
      payload: ConferencesJsonPayload;
    } | null = null;

    for (const cand of candidateFiles) {
      try {
        const getUrl = `https://www.googleapis.com/drive/v3/files/${cand.id}?alt=media${authParam}`;
        const getRes = await fetch(getUrl, { headers: requestHeaders, signal: options.signal });
        if (!getRes.ok) {
          console.warn(`[DriveJson] Không thể tải file ID ${cand.id} (${cand.name}): status ${getRes.status}`);
          continue;
        }

        const text = await getRes.text();
        let parsed: any;
        try {
          parsed = JSON.parse(text);
        } catch (jsonErr: any) {
          console.warn(`[DriveJson] File ID ${cand.id} chứa JSON không hợp lệ: ${jsonErr.message}`);
          continue;
        }

        const val = validateConferencesJsonPayload(parsed);
        if (!val.isValid) {
          console.warn(`[DriveJson] File ID ${cand.id} không đạt chuẩn schema: ${val.error}`);
          continue;
        }

        // Compare revision
        if (!bestResult || parsed.revision > bestResult.payload.revision) {
          bestResult = { file: cand, payload: parsed as ConferencesJsonPayload };
        }
      } catch (err: any) {
        console.warn(`[DriveJson] Lỗi khi xử lý file ứng viên ${cand.id}:`, err);
      }
    }

    if (!bestResult) {
      throw new ResearchDriveJsonError(
        `Đã tìm thấy ${candidateFiles.length} file ứng viên nhưng không có file nào có cấu trúc JSON hợp lệ và đạt chuẩn schema.`,
        "NO_VALID_REVISION_FOUND",
        422
      );
    }

    // Update in-memory cache
    inMemoryCache = {
      payload: bestResult.payload,
      fileId: bestResult.file.id,
      fileName: bestResult.file.name,
      cachedAt: new Date().toISOString(),
    };

    return {
      status: "success",
      payload: bestResult.payload,
      fileId: bestResult.file.id,
      fileName: bestResult.file.name,
      revision: bestResult.payload.revision,
      isCached: false,
    };
  } catch (error: any) {
    // If fallback is permitted and we have valid cached data in memory
    if (allowFallback && inMemoryCache) {
      console.warn(`[DriveJson] Lỗi khi tải dữ liệu mới từ Google Drive, sử dụng bản cache tốt trước đó (Revision ${inMemoryCache.payload.revision}):`, error.message);
      return {
        status: "cached_fallback",
        payload: inMemoryCache.payload,
        fileId: inMemoryCache.fileId,
        fileName: inMemoryCache.fileName,
        revision: inMemoryCache.payload.revision,
        isCached: true,
        warning: `Không thể đọc trực tiếp từ Google Drive (${error.message}). Đang sử dụng dữ liệu đã xác thực gần nhất (Revision ${inMemoryCache.payload.revision}).`,
      };
    }

    if (error instanceof ResearchDriveJsonError) {
      throw error;
    }

    throw new ResearchDriveJsonError(
      `Lỗi kết nối tới Google Drive API: ${error.message || String(error)}`,
      "DRIVE_NETWORK_ERROR",
      500,
      error
    );
  }
}

/**
 * Maps a JsonConference item from the Google Drive JSON file to the standard RawFacultyResearchRow.
 * Preserves all operational fields, assigns conferenceCode and category.
 * Fully supports Spark's 28-field schema names while maintaining backward compatibility with IFA-RH legacy names.
 */
export function mapJsonConferenceToRawRow(
  conf: JsonConference,
  index: number = 0,
  runId?: string
): RawFacultyResearchRow {
  const normCode = conf.code.trim().toUpperCase();
  // Ensure category is strictly "QT" if code starts with "QT", or "TN" if "TN"
  const cat = normCode.startsWith("QT") || conf.category === "QT" ? "QT" : "TN";

  // Normalize keywords / tags
  const tagsStr = Array.isArray(conf.keywords)
    ? conf.keywords.join(", ")
    : typeof conf.keywords === "string"
    ? conf.keywords
    : Array.isArray(conf.tags)
    ? conf.tags.join(", ")
    : typeof conf.tags === "string"
    ? conf.tags
    : "";

  // Normalize suggestedTopics / directions / topicsDetailed
  const suggestedTopicsStr = Array.isArray(conf.suggestedTopics)
    ? conf.suggestedTopics.join("; ")
    : typeof conf.suggestedTopics === "string"
    ? conf.suggestedTopics
    : "";
  const directions = conf.directions?.trim() || suggestedTopicsStr;
  const topicsDetailed = Array.isArray(conf.suggestedTopics)
    ? conf.suggestedTopics
    : Array.isArray(conf.topicsDetailed)
    ? conf.topicsDetailed
    : [];

  // Normalize fee & feeStatus
  const feeStr = conf.fee?.trim() || "";
  let feeStatus: OpportunityFeeStatus = "UNKNOWN";
  let publicationFee = conf.publicationFee?.trim() || "";
  let registrationFee = conf.registrationFee?.trim() || "";

  if (conf.feeStatus) {
    feeStatus = conf.feeStatus;
  } else if (!feeStr || /^(chưa xác minh|chưa rõ|chưa có|không rõ|n\/a|unknown)$/i.test(feeStr)) {
    feeStatus = "UNKNOWN";
  } else if (/^miễn phí$/i.test(feeStr)) {
    feeStatus = "FREE";
    if (!publicationFee) publicationFee = "Miễn phí";
    if (!registrationFee) registrationFee = "Miễn phí";
  } else {
    feeStatus = "SPECIFIED";
  }

  // Normalize dates to DD/MM/YYYY without timezone shifts
  const submissionDeadline = conf.submissionDeadline || conf.fullPaperDeadline || conf.deadline || "";
  const normSubmissionDl = normalizeConferenceDate(submissionDeadline);
  const normAbstractDl = normalizeConferenceDate(conf.abstractDeadline);
  const normRegistrationDl = normalizeConferenceDate(conf.registrationDeadline);
  const normEventDate = normalizeConferenceDate(conf.conferenceDate || conf.eventDate);

  // Relevance / suitability
  const suitability = conf.relevance?.trim() || conf.suitability?.trim() || "Phù hợp";
  // Publication / publicationFormat
  const publicationFormat = conf.publication?.trim() || conf.publicationFormat?.trim() || "";

  return {
    stt: index + 1,
    title: conf.title.trim(),
    sourceUrl: conf.sourceUrl?.trim() || "",
    submissionUrl: conf.submissionUrl?.trim() || "",
    organizer: conf.organizer.trim(),
    country: conf.country.trim(),
    level: conf.level?.trim() || (cat === "QT" ? "Quốc tế" : "Quốc gia"),
    type: conf.type?.trim() || "Hội thảo",
    topic: conf.topic?.trim() || "",
    suitability,
    field: conf.field?.trim() || "Chung Khoa MTCN",
    abstractDeadline: normAbstractDl,
    fullPaperDeadline: normSubmissionDl,
    registrationDeadline: normRegistrationDl,
    deadline: normSubmissionDl,
    eventDate: normEventDate,
    location: conf.location?.trim() || "",
    fee: feeStr,
    publicationFee,
    registrationFee,
    feeStatus,
    feeSourceUrl: conf.feeSourceUrl || "",
    publicationFormat,
    indexing: conf.indexing?.trim() || "",
    content: conf.content?.trim() || "",
    detailedContent: conf.detailedContent?.trim() || "",
    topicsDetailed,
    directions,
    tags: tagsStr,
    statusText: conf.status || "CÒN HẠN",
    discoveredAt: conf.detectedAt || conf.discoveredAt || new Date().toISOString(),
    lastUpdated: conf.lastUpdated || conf.updatedAt || "",
    updatedAt: conf.updatedAt || conf.lastUpdated || "",
    notes: conf.notes || "",
    runId: runId || conf.runId || "",
    // Extra fields attached for seamless TN/QT governance
    conferenceCode: normCode,
    category: cat,
  } as any;
}
