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
      expect(raw.deadline).toBe("2027-01-15");
      expect(raw.eventDate).toBe("2027-06-15");
      expect(raw.statusText).toBe("NHẬN BÀI");
      expect(raw.runId).toBe("test_run_1");
    });
  });
});
