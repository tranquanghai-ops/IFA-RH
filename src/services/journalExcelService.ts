import ExcelJS from "exceljs";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { firestore } from "../firebase/config";
import type {
  Journal,
  JournalCategory,
  JournalScoreItem,
  JournalGuidelines,
  JournalLinkItem,
  JournalVerification,
  JournalImportPreviewItem,
  JournalImportResult,
} from "../types/journal";
import { recordJournalImport } from "./journalService";

/**
 * Normalizes title string for duplicate matching.
 */
export function normalizeTitle(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Normalizes ISSN format: XXXX-XXXX.
 */
export function normalizeIssn(issn?: string): string {
  if (!issn) return "";
  const cleaned = issn.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (cleaned.length === 8) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  }
  return cleaned;
}

/**
 * Safely extract string value from an Excel cell.
 */
function getCellString(cell: ExcelJS.Cell): string {
  if (!cell || cell.value === null || cell.value === undefined) return "";
  if (typeof cell.value === "object") {
    // Hyperlink or RichText
    const val: any = cell.value;
    if (val.text) return String(val.text).trim();
    if (val.result) return String(val.result).trim();
    if (val.hyperlink) return String(val.hyperlink).trim();
    if (Array.isArray(val.richText)) {
      return val.richText.map((t: any) => t.text).join("").trim();
    }
    return JSON.stringify(val);
  }
  return String(cell.value).trim();
}

/**
 * Safely extract number value from an Excel cell.
 */
function getCellNumber(cell: ExcelJS.Cell): number | undefined {
  if (!cell || cell.value === null || cell.value === undefined) return undefined;
  if (typeof cell.value === "number") return cell.value;
  const num = parseFloat(String(cell.value).replace(",", "."));
  return isNaN(num) ? undefined : num;
}

/**
 * Safely extract boolean value from an Excel cell.
 */
function getCellBoolean(cell: ExcelJS.Cell): boolean {
  if (!cell || cell.value === null || cell.value === undefined) return false;
  if (typeof cell.value === "boolean") return cell.value;
  const str = String(cell.value).trim().toUpperCase();
  return str === "TRUE" || str === "1" || str === "YES" || str === "ĐÚNG" || str === "CO";
}

export interface ParseExcelResult {
  schemaVersion: number;
  journals: Journal[];
  errors: string[];
}

/**
 * Reads and parses Journal Directory Excel workbook.
 */
