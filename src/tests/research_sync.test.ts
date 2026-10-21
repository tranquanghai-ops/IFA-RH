import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseGvizDateValue,
  parseFacultyResearchGvizRow,
  normalizeOpportunityType,
  normalizeOpportunityLevel,
  DEFAULT_RESEARCH_SHEET_ID,
  DEFAULT_RESEARCH_SHEET_NAME,
} from "../services/researchSheetService";
import {
  normalizeCanonicalUrl,
  extractConferenceYear,
  findMatchingResearchOpportunity,
  isEditedByAdmin,
  computeOpportunityDiff,
} from "../utils/researchDedupe";
import {
  executeResearchSync,
  cleanUndefined,
  ResearchSyncStageError,
  type ResearchSyncSdk,
} from "../services/researchSyncService";
import { mapRowToCandidate } from "../services/facultyResearchData";

describe("Research Data Sync Suite", () => {
  describe("Google Sheets GViz Parsing", () => {
    it("parses GViz Date values correctly", () => {
      // Month is 0-indexed in GViz: Date(2027, 2, 20) -> 20/03/2027
      const cell1 = { v: "Date(2027, 2, 20)", f: null };
      const parsed1 = parseGvizDateValue(cell1);
      expect(parsed1.text).toBe("20/03/2027");
      expect(parsed1.date?.getUTCFullYear()).toBe(2027);
      expect(parsed1.date?.getUTCMonth()).toBe(2);
      expect(parsed1.date?.getUTCDate()).toBe(20);

      // Formatted date string dd/mm/yyyy
      const cell2 = { v: null, f: "15/11/2026" };
      const parsed2 = parseGvizDateValue(cell2);
      expect(parsed2.text).toBe("15/11/2026");

      // Preserves unverified text
      const cell3 = { v: "Chưa xác minh", f: null };
      const parsed3 = parseGvizDateValue(cell3);
      expect(parsed3.text).toBe("Chưa xác minh");
      expect(parsed3.date).toBeNull();
    });

    it("parses full 27-column row into RawFacultyResearchRow", () => {
      const mockCells = [
        { v: 1, f: "1" }, // STT (0)
        { v: "Date(2026, 9, 6)", f: "06/10/2026" }, // Phát hiện (1)
        { v: "RUN-01", f: "RUN-01" }, // Run ID (2)
        { v: "Hội thảo quốc tế AI MTCN 2027", f: "Hội thảo quốc tế AI MTCN 2027" }, // Tiêu đề (3)
        { v: "https://example.org/conf-2027", f: "https://example.org/conf-2027" }, // Link nguồn (4)
        { v: "https://example.org/submit", f: "https://example.org/submit" }, // Link nộp bài (5)
        { v: "Đại học Mỹ thuật", f: "Đại học Mỹ thuật" }, // Đơn vị tổ chức (6)
        { v: "Việt Nam", f: "Việt Nam" }, // Quốc gia (7)
        { v: "Quốc tế", f: "Quốc tế" }, // Cấp độ (8)
        { v: "Hội thảo", f: "Hội thảo" }, // Loại (9)
        { v: "Mỹ thuật ứng dụng trong kỷ nguyên số", f: "Mỹ thuật ứng dụng" }, // Chủ đề (10)
        { v: "Rất phù hợp", f: "Rất phù hợp" }, // Mức độ phù hợp (11)
        { v: "Thiết kế đồ họa", f: "Thiết kế đồ họa" }, // Ngành phù hợp (12)
        { v: null, f: null }, // Hạn tóm tắt (13)
        { v: "Date(2026, 10, 20)", f: "20/11/2026" }, // Hạn toàn văn (14)
        { v: "Date(2027, 1, 15)", f: "15/02/2027" }, // Hạn đăng ký (15)
        { v: "20/03/2027 - 21/03/2027", f: "20/03/2027 - 21/03/2027" }, // Ngày tổ chức (16)
        { v: "TP. Hồ Chí Minh", f: "TP. Hồ Chí Minh" }, // Địa điểm (17)
        { v: "Miễn phí", f: "Miễn phí" }, // Phí (18)
        { v: "Kỷ yếu ISBN", f: "Kỷ yếu ISBN" }, // Xuất bản (19)
        { v: "Scopus", f: "Scopus" }, // Indexing (20)
        { v: "Nội dung tóm tắt hội thảo", f: "Nội dung tóm tắt hội thảo" }, // Tóm tắt (21)
        { v: "Gợi ý hướng bài", f: "Gợi ý hướng bài" }, // Gợi ý (22)
        { v: "AI, Mỹ thuật, Đồ họa", f: "AI, Mỹ thuật, Đồ họa" }, // Từ khóa (23)
        { v: "MỚI", f: "MỚI" }, // Trạng thái (24)
        { v: "Date(2026, 9, 6)", f: "06/10/2026" }, // Cập nhật cuối (25)
        { v: "Ghi chú đặc biệt", f: "Ghi chú đặc biệt" }, // Ghi chú (26)
      ];

      const row = parseFacultyResearchGvizRow(mockCells, 0);

      expect(row.stt).toBe(1);
      expect(row.title).toBe("Hội thảo quốc tế AI MTCN 2027");
      expect(row.organizer).toBe("Đại học Mỹ thuật");
      expect(row.fullPaperDeadline).toBe("20/11/2026");
      expect(row.feeStatus).toBe("FREE");
      expect(row.publicationFee).toBe("Miễn phí");
      expect(row.statusText).toBe("MỚI");
      expect(row.eventDate).toBe("20/03/2027 - 21/03/2027");
      expect(row.notes).toBe("Ghi chú đặc biệt");
    });
  });

  describe("Canonical Normalization & Conference Year Extraction", () => {
    it("normalizes canonical URLs stripping query parameters and www", () => {
      expect(normalizeCanonicalUrl("https://www.example.org/cfp-2027/?utm_source=fb")).toBe("example.org/cfp-2027");
      expect(normalizeCanonicalUrl("http://conference.org/page/#anchor")).toBe("conference.org/page");
      expect(normalizeCanonicalUrl("")).toBe("");
    });

    it("extracts 4-digit conference years correctly", () => {
      expect(extractConferenceYear("Hội thảo quốc tế ICISN 2027")).toBe("2027");
      expect(extractConferenceYear("RTD 2026 - FutureScape")).toBe("2026");
      expect(extractConferenceYear("Diễn đàn Mỹ thuật số")).toBe("");
    });
  });

  describe("Deduplication & Matching Rules", () => {
    const existingList = [
      {
        id: "opp_1",
        title: "Hội thảo quốc tế RTD 2026: FutureScape",
        sourceUrl: "https://rtd-conference.org/2026",
        submissionUrl: "https://rtd-conference.org/submit-2026",
        organizer: "Đại học Kinh tế TP.HCM",
        eventDate: "15/07/2026 - 20/07/2026",
        deadline: "15/06/2026",
        status: "published",
      },
      {
        id: "cand_1",
        title: "Hội thảo khoa học quốc tế lần thứ 7: ICISN 2027",
        sourceUrl: "https://icisn.com/",
        submissionUrl: "https://www.icisn.com/for-attendees",
        organizer: "Trường Đại học Hải Dương",
        eventDate: "20/03/2027",
        deadline: "20/11/2026",
        status: "pending",
      },
    ];

    it("matches by canonical source URL", () => {
      const row: any = {
        title: "ICISN 2027 New Submission",
        sourceUrl: "http://www.icisn.com/",
        organizer: "Đại học Hải Dương",
      };

      const match = findMatchingResearchOpportunity(row, existingList);
      expect(match.isMatch).toBe(true);
      expect(match.matchedId).toBe("cand_1");
      expect(match.matchType).toBe("source_url");
    });

    it("strictly separates annual conferences with different years (RTD 2026 vs RTD 2027)", () => {
      // Annual conference RTD 2027 has the same title style but a different year
      const row2027: any = {
        title: "Hội thảo quốc tế RTD 2027: FutureScape Next",
        sourceUrl: "https://rtd-conference.org/2027",
        submissionUrl: "https://rtd-conference.org/submit-2027",
        organizer: "Đại học Kinh tế TP.HCM",
        eventDate: "15/07/2027",
      };

      const match = findMatchingResearchOpportunity(row2027, existingList);
      // MUST NOT merge RTD 2027 into RTD 2026!
      expect(match.isMatch).toBe(false);
    });

    it("matches by exact title and same conference year", () => {
      const row: any = {
        title: "Hội thảo khoa học quốc tế lần thứ 7: ICISN 2027",
        organizer: "Trường Đại học Hải Dương",
      };

      const match = findMatchingResearchOpportunity(row, existingList);
      expect(match.isMatch).toBe(true);
      expect(match.matchedId).toBe("cand_1");
      expect(match.matchType).toBe("exact_title_year");
    });
  });

  describe("Admin Edit Preservation (Preserved Admin)", () => {
    it("identifies records manually edited or published by Admin", () => {
      // Explicit flag
      expect(isEditedByAdmin({ id: "1", title: "Conf", editedByAdmin: true })).toBe(true);

      // Manual overrides list
      expect(isEditedByAdmin({ id: "2", title: "Conf", manualOverrides: ["deadline"] })).toBe(true);

      // Published / approved by administrator
      expect(
        isEditedByAdmin({
          id: "3",
          title: "Conf",
          status: "published",
          updatedBy: "admin@tdtu.edu.vn",
        })
      ).toBe(true);

      // Auto-synced record is NOT protected from future sheet updates
      expect(
        isEditedByAdmin({
          id: "4",
          title: "Conf",
          status: "pending",
          updatedBy: "SPARK_SYNC",
        })
      ).toBe(false);
    });
  });

  describe("Diff Computation", () => {
    it("detects changed fields and computes updates", () => {
      const existing: any = {
        deadline: "15/10/2026",
        fullPaperDeadline: "15/10/2026",
        fee: "1.000.000 VNĐ",
        location: "Hà Nội",
      };

      const row: any = {
        fullPaperDeadline: "20/11/2026", // changed
        fee: "1.000.000 VNĐ", // unchanged
        location: "Đà Nẵng", // changed
      };

      const diff = computeOpportunityDiff(existing, row);
      expect(diff.hasChanges).toBe(true);
      expect(diff.changedKeys).toContain("fullPaperDeadline");
      expect(diff.changedKeys).toContain("location");
      expect(diff.changedKeys).not.toContain("fee");
      expect(diff.updates.location).toBe("Đà Nẵng");
      expect(diff.updates.fullPaperDeadline).toBe("20/11/2026");
    });
  });

  describe("cleanUndefined Utility", () => {
    it("removes undefined keys recursively to prevent Firestore write crashes", () => {
      const input = {
        title: "Test",
        deadline: undefined,
        nested: {
          a: 1,
          b: undefined,
        },
        arr: [{ x: 10, y: undefined }],
      };

      const cleaned = cleanUndefined(input);
      expect(cleaned).toEqual({
        title: "Test",
        nested: { a: 1 },
        arr: [{ x: 10 }],
      });
      expect("deadline" in cleaned).toBe(false);
      expect("b" in cleaned.nested).toBe(false);
    });
  });

  describe("Polymorphic executeResearchSync Engine", () => {
    let mockStore: Record<string, Record<string, any>>;
    let mockSdk: ResearchSyncSdk;

    const originalFetch = globalThis.fetch;
    const mockRowCells = [
      { v: 1, f: "1" },
      { v: "Date(2026, 9, 6)", f: "06/10/2026" },
      { v: "RUN-01", f: "RUN-01" },
      { v: "Hội thảo quốc tế AI MTCN 2027", f: "Hội thảo quốc tế AI MTCN 2027" },
      { v: "https://example.org/conf-2027", f: "https://example.org/conf-2027" },
      { v: "https://example.org/submit", f: "https://example.org/submit" },
      { v: "Đại học Mỹ thuật", f: "Đại học Mỹ thuật" },
      { v: "Việt Nam", f: "Việt Nam" },
      { v: "Quốc tế", f: "Quốc tế" },
      { v: "Hội thảo", f: "Hội thảo" },
      { v: "Mỹ thuật ứng dụng", f: "Mỹ thuật ứng dụng" },
      { v: "Rất phù hợp", f: "Rất phù hợp" },
      { v: "Thiết kế đồ họa", f: "Thiết kế đồ họa" },
      { v: null, f: null },
      { v: "Date(2026, 10, 20)", f: "20/11/2026" },
      { v: "Date(2027, 1, 15)", f: "15/02/2027" },
      { v: "20/03/2027", f: "20/03/2027" },
      { v: "TP. Hồ Chí Minh", f: "TP. Hồ Chí Minh" },
      { v: "Miễn phí", f: "Miễn phí" },
      { v: "Kỷ yếu ISBN", f: "Kỷ yếu ISBN" },
      { v: "Scopus", f: "Scopus" },
      { v: "Tóm tắt", f: "Tóm tắt" },
      { v: "Gợi ý", f: "Gợi ý" },
      { v: "AI", f: "AI" },
      { v: "MỚI", f: "MỚI" },
      { v: "Date(2026, 9, 6)", f: "06/10/2026" },
      { v: "Ghi chú", f: "Ghi chú" },
    ];

    beforeEach(() => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: any) => {
        const urlStr = String(url || "");
        const isQT = urlStr.includes("QT");
        const cells = isQT
          ? mockRowCells.map((c, i) => (i === 3 ? { v: "Hội thảo quốc tế HAXD 2027 (QT)", f: "Hội thảo quốc tế HAXD 2027 (QT)" } : c))
          : mockRowCells;
        const table = {
          cols: Array(27).fill(0).map((_, i) => ({ id: `col_${i}`, label: `Col ${i}` })),
          rows: [{ c: cells }],
        };
        const gvizText = `google.visualization.Query.setResponse(${JSON.stringify({ status: "ok", table })});`;
        return new Response(gvizText, { status: 200 });
      });
      mockStore = {
        systemConfig: {},
        opportunityCandidates: {},
        opportunities: {},
        imports: {},
      };

      mockSdk = {
        doc: (_db: any, col: string, id: string) => ({ col, id }),
        getDoc: async (ref: any) => {
          const data = mockStore[ref.col]?.[ref.id];
          return {
            exists: Boolean(data),
            data: () => data,
          };
        },
        setDoc: async (ref: any, data: any, options?: any) => {
          if (!mockStore[ref.col]) mockStore[ref.col] = {};
          if (options?.merge && mockStore[ref.col][ref.id]) {
            mockStore[ref.col][ref.id] = { ...mockStore[ref.col][ref.id], ...data };
          } else {
            mockStore[ref.col][ref.id] = data;
          }
        },
        updateDoc: async (ref: any, data: any) => {
          if (!mockStore[ref.col]?.[ref.id]) throw new Error("Document not found");
          mockStore[ref.col][ref.id] = { ...mockStore[ref.col][ref.id], ...data };
        },
        collection: (_db: any, path: string) => ({ path }),
        getDocs: async (ref: any) => {
          const colData = mockStore[ref.path] || {};
          const docs = Object.entries(colData).map(([id, data]) => ({
            id,
            data: () => data,
          }));
          return { docs };
        },
        addDoc: async (colRef: any, data: any) => {
          const id = `doc_${Math.random().toString(36).substring(2, 9)}`;
          if (!mockStore[colRef.path]) mockStore[colRef.path] = {};
          mockStore[colRef.path][id] = data;
          return { id };
        },
        serverTimestamp: () => new Date().toISOString(),
      };
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("respects concurrency lock and skips execution if active lock exists", async () => {
      // Set an active lock
      mockStore.systemConfig["facultyResearchSync"] = {
        syncInProgress: true,
        syncStartedAtMs: Date.now() - 60000, // 1 minute ago
      };

      const outcome = await executeResearchSync({
        db: {},
        sdk: mockSdk,
        user: { uid: "u1", email: "admin@test.com" },
        options: { force: false },
      });

      expect(outcome.skipped).toBe(true);
      expect(outcome.reason).toContain("Một phiên đồng bộ khác đang chạy");
    });

    it("overrides lock when force: true is passed", async () => {
      mockStore.systemConfig["facultyResearchSync"] = {
        syncInProgress: true,
        syncStartedAtMs: Date.now() - 60000,
      };

      // Mock live sheet fetch will attempt network, in dryRun we can test dryRun behavior:
      const outcome = await executeResearchSync({
        db: {},
        sdk: mockSdk,
        user: { uid: "u1", email: "admin@test.com" },
        options: { dryRun: true },
      });

      // DryRun does not acquire lock and succeeds
      expect(outcome.skipped).toBe(false);
      expect(outcome.status).toBe("success");
      expect(outcome.stats?.read).toBeGreaterThan(0);
    });

    it("throws ResearchSyncStageError with READ_CANDIDATES when reading candidate collection is rejected", async () => {
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
          options: { dryRun: false, force: true },
        })
      ).rejects.toThrow(ResearchSyncStageError);

      try {
        await executeResearchSync({
          db: {},
          sdk: rejectingSdk,
          user: { uid: "u_lecturer", email: "gv@tdtu.edu.vn", role: "lecturer" },
          options: { dryRun: false, force: true },
        });
      } catch (err: any) {
        expect(err).toBeInstanceOf(ResearchSyncStageError);
        expect(err.stage).toBe("READ_CANDIDATES");
        expect(err.collectionName).toContain("opportunityCandidates");
        expect(err.message).toContain("READ_CANDIDATES");
        expect(err.message).toContain("permission-denied");
      }
    });

    it("throws ResearchSyncStageError with WRITE_NEW_CANDIDATE when creating a candidate fails", async () => {
      const rejectingSdk: ResearchSyncSdk = {
        ...mockSdk,
        addDoc: async () => {
          const err = new Error("Missing or insufficient permissions.");
          (err as any).code = "permission-denied";
          throw err;
        },
      };

      try {
        await executeResearchSync({
          db: {},
          sdk: rejectingSdk,
          user: { uid: "u_admin", email: "admin@tdtu.edu.vn", role: "admin" },
          options: { dryRun: false, force: true },
        });
      } catch (err: any) {
        expect(err).toBeInstanceOf(ResearchSyncStageError);
        expect(err.stage).toBe("WRITE_NEW_CANDIDATE");
        expect(err.collectionName).toBe("opportunityCandidates");
        expect(err.message).toContain("WRITE_NEW_CANDIDATE");
      }
    });

    it("strips synthetic spark_opp_* id on addDoc and prioritizes real Firestore d.id over legacy internal data.id", async () => {
      // Seed an existing candidate with real doc ID "c5zPwXoY2SJNjwDgEDZw" but legacy internal id "spark_opp_20261012-01_1"
      mockStore.opportunityCandidates["c5zPwXoY2SJNjwDgEDZw"] = {
        id: "spark_opp_20261012-01_1",
        title: "Hội thảo khoa học quốc tế lần thứ 3 về Tương tác Người – AI và Thiết kế Trải nghiệm (HAXD 2027)",
        sourceUrl: "https://haxd2027.example.org",
        organizer: "Old Organizer",
        status: "pending",
        updatedBy: "SPARK_SYNC",
      };

      const outcome = await executeResearchSync({
        db: {},
        sdk: mockSdk,
        user: { uid: "u_admin", email: "nguyenthithuyha1@tdtu.edu.vn", role: "admin" },
        options: { dryRun: false, force: true },
      });

      expect(outcome.status).toBe("success");
      // Verify newly created candidates in mockStore do NOT have a synthetic "spark_opp_*" id stored inside their fields
      for (const [docId, docData] of Object.entries(mockStore.opportunityCandidates)) {
        if (docId !== "c5zPwXoY2SJNjwDgEDZw") {
          expect(docData.id).toBeUndefined();
        }
      }
    });
  });
});
