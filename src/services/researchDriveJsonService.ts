import type { RawFacultyResearchRow } from "./facultyResearchData";
import type { OpportunityFeeStatus } from "../types";

export const GOOGLE_DRIVE_PUBLIC_API_KEY = "AIzaSyC992nRuw5qkBpy7-AtC3BjbbnB1uoX1gA";

export const DEFAULT_DRIVE_FOLDER_ID = "1nOjBhXVwTaEsJzo8Ta23Uom2fQKx1BOo";
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
  suitability?: string;
  abstractDeadline?: string;
  fullPaperDeadline?: string;
  registrationDeadline?: string;
  deadline?: string;
  eventDate?: string;
  location?: string;
  fee?: string;
  publicationFee?: string;
  registrationFee?: string;
  feeStatus?: OpportunityFeeStatus;
  feeSourceUrl?: string;
  publicationFormat?: string;
  indexing?: string;
  content: string;
  detailedContent?: string;
  topicsDetailed?: string[];
  directions?: string;
  sourceUrl?: string;
  submissionUrl?: string;
  notes?: string;
  tags?: string[] | string;
  status?: string;
  discoveredAt?: string;
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
    // 1. List files in target folder
    // Search for non-trashed files with names matching targetFileName or test name
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false and mimeType != 'application/vnd.google-apps.folder'`);
    const listUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size,version,modifiedTime)&key=${apiKey}`;

    const listRes = await fetch(listUrl, { signal: options.signal });
    if (!listRes.ok) {
      throw new ResearchDriveJsonError(
        `Không thể liệt kê file trong thư mục Google Drive (${folderId}). Trạng thái: ${listRes.status} ${listRes.statusText}`,
        "DRIVE_LIST_FAILED",
        listRes.status
      );
    }

    const listData = await listRes.json();
    const allFiles: Array<{ id: string; name: string; modifiedTime?: string }> = listData.files || [];

    // Filter files matching targetFileName (or if searching for production but test exists, support fallback in test mode)
    let candidateFiles = allFiles.filter(
      (f) => f.name === targetFileName || f.name.toLowerCase() === targetFileName.toLowerCase()
    );

    // If targetFileName not found, but TEST_DRIVE_FILE_NAME is present, fall back to test file
    if (candidateFiles.length === 0 && targetFileName === DEFAULT_DRIVE_FILE_NAME) {
      candidateFiles = allFiles.filter((f) => f.name === TEST_DRIVE_FILE_NAME);
    }

    if (candidateFiles.length === 0) {
      throw new ResearchDriveJsonError(
        `Không tìm thấy file nào có tên "${targetFileName}" trong thư mục Google Drive (${folderId}).`,
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
        const getUrl = `https://www.googleapis.com/drive/v3/files/${cand.id}?alt=media&key=${apiKey}`;
        const getRes = await fetch(getUrl, { signal: options.signal });
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
 */
export function mapJsonConferenceToRawRow(
  conf: JsonConference,
  index: number = 0,
  runId?: string
): RawFacultyResearchRow {
  const normCode = conf.code.trim().toUpperCase();
  const cat = conf.category === "QT" ? "QT" : "TN";

  // Normalize tags
  const tagsStr = Array.isArray(conf.tags)
    ? conf.tags.join(", ")
    : typeof conf.tags === "string"
    ? conf.tags
    : "";

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
    suitability: conf.suitability?.trim() || "Phù hợp",
    field: conf.field?.trim() || "Chung Khoa MTCN",
    abstractDeadline: conf.abstractDeadline || "",
    fullPaperDeadline: conf.fullPaperDeadline || "",
    registrationDeadline: conf.registrationDeadline || "",
    deadline: conf.deadline || conf.fullPaperDeadline || "",
    eventDate: conf.eventDate || "",
    location: conf.location || "",
    fee: conf.fee || "",
    publicationFee: conf.publicationFee || "",
    registrationFee: conf.registrationFee || "",
    feeStatus: conf.feeStatus || (conf.fee ? "SPECIFIED" : "UNKNOWN"),
    feeSourceUrl: conf.feeSourceUrl || "",
    publicationFormat: conf.publicationFormat || "",
    indexing: conf.indexing || "",
    content: conf.content?.trim() || "",
    detailedContent: conf.detailedContent?.trim() || "",
    topicsDetailed: Array.isArray(conf.topicsDetailed) ? conf.topicsDetailed : [],
    directions: conf.directions?.trim() || "",
    tags: tagsStr,
    statusText: conf.status || "CÒN HẠN",
    discoveredAt: conf.discoveredAt || new Date().toISOString(),
    notes: conf.notes || "",
    runId: runId || conf.runId || "",
    // Extra fields attached for seamless TN/QT governance
    conferenceCode: normCode,
    category: cat,
  } as any;
}