export async function parseJournalWorkbook(
  data: ArrayBuffer | Uint8Array
): Promise<ParseExcelResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data as any);

  const errors: string[] = [];

  // Required sheets
  const tapChiSheet = workbook.getWorksheet("TAP_CHI");
  const diemSheet = workbook.getWorksheet("DIEM_HDGSNN");
  const huongDanSheet = workbook.getWorksheet("HUONG_DAN_DANG_BAI");
  const lienKetSheet = workbook.getWorksheet("LIEN_KET");
  const kiemChungSheet = workbook.getWorksheet("KIEM_CHUNG");
  const metaSheet = workbook.getWorksheet("SCHEMA_METADATA");

  if (!tapChiSheet) {
    throw new Error("File Excel thiếu sheet bắt buộc 'TAP_CHI'. Vui lòng dùng đúng file template.");
  }
  if (!diemSheet) {
    throw new Error("File Excel thiếu sheet bắt buộc 'DIEM_HDGSNN'. Vui lòng dùng đúng file template.");
  }

  // Verify Schema Version (from SCHEMA_METADATA or KIEM_CHUNG)
  let schemaVersion = 1;
  if (metaSheet) {
    metaSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const attr = getCellString(row.getCell(1)).toLowerCase();
        if (attr === "schema_version") {
          const v = parseInt(getCellString(row.getCell(2)), 10);
          if (!isNaN(v)) schemaVersion = v;
        }
      }
    });
  } else if (kiemChungSheet) {
    const headerRow = kiemChungSheet.getRow(1);
    let schemaColIndex = -1;
    headerRow.eachCell((cell, colNumber) => {
      if (getCellString(cell).toLowerCase() === "schema_version") {
        schemaColIndex = colNumber;
      }
    });
    if (schemaColIndex > 0) {
      const v = getCellNumber(kiemChungSheet.getRow(2).getCell(schemaColIndex));
      if (v) schemaVersion = v;
    }
  }

  if (schemaVersion !== 1) {
    throw new Error(
      `Không tương thích schema_version: file có version = ${schemaVersion}, hệ thống yêu cầu schema_version = 1.`
    );
  }

  // 1. Parse DIEM_HDGSNN (Group by journal_id)
  const scoresByJournalId: Record<string, JournalScoreItem[]> = {};
  if (diemSheet) {
    diemSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const jId = getCellString(row.getCell(2)); // col 2: journal_id
        if (!jId) return;

        const scoreItem: JournalScoreItem = {
          id: getCellString(row.getCell(1)) || `PTS-${rowNumber}`,
          journalId: jId,
          councilCode: getCellString(row.getCell(3)) || "HDGS_CHUNG",
          councilName: getCellString(row.getCell(4)) || "Hội đồng ngành",
          year: getCellNumber(row.getCell(5)) || 2025,
          maxScore: getCellNumber(row.getCell(6)) || 0,
          minScore: getCellNumber(row.getCell(7)),
          decisionNumber: getCellString(row.getCell(8)) || "26/QĐ-HĐGSNN",
          decisionDate: getCellString(row.getCell(9)) || "2025-07-11",
          notes: getCellString(row.getCell(10)),
        };

        if (!scoresByJournalId[jId]) {
          scoresByJournalId[jId] = [];
        }
        scoresByJournalId[jId].push(scoreItem);
      }
    });
  }

  // 2. Parse HUONG_DAN_DANG_BAI (Map by journal_id)
  const guidelinesByJournalId: Record<string, JournalGuidelines> = {};
  if (huongDanSheet) {
    huongDanSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const jId = getCellString(row.getCell(1));
        if (!jId) return;

        guidelinesByJournalId[jId] = {
          hasGuidelines: getCellBoolean(row.getCell(2)),
          summary: getCellString(row.getCell(3)) || undefined,
          manuscriptFormat: getCellString(row.getCell(4)) || undefined,
          wordLimitMin: getCellNumber(row.getCell(5)),
          wordLimitMax: getCellNumber(row.getCell(6)),
          pageLimit: getCellString(row.getCell(7)) || undefined,
          templateUrl: getCellString(row.getCell(8)) || undefined,
          citationStyle: getCellString(row.getCell(9)) || undefined,
          publicationLanguage: getCellString(row.getCell(10)) || undefined,
          reviewFee: getCellString(row.getCell(11)) || undefined,
          publicationFee: getCellString(row.getCell(12)) || undefined,
          publicationFrequency: getCellString(row.getCell(13)) || undefined,
          reviewTimeWeeks: getCellString(row.getCell(14)) || undefined,
          submissionUrl: getCellString(row.getCell(15)) || undefined,
          editorialEmail: getCellString(row.getCell(16)) || undefined,
          contactPhone: getCellString(row.getCell(17)) || undefined,
          officeAddress: getCellString(row.getCell(18)) || undefined,
        };
      }
    });
  }

  // 3. Parse LIEN_KET (Group by journal_id)
  const linksByJournalId: Record<string, JournalLinkItem[]> = {};
  if (lienKetSheet) {
    lienKetSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const jId = getCellString(row.getCell(2));
        if (!jId) return;

        const linkUrl = getCellString(row.getCell(5));
        if (!linkUrl) return;

        const linkItem: JournalLinkItem = {
          id: getCellString(row.getCell(1)) || `LINK-${rowNumber}`,
          journalId: jId,
          linkType: getCellString(row.getCell(3)) || "Trang chủ",
          label: getCellString(row.getCell(4)) || "Liên kết",
          url: linkUrl,
          isVerified: getCellBoolean(row.getCell(6)),
          verifiedAt: getCellString(row.getCell(7)) || undefined,
          notes: getCellString(row.getCell(8)) || undefined,
        };

        if (!linksByJournalId[jId]) {
          linksByJournalId[jId] = [];
        }
        linksByJournalId[jId].push(linkItem);
      }
    });
  }

  // 4. Parse KIEM_CHUNG (Map by journal_id)
  const verificationByJournalId: Record<string, JournalVerification> = {};
  if (kiemChungSheet) {
    kiemChungSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const jId = getCellString(row.getCell(1));
        if (!jId) return;

        const statusRaw = getCellString(row.getCell(2)).toLowerCase();
        let status: "verified" | "unverified" | "needs_update" = "unverified";
        if (statusRaw === "verified" || statusRaw === "đã kiểm chứng" || statusRaw === "da_kiem_chung") {
          status = "verified";
        } else if (statusRaw === "needs_update" || statusRaw === "cần cập nhật" || statusRaw === "can_cap_nhat") {
          status = "needs_update";
        }

        verificationByJournalId[jId] = {
          status,
          verifiedBy: getCellString(row.getCell(3)) || "Spark Agent",
          verifiedDate: getCellString(row.getCell(4)) || new Date().toISOString().split("T")[0],
          sourceReference: getCellString(row.getCell(5)) || "Quyết định 26/QĐ-HĐGSNN",
          notes: getCellString(row.getCell(6)) || undefined,
          schemaVersion: 1,
        };
      }
    });
  }

  // 5. Parse TAP_CHI and assemble full Journal objects
  const parsedJournals: Journal[] = [];
  tapChiSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const journalId = getCellString(row.getCell(1));
      const journalName = getCellString(row.getCell(2));
      const publisher = getCellString(row.getCell(5));

      if (!journalId || !journalName) {
        errors.push(`Dòng ${rowNumber}: Thiếu journal_id hoặc tên tạp chí, đã bỏ qua.`);
        return;
      }

      const categoryRaw = getCellString(row.getCell(9)).toLowerCase();
      const category: JournalCategory =
        categoryRaw.includes("quốc tế") || categoryRaw.includes("international")
          ? "international"
          : "domestic";

      const scores = scoresByJournalId[journalId] || [];

      // Compute maxScore and maxScoreYear
      let maxScore = 0;
      let maxScoreYear = 2025;
      if (scores.length > 0) {
        const sorted = [...scores].sort((a, b) => {
          if (b.year !== a.year) return b.year - a.year;
          return b.maxScore - a.maxScore;
        });
        maxScore = sorted[0].maxScore;
        maxScoreYear = sorted[0].year;
      }

      // Collect council names into fields
      const fieldSet = new Set<string>();
      const primaryField = getCellString(row.getCell(10)) || "Chưa phân loại";
      fieldSet.add(primaryField);
      scores.forEach((s) => {
        if (s.councilName) fieldSet.add(s.councilName);
      });

      const website = getCellString(row.getCell(11)) || undefined;
      const statusRaw = getCellString(row.getCell(12)).toLowerCase();
      const status = statusRaw === "hidden" ? "hidden" : "active";

      const verification = verificationByJournalId[journalId];
      const websiteVerified =
        Boolean(website) && (verification?.status === "verified" || false);

      const now = new Date().toISOString();
      const journalObj: Journal = {
        id: journalId,
        journalId,
        name: journalName,
        englishName: getCellString(row.getCell(3)) || undefined,
        abbreviation: getCellString(row.getCell(4)) || undefined,
        publisher: publisher || "Đang cập nhật cơ quan xuất bản",
        issnPrint: normalizeIssn(getCellString(row.getCell(6))) || undefined,
        issnOnline: normalizeIssn(getCellString(row.getCell(7))) || undefined,
        isbn: getCellString(row.getCell(8)) || undefined,
        category,
        primaryField,
        fields: Array.from(fieldSet),
        website,
        websiteVerified,
        maxScore,
        maxScoreYear,
        scores,
        guidelines: guidelinesByJournalId[journalId],
        links: linksByJournalId[journalId] || [],
        verification: verification || {
          status: "unverified",
          verifiedBy: "Spark Agent",
          verifiedDate: now.split("T")[0],
          sourceReference: "Quyết định 26/QĐ-HĐGSNN",
          schemaVersion: 1,
        },
        status,
        isManualEdited: false,
        createdAt: now,
        updatedAt: now,
        createdBy: "Spark Excel Import",
      };

      parsedJournals.push(journalObj);
    }
  });

  return {
    schemaVersion,
    journals: parsedJournals,
    errors,
  };
}

