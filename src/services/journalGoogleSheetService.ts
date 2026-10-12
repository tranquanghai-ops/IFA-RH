import type {
  Journal,
  JournalCategory,
  JournalScoreItem,
  JournalGuidelines,
  JournalLinkItem,
  JournalVerification,
  JournalCandidate,
  JournalFieldDiff,
  JournalSyncSettings,
} from "../types/journal";
import { normalizeTitle, normalizeIssn } from "./journalExcelService";

export const DEFAULT_JOURNAL_DRIVE_FOLDER_URL =
  "https://drive.google.com/open?id=1HHNhKCQk_U85HH24V8-QDbzptQFYbO3X&usp=drive_fs";
export const DEFAULT_JOURNAL_SPREADSHEET_ID =
  "1QJKvNd7s0eZpr8HiO_FYGi5HQF3sHhlqR6_G5SODXWE";
export const DEFAULT_JOURNAL_SHEET_NAME = "Trang tính1";
export const FALLBACK_JOURNAL_SHEET_NAME = "TAP_CHI";
export const EXPECTED_FILE_NAME = "IFA-RH_DANH_MUC_TAP_CHI";

export interface ParsedGoogleSheetJournalRow {
  rowIndex: number;
  journal: Journal;
  rawScoresJson?: string;
  parseWarnings: string[];
}

export interface FetchJournalSheetResult {
  sheetId: string;
  sheetName: string;
  totalRows: number;
  validJournals: Journal[];
  warnings: string[];
  manualReviewCount: number;
}

/**
 * Normalizes header string to match column names flexibly across Vietnamese accents,
 * spaces, and case variations.
 */
export function normalizeHeaderKey(header: string): string {
  if (!header) return "";
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .trim();
}

/**
 * Extracts sheet ID from input URL or raw ID string.
 */
export function parseSpreadsheetId(input?: string | null): string {
  const str = String(input || "").trim();
  if (!str) return "";

  const match = str.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,200})/);
  if (match) return match[1];

  if (str.length >= 20 && !str.includes("/") && !str.includes(" ")) {
    return str;
  }
  return "";
}

/**
 * Adapts Google Sheets text score fields into structured JournalScoreItem[].
 * Handles:
 * - Single group with standard score (e.g. 0.5, 0.75, 1.0)
 * - Multiple groups separated by '|' (e.g. J_039: Nhóm I: 0.75 | Nhóm III: 1.0)
 * - Format variations (bản in 1.0 vs bản điện tử 0.5/0.75 in J_076, J_080)
 * - Historical score cessations (e.g. J_020: 0 from June 2025)
 * - Pre-2019 only validities (e.g. J_042: 0 - 0.75 before 2019)
 */
