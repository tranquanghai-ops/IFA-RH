import type {
  SharedPersonnelRecord,
  RowValidationStatus,
  SkippedRowDetail,
} from "../types";

export interface ParsedPersonnelFileResult {
  source: string;
  schemaVersion: number;
  generatedAt: string;
  totalRecords: number;
  validRecords: SharedPersonnelRecord[];
  skippedRows: SkippedRowDetail[];
  counts: {
    total: number;
    valid: number;
    skipped: number;
    skippedMissingEmail: number;
    skippedInvalidEmail: number;
    skippedDuplicateEmail: number;
    skippedInvalidRecord: number;
  };
}

export function parseAndClassifyPersonnelJson(
  rawJsonText: string
): ParsedPersonnelFileResult {
  let json: any;
  try {
    json = JSON.parse(rawJsonText);
  } catch {
    throw new Error("Tệp không đúng định dạng JSON hợp lệ.");
  }

  // ==================== FILE-LEVEL VALIDATIONS ====================
  if (!json || typeof json !== "object") {
    throw new Error("Nội dung tệp JSON không hợp lệ.");
  }
  if (json.schemaVersion !== 1) {
    throw new Error(
      `Phiên bản schema không được hỗ trợ (${json.schemaVersion ?? "không có"}). Yêu cầu schemaVersion: 1.`
    );
  }
  if (json.source !== "IFA-WORK") {
    throw new Error(
      `Nguồn tệp không hợp lệ (${json.source ?? "không rõ"}). Tệp phải được xuất từ hệ thống IFA-WORK.`
    );
  }
  if (!Array.isArray(json.personnel)) {
    throw new Error("Trường 'personnel' trong tệp JSON phải là một mảng danh sách nhân sự.");
  }

  const rawList = json.personnel as any[];
  if (rawList.length === 0) {
    throw new Error("Tệp danh bạ không chứa bất kỳ bản ghi nhân sự nào.");
  }

  // ==================== ROW-LEVEL CLASSIFICATIONS ====================
  const validRecords: SharedPersonnelRecord[] = [];
  const skippedRows: SkippedRowDetail[] = [];
  const seenEmails = new Set<string>();
  const emailRegex = /^[a-z0-9._%+-]+@tdtu\.edu\.vn$/;

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    const rowNumber = i + 1;
    const displayName = String(item.displayName || item.name || "").trim();
    const rawEmail = item.emailNormalized ?? item.email;
    const emailStr =
      rawEmail !== undefined && rawEmail !== null
        ? String(rawEmail).trim().toLowerCase()
        : "";

    // 1. Missing display name
    if (!displayName) {
      skippedRows.push({
        rowNumber,
        displayName: "—",
        email: emailStr || "—",
        status: "SKIPPED_INVALID_RECORD",
        reason: "Thiếu họ tên giảng viên",
      });
      continue;
    }

    // 2. Missing email
    if (!emailStr) {
      skippedRows.push({
        rowNumber,
        displayName,
        email: "—",
        status: "SKIPPED_MISSING_EMAIL",
        reason: "Thiếu email TDTU",
      });
      continue;
    }

    // 3. Invalid email format or non-TDTU domain
    if (!emailRegex.test(emailStr)) {
      skippedRows.push({
        rowNumber,
        displayName,
        email: emailStr,
        status: "SKIPPED_INVALID_EMAIL",
        reason: "Email không thuộc tên miền @tdtu.edu.vn",
      });
      continue;
    }

    // 4. Duplicate email in the same file
    if (seenEmails.has(emailStr)) {
      skippedRows.push({
        rowNumber,
        displayName,
        email: emailStr,
        status: "SKIPPED_DUPLICATE_EMAIL",
        reason: "Email bị trùng lặp trong tệp (đã giữ dòng đầu)",
      });
      continue;
    }

    seenEmails.add(emailStr);

    validRecords.push({
      emailNormalized: emailStr,
      displayName,
      departmentId: String(item.departmentId || "").trim(),
      departmentName: String(item.departmentName || item.department || "Chưa phân ngành").trim(),
      lecturerType: String(item.lecturerType || "lecturer").trim(),
      academicDegree: String(item.academicDegree || item.title || "").trim(),
      employeeId: item.employeeId ? String(item.employeeId).trim() : undefined,
      active: Boolean(item.active !== false),
      inactiveAt: item.inactiveAt || null,
      sourceUpdatedAt: item.sourceUpdatedAt || new Date().toISOString(),
      sharedUpdatedAt: new Date().toISOString(),
    });
  }

  const skippedMissingEmail = skippedRows.filter((s) => s.status === "SKIPPED_MISSING_EMAIL").length;
  const skippedInvalidEmail = skippedRows.filter((s) => s.status === "SKIPPED_INVALID_EMAIL").length;
  const skippedDuplicateEmail = skippedRows.filter((s) => s.status === "SKIPPED_DUPLICATE_EMAIL").length;
  const skippedInvalidRecord = skippedRows.filter((s) => s.status === "SKIPPED_INVALID_RECORD").length;

  return {
    source: json.source,
    schemaVersion: json.schemaVersion,
    generatedAt: json.generatedAt || new Date().toISOString(),
    totalRecords: rawList.length,
    validRecords,
    skippedRows,
    counts: {
      total: rawList.length,
      valid: validRecords.length,
      skipped: skippedRows.length,
      skippedMissingEmail,
      skippedInvalidEmail,
      skippedDuplicateEmail,
      skippedInvalidRecord,
    },
  };
}