/**
 * Calculates diff preview between incoming Excel journals and database journals.
 */
export function calculateJournalImportDiff(
  parsedJournals: Journal[],
  existingJournals: Journal[],
  overrideManual: boolean = false
): JournalImportPreviewItem[] {
  const existingById = new Map<string, Journal>();
  const existingByIssn = new Map<string, Journal>();
  const existingByTitle = new Map<string, Journal>();

  existingJournals.forEach((j) => {
    existingById.set(j.journalId, j);
    if (j.id) existingById.set(j.id, j);

    if (j.issnPrint) existingByIssn.set(normalizeIssn(j.issnPrint), j);
    if (j.issnOnline) existingByIssn.set(normalizeIssn(j.issnOnline), j);

    const normTitle = normalizeTitle(j.name);
    if (normTitle) existingByTitle.set(normTitle, j);
  });

  // Track seen IDs in this file to detect file-internal duplicates
  const seenFileIds = new Set<string>();

  return parsedJournals.map((parsed) => {
    const reasons: string[] = [];
    const unverifiedFields: string[] = [];

    // Check unverified fields
    if (!parsed.website) {
      unverifiedFields.push("Chưa có trang chủ");
    } else if (!parsed.websiteVerified) {
      unverifiedFields.push("Trang chủ chưa kiểm chứng");
    }
    if (!parsed.issnPrint && !parsed.issnOnline) {
      unverifiedFields.push("Thiếu cả ISSN và E-ISSN");
    }
    if (!parsed.guidelines || !parsed.guidelines.hasGuidelines) {
      unverifiedFields.push("Chưa có thể lệ đăng bài");
    }
    if (parsed.verification?.status !== "verified") {
      unverifiedFields.push("Hồ sơ chưa kiểm chứng toàn diện");
    }

    // Check internal duplicate
    if (seenFileIds.has(parsed.journalId)) {
      return {
        journalId: parsed.journalId,
        name: parsed.name,
        publisher: parsed.publisher,
        issnPrint: parsed.issnPrint,
        issnOnline: parsed.issnOnline,
        category: parsed.category,
        primaryField: parsed.primaryField,
        maxScore: parsed.maxScore,
        maxScoreYear: parsed.maxScoreYear,
        action: "skip",
        reasons: ["Bản ghi trùng lặp mã journal_id trong chính file Excel"],
        unverifiedFields,
        parsedJournal: parsed,
        selected: false,
      };
    }
    seenFileIds.add(parsed.journalId);

    // Match with existing
    let matchedExisting = existingById.get(parsed.journalId);
    let matchType = "journal_id";

    if (!matchedExisting && parsed.issnPrint) {
      matchedExisting = existingByIssn.get(normalizeIssn(parsed.issnPrint));
      if (matchedExisting) matchType = "ISSN";
    }
    if (!matchedExisting && parsed.issnOnline) {
      matchedExisting = existingByIssn.get(normalizeIssn(parsed.issnOnline));
      if (matchedExisting) matchType = "E-ISSN";
    }
    if (!matchedExisting) {
      const normTitle = normalizeTitle(parsed.name);
      if (normTitle) {
        matchedExisting = existingByTitle.get(normTitle);
        if (matchedExisting) matchType = "Tên tạp chí";
      }
    }

    if (!matchedExisting) {
      reasons.push("Tạp chí mới, sẽ thêm vào danh mục");
      return {
        journalId: parsed.journalId,
        name: parsed.name,
        publisher: parsed.publisher,
        issnPrint: parsed.issnPrint,
        issnOnline: parsed.issnOnline,
        category: parsed.category,
        primaryField: parsed.primaryField,
        maxScore: parsed.maxScore,
        maxScoreYear: parsed.maxScoreYear,
        action: "create",
        reasons,
        unverifiedFields,
        parsedJournal: parsed,
        selected: true,
      };
    }

    // Existing record matched!
    // Check if manual edit preservation applies
    if (matchedExisting.isManualEdited && !overrideManual) {
      reasons.push(
        `Khớp bản ghi hiện có theo ${matchType} (${matchedExisting.journalId}). Bản ghi đã được Admin sửa thủ công — ĐANG BẢO TOÀN DỮ LIỆU (bỏ qua cập nhật).`
      );
      return {
        journalId: parsed.journalId,
        name: parsed.name,
        publisher: parsed.publisher,
        issnPrint: parsed.issnPrint,
        issnOnline: parsed.issnOnline,
        category: parsed.category,
        primaryField: parsed.primaryField,
        maxScore: parsed.maxScore,
        maxScoreYear: parsed.maxScoreYear,
        action: "unchanged",
        reasons,
        isManualPreserved: true,
        unverifiedFields,
        parsedJournal: parsed,
        selected: false,
      };
    }

    // Merge scores history without overwriting previous years
    const mergedScores = [...(matchedExisting.scores || [])];
    (parsed.scores || []).forEach((newScore) => {
      const existingIdx = mergedScores.findIndex(
        (s) =>
          s.councilCode === newScore.councilCode &&
          s.year === newScore.year &&
          s.decisionNumber === newScore.decisionNumber
      );
      if (existingIdx >= 0) {
        mergedScores[existingIdx] = newScore;
      } else {
        mergedScores.push(newScore);
      }
    });

    const updatedJournal: Journal = {
      ...parsed,
      id: matchedExisting.id || matchedExisting.journalId,
      scores: mergedScores,
      createdAt: matchedExisting.createdAt,
      createdBy: matchedExisting.createdBy,
      isManualEdited: false, // Updated by official excel
    };

    reasons.push(`Khớp bản ghi hiện có theo ${matchType} (${matchedExisting.journalId}) — Cập nhật thông tin.`);
    return {
      journalId: parsed.journalId,
      name: parsed.name,
      publisher: parsed.publisher,
      issnPrint: parsed.issnPrint,
      issnOnline: parsed.issnOnline,
      category: parsed.category,
      primaryField: parsed.primaryField,
      maxScore: parsed.maxScore,
      maxScoreYear: parsed.maxScoreYear,
      action: "update",
      reasons,
      unverifiedFields,
      parsedJournal: updatedJournal,
      selected: true,
    };
  });
}

