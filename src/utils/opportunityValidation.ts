import type { Opportunity, OpportunityType, OpportunityLevel } from "../types";

export const OPPORTUNITY_TYPES: OpportunityType[] = [
  "Hội thảo",
  "Hội nghị",
  "Call for Papers",
  "Special Issue",
  "Book Chapter",
  "Seminar",
  "Hợp tác nghiên cứu",
  "Đổi mới sáng tạo",
  "Khác",
];

export const OPPORTUNITY_LEVELS: OpportunityLevel[] = [
  "Quốc tế",
  "Quốc gia",
  "Cấp Trường",
  "Cấp Khoa",
  "Khác",
];

export interface DateValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string;
}

/**
 * Validates a single date or date range string.
 * Strictly enforces 4-digit years between 2020 and 2050 (prevents 52027 or 27).
 * Standardizes valid dates into dd/mm/yyyy or dd/mm/yyyy - dd/mm/yyyy.
 */
export function validateAndNormalizeDate(dateStr?: string | null): DateValidationResult {
  if (!dateStr || !dateStr.trim()) {
    return { valid: true, normalized: "" };
  }

  const str = dateStr.trim();

  // 1. Date range: "dd/mm/yyyy - dd/mm/yyyy" or "dd/mm/yyyy to dd/mm/yyyy"
  const rangeMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,6})\s*[-–—]\s*(\d{1,2})\/(\d{1,2})\/(\d{2,6})$/);
  if (rangeMatch) {
    const [, d1, m1, y1, d2, m2, y2] = rangeMatch;
    const year1 = Number(y1);
    const year2 = Number(y2);
    if (year1 < 2020 || year1 > 2050 || year2 < 2020 || year2 > 2050) {
      return {
        valid: false,
        error: `Năm không hợp lệ (${y1} / ${y2}). Năm phải là 4 chữ số từ 2020 đến 2050.`,
      };
    }
    const month1 = Number(m1);
    const month2 = Number(m2);
    if (month1 < 1 || month1 > 12 || month2 < 1 || month2 > 12) {
      return { valid: false, error: "Tháng không hợp lệ (từ 01 đến 12)." };
    }
    const day1 = Number(d1);
    const day2 = Number(d2);
    if (day1 < 1 || day1 > 31 || day2 < 1 || day2 > 31) {
      return { valid: false, error: "Ngày không hợp lệ (từ 01 đến 31)." };
    }
    const norm1 = `${d1.padStart(2, "0")}/${m1.padStart(2, "0")}/${y1}`;
    const norm2 = `${d2.padStart(2, "0")}/${m2.padStart(2, "0")}/${y2}`;
    return { valid: true, normalized: `${norm1} - ${norm2}` };
  }

  // 2. Standard dd/mm/yyyy
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,6})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const year = Number(y);
    if (year < 2020 || year > 2050) {
      return {
        valid: false,
        error: `Năm ${y} không hợp lệ. Năm phải là 4 chữ số từ 2020 đến 2050 (ví dụ: 2026, 2027).`,
      };
    }
    const month = Number(m);
    if (month < 1 || month > 12) {
      return { valid: false, error: `Tháng ${m} không hợp lệ (từ 01 đến 12).` };
    }
    const day = Number(d);
    if (day < 1 || day > 31) {
      return { valid: false, error: `Ngày ${d} không hợp lệ (từ 01 đến 31).` };
    }
    return {
      valid: true,
      normalized: `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`,
    };
  }

  // 3. ISO / HTML date input format: yyyy-mm-dd
  const ymdMatch = str.match(/^(\d{2,6})-(\d{1,2})-(\d{1,2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    const year = Number(y);
    if (year < 2020 || year > 2050) {
      return {
        valid: false,
        error: `Năm ${y} không hợp lệ. Năm phải là 4 chữ số từ 2020 đến 2050.`,
      };
    }
    const month = Number(m);
    if (month < 1 || month > 12) {
      return { valid: false, error: `Tháng ${m} không hợp lệ (từ 01 đến 12).` };
    }
    const day = Number(d);
    if (day < 1 || day > 31) {
      return { valid: false, error: `Ngày ${d} không hợp lệ (từ 01 đến 31).` };
    }
    return {
      valid: true,
      normalized: `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`,
    };
  }

  // 4. Month/year format: "mm/yyyy" or "Tháng mm/yyyy"
  const monthYearMatch = str.match(/^(?:Tháng\s+)?(\d{1,2})\/(\d{4})$/i);
  if (monthYearMatch) {
    const [, m, y] = monthYearMatch;
    const year = Number(y);
    if (year < 2020 || year > 2050) {
      return {
        valid: false,
        error: `Năm ${y} không hợp lệ. Năm phải là 4 chữ số từ 2020 đến 2050.`,
      };
    }
    const month = Number(m);
    if (month < 1 || month > 12) {
      return { valid: false, error: `Tháng ${m} không hợp lệ (từ 01 đến 12).` };
    }
    return { valid: true, normalized: `Tháng ${m.padStart(2, "0")}/${y}` };
  }

  // 5. Accepted standardized descriptive phrases
  const acceptedPhrases = [
    "đang cập nhật",
    "thông báo sau",
    "chưa xác định",
    "tba",
    "theo thông báo của btc",
  ];
  if (acceptedPhrases.includes(str.toLowerCase())) {
    return { valid: true, normalized: str };
  }

  return {
    valid: false,
    error: "Định dạng ngày không hợp lệ. Vui lòng nhập theo quy ước dd/mm/yyyy (ví dụ: 20/02/2027).",
  };
}

export interface OpportunityFormValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  sanitized?: Partial<Opportunity>;
}