export function parseScoreAdapter({
  nhomNganhRaw = "",
  tenNhomRaw = "",
  phanLoaiRaw = "",
  diem2025Raw = "",
  cacMocRaw = "",
  ghiChuRaw = "",
  fallbackField = "Văn hóa - Nghệ thuật",
}: {
  nhomNganhRaw?: string;
  tenNhomRaw?: string;
  phanLoaiRaw?: string;
  diem2025Raw?: string | number;
  cacMocRaw?: string;
  ghiChuRaw?: string;
  fallbackField?: string;
}): { scores: JournalScoreItem[]; maxScore: number; maxScoreYear: number } {
  const s15 = String(nhomNganhRaw || "").trim();
  const s16 = String(tenNhomRaw || "").trim();
  const s17 = String(phanLoaiRaw || "").trim();
  const s18 = String(diem2025Raw ?? "").trim();
  const s19 = String(cacMocRaw || "").trim();
  const s20 = String(ghiChuRaw || "").trim();

  // Multi-group or multi-format split by '|'
  if (s18.includes("|") || s16.includes("|") || s19.includes("|") || s17.includes("|")) {
    const splitPipe = (str: string) => (str ? str.split("|").map((s) => s.trim()) : []);
    const scoresPart = splitPipe(s18);
    const tenNhomPart = splitPipe(s16);
    const phanLoaiPart = splitPipe(s17);
    const cacMocPart = splitPipe(s19);
    const ghiChuPart = splitPipe(s20);
    const nhomNganhPart = s15 ? s15.split(/[|;]/).map((s) => s.trim()) : [];

    const count = Math.max(
      scoresPart.length,
      tenNhomPart.length,
      phanLoaiPart.length,
      cacMocPart.length
    );
    const scores: JournalScoreItem[] = [];

    for (let i = 0; i < count; i++) {
      const rawScoreStr = scoresPart[i] || scoresPart[0] || "";
      const numMatch = rawScoreStr.match(/(\d+(?:[.,]\d+)?)/);
      const scoreNum = numMatch ? parseFloat(numMatch[1].replace(",", ".")) : 0;

      const groupName = tenNhomPart[i] || tenNhomPart[0] || nhomNganhPart[i] || fallbackField;
      const pl = phanLoaiPart[i] || "";
      const cm = cacMocPart[i] || "";
      const gc = ghiChuPart[i] || "";

      const notesArr: string[] = [];
      if (pl) notesArr.push(`Phân loại: ${pl}`);
      if (cm) notesArr.push(`Lịch sử: ${cm}`);
      if (gc) notesArr.push(`Ghi chú: ${gc}`);

      // Council code resolution without substring bugs (test V, IV, III, II, I sequentially)
      let councilCode = `NHOM_${i + 1}`;
      const searchTarget = `${rawScoreStr} ${groupName} ${nhomNganhPart[i] || ""}`.toLowerCase();
      if (/\bnhóm\s*(v|5)\b/i.test(searchTarget)) councilCode = "NHOM_V";
      else if (/\bnhóm\s*(iv|4)\b/i.test(searchTarget)) councilCode = "NHOM_IV";
      else if (/\bnhóm\s*(iii|3)\b/i.test(searchTarget)) councilCode = "NHOM_III";
      else if (/\bnhóm\s*(ii|2)\b/i.test(searchTarget)) councilCode = "NHOM_II";
      else if (/\bnhóm\s*(i|1)\b/i.test(searchTarget)) councilCode = "NHOM_I";

      if (pl.toLowerCase().includes("bản in")) councilCode += "_PRINT";
      else if (pl.toLowerCase().includes("bản điện tử") || pl.toLowerCase().includes("dien tu"))
        councilCode += "_ONLINE";

      scores.push({
        id: `PTS-${i + 1}`,
        councilCode,
        councilName: groupName,
        year: 2025,
        maxScore: scoreNum,
        minScore: 0,
        decisionNumber: "26/QĐ-HĐGSNN",
        decisionDate: "2025-07-11",
        notes: notesArr.join(" | ") || undefined,
      });
    }

    const maxScore = scores.length > 0 ? Math.max(...scores.map((s) => s.maxScore)) : 0;
    return { scores, maxScore, maxScoreYear: 2025 };
  }

  // Single score resolution
  let scoreNum = 0;
  if (s18) {
    const num = parseFloat(s18.replace(",", "."));
    if (!isNaN(num)) scoreNum = num;
  } else if (s19.includes("0 từ tháng 6/2025")) {
    scoreNum = 0;
  }

  let maxScoreYear = 2025;
  if (s19.includes("trước 2019") || s19.includes("truoc 2019")) {
    maxScoreYear = 2018;
  }

  const notesArr: string[] = [];
  if (s17 && s17 !== "Toàn tạp chí") notesArr.push(`Phân loại: ${s17}`);
  if (s19) notesArr.push(`Lịch sử điểm: ${s19}`);
  if (s20) notesArr.push(`Ghi chú: ${s20}`);

  let councilCode = "HDGS_CHUNG";
  const searchTarget = `${s15} ${s16}`.toLowerCase();
  if (/\bnhóm\s*(v|5)\b/i.test(searchTarget)) councilCode = "NHOM_V";
  else if (/\bnhóm\s*(iv|4)\b/i.test(searchTarget)) councilCode = "NHOM_IV";
  else if (/\bnhóm\s*(iii|3)\b/i.test(searchTarget)) councilCode = "NHOM_III";
  else if (/\bnhóm\s*(ii|2)\b/i.test(searchTarget)) councilCode = "NHOM_II";
  else if (/\bnhóm\s*(i|1)\b/i.test(searchTarget)) councilCode = "NHOM_I";

  const scores: JournalScoreItem[] = [
    {
      id: "PTS-1",
      councilCode,
      councilName: s16 || s15 || "HĐGS Liên ngành Văn hóa - Nghệ thuật - TDTT",
      year: maxScoreYear,
      maxScore: scoreNum,
      minScore: 0,
      decisionNumber: "26/QĐ-HĐGSNN",
      decisionDate: "2025-07-11",
      notes: notesArr.join(" | ") || undefined,
    },
  ];

  return { scores, maxScore: scoreNum, maxScoreYear };
}

/**
 * Safely parse JSON array of scores from cell value (retained for backward compatibility).
 */
