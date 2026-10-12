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
export const DEFAULT_JOURNAL_SHEET_NAME = "TAP_CHI";
export const EXPECTED_FILE_NAME = "IFA-RH_DANH_MUC_TAP_CHI_HDGSNN";

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
}

/**
 * Normalizes header string to match column names flexibly.
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
 * Extracts sheet ID from input URL or raw ID.
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
 * Safely parse JSON array of scores from cell value.
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

  // If already array
  if (Array.isArray(val)) {
    return val.map((s, idx) => ({
      id: s.id || `PTS-${idx + 1}`,
      councilCode: s.councilCode || s.council_code || "HDGS_CHUNG",
      councilName: s.councilName || s.council_name || fallback.primaryField,
      year: Number(s.year) || fallback.maxScoreYear || 2025,
      maxScore: Number(s.maxScore ?? s.max_score ?? fallback.maxScore),
      minScore: s.minScore !== undefined ? Number(s.minScore) : s.min_score !== undefined ? Number(s.min_score) : undefined,
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
        minScore: s.minScore !== undefined ? Number(s.minScore) : s.min_score !== undefined ? Number(s.min_score) : undefined,
        decisionNumber: s.decisionNumber || s.decision_number || "26/QĐ-HĐGSNN",
        decisionDate: s.decisionDate || s.decision_date || "2025-07-11",
        notes: s.notes || s.ghi_chu || undefined,
      }));
    } catch {
      // Fallback
    }
  }

  // Text string containing number (e.g. "1.0" or "0.75")
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
  }
): JournalGuidelines {
  let guidelines: JournalGuidelines = {
    hasGuidelines: false,
    ...extraCols,
  };

  if (!cellVal) {
    if (extraCols.templateUrl || extraCols.submissionUrl || extraCols.editorialEmail) {
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
        manuscriptFormat: parsed.manuscriptFormat || parsed.dinh_dang,
        wordLimitMin: parsed.wordLimitMin ? Number(parsed.wordLimitMin) : undefined,
        wordLimitMax: parsed.wordLimitMax ? Number(parsed.wordLimitMax) : undefined,
        pageLimit: parsed.pageLimit || parsed.so_trang,
        templateUrl: parsed.templateUrl || extraCols.templateUrl,
        citationStyle: parsed.citationStyle || extraCols.citationStyle,
        publicationLanguage: parsed.publicationLanguage || parsed.ngon_ngu,
        reviewFee: parsed.reviewFee || parsed.phi_phan_bien,
        publicationFee: parsed.publicationFee || extraCols.publicationFee,
        publicationFrequency: parsed.publicationFrequency || parsed.tan_suat,
        reviewTimeWeeks: parsed.reviewTimeWeeks || parsed.thoi_gian_phan_bien,
        submissionUrl: parsed.submissionUrl || extraCols.submissionUrl,
        editorialEmail: parsed.editorialEmail || extraCols.editorialEmail,
        contactPhone: parsed.contactPhone || extraCols.contactPhone,
        officeAddress: parsed.officeAddress || parsed.dia_chi,
      };
    } catch {
      // Fallback
    }
  }

  // Plain text summary
  return {
    hasGuidelines: str.length > 0 && !str.toLowerCase().includes("chưa có"),
    summary: str,
    ...extraCols,
  };
}

/**
 * Fetches and parses Google Sheets single tab TAP_CHI rows via GViz endpoint.
 */