/**
 * Execute batch import of selected items into Firestore.
 */
export async function executeBatchJournalImport(
  previewItems: JournalImportPreviewItem[],
  fileName: string,
  user: { uid: string; email?: string }
): Promise<JournalImportResult> {
  const batchId = `import_${Date.now()}`;
  const now = new Date().toISOString();
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const errors: Array<{ journalId?: string; message: string }> = [];

  for (const item of previewItems) {
    if (!item.selected) {
      skippedCount++;
      continue;
    }

    try {
      const docId = item.parsedJournal.journalId;
      const docRef = doc(firestore, "journals", docId);

      const payload = {
        ...item.parsedJournal,
        id: docId,
        updatedAt: now,
        updatedBy: user.email || user.uid,
        lastImportedAt: now,
        lastImportBatch: batchId,
      };

      await setDoc(docRef, payload, { merge: true });

      if (item.action === "create") {
        createdCount++;
      } else {
        updatedCount++;
      }
    } catch (err: any) {
      errorCount++;
      errors.push({
        journalId: item.journalId,
        message: err.message || "Lỗi ghi dữ liệu Firestore",
      });
    }
  }

  const result: JournalImportResult = {
    batchId,
    fileName,
    totalParsed: previewItems.length,
    createdCount,
    updatedCount,
    skippedCount,
    errorCount,
    errors,
    importedAt: now,
    importedBy: user.email || user.uid,
    schemaVersion: 1,
  };

  // Record audit log entry in journalImports
  try {
    await recordJournalImport(result);
  } catch (err) {
    console.warn("Could not save journalImports summary:", err);
  }

  return result;
}