export function parseScoresJson(
  val: any,
  fallback: { maxScore: number; maxScoreYear: number; primaryField: string }
): JournalScoreItem[] {
  if (!val) {
    if (fallback.maxScore > 0) {
      return [
        {
          id: `PTS-DEFAULT`,
          councilCode: "HDGS_CHUNG",
          councilName: fallback.primaryField || "HĐGS Ngành",
          year: fallback.maxScoreYear || 2025,
          maxScore: fallback.maxScore,
          decisionNumber: "26/QĐ-HĐGSNN",
          decisionDate: "2025-07-11",
        },
      ];
    }
    return [];
  }

  if (Array.isArray(val)) {
    return val.map((s, idx) => ({
      id: s.id || `PTS-${idx + 1}`,
      councilCode: s.councilCode || s.council_code || "HDGS_CHUNG",
      councilName: s.councilName || s.council_name || fallback.primaryField,
      year: Number(s.year) || fallback.maxScoreYear || 2025,
      maxScore: Number(s.maxScore ?? s.max_score ?? fallback.maxScore),
      minScore:
        s.minScore !== undefined
          ? Number(s.minScore)
          : s.min_score !== undefined
          ? Number(s.min_score)
          : undefined,
      decisionNumber: s.decisionNumber || s.decision_number || "26/QĐ-HĐGSNN",
      decisionDate: s.decisionDate || s.decision_date || "2025-07-11",
      notes: s.notes || s.ghi_chu || undefined,
    }));
  }

  const str = String(val).trim();
  if (str.startsWith("[") || str.startsWith("{")) {
    try {
      const parsed = JSON.parse(str);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      return arr.map((s, idx) => ({
        id: s.id || `PTS-${idx + 1}`,
        councilCode: s.councilCode || s.council_code || "HDGS_CHUNG",
        councilName: s.councilName || s.council_name || fallback.primaryField,
        year: Number(s.year) || fallback.maxScoreYear || 2025,
        maxScore: Number(s.maxScore ?? s.max_score ?? fallback.maxScore),
        minScore:
          s.minScore !== undefined
            ? Number(s.minScore)
            : s.min_score !== undefined
            ? Number(s.min_score)
            : undefined,
        decisionNumber: s.decisionNumber || s.decision_number || "26/QĐ-HĐGSNN",
        decisionDate: s.decisionDate || s.decision_date || "2025-07-11",
        notes: s.notes || s.ghi_chu || undefined,
      }));
    } catch {
      // Fallback
    }
  }

  const num = parseFloat(str.replace(",", "."));
  if (!isNaN(num) && num >= 0) {
    return [
      {
        id: "PTS-PARSED",
        councilCode: "HDGS_CHUNG",
        councilName: fallback.primaryField || "HĐGS Ngành",
        year: fallback.maxScoreYear || 2025,
        maxScore: num,
        decisionNumber: "26/QĐ-HĐGSNN",
        decisionDate: "2025-07-11",
      },
    ];
  }

  return [];
}

/**
 * Parses raw cell value into guidelines object.
 */
export function parseGuidelinesValue(
  cellVal: any,
  extraCols: {
    templateUrl?: string;
    submissionUrl?: string;
    editorialEmail?: string;
    contactPhone?: string;
    citationStyle?: string;
    publicationFee?: string;
    publicationLanguage?: string;
    publicationFrequency?: string;
    reviewTimeWeeks?: string;
    manuscriptFormat?: string;
    pageLimit?: string;
    officeAddress?: string;
  }
): JournalGuidelines {
  let guidelines: JournalGuidelines = {
    hasGuidelines: false,
    ...extraCols,
  };

  if (!cellVal) {
    if (
      extraCols.templateUrl ||
      extraCols.submissionUrl ||
      extraCols.editorialEmail ||
      extraCols.manuscriptFormat ||
      extraCols.citationStyle
    ) {
      guidelines.hasGuidelines = true;
    }
    return guidelines;
  }

  const str = String(cellVal).trim();
  if (str.startsWith("{")) {
    try {
      const parsed = JSON.parse(str);
      return {
        hasGuidelines: true,
        summary: parsed.summary || parsed.tom_tat,
        manuscriptFormat: parsed.manuscriptFormat || parsed.dinh_dang || extraCols.manuscriptFormat,
        wordLimitMin: parsed.wordLimitMin ? Number(parsed.wordLimitMin) : undefined,
        wordLimitMax: parsed.wordLimitMax ? Number(parsed.wordLimitMax) : undefined,
        pageLimit: parsed.pageLimit || parsed.so_trang || extraCols.pageLimit,
        templateUrl: parsed.templateUrl || extraCols.templateUrl,
        citationStyle: parsed.citationStyle || extraCols.citationStyle,
        publicationLanguage: parsed.publicationLanguage || parsed.ngon_ngu || extraCols.publicationLanguage,
        reviewFee: parsed.reviewFee || parsed.phi_phan_bien,
        publicationFee: parsed.publicationFee || extraCols.publicationFee,
        publicationFrequency: parsed.publicationFrequency || parsed.tan_suat || extraCols.publicationFrequency,
        reviewTimeWeeks: parsed.reviewTimeWeeks || parsed.thoi_gian_phan_bien || extraCols.reviewTimeWeeks,
        submissionUrl: parsed.submissionUrl || extraCols.submissionUrl,
        editorialEmail: parsed.editorialEmail || extraCols.editorialEmail,
        contactPhone: parsed.contactPhone || extraCols.contactPhone,
        officeAddress: parsed.officeAddress || parsed.dia_chi || extraCols.officeAddress,
      };
    } catch {
      // Fallback
    }
  }

  return {
    hasGuidelines: str.length > 0 && !str.toLowerCase().includes("chưa có"),
    summary: str,
    ...extraCols,
  };
}

/**
 * Fetches and parses Google Sheets single tab rows via GViz endpoint.
 * Supports primary tab "Trang tính1" and fallback "TAP_CHI".
 * Fully parses all 47 columns and identifies 17 manual inspection cases.
 */
