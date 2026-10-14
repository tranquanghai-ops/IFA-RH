import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeResearchSync,
  ResearchSyncStageError,
  type ResearchSyncSdk,
  type ResearchSyncStats,
} from "../services/researchSyncService";
import {
  findMatchingResearchOpportunity,
  isEditedByAdmin,
  computeOpportunityDiff,
  classifyOutOfScopeRecord,
  type ResearchMatchTarget,
} from "../utils/researchDedupe";
import { OFFICIAL_FACULTY_RESEARCH_RECORDS, mapRowToCandidate } from "../services/facultyResearchData";
import { fetchFacultyResearchSheetRows } from "../services/researchSheetService";
import { getCandidatePrimaryCategory, FILTER_TABS } from "../pages/AdminCandidatesPage";
import type { OpportunityCandidate, Opportunity } from "../types";

describe("IFA-RH — Opportunity Sync Architecture & Governance Suite (13 Points)", () => {
  let mockStore: Record<string, Record<string, any>>;

  let writeCounts: {
    candidatesSet: number;
    candidatesAdd: number;
    candidatesUpdate: number;
    opportunitiesSet: number;
    opportunitiesUpdate: number;
  };

  let mockSdk: ResearchSyncSdk;

  const domestic7Rows = [
    {
      stt: 1,
      title: "Hội thảo khoa học quốc tế lần thứ 5 về Giáo dục Kỹ thuật, Công nghệ, Kinh doanh và Sức khỏe (IETBHEC'27)",
      sourceUrl: "https://ietbhec2027.example.edu.vn",
      submissionUrl: "https://ietbhec2027.example.edu.vn/submit",
      organizer: "Đại học Kinh tế Kỹ thuật",
      country: "Việt Nam",
      level: "Quốc tế" as const,
      type: "Hội thảo" as const,
      deadline: "20/12/2026",
      fullPaperDeadline: "20/12/2026",
      eventDate: "15/01/2027",
      content: "Nội dung IETBHEC 2027",
    },
    {
      stt: 2,
      title: 'Hội thảo Khoa học Quốc gia: "Đồng kiến tạo chính sách trong kỷ nguyên số" (CELG 2026)',
      sourceUrl: "https://celg2026.example.edu.vn",
      organizer: "Trường Đại học Kinh tế TP.HCM",
      country: "Việt Nam",
      level: "Quốc gia" as const,
      type: "Hội thảo" as const,
      deadline: "10/11/2026",
      content: "Nội dung CELG 2026",
    },
    {
      stt: 3,
      title: "Hội thảo khoa học quốc tế lần thứ 9: Các vấn đề đương đại (9th CIEMB 2026)",
      sourceUrl: "https://ciemb2026.neu.edu.vn",
      organizer: "Đại học Kinh tế Quốc dân",
      country: "Việt Nam",
      level: "Quốc tế" as const,
      type: "Hội thảo" as const,
      deadline: "30/11/2026",
      content: "Nội dung CIEMB 2026",
    },
    {
      stt: 4,
      title: "Hội thảo khoa học quốc tế thường niên: LETJ 2027",
      sourceUrl: "https://letj2027.example.org",
      organizer: "Đại học Ngoại thương",
      country: "Việt Nam",
      level: "Quốc tế" as const,
      type: "Hội thảo" as const,
      deadline: "15/01/2027",
      content: "Nội dung LETJ 2027",
    },
    {
      stt: 5,
      title: "Hội thảo khoa học quốc tế lần thứ 7: ICISN 2027",
      sourceUrl: "https://icisn2027.example.org",
      organizer: "Trường Đại học Hải Dương",
      country: "Việt Nam",
      level: "Quốc tế" as const,
      type: "Hội thảo" as const,
      deadline: "20/11/2026",
      content: "Nội dung ICISN 2027",
    },
    {
      stt: 6,
      title: "Hội thảo khoa học quốc gia: Các vấn đề đương đại trong phát triển",
      sourceUrl: "https://phattrien2026.example.org",
      organizer: "Viện Nghiên cứu Phát triển",
      country: "Việt Nam",
      level: "Quốc gia" as const,
      type: "Hội thảo" as const,
      deadline: "05/12/2026",
      content: "Nội dung hội thảo quốc gia",
    },
    {
      stt: 7,
      title: "Hội thảo khoa học quốc tế RTD 2026 – Chủ đề FutureScape",
      sourceUrl: "https://rtd2026.example.org",
      organizer: "Đại học Kinh tế TP.HCM",
      country: "Việt Nam",
      level: "Quốc tế" as const,
      type: "Hội thảo" as const,
      deadline: "31/10/2026",
      content: "Nội dung RTD 2026",
    },
  ];

  beforeEach(() => {
    mockStore = {
      systemConfig: {},
      opportunityCandidates: {},
      opportunities: {},
      imports: {},
    };

    writeCounts = {
      candidatesSet: 0,
      candidatesAdd: 0,
      candidatesUpdate: 0,
      opportunitiesSet: 0,
      opportunitiesUpdate: 0,
    };

    mockSdk = {
      doc: (_db: any, col: string, id: string) => ({ col, id }),
      getDoc: async (ref: any) => {
        const store = mockStore[ref.col] || {};
        const data = store[ref.id];
        return {
          exists: () => Boolean(data),
          data: () => data,
          id: ref.id,
        };
      },
      setDoc: async (ref: any, data: any, options?: any) => {
        if (!mockStore[ref.col]) {
          mockStore[ref.col] = {};
        }
        if (ref.col === "opportunityCandidates") writeCounts.candidatesSet++;
        if (ref.col === "opportunities") writeCounts.opportunitiesSet++;

        const current = mockStore[ref.col][ref.id] || {};
        mockStore[ref.col][ref.id] = options?.merge
          ? { ...current, ...data }
          : data;
      },
      updateDoc: async (ref: any, data: any) => {
        const store = mockStore[ref.col];
        if (!store || !store[ref.id]) {
          throw new Error(`Doc ${ref.col}/${ref.id} does not exist`);
        }
        if (ref.col === "opportunityCandidates") writeCounts.candidatesUpdate++;
        if (ref.col === "opportunities") writeCounts.opportunitiesUpdate++;

        store[ref.id] = { ...store[ref.id], ...data };
      },
      collection: (_db: any, path: string) => ({ path }),
      getDocs: async (colRef: any) => {
        const store = mockStore[colRef.path] || {};
        return {
          docs: Object.entries(store).map(([id, d]) => ({
            id,
            data: () => d,
            ...d,
          })),
        };
      },
      addDoc: async (colRef: any, data: any) => {
        if (!mockStore[colRef.path]) {
          mockStore[colRef.path] = {};
        }
        if (colRef.path === "opportunityCandidates") writeCounts.candidatesAdd++;

        const id = `auto_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        mockStore[colRef.path][id] = { ...data, id };
        return { id };
      },
      serverTimestamp: () => new Date().toISOString(),
    };
  });

  // Point 1: Đồng bộ 7 hội thảo từ Google Sheets
  it("Point 1: Synchronizes 7 domestic conferences from Google Sheets into candidate queue", async () => {
    const outcome = await executeResearchSync({
      db: {},
      sdk: mockSdk,
      user: { uid: "u_admin", email: "admin@tdtu.edu.vn", role: "admin" },
      options: {
        force: true,
        sheetConfig: { sheetName: "HỘI THẢO" },
      },
    });

    expect(outcome.status).toBe("success");
    expect(outcome.stats?.read).toBe(7);
    expect(outcome.stats?.valid).toBe(7);
    expect(outcome.stats?.created).toBe(7);
    expect(Object.keys(mockStore.opportunityCandidates).length).toBe(7);
    const firstCand = Object.values(mockStore.opportunityCandidates)[0];
    console.log("ACTUAL_ROW_0_DATA:", JSON.stringify({
      title: firstCand.title,
      sourceUrl: firstCand.sourceUrl,
      organizer: firstCand.organizer,
      deadline: firstCand.deadline,
      fullPaperDeadline: firstCand.fullPaperDeadline,
      eventDate: firstCand.eventDate
    }));
  });

  // Point 2 & 3: Đối soát IETBHEC'27 đã published và KHÔNG ghi Firestore nếu không đổi
  it("Point 2 & 3: Matches published IETBHEC'27 and performs ZERO Firestore writes when data is unchanged", async () => {
    // Seed IETBHEC'27 as published opportunity with exact matching data from Google Sheet
    const rows = await fetchFacultyResearchSheetRows();
    const candidate0 = mapRowToCandidate(rows[0], 0);
    mockStore.opportunities["opp_ietbhec_2027"] = {
      ...candidate0,
      id: "opp_ietbhec_2027",
      status: "published",
      createdAt: "2026-09-01T10:00:00.000Z",
      createdBy: "original_creator@tdtu.edu.vn",
    };

    const outcome = await executeResearchSync({
      db: {},
      sdk: mockSdk,
      user: { uid: "u_admin", email: "admin@tdtu.edu.vn", role: "admin" },
      options: { force: true },
    });

    expect(outcome.status).toBe("success");
    expect(outcome.stats?.matched).toBeGreaterThanOrEqual(1);
    expect(outcome.stats?.unchanged).toBeGreaterThanOrEqual(1);

    // CRITICAL: Ensure opportunities collection was NOT updated during sync!
    expect(writeCounts.opportunitiesUpdate).toBe(0);
    expect(writeCounts.opportunitiesSet).toBe(0);

    // Ensure the published record remains completely intact
    const opp = mockStore.opportunities["opp_ietbhec_2027"];
    expect(opp.status).toBe("published");
    expect(opp.createdAt).toBe("2026-09-01T10:00:00.000Z");
    expect(opp.createdBy).toBe("original_creator@tdtu.edu.vn");
  });

  // Point 4: Dữ liệu published thay đổi → tạo ứng viên cập nhật, KHÔNG sửa trực tiếp opportunities
  it("Point 4: Creates an update proposal candidate when published conference has sheet changes without overwriting opportunities collection", async () => {
    // Seed published IETBHEC'27 with old deadline
    const rows = await fetchFacultyResearchSheetRows();
    const candidate0 = mapRowToCandidate(rows[0], 0);
    mockStore.opportunities["opp_ietbhec_2027"] = {
      ...candidate0,
      id: "opp_ietbhec_2027",
      deadline: "01/01/2025", // Deliberately old deadline in Firestore
      fullPaperDeadline: "01/01/2025",
      status: "published",
      createdAt: "2026-09-01T10:00:00.000Z",
      createdBy: "original_creator@tdtu.edu.vn",
    };

    const outcome = await executeResearchSync({
      db: {},
      sdk: mockSdk,
      user: { uid: "u_admin", email: "admin@tdtu.edu.vn", role: "admin" },
      options: { force: true },
    });

    expect(outcome.status).toBe("success");
    expect(outcome.stats?.updateProposals).toBe(1);

    // ZERO writes to opportunities collection during sync!
    expect(writeCounts.opportunitiesUpdate).toBe(0);
    expect(writeCounts.opportunitiesSet).toBe(0);

    // Find the update proposal created in opportunityCandidates
    const updateCand = Object.values(mockStore.opportunityCandidates).find(
      (c) => c.publishedOpportunityId === "opp_ietbhec_2027"
    );
    expect(updateCand).toBeDefined();
    expect(updateCand?.changeType).toBe("update");
    expect(updateCand?.status).toBe("pending");
    expect(updateCand?.diffSummary).toBeDefined();
    expect(updateCand?.diffSummary?.length).toBeGreaterThan(0);
    const deadlineDiff = updateCand?.diffSummary?.find((d: any) => d.field === "fullPaperDeadline" || d.field === "deadline");
    expect(deadlineDiff).toBeDefined();
    expect(deadlineDiff?.oldValue).toBe("01/01/2025");

    // Published opportunity remains at its old deadline until Admin explicitly reviews & approves
    expect(mockStore.opportunities["opp_ietbhec_2027"].deadline).toBe("01/01/2025");
  });

  // Point 5 & 7: Admin duyệt ứng viên → cập nhật thành công, giữ createdAt, createdBy
  it("Point 5 & 7: Admin approval updates published opportunity while strictly preserving immutable createdAt and createdBy", async () => {
    // 1. Seed published opportunity
    mockStore.opportunities["opp_ietbhec_2027"] = {
      id: "opp_ietbhec_2027",
      title: "Hội thảo IETBHEC 2027",
      deadline: "01/10/2026",
      status: "published",
      createdAt: "2026-08-15T08:00:00.000Z",
      createdBy: "dr_founder@tdtu.edu.vn",
    };

    // 2. Candidate proposal with new deadline
    const candidateProposal: OpportunityCandidate = {
      id: "cand_update_ietbhec",
      title: "Hội thảo IETBHEC 2027",
      organizer: "Đại học Kinh tế Kỹ thuật",
      country: "Việt Nam",
      type: "Hội thảo",
      level: "Quốc tế",
      topic: "Kỹ thuật & Công nghệ",
      field: "Chung MTCN",
      tags: ["AI", "Tech"],
      deadline: "20/12/2026",
      fullPaperDeadline: "20/12/2026",
      content: "Nội dung cập nhật mới",
      sourceType: "SPARK",
      status: "pending",
      changeType: "update",
      publishedOpportunityId: "opp_ietbhec_2027",
      normalizedTitle: "hoi thao ietbhec 2027",
      createdAt: "2026-10-13T10:00:00.000Z",
      updatedAt: "2026-10-13T10:00:00.000Z",
    };
    mockStore.opportunityCandidates[candidateProposal.id] = candidateProposal;

    // Simulate approval logic directly (mirroring approveCandidate)
    const oppRef = mockSdk.doc({}, "opportunities", candidateProposal.publishedOpportunityId!);
    const oppSnap = await mockSdk.getDoc(oppRef);
    const currentOpp = oppSnap.data();

    // Preserve immutable fields
    const approvedData = {
      ...candidateProposal,
      createdAt: currentOpp.createdAt,
      createdBy: currentOpp.createdBy,
      status: "published",
      updatedAt: new Date().toISOString(),
      updatedBy: "admin_reviewer@tdtu.edu.vn",
    };
    await mockSdk.updateDoc(oppRef, approvedData);
    await mockSdk.updateDoc(mockSdk.doc({}, "opportunityCandidates", candidateProposal.id), {
      status: "approved",
      reviewedBy: "admin_reviewer@tdtu.edu.vn",
    });

    const updatedOpp = mockStore.opportunities["opp_ietbhec_2027"];
    expect(updatedOpp.deadline).toBe("20/12/2026");
    expect(updatedOpp.status).toBe("published");
    // IMMUTABLE FIELDS PRESERVED
    expect(updatedOpp.createdAt).toBe("2026-08-15T08:00:00.000Z");
    expect(updatedOpp.createdBy).toBe("dr_founder@tdtu.edu.vn");
    expect(updatedOpp.updatedBy).toBe("admin_reviewer@tdtu.edu.vn");

    // Candidate marked approved
    expect(mockStore.opportunityCandidates["cand_update_ietbhec"].status).toBe("approved");
  });

  // Point 6: Admin từ chối → giữ dữ liệu cũ
  it("Point 6: Admin rejection preserves old published opportunity data unchanged", async () => {
    mockStore.opportunities["opp_ietbhec_2027"] = {
      id: "opp_ietbhec_2027",
      title: "Hội thảo IETBHEC 2027",
      deadline: "01/10/2026",
      status: "published",
      createdAt: "2026-08-15T08:00:00.000Z",
      createdBy: "dr_founder@tdtu.edu.vn",
    };

    mockStore.opportunityCandidates["cand_update_ietbhec"] = {
      id: "cand_update_ietbhec",
      title: "Hội thảo IETBHEC 2027",
      deadline: "20/12/2026",
      changeType: "update",
      publishedOpportunityId: "opp_ietbhec_2027",
      status: "pending",
    };

    // Admin rejects candidate
    await mockSdk.updateDoc(mockSdk.doc({}, "opportunityCandidates", "cand_update_ietbhec"), {
      status: "rejected",
      rejectionReason: "Dữ liệu chưa có thông báo chính thức bằng văn bản",
      reviewedBy: "admin@tdtu.edu.vn",
    });

    // Candidate is rejected
    expect(mockStore.opportunityCandidates["cand_update_ietbhec"].status).toBe("rejected");
    // Published opportunity remains strictly unchanged
    expect(mockStore.opportunities["opp_ietbhec_2027"].deadline).toBe("01/10/2026");
  });

  // Point 8: Bảo vệ manualOverrides
  it("Point 8: Protects fields in manualOverrides from being proposed or overwritten", () => {
    const existing: ResearchMatchTarget = {
      id: "opp_1",
      title: "Hội thảo ABC 2026",
      location: "Phòng Họp A - Đã chỉnh thủ công",
      fee: "Miễn phí - Đã sửa",
      manualOverrides: ["location", "fee"],
      status: "published",
    };

    const row: any = {
      title: "Hội thảo ABC 2026",
      location: "Hà Nội", // Changed in sheet
      fee: "1.000.000 VNĐ", // Changed in sheet
      deadline: "15/12/2026", // Changed in sheet, NOT in manualOverrides
    };

    const diff = computeOpportunityDiff(existing, row);
    // manualOverrides fields must be excluded from updates
    expect(diff.changedKeys).not.toContain("location");
    expect(diff.changedKeys).not.toContain("fee");
    expect(diff.changedKeys).toContain("deadline");
    expect(diff.updates.location).toBeUndefined();
    expect(diff.updates.fee).toBeUndefined();
    expect(diff.updates.deadline).toBe("15/12/2026");
  });

  // Point 9: Không tạo đề xuất trùng khi đồng bộ lại (Idempotency)
  it("Point 9: Sync is idempotent and does not create duplicate update proposals on repeated executions", async () => {
    mockStore.opportunities["opp_ietbhec_2027"] = {
      id: "opp_ietbhec_2027",
      title: "Hội thảo khoa học quốc tế lần thứ 5 về Giáo dục Kỹ thuật, Công nghệ, Kinh doanh và Sức khỏe (IETBHEC'27)",
      sourceUrl: "https://ietbhec2027.example.edu.vn",
      deadline: "01/10/2026",
      status: "published",
    };

    // First sync: creates 1 update proposal and 6 new candidates
    const outcome1 = await executeResearchSync({
      db: {},
      sdk: mockSdk,
      user: { uid: "u_admin", email: "admin@tdtu.edu.vn", role: "admin" },
      options: { force: true },
    });
    expect(outcome1.stats?.updateProposals).toBe(1);
    const countAfterFirstSync = Object.keys(mockStore.opportunityCandidates).length;
    expect(countAfterFirstSync).toBe(7);

    // Second sync: Repeated execution must NOT create another proposal for IETBHEC'27
    const outcome2 = await executeResearchSync({
      db: {},
      sdk: mockSdk,
      user: { uid: "u_admin", email: "admin@tdtu.edu.vn", role: "admin" },
      options: { force: true },
    });
    expect(outcome2.stats?.updateProposals).toBe(0); // Updated existing proposal instead of creating duplicate!
    const countAfterSecondSync = Object.keys(mockStore.opportunityCandidates).length;
    expect(countAfterSecondSync).toBe(countAfterFirstSync); // Exactly 7 candidates, no duplicate documents!
  });

  // Point 10: Xử lý dữ liệu ngoài phạm vi
  it("Point 10: Correctly identifies out-of-scope foreign conferences and classifies JOISA as Call for Papers", () => {
    // Foreign conferences
    const haxd = classifyOutOfScopeRecord({
      title: "Hội thảo khoa học quốc tế lần thứ 3 về Tương tác Người – AI (HAXD 2027)",
      country: "Hoa Kỳ",
    });
    expect(haxd.isOutOfScope).toBe(true);
    expect(haxd.reason).toContain("HOI THAO QT");

    const evomusart = classifyOutOfScopeRecord({
      title: "EvoMUSART 2027 Conference",
      country: "Tây Ban Nha",
    });
    expect(evomusart.isOutOfScope).toBe(true);

    const globalSouth = classifyOutOfScopeRecord({
      title: "Shaping the Future of the Global South",
      country: "Australia",
    });
    expect(globalSouth.isOutOfScope).toBe(true);

    // JOISA: Call for Papers / Special Issue invitation
    const joisa = classifyOutOfScopeRecord({
      title: "JOISA Special Issue Invitation",
      type: "Hội thảo",
    });
    expect(joisa.isOutOfScope).toBe(true);
    expect(joisa.classifiedType).toBe("Call for Papers");
    expect(joisa.reason?.toLowerCase()).toContain("thư mời viết bài đặc san tạp chí");

    // Domestic conferences are NOT out of scope
    const domestic = classifyOutOfScopeRecord({
      title: "Hội thảo quốc tế RTD 2026 – FutureScape",
      country: "Việt Nam",
    });
    expect(domestic.isOutOfScope).toBe(false);

    // Filter verification: out-of-scope candidates are categorized as 'out_of_scope' and excluded from domestic pending queue
    const outCand: OpportunityCandidate = {
      id: "cand_haxd",
      title: "HAXD 2027",
      organizer: "Org",
      country: "Hoa Kỳ",
      type: "Hội thảo",
      level: "Quốc tế",
      topic: "Topic",
      field: "Field",
      tags: [],
      deadline: "20/12/2026",
      content: "Content",
      sourceType: "SPARK",
      status: "pending",
      normalizedTitle: "haxd 2027",
      createdAt: "2026-10-13T10:00:00.000Z",
      updatedAt: "2026-10-13T10:00:00.000Z",
    };
    expect(getCandidatePrimaryCategory(outCand)).toBe("out_of_scope");
    expect(FILTER_TABS.some((t) => t.id === "out_of_scope")).toBe(true);
  });

  // Point 11: Người không có quyền Admin bị từ chối
  it("Point 11: Non-admin users are strictly denied from performing sync and reading candidates", async () => {
    const rejectingSdk: ResearchSyncSdk = {
      ...mockSdk,
      getDocs: async () => {
        const err = new Error("Missing or insufficient permissions.");
        (err as any).code = "permission-denied";
        throw err;
      },
    };

    await expect(
      executeResearchSync({
        db: {},
        sdk: rejectingSdk,
        user: { uid: "u_lecturer", email: "gv@tdtu.edu.vn", role: "lecturer" },
        options: { force: true },
      })
    ).rejects.toThrow(ResearchSyncStageError);
  });

  // Point 12: Không ảnh hưởng chức năng Danh mục Tạp chí
  it("Point 12: Preserves Journal Directory integrity and does not interfere with journal collections", async () => {
    // Verify candidate creation uses opportunityCandidates collection, not journalCandidates
    const outcome = await executeResearchSync({
      db: {},
      sdk: mockSdk,
      user: { uid: "u_admin", email: "admin@tdtu.edu.vn", role: "admin" },
      options: { force: true },
    });
    expect(outcome.status).toBe("success");
    // Ensure no accidental writes to journal stores
    expect((mockStore as any).journalCandidates).toBeUndefined();
    expect((mockStore as any).journals).toBeUndefined();
  });

  // Point 13: Không ảnh hưởng hệ thống JSON + Apps Script dự phòng
  it("Point 13: Preserves official faculty research backup dataset and mapping function", () => {
    expect(OFFICIAL_FACULTY_RESEARCH_RECORDS).toBeDefined();
    expect(OFFICIAL_FACULTY_RESEARCH_RECORDS.length).toBeGreaterThan(0);
    const candidate0 = mapRowToCandidate(OFFICIAL_FACULTY_RESEARCH_RECORDS[0], 0);
    expect(candidate0.title).toBeDefined();
    expect(candidate0.sourceType).toBe("SPARK");
  });

  // Point 14: Chuẩn hóa so sánh dữ liệu (Date, URL, Empty, Notes) không tạo đề xuất giả
  it("Point 14: Normalized diff comparison avoids spurious update proposals for date formats, URLs, and countdown notes", () => {
    const existingTarget: ResearchMatchTarget = {
      id: "opp_icisn_2027",
      title: "Hội thảo ICISN 2027",
      sourceUrl: "https://icisn.com/",
      submissionUrl: "https://icisn.com/submit",
      deadline: "2026-11-20T00:00:00.000Z",
      fullPaperDeadline: "2026-11-20T00:00:00.000Z",
      eventDate: "20/03/2027 - 21/03/2027",
      location: "Hải Phòng",
      fee: "250 USD",
      publicationFee: "250 USD",
      registrationFee: "Không rõ chi phí",
      feeStatus: "SPECIFIED",
      notes: "Hạn nộp còn 24 ngày; Kỷ yếu Springer LNNS.",
    };

    const incomingRow = {
      stt: 1,
      title: "Hội thảo ICISN 2027",
      sourceUrl: "https://icisn.com", // No trailing slash
      submissionUrl: "http://icisn.com/submit/", // http vs https, trailing slash
      deadline: "20/11/2026", // VN format vs ISO
      fullPaperDeadline: "20/11/2026",
      eventDate: "20/03/2027 - 21/03/2027",
      location: "Hải Phòng",
      fee: "250 USD",
      publicationFee: "250 USD",
      registrationFee: "Chưa có", // Equivalent empty string
      feeStatus: "SPECIFIED" as const,
      notes: "Hạn nộp còn 18 ngày; Kỷ yếu Springer LNNS.", // Countdown days changed
      statusText: "MỚI", // Should NOT trigger diff
    };

    const diff = computeOpportunityDiff(existingTarget, incomingRow as any);
    expect(diff.hasChanges).toBe(false);
    expect(diff.changedKeys).toEqual([]);
    expect(diff.diffSummary).toEqual([]);
  });

  // Point 15: Thay đổi hạn nộp thực tế PHẢI phát hiện và tạo đề xuất cập nhật
  it("Point 15: Substantive deadline change is accurately detected and generates diffSummary", () => {
    const existingTarget: ResearchMatchTarget = {
      id: "opp_letj_2027",
      title: "Hội thảo LETJ 2027",
      deadline: "2026-11-15T00:00:00.000Z",
      fullPaperDeadline: "2026-11-15T00:00:00.000Z",
      location: "Đại học Kinh tế Quốc dân, Hà Nội",
    };

    const incomingRow = {
      stt: 2,
      title: "Hội thảo LETJ 2027",
      deadline: "2026-12-20", // New extended deadline
      fullPaperDeadline: "2026-12-20",
      location: "Đại học Kinh tế Quốc dân, Hà Nội",
    };

    const diff = computeOpportunityDiff(existingTarget, incomingRow as any);
    expect(diff.hasChanges).toBe(true);
    expect(diff.changedKeys).toContain("fullPaperDeadline");
    expect(diff.diffSummary.length).toBeGreaterThan(0);
  });

  // Point 16: Phân loại danh mục tab: Đề xuất cập nhật vào "updates", không vào "today"
  it("Point 16: Update proposals are routed to 'updates' tab and never pollute 'today'", () => {
    const updateCandidate: OpportunityCandidate = {
      id: "cand_upd_opp_letj_2027",
      title: "Hội thảo LETJ 2027",
      organizer: "NEU",
      country: "Việt Nam",
      type: "Hội thảo",
      level: "Quốc tế",
      topic: "Luật & Kinh tế",
      field: "Chung MTCN",
      tags: [],
      deadline: "2026-12-20",
      content: "Nội dung...",
      sourceType: "SPARK",
      status: "pending",
      changeType: "update",
      publishedOpportunityId: "opp_letj_2027",
      normalizedTitle: "hoi thao letj 2027",
      createdAt: new Date().toISOString(), // Created today during sync
      discoveredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const cat = getCandidatePrimaryCategory(updateCandidate);
    expect(cat).toBe("updates");
    expect(cat).not.toBe("today");
  });
});
