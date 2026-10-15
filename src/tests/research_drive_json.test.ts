import { describe, it, expect, beforeEach } from "vitest";
import {
  validateConferencesJsonPayload,
  mapJsonConferenceToRawRow,
  clearDriveConferencesCache,
  getDriveConferencesCache,
  setDriveConferencesCache,
  type ConferencesJsonPayload,
  type JsonConference,
} from "../services/researchDriveJsonService";
import {
  classifyOutOfScopeRecord,
  findMatchingResearchOpportunity,
} from "../utils/researchDedupe";
import type { Opportunity } from "../types";

describe("Google Drive JSON Conferences Sync & Governance", () => {
  beforeEach(() => {
    clearDriveConferencesCache();
  });

  const validSampleItemTN: JsonConference = {
    code: "TN0001",
    category: "TN",
    year: 2027,
    title: "Hội thảo Quốc tế về Xu hướng Mới trong Kỹ thuật Y sinh & Chăm sóc Sức khỏe (IETBHEC'27)",
    organizer: "Đại học Duy Tân",
    location: "Đà Nẵng",
    country: "Việt Nam",
    field: "Công nghệ thông tin / Y sinh",
    level: "Quốc tế",
    type: "Hội thảo",
    eventDate: "2027-03-20",
    deadline: "2026-11-30",
    status: "NHẬN BÀI",
    sourceUrl: "https://ietbhec2027.duytan.edu.vn",
    content: "Chi tiết hội thảo IETBHEC 2027",
  };

  const validSampleItemQT: JsonConference = {
    code: "QT0001",
    category: "QT",
    year: 2027,
    title: "International Conference on Human-Agent Interaction & Experience Design (HAXD 2027)",
    organizer: "University of Naples Federico II",
    location: "Naples",
    country: "Ý",
    field: "Khoa học máy tính / Tương tác Người-Máy",
    level: "Quốc tế",
    type: "Hội thảo",
    eventDate: "2027-06-15",
    deadline: "2027-01-15",
    status: "NHẬN BÀI",
    sourceUrl: "https://haxd2027.unina.it",
    content: "Chi tiết hội thảo HAXD 2027",
  };

  const validPayload: ConferencesJsonPayload = {
    schemaVersion: 1,
    revision: 2,
    runId: "spark_drive_20261015-01",
    generatedAt: "2026-10-15T08:00:00.000Z",
    nextCodes: {
      TN: "TN0008",
      QT: "QT0004",
    },
    conferences: [validSampleItemTN, validSampleItemQT],
  };

  describe("1. Schema & Payload Validation", () => {
    it("chấp nhận payload hợp lệ đầy đủ TN và QT", () => {
      const res = validateConferencesJsonPayload(validPayload);
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it("từ chối payload không phải object hoặc null/undefined/mảng", () => {
      expect(validateConferencesJsonPayload(null).isValid).toBe(false);
      expect(validateConferencesJsonPayload("string").isValid).toBe(false);
      expect(validateConferencesJsonPayload([]).isValid).toBe(false);
    });

    it("từ chối khi thiếu schemaVersion hoặc khác 1", () => {
      const invalid = { ...validPayload, schemaVersion: 2 };
      const res = validateConferencesJsonPayload(invalid);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("schemaVersion");
    });

    it("từ chối khi revision không phải số nguyên dương", () => {
      const invalid1 = { ...validPayload, revision: 0 };
      expect(validateConferencesJsonPayload(invalid1).isValid).toBe(false);

      const invalid2 = { ...validPayload, revision: -5 };
      expect(validateConferencesJsonPayload(invalid2).isValid).toBe(false);

      const invalid3 = { ...validPayload, revision: 1.5 };
      expect(validateConferencesJsonPayload(invalid3).isValid).toBe(false);
    });

    it("từ chối khi mã hội thảo trùng lặp trong cùng một file", () => {
      const dupItem = { ...validSampleItemQT, code: "TN0001" };
      const invalid = {
        ...validPayload,
        conferences: [validSampleItemTN, dupItem],
      };
      const res = validateConferencesJsonPayload(invalid);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("trùng lặp");
    });

    it("từ chối mã hội thảo sai định dạng regex ^(TN|QT)\\d{4}$", () => {
      const badCodeItem = { ...validSampleItemTN, code: "INVALID01" };
      const invalid = {
        ...validPayload,
        conferences: [badCodeItem],
      };
      const res = validateConferencesJsonPayload(invalid);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("không hợp lệ");
    });

    it("từ chối category không thuộc TN hoặc QT", () => {
      const badCatItem = { ...validSampleItemTN, category: "KHAC" as any };
      const invalid = {
        ...validPayload,
        conferences: [badCatItem],
      };
      const res = validateConferencesJsonPayload(invalid);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("category");
    });

    it("từ chối khi category và tiền tố mã không khớp", () => {
      const mismatchedItem = { ...validSampleItemTN, code: "QT0001", category: "TN" as const };
      const invalid = {
        ...validPayload,
        conferences: [mismatchedItem],
      };
      const res = validateConferencesJsonPayload(invalid);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("không khớp");
    });
  });

  describe("2. Fallback Cache Mechanism", () => {
    it("khởi tạo và xóa bộ nhớ đệm thành công", () => {
      expect(getDriveConferencesCache()).toBeNull();
      setDriveConferencesCache({
        payload: validPayload,
        fileId: "test_file_id",
        fileName: "IFA_RH_CONFERENCES_TEST.json",
        cachedAt: new Date().toISOString(),
      });
      expect(getDriveConferencesCache()).not.toBeNull();
      expect(getDriveConferencesCache()?.payload.revision).toBe(2);

      clearDriveConferencesCache();
      expect(getDriveConferencesCache()).toBeNull();
    });
  });

  describe("3. Dedupe & Scope Classification for TN and QT", () => {
    it("hội thảo quốc tế (QT) KHÔNG bị đánh dấu ngoài phạm vi", () => {
      const scopeResult = classifyOutOfScopeRecord(
        {
          stt: 1,
          title: "International Conference on AI & Experience (HAXD 2027)",
          organizer: "University of Naples",
          type: "Hội thảo",
          scope: "Quốc tế",
          field: "CNTT",
          country: "Ý",
          category: "QT",
          conferenceCode: "QT0001",
        }
      );

      expect(scopeResult.isOutOfScope).toBe(false);
      expect(scopeResult.reason).toBeUndefined();
    });

    it("tạp chí JOISA vẫn bị loại trừ vào ngoài phạm vi", () => {
      const scopeResult = classifyOutOfScopeRecord({
        title: "Tạp chí Khoa học & Ứng dụng (JOISA)",
        organizer: "Học viện",
        type: "Tạp chí",
        country: "Việt Nam",
      });

      expect(scopeResult.isOutOfScope).toBe(true);
      expect(scopeResult.reason).toContain("Call for Papers");
    });

    it("findMatchingResearchOpportunity ưu tiên khớp chính xác bằng conferenceCode (Rule 0a)", () => {
      const existingOpps: Opportunity[] = [
        {
          id: "opp_ietbhec_2027",
          title: "Hội thảo Quốc tế IETBHEC 2027",
          organizer: "Đại học Duy Tân",
          country: "Việt Nam",
          topic: "Y sinh",
          tags: ["Y sinh"],
          deadline: "2026-11-30",
          content: "Nội dung",
          type: "Hội thảo",
          level: "Quốc tế",
          field: "CNTT",
          sourceUrl: "https://ietbhec2027.duytan.edu.vn",
          sourceType: "SPARK",
          createdBy: "admin",
          status: "published",
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
          conferenceCode: "TN0001",
          category: "TN",
        },
        {
          id: "opp_haxd_2027",
          title: "HAXD 2027 Naples",
          organizer: "Naples",
          country: "Ý",
          topic: "HCI",
          tags: ["HCI"],
          deadline: "2027-01-15",
          content: "Nội dung",
          type: "Hội thảo",
          level: "Quốc tế",
          field: "CNTT",
          sourceUrl: "https://haxd2027.unina.it",
          sourceType: "SPARK",
          createdBy: "admin",
          status: "published",
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
          conferenceCode: "QT0001",
          category: "QT",
        },
      ];

      // Đổi tiêu đề một phần nhưng giữ nguyên conferenceCode
      const incomingRaw = mapJsonConferenceToRawRow({
        ...validSampleItemTN,
        title: "IETBHEC 2027 - Tiêu đề cập nhật nhẹ",
      });

      const matched = findMatchingResearchOpportunity(incomingRaw, existingOpps);
      expect(matched.isMatch).toBe(true);
      expect(matched.matchedId).toBe("opp_ietbhec_2027");
      expect(matched.target?.conferenceCode).toBe("TN0001");
    });
  });

  describe("4. Mapping JSON Conference Item to Raw Row", () => {
    it("ánh xạ đầy đủ các trường từ JSON sang RawFacultyResearchRow", () => {
      const raw = mapJsonConferenceToRawRow(validSampleItemQT, 0, "test_run_1");

      expect(raw.conferenceCode).toBe("QT0001");
      expect(raw.category).toBe("QT");
      expect(raw.title).toBe(validSampleItemQT.title);
      expect(raw.organizer).toBe("University of Naples Federico II");
      expect(raw.country).toBe("Ý");
      expect(raw.location).toBe("Naples");
      expect(raw.deadline).toBe("15/01/2027");
      expect(raw.eventDate).toBe("15/06/2027");
      expect(raw.statusText).toBe("NHẬN BÀI");
      expect(raw.runId).toBe("test_run_1");
    });

    it("ánh xạ chính xác cấu trúc 28 trường thực tế của Spark", () => {
      const sparkConfItem: JsonConference = {
        code: "TN0002",
        category: "TN",
        title: 'Hội thảo Khoa học Quốc gia: "Đồng kiến tạo chính sách phát triển bền vững"',
        organizer: "CELG - Đại học Kinh tế TP.HCM",
        country: "Việt Nam",
        year: 2026,
        type: "Hội thảo",
        level: "Quốc gia",
        topic: "Chính sách công, Kinh tế số và Thiết kế dịch vụ",
        field: "Chung Khoa MTCN",
        relevance: "Phù hợp",
        abstractDeadline: "",
        submissionDeadline: "2026-10-20",
        registrationDeadline: "",
        conferenceDate: "2026-11-12 00:00:00",
        location: "59C Nguyễn Đình Chiểu, Quận 3, TP.HCM / Trực tiếp",
        fee: "Miễn phí",
        publication: "Kỷ yếu hội thảo quốc gia có ISBN (online 31/12/2026)",
        indexing: "ISBN",
        sourceUrl: "https://celg.ueh.edu.vn/hoi-thao-quoc-gia-dong-kien-tao-chinh-sach-2026",
        submissionUrl: "https://celg.ueh.edu.vn/nop-bai",
        content: "Hội thảo tập trung vào các giải pháp chính sách công và chuyển đổi số...",
        suggestedTopics: "1. Bản quyền AI; 2. Thiết kế định hướng hành vi; 3. Đô thị thông minh",
        status: "SẮP HẾT HẠN",
        notes: "SẮP HẾT HẠN: Còn 8 ngày (hạn chót 20/10/2026). Tác giả cần khai báo mức độ sử dụng AI.",
        keywords: "CELG 2026, Đồng kiến tạo chính sách, Trí tuệ nhân tạo, Thiết kế dịch vụ công",
        detectedAt: "2026-10-06",
        lastUpdated: "2026-10-12",
      };

      const raw = mapJsonConferenceToRawRow(sparkConfItem, 1, "20261015-01");

      // Verify Spark-specific field mappings
      expect(raw.conferenceCode).toBe("TN0002");
      expect(raw.category).toBe("TN");
      expect(raw.suitability).toBe("Phù hợp"); // from relevance
      expect(raw.fullPaperDeadline).toBe("20/10/2026"); // from submissionDeadline normalized
      expect(raw.deadline).toBe("20/10/2026");
      expect(raw.eventDate).toBe("12/11/2026"); // from conferenceDate normalized
      expect(raw.publicationFormat).toBe("Kỷ yếu hội thảo quốc gia có ISBN (online 31/12/2026)"); // from publication
      expect(raw.feeStatus).toBe("FREE"); // from fee: "Miễn phí"
      expect(raw.publicationFee).toBe("Miễn phí");
      expect(raw.registrationFee).toBe("Miễn phí");
      expect(raw.directions).toBe("1. Bản quyền AI; 2. Thiết kế định hướng hành vi; 3. Đô thị thông minh"); // from suggestedTopics
      expect(raw.tags).toContain("CELG 2026"); // from keywords
      expect(raw.discoveredAt).toBe("2026-10-06"); // from detectedAt
    });
  });

  describe("5. Date Normalization (normalizeConferenceDate)", () => {
    it("chuẩn hóa chính xác ngày đơn và datetime tránh lệch múi giờ", async () => {
      const { normalizeConferenceDate } = await import("../services/researchDriveJsonService");

      expect(normalizeConferenceDate("2026-11-12 00:00:00")).toBe("12/11/2026");
      expect(normalizeConferenceDate("2027-01-15 00:00:00")).toBe("15/01/2027");
      expect(normalizeConferenceDate("2026-10-20")).toBe("20/10/2026");
      expect(normalizeConferenceDate("2027-02-20T00:00:00.000Z")).toBe("20/02/2027");
      expect(normalizeConferenceDate("20/11/2026")).toBe("20/11/2026");
    });

    it("bảo toàn và chuẩn hóa dải ngày (date ranges)", async () => {
      const { normalizeConferenceDate } = await import("../services/researchDriveJsonService");

      expect(normalizeConferenceDate("03/12/2026 - 04/12/2026")).toBe("03/12/2026 - 04/12/2026");
      expect(normalizeConferenceDate("2027-03-31 - 2027-04-02")).toBe("31/03/2027 - 02/04/2027");
      expect(normalizeConferenceDate("14/06/2027 - 16/06/2027")).toBe("14/06/2027 - 16/06/2027");
    });
  });

  describe("6. Transient Countdown Notes Stripping", () => {
    it("loại bỏ các cụm countdown động trong ghi chú của Spark", async () => {
      const { stripTransientCountdownNotes } = await import("../utils/researchDedupe");

      const note1 = "SẮP HẾT HẠN: Còn 8 ngày (hạn chót 20/10/2026). Tác giả cần khai báo mức độ sử dụng AI.";
      expect(stripTransientCountdownNotes(note1)).toBe("(hạn chót 20/10/2026). Tác giả cần khai báo mức độ sử dụng AI");

      const note2 = "HẠN NỘP RẤT GẤP: Chỉ còn 4 ngày (hạn chót 16/10/2026). Kỷ yếu quốc tế ISBN.";
      expect(stripTransientCountdownNotes(note2)).toBe("(hạn chót 16/10/2026). Kỷ yếu quốc tế ISBN");

      const note3 = "Xuất bản Springer Nature chỉ mục Scopus; hạn nộp 20/11/2026 (còn 39 ngày).";
      expect(stripTransientCountdownNotes(note3)).toBe("Xuất bản Springer Nature chỉ mục Scopus; hạn nộp 20/11/2026");

      const note4 = "Hội thảo chuẩn IEEE / Scopus chuyên sâu về UX/UI; hạn nộp 20/02/2027 (còn 131 ngày).";
      expect(stripTransientCountdownNotes(note4)).toBe("Hội thảo chuẩn IEEE / Scopus chuyên sâu về UX/UI; hạn nộp 20/02/2027");
    });
  });

  describe("7. Dedupe Matching for QT0003 & Historical Records", () => {
    it("khớp chính xác QT0003 với opp_global_south_2026 đã công bố trong Firestore", () => {
      const existingOpps: Opportunity[] = [
        {
          id: "opp_global_south_2026",
          title: "Hội thảo khoa học quốc tế: “Shaping the Future of the Global South: Innovation, Digital Transformation and Sustainable Development”",
          organizer: "NEU & Đại học Pretoria",
          country: "Nam Phi / Việt Nam",
          topic: "Đổi mới sáng tạo, chuyển đổi số",
          tags: ["Global South", "Innovation"],
          deadline: "16/10/2026",
          content: "Nội dung Global South 2026",
          type: "Hội thảo",
          level: "Quốc tế",
          field: "Chung Khoa MTCN",
          sourceUrl: "https://tuyensinh.neu.edu.vn/hoi-thao-khoa-hoc-quoc-te-shaping-the-future-of-the-global-south-innovation-digital-transformation-and-sustainable-development/",
          sourceType: "SPARK",
          createdBy: "admin",
          status: "published",
          createdAt: "2026-10-06T00:00:00.000Z",
          updatedAt: "2026-10-06T00:00:00.000Z",
          candidateId: "spark_opp_20261006-01_6",
        },
      ];

      const incomingRaw = mapJsonConferenceToRawRow({
        code: "QT0003",
        category: "QT",
        title: "Hội thảo khoa học quốc tế: “Shaping the Future of the Global South: Innovation, Digital Transformation and Sustainable Development”",
        organizer: "NEU & Đại học Pretoria",
        country: "Nam Phi / Việt Nam",
        year: 2026,
        type: "Hội thảo",
        level: "Quốc tế",
        topic: "Đổi mới sáng tạo và Chuyển đổi số",
        field: "Chung Khoa MTCN",
        sourceUrl: "https://tuyensinh.neu.edu.vn/hoi-thao-khoa-hoc-quoc-te-shaping-the-future-of-the-global-south-innovation-digital-transformation-and-sustainable-development/",
        submissionDeadline: "2026-10-16",
        conferenceDate: "2026-11-23 00:00:00",
        content: "Nội dung hội thảo Global South 2026",
      });

      const match = findMatchingResearchOpportunity(incomingRaw, existingOpps);
      expect(match.isMatch).toBe(true);
      expect(match.matchedId).toBe("opp_global_south_2026");
    });
  });

  describe("8. Distributed Firestore Sync Lock (acquireFirestoreSyncLock & releaseFirestoreSyncLock)", () => {
    it("cho phép chiếm lock, từ chối khi lock còn hiệu lực và mở khóa khi giải phóng", async () => {
      const {
        acquireFirestoreSyncLock,
        releaseFirestoreSyncLock,
        RESEARCH_SYNC_LOCK_DOC_ID,
      } = await import("../services/researchDriveJsonService");

      const store: Record<string, any> = {};
      const mockSdk = {
        doc: (_db: any, col: string, id: string) => ({ col, id }),
        getDoc: async (ref: any) => ({
          exists: () => Boolean(store[`${ref.col}/${ref.id}`]),
          data: () => store[`${ref.col}/${ref.id}`],
        }),
        setDoc: async (ref: any, data: any, options?: any) => {
          const key = `${ref.col}/${ref.id}`;
          store[key] = options?.merge ? { ...store[key], ...data } : data;
        },
      };

      // 1. First lock acquisition succeeds
      const lock1 = await acquireFirestoreSyncLock(
        {},
        mockSdk,
        { email: "admin@tdtu.edu.vn", uid: "u_admin" }
      );
      expect(lock1.acquired).toBe(true);
      expect(lock1.lockId).toBeDefined();

      // 2. Second concurrent lock attempt without force fails
      const lock2 = await acquireFirestoreSyncLock(
        {},
        mockSdk,
        { email: "other@tdtu.edu.vn", uid: "u_other" }
      );
      expect(lock2.acquired).toBe(false);
      expect(lock2.message).toContain("Một phiên đồng bộ khác đang chạy");
      expect(lock2.remainingSeconds).toBeGreaterThan(0);

      // 3. Forcing lock acquisition succeeds
      const lockForce = await acquireFirestoreSyncLock(
        {},
        mockSdk,
        { email: "other@tdtu.edu.vn", uid: "u_other" },
        true
      );
      expect(lockForce.acquired).toBe(true);

      // 4. Releasing lock allows subsequent acquisition
      await releaseFirestoreSyncLock({}, mockSdk, lockForce.lockId);
      expect(store[`systemConfig/${RESEARCH_SYNC_LOCK_DOC_ID}`]?.isLocked).toBe(false);

      const lock3 = await acquireFirestoreSyncLock(
        {},
        mockSdk,
        { email: "admin@tdtu.edu.vn", uid: "u_admin" }
      );
      expect(lock3.acquired).toBe(true);
    });
  });

  describe("9. Drive Fetch Error Handling (No test fallback in production)", () => {
    it("ném lỗi FILE_NOT_FOUND (404) khi không tìm thấy file chỉ định, không tự ý lùi về file test", async () => {
      const { fetchLatestConferencesFromDrive, ResearchDriveJsonError } = await import("../services/researchDriveJsonService");

      const originalFetch = globalThis.fetch;
      try {
        // Mock Google Drive list files endpoint returning an empty file list
        globalThis.fetch = async (url: any) => {
          if (String(url).includes("googleapis.com/drive/v3/files")) {
            return {
              ok: true,
              json: async () => ({ files: [] }),
            } as any;
          }
          return originalFetch(url);
        };

        await expect(
          fetchLatestConferencesFromDrive({
            fileName: "IFA_RH_CONFERENCES.json",
            allowFallback: false,
          })
        ).rejects.toThrow(ResearchDriveJsonError);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