export async function fetchJournalGoogleSheetRows(
  sheetId: string,
  sheetName: string = DEFAULT_JOURNAL_SHEET_NAME,
  { fetchImpl = fetch }: { fetchImpl?: typeof fetch } = {}
): Promise<FetchJournalSheetResult> {
  const cleanId = parseSpreadsheetId(sheetId) || DEFAULT_JOURNAL_SPREADSHEET_ID;
  if (!cleanId) {
    throw new Error(
      "Spreadsheet ID không hợp lệ hoặc để trống. Vui lòng cung cấp Spreadsheet ID do Spark tạo."
    );
  }

  let effectiveSheetName = sheetName || DEFAULT_JOURNAL_SHEET_NAME;

  const tryFetchGviz = async (targetTab: string) => {
    const url = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?sheet=${encodeURIComponent(
      targetTab
    )}&tqx=out:json&headers=1&_t=${Date.now()}`;
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(25000) });
    if (!response.ok) {
      throw new Error(
        `Lỗi kết nối Google Sheets HTTP ${response.status}: ${response.statusText}. Kiểm tra xem file đã được chia sẻ quyền xem (Anyone with the link can view) chưa.`
      );
    }
    const text = await response.text();
    const start = text.indexOf("google.visualization.Query.setResponse(");
    if (start < 0) {
      throw new Error("Google Sheets không trả về định dạng bảng hợp lệ.");
    }
    const jsonStr = text
      .slice(start + "google.visualization.Query.setResponse(".length)
      .trim()
      .replace(/\);?\s*$/, "");
    const resObj = JSON.parse(jsonStr);
    return resObj;
  };

  let resObj: any = null;
  try {
    resObj = await tryFetchGviz(effectiveSheetName);
    if (resObj.status !== "ok" || !resObj.table) {
      throw new Error(resObj.errors?.[0]?.message || "Lỗi nạp tab chính");
    }
  } catch (primaryErr) {
    // If primary tab fails, try fallback tab
    const alternativeTab =
      effectiveSheetName === DEFAULT_JOURNAL_SHEET_NAME
        ? FALLBACK_JOURNAL_SHEET_NAME
        : DEFAULT_JOURNAL_SHEET_NAME;
    try {
      resObj = await tryFetchGviz(alternativeTab);
      if (resObj.status === "ok" && resObj.table) {
        effectiveSheetName = alternativeTab;
      } else {
        throw primaryErr;
      }
    } catch {
      throw primaryErr;
    }
  }

  if (resObj.status !== "ok" || !resObj.table) {
    throw new Error(
      `Lỗi bảng tính Google: ${resObj.errors?.[0]?.message || resObj.status || "Không có dữ liệu"}`
    );
  }

  const cols = resObj.table.cols || [];
  const rows = resObj.table.rows || [];

  // Map header keys to column indices
  const colMap = new Map<string, number>();
  cols.forEach((col: any, idx: number) => {
    const rawLabel = col?.label || col?.id || "";
    const norm = normalizeHeaderKey(rawLabel);
    if (norm) {
      colMap.set(norm, idx);
    }
  });

  const getCol = (possibleKeys: string[]): number => {
    for (const k of possibleKeys) {
      if (colMap.has(k)) return colMap.get(k)!;
    }
    return -1;
  };

  // 47 column indexes
  const cJournalId = getCol(["journal_id", "ma_tap_chi", "id", "stt"]);
  const cName = getCol(["ten_chinh_thuc_vn", "ten_tap_chi", "journal_name", "name", "ten_tieng_viet", "tap_chi"]);
  const cEnglishName = getCol(["ten_tieng_anh", "english_name", "english"]);
  const cAbbr = getCol(["ten_viet_tat", "abbreviation", "viet_tat"]);
  const cIssnPrint = getCol(["issn_print", "issn", "issn_ban_in", "issn_in"]);
  const cIssnOnline = getCol(["issn_online", "e_issn", "eissn", "issn_dien_tu"]);
  const cIsbn = getCol(["isbn_lien_quan", "isbn"]);
  const cHostAgency = getCol(["co_quan_chu_quan", "chu_quan"]);
  const cPublisher = getCol(["don_vi_xuat_ban", "publisher", "co_quan_xuat_ban"]);
  const cPrimaryField = getCol(["linh_vuc_nghien_cuu", "primary_field", "linh_vuc", "linh_vuc_chinh", "chuyen_nganh"]);
  const cLang = getCol(["ngon_ngu_xuat_ban", "ngon_ngu"]);
  const cFreq = getCol(["tan_suat_xuat_ban", "tan_suat"]);
  const cNameHistory = getCol(["lich_su_thay_doi_ten"]);
  const cStatus = getCol(["trang_thai_hoat_dong"]);
  const cPdfIndex = getCol(["so_tt_pdf"]);

  // Scores
  const cNhomNganh = getCol(["nhom_nganh_hdgsnn"]);
  const cTenNhom = getCol(["ten_nhom_nganh"]);
  const cPhanLoai = getCol(["phan_loai_an_pham"]);
  const cDiem2025 = getCol(["diem_toi_da_2025", "max_score", "diem_toi_da"]);
  const cCacMocDiem = getCol(["cac_moc_thay_doi_diem", "lich_su_diem"]);
  const cGhiChuDiem = getCol(["ghi_chu_diem_hdgsnn"]);
  const cScoresJson = getCol(["scores", "scores_json", "diem_hdgsnn_json"]);
  const cFields = getCol(["fields", "nhom_nganh", "cac_hoi_dong", "hoi_dong_nganh"]);

  // Guidelines
  const cTheLe = getCol(["the_le_dang_bai", "guidelines", "huong_dan_tac_gia", "the_le"]);
  const cQuyCach = getCol(["quy_cach_ban_thao", "dinh_dang"]);
  const cSoTu = getCol(["so_tu_so_trang", "so_trang"]);
  const cChuanTrichDan = getCol(["chuan_trich_dan", "citation_style"]);
  const cFileMau = getCol(["file_mau_bai_viet", "template_url", "file_mau", "mau_bai_viet"]);
  const cLePhiNop = getCol(["le_phi_nop_bai", "phi_nop_bai"]);
  const cPhiApc = getCol(["phi_xuat_ban_apc", "publication_fee", "phi_cong_bo", "phi_xuat_ban", "apc"]);
  const cThoiGianPb = getCol(["thoi_gian_phan_bien", "thoi_gian_xet_duyet"]);
  const cNgonNguChapNhan = getCol(["ngon_ngu_chap_nhan"]);
  const cHinhThucNop = getCol(["hinh_thuc_nop_bai"]);

  // Contacts & Links
  const cUrlWebsite = getCol(["url_website_chinh_thuc", "website", "trang_chu", "url", "link_trang_chu"]);
  const cUrlHuongDan = getCol(["url_huong_dan_tac_gia"]);
  const cUrlNopBai = getCol(["url_nop_bai_truc_tuyen", "submission_url", "cong_nop_bai", "link_nop_bai"]);
  const cEmail = getCol(["email_toa_soan", "editorial_email", "email", "lien_he"]);
  const cPhone = getCol(["so_dien_thoai_toa_soan", "contact_phone", "dien_thoai", "hotline"]);
  const cDiaChi = getCol(["dia_chi_toa_soan", "dia_chi"]);
  const cWebsiteChuQuan = getCol(["website_co_quan_chu_quan"]);
  const cLoaiWebsite = getCol(["loai_he_thong_website"]);

  // Verification
  const cXacMinhWebsite = getCol(["xac_minh_website", "website_verified"]);
  const cXacMinhTheLe = getCol(["xac_minh_the_le"]);
  const cNgayXacMinh = getCol(["ngay_xac_minh", "verification_date"]);
  const cNguonDoiSoat = getCol(["nguon_doi_soat", "source_reference", "nguon_xac_minh", "van_ban_can_cu"]);
  const cDoTinCay = getCol(["do_tin_cay_nguon"]);
  const cCanAdminKiemTra = getCol(["can_admin_kiem_tra_thu_cong"]);
  const cLyDoKiemTra = getCol(["ly_do_kiem_tra_thu_cong"]);
  const cGhiChuKiemChung = getCol(["ghi_chu_kiem_chung", "verification_notes"]);
  const cVerifStatus = getCol(["verification_status", "trang_thai_kiem_chung", "trang_thai"]);

  const validJournals: Journal[] = [];
  const warnings: string[] = [];
  let manualReviewCount = 0;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row.c)) continue;

    const getVal = (idx: number): string => {
      if (idx < 0 || idx >= row.c.length) return "";
      const cell = row.c[idx];
      if (!cell) return "";
      if (cell.f !== undefined && cell.f !== null) return String(cell.f).trim();
      if (cell.v !== undefined && cell.v !== null) return String(cell.v).trim();
      return "";
    };

    let journalId = getVal(cJournalId);
    const name = getVal(cName);

    if (!name && !journalId) continue;

    if (!name) {
      warnings.push(`Dòng ${r + 2}: Thiếu tên tạp chí, đã bỏ qua.`);
      continue;
    }

    if (!journalId) {
      journalId = `TC-${(r + 1).toString().padStart(3, "0")}`;
    }

    const hostAgency = getVal(cHostAgency);
    const pubAgency = getVal(cPublisher);
    const publisher =
      pubAgency && hostAgency && pubAgency !== hostAgency
        ? `${pubAgency} (${hostAgency})`
        : pubAgency || hostAgency || "Đang cập nhật cơ quan xuất bản";

    const primaryField = getVal(cPrimaryField) || "Văn hóa - Nghệ thuật";

    // Score resolution: check JSON first if present, otherwise use 6-column adapter
    let scores: JournalScoreItem[] = [];
    let maxScore = 0;
    let maxScoreYear = 2025;

    const rawScoresJson = getVal(cScoresJson);
    if (rawScoresJson && (rawScoresJson.startsWith("[") || rawScoresJson.startsWith("{"))) {
      scores = parseScoresJson(rawScoresJson, { maxScore: 0, maxScoreYear: 2025, primaryField });
      maxScore = scores.length > 0 ? Math.max(...scores.map((s) => s.maxScore)) : 0;
      maxScoreYear = scores.length > 0 ? scores[0].year : 2025;
    } else {
      const adapted = parseScoreAdapter({
        nhomNganhRaw: getVal(cNhomNganh),
        tenNhomRaw: getVal(cTenNhom),
        phanLoaiRaw: getVal(cPhanLoai),
        diem2025Raw: getVal(cDiem2025),
        cacMocRaw: getVal(cCacMocDiem),
        ghiChuRaw: getVal(cGhiChuDiem),
        fallbackField: primaryField,
      });
      scores = adapted.scores;
      maxScore = adapted.maxScore;
      maxScoreYear = adapted.maxScoreYear;
    }

    // Fields aggregation
    const fieldsSet = new Set<string>();
    fieldsSet.add(primaryField);
    scores.forEach((s) => {
      if (s.councilName) fieldsSet.add(s.councilName);
    });
    const extraFieldsStr = getVal(cFields);
    if (extraFieldsStr) {
      extraFieldsStr.split(/[,;\n]/).forEach((f) => {
        const tr = f.trim();
        if (tr) fieldsSet.add(tr);
      });
    }

    // Website & URLs
    const rawUrlWebsite = getVal(cUrlWebsite);
    const website =
      rawUrlWebsite && (rawUrlWebsite.startsWith("http://") || rawUrlWebsite.startsWith("https://"))
        ? rawUrlWebsite
        : undefined;

    const websiteVerifiedVal = getVal(cXacMinhWebsite).toLowerCase();
    const websiteVerified = Boolean(
      website &&
        (websiteVerifiedVal.includes("đã") ||
          websiteVerifiedVal.includes("da") ||
          websiteVerifiedVal.includes("hợp lệ") ||
          websiteVerifiedVal.includes("verified"))
    );

    // Manual check needed flag (17 official Spark cases)
    const canCheckManualVal = getVal(cCanAdminKiemTra).trim().toUpperCase();
    const isManualCheckNeeded =
      canCheckManualVal.includes("CÓ") ||
      canCheckManualVal.includes("CO") ||
      canCheckManualVal === "1" ||
      canCheckManualVal === "TRUE";
    const manualCheckReason = getVal(cLyDoKiemTra);

    if (isManualCheckNeeded) {
      manualReviewCount++;
    }

    // Guidelines extraction (all 15 items)
    const fileMauVal = getVal(cFileMau);
    const templateUrl =
      fileMauVal && (fileMauVal.startsWith("http://") || fileMauVal.startsWith("https://"))
        ? fileMauVal
        : undefined;

    const nopBaiVal = getVal(cUrlNopBai);
    const submissionUrl =
      nopBaiVal && (nopBaiVal.startsWith("http://") || nopBaiVal.startsWith("https://"))
        ? nopBaiVal
        : undefined;

    const huongDanVal = getVal(cUrlHuongDan);
    const authorGuideUrl =
      huongDanVal && (huongDanVal.startsWith("http://") || huongDanVal.startsWith("https://"))
        ? huongDanVal
        : undefined;

    const guidelinesSummaryParts = [
      getVal(cTheLe),
      getVal(cHinhThucNop) ? `Hình thức nộp: ${getVal(cHinhThucNop)}` : "",
      getVal(cNameHistory) ? `Lịch sử đổi tên: ${getVal(cNameHistory)}` : "",
    ].filter(Boolean);

    const guidelines = parseGuidelinesValue(guidelinesSummaryParts.join("\n\n"), {
      templateUrl,
      submissionUrl: submissionUrl || authorGuideUrl,
      editorialEmail: getVal(cEmail) || undefined,
      contactPhone: getVal(cPhone) || undefined,
      citationStyle: getVal(cChuanTrichDan) || undefined,
      publicationFee: getVal(cPhiApc) || undefined,
      publicationLanguage: getVal(cNgonNguChapNhan) || getVal(cLang) || "Tiếng Việt",
      publicationFrequency: getVal(cFreq) || undefined,
      reviewTimeWeeks: getVal(cThoiGianPb) || undefined,
      manuscriptFormat: getVal(cQuyCach) || undefined,
      pageLimit: getVal(cSoTu) || undefined,
      officeAddress: getVal(cDiaChi) || undefined,
    });

    // Links collection
    const links: JournalLinkItem[] = [];
    if (website) {
      links.push({
        id: `LINK-${journalId}-home`,
        journalId,
        linkType: "Trang chủ",
        label: "Website chính thức",
        url: website,
        isVerified: websiteVerified,
      });
    }
    if (submissionUrl && submissionUrl !== website) {
      links.push({
        id: `LINK-${journalId}-submit`,
        journalId,
        linkType: "Nộp bài",
        label: "Cổng nộp bài trực tuyến",
        url: submissionUrl,
        isVerified: true,
      });
    }

    // Verification structure
    const verificationNotes = [
      getVal(cGhiChuKiemChung),
      isManualCheckNeeded ? `[CẦN KIỂM TRA THỦ CÔNG]: ${manualCheckReason}` : "",
      getVal(cDoTinCay) ? `Độ tin cậy: ${getVal(cDoTinCay)}` : "",
      getVal(cPdfIndex) ? `Số TT PDF QĐ 26: ${getVal(cPdfIndex)}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    const now = new Date().toISOString();
    const verification: JournalVerification = {
      status: isManualCheckNeeded
        ? "needs_update"
        : websiteVerified
        ? "verified"
        : "unverified",
      verifiedBy: "Spark Agent",
      verifiedDate: getVal(cNgayXacMinh) || now.split("T")[0],
      sourceReference: getVal(cNguonDoiSoat) || "Quyết định 26/QĐ-HĐGSNN ngày 11/7/2025",
      notes: verificationNotes || undefined,
      schemaVersion: 1,
      manualReviewNeeded: isManualCheckNeeded,
      manualReviewReason: isManualCheckNeeded ? manualCheckReason : undefined,
      confidenceLevel: getVal(cDoTinCay) || "Cao",
    };

    const journalObj: Journal = {
      id: journalId,
      journalId,
      name,
      englishName: getVal(cEnglishName) || undefined,
      abbreviation: getVal(cAbbr) || undefined,
      publisher,
      issnPrint: normalizeIssn(getVal(cIssnPrint)) || undefined,
      issnOnline: normalizeIssn(getVal(cIssnOnline)) || undefined,
      isbn: getVal(cIsbn) || undefined,
      category: "domestic",
      primaryField,
      fields: Array.from(fieldsSet),
      website,
      websiteVerified,
      maxScore,
      maxScoreYear,
      scores,
      guidelines,
      links,
      verification,
      status: "active",
      isManualEdited: false,
      createdAt: now,
      updatedAt: now,
      createdBy: "Spark Google Sheets Sync",
    };

    validJournals.push(journalObj);
  }

  return {
    sheetId: cleanId,
    sheetName: effectiveSheetName,
    totalRows: rows.length,
    validJournals,
    warnings,
    manualReviewCount,
  };
}

