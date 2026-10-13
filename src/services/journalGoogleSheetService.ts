import type {
  Journal,
  JournalCategory,
  JournalScoreItem,
  JournalCouncilScore,
  CouncilScoreVerificationStatus,
  SparkScoreReconciliationStatus,
  JournalIdentityMatchStatus,
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
export const DEFAULT_JOURNAL_SHEET_NAME = "TAP_CHI";
export const FALLBACK_JOURNAL_SHEET_NAME = "Trang tính1";
export const EXPECTED_FILE_NAME = "IFA-RH_DANH_MUC_TAP_CHI";
export const PUBLIC_JOURNAL_DATA_SOURCE_LABEL = "Google Sheets IFA-RH";

export const DEFAULT_MULTI_COUNCIL_SPREADSHEET_ID =
  DEFAULT_JOURNAL_SPREADSHEET_ID;
export const DEFAULT_MULTI_COUNCIL_SHEET_NAME = DEFAULT_JOURNAL_SHEET_NAME;
export const EXPECTED_MULTI_COUNCIL_FILE_NAME = EXPECTED_FILE_NAME;

export const DEFAULT_COUNCIL_ID = "HD24";
export const DEFAULT_FACULTY_COUNCIL_ID = "HD24";
export const DEFAULT_COUNCIL_NAME =
  "Văn hóa – Nghệ thuật – Thể dục thể thao (HD24)";

/**
 * Danh mục chuẩn 28 Hội đồng Giáo sư ngành / liên ngành theo QĐ 26/QĐ-HĐGSNN
 */
export const OFFICIAL_HDGSNN_COUNCILS: Record<string, string> = {
  HD01: "Toán học (HD01)",
  HD02: "Vật lý (HD02)",
  HD03: "Cơ khí – Động lực (HD03)",
  HD04: "Điện – Điện tử – Tự động hóa (HD04)",
  HD05: "Công nghệ thông tin (HD05)",
  HD06: "Hóa học – Công nghệ thực phẩm (HD06)",
  HD07: "Khoa học Trái đất – Mỏ (HD07)",
  HD08: "Khoa học Giáo dục (HD08)",
  HD09: "Sinh học (HD09)",
  HD10: "Nông nghiệp – Lâm nghiệp (HD10)",
  HD11: "Thủy lợi (HD11)",
  HD12: "Chăn nuôi – Thú y – Thủy sản (HD12)",
  HD13: "Kinh tế (HD13)",
  HD14: "Luật học (HD14)",
  HD15: "Y học (HD15)",
  HD16: "Dược học (HD16)",
  HD17: "Luyện kim (HD17)",
  HD18: "Giao thông vận tải (HD18)",
  HD19: "Sử học – Khảo cổ học – Dân tộc học / Nhân học (HD19)",
  HD20: "Tâm lý học (HD20)",
  HD21: "Thủy sản (HD21)",
  HD22: "Ngôn ngữ học (HD22)",
  HD23: "Triết học – Xã hội học – Chính trị học (HD23)",
  HD24: "Văn hóa – Nghệ thuật – Thể dục thể thao (HD24)",
  HD25: "Văn học (HD25)",
  HD26: "Khoa học Quân sự (HD26)",
  HD27: "Xây dựng – Kiến trúc (HD27)",
  HD28: "Khoa học An ninh (HD28)",
};

export const OFFICIAL_HDGSNN_COUNCIL_LIST: Array<{ id: string; name: string }> =
  Object.entries(OFFICIAL_HDGSNN_COUNCILS).map(([id, name]) => ({ id, name }));

export const EXTENDED_COUNCIL_NAMES: Record<string, string> = {
  ...OFFICIAL_HDGSNN_COUNCILS,
  HD_DETMAY: "Dệt may / Khoa học ứng dụng (HD_DETMAY)",
};

/**
 * Kiểm tra xem councilId có nằm trong 28 Hội đồng Giáo sư chính thức của QĐ 26/QĐ-HĐGSNN không.
 */
export function isValidOfficialCouncilId(councilId?: string | null): boolean {
  if (!councilId) return false;
  return Boolean(OFFICIAL_HDGSNN_COUNCILS[councilId.trim().toUpperCase()]);
}

/**
 * Chuẩn hóa mã và tên Hội đồng Giáo sư để tránh trùng lặp biến thể tên cho cùng 1 Hội đồng.
 */
export function normalizeCouncilIdentity(
  rawCouncilId?: string | null,
  rawCouncilName?: string | null
): { councilId: string; councilName: string } {
  const code = String(rawCouncilId || "").trim().toUpperCase();
  const name = String(rawCouncilName || "").trim();

  if (code && EXTENDED_COUNCIL_NAMES[code]) {
    return {
      councilId: code,
      councilName: EXTENDED_COUNCIL_NAMES[code],
    };
  }

  // Ánh xạ các mã legacy (NHOM_I..NHOM_V, HDGS_VHNT, HDGS_CHUNG...) hoặc suy luận từ tên Hội đồng
  const search = `${code} ${name}`.toLowerCase();
  if (
    code.startsWith("NHOM_") ||
    code === "HDGS_VHNT" ||
    search.includes("văn hóa") ||
    search.includes("van hoa") ||
    search.includes("nghệ thuật") ||
    search.includes("nghe thuat") ||
    search.includes("mỹ thuật") ||
    search.includes("my thuat") ||
    search.includes("thể dục thể thao") ||
    search.includes("tdtt") ||
    search.includes("du lịch") ||
    search.includes("báo chí, truyền thông")
  ) {
    return {
      councilId: "HD24",
      councilName: OFFICIAL_HDGSNN_COUNCILS.HD24,
    };
  }

  if (
    code === "HDGS_THXHH" ||
    code === "HDGS_TRIETHOC" ||
    search.includes("triết học") ||
    search.includes("xã hội học") ||
    search.includes("chính trị học")
  ) {
    return {
      councilId: "HD23",
      councilName: OFFICIAL_HDGSNN_COUNCILS.HD23,
    };
  }

  if (
    search.includes("sử học") ||
    search.includes("khảo cổ") ||
    search.includes("dân tộc học") ||
    search.includes("nhân học")
  ) {
    return {
      councilId: "HD19",
      councilName: OFFICIAL_HDGSNN_COUNCILS.HD19,
    };
  }

  if (code === "HDGS_GDH" || search.includes("giáo dục")) {
    return {
      councilId: "HD08",
      councilName: OFFICIAL_HDGSNN_COUNCILS.HD08,
    };
  }

  if (search.includes("kinh tế")) {
    return {
      councilId: "HD13",
      councilName: OFFICIAL_HDGSNN_COUNCILS.HD13,
    };
  }

  if (search.includes("luật")) {
    return {
      councilId: "HD14",
      councilName: OFFICIAL_HDGSNN_COUNCILS.HD14,
    };
  }

  if (search.includes("văn học")) {
    return {
      councilId: "HD25",
      councilName: OFFICIAL_HDGSNN_COUNCILS.HD25,
    };
  }

  if (search.includes("xây dựng") || search.includes("kiến trúc") || search.includes("quy hoạch")) {
    return {
      councilId: "HD27",
      councilName: OFFICIAL_HDGSNN_COUNCILS.HD27,
    };
  }

  if (search.includes("cơ khí") || search.includes("động lực")) {
    return {
      councilId: "HD03",
      councilName: OFFICIAL_HDGSNN_COUNCILS.HD03,
    };
  }

  if (search.includes("dệt may") || search.includes("thời trang")) {
    return {
      councilId: "HD_DETMAY",
      councilName: EXTENDED_COUNCIL_NAMES.HD_DETMAY,
    };
  }

  if (code === "HDGS_CHUNG") {
    return {
      councilId: "HD24",
      councilName: OFFICIAL_HDGSNN_COUNCILS.HD24,
    };
  }

  const fallbackId = code || "HD24";
  return {
    councilId: fallbackId,
    councilName: name ? `${name} (${fallbackId})` : OFFICIAL_HDGSNN_COUNCILS.HD24,
  };
}

/**
 * Tạo khóa phức hợp (Composite Key) duy nhất cho mỗi bản ghi điểm Hội đồng:
 * council_id + decision_number + decision_year + source_order + publication_type + conditions + valid_from
 */
export function buildCouncilScoreCompositeKey(score: Partial<JournalCouncilScore>): string {
  const parts = [
    String(score.councilId || "").trim().toUpperCase(),
    String(score.decisionNumber || "").trim(),
    String(score.decisionYear || "").trim(),
    String(score.sourceOrder || "").trim(),
    String(score.publicationType || "").trim().toUpperCase(),
    String(score.conditions || "").trim(),
    String(score.validFrom || "").trim(),
  ];
  return parts.join("__");
}

/**
 * Phân tích giá trị số điểm an toàn: phân biệt rõ 0 (dừng tính điểm) và null (chưa có dữ liệu).
 * Tuyệt đối KHÔNG dùng `parseFloat(val) || 0`.
 */
export function parseNullableScoreNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") {
    return Number.isFinite(val) && val >= 0 ? val : null;
  }
  const str = String(val).trim();
  if (!str || str.toLowerCase() === "null" || str.toLowerCase() === "n/a" || str === "—") {
    return null;
  }
  const normalized = str.replace(",", ".");
  const parsed = Number(normalized);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  return null;
}

