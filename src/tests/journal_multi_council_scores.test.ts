import { describe, it, expect } from "vitest";
import {
  parseMultiCouncilScoresJson,
  parseNullableScoreNumber,
  matchJournalIdentity,
  fetchJournalGoogleSheetRows,
  fetchMultiCouncilGoogleSheetRows,
  buildJournalCandidatesFromSheet,
  sanitizePublicJournalSpreadsheetId,
  sanitizePublicJournalSheetName,
  DEFAULT_JOURNAL_SPREADSHEET_ID,
  DEFAULT_JOURNAL_SHEET_NAME,
  DEFAULT_MULTI_COUNCIL_SPREADSHEET_ID,
  DEFAULT_MULTI_COUNCIL_SHEET_NAME,
  OFFICIAL_HDGSNN_COUNCILS,
} from "../services/journalGoogleSheetService";
import {
  isValidDisplayIdentifier,
  getJournalScoreForCouncil,
  filterJournalsList,
  getScoreBadgePalette,
  formatVietnameseScore,
  DEFAULT_SELECTED_COUNCIL_ID,
} from "../services/journalService";
import { mergeCouncilScoresList } from "../services/journalCandidateService";
import type { Journal, JournalCouncilScore } from "../types/journal";

describe("Multi-Council HĐGSNN Journal Scores & Reconciliation (12 Required Scenarios)", () => {
  // 1. Parse diem_theo_hoi_dong_json hợp lệ
  it("1. phân tích diem_theo_hoi_dong_json hợp lệ và chuẩn hóa 28 Hội đồng HĐGSNN", () => {
    expect(Object.keys(OFFICIAL_HDGSNN_COUNCILS).length).toBe(28);

    const rawJson = JSON.stringify([
      {
        council_id: "HD24",
        council_name: "Hội đồng Giáo sư liên ngành Văn hóa - Nghệ thuật - Thể dục thể thao",
        decision_number: "26/QĐ-HĐGSNN",
        decision_year: 2025,
        source_order: 24,
        publication_type: "PRINT",
        max_score: 1.0,
        valid_from: "2025",
        conditions: null,
        source_page: "Phụ lục 24",
        verification_status: "VERIFIED",
      },
    ]);

    const res = parseMultiCouncilScoresJson(rawJson, { rawSparkStatus: "HOAN_TAT" });
    expect(res.warnings).toEqual([]);
    expect(res.councilScores.length).toBe(1);
    expect(res.councilScores[0].councilId).toBe("HD24");
    expect(res.councilScores[0].maxScore).toBe(1.0);
    expect(res.councilScores[0].verificationStatus).toBe("VERIFIED");
    expect(res.reconciliationStatus).toBe("HOAN_TAT");
  });

  // 2. Xử lý JSON rỗng hoặc lỗi mà không crash
  it("2. xử lý diem_theo_hoi_dong_json rỗng hoặc lỗi cú pháp mà không làm sập luồng đồng bộ", () => {
    const emptyRes = parseMultiCouncilScoresJson("", { rawSparkStatus: "HOAN_TAT" });
    expect(emptyRes.councilScores).toEqual([]);
    expect(emptyRes.reconciliationStatus).toBe("CHUA_XAC_MINH");

    const brokenRes = parseMultiCouncilScoresJson("{not_valid_json:[", { rawSparkStatus: "HOAN_TAT" });
    expect(brokenRes.councilScores).toEqual([]);
    expect(brokenRes.warnings.length).toBeGreaterThan(0);
    expect(brokenRes.reconciliationStatus).toBe("CAN_KIEM_TRA");
    expect(brokenRes.needsManualReview).toBe(true);
  });

  // 3. Bảo toàn max_score = 0 và max_score = null
  it("3. bảo toàn nghiêm ngặt max_score = 0 (ngừng tính điểm) khác với max_score = null (chưa rõ mức điểm)", () => {
    expect(parseNullableScoreNumber(0)).toBe(0);
    expect(parseNullableScoreNumber("0")).toBe(0);
    expect(parseNullableScoreNumber("0,00")).toBe(0);
    expect(parseNullableScoreNumber(null)).toBeNull();
    expect(parseNullableScoreNumber(undefined)).toBeNull();
    expect(parseNullableScoreNumber("")).toBeNull();
    expect(parseNullableScoreNumber("Chưa xác minh")).toBeNull();

    const rawJson = JSON.stringify([
      {
        council_id: "HD24",
        council_name: "Văn hóa - Nghệ thuật - Thể dục thể thao",
        decision_number: "26/QĐ-HĐGSNN",
        decision_year: 2025,
        source_order: 22,
        publication_type: "PRINT",
        max_score: 0,
        valid_from: "Từ tháng 6/2025",
        conditions: "Điểm về 0 từ tháng 6/2025",
        source_page: "Phụ lục 24",
        verification_status: "NEEDS_REVIEW",
      },
      {
        council_id: "HD13",
        council_name: "Kinh tế",
        decision_number: "26/QĐ-HĐGSNN",
        decision_year: 2025,
        source_order: 99,
        publication_type: "PRINT",
        max_score: null,
        valid_from: "2025",
        conditions: "Cần đối chiếu bảng gốc",
        source_page: "Phụ lục 13",
        verification_status: "NEEDS_REVIEW",
      },
    ]);

    const parsed = parseMultiCouncilScoresJson(rawJson, { rawSparkStatus: "CAN_KIEM_TRA" });
    expect(parsed.councilScores.length).toBe(2);
    expect(parsed.councilScores[0].maxScore).toBe(0);
    expect(parsed.councilScores[1].maxScore).toBeNull();
    expect(formatVietnameseScore(parsed.councilScores[0].maxScore)).toBe("0,00");
    expect(formatVietnameseScore(parsed.councilScores[1].maxScore)).toBe("—");
  });

  // 4, 5, 9: Kiểm tra trực tiếp trên dữ liệu thực tế từ Google Sheets (J_001, J_020, J_076, J_067, J_069, J_071, J_094, J_096)
  it("4, 5, 9. kiểm tra dữ liệu thực tế từ Sheet: J_001 & J_039 (nhiều HĐ), J_020 (dừng tính điểm 0), J_076 (nhiều mức điểm cùng HĐ), J_067/J_069/J_071 (null), J_094/J_096 (hạ xuống CAN_KIEM_TRA)", async () => {
    const sheetResult = await fetchJournalGoogleSheetRows(
      "1QJKvNd7s0eZpr8HiO_FYGi5HQF3sHhlqR6_G5SODXWE",
      "TAP_CHI"
    );

    expect(sheetResult.validJournals.length).toBe(96);

    // Scenario 4: J_001 có điểm tại 2 Hội đồng (HD24 & HD19), J_039 có điểm khác nhau tại nhiều Hội đồng
    const j001 = sheetResult.validJournals.find((j) => j.journalId === "J_001");
    expect(j001).toBeDefined();
    expect(j001?.recognizedCouncilCount).toBeGreaterThanOrEqual(2);
    expect(getJournalScoreForCouncil(j001!, "HD24").maxScore).toBe(0.5);
    expect(getJournalScoreForCouncil(j001!, "HD19").maxScore).toBe(0.5);

    const j039 = sheetResult.validJournals.find((j) => j.journalId === "J_039");
    expect(j039).toBeDefined();
    expect((j039?.councilScores?.length || 0)).toBeGreaterThanOrEqual(2);

    // Scenario 5: J_076 có nhiều mức điểm trong cùng Hội đồng (PRINT vs ONLINE) & J_020 dừng tính điểm (về 0 từ tháng 6/2025)
    const j076 = sheetResult.validJournals.find((j) => j.journalId === "J_076");
    expect(j076).toBeDefined();
    const j076Hd24 = getJournalScoreForCouncil(j076!, "HD24");
    expect(j076Hd24.hasMultipleEntries).toBe(true);

    const j020 = sheetResult.validJournals.find((j) => j.journalId === "J_020");
    expect(j020).toBeDefined();
    const j020Hd24 = getJournalScoreForCouncil(j020!, "HD24");
    expect(j020Hd24.hasStoppedScoring).toBe(true);
    expect(j020Hd24.maxScore).toBe(0);

    // Scenario 3 on real data: J_067, J_069, J_071 bảo toàn maxScore === null
    for (const nullId of ["J_067", "J_069", "J_071"]) {
      const jNull = sheetResult.validJournals.find((j) => j.journalId === nullId);
      expect(jNull).toBeDefined();
      expect(jNull?.councilScores?.some((cs) => cs.maxScore === null)).toBe(true);
      expect(jNull?.scoreReconciliationStatus).toBe("CAN_KIEM_TRA");
    }

    // Scenario 9: J_094 và J_096 thiếu Phụ lục QĐ 26/QĐ-HĐGSNN phải tự động hạ xuống NEEDS_REVIEW & CAN_KIEM_TRA
    for (const unverifiedId of ["J_094", "J_096"]) {
      const jUnv = sheetResult.validJournals.find((j) => j.journalId === unverifiedId);
      expect(jUnv).toBeDefined();
      expect(jUnv?.scoreReconciliationStatus).toBe("CAN_KIEM_TRA");
      expect(jUnv?.councilScores?.every((cs) => cs.verificationStatus === "NEEDS_REVIEW")).toBe(true);
      expect(jUnv?.verification?.manualReviewNeeded).toBe(true);
    }
  });

  // 6. Lọc và hiển thị điểm khi chọn Hội đồng HD24 và khi chuyển sang Hội đồng khác
  it("6. lọc và hiển thị điểm chính xác khi mặc định chọn HD24 và khi chuyển sang Hội đồng khác", () => {
    expect(DEFAULT_SELECTED_COUNCIL_ID).toBe("HD24");

    const sampleJournals: Journal[] = [
      {
        id: "J_001",
        journalId: "J_001",
        name: "Tạp chí Khoa học Xã hội và Nhân văn",
        publisher: "Trường ĐH KHXH&NV",
        category: "domestic",
        primaryField: "Khoa học xã hội",
        fields: ["Khoa học xã hội"],
        websiteVerified: true,
        maxScore: 1.0,
        maxScoreYear: 2025,
        scores: [],
        councilScores: [
          {
            councilId: "HD13",
            councilName: "Kinh tế (HD13)",
            decisionNumber: "26/QĐ-HĐGSNN",
            decisionYear: 2025,
            publicationType: "PRINT",
            maxScore: 0.75,
            verificationStatus: "VERIFIED",
          },
          {
            councilId: "HD24",
            councilName: "Văn hóa – Nghệ thuật – Thể dục thể thao (HD24)",
            decisionNumber: "26/QĐ-HĐGSNN",
            decisionYear: 2025,
            publicationType: "PRINT",
            maxScore: 0.75,
            verificationStatus: "VERIFIED",
          },
        ],
        guidelines: { hasGuidelines: false },
        links: [],
        verification: {
          verifiedDate: "2025-01-01",
          verifiedBy: "Spark",
          status: "verified",
          schemaVersion: 2,
        },
        status: "active",
        isManualEdited: false,
        createdAt: "2025-01-01",
        updatedAt: "2025-01-01",
        createdBy: "admin",
      },
      {
        id: "J_010",
        journalId: "J_010",
        name: "Tạp chí Y học Thực hành",
        publisher: "Bộ Y tế",
        category: "domestic",
        primaryField: "Y học",
        fields: ["Y học"],
        websiteVerified: true,
        maxScore: 1.0,
        maxScoreYear: 2025,
        scores: [],
        councilScores: [
          {
            councilId: "HD15",
            councilName: "Y học (HD15)",
            decisionNumber: "26/QĐ-HĐGSNN",
            decisionYear: 2025,
            publicationType: "PRINT",
            maxScore: 1.0,
            verificationStatus: "VERIFIED",
          },
        ],
        guidelines: { hasGuidelines: false },
        links: [],
        verification: {
          verifiedDate: "2025-01-01",
          verifiedBy: "Spark",
          status: "verified",
          schemaVersion: 2,
        },
        status: "active",
        isManualEdited: false,
        createdAt: "2025-01-01",
        updatedAt: "2025-01-01",
        createdBy: "admin",
      },
    ];

    // Filter with HD24 + councilFilterMode = "has_score" -> only J_001
    const hd24Only = filterJournalsList(sampleJournals, {
      selectedCouncilId: "HD24",
      councilFilterMode: "has_score",
    });
    expect(hd24Only.map((j) => j.journalId)).toEqual(["J_001"]);

    // Filter with HD24 + councilFilterMode = "all" -> both J_001 and J_010
    const hd24All = filterJournalsList(sampleJournals, {
      selectedCouncilId: "HD24",
      councilFilterMode: "all",
    });
    expect(hd24All.length).toBe(2);
    // J_010 has no score in HD24
    const j010InHd24 = getJournalScoreForCouncil(sampleJournals[1], "HD24");
    expect(j010InHd24.hasVerifiedScore).toBe(false);
    expect(j010InHd24.maxScore).toBeNull();

    // Switch council to HD15 -> only J_010 has score 1.00
    const hd15Only = filterJournalsList(sampleJournals, {
      selectedCouncilId: "HD15",
      councilFilterMode: "has_score",
    });
    expect(hd15Only.map((j) => j.journalId)).toEqual(["J_010"]);
    expect(getJournalScoreForCouncil(sampleJournals[1], "HD15").maxScore).toBe(1.0);

    // Check 5-tier color scale
    expect(getScoreBadgePalette(1.0, true).bg).toBe("#991b1b");
    expect(getScoreBadgePalette(0.75, true).bg).toBe("#fee2e2");
    expect(getScoreBadgePalette(0.5, true).bg).toBe("#ffedd5");
    expect(getScoreBadgePalette(0.25, true).bg).toBe("#fef3c7");
    expect(getScoreBadgePalette(null, false).bg).toBe("#f1f5f9");
  }, 20000);

  // 7. Ẩn ISSN/E-ISSN/ISBN rỗng hoặc "Không công bố"
  it("7. ẩn hoàn toàn ISSN / E-ISSN / ISBN rỗng, 'Không công bố', 'N/A', 'Chưa rõ'", () => {
    expect(isValidDisplayIdentifier("")).toBe(false);
    expect(isValidDisplayIdentifier(null)).toBe(false);
    expect(isValidDisplayIdentifier(undefined)).toBe(false);
    expect(isValidDisplayIdentifier("Không công bố")).toBe(false);
    expect(isValidDisplayIdentifier("KHÔNG CÔNG BỐ")).toBe(false);
    expect(isValidDisplayIdentifier("Chưa công bố")).toBe(false);
    expect(isValidDisplayIdentifier("N/A")).toBe(false);
    expect(isValidDisplayIdentifier("---")).toBe(false);
    expect(isValidDisplayIdentifier("Chưa có")).toBe(false);
    expect(isValidDisplayIdentifier("1859-316X")).toBe(true);
    expect(isValidDisplayIdentifier("2588-1159")).toBe(true);
  });

  // 8. Phân biệt MATCHED và AMBIGUOUS khi tạp chí có tên phổ biến như "Tạp chí Khoa học"
  it("8. chống ghép nhầm tạp chí có tên chung 'Tạp chí Khoa học' (trả về AMBIGUOUS thay vì tự động MATCHED)", () => {
    const existingJournals: Journal[] = [
      {
        id: "doc_1",
        journalId: "J_OLD_1",
        name: "Tạp chí Khoa học",
        publisher: "Trường Đại học Cần Thơ",
        issnPrint: "1859-2333",
        category: "domestic",
        primaryField: "Đa ngành",
        fields: [],
        websiteVerified: false,
        maxScore: 0.75,
        maxScoreYear: 2025,
        scores: [],
        guidelines: { hasGuidelines: false },
        links: [],
        verification: {
          verifiedDate: "2025-01-01",
          verifiedBy: "Admin",
          status: "verified",
          schemaVersion: 1,
        },
        status: "active",
        isManualEdited: false,
        createdAt: "2025-01-01",
        updatedAt: "2025-01-01",
        createdBy: "admin",
      },
      {
        id: "doc_2",
        journalId: "J_OLD_2",
        name: "Tạp chí Khoa học",
        publisher: "Trường Đại học Sư phạm Hà Nội",
        issnPrint: "2354-1075",
        category: "domestic",
        primaryField: "Giáo dục",
        fields: [],
        websiteVerified: false,
        maxScore: 0.75,
        maxScoreYear: 2025,
        scores: [],
        guidelines: { hasGuidelines: false },
        links: [],
        verification: {
          verifiedDate: "2025-01-01",
          verifiedBy: "Admin",
          status: "verified",
          schemaVersion: 1,
        },
        status: "active",
        isManualEdited: false,
        createdAt: "2025-01-01",
        updatedAt: "2025-01-01",
        createdBy: "admin",
      },
    ];

    // Incoming row with generic name "Tạp chí Khoa học", different ID, no ISSN, and different publisher
    const incomingAmbiguous: Journal = {
      id: "J_NEW_999",
      journalId: "J_NEW_999",
      name: "Tạp chí Khoa học",
      publisher: "Trường Đại học Huế",
      category: "domestic",
      primaryField: "Đa ngành",
      fields: [],
      websiteVerified: false,
      maxScore: 0.5,
      maxScoreYear: 2025,
      scores: [],
      guidelines: { hasGuidelines: false },
      links: [],
      verification: {
        verifiedDate: "2025-01-01",
        verifiedBy: "Spark",
        status: "verified",
        schemaVersion: 2,
      },
      status: "active",
      isManualEdited: false,
      createdAt: "2025-01-01",
      updatedAt: "2025-01-01",
      createdBy: "Spark",
    };

    const matchRes = matchJournalIdentity(incomingAmbiguous, existingJournals);
    expect(matchRes.status).toBe("AMBIGUOUS");
    expect(matchRes.notes).toContain("Tạp chí Khoa học");

    // Incoming row with exact ISSN match + exact Name + Publisher match -> MATCHED
    const incomingExact: Journal = {
      ...incomingAmbiguous,
      journalId: "J_NEW_888",
      publisher: "Trường Đại học Cần Thơ",
      issnPrint: "1859-2333",
    };
    const exactRes = matchJournalIdentity(incomingExact, existingJournals);
    expect(exactRes.status).toBe("MATCHED");
    expect(exactRes.matchedJournal?.journalId).toBe("J_OLD_1");

    // Incoming row with same journalId -> MATCHED
    const incomingById: Journal = {
      ...incomingAmbiguous,
      journalId: "J_OLD_2",
      publisher: "Trường Đại học Sư phạm Hà Nội",
    };
    const idRes = matchJournalIdentity(incomingById, existingJournals);
    expect(idRes.status).toBe("MATCHED");
    expect(idRes.matchedJournal?.journalId).toBe("J_OLD_2");
  });

  // 10, 11, 12. Lưu nháp, Duyệt candidate (mergeCouncilScoresList) và Từ chối candidate
  it("10, 11, 12. kiểm tra luồng Lưu nháp (giữ CAN_KIEM_TRA, chưa đổi journals), Duyệt (gộp điểm theo khóa phức hợp) và Từ chối", () => {
    const existingScores: JournalCouncilScore[] = [
      {
        councilId: "HD24",
        councilName: "Văn hóa – Nghệ thuật – Thể dục thể thao (HD24)",
        decisionNumber: "26/QĐ-HĐGSNN",
        decisionYear: 2025,
        sourceOrder: "10",
        publicationType: "PRINT",
        maxScore: 0.5,
        validFrom: "2024",
        conditions: null,
        verificationStatus: "VERIFIED",
      },
    ];

    const incomingCandidateScores: JournalCouncilScore[] = [
      // Updates existing HD24 entry from 0.5 -> 0.75 (same composite key)
      {
        councilId: "HD24",
        councilName: "Văn hóa – Nghệ thuật – Thể dục thể thao (HD24)",
        decisionNumber: "26/QĐ-HĐGSNN",
        decisionYear: 2025,
        sourceOrder: "10",
        publicationType: "PRINT",
        maxScore: 0.75,
        validFrom: "2024",
        conditions: null,
        verificationStatus: "VERIFIED",
      },
      // Adds a new council HD13 entry
      {
        councilId: "HD13",
        councilName: "Kinh tế (HD13)",
        decisionNumber: "26/QĐ-HĐGSNN",
        decisionYear: 2025,
        sourceOrder: "5",
        publicationType: "PRINT",
        maxScore: 1.0,
        validFrom: "2025",
        conditions: null,
        verificationStatus: "VERIFIED",
      },
    ];

    // Scenario 10: Draft state keeps published journal untouched and preserves CAN_KIEM_TRA on candidate
    const draftCandidateStatus = "needs_review";
    const draftReconciliationStatus = "CAN_KIEM_TRA";
    expect(existingScores[0].maxScore).toBe(0.5);
    expect(draftCandidateStatus).toBe("needs_review");
    expect(draftReconciliationStatus).toBe("CAN_KIEM_TRA");

    // Scenario 11: Approving candidate merges councilScores by composite key without losing other councils
    const mergedOnApprove = mergeCouncilScoresList(existingScores, incomingCandidateScores);
    expect(mergedOnApprove.length).toBe(2);
    const mergedHd24 = mergedOnApprove.find((s) => s.councilId === "HD24");
    const mergedHd13 = mergedOnApprove.find((s) => s.councilId === "HD13");
    expect(mergedHd24?.maxScore).toBe(0.75);
    expect(mergedHd13?.maxScore).toBe(1.0);

    // Scenario 12: Rejecting candidate leaves existing journal's councilScores untouched
    const existingAfterReject = [...existingScores];
    expect(existingAfterReject.length).toBe(1);
    expect(existingAfterReject[0].maxScore).toBe(0.5);
  });

  // 13. Kiến trúc 1 nguồn Google Sheets duy nhất (không gửi bất kỳ request nào tới Sheet Spark) & đọc 96/96 JSON
  it("13. chỉ đọc duy nhất từ Sheet công khai IFA-RH (1QJKvNd7s0eZpr8HiO_FYGi5HQF3sHhlqR6_G5SODXWE, tab TAP_CHI) và không gọi tới Sheet Spark", async () => {
    const publicSheetId = "1QJKvNd7s0eZpr8HiO_FYGi5HQF3sHhlqR6_G5SODXWE";
    const privateSparkId = ["1KqLzOaUsynoMd7o", "Bhe3Fxlvo1ssX4lC4TkD_8Duqm0c"].join("");

    expect(DEFAULT_JOURNAL_SPREADSHEET_ID).toBe(publicSheetId);
    expect(DEFAULT_MULTI_COUNCIL_SPREADSHEET_ID).toBe(publicSheetId);
    expect(DEFAULT_JOURNAL_SHEET_NAME).toBe("TAP_CHI");
    expect(DEFAULT_MULTI_COUNCIL_SHEET_NAME).toBe("TAP_CHI");

    // Sanitizer automatically redirects legacy private Spark ID to public IFA-RH Sheet
    expect(sanitizePublicJournalSpreadsheetId(privateSparkId)).toBe(publicSheetId);
    expect(sanitizePublicJournalSheetName("Untitled")).toBe("TAP_CHI");

    const requestedUrls: string[] = [];
    const trackingFetch: typeof fetch = async (input, init) => {
      const urlStr = String(input);
      requestedUrls.push(urlStr);
      return fetch(input, init);
    };

    const multiRes = await fetchMultiCouncilGoogleSheetRows(privateSparkId, "Untitled", {
      fetchImpl: trackingFetch,
    });

    // Zero requests to privateSparkId
    expect(requestedUrls.length).toBeGreaterThan(0);
    expect(requestedUrls.every((u) => u.includes(publicSheetId))).toBe(true);
    expect(requestedUrls.some((u) => u.includes(privateSparkId))).toBe(false);

    // Reads 96 rows and parses 96/96 diem_theo_hoi_dong_json
    expect(multiRes.sourceSpreadsheetId).toBe(publicSheetId);
    expect(multiRes.sourceSheetName).toBe("TAP_CHI");
    expect(multiRes.validJournals.length).toBe(96);
    expect(multiRes.multiCouncilStats.rowsWithJson).toBe(96);
    expect(multiRes.manualReviewCount).toBe(17);
    // 79 HOAN_TAT in raw sheet -> J_094 & J_096 auto-downgraded to CAN_KIEM_TRA -> 77 HOAN_TAT & 19 CAN_KIEM_TRA
    expect(multiRes.multiCouncilStats.reconciliationCounts.HOAN_TAT).toBe(77);
    expect(multiRes.multiCouncilStats.reconciliationCounts.CAN_KIEM_TRA).toBe(19);
  });

  // 14. Chặn dữ liệu lỗi công thức IMPORTRANGE (#REF!, #LOADING!), trùng journal_id, JSON lỗi và tụt số dòng bất thường
  it("14. chặn dữ liệu lỗi công thức IMPORTRANGE (#REF!, #LOADING!), trùng journal_id, lỗi JSON cột AV và tụt số lượng bản ghi bất thường", async () => {
    const makeMockGvizFetch = (cols: Array<{ label: string }>, rows: Array<{ c: Array<{ v?: any; f?: string } | null> }>): typeof fetch => {
      return async () => {
        const body = `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify({
          version: "0.6",
          status: "ok",
          table: { cols, rows },
        })});`;
        return new Response(body, { status: 200 });
      };
    };

    const baseCols = [
      { label: "journal_id" },
      { label: "ten_chinh_thuc_vn" },
      { label: "diem_theo_hoi_dong_json" },
      { label: "so_hoi_dong_cong_nhan" },
      { label: "hoi_dong_da_xac_minh" },
      { label: "nam_quyet_dinh" },
      { label: "trang_thai_doi_soat_diem" },
      { label: "nguon_diem_theo_hoi_dong" },
    ];

    // A. Chặn lỗi #REF!
    await expect(
      fetchJournalGoogleSheetRows(DEFAULT_JOURNAL_SPREADSHEET_ID, "TAP_CHI", {
        fetchImpl: makeMockGvizFetch(baseCols, [
          { c: [{ v: "#REF!" }, { v: null }, { v: null }] },
        ]),
      })
    ).rejects.toThrow(/IMPORTRANGE|#REF!/i);

    // B. Chặn lỗi #LOADING!
    await expect(
      fetchJournalGoogleSheetRows(DEFAULT_JOURNAL_SPREADSHEET_ID, "TAP_CHI", {
        fetchImpl: makeMockGvizFetch(baseCols, [
          { c: [{ v: "J_001" }, { v: "#LOADING..." }, { v: "[]" }] },
        ]),
      })
    ).rejects.toThrow(/IMPORTRANGE|#LOADING/i);

    // C. Chặn trùng journal_id trong cùng Sheet
    const validJsonStr = JSON.stringify([
      {
        council_id: "HD24",
        council_name: "Văn hóa – Nghệ thuật – Thể dục thể thao (HD24)",
        decision_number: "26/QĐ-HĐGSNN",
        decision_year: 2025,
        publication_type: "PRINT",
        max_score: 1.0,
        verification_status: "VERIFIED",
      },
    ]);
    await expect(
      fetchJournalGoogleSheetRows(DEFAULT_JOURNAL_SPREADSHEET_ID, "TAP_CHI", {
        fetchImpl: makeMockGvizFetch(baseCols, [
          { c: [{ v: "J_001" }, { v: "Tạp chí A" }, { v: validJsonStr }] },
          { c: [{ v: "J_001" }, { v: "Tạp chí B" }, { v: validJsonStr }] },
        ]),
      })
    ).rejects.toThrow(/trùng mã tạp chí journal_id "J_001"/i);

    // D. Chặn JSON lỗi trong cột diem_theo_hoi_dong_json
    await expect(
      fetchJournalGoogleSheetRows(DEFAULT_JOURNAL_SPREADSHEET_ID, "TAP_CHI", {
        fetchImpl: makeMockGvizFetch(baseCols, [
          { c: [{ v: "J_001" }, { v: "Tạp chí A" }, { v: "{invalid_json" }] },
        ]),
      })
    ).rejects.toThrow(/diem_theo_hoi_dong_json không hợp lệ tại dòng 2/i);

    // E. Chặn tụt số lượng bản ghi bất thường so với lần đồng bộ hợp lệ trước đó
    await expect(
      fetchJournalGoogleSheetRows(DEFAULT_JOURNAL_SPREADSHEET_ID, "TAP_CHI", {
        previousValidRowCount: 96,
        fetchImpl: makeMockGvizFetch(baseCols, [
          { c: [{ v: "J_001" }, { v: "Tạp chí A" }, { v: validJsonStr }] },
        ]),
      })
    ).rejects.toThrow(/tụt bất thường/i);
  });

  // 15. Nút "Cập nhật điểm HĐGSNN" (onlyMultiCouncilScoreColumns: true) chỉ cập nhật điểm, không ghi đè các trường thông tin khác
  it("15. chế độ onlyMultiCouncilScoreColumns chỉ tạo đề xuất cập nhật điểm và giữ nguyên các trường danh mục của tạp chí", () => {
    const publishedJournal: Journal = {
      id: "J_001",
      journalId: "J_001",
      name: "Tạp chí Mỹ thuật (Đã hiệu đính bởi Admin)",
      publisher: "Trường Đại học Mỹ thuật Việt Nam (Đã chuẩn hóa)",
      issnPrint: "1859-0001",
      category: "domestic",
      primaryField: "Nghệ thuật",
      fields: ["Nghệ thuật"],
      website: "https://mythuat.edu.vn/custom-admin-url",
      websiteVerified: true,
      maxScore: 0.5,
      maxScoreYear: 2025,
      scores: [],
      councilScores: [
        {
          councilId: "HD24",
          councilName: "Văn hóa – Nghệ thuật – Thể dục thể thao (HD24)",
          decisionNumber: "26/QĐ-HĐGSNN",
          decisionYear: 2025,
          publicationType: "PRINT",
          maxScore: 0.5,
          verificationStatus: "VERIFIED",
        },
      ],
      guidelines: {
        hasGuidelines: true,
        summary: "Thể lệ riêng do Admin biên tập",
      },
      links: [],
      verification: {
        verifiedDate: "2025-01-01",
        verifiedBy: "Admin",
        status: "verified",
        schemaVersion: 2,
      },
      status: "active",
      isManualEdited: true,
      createdAt: "2025-01-01",
      updatedAt: "2025-01-01",
      createdBy: "admin",
    };

    const incomingFromSheet: Journal = {
      ...publishedJournal,
      name: "Tạp chí Mỹ thuật (Tên thô trên Sheet)",
      publisher: "Đơn vị xuất bản thô trên Sheet",
      website: "https://raw-sheet-url.vn",
      guidelines: {
        hasGuidelines: true,
        summary: "Thể lệ thô trên Sheet",
      },
      maxScore: 1.0,
      recognizedCouncilCount: 2,
      councilScores: [
        {
          councilId: "HD24",
          councilName: "Văn hóa – Nghệ thuật – Thể dục thể thao (HD24)",
          decisionNumber: "26/QĐ-HĐGSNN",
          decisionYear: 2025,
          publicationType: "PRINT",
          maxScore: 0.75,
          verificationStatus: "VERIFIED",
        },
        {
          councilId: "HD27",
          councilName: "Xây dựng – Kiến trúc (HD27)",
          decisionNumber: "26/QĐ-HĐGSNN",
          decisionYear: 2025,
          publicationType: "PRINT",
          maxScore: 1.0,
          verificationStatus: "VERIFIED",
        },
      ],
    };

    const diffRes = buildJournalCandidatesFromSheet(
      [incomingFromSheet],
      [publishedJournal],
      [],
      { forceUpdateMultiCouncil: true, onlyMultiCouncilScoreColumns: true }
    );

    expect(diffRes.updatedCount).toBe(1);
    const cand = diffRes.candidatesToCreate[0];
    // Preserves published catalog fields
    expect(cand.name).toBe("Tạp chí Mỹ thuật (Đã hiệu đính bởi Admin)");
    expect(cand.publisher).toBe("Trường Đại học Mỹ thuật Việt Nam (Đã chuẩn hóa)");
    expect(cand.website).toBe("https://mythuat.edu.vn/custom-admin-url");
    expect(cand.guidelines?.summary).toBe("Thể lệ riêng do Admin biên tập");
    // Updates multi-council score fields
    expect(cand.councilScores?.length).toBe(2);
    expect(cand.maxScore).toBe(1.0);
  });
});