/**
 * Compares two journals to produce a structured diff summary.
 */
export function computeJournalFieldDiffs(
  oldJ: Journal,
  newJ: Journal
): JournalFieldDiff[] {
  const diffs: JournalFieldDiff[] = [];

  const check = (field: string, label: string, oldVal: any, newVal: any) => {
    const oStr = String(oldVal ?? "").trim();
    const nStr = String(newVal ?? "").trim();
    if (oStr !== nStr) {
      diffs.push({
        field,
        label,
        oldValue: oldVal ?? "—",
        newValue: newVal ?? "—",
      });
    }
  };

  check("name", "Tên tạp chí", oldJ.name, newJ.name);
  check("englishName", "Tên tiếng Anh", oldJ.englishName, newJ.englishName);
  check("abbreviation", "Tên viết tắt", oldJ.abbreviation, newJ.abbreviation);
  check("publisher", "Đơn vị xuất bản", oldJ.publisher, newJ.publisher);
  check("issnPrint", "ISSN bản in", oldJ.issnPrint, newJ.issnPrint);
  check("issnOnline", "E-ISSN", oldJ.issnOnline, newJ.issnOnline);
  check("primaryField", "Lĩnh vực chính", oldJ.primaryField, newJ.primaryField);
  check("maxScore", "Điểm tối đa", oldJ.maxScore, newJ.maxScore);
  check("maxScoreYear", "Năm đạt điểm", oldJ.maxScoreYear, newJ.maxScoreYear);
  check("website", "Trang chủ", oldJ.website, newJ.website);

  if (oldJ.scores?.length !== newJ.scores?.length) {
    diffs.push({
      field: "scores",
      label: "Số lượng mốc điểm",
      oldValue: `${oldJ.scores?.length || 0} mục`,
      newValue: `${newJ.scores?.length || 0} mục`,
    });
  }

  if (Boolean(oldJ.guidelines?.hasGuidelines) !== Boolean(newJ.guidelines?.hasGuidelines)) {
    diffs.push({
      field: "guidelines",
      label: "Thể lệ đăng bài",
      oldValue: oldJ.guidelines?.hasGuidelines ? "Có thể lệ" : "Chưa có",
      newValue: newJ.guidelines?.hasGuidelines ? "Có thể lệ" : "Chưa có",
    });
  }

  return diffs;
}

