import type { RawFacultyResearchRow } from "./facultyResearchData";
import type { OpportunityFeeStatus, OpportunityType, OpportunityLevel } from "../types";
import { formatFeeValue, UNKNOWN_FEE_TEXT, FREE_FEE_TEXT } from "../utils/fee";

// FILE 2: Google Sheets trung gian chính thức mà IFA-RH đọc (nhận dữ liệu từ Spark qua IMPORTRANGE)
export const DEFAULT_RESEARCH_SPREADSHEET_TITLE = "IFA Faculty Research";
export const DEFAULT_RESEARCH_SHEET_ID = "1ug0b4Holu6nGp6NwO-JViqe7XexeDLlwirqRELGwh4U";
export const DEFAULT_RESEARCH_SHEET_NAME_TN = "HỘI THẢO";
export const DEFAULT_RESEARCH_SHEET_NAME_QT = "HOI THAO QT";
export const DEFAULT_RESEARCH_SHEET_NAME = DEFAULT_RESEARCH_SHEET_NAME_TN;
export const OFFICIAL_RESEARCH_SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1ug0b4Holu6nGp6NwO-JViqe7XexeDLlwirqRELGwh4U/edit";

// FILE 1: Google Sheets riêng của Spark (Spark tự động tìm kiếm và ghi dữ liệu vào đây)
export const SPARK_ORIGIN_SPREADSHEET_TITLE = "IFA Faculty Research Opportunities";
export const SPARK_ORIGIN_SPREADSHEET_ID = "1eLiEZNC-vidouurOJ-usM1wImJT0unaVceslm2cg-Do";
export const SPARK_ORIGIN_SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1eLiEZNC-vidouurOJ-usM1wImJT0unaVceslm2cg-Do/edit";

export interface ParsedResearchSheetUrl {
  sheetId: string;
  sheetName: string;
}

export function parseResearchSheetUrl(input?: string | null): ParsedResearchSheetUrl {
  const str = String(input || "").trim();
  if (!str) {
    return { sheetId: DEFAULT_RESEARCH_SHEET_ID, sheetName: DEFAULT_RESEARCH_SHEET_NAME };
  }

  const idMatch = str.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,200})/);
  const sheetId = idMatch ? idMatch[1] : str.length > 20 && !str.includes("/") ? str : DEFAULT_RESEARCH_SHEET_ID;

  let sheetName = DEFAULT_RESEARCH_SHEET_NAME;
  try {
    const url = new URL(str);
    const gidParam = url.searchParams.get("sheet") || url.searchParams.get("gid");
    if (gidParam && isNaN(Number(gidParam))) {
      sheetName = decodeURIComponent(gidParam);
    }
  } catch {
    // Not a full URL, fallback to default
  }

  return { sheetId, sheetName };
}

/**
 * Extracts date from GViz cell (handles Date(yyyy, m, d) or formatted string)
 */
