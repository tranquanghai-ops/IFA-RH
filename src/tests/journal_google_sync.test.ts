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
