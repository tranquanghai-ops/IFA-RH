import { describe, it, expect } from "vitest";
import {
  normalizeHeaderKey,
  parseScoresJson,
  parseGuidelinesValue,
  computeJournalFieldDiffs,
  buildJournalCandidatesFromSheet,
} from "../services/journalGoogleSheetService";
import type { Journal, JournalCandidate } from "../types/journal";

describe("Google Sheets Single-Tab Parser & JSON Handler (QĐ 26/QĐ-HĐGSNN)", () => {
  it("chuẩn hóa header linh hoạt giữa tiếng Việt, tiếng Anh và ký tự đặc biệt", () => {
    expect(normalizeHeaderKey("Tên tạp chí")).toBe("ten_tap_chi");
    expect(normalizeHeaderKey("Journal Name")).toBe("journal_name");
    expect(normalizeHeaderKey("ISSN (Bản in)")).toBe("issn_ban_in");
    expect(normalizeHeaderKey("Điểm HĐGSNN")).toBe("diem_hdgsnn");
    expect(normalizeHeaderKey("scores_json")).toBe("scores_json");
  });

  it("phân tích cú pháp JSON lịch sử điểm HĐGSNN thành công", () => {
    const rawJson = JSON.stringify([
      {
        councilCode: "HDGS_VHNT",
        councilName: "HĐGS Liên ngành Văn hóa - Nghệ thuật - TDTT",
        year: 2025,
        maxScore: 1.0,
        notes: "Tính điểm tất cả bài viết mỹ thuật",
      },
      {
        councilCode: "HDGS_TRIETHOC",
        councilName: "HĐGS Ngành Triết học - Xã hội học",
        year: 2025,
        maxScore: 0.75,
      },
    ]);

    const fallback = { maxScore: 0.5, maxScoreYear: 2025, primaryField: "Mỹ thuật" };
    const scores = parseScoresJson(rawJson, fallback);

    expect(scores.length).toBe(2);
    expect(scores[0].councilCode).toBe("HDGS_VHNT");
    expect(scores[0].maxScore).toBe(1.0);
    expect(scores[1].maxScore).toBe(0.75);
  });

  it("xử lý an toàn khi JSON điểm bị lỗi hoặc để trống, tự động fallback an toàn không crash", () => {
    const brokenJson = "{ this is not a valid json }";
    const fallback = { maxScore: 0.75, maxScoreYear: 2025, primaryField: "Kiến trúc" };

    const scoresBroken = parseScoresJson(brokenJson, fallback);
    expect(scoresBroken.length).toBe(0);

    const scoresEmpty = parseScoresJson("", fallback);
    expect(scoresEmpty.length).toBe(1);
    expect(scoresEmpty[0].maxScore).toBe(0.75);
    expect(scoresEmpty[0].year).toBe(2025);
  });

  it("xử lý thể lệ đăng bài từ chuỗi text hoặc đối tượng JSON có cấu trúc", () => {
    const textGuidelines = parseGuidelinesValue("Bài viết 4000 - 6000 từ, trích dẫn APA", {
      templateUrl: "https://example.com/mau-bai.docx",
    });
    expect(textGuidelines.hasGuidelines).toBe(true);
    expect(textGuidelines.summary).toContain("4000 - 6000 từ");
    expect(textGuidelines.templateUrl).toBe("https://example.com/mau-bai.docx");

    const jsonGuidelines = parseGuidelinesValue(
      JSON.stringify({
        summary: "Quy chuẩn OJS",
        citationStyle: "IEEE",
        wordLimitMin: 3000,
        wordLimitMax: 7000,
      }),
      {}
    );
    expect(jsonGuidelines.hasGuidelines).toBe(true);
    expect(jsonGuidelines.citationStyle).toBe("IEEE");
    expect(jsonGuidelines.wordLimitMin).toBe(3000);
  });
});