export function parseGvizDateValue(cell: any): { text: string; date: Date | null; isVerifiedDate: boolean } {
  if (!cell || (cell.v === null && cell.f === null)) {
    return { text: "", date: null, isVerifiedDate: false };
  }

  const rawVal = cell.v;
  const formattedVal = String(cell.f || "").trim();

  // If text explicitly denotes unverified or textual note
  if (typeof rawVal === "string" && (
    rawVal.toLowerCase().includes("chưa xác minh") ||
    rawVal.toLowerCase().includes("chua xac minh") ||
    rawVal.toLowerCase().includes("thường xuyên") ||
    rawVal.toLowerCase().includes("liên tục")
  )) {
    return { text: rawVal.trim(), date: null, isVerifiedDate: false };
  }

  if (formattedVal && (
    formattedVal.toLowerCase().includes("chưa xác minh") ||
    formattedVal.toLowerCase().includes("chua xac minh") ||
    formattedVal.toLowerCase().includes("thường xuyên")
  )) {
    return { text: formattedVal, date: null, isVerifiedDate: false };
  }

  // Handle GViz Date format: Date(yyyy, m, d) or Date(yyyy, m, d, h, m, s)
  if (typeof rawVal === "string") {
    const m = rawVal.match(/^Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})(?:,\s*(\d{1,2}),\s*(\d{1,2}),\s*(\d{1,2}))?\)$/);
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]); // 0-indexed in GViz
      const day = Number(m[3]);
      const hours = Number(m[4] || 0);
      const minutes = Number(m[5] || 0);
      const seconds = Number(m[6] || 0);
      const d = new Date(Date.UTC(year, month, day, hours, minutes, seconds));

      const dayStr = String(day).padStart(2, "0");
      const monthStr = String(month + 1).padStart(2, "0");
      const text = `${dayStr}/${monthStr}/${year}`;
      return { text, date: d, isVerifiedDate: true };
    }
  }

  // If formatted value is dd/mm/yyyy
  if (formattedVal) {
    const parts = formattedVal.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (parts) {
      const d = Number(parts[1]);
      const m = Number(parts[2]) - 1;
      const y = Number(parts[3]);
      return {
        text: `${String(d).padStart(2, "0")}/${String(m + 1).padStart(2, "0")}/${y}`,
        date: new Date(Date.UTC(y, m, d)),
        isVerifiedDate: true
      };
    }
    return { text: formattedVal, date: null, isVerifiedDate: false };
  }

  if (typeof rawVal === "string" && rawVal.trim()) {
    // Check if ISO string or dd/mm/yyyy
    const parts = rawVal.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (parts) {
      const d = Number(parts[1]);
      const m = Number(parts[2]) - 1;
      const y = Number(parts[3]);
      return {
        text: `${String(d).padStart(2, "0")}/${String(m + 1).padStart(2, "0")}/${y}`,
        date: new Date(Date.UTC(y, m, d)),
        isVerifiedDate: true
      };
    }
    return { text: rawVal.trim(), date: null, isVerifiedDate: false };
  }

  return { text: "", date: null, isVerifiedDate: false };
}

/**
 * Normalizes Opportunity Type
 */
export function normalizeOpportunityType(raw?: string | null): OpportunityType {
  const str = String(raw || "").trim();
  if (str.includes("Hội nghị")) return "Hội nghị";
  if (str.includes("Call for Papers") || str.includes("CFP")) return "Call for Papers";
  if (str.includes("Special Issue")) return "Special Issue";
  if (str.includes("Book Chapter")) return "Book Chapter";
  if (str.includes("Seminar")) return "Seminar";
  if (str.includes("Hợp tác")) return "Hợp tác nghiên cứu";
  if (str.includes("Sáng tạo")) return "Đổi mới sáng tạo";
  if (str.includes("Hội thảo")) return "Hội thảo";
  return "Hội thảo";
}

/**
 * Normalizes Opportunity Level
 */
export function normalizeOpportunityLevel(raw?: string | null): OpportunityLevel {
  const str = String(raw || "").trim();
  if (str.includes("Quốc tế")) return "Quốc tế";
  if (str.includes("Quốc gia")) return "Quốc gia";
  if (str.includes("Trường")) return "Cấp Trường";
  if (str.includes("Khoa")) return "Cấp Khoa";
  return "Quốc tế";
}

/**
 * Parses raw 27-column row from Google Sheets into RawFacultyResearchRow
 */