/**
 * Validates and sanitizes opportunity form inputs before writing to Firestore.
 * Strictly guarantees all required fields and type constraints defined in firestore.rules.
 */
export function validateOpportunityForm(data: Partial<Opportunity>): OpportunityFormValidationResult {
  const errors: Record<string, string> = {};

  // 1. Title validation
  const title = (data.title || "").trim();
  if (!title) {
    errors.title = "Vui lòng nhập tên hội thảo / cơ hội NCKH (bắt buộc).";
  } else if (title.length > 300) {
    errors.title = "Tên hội thảo không được vượt quá 300 ký tự.";
  }

  // 2. Organizer validation
  const organizer = (data.organizer || "").trim();
  if (!organizer) {
    errors.organizer = "Vui lòng nhập đơn vị tổ chức (bắt buộc theo quy định kiểm tra).";
  } else if (organizer.length > 200) {
    errors.organizer = "Đơn vị tổ chức không được vượt quá 200 ký tự.";
  }

  // 3. Country validation
  const country = (data.country || "").trim() || "Việt Nam";
  if (country.length > 100) {
    errors.country = "Tên quốc gia không được vượt quá 100 ký tự.";
  }

  // 4. Type & Level validation
  const type: OpportunityType = OPPORTUNITY_TYPES.includes(data.type as any)
    ? (data.type as OpportunityType)
    : "Hội thảo";
  const level: OpportunityLevel = OPPORTUNITY_LEVELS.includes(data.level as any)
    ? (data.level as OpportunityLevel)
    : "Quốc tế";

  // 5. Category (TN vs QT)
  let category: "TN" | "QT" = data.category === "TN" || data.category === "QT"
    ? data.category
    : (level === "Quốc tế" ? "QT" : "TN");

  // 6. Deadline validation (Required)
  const rawDeadline = data.deadline;
  if (!rawDeadline || !String(rawDeadline).trim()) {
    errors.deadline = "Vui lòng nhập hạn nộp bài chính (bắt buộc).";
  } else {
    const check = validateAndNormalizeDate(String(rawDeadline));
    if (!check.valid) {
      errors.deadline = check.error || "Hạn nộp bài không hợp lệ.";
    }
  }

  // 7. Optional date fields validation
  const optDateFields: Array<{ key: keyof Opportunity; label: string }> = [
    { key: "abstractDeadline", label: "Hạn nộp tóm tắt (Abstract)" },
    { key: "fullPaperDeadline", label: "Hạn toàn văn (Full paper)" },
    { key: "registrationDeadline", label: "Hạn đăng ký" },
    { key: "eventDate", label: "Ngày tổ chức hội thảo" },
  ];

  for (const field of optDateFields) {
    const val = (data as any)[field.key];
    if (val && String(val).trim()) {
      const check = validateAndNormalizeDate(String(val));
      if (!check.valid) {
        errors[field.key] = check.error || `${field.label} không hợp lệ.`;
      }
    }
  }

  // 8. Field, Topic, Tags
  const field = (data.field || "").trim() || "Chung Khoa MTCN";
  if (field.length > 200) {
    errors.field = "Ngành MTCN không được vượt quá 200 ký tự.";
  }

  const topic = (data.topic || "").trim() || field || title || "Nghiên cứu khoa học";
  if (topic.length > 300) {
    errors.topic = "Chủ đề không được vượt quá 300 ký tự.";
  }

  const tags = Array.isArray(data.tags) && data.tags.length > 0
    ? data.tags.filter((t) => typeof t === "string" && t.trim().length > 0)
    : ["Rất phù hợp MTCN"];
  if (tags.length > 30) {
    errors.tags = "Không được chọn quá 30 thẻ phân loại.";
  }

  // 9. Content / Summary
  const content = (data.content || "").trim() || title || "Thông tin cơ hội NCKH";
  if (content.length > 50000) {
    errors.content = "Nội dung tóm tắt quá dài (tối đa 50.000 ký tự).";
  }

  // 10. URLs
  if (data.sourceUrl && String(data.sourceUrl).length > 500) {
    errors.sourceUrl = "Link nguồn không được vượt quá 500 ký tự.";
  }
  if (data.submissionUrl && String(data.submissionUrl).length > 500) {
    errors.submissionUrl = "Link nộp bài không được vượt quá 500 ký tự.";
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  // Construct sanitized output guaranteed to pass isValidOpportunity rules
  const deadlineNorm = validateAndNormalizeDate(String(data.deadline)).normalized || String(data.deadline).trim();

  const sanitized: Partial<Opportunity> = {
    title,
    organizer,
    country,
    type,
    level,
    category,
    topic,
    field,
    tags,
    deadline: deadlineNorm,
    content,
    status: data.status || "published",
    sourceType: data.sourceType || "ADMIN",
  };

  // Optional string fields (only include if non-empty string)
  const optStringKeys: Array<keyof Opportunity> = [
    "location", "fee", "publicationFormat", "indexing",
    "submissionUrl", "sourceUrl", "directions", "suitability",
    "notes", "publicationFee", "registrationFee", "feeSourceUrl",
    "detailedContent", "conferenceCode"
  ];

  for (const k of optStringKeys) {
    const val = (data as any)[k];
    if (typeof val === "string" && val.trim().length > 0) {
      (sanitized as any)[k] = val.trim();
    }
  }

  // Normalized optional date fields
  for (const f of optDateFields) {
    const val = (data as any)[f.key];
    if (val && String(val).trim()) {
      const check = validateAndNormalizeDate(String(val));
      if (check.normalized) {
        (sanitized as any)[f.key] = check.normalized;
      }
    }
  }

  // Topics detailed (list)
  if (Array.isArray(data.topicsDetailed) && data.topicsDetailed.length > 0) {
    sanitized.topicsDetailed = data.topicsDetailed;
  }

  // Fee status enum
  if (data.feeStatus && ["SPECIFIED", "UNKNOWN", "FREE"].includes(data.feeStatus)) {
    sanitized.feeStatus = data.feeStatus;
  }

  return { isValid: true, errors: {}, sanitized };
}