export interface MultiCouncilJsonParseResult {
  councilScores: JournalCouncilScore[];
  scores: JournalScoreItem[];
  maxScore: number;
  maxScoreYear: number;
  warnings: string[];
  needsManualReview: boolean;
  reconciliationStatus: SparkScoreReconciliationStatus;
}

/**
 * Phân tích và kiểm tra nghiêm ngặt cột `diem_theo_hoi_dong_json` (Cột 48 / index 47 trong bảng 53 cột).
 * Áp dụng đầy đủ 10 quy tắc kiểm tra dữ liệu ở Mục V:
 * - JSON hợp lệ và là mảng
 * - Có đủ council_id, council_name, decision_number, decision_year, verification_status
 * - Chống trùng bản ghi điểm theo composite key
 * - Kiểm tra council_id thuộc 28 HĐGSNN
 * - Phân biệt rõ max_score = 0 vs max_score = null (không dùng || 0)
 * - Kiểm tra decision_year hợp lệ
 * - Kiểm tra source_url hợp lệ
 * - Nếu verification_status === "VERIFIED" nhưng thiếu phụ lục QĐ 26/QĐ-HĐGSNN -> tự động chuyển sang "NEEDS_REVIEW"
 * - Đối chiếu so_hoi_dong_cong_nhan với số Hội đồng thực tế trong JSON
 */
export function parseMultiCouncilScoresJson(
  rawJson: unknown,
  options: {
    expectedCouncilCount?: number | string | null;
    rawSparkStatus?: string | null;
    fallbackField?: string;
    journalId?: string;
  } = {}
): MultiCouncilJsonParseResult {
  const warnings: string[] = [];
  let needsManualReview = false;

  const rawStatusNorm = String(options.rawSparkStatus || "")
    .trim()
    .toUpperCase();
  if (rawStatusNorm === "CAN_KIEM_TRA") {
    needsManualReview = true;
  }

  if (rawJson === null || rawJson === undefined || String(rawJson).trim() === "") {
    warnings.push("Thiếu dữ liệu diem_theo_hoi_dong_json.");
    return {
      councilScores: [],
      scores: [],
      maxScore: 0,
      maxScoreYear: 2025,
      warnings,
      needsManualReview: true,
      reconciliationStatus: "CHUA_XAC_MINH",
    };
  }

  let parsedArr: any[];
  if (Array.isArray(rawJson)) {
    parsedArr = rawJson;
  } else {
    const str = String(rawJson).trim();
    try {
      const parsed = JSON.parse(str);
      if (!Array.isArray(parsed)) {
        warnings.push("diem_theo_hoi_dong_json không phải là mảng JSON hợp lệ.");
        return {
          councilScores: [],
          scores: [],
          maxScore: 0,
          maxScoreYear: 2025,
          warnings,
          needsManualReview: true,
          reconciliationStatus: "CAN_KIEM_TRA",
        };
      }
      parsedArr = parsed;
    } catch (err: any) {
      warnings.push(`Lỗi cú pháp JSON trong diem_theo_hoi_dong_json: ${err?.message || "Invalid JSON"}`);
      return {
        councilScores: [],
        scores: [],
        maxScore: 0,
        maxScoreYear: 2025,
        warnings,
        needsManualReview: true,
        reconciliationStatus: "CAN_KIEM_TRA",
      };
    }
  }

  const seenCompositeKeys = new Set<string>();
  const councilScores: JournalCouncilScore[] = [];

  parsedArr.forEach((rawItem, idx) => {
    if (!rawItem || typeof rawItem !== "object") {
      warnings.push(`Phần tử điểm thứ ${idx + 1} không phải object hợp lệ.`);
      needsManualReview = true;
      return;
    }

    const rawCouncilId = String(rawItem.council_id ?? rawItem.councilId ?? "").trim();
    const rawCouncilName = String(rawItem.council_name ?? rawItem.councilName ?? "").trim();
    const rawDecisionNumber = String(rawItem.decision_number ?? rawItem.decisionNumber ?? "").trim();
    const rawDecisionYear = rawItem.decision_year ?? rawItem.decisionYear;
    const rawVerifStatus = String(
      rawItem.verification_status ?? rawItem.verificationStatus ?? ""
    )
      .trim()
      .toUpperCase();

    if (!rawCouncilId || !rawCouncilName || !rawDecisionNumber || !rawDecisionYear || !rawVerifStatus) {
      warnings.push(
        `Phần tử điểm thứ ${idx + 1} thiếu trường bắt buộc (council_id, council_name, decision_number, decision_year hoặc verification_status).`
      );
      needsManualReview = true;
    }

    const { councilId, councilName } = normalizeCouncilIdentity(rawCouncilId, rawCouncilName);

    // Kiểm tra council_id có thuộc danh mục 28 HĐGSNN chính thức không
    const isOfficialCouncil = isValidOfficialCouncilId(councilId);
    if (!isOfficialCouncil) {
      warnings.push(
        `Mã Hội đồng "${councilId}" (${rawCouncilName}) không nằm trong danh sách 28 HĐGSNN chuẩn theo QĐ 26/QĐ-HĐGSNN.`
      );
      needsManualReview = true;
    }

    // Kiểm tra decision_year
    const yearNum = Number(rawDecisionYear);
    const validYear = Number.isInteger(yearNum) && yearNum >= 1990 && yearNum <= 2100;
    const decisionYear = validYear ? yearNum : 2025;
    if (!validYear) {
      warnings.push(`Năm quyết định "${rawDecisionYear}" không hợp lệ tại Hội đồng ${councilId}.`);
      needsManualReview = true;
    }

    // Phân tích min_score và max_score (phân biệt rõ 0 và null!)
    const minScore = parseNullableScoreNumber(rawItem.min_score ?? rawItem.minScore);
    let maxScore = parseNullableScoreNumber(rawItem.max_score ?? rawItem.maxScore);
    const conditionsStr =
      rawItem.conditions !== undefined && rawItem.conditions !== null
        ? String(rawItem.conditions).trim()
        : null;

    // Kiểm tra nếu max_score âm hoặc không hợp lệ
    const rawMaxVal = rawItem.max_score ?? rawItem.maxScore;
    if (
      rawMaxVal !== null &&
      rawMaxVal !== undefined &&
      String(rawMaxVal).trim() !== "" &&
      maxScore === null
    ) {
      warnings.push(`Giá trị max_score "${rawMaxVal}" không hợp lệ tại Hội đồng ${councilId}.`);
      needsManualReview = true;
    }

    // Nếu maxScore là null (chưa xác định mức điểm hoặc có nhiều nhóm ngành cần tách như J_020, J_067, J_069, J_071)
    if (maxScore === null) {
      warnings.push(
        `Mức điểm tối đa (max_score) tại Hội đồng ${councilId} đang để trống (null) — cần Admin kiểm tra điều kiện: "${
          conditionsStr || "Chưa rõ"
        }".`
      );
      needsManualReview = true;
    }

    // Kiểm tra source_url nếu có
    const rawSourceUrl =
      rawItem.source_url !== undefined && rawItem.source_url !== null
        ? String(rawItem.source_url).trim()
        : null;
    if (
      rawSourceUrl &&
      !rawSourceUrl.startsWith("http://") &&
      !rawSourceUrl.startsWith("https://")
    ) {
      warnings.push(`source_url "${rawSourceUrl}" không đúng định dạng URL hợp lệ.`);
      needsManualReview = true;
    }

    const sourcePage =
      rawItem.source_page !== undefined && rawItem.source_page !== null
        ? String(rawItem.source_page).trim()
        : null;

    // Quy tắc 8 Mục V: Một dòng có verification_status = VERIFIED nhưng không có phụ lục QĐ 26/QĐ-HĐGSNN phải tự động chuyển sang NEEDS_REVIEW
    let verificationStatus: CouncilScoreVerificationStatus =
      rawVerifStatus === "VERIFIED"
        ? "VERIFIED"
        : rawVerifStatus === "NEEDS_REVIEW"
        ? "NEEDS_REVIEW"
        : "UNVERIFIED";

    const hasQD26 = /26\/QĐ-HĐGSNN/i.test(rawDecisionNumber);
    const hasPhuLuc = /phụ\s*lục/i.test(String(sourcePage || ""));
    if (verificationStatus === "VERIFIED" && (!hasQD26 || !hasPhuLuc || !isOfficialCouncil)) {
      verificationStatus = "NEEDS_REVIEW";
      needsManualReview = true;
      warnings.push(
        `Mức điểm tại ${councilId} ghi nhận VERIFIED nhưng chưa có căn cứ Phụ lục QĐ 26/QĐ-HĐGSNN (${rawDecisionNumber} / ${
          sourcePage || "Không rõ trang"
        }) -> đã tự động chuyển sang NEEDS_REVIEW.`
      );
    }

    const scoreItem: JournalCouncilScore = {
      councilId,
      councilName,
      rawCouncilName: rawCouncilName || undefined,
      decisionNumber: rawDecisionNumber || "26/QĐ-HĐGSNN",
      decisionYear,
      sourceOrder:
        rawItem.source_order !== undefined && rawItem.source_order !== null
          ? String(rawItem.source_order).trim()
          : rawItem.sourceOrder !== undefined && rawItem.sourceOrder !== null
          ? String(rawItem.sourceOrder).trim()
          : null,
      publicationType:
        rawItem.publication_type !== undefined && rawItem.publication_type !== null
          ? String(rawItem.publication_type).trim()
          : rawItem.publicationType !== undefined && rawItem.publicationType !== null
          ? String(rawItem.publicationType).trim()
          : "PRINT",
      minScore,
      maxScore,
      validFrom:
        rawItem.valid_from !== undefined && rawItem.valid_from !== null
          ? String(rawItem.valid_from).trim()
          : rawItem.validFrom !== undefined && rawItem.validFrom !== null
          ? String(rawItem.validFrom).trim()
          : null,
      validTo:
        rawItem.valid_to !== undefined && rawItem.valid_to !== null
          ? String(rawItem.valid_to).trim()
          : rawItem.validTo !== undefined && rawItem.validTo !== null
          ? String(rawItem.validTo).trim()
          : null,
      conditions: conditionsStr,
      sourceUrl: rawSourceUrl,
      sourcePage,
      verificationStatus,
    };

    const compositeKey = buildCouncilScoreCompositeKey(scoreItem);
    scoreItem.id = compositeKey;

    if (seenCompositeKeys.has(compositeKey)) {
      warnings.push(`Phát hiện bản ghi điểm trùng lặp trong cùng JSON (${compositeKey}), đã loại bỏ bản trùng.`);
      needsManualReview = true;
      return;
    }
    seenCompositeKeys.add(compositeKey);
    councilScores.push(scoreItem);
  });

  // Quy tắc 9 Mục V: So sánh so_hoi_dong_cong_nhan với số lượng Hội đồng thực tế trong JSON
  if (
    options.expectedCouncilCount !== undefined &&
    options.expectedCouncilCount !== null &&
    String(options.expectedCouncilCount).trim() !== ""
  ) {
    const expectedCount = Number(options.expectedCouncilCount);
    const uniqueCouncilsCount = new Set(councilScores.map((c) => c.councilId)).size;
    if (
      Number.isFinite(expectedCount) &&
      expectedCount > 0 &&
      uniqueCouncilsCount !== expectedCount &&
      councilScores.length !== expectedCount
    ) {
      warnings.push(
        `Số Hội đồng công nhận (${expectedCount}) không khớp với số Hội đồng trong JSON (${uniqueCouncilsCount} Hội đồng / ${councilScores.length} mục điểm).`
      );
      needsManualReview = true;
    }
  }

  // Chuyển đổi sang mảng scores (JournalScoreItem[]) tương thích ngược
  const scores: JournalScoreItem[] = councilScores.map((cs, idx) => {
    const noteParts: string[] = [];
    if (cs.publicationType && cs.publicationType !== "PRINT") {
      noteParts.push(`Ấn phẩm: ${cs.publicationType}`);
    }
    if (cs.conditions) {
      noteParts.push(cs.conditions);
    }
    if (cs.sourcePage) {
      noteParts.push(`Nguồn: ${cs.sourcePage}`);
    }
    return {
      id: cs.id || `PTS-${idx + 1}`,
      journalId: options.journalId,
      councilCode: cs.councilId,
      councilName: cs.councilName,
      year: cs.decisionYear,
      maxScore: cs.maxScore ?? 0,
      rawMaxScore: cs.maxScore,
      minScore: cs.minScore ?? 0,
      decisionNumber: cs.decisionNumber,
      decisionDate: `${cs.decisionYear}-07-11`,
      notes: noteParts.join(" | ") || undefined,
      sourceOrder: cs.sourceOrder,
      publicationType: cs.publicationType,
      validFrom: cs.validFrom,
      validTo: cs.validTo,
      conditions: cs.conditions,
      sourceUrl: cs.sourceUrl,
      sourcePage: cs.sourcePage,
      verificationStatus: cs.verificationStatus,
    };
  });

  const numericMaxScores = councilScores
    .map((c) => c.maxScore)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const maxScore = numericMaxScores.length > 0 ? Math.max(...numericMaxScores) : 0;
  const maxScoreYear =
    councilScores.length > 0
      ? Math.max(...councilScores.map((c) => c.decisionYear || 2025))
      : 2025;

  let reconciliationStatus: SparkScoreReconciliationStatus = "HOAN_TAT";
  if (councilScores.length === 0 || rawStatusNorm === "CHUA_XAC_MINH") {
    reconciliationStatus = "CHUA_XAC_MINH";
  } else if (
    needsManualReview ||
    rawStatusNorm === "CAN_KIEM_TRA" ||
    councilScores.some((c) => c.verificationStatus !== "VERIFIED" || c.maxScore === null)
  ) {
    reconciliationStatus = "CAN_KIEM_TRA";
  }

  return {
    councilScores,
    scores,
    maxScore,
    maxScoreYear,
    warnings,
    needsManualReview: reconciliationStatus !== "HOAN_TAT",
    reconciliationStatus,
  };
}