export function parseFacultyResearchGvizRow(
  cells: any[],
  index: number,
  overrideCategory?: "TN" | "QT"
): RawFacultyResearchRow {
  const getCellVal = (idx: number): string => {
    const c = cells[idx];
    if (!c) return "";
    if (c.f !== undefined && c.f !== null) return String(c.f).trim();
    if (c.v !== undefined && c.v !== null) return String(c.v).trim();
    return "";
  };

  const sttNum = Number(cells[0]?.v);
  const stt = Number.isFinite(sttNum) && sttNum > 0 ? sttNum : index + 1;

  const discovered = parseGvizDateValue(cells[1]);
  const runId = getCellVal(2);
  const title = getCellVal(3);
  const sourceUrl = getCellVal(4);
  const submissionUrl = getCellVal(5);
  const organizer = getCellVal(6);
  const country = getCellVal(7) || "Việt Nam";
  const level = getCellVal(8) || "Quốc tế";
  const type = getCellVal(9) || "Hội thảo";
  const topic = getCellVal(10);
  const suitability = getCellVal(11) || "Phù hợp";
  const field = getCellVal(12) || "Chung Khoa MTCN";

  const abstractParsed = parseGvizDateValue(cells[13]);
  const fullPaperParsed = parseGvizDateValue(cells[14]);
  const regParsed = parseGvizDateValue(cells[15]);
  const eventDateVal = getCellVal(16);
  const location = getCellVal(17);
  const fee = getCellVal(18);
  const publicationFormat = getCellVal(19);
  const indexing = getCellVal(20);
  const content = getCellVal(21);
  const directions = getCellVal(22);
  const tags = getCellVal(23);
  const statusText = getCellVal(24) || "CÒN HẠN";
  const updatedParsed = parseGvizDateValue(cells[25]);
  const notes = getCellVal(26);

  // Fee normalization
  const feeStatus: OpportunityFeeStatus =
    fee.toLowerCase().includes("miễn phí")
      ? "FREE"
      : fee.toLowerCase().includes("chưa xác minh") || !fee
      ? "UNKNOWN"
      : "SPECIFIED";

  const publicationFee = feeStatus === "FREE" ? FREE_FEE_TEXT : fee ? formatFeeValue(fee) : UNKNOWN_FEE_TEXT;
  const registrationFee = feeStatus === "FREE" ? FREE_FEE_TEXT : UNKNOWN_FEE_TEXT;

  // Split topic tracks if present into topicsDetailed
  const topicsDetailed: string[] = [];
  if (topic) {
    const rawTracks = topic.split(/\r?\n|;\s*(?=Track|Chủ đề|\d+\.)/);
    for (const t of rawTracks) {
      const cleanT = t.trim();
      if (cleanT && cleanT.length > 5) topicsDetailed.push(cleanT);
    }
  }

  const category: "TN" | "QT" =
    overrideCategory ||
    (level.toLowerCase().includes("quốc gia") || country.toLowerCase().includes("việt nam") ? "TN" : "QT");

  return {
    stt,
    discoveredAt: discovered.text || undefined,
    runId: runId || undefined,
    title,
    sourceUrl: sourceUrl || undefined,
    submissionUrl: submissionUrl || undefined,
    organizer,
    country,
    level,
    type,
    topic,
    suitability,
    field,
    abstractDeadline: abstractParsed.text || undefined,
    fullPaperDeadline: fullPaperParsed.text || undefined,
    registrationDeadline: regParsed.text || undefined,
    eventDate: eventDateVal || undefined,
    location: location || undefined,
    fee: fee || undefined,
    publicationFee,
    registrationFee,
    feeStatus,
    feeSourceUrl: sourceUrl || undefined,
    publicationFormat: publicationFormat || undefined,
    indexing: indexing || undefined,
    content,
    detailedContent: content || undefined,
    topicsDetailed: topicsDetailed.length > 0 ? topicsDetailed : undefined,
    directions: directions || undefined,
    tags: tags || undefined,
    statusText,
    updatedAt: updatedParsed.text || undefined,
    notes: notes || undefined,
    category,
  };
}

/**
 * Fetches and parses a single tab from Google Sheets
 */