describe("Hàng chờ Duyệt & Đồng bộ Không Tạo Trùng (Candidate Queue Logic)", () => {
  const samplePublicJournal: Journal = {
    id: "TC-VHNT-001",
    journalId: "TC-VHNT-001",
    name: "Tạp chí Văn hóa Nghệ thuật",
    publisher: "Bộ Văn hóa, Thể thao và Du lịch",
    issnPrint: "0866-8639",
    category: "domestic",
    primaryField: "Văn hóa - Nghệ thuật",
    fields: ["Văn hóa - Nghệ thuật"],
    website: "http://vanhoanghethuat.vn",
    websiteVerified: true,
    maxScore: 1.0,
    maxScoreYear: 2025,
    scores: [
      {
        councilCode: "HDGS_VHNT",
        councilName: "HĐGS Liên ngành VHNT",
        year: 2025,
        maxScore: 1.0,
      },
    ],
    status: "active",
    isManualEdited: false,
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
    createdBy: "Spark",
  };

  it("phát hiện tạp chí mới từ Google Sheets và tạo candidate changeType = 'create'", () => {
    const newSheetJournal: Journal = {
      ...samplePublicJournal,
      id: "TC-NEW-090",
      journalId: "TC-NEW-090",
      name: "Tạp chí Thiết kế Mới 2026",
      issnPrint: "9999-8888",
    };

    const res = buildJournalCandidatesFromSheet([newSheetJournal], [samplePublicJournal]);
    expect(res.newCount).toBe(1);
    expect(res.updatedCount).toBe(0);
    expect(res.candidatesToCreate.length).toBe(1);
    expect(res.candidatesToCreate[0].changeType).toBe("create");
    expect(res.candidatesToCreate[0].status).toBe("pending");
  });

  it("phát hiện khi một tạp chí đổi điểm HĐGSNN và tạo yêu cầu cập nhật với Diff so sánh", () => {
    const updatedScoreSheetJournal: Journal = {
      ...samplePublicJournal,
      maxScore: 1.25, // Thay đổi từ 1.0 lên 1.25
    };

    const diffs = computeJournalFieldDiffs(samplePublicJournal, updatedScoreSheetJournal);
    expect(diffs.length).toBeGreaterThan(0);
    const scoreDiff = diffs.find((d) => d.field === "maxScore");
    expect(scoreDiff).toBeDefined();
    expect(scoreDiff?.oldValue).toBe(1.0);
    expect(scoreDiff?.newValue).toBe(1.25);

    const res = buildJournalCandidatesFromSheet([updatedScoreSheetJournal], [samplePublicJournal]);
    expect(res.updatedCount).toBe(1);
    expect(res.candidatesToCreate[0].changeType).toBe("update");
    expect(res.candidatesToCreate[0].diffSummary?.length).toBeGreaterThan(0);
  });

  it("phát hiện khi tạp chí đổi website chính thức", () => {
    const updatedWebJournal: Journal = {
      ...samplePublicJournal,
      website: "https://vanhoanghethuat-newportal.vn",
    };

    const diffs = computeJournalFieldDiffs(samplePublicJournal, updatedWebJournal);
    const webDiff = diffs.find((d) => d.field === "website");
    expect(webDiff).toBeDefined();
    expect(webDiff?.newValue).toBe("https://vanhoanghethuat-newportal.vn");
  });

  it("đồng bộ lại nhiều lần không sinh bản ghi trùng trong hàng chờ (idempotent)", () => {
    const existingPendingCandidate: JournalCandidate = {
      id: "cand_pending_1",
      journalId: "TC-VHNT-001",
      name: "Tạp chí Văn hóa Nghệ thuật",
      publisher: "Bộ VHTTDL",
      category: "domestic",
      primaryField: "Văn hóa",
      fields: ["Văn hóa"],
      websiteVerified: false,
      maxScore: 1.25,
      maxScoreYear: 2025,
      scores: [],
      sourceType: "GOOGLE_SHEETS",
      changeType: "update",
      status: "pending",
      unverifiedFields: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const incoming: Journal = {
      ...samplePublicJournal,
      maxScore: 1.25,
    };

    // Khi candidate đã có sẵn trong hàng chờ
    const res = buildJournalCandidatesFromSheet(
      [incoming],
      [samplePublicJournal],
      [existingPendingCandidate]
    );

    expect(res.skippedDuplicates).toBe(1);
    expect(res.candidatesToCreate.length).toBe(0);
  });

  it("bảo toàn dữ liệu đã chỉnh sửa thủ công bởi Admin (isManualEdited = true)", () => {
    const manualEditedJournal: Journal = {
      ...samplePublicJournal,
      name: "Tạp chí Văn hóa Nghệ thuật (Đã hiệu chỉnh tên chính xác)",
      isManualEdited: true,
    };

    const incomingFromSheet: Journal = {
      ...samplePublicJournal,
      name: "Tạp chí VHNT (Bản thô Google Sheets)",
      maxScore: 1.5,
    };

    const res = buildJournalCandidatesFromSheet([incomingFromSheet], [manualEditedJournal]);
    expect(res.candidatesToCreate.length).toBe(1);
    expect(res.candidatesToCreate[0].isManualPreserved).toBe(true);
  });

  it("đảm bảo không xóa tạp chí công khai nếu một dòng bị xóa khỏi Google Sheets", () => {
    // Giả sử Google Sheets chỉ còn 1 dòng, nhưng cơ sở dữ liệu có 3 dòng
    const publicJournals: Journal[] = [
      samplePublicJournal,
      { ...samplePublicJournal, id: "TC-2", journalId: "TC-2", name: "Tạp chí 2" },
      { ...samplePublicJournal, id: "TC-3", journalId: "TC-3", name: "Tạp chí 3" },
    ];

    const sheetRowsOnlyTC1: Journal[] = [samplePublicJournal];

    const res = buildJournalCandidatesFromSheet(sheetRowsOnlyTC1, publicJournals);
    // Không có cơ chế delete tự động nào được tạo
    expect(res.candidatesToCreate.length).toBe(0); // Vì TC-1 không đổi
    expect(publicJournals.length).toBe(3); // Giữ nguyên toàn bộ
  });

  it("phát hiện và cảnh báo đầy đủ các trường chưa xác minh", () => {
    const unverifiedJournal: Journal = {
      ...samplePublicJournal,
      journalId: "TC-UNVERIF",
      website: undefined,
      issnPrint: undefined,
      issnOnline: undefined,
      guidelines: { hasGuidelines: false },
      verification: { status: "unverified", schemaVersion: 1 },
    };

    const res = buildJournalCandidatesFromSheet([unverifiedJournal], []);
    const cand = res.candidatesToCreate[0];
    expect(cand.unverifiedFields).toContain("Chưa có trang chủ");
    expect(cand.unverifiedFields).toContain("Thiếu cả ISSN và E-ISSN");
    expect(cand.unverifiedFields).toContain("Chưa có thể lệ đăng bài");
    expect(cand.unverifiedFields).toContain("Chưa kiểm chứng nguồn");
  });
});

describe("Kiểm tra phân quyền Duyệt Hàng chờ Tạp chí", () => {
  it("chỉ cho phép Admin và Owner duyệt hoặc từ chối tạp chí trong hàng chờ", () => {
    const canReviewCandidate = (role?: string) => role === "admin" || role === "owner";

    expect(canReviewCandidate("lecturer")).toBe(false);
    expect(canReviewCandidate(undefined)).toBe(false);
    expect(canReviewCandidate("admin")).toBe(true);
    expect(canReviewCandidate("owner")).toBe(true);
  });
});

describe("Hệ thống Adapter 47 Cột và Xử lý Điểm Chuyên sâu (QĐ 26/QĐ-HĐGSNN)", () => {
  it("xử lý trường hợp đặc biệt J_020 (Nghiên cứu dân tộc: điểm về 0 từ tháng 6/2025)", async () => {
    const { parseScoreAdapter } = await import("../services/journalGoogleSheetService");
    const adapted = parseScoreAdapter({
      nhomNganhRaw: "Nhóm I",
      tenNhomRaw: "Nhóm tạp chí áp dụng chung cho ngành Văn hóa, Nghệ thuật, Thể dục thể thao",
      phanLoaiRaw: "Toàn tạp chí",
      diem2025Raw: "",
      cacMocRaw: "0 - 0,5 từ 2019; 0 - 0,75 từ 2023; 0 từ tháng 6/2025",
      ghiChuRaw: "ĐẶC BIỆT: Quyết định 26 quy định điểm về 0 từ tháng 6/2025 (dừng tính điểm)",
    });

    expect(adapted.maxScore).toBe(0);
    expect(adapted.maxScoreYear).toBe(2025);
    expect(adapted.scores.length).toBe(1);
    expect(adapted.scores[0].maxScore).toBe(0);
    expect(adapted.scores[0].notes).toContain("0 từ tháng 6/2025");
    expect(adapted.scores[0].notes).toContain("dừng tính điểm");
  });

  it("xử lý trường hợp đặc biệt J_039 (Lý luận Chính trị: 2 nhóm ngành với điểm 0.75 và 1.0)", async () => {
    const { parseScoreAdapter } = await import("../services/journalGoogleSheetService");
    const adapted = parseScoreAdapter({
      nhomNganhRaw: "Nhóm I; Nhóm III",
      tenNhomRaw: "Nhóm I: Nhóm tạp chí áp dụng chung cho ngành VHNT-TDTT | Nhóm III: Nhóm các tạp chí cho ngành Báo chí, truyền thông",
      phanLoaiRaw: "43: Toàn tạp chí | 80: Toàn tạp chí",
      diem2025Raw: "Nhóm I: 0.75 | Nhóm III: 1",
      cacMocRaw: "Nhóm I (TT 43): 0 - 0,5 từ 2024; 0 - 0,75 từ 2025 | Nhóm III (TT 80): 0 - 0,5 từ 2017; 0 - 0,75 từ 2021; 0 - 1,0 từ 2024",
      ghiChuRaw: "Nhóm I: Điểm tại Nhóm I là 0,75 | Nhóm III: Điểm tối đa 1,0 tại ngành Báo chí truyền thông",
    });

    expect(adapted.maxScore).toBe(1.0);
    expect(adapted.scores.length).toBe(2);
    expect(adapted.scores[0].councilCode).toBe("NHOM_I");
    expect(adapted.scores[0].maxScore).toBe(0.75);
    expect(adapted.scores[1].councilCode).toBe("NHOM_III");
    expect(adapted.scores[1].maxScore).toBe(1.0);
  });

  it("xử lý trường hợp đặc biệt J_076 (Lý luận Chính trị và Truyền thông: Bản in 1.0 vs Bản điện tử 0.75)", async () => {
    const { parseScoreAdapter } = await import("../services/journalGoogleSheetService");
    const adapted = parseScoreAdapter({
      nhomNganhRaw: "Nhóm III; Nhóm III",
      tenNhomRaw: "Nhóm III: Báo chí, truyền thông | Nhóm III: Báo chí, truyền thông",
      phanLoaiRaw: "81a: Bản in | 81b: Bản điện tử",
      diem2025Raw: "Nhóm III: 1 | Nhóm III: 0.75",
      cacMocRaw: "Nhóm III (TT 81a): 0 - 0,5; 0 - 0,75 từ 2019; 0 - 1,0 từ 2024 | Nhóm III (TT 81b): 0 - 0,25 từ 2022; 0 - 0,5 từ 2024; 0 - 0,75 từ 2025",
      ghiChuRaw: "Bản in đạt 1,0 | Bản điện tử đạt 0,75",
    });

    expect(adapted.maxScore).toBe(1.0);
    expect(adapted.scores.length).toBe(2);
    expect(adapted.scores[0].councilCode).toBe("NHOM_III_PRINT");
    expect(adapted.scores[0].maxScore).toBe(1.0);
    expect(adapted.scores[1].councilCode).toBe("NHOM_III_ONLINE");
    expect(adapted.scores[1].maxScore).toBe(0.75);
  });

  it("xử lý trường hợp đặc biệt J_080 (Khoa học Đào tạo và huấn luyện Thể thao: Bản in 1.0 vs Bản điện tử 0.5)", async () => {
    const { parseScoreAdapter } = await import("../services/journalGoogleSheetService");
    const adapted = parseScoreAdapter({
      nhomNganhRaw: "Nhóm IV; Nhóm IV",
      tenNhomRaw: "Nhóm IV: Thể dục thể thao | Nhóm IV: Thể dục thể thao",
      phanLoaiRaw: "85a: Bản in | 85b: Bản điện tử",
      diem2025Raw: "Nhóm IV: 1 | Nhóm IV: 0.5",
      cacMocRaw: "Nhóm IV (TT 85a): 0 - 0,5; 0 - 0,75 từ 2019; 0 - 1,0 từ 2025 | Nhóm IV (TT 85b): 0 - 0,5 từ 2025",
    });

    expect(adapted.maxScore).toBe(1.0);
    expect(adapted.scores.length).toBe(2);
    expect(adapted.scores[0].councilCode).toBe("NHOM_IV_PRINT");
    expect(adapted.scores[0].maxScore).toBe(1.0);
    expect(adapted.scores[1].councilCode).toBe("NHOM_IV_ONLINE");
    expect(adapted.scores[1].maxScore).toBe(0.5);
  });

  it("xử lý trường hợp J_042 (Di sản văn hóa: mốc điểm trước 2019)", async () => {
    const { parseScoreAdapter } = await import("../services/journalGoogleSheetService");
    const adapted = parseScoreAdapter({
      nhomNganhRaw: "Nhóm II",
      tenNhomRaw: "Nhóm các Tạp chí trong nước áp dụng cho ngành Văn hóa, Nghệ thuật",
      phanLoaiRaw: "Toàn tạp chí",
      diem2025Raw: "0.75",
      cacMocRaw: "0 - 0,75 trước 2019",
      ghiChuRaw: "Từ 2019 không có mốc điểm mới",
    });

    expect(adapted.maxScore).toBe(0.75);
    expect(adapted.maxScoreYear).toBe(2018);
    expect(adapted.scores[0].notes).toContain("trước 2019");
  });

  it("gán trạng thái needs_review và unverifiedFields cho các hồ sơ có cảnh báo kiểm tra thủ công", async () => {
    const { buildJournalCandidatesFromSheet } = await import("../services/journalGoogleSheetService");
    const manualJournal: Journal = {
      id: "J_020",
      journalId: "J_020",
      name: "Tạp chí Nghiên cứu dân tộc",
      publisher: "Học viện Dân tộc",
      category: "domestic",
      primaryField: "Văn hóa - Nghệ thuật",
      fields: ["Văn hóa - Nghệ thuật"],
      maxScore: 0,
      maxScoreYear: 2025,
      websiteVerified: true,
      scores: [],
      status: "active",
      isManualEdited: false,
      verification: {
        status: "needs_update",
        schemaVersion: 1,
        manualReviewNeeded: true,
        manualReviewReason: "Điểm về 0 từ tháng 6/2025",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "Spark",
    };

    const res = buildJournalCandidatesFromSheet([manualJournal], []);
    expect(res.candidatesToCreate.length).toBe(1);
    const cand = res.candidatesToCreate[0];
    expect(cand.status).toBe("needs_review");
    expect(cand.unverifiedFields.some((f) => f.includes("Điểm về 0 từ tháng 6/2025"))).toBe(true);
  });

  it("phân tích và kiểm tra tính hợp lệ của toàn bộ 96 tạp chí từ Google Sheets Spark", async () => {
    const { fetchJournalGoogleSheetRows, buildJournalCandidatesFromSheet } = await import(
      "../services/journalGoogleSheetService"
    );

    const sheetResult = await fetchJournalGoogleSheetRows(
      "1QJKvNd7s0eZpr8HiO_FYGi5HQF3sHhlqR6_G5SODXWE",
      "Trang tính1"
    );

    expect(sheetResult.totalRows).toBe(96);
    expect(sheetResult.validJournals.length).toBe(96);
    expect(sheetResult.manualReviewCount).toBe(17);

    const analysis = buildJournalCandidatesFromSheet(sheetResult.validJournals, [], []);
    expect(analysis.newCount).toBe(96);
    expect(analysis.candidatesToCreate.length).toBe(96);

    // Validate every candidate against firestore.rules isValidJournalCandidate
    const allowedKeys = new Set([
      'id', 'journalId', 'name', 'englishName', 'abbreviation', 'publisher',
      'hostAgency', 'nameHistory',
      'issnPrint', 'issnOnline', 'isbn', 'category', 'primaryField', 'fields',
      'website', 'websiteVerified', 'maxScore', 'maxScoreYear', 'scores',
      'councilScores', 'recognizedCouncilCount', 'verifiedCouncils',
      'decisionYear', 'scoreReconciliationStatus', 'scoreSourceNote', 'scoreEditHistory',
      'identityMatchStatus', 'identityMatchMethod', 'identityMatchNotes',
      'newScoresCount', 'changedScoresCount', 'draftSavedAt', 'draftSavedBy', 'adminEditReason',
      'guidelines', 'links', 'verification', 'sourceType', 'changeType',
      'existingJournalId', 'diffSummary', 'status', 'rejectionReason',
      'isManualPreserved', 'unverifiedFields', 'sheetRowIndex',
      'createdAt', 'updatedAt', 'reviewedAt', 'reviewedBy', 'publishedJournalId',
      'manualReviewNeeded', 'manualReviewReason', 'confidenceLevel', 'isManualEdited'
    ]);

    const failures: Array<{ id: string; name: string; reason: string; val?: any }> = [];

    analysis.candidatesToCreate.forEach((cand) => {
      // Check required
      const required = [
        'journalId', 'name', 'publisher', 'category', 'primaryField',
        'sourceType', 'changeType', 'status', 'createdAt', 'updatedAt'
      ];
      for (const req of required) {
        if (!(req in cand)) {
          failures.push({ id: cand.journalId, name: cand.name, reason: `Missing required: ${req}` });
        }
      }

      // Check hasOnly
      for (const k of Object.keys(cand)) {
        if (!allowedKeys.has(k)) {
          failures.push({ id: cand.journalId, name: cand.name, reason: `Disallowed key: ${k}` });
        }
      }

      // Check lengths and constraints
      if (typeof cand.name !== 'string' || cand.name.length < 1 || cand.name.length > 300) {
        failures.push({ id: cand.journalId, name: cand.name, reason: `name invalid length: ${cand.name?.length}` });
      }
      if (typeof cand.publisher !== 'string' || cand.publisher.length < 1 || cand.publisher.length > 300) {
        failures.push({ id: cand.journalId, name: cand.name, reason: `publisher invalid length: ${cand.publisher?.length}` });
      }
      if (!['domestic', 'international'].includes(cand.category)) {
        failures.push({ id: cand.journalId, name: cand.name, reason: `category invalid: ${cand.category}` });
      }
      if (typeof cand.primaryField !== 'string' || cand.primaryField.length < 1 || cand.primaryField.length > 200) {
        failures.push({ id: cand.journalId, name: cand.name, reason: `primaryField invalid: ${cand.primaryField}` });
      }
      if (!['GOOGLE_SHEETS', 'SPARK', 'EXCEL', 'MANUAL'].includes(cand.sourceType)) {
        failures.push({ id: cand.journalId, name: cand.name, reason: `sourceType invalid: ${cand.sourceType}` });
      }
      if (!['create', 'update'].includes(cand.changeType)) {
        failures.push({ id: cand.journalId, name: cand.name, reason: `changeType invalid: ${cand.changeType}` });
      }
      if (!['pending', 'approved', 'rejected', 'needs_review'].includes(cand.status)) {
        failures.push({ id: cand.journalId, name: cand.name, reason: `status invalid: ${cand.status}` });
      }
      if ('fields' in cand && (!Array.isArray(cand.fields) || cand.fields.length > 50)) {
        failures.push({ id: cand.journalId, name: cand.name, reason: `fields invalid count: ${cand.fields?.length}` });
      }
      if ('scores' in cand && (!Array.isArray(cand.scores) || cand.scores.length > 100)) {
        failures.push({ id: cand.journalId, name: cand.name, reason: `scores invalid count: ${cand.scores?.length}` });
      }
      if ('councilScores' in cand && (!Array.isArray(cand.councilScores) || cand.councilScores.length > 100)) {
        failures.push({ id: cand.journalId, name: cand.name, reason: `councilScores invalid count: ${cand.councilScores?.length}` });
      }
      if ('unverifiedFields' in cand && (!Array.isArray(cand.unverifiedFields) || cand.unverifiedFields.length > 50)) {
        failures.push({ id: cand.journalId, name: cand.name, reason: `unverifiedFields count: ${cand.unverifiedFields?.length}` });
      }
      if ('maxScoreYear' in cand && cand.maxScoreYear != null && (typeof cand.maxScoreYear !== 'number' || cand.maxScoreYear < 1900 || cand.maxScoreYear > 2100)) {
        failures.push({ id: cand.journalId, name: cand.name, reason: `maxScoreYear invalid: ${cand.maxScoreYear}`, val: cand.maxScoreYear });
      }
      if ('maxScore' in cand && cand.maxScore != null && (typeof cand.maxScore !== 'number' || cand.maxScore < 0 || cand.maxScore > 10)) {
        failures.push({ id: cand.journalId, name: cand.name, reason: `maxScore invalid: ${cand.maxScore}` });
      }
    });

    if (failures.length > 0) {
      console.error("FAILURES DETECTED IN 96 CANDIDATES:", JSON.stringify(failures, null, 2));
    }
    expect(failures).toEqual([]);
  });

  it("khởi tạo và định dạng JournalSyncStageError chính xác với từng giai đoạn và collection", async () => {
    const { JournalSyncStageError } = await import("../services/journalCandidateService");

    const err = new JournalSyncStageError({
      stage: "WRITE_CANDIDATE",
      collectionName: "journalCandidates",
      documentId: "cand_new_TC-001",
      operationType: "create",
      originalError: new Error("Missing or insufficient permissions."),
      userSummary: 'Không đủ quyền lưu ứng viên "Tạp chí Văn hóa Nghệ thuật" (ID: TC-001)',
      actorUid: "owner_123",
      actorRole: "tranquanghai@tdtu.edu.vn",
    });

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("JournalSyncStageError");
    expect(err.stage).toBe("WRITE_CANDIDATE");
    expect(err.collectionName).toBe("journalCandidates");
    expect(err.documentId).toBe("cand_new_TC-001");
    expect(err.message).toContain("WRITE_CANDIDATE");
    expect(err.message).toContain("journalCandidates/cand_new_TC-001");
    expect(err.message).toContain("permission-denied");
  });

  it("đảm bảo đồng bộ lại 96 tạp chí không tạo ứng viên trùng lặp (Idempotency Verification)", async () => {
    const { fetchJournalGoogleSheetRows, buildJournalCandidatesFromSheet } = await import(
      "../services/journalGoogleSheetService"
    );

    const sheetResult = await fetchJournalGoogleSheetRows(
      "1QJKvNd7s0eZpr8HiO_FYGi5HQF3sHhlqR6_G5SODXWE",
      "Trang tính1"
    );

    // Initial sync
    const firstSync = buildJournalCandidatesFromSheet(sheetResult.validJournals, [], []);
    expect(firstSync.candidatesToCreate.length).toBe(96);

    // Simulate existing pending candidates already populated from first sync
    const activePending = firstSync.candidatesToCreate;

    // Second sync: incoming same 96 journals
    const secondSync = buildJournalCandidatesFromSheet(sheetResult.validJournals, [], activePending);
    expect(secondSync.candidatesToCreate.length).toBe(0);
    expect(secondSync.skippedDuplicates).toBe(96);
    expect(secondSync.newCount).toBe(0);
  });
});