export async function fetchJournalGoogleSheetRows(
  sheetId: string,
  sheetName: string = DEFAULT_JOURNAL_SHEET_NAME,
  { fetchImpl = fetch }: { fetchImpl?: typeof fetch } = {}
): Promise<FetchJournalSheetResult> {
  const cleanId = parseSpreadsheetId(sheetId);
  if (!cleanId) {
    throw new Error(
      "Spreadsheet ID không hợp lệ hoặc để trống. Vui lòng cung cấp Spreadsheet ID do Spark tạo."
    );
  }

  const url = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?sheet=${encodeURIComponent(
    sheetName
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
    throw new Error(
      "Google Sheets không trả về định dạng bảng hợp lệ. Đảm bảo tên tab là '" +
        sheetName +
        "' và file đã được chia sẻ công khai hoặc trong thư mục Khoa."
    );
  }

  const jsonStr = text
    .slice(start + "google.visualization.Query.setResponse(".length)
    .trim()
    .replace(/\);?\s*$/, "");
  const resObj = JSON.parse(jsonStr);

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

  // Find column indices
  const cJournalId = getCol(["journal_id", "ma_tap_chi", "id", "stt"]);
  const cName = getCol(["journal_name", "ten_tap_chi", "name", "ten_tieng_viet", "tap_chi"]);
  const cEnglishName = getCol(["english_name", "ten_tieng_anh", "english"]);
  const cAbbr = getCol(["abbreviation", "ten_viet_tat", "viet_tat"]);
  const cPublisher = getCol(["publisher", "co_quan_xuat_ban", "don_vi_xuat_ban", "chu_quan"]);
  const cIssnPrint = getCol(["issn_print", "issn", "issn_ban_in", "issn_in"]);
  const cIssnOnline = getCol(["issn_online", "e_issn", "eissn", "issn_dien_tu"]);
  const cIsbn = getCol(["isbn"]);
  const cPrimaryField = getCol(["primary_field", "linh_vuc", "linh_vuc_chinh", "chuyen_nganh"]);
  const cFields = getCol(["fields", "nhom_nganh", "cac_hoi_dong", "hoi_dong_nganh"]);
  const cMaxScore = getCol(["max_score", "diem_toi_da", "diem_hdgsnn", "diem"]);
  const cMaxScoreYear = getCol(["max_score_year", "nam_cong_nhan", "nam"]);
  const cScoresJson = getCol(["scores", "diem_hdgsnn", "lich_su_diem", "diem_chi_tiet", "scores_json"]);
  const cWebsite = getCol(["website", "trang_chu", "url", "link_trang_chu"]);
  const cGuidelines = getCol(["guidelines", "the_le_dang_bai", "huong_dan_tac_gia", "the_le", "quy_cach_dang_bai"]);
  const cTemplateUrl = getCol(["template_url", "file_mau", "mau_bai_viet", "link_mau"]);
  const cCitationStyle = getCol(["citation_style", "chuan_trich_dan"]);
  const cPubFee = getCol(["publication_fee", "phi_cong_bo", "phi_xuat_ban", "apc"]);
  const cSubmissionUrl = getCol(["submission_url", "cong_nop_bai", "link_nop_bai", "nop_bai_truc_tuyen"]);
  const cEmail = getCol(["editorial_email", "email_toa_soan", "email", "lien_he"]);
  const cPhone = getCol(["contact_phone", "dien_thoai", "hotline"]);
  const cSourceRef = getCol(["source_reference", "nguon_xac_minh", "van_ban_can_cu"]);
  const cVerifStatus = getCol(["verification_status", "trang_thai_kiem_chung", "trang_thai"]);
  const cVerifNotes = getCol(["verification_notes", "ghi_chu_kiem_chung"]);

  const validJournals: Journal[] = [];
  const warnings: string[] = [];

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

    const getNum = (idx: number): number | undefined => {
      if (idx < 0 || idx >= row.c.length) return undefined;
      const cell = row.c[idx];
      if (!cell) return undefined;
      if (typeof cell.v === "number") return cell.v;
      const str = getVal(idx).replace(",", ".");
      const n = parseFloat(str);
      return isNaN(n) ? undefined : n;
    };

    let journalId = getVal(cJournalId);
    const name = getVal(cName);
    const publisher = getVal(cPublisher) || "Đang cập nhật cơ quan xuất bản";

    // If completely empty row
    if (!name && !journalId) continue;

    if (!name) {
      warnings.push(`Dòng ${r + 2}: Thiếu tên tạp chí, đã bỏ qua.`);
      continue;
    }

    if (!journalId) {
      journalId = `TC-${(r + 1).toString().padStart(3, "0")}`;
    }

    const primaryField = getVal(cPrimaryField) || "Văn hóa - Nghệ thuật";
    const maxScore = getNum(cMaxScore) || 0;
    const maxScoreYear = getNum(cMaxScoreYear) || 2025;

    // Parse scores JSON or fallback
    const rawScores = getVal(cScoresJson);
    const scores = parseScoresJson(rawScores, { maxScore, maxScoreYear, primaryField });

    // Aggregate fields
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

    // Guidelines
    const guidelines = parseGuidelinesValue(getVal(cGuidelines), {
      templateUrl: getVal(cTemplateUrl) || undefined,
      submissionUrl: getVal(cSubmissionUrl) || undefined,
      editorialEmail: getVal(cEmail) || undefined,
      contactPhone: getVal(cPhone) || undefined,
      citationStyle: getVal(cCitationStyle) || undefined,
      publicationFee: getVal(cPubFee) || undefined,
    });

    const website = getVal(cWebsite) || undefined;
    const vStatusRaw = getVal(cVerifStatus).toLowerCase();
    const verificationStatus =
      vStatusRaw.includes("verif") || vStatusRaw.includes("da kiem") || vStatusRaw.includes("hop le")
        ? "verified"
        : vStatusRaw.includes("needs") || vStatusRaw.includes("can")
        ? "needs_update"
        : "unverified";

    const websiteVerified = Boolean(website && website.startsWith("http") && verificationStatus === "verified");

    const now = new Date().toISOString();
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
      maxScore: scores.length > 0 ? Math.max(...scores.map((s) => s.maxScore)) : maxScore,
      maxScoreYear: scores.length > 0 ? scores[0].year : maxScoreYear,
      scores,
      guidelines,
      links: website
        ? [
            {
              id: `LINK-${journalId}-1`,
              journalId,
              linkType: "Trang chủ",
              label: "Website chính thức",
              url: website,
              isVerified: websiteVerified,
            },
          ]
        : [],
      verification: {
        status: verificationStatus,
        verifiedBy: "Spark Agent",
        verifiedDate: now.split("T")[0],
        sourceReference: getVal(cSourceRef) || "Quyết định 26/QĐ-HĐGSNN ngày 11/7/2025",
        notes: getVal(cVerifNotes) || undefined,
        schemaVersion: 1,
      },
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
    sheetName,
    totalRows: rows.length,
    validJournals,
    warnings,
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
  check("publisher", "Cơ quan xuất bản", oldJ.publisher, newJ.publisher);
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

    if (!matched) {
      // Case A: Completely NEW journal!
      newCount++;

      // Check if already in pending queue
      const existingPending = activePendingMap.get(incoming.journalId);
      if (existingPending) {
        skippedDuplicates++;
        return;
      }

      const candidateDoc: JournalCandidate = {
        id: `cand_${incoming.journalId}_${Date.now()}_${idx}`,
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
        status: "pending",
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
      updatedCount++;

      // If already has an identical pending update in queue, skip duplicate
      const existingPending = activePendingMap.get(matched.journalId);
      if (existingPending) {
        skippedDuplicates++;
        return;
      }

      const candidateDoc: JournalCandidate = {
        id: `cand_upd_${matched.journalId}_${Date.now()}_${idx}`,
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
        status: "pending",
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