/**
 * Prepares candidate objects for the Review Queue from incoming parsed Google Sheets journals.
 * Identifies:
 * - New journals (changeType: 'create')
 * - Existing journals with modifications (changeType: 'update' + diffSummary)
 * - Existing journals that are unchanged (skipped from queue to avoid clutter)
 * Guarantees IDEMPOTENCY by assigning deterministic IDs:
 *   - cand_new_${incoming.journalId}
 *   - cand_upd_${matched.journalId}
 */
export function buildJournalCandidatesFromSheet(
  incomingJournals: Journal[],
  existingJournals: Journal[],
  existingPendingCandidates: JournalCandidate[] = []
): {
  candidatesToCreate: JournalCandidate[];
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  skippedDuplicates: number;
} {
  const existingById = new Map<string, Journal>();
  const existingByIssn = new Map<string, Journal>();
  const existingByTitle = new Map<string, Journal>();

  existingJournals.forEach((j) => {
    existingById.set(j.journalId, j);
    if (j.id) existingById.set(j.id, j);
    if (j.issnPrint) existingByIssn.set(normalizeIssn(j.issnPrint), j);
    if (j.issnOnline) existingByIssn.set(normalizeIssn(j.issnOnline), j);
    const nTitle = normalizeTitle(j.name);
    if (nTitle) existingByTitle.set(nTitle, j);
  });

  // Track currently active pending candidates to avoid duplicating pending queue items
  const activePendingMap = new Map<string, JournalCandidate>();
  existingPendingCandidates.forEach((c) => {
    if (c.status === "pending" || c.status === "needs_review") {
      activePendingMap.set(c.journalId, c);
    }
  });

  const candidatesToCreate: JournalCandidate[] = [];
  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let skippedDuplicates = 0;

  const seenInBatch = new Set<string>();

  incomingJournals.forEach((incoming, idx) => {
    // Deduplicate within same batch
    if (seenInBatch.has(incoming.journalId)) {
      skippedDuplicates++;
      return;
    }
    seenInBatch.add(incoming.journalId);

    // Identify unverified fields
    const unverifiedFields: string[] = [];
    const isManualCheck = incoming.verification?.manualReviewNeeded === true;
    const manualReason = incoming.verification?.manualReviewReason;

    if (isManualCheck && manualReason) {
      unverifiedFields.push(`Cần kiểm tra thủ công: ${manualReason}`);
    }
    if (!incoming.website) {
      unverifiedFields.push("Chưa có trang chủ");
    } else if (!incoming.websiteVerified) {
      unverifiedFields.push("Trang chủ chưa kiểm chứng");
    }
    if (!incoming.issnPrint && !incoming.issnOnline) {
      unverifiedFields.push("Thiếu cả ISSN và E-ISSN");
    }
    if (!incoming.guidelines?.hasGuidelines) {
      unverifiedFields.push("Chưa có thể lệ đăng bài");
    }
    if (incoming.verification?.status !== "verified") {
      unverifiedFields.push("Chưa kiểm chứng nguồn");
    }

    // Match with existing public journals
    let matched = existingById.get(incoming.journalId);
    if (!matched && incoming.issnPrint) {
      matched = existingByIssn.get(normalizeIssn(incoming.issnPrint));
    }
    if (!matched && incoming.issnOnline) {
      matched = existingByIssn.get(normalizeIssn(incoming.issnOnline));
    }
    if (!matched) {
      const nTitle = normalizeTitle(incoming.name);
      if (nTitle) matched = existingByTitle.get(nTitle);
    }

    const now = new Date().toISOString();
    const candidateStatus = isManualCheck ? "needs_review" : "pending";

    if (!matched) {
      // Case A: Completely NEW journal!
      newCount++;

      // Check if already in pending queue
      const existingPending = activePendingMap.get(incoming.journalId);
      if (existingPending) {
        skippedDuplicates++;
        return;
      }

      // Deterministic ID for idempotency
      const candId = `cand_new_${incoming.journalId}`;

      const candidateDoc: JournalCandidate = {
        id: candId,
        journalId: incoming.journalId,
        name: incoming.name,
        englishName: incoming.englishName,
        abbreviation: incoming.abbreviation,
        publisher: incoming.publisher,
        issnPrint: incoming.issnPrint,
        issnOnline: incoming.issnOnline,
        isbn: incoming.isbn,
        category: incoming.category,
        primaryField: incoming.primaryField,
        fields: incoming.fields,
        website: incoming.website,
        websiteVerified: incoming.websiteVerified,
        maxScore: incoming.maxScore,
        maxScoreYear: incoming.maxScoreYear,
        scores: incoming.scores,
        guidelines: incoming.guidelines,
        links: incoming.links,
        verification: incoming.verification,
        sourceType: "GOOGLE_SHEETS",
        changeType: "create",
        status: candidateStatus,
        unverifiedFields,
        sheetRowIndex: idx + 2,
        createdAt: now,
        updatedAt: now,
      };

      candidatesToCreate.push(candidateDoc);
    } else {
      // Case B: Existing journal matched! Check if any changes
      const diffs = computeJournalFieldDiffs(matched, incoming);

      if (diffs.length === 0) {
        // No changes, data is up-to-date!
        unchangedCount++;
        return;
      }

      // Changes detected!
      // If already has an active pending candidate in queue, skip duplicate
      const existingPending = activePendingMap.get(matched.journalId);
      if (existingPending) {
        skippedDuplicates++;
        return;
      }

      updatedCount++;

      const candId = `cand_upd_${matched.journalId}`;


      const candidateDoc: JournalCandidate = {
        id: candId,
        journalId: matched.journalId,
        name: incoming.name,
        englishName: incoming.englishName,
        abbreviation: incoming.abbreviation,
        publisher: incoming.publisher,
        issnPrint: incoming.issnPrint,
        issnOnline: incoming.issnOnline,
        isbn: incoming.isbn,
        category: incoming.category,
        primaryField: incoming.primaryField,
        fields: incoming.fields,
        website: incoming.website,
        websiteVerified: incoming.websiteVerified,
        maxScore: incoming.maxScore,
        maxScoreYear: incoming.maxScoreYear,
        scores: incoming.scores,
        guidelines: incoming.guidelines,
        links: incoming.links,
        verification: incoming.verification,
        sourceType: "GOOGLE_SHEETS",
        changeType: "update",
        existingJournalId: matched.id || matched.journalId,
        diffSummary: diffs,
        status: candidateStatus,
        isManualPreserved: matched.isManualEdited,
        unverifiedFields,
        sheetRowIndex: idx + 2,
        createdAt: now,
        updatedAt: now,
      };

      candidatesToCreate.push(candidateDoc);
    }
  });

  return {
    candidatesToCreate,
    newCount,
    updatedCount,
    unchangedCount,
    skippedDuplicates,
  };
}