export async function fetchSingleFacultyResearchTab(
  sheetId: string,
  tabName: string,
  category: "TN" | "QT",
  { fetchImpl = fetch }: { fetchImpl?: typeof fetch } = {}
): Promise<RawFacultyResearchRow[]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?sheet=${encodeURIComponent(
    tabName
  )}&tqx=out:json&headers=1&_t=${Date.now()}`;

  const response = await fetchImpl(url, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) {
    throw new Error(`Google Sheets HTTP ${response.status}: ${response.statusText} (Tab: ${tabName})`);
  }

  const text = await response.text();
  const start = text.indexOf("google.visualization.Query.setResponse(");
  if (start < 0) {
    throw new Error(`Google Sheets không trả về cấu trúc bảng dữ liệu hợp lệ cho tab "${tabName}".`);
  }

  const jsonStr = text.slice(start + "google.visualization.Query.setResponse(".length).trim().replace(/\);?\s*$/, "");
  const resObj = JSON.parse(jsonStr);

  if (resObj.status !== "ok" || !resObj.table) {
    throw new Error(
      `Lỗi đọc tab "${tabName}": ${resObj.errors?.[0]?.message || resObj.status || "Không có dữ liệu bảng"}`
    );
  }

  const rows = resObj.table.rows || [];
  const parsedRows: RawFacultyResearchRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row.c)) continue;

    // Check if row has a title
    const title = row.c[3]?.f || row.c[3]?.v;
    if (!title || !String(title).trim()) continue;

    parsedRows.push(parseFacultyResearchGvizRow(row.c, i, category));
  }

  return parsedRows;
}

export interface FacultyResearchSheetsConfig {
  sheetId?: string;
  sheetNameTN?: string;
  sheetNameQT?: string;
}

export interface FetchAllSheetsResult {
  rows: RawFacultyResearchRow[];
  tnRows: RawFacultyResearchRow[];
  qtRows: RawFacultyResearchRow[];
  sheetId: string;
  sheetTitle: string;
  tabsRead: string[];
  sheetMeta: {
    sheetId: string;
    sheetTitle: string;
    tabs: string[];
    url: string;
    tnCount: number;
    qtCount: number;
  };
}

/**
 * Fetches both HOI THAO (TN) and HOI THAO QT (QT) tabs from official Google Sheet.
 * Fails safely if either tab cannot be read or is empty.
 */
export async function fetchAllFacultyResearchSheets(
  sheetConfig?: FacultyResearchSheetsConfig,
  { fetchImpl = fetch }: { fetchImpl?: typeof fetch } = {}
): Promise<FetchAllSheetsResult> {
  const sheetId = sheetConfig?.sheetId || DEFAULT_RESEARCH_SHEET_ID;
  const sheetNameTN = sheetConfig?.sheetNameTN || DEFAULT_RESEARCH_SHEET_NAME_TN;
  const sheetNameQT = sheetConfig?.sheetNameQT || DEFAULT_RESEARCH_SHEET_NAME_QT;

  // 1. Fetch Tab TN (HOI THAO)
  const tnRows = await fetchSingleFacultyResearchTab(sheetId, sheetNameTN, "TN", { fetchImpl });
  if (!Array.isArray(tnRows) || tnRows.length === 0) {
    throw new Error(
      `Không đọc được dữ liệu từ tab Trong nước ("${sheetNameTN}") trên Google Sheets ${sheetId}. Quá trình đồng bộ đã bị dừng an toàn để bảo vệ Firestore.`
    );
  }

  // 2. Fetch Tab QT (HOI THAO QT)
  const qtRows = await fetchSingleFacultyResearchTab(sheetId, sheetNameQT, "QT", { fetchImpl });
  if (!Array.isArray(qtRows) || qtRows.length === 0) {
    throw new Error(
      `Không đọc được dữ liệu từ tab Quốc tế ("${sheetNameQT}") trên Google Sheets ${sheetId}. Quá trình đồng bộ đã bị dừng an toàn để bảo vệ Firestore.`
    );
  }

  // Safeguard: detect if GViz silently fell back to the first tab because a tab name did not exist
  if (sheetNameTN !== sheetNameQT && tnRows.length > 0 && qtRows.length > 0 && tnRows[0].title === qtRows[0].title) {
    throw new Error(
      `Phát hiện Google Sheets trả về trùng dữ liệu cho hai tab khác nhau ("${sheetNameTN}" và "${sheetNameQT}"). Có thể một trong hai tab không tồn tại trên Google Sheets.`
    );
  }

  const combinedRows = [...tnRows, ...qtRows];

  const sheetMeta = {
    sheetId,
    sheetTitle: DEFAULT_RESEARCH_SPREADSHEET_TITLE,
    tabs: [sheetNameTN, sheetNameQT],
    url: OFFICIAL_RESEARCH_SPREADSHEET_URL,
    tnCount: tnRows.length,
    qtCount: qtRows.length,
  };

  return {
    rows: combinedRows,
    tnRows,
    qtRows,
    sheetId,
    sheetTitle: DEFAULT_RESEARCH_SPREADSHEET_TITLE,
    tabsRead: [sheetNameTN, sheetNameQT],
    sheetMeta,
  };
}

/**
 * Fetches and parses rows from a single Google Sheet tab (backwards compatibility)
 */
export async function fetchFacultyResearchSheetRows(
  sheetConfig?: { sheetId?: string; sheetName?: string },
  { fetchImpl = fetch }: { fetchImpl?: typeof fetch } = {}
): Promise<RawFacultyResearchRow[]> {
  const sheetId = sheetConfig?.sheetId || DEFAULT_RESEARCH_SHEET_ID;
  const sheetName = sheetConfig?.sheetName || DEFAULT_RESEARCH_SHEET_NAME_TN;
  const category: "TN" | "QT" = sheetName.toUpperCase().includes("QT") ? "QT" : "TN";
  return fetchSingleFacultyResearchTab(sheetId, sheetName, category, { fetchImpl });
}