export interface ParsedGoogleSheetJournalRow {
  rowIndex: number;
  journal: Journal;
  rawScoresJson?: string;
  parseWarnings: string[];
}

export interface FetchJournalSheetResult {
  sheetId: string;
  sheetName: string;
  sourceSpreadsheetId: string;
  sourceSheetName: string;
  totalRows: number;
  validJournals: Journal[];
  warnings: string[];
  manualReviewCount: number;
  usedFallbackSheet?: boolean;
  usedFallbackCatalogSheet: boolean;
  fallbackNotice?: string;
  multiCouncilStats: {
    rowsWithJson: number;
    totalCouncilEntries: number;
    totalCouncilRecords: number;
    multiCouncilJournalsCount: number;
    diffScoreAcrossCouncilsCount: number;
    diffScoreJournalsCount: number;
    reconciliationCounts: {
      HOAN_TAT: number;
      CAN_KIEM_TRA: number;
      CHUA_XAC_MINH: number;
    };
    hoanTatCount: number;
    canKiemTraCount: number;
    chuaXacMinhCount: number;
  };
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
 * Ensures the application only reads from the public IFA-RH Google Sheet
 * (`1QJKvNd7s0eZpr8HiO_FYGi5HQF3sHhlqR6_G5SODXWE`). Any legacy reference to
 * Spark's private research sheet is automatically redirected to the public IFA-RH sheet.
 */
export function sanitizePublicJournalSpreadsheetId(input?: string | null): string {
  const parsed = parseSpreadsheetId(input);
  if (!parsed || parsed.startsWith("1KqLzOaUsynoMd7o")) {
    return DEFAULT_JOURNAL_SPREADSHEET_ID;
  }
  return parsed;
}

/**
 * Normalizes sheet tab name, redirecting legacy "Untitled" tab references to "TAP_CHI".
 */
export function sanitizePublicJournalSheetName(input?: string | null): string {
  const trimmed = String(input || "").trim();
  if (!trimmed || trimmed.toLowerCase() === "untitled") {
    return DEFAULT_JOURNAL_SHEET_NAME;
  }
  return trimmed;
}

const FORMULA_ERROR_TOKENS = [
  "#REF!",
  "#N/A",
  "#ERROR!",
  "#VALUE!",
  "#LOADING!",
  "#LOADING...",
  "#NAME?",
  "#DIV/0!",
  "#NUM!",
];

/**
 * Detects Google Sheets / IMPORTRANGE formula error tokens in a cell or header string.
 */
export function detectFormulaErrorToken(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  for (const token of FORMULA_ERROR_TOKENS) {
    if (upper === token || upper.startsWith(token)) {
      return token;
    }
  }
  if (
    upper.includes("#REF!") ||
    upper.includes("#ERROR!") ||
    upper.includes("#VALUE!") ||
    upper.includes("#LOADING")
  ) {
    return upper.includes("#LOADING")
      ? "#LOADING!"
      : upper.includes("#REF!")
      ? "#REF!"
      : upper.includes("#ERROR!")
      ? "#ERROR!"
      : "#VALUE!";
  }
  return null;
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
      councilCode: s.councilCode || s.council_code || s.council_id || "HDGS_CHUNG",
      councilName: s.councilName || s.council_name || fallback.primaryField,
      year: Number(s.year || s.decision_year) || fallback.maxScoreYear || 2025,
      maxScore: Number(s.maxScore ?? s.max_score ?? fallback.maxScore),
      minScore:
        s.minScore !== undefined
          ? Number(s.minScore)
          : s.min_score !== undefined
          ? Number(s.min_score)
          : undefined,
      decisionNumber: s.decisionNumber || s.decision_number || "26/QĐ-HĐGSNN",
      decisionDate: s.decisionDate || s.decision_date || "2025-07-11",
      notes: s.notes || s.conditions || s.ghi_chu || undefined,
    }));
  }

  const str = String(val).trim();
  if (str.startsWith("[") || str.startsWith("{")) {
    try {
      const parsed = JSON.parse(str);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      return arr.map((s, idx) => ({
        id: s.id || `PTS-${idx + 1}`,
        councilCode: s.councilCode || s.council_code || s.council_id || "HDGS_CHUNG",
        councilName: s.councilName || s.council_name || fallback.primaryField,
        year: Number(s.year || s.decision_year) || fallback.maxScoreYear || 2025,
        maxScore: Number(s.maxScore ?? s.max_score ?? fallback.maxScore),
        minScore:
          s.minScore !== undefined
            ? Number(s.minScore)
            : s.min_score !== undefined
            ? Number(s.min_score)
            : undefined,
        decisionNumber: s.decisionNumber || s.decision_number || "26/QĐ-HĐGSNN",
        decisionDate: s.decisionDate || s.decision_date || "2025-07-11",
        notes: s.notes || s.conditions || s.ghi_chu || undefined,
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
 * Fetches and parses Google Sheets rows via GViz endpoint.
 * Supports primary tab "TAP_CHI", fallback "Trang tính1", and "Untitled".
 * Fully parses all 47 base columns AND the 6 new multi-council score columns (53 columns total).
 */
export interface FetchJournalSheetOptions {
  fetchImpl?: typeof fetch;
  requireMultiCouncilColumns?: boolean;
  previousValidRowCount?: number;
}

/**
 * Fetches and parses Google Sheets rows via GViz endpoint from the single public IFA-RH Sheet
 * (`1QJKvNd7s0eZpr8HiO_FYGi5HQF3sHhlqR6_G5SODXWE`, primary tab `TAP_CHI`).
 * Performs strict IMPORTRANGE readiness and data integrity validation before returning records.
 */
export async function fetchJournalGoogleSheetRows(
  sheetId: string = DEFAULT_JOURNAL_SPREADSHEET_ID,
  sheetName: string = DEFAULT_JOURNAL_SHEET_NAME,
  options: FetchJournalSheetOptions = {}
): Promise<FetchJournalSheetResult> {
  const {
    fetchImpl = fetch,
    requireMultiCouncilColumns = false,
    previousValidRowCount,
  } = options;

  const cleanId = sanitizePublicJournalSpreadsheetId(sheetId);
  let effectiveSheetName = sanitizePublicJournalSheetName(sheetName);

  const tryFetchGviz = async (targetTab: string) => {
    const url = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?sheet=${encodeURIComponent(
      targetTab
    )}&tqx=out:json&headers=1&_t=${Date.now()}`;
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(25000) });
    if (!response.ok) {
      throw new Error(
        `Lỗi kết nối Google Sheets IFA-RH (HTTP ${response.status}: ${response.statusText}, Tab: ${targetTab}). Vui lòng kiểm tra quyền chia sẻ công khai của Sheet IFA-RH và thử lại.`
      );
    }
    const text = await response.text();
    const start = text.indexOf("google.visualization.Query.setResponse(");
    if (start < 0) {
      throw new Error("Google Sheets IFA-RH không trả về định dạng bảng hợp lệ.");
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
    // Try fallback tabs within the same public IFA-RH spreadsheet
    const fallbackCandidates = ["TAP_CHI", "Trang tính1"].filter(
      (t) => t !== effectiveSheetName
    );
    let recovered = false;
    for (const altTab of fallbackCandidates) {
      try {
        const candidateRes = await tryFetchGviz(altTab);
        if (candidateRes.status === "ok" && candidateRes.table) {
          resObj = candidateRes;
          effectiveSheetName = altTab;
          recovered = true;
          break;
        }
      } catch {
        // continue trying next fallback tab
      }
    }
    if (!recovered) {
      throw primaryErr;
    }
  }

  if (resObj.status !== "ok" || !resObj.table) {
    throw new Error(
      `Lỗi bảng tính Google Sheets IFA-RH: ${resObj.errors?.[0]?.message || resObj.status || "Không có dữ liệu"}`
    );
  }

  const cols = resObj.table.cols || [];
  const rows = resObj.table.rows || [];

  // 1. Validate non-empty table (IMPORTRANGE readiness)
  if (cols.length === 0 || rows.length === 0) {
    throw new Error(
      "Sheet IFA-RH chưa tải xong dữ liệu IMPORTRANGE hoặc đang có lỗi công thức (bảng dữ liệu trống). Vui lòng kiểm tra Google Sheets và thử lại."
    );
  }

  // 2. Check column headers for formula error tokens (#REF!, #LOADING!, #ERROR!, #N/A, #VALUE!)
  for (let c = 0; c < cols.length; c++) {
    const rawHeader = String(cols[c]?.label || cols[c]?.id || "").trim();
    const headerErr = detectFormulaErrorToken(rawHeader);
    if (headerErr) {
      throw new Error(
        `Sheet IFA-RH chưa tải xong dữ liệu IMPORTRANGE hoặc đang có lỗi công thức (${headerErr} tại tiêu đề cột ${c + 1}). Vui lòng kiểm tra Google Sheets và thử lại.`
      );
    }
  }

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

  // 47 base column indexes
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

  // Legacy 6-column Scores
  const cNhomNganh = getCol(["nhom_nganh_hdgsnn"]);
  const cTenNhom = getCol(["ten_nhom_nganh"]);
  const cPhanLoai = getCol(["phan_loai_an_pham"]);
  const cDiem2025 = getCol(["diem_toi_da_2025", "max_score", "diem_toi_da"]);
  const cCacMocDiem = getCol(["cac_moc_thay_doi_diem", "lich_su_diem"]);
  const cGhiChuDiem = getCol(["ghi_chu_diem_hdgsnn"]);
  const cScoresJson = getCol(["scores", "scores_json", "diem_hdgsnn_json"]);
  const cFields = getCol(["fields", "nhom_nganh", "cac_hoi_dong", "hoi_dong_nganh"]);

  // 6 NEW Multi-Council Score Columns (Columns 48..53 / AV..BA)
  const cDiemTheoHoiDongJson = getCol(["diem_theo_hoi_dong_json"]);
  const cSoHoiDongCongNhan = getCol(["so_hoi_dong_cong_nhan"]);
  const cHoiDongDaXacMinh = getCol(["hoi_dong_da_xac_minh"]);
  const cNamQuyetDinh = getCol(["nam_quyet_dinh"]);
  const cTrangThaiDoiSoatDiem = getCol(["trang_thai_doi_soat_diem"]);
  const cNguonDiemTheoHoiDong = getCol(["nguon_diem_theo_hoi_dong"]);

  // 3. Validate required columns exist
  if (cJournalId < 0 || cName < 0) {
    throw new Error(
      "Sheet IFA-RH chưa tải xong dữ liệu IMPORTRANGE hoặc đang có lỗi công thức (thiếu cột bắt buộc journal_id, ten_chinh_thuc_vn). Vui lòng kiểm tra Google Sheets và thử lại."
    );
  }

  if (
    requireMultiCouncilColumns &&
    (cDiemTheoHoiDongJson < 0 ||
      cSoHoiDongCongNhan < 0 ||
      cHoiDongDaXacMinh < 0 ||
      cNamQuyetDinh < 0 ||
      cTrangThaiDoiSoatDiem < 0 ||
      cNguonDiemTheoHoiDong < 0)
  ) {
    throw new Error(
      "Sheet IFA-RH chưa có đủ các cột điểm đa Hội đồng (AV:BA - diem_theo_hoi_dong_json...). Vui lòng kiểm tra công thức IMPORTRANGE trên Google Sheets và thử lại."
    );
  }

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
  const seenSheetJournalIds = new Map<string, number>();
  let seenEmptyRowAt: number | null = null;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const rowNumber = r + 2;

    if (!row || !Array.isArray(row.c)) {
      seenEmptyRowAt = seenEmptyRowAt ?? rowNumber;
      continue;
    }

    // 4. Scan all cells in the row for formula error values (#REF!, #N/A, #ERROR!, #VALUE!, #LOADING!)
    let hasAnyNonEmptyCell = false;
    for (let cIdx = 0; cIdx < row.c.length; cIdx++) {
      const cell = row.c[cIdx];
      if (!cell) continue;
      const cellFormatted = cell.f !== undefined && cell.f !== null ? String(cell.f).trim() : "";
      const cellRaw = cell.v !== undefined && cell.v !== null ? String(cell.v).trim() : "";
      if (cellFormatted || cellRaw) {
        hasAnyNonEmptyCell = true;
      }
      const errToken = detectFormulaErrorToken(cellFormatted) || detectFormulaErrorToken(cellRaw);
      if (errToken) {
        throw new Error(
          `Sheet IFA-RH chưa tải xong dữ liệu IMPORTRANGE hoặc đang có lỗi công thức (${errToken} tại dòng ${rowNumber}, cột ${cIdx + 1}). Vui lòng kiểm tra Google Sheets và thử lại.`
        );
      }
    }

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

    if (!name && !journalId) {
      if (hasAnyNonEmptyCell) {
        throw new Error(
          `Sheet IFA-RH chưa tải xong dữ liệu IMPORTRANGE hoặc có dòng dữ liệu khuyết mã và tên tạp chí tại dòng ${rowNumber}. Vui lòng kiểm tra Google Sheets và thử lại.`
        );
      }
      seenEmptyRowAt = seenEmptyRowAt ?? rowNumber;
      continue;
    }

    // Detect abnormal empty row in the middle of the table followed by data rows
    if (seenEmptyRowAt !== null) {
      throw new Error(
        `Sheet IFA-RH chưa tải xong dữ liệu IMPORTRANGE hoặc có dòng trống bất thường tại dòng ${seenEmptyRowAt} (trước dòng dữ liệu ${rowNumber}). Vui lòng kiểm tra Google Sheets và thử lại.`
      );
    }

    if (!name) {
      throw new Error(
        `Sheet IFA-RH chưa tải xong dữ liệu IMPORTRANGE hoặc thiếu tên tạp chí tại dòng ${rowNumber} (mã ${journalId}). Vui lòng kiểm tra Google Sheets và thử lại.`
      );
    }

    if (!journalId) {
      journalId = `TC-${(r + 1).toString().padStart(3, "0")}`;
    }

    // 5. Check duplicate journal_id in the same Sheet
    if (seenSheetJournalIds.has(journalId)) {
      throw new Error(
        `Phát hiện trùng mã tạp chí journal_id "${journalId}" trong cùng Sheet IFA-RH (dòng ${seenSheetJournalIds.get(
          journalId
        )} và dòng ${rowNumber}). Vui lòng kiểm tra Google Sheets và thử lại.`
      );
    }
    seenSheetJournalIds.set(journalId, rowNumber);

    const hostAgency = getVal(cHostAgency);
    const pubAgency = getVal(cPublisher);
    const publisher =
      pubAgency && hostAgency && pubAgency !== hostAgency
        ? `${pubAgency} (${hostAgency})`
        : pubAgency || hostAgency || "Đang cập nhật cơ quan xuất bản";

    const primaryField = getVal(cPrimaryField) || "Văn hóa - Nghệ thuật";
    const nameHistory = getVal(cNameHistory) || undefined;

    // Score resolution: Prefer 53-column `diem_theo_hoi_dong_json` if present
    let scores: JournalScoreItem[] = [];
    let councilScores: JournalCouncilScore[] = [];
    let maxScore = 0;
    let maxScoreYear = 2025;
    let scoreReconciliationStatus: SparkScoreReconciliationStatus = "HOAN_TAT";
    let rowScoreWarnings: string[] = [];

    const rawMultiCouncilJson = getVal(cDiemTheoHoiDongJson);
    const rawSoHoiDong = getVal(cSoHoiDongCongNhan);
    const rawHoiDongVerified = getVal(cHoiDongDaXacMinh);
    const rawNamQuyetDinh = getVal(cNamQuyetDinh);
    const rawTrangThaiDoiSoat = getVal(cTrangThaiDoiSoatDiem);
    const rawNguonDiem = getVal(cNguonDiemTheoHoiDong);

    // 6. Validate diem_theo_hoi_dong_json parseability
    if (requireMultiCouncilColumns && !rawMultiCouncilJson) {
      throw new Error(
        `Dữ liệu điểm Hội đồng trong cột diem_theo_hoi_dong_json bị trống tại dòng ${rowNumber} (${journalId}). Có thể IMPORTRANGE chưa tải xong dữ liệu. Vui lòng kiểm tra Google Sheets và thử lại.`
      );
    }

    if (rawMultiCouncilJson) {
      let parsedCheck: any;
      try {
        parsedCheck = JSON.parse(rawMultiCouncilJson);
      } catch {
        throw new Error(
          `Dữ liệu điểm Hội đồng trong cột diem_theo_hoi_dong_json không hợp lệ tại dòng ${rowNumber} (${journalId}). Vui lòng kiểm tra Google Sheets và thử lại.`
        );
      }
      if (!Array.isArray(parsedCheck)) {
        throw new Error(
          `Dữ liệu điểm Hội đồng trong cột diem_theo_hoi_dong_json không hợp lệ tại dòng ${rowNumber} (${journalId}): không phải mảng JSON.`
        );
      }

      const multiParsed = parseMultiCouncilScoresJson(rawMultiCouncilJson, {
        expectedCouncilCount: rawSoHoiDong,
        rawSparkStatus: rawTrangThaiDoiSoat,
        fallbackField: primaryField,
        journalId,
      });
      councilScores = multiParsed.councilScores;
      scores = multiParsed.scores;
      maxScore = multiParsed.maxScore;
      maxScoreYear = multiParsed.maxScoreYear;
      scoreReconciliationStatus = multiParsed.reconciliationStatus;
      rowScoreWarnings = multiParsed.warnings;

      // Fallback maxScore from legacy column if JSON had null max_score (e.g., J_067, J_069, J_071)
      if (maxScore === 0 && councilScores.every((c) => c.maxScore === null)) {
        const legacyAdapted = parseScoreAdapter({
          nhomNganhRaw: getVal(cNhomNganh),
          tenNhomRaw: getVal(cTenNhom),
          phanLoaiRaw: getVal(cPhanLoai),
          diem2025Raw: getVal(cDiem2025),
          cacMocRaw: getVal(cCacMocDiem),
          ghiChuRaw: getVal(cGhiChuDiem),
          fallbackField: primaryField,
        });
        maxScore = legacyAdapted.maxScore;
        maxScoreYear = legacyAdapted.maxScoreYear;
      }
    } else {
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

      // Build councilScores from legacy scores
      councilScores = scores.map((s) => {
        const norm = normalizeCouncilIdentity(s.councilCode, s.councilName);
        const cs: JournalCouncilScore = {
          councilId: norm.councilId,
          councilName: norm.councilName,
          rawCouncilName: s.councilName,
          decisionNumber: s.decisionNumber || "26/QĐ-HĐGSNN",
          decisionYear: s.year || maxScoreYear || 2025,
          publicationType: s.publicationType || "PRINT",
          minScore: s.minScore ?? 0,
          maxScore: s.rawMaxScore !== undefined ? s.rawMaxScore : s.maxScore,
          conditions: s.conditions || s.notes || null,
          sourcePage: "Phụ lục 24",
          verificationStatus: s.verificationStatus || "VERIFIED",
        };
        cs.id = buildCouncilScoreCompositeKey(cs);
        return cs;
      });
    }

    if (rowScoreWarnings.length > 0) {
      rowScoreWarnings.forEach((w) => warnings.push(`${journalId} (${name}): ${w}`));
    }

    // Verified councils list
    const verifiedCouncils = rawHoiDongVerified
      ? rawHoiDongVerified
          .split(/[,;|]/)
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      : Array.from(
          new Set(
            councilScores
              .filter((c) => c.verificationStatus === "VERIFIED")
              .map((c) => c.councilId)
          )
        );

    const recognizedCouncilCount =
      rawSoHoiDong && !isNaN(Number(rawSoHoiDong))
        ? Number(rawSoHoiDong)
        : new Set(councilScores.map((c) => c.councilId)).size;

    // Fields aggregation
    const fieldsSet = new Set<string>();
    fieldsSet.add(primaryField);
    councilScores.forEach((cs) => {
      if (cs.councilName) fieldsSet.add(cs.councilName);
    });
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

    // Manual check needed flag (17 official Spark cases + any multi-council validation warnings)
    const canCheckManualVal = getVal(cCanAdminKiemTra).trim().toUpperCase();
    const isSparkManualCheck =
      canCheckManualVal.includes("CÓ") ||
      canCheckManualVal.includes("CO") ||
      canCheckManualVal === "1" ||
      canCheckManualVal === "TRUE" ||
      rawTrangThaiDoiSoat.toUpperCase() === "CAN_KIEM_TRA";

    const isManualCheckNeeded =
      isSparkManualCheck || scoreReconciliationStatus === "CAN_KIEM_TRA";

    const manualCheckReasonsList = [
      getVal(cLyDoKiemTra),
      ...rowScoreWarnings,
    ].filter(Boolean);
    const manualCheckReason = manualCheckReasonsList.join(" | ");

    if (isSparkManualCheck) {
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
      nameHistory ? `Lịch sử đổi tên: ${nameHistory}` : "",
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
      sourceReference:
        rawNguonDiem || getVal(cNguonDoiSoat) || "Quyết định 26/QĐ-HĐGSNN ngày 11/7/2025",
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
      hostAgency: hostAgency || undefined,
      nameHistory,
      issnPrint: normalizeIssn(getVal(cIssnPrint)) || undefined,
      issnOnline: normalizeIssn(getVal(cIssnOnline)) || undefined,
      isbn: getVal(cIsbn) || undefined,
      category: "domestic",
      primaryField,
      fields: Array.from(fieldsSet).slice(0, 45),
      website,
      websiteVerified,
      maxScore,
      maxScoreYear,
      scores,
      councilScores,
      recognizedCouncilCount,
      verifiedCouncils,
      decisionYear: rawNamQuyetDinh ? Number(rawNamQuyetDinh) || maxScoreYear : maxScoreYear,
      scoreReconciliationStatus,
      scoreSourceNote: rawNguonDiem || undefined,
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

  // 7. Check for empty validJournals or abnormal drop compared to previous valid sync
  if (validJournals.length === 0) {
    throw new Error(
      "Sheet IFA-RH chưa tải xong dữ liệu IMPORTRANGE hoặc không có bản ghi tạp chí hợp lệ nào. Vui lòng kiểm tra Google Sheets và thử lại."
    );
  }

  if (
    typeof previousValidRowCount === "number" &&
    previousValidRowCount > 0 &&
    validJournals.length < Math.ceil(previousValidRowCount * 0.8)
  ) {
    throw new Error(
      `Số lượng bản ghi trên Sheet IFA-RH tụt bất thường (${validJournals.length} bản ghi so với ${previousValidRowCount} bản ghi ở lần đồng bộ hợp lệ trước đó). Có thể IMPORTRANGE chưa tải xong dữ liệu. Vui lòng kiểm tra Google Sheets và thử lại.`
    );
  }

  const rowsWithJson = validJournals.filter((j) => (j.councilScores?.length || 0) > 0).length;
  const totalCouncilRecords = validJournals.reduce(
    (acc, j) => acc + (j.councilScores?.length || 0),
    0
  );
  const multiCouncilJournalsCount = validJournals.filter(
    (j) => (j.recognizedCouncilCount || new Set((j.councilScores || []).map((c) => c.councilId)).size) >= 2
  ).length;
  const diffScoreJournalsCount = validJournals.filter((j) => {
    const numSet = new Set(
      (j.councilScores || [])
        .map((c) => c.maxScore)
        .filter((v): v is number => typeof v === "number")
    );
    return numSet.size >= 2;
  }).length;
  const hoanTatCount = validJournals.filter(
    (j) => j.scoreReconciliationStatus === "HOAN_TAT"
  ).length;
  const canKiemTraCount = validJournals.filter(
    (j) => j.scoreReconciliationStatus === "CAN_KIEM_TRA"
  ).length;
  const chuaXacMinhCount = validJournals.filter(
    (j) => j.scoreReconciliationStatus === "CHUA_XAC_MINH"
  ).length;

  return {
    sheetId: cleanId,
    sheetName: effectiveSheetName,
    sourceSpreadsheetId: cleanId,
    sourceSheetName: effectiveSheetName,
    totalRows: rows.length,
    validJournals,
    warnings,
    manualReviewCount,
    usedFallbackCatalogSheet: false,
    multiCouncilStats: {
      rowsWithJson,
      totalCouncilEntries: totalCouncilRecords,
      totalCouncilRecords,
      multiCouncilJournalsCount,
      diffScoreAcrossCouncilsCount: diffScoreJournalsCount,
      diffScoreJournalsCount,
      reconciliationCounts: {
        HOAN_TAT: hoanTatCount,
        CAN_KIEM_TRA: canKiemTraCount,
        CHUA_XAC_MINH: chuaXacMinhCount,
      },
      hoanTatCount,
      canKiemTraCount,
      chuaXacMinhCount,
    },
  };
}

/**
 * Fetches multi-council HDGSNN 53-column rows from the single public IFA-RH Google Sheet
 * (`1QJKvNd7s0eZpr8HiO_FYGi5HQF3sHhlqR6_G5SODXWE`, tab `TAP_CHI`).
 * Never connects to Spark's private research spreadsheet.
 */
export async function fetchMultiCouncilGoogleSheetRows(
  sheetId: string = DEFAULT_JOURNAL_SPREADSHEET_ID,
  sheetName: string = DEFAULT_JOURNAL_SHEET_NAME,
  options: {
    fetchImpl?: typeof fetch;
    previousValidRowCount?: number;
  } = {}
): Promise<FetchJournalSheetResult> {
  return fetchJournalGoogleSheetRows(
    sanitizePublicJournalSpreadsheetId(sheetId),
    sanitizePublicJournalSheetName(sheetName),
    {
      fetchImpl: options.fetchImpl,
      requireMultiCouncilColumns: true,
      previousValidRowCount: options.previousValidRowCount,
    }
  );
}

export interface JournalIdentityMatchResult {
  status: JournalIdentityMatchStatus;
  matchedJournal?: Journal;
  method: string;
  notes?: string;
}

/**
 * Đối soát định danh tạp chí giữa bảng nguồn mới và danh sách tạp chí hiện có (Mục IV.1 & IV.2).
 * Tuyệt đối không mặc định journal_id là cùng một tạp chí nếu chưa kiểm tra định danh:
 * - So sánh: issnPrint, issnOnline, tên tiếng Việt chuẩn hóa, tên tiếng Anh, đơn vị xuất bản, cơ quan chủ quản, lịch sử đổi tên, website.
 * - Chống gộp nhầm các tạp chí trùng tên chung "Tạp chí Khoa học" nhưng khác trường đại học hoặc khác chuyên san (Bản B vs Bản D).
 */
export function matchJournalIdentity(
  incoming: Journal,
  existingJournals: Journal[]
): JournalIdentityMatchResult {
  const inIssnP = normalizeIssn(incoming.issnPrint || "");
  const inIssnO = normalizeIssn(incoming.issnOnline || "");
  const inNormName = normalizeTitle(incoming.name || "");
  const inBaseName = normalizeTitle((incoming.name || "").split("(")[0]);
  const inNormPub = normalizeTitle(incoming.publisher || "");
  const inNormHost = normalizeTitle(incoming.hostAgency || "");
  const inNormEng = normalizeTitle(incoming.englishName || "");
  const inNormHistory = normalizeTitle(incoming.nameHistory || "");

  const isGenericName =
    inBaseName === "tapchikhoahoc" ||
    inBaseName === "tapchikhoahocvacongnghe" ||
    inBaseName === "tapchikhoahocvacongnghevietnam";

  // 1. Check if there is an existing journal with the same journalId
  const byId = existingJournals.find(
    (j) => j.journalId === incoming.journalId || j.id === incoming.journalId
  );

  // 2. Check by ISSN Print / E-ISSN
  const byIssnP = inIssnP
    ? existingJournals.filter(
        (j) =>
          normalizeIssn(j.issnPrint || "") === inIssnP ||
          normalizeIssn(j.issnOnline || "") === inIssnP
      )
    : [];
  const byIssnO = inIssnO
    ? existingJournals.filter(
        (j) =>
          normalizeIssn(j.issnOnline || "") === inIssnO ||
          normalizeIssn(j.issnPrint || "") === inIssnO
      )
    : [];

  // 3. Check by full normalized Vietnamese title
  const byFullTitle = inNormName
    ? existingJournals.filter((j) => normalizeTitle(j.name || "") === inNormName)
    : [];

  // Detect CONFLICT if byId exists but points to a completely different journal
  if (byId) {
    const idNormName = normalizeTitle(byId.name || "");
    const idIssnP = normalizeIssn(byId.issnPrint || "");
    const idIssnO = normalizeIssn(byId.issnOnline || "");
    const idNormPub = normalizeTitle(byId.publisher || "");

    const sameIssn =
      (inIssnP && (inIssnP === idIssnP || inIssnP === idIssnO)) ||
      (inIssnO && (inIssnO === idIssnO || inIssnO === idIssnP));
    const sameName = inNormName && inNormName === idNormName;
    const inHistory =
      inNormHistory.includes(idNormName) ||
      normalizeTitle(byId.nameHistory || "").includes(inNormName);

    if (!sameIssn && !sameName && !inHistory) {
      return {
        status: "CONFLICT",
        matchedJournal: byId,
        method: "CONFLICT_JOURNAL_ID",
        notes: `Xung đột mã ${incoming.journalId}: Bảng mới là "${incoming.name}" (ISSN: ${
          inIssnP || "—"
        }) nhưng hệ thống đang lưu là "${byId.name}" (ISSN: ${idIssnP || "—"}, ĐVXB: ${
          byId.publisher
        }). Không tự động gộp.`,
      };
    }

    // If generic name ("Tạp chí Khoa học"), verify that ISSN or publisher also matches
    if (isGenericName && !sameIssn && idNormPub && inNormPub && idNormPub !== inNormPub) {
      return {
        status: "AMBIGUOUS",
        matchedJournal: byId,
        method: "GENERIC_NAME_DIFF_PUBLISHER",
        notes: `Tạp chí có tên chung "${incoming.name}" nhưng đơn vị xuất bản khác nhau ("${incoming.publisher}" vs "${byId.publisher}"). Cần Admin xác nhận.`,
      };
    }

    return {
      status: "MATCHED",
      matchedJournal: byId,
      method: sameIssn ? "ID_AND_ISSN_VERIFIED" : "ID_AND_NAME_VERIFIED",
    };
  }

  // Match by ISSN Print
  if (byIssnP.length === 1) {
    const target = byIssnP[0];
    const targetNormName = normalizeTitle(target.name || "");
    const nameCompatible =
      targetNormName === inNormName ||
      targetNormName.includes(inBaseName) ||
      inNormName.includes(normalizeTitle((target.name || "").split("(")[0])) ||
      inNormHistory.includes(targetNormName);

    if (nameCompatible) {
      return {
        status: "MATCHED",
        matchedJournal: target,
        method: "ISSN_PRINT_AND_NAME",
      };
    }
    return {
      status: "CONFLICT",
      matchedJournal: target,
      method: "ISSN_CONFLICT_NAME",
      notes: `Trùng ISSN bản in (${inIssnP}) nhưng tên tạp chí khác nhau: "${incoming.name}" vs "${target.name}".`,
    };
  } else if (byIssnP.length > 1) {
    return {
      status: "AMBIGUOUS",
      matchedJournal: byIssnP[0],
      method: "MULTIPLE_ISSN_MATCHES",
      notes: `Có ${byIssnP.length} tạp chí cùng mang ISSN ${inIssnP}. Cần Admin kiểm tra.`,
    };
  }

  // Match by E-ISSN
  if (byIssnO.length === 1) {
    const target = byIssnO[0];
    const targetNormName = normalizeTitle(target.name || "");
    const nameCompatible =
      targetNormName === inNormName ||
      targetNormName.includes(inBaseName) ||
      inNormHistory.includes(targetNormName);
    if (nameCompatible) {
      return {
        status: "MATCHED",
        matchedJournal: target,
        method: "E_ISSN_AND_NAME",
      };
    }
    return {
      status: "CONFLICT",
      matchedJournal: target,
      method: "E_ISSN_CONFLICT_NAME",
      notes: `Trùng E-ISSN (${inIssnO}) nhưng tên tạp chí khác nhau: "${incoming.name}" vs "${target.name}".`,
    };
  }

  // Match by exact full title
  if (byFullTitle.length === 1) {
    const target = byFullTitle[0];
    const targetIssnP = normalizeIssn(target.issnPrint || "");
    const targetNormPub = normalizeTitle(target.publisher || "");

    // If both have ISSN Print and they differ -> conflict or sub-series (e.g. Bản B vs Bản D)
    if (inIssnP && targetIssnP && inIssnP !== targetIssnP) {
      return {
        status: "CONFLICT",
        matchedJournal: target,
        method: "SAME_TITLE_DIFF_ISSN",
        notes: `Cùng tên "${incoming.name}" nhưng khác mã ISSN (${inIssnP} vs ${targetIssnP}). Có thể là hai chuyên san khác nhau.`,
      };
    }

    if (
      isGenericName &&
      inNormPub &&
      targetNormPub &&
      !inNormPub.includes(targetNormPub) &&
      !targetNormPub.includes(inNormPub) &&
      !inNormHost
    ) {
      return {
        status: "AMBIGUOUS",
        matchedJournal: target,
        method: "GENERIC_TITLE_AMBIGUOUS_PUB",
        notes: `Trùng tên chung "${incoming.name}" nhưng chưa xác minh trùng cơ quan chủ quản ("${incoming.publisher}" vs "${target.publisher}").`,
      };
    }

    return {
      status: "MATCHED",
      matchedJournal: target,
      method: "EXACT_NAME_AND_PUBLISHER",
    };
  } else if (byFullTitle.length > 1) {
    return {
      status: "AMBIGUOUS",
      matchedJournal: byFullTitle[0],
      method: "MULTIPLE_TITLE_MATCHES",
      notes: `Có ${byFullTitle.length} tạp chí trùng tên "${incoming.name}" trong hệ thống.`,
    };
  }

  // Check if incoming base name matches an existing generic journal with different parenthetical
  if (isGenericName) {
    const sameBase = existingJournals.filter(
      (j) => normalizeTitle((j.name || "").split("(")[0]) === inBaseName
    );
    if (sameBase.length > 0 && !inIssnP && !inIssnO) {
      return {
        status: "AMBIGUOUS",
        method: "GENERIC_BASE_NAME_NO_ISSN",
        notes: `Tạp chí "${incoming.name}" thiếu mã ISSN và trùng tên cơ sở với ${sameBase.length} tạp chí khác.`,
      };
    }
  }

  // Check by English Name if non-empty
  if (inNormEng && inNormEng.length > 10) {
    const byEng = existingJournals.filter(
      (j) => normalizeTitle(j.englishName || "") === inNormEng
    );
    if (byEng.length === 1) {
      return {
        status: "AMBIGUOUS",
        matchedJournal: byEng[0],
        method: "ENGLISH_NAME_ONLY",
        notes: `Khớp qua tên tiếng Anh "${incoming.englishName}" với "${byEng[0].name}", cần Admin xác nhận.`,
      };
    }
  }

  return {
    status: "UNMATCHED",
    method: "NEW_JOURNAL",
  };
}

/**
 * Compares two journals' council scores to count newly added scores and modified scores.
 */
export function computeCouncilScoresDiff(
  oldScores: JournalCouncilScore[] = [],
  newScores: JournalCouncilScore[] = []
): {
  newScoresCount: number;
  changedScoresCount: number;
  hasScoreChanges: boolean;
} {
  const oldByKey = new Map<string, JournalCouncilScore>();
  const oldByCouncilAndType = new Map<string, JournalCouncilScore>();

  oldScores.forEach((s) => {
    const key = s.id || buildCouncilScoreCompositeKey(s);
    oldByKey.set(key, s);
    const shortKey = `${s.councilId}__${s.decisionYear}__${s.publicationType || "PRINT"}__${
      s.sourceOrder || ""
    }`;
    oldByCouncilAndType.set(shortKey, s);
  });

  let newScoresCount = 0;
  let changedScoresCount = 0;

  newScores.forEach((ns) => {
    const key = ns.id || buildCouncilScoreCompositeKey(ns);
    if (oldByKey.has(key)) {
      const os = oldByKey.get(key)!;
      if (os.maxScore !== ns.maxScore || os.verificationStatus !== ns.verificationStatus) {
        changedScoresCount++;
      }
      return;
    }

    const shortKey = `${ns.councilId}__${ns.decisionYear}__${ns.publicationType || "PRINT"}__${
      ns.sourceOrder || ""
    }`;
    if (oldByCouncilAndType.has(shortKey)) {
      const os = oldByCouncilAndType.get(shortKey)!;
      if (
        os.maxScore !== ns.maxScore ||
        (os.conditions || "") !== (ns.conditions || "") ||
        os.verificationStatus !== ns.verificationStatus
      ) {
        changedScoresCount++;
      }
    } else {
      newScoresCount++;
    }
  });

  return {
    newScoresCount,
    changedScoresCount,
    hasScoreChanges:
      newScoresCount > 0 ||
      changedScoresCount > 0 ||
      oldScores.length !== newScores.length,
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

  const oldCouncilCount =
    oldJ.recognizedCouncilCount ||
    new Set((oldJ.councilScores || []).map((c) => c.councilId)).size ||
    (oldJ.scores?.length ? 1 : 0);
  const newCouncilCount =
    newJ.recognizedCouncilCount ||
    new Set((newJ.councilScores || []).map((c) => c.councilId)).size ||
    (newJ.scores?.length ? 1 : 0);

  if (oldCouncilCount !== newCouncilCount && (oldJ.councilScores || newJ.councilScores)) {
    diffs.push({
      field: "recognizedCouncilCount",
      label: "Số Hội đồng công nhận",
      oldValue: `${oldCouncilCount} Hội đồng`,
      newValue: `${newCouncilCount} Hội đồng`,
    });
  } else if (newJ.councilScores && newJ.councilScores.length > 0 && !oldJ.councilScores) {
    diffs.push({
      field: "councilScores",
      label: "Điểm chi tiết theo Hội đồng Giáo sư",
      oldValue: "Bản ghi điểm đơn (cũ)",
      newValue: `${newJ.councilScores.length} bản ghi điểm đa Hội đồng (${newCouncilCount} HĐ)`,
    });
  } else if (oldJ.councilScores && newJ.councilScores) {
    const scoreDiff = computeCouncilScoresDiff(oldJ.councilScores, newJ.councilScores);
    if (scoreDiff.hasScoreChanges) {
      diffs.push({
        field: "councilScores",
        label: "Cập nhật điểm theo Hội đồng",
        oldValue: `${oldJ.councilScores.length} bản ghi điểm`,
        newValue: `+${scoreDiff.newScoresCount} mới, ${scoreDiff.changedScoresCount} thay đổi`,
      });
    }
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
  existingPendingCandidates: JournalCandidate[] = [],
  options: {
    forceUpdateMultiCouncil?: boolean;
    onlyMultiCouncilScoreColumns?: boolean;
  } = {}
): {
  candidatesToCreate: JournalCandidate[];
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  skippedDuplicates: number;
  matchedCount: number;
  ambiguousCount: number;
  conflictCount: number;
  identityMatchStats: {
    matchedCount: number;
    ambiguousCount: number;
    unmatchedCount: number;
    conflictCount: number;
    matched: number;
    ambiguous: number;
    unmatched: number;
    conflict: number;
  };
} {
  const isScoreOnlyMode = Boolean(options.onlyMultiCouncilScoreColumns);

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
  let matchedCount = 0;
  let ambiguousCount = 0;
  let conflictCount = 0;

  const seenInBatch = new Set<string>();

  incomingJournals.forEach((incoming, idx) => {
    // Deduplicate within same batch
    if (seenInBatch.has(incoming.journalId)) {
      skippedDuplicates++;
      return;
    }
    seenInBatch.add(incoming.journalId);

    // Match identity strictly
    const identityMatch = matchJournalIdentity(incoming, existingJournals);
    if (identityMatch.status === "MATCHED") matchedCount++;
    else if (identityMatch.status === "AMBIGUOUS") ambiguousCount++;
    else if (identityMatch.status === "CONFLICT") conflictCount++;

    // Identify unverified fields
    const unverifiedFields: string[] = [];
    const isManualCheck =
      incoming.verification?.manualReviewNeeded === true ||
      incoming.scoreReconciliationStatus === "CAN_KIEM_TRA" ||
      identityMatch.status === "AMBIGUOUS" ||
      identityMatch.status === "CONFLICT";

    const manualReasonParts = [
      incoming.verification?.manualReviewReason,
      identityMatch.notes,
    ].filter(Boolean);
    const manualReason = manualReasonParts.join(" | ");

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

    const matched =
      identityMatch.status === "MATCHED" || identityMatch.status === "AMBIGUOUS"
        ? identityMatch.matchedJournal
        : undefined;

    const now = new Date().toISOString();
    const candidateStatus: JournalCandidate["status"] = isManualCheck
      ? "needs_review"
      : "pending";
    const effectiveReconciliationStatus: SparkScoreReconciliationStatus = isManualCheck
      ? "CAN_KIEM_TRA"
      : incoming.scoreReconciliationStatus || "HOAN_TAT";

    if (!matched) {
      // Check if already in pending queue
      const existingPending = activePendingMap.get(incoming.journalId);
      if (existingPending) {
        const pendingScoreDiff = computeCouncilScoresDiff(
          existingPending.councilScores || [],
          incoming.councilScores || []
        );
        const needsMultiCouncilEnrich =
          (options.forceUpdateMultiCouncil || isScoreOnlyMode) &&
          (incoming.councilScores?.length || 0) > 0 &&
          (!existingPending.councilScores ||
            existingPending.councilScores.length === 0 ||
            pendingScoreDiff.hasScoreChanges);
        if (!needsMultiCouncilEnrich) {
          skippedDuplicates++;
          return;
        }
      }

      // Case A: Completely NEW journal (or updating scores on an existing pending new candidate)
      newCount++;

      const candId = `cand_new_${incoming.journalId}`;
      const newScoresCount = incoming.councilScores?.length || incoming.scores?.length || 0;
      const baseCatalog = isScoreOnlyMode && existingPending ? existingPending : incoming;

      const candidateDoc: JournalCandidate = {
        id: candId,
        journalId: incoming.journalId,
        name: baseCatalog.name,
        englishName: baseCatalog.englishName,
        abbreviation: baseCatalog.abbreviation,
        publisher: baseCatalog.publisher,
        hostAgency: baseCatalog.hostAgency,
        nameHistory: baseCatalog.nameHistory,
        issnPrint: baseCatalog.issnPrint,
        issnOnline: baseCatalog.issnOnline,
        isbn: baseCatalog.isbn,
        category: baseCatalog.category,
        primaryField: baseCatalog.primaryField,
        fields: baseCatalog.fields,
        website: baseCatalog.website,
        websiteVerified: Boolean(baseCatalog.websiteVerified),
        maxScore: incoming.maxScore ?? 0,
        maxScoreYear: incoming.maxScoreYear ?? 2025,
        scores: incoming.scores,
        councilScores: incoming.councilScores,
        recognizedCouncilCount: incoming.recognizedCouncilCount,
        verifiedCouncils: incoming.verifiedCouncils,
        decisionYear: incoming.decisionYear,
        scoreReconciliationStatus: effectiveReconciliationStatus,
        scoreSourceNote: incoming.scoreSourceNote,
        identityMatchStatus: identityMatch.status,
        identityMatchMethod: identityMatch.method,
        identityMatchNotes: identityMatch.notes,
        newScoresCount,
        changedScoresCount: 0,
        guidelines: baseCatalog.guidelines,
        links: baseCatalog.links,
        verification: incoming.verification
          ? {
              ...incoming.verification,
              manualReviewNeeded: isManualCheck,
              manualReviewReason: manualReason || incoming.verification.manualReviewReason,
            }
          : undefined,
        sourceType: "GOOGLE_SHEETS",
        changeType: "create",
        status: candidateStatus,
        unverifiedFields: unverifiedFields.slice(0, 45),
        sheetRowIndex: idx + 2,
        createdAt: existingPending?.createdAt || now,
        updatedAt: now,
      };

      candidatesToCreate.push(candidateDoc);
    } else {
      // Case B: Existing journal matched!
      const allDiffs = computeJournalFieldDiffs(matched, incoming);
      const scoreDiff = computeCouncilScoresDiff(
        matched.councilScores || [],
        incoming.councilScores || []
      );
      const scoreOnlyFields = new Set([
        "maxScore",
        "maxScoreYear",
        "scores",
        "recognizedCouncilCount",
        "councilScores",
      ]);
      const effectiveDiffs = isScoreOnlyMode
        ? allDiffs.filter((d) => scoreOnlyFields.has(d.field))
        : allDiffs;

      const hasScoreMetadataChange =
        scoreDiff.hasScoreChanges ||
        ((matched.councilScores?.length || 0) === 0 && (incoming.councilScores?.length || 0) > 0) ||
        (matched.recognizedCouncilCount || 0) !== (incoming.recognizedCouncilCount || 0);

      if (isScoreOnlyMode) {
        if (!hasScoreMetadataChange && effectiveDiffs.length === 0) {
          unchangedCount++;
          return;
        }
      } else {
        if (allDiffs.length === 0 && !scoreDiff.hasScoreChanges) {
          unchangedCount++;
          return;
        }
      }

      const existingPending = activePendingMap.get(matched.journalId);
      if (existingPending) {
        if (!options.forceUpdateMultiCouncil && !isScoreOnlyMode) {
          skippedDuplicates++;
          return;
        }
        const pendingScoreDiff = computeCouncilScoresDiff(
          existingPending.councilScores || [],
          incoming.councilScores || []
        );
        if (
          !pendingScoreDiff.hasScoreChanges &&
          (existingPending.councilScores?.length || 0) > 0
        ) {
          skippedDuplicates++;
          return;
        }
      }

      updatedCount++;

      const candId = `cand_upd_${matched.journalId}`;
      // When in score-only mode ("Cập nhật điểm HĐGSNN"), preserve 100% of the published journal's non-score catalog fields
      const catalogSource = isScoreOnlyMode ? matched : incoming;

      const candidateDoc: JournalCandidate = {
        id: candId,
        journalId: matched.journalId,
        name: catalogSource.name,
        englishName: catalogSource.englishName,
        abbreviation: catalogSource.abbreviation,
        publisher: catalogSource.publisher,
        hostAgency: catalogSource.hostAgency,
        nameHistory: catalogSource.nameHistory,
        issnPrint: catalogSource.issnPrint,
        issnOnline: catalogSource.issnOnline,
        isbn: catalogSource.isbn,
        category: catalogSource.category,
        primaryField: catalogSource.primaryField,
        fields: catalogSource.fields,
        website: catalogSource.website,
        websiteVerified: Boolean(catalogSource.websiteVerified),
        maxScore: incoming.maxScore ?? 0,
        maxScoreYear: incoming.maxScoreYear ?? 2025,
        scores: incoming.scores,
        councilScores: incoming.councilScores,
        recognizedCouncilCount: incoming.recognizedCouncilCount,
        verifiedCouncils: incoming.verifiedCouncils,
        decisionYear: incoming.decisionYear,
        scoreReconciliationStatus: effectiveReconciliationStatus,
        scoreSourceNote: incoming.scoreSourceNote,
        identityMatchStatus: identityMatch.status,
        identityMatchMethod: identityMatch.method,
        identityMatchNotes: identityMatch.notes,
        newScoresCount: scoreDiff.newScoresCount,
        changedScoresCount: scoreDiff.changedScoresCount,
        guidelines: catalogSource.guidelines,
        links: catalogSource.links,
        verification: incoming.verification
          ? {
              ...incoming.verification,
              manualReviewNeeded: isManualCheck,
              manualReviewReason: manualReason || incoming.verification.manualReviewReason,
            }
          : undefined,
        sourceType: "GOOGLE_SHEETS",
        changeType: "update",
        existingJournalId: matched.id || matched.journalId,
        diffSummary: (effectiveDiffs.length > 0
          ? effectiveDiffs
          : [
              {
                field: "councilScores",
                label: "Cập nhật điểm theo Hội đồng",
                oldValue: `${matched.councilScores?.length || 0} bản ghi điểm`,
                newValue: `${incoming.councilScores?.length || 0} bản ghi điểm`,
              },
            ]
        ).slice(0, 45),
        status: candidateStatus,
        isManualPreserved: matched.isManualEdited,
        unverifiedFields: unverifiedFields.slice(0, 45),
        sheetRowIndex: idx + 2,
        createdAt: existingPending?.createdAt || now,
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
    matchedCount,
    ambiguousCount,
    conflictCount,
    identityMatchStats: {
      matchedCount,
      ambiguousCount,
      unmatchedCount: newCount,
      conflictCount,
      matched: matchedCount,
      ambiguous: ambiguousCount,
      unmatched: newCount,
      conflict: conflictCount,
    },
  };
}
