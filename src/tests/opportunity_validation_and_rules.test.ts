import { describe, it, expect } from "vitest";
import { validateAndNormalizeDate, validateOpportunityForm } from "../utils/opportunityValidation";

describe("Opportunity Form Validation & Firestore Rules Conformance", () => {
  describe("validateAndNormalizeDate", () => {
    it("accepts valid dd/mm/yyyy dates and normalizes them", () => {
      const res = validateAndNormalizeDate("15/10/2026");
      expect(res.valid).toBe(true);
      expect(res.normalized).toBe("15/10/2026");
    });

    it("accepts yyyy-mm-dd format and converts to dd/mm/yyyy", () => {
      const res = validateAndNormalizeDate("2027-03-25");
      expect(res.valid).toBe(true);
      expect(res.normalized).toBe("25/03/2027");
    });

    it("accepts valid date ranges", () => {
      const res = validateAndNormalizeDate("25/02/2027 - 27/02/2027");
      expect(res.valid).toBe(true);
      expect(res.normalized).toBe("25/02/2027 - 27/02/2027");
    });

    it("strictly rejects 5-digit years such as 52027", () => {
      const res1 = validateAndNormalizeDate("15/10/52027");
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain("52027");

      const res2 = validateAndNormalizeDate("52027-10-15");
      expect(res2.valid).toBe(false);
      expect(res2.error).toContain("52027");
    });

    it("rejects out-of-range years (< 2020 or > 2050)", () => {
      const resOld = validateAndNormalizeDate("15/10/2018");
      expect(resOld.valid).toBe(false);
      expect(resOld.error).toContain("2018");

      const resFar = validateAndNormalizeDate("15/10/2065");
      expect(resFar.valid).toBe(false);
      expect(resFar.error).toContain("2065");
    });

    it("rejects completely malformed date strings", () => {
      const res = validateAndNormalizeDate("abc-xyz");
      expect(res.valid).toBe(false);
      expect(res.error).toBeDefined();
    });
  });

  describe("validateOpportunityForm", () => {
    it("fails when organizer is missing or empty (preventing firestore.rules rejection)", () => {
      const res = validateOpportunityForm({
        title: "Hội thảo Quốc tế Mỹ thuật Công nghiệp 2027",
        organizer: "",
        deadline: "15/10/2026",
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.organizer).toContain("bắt buộc");
    });

    it("fails when title is missing or empty", () => {
      const res = validateOpportunityForm({
        title: "",
        organizer: "Đại học Tôn Đức Thắng",
        deadline: "15/10/2026",
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.title).toBeDefined();
    });

    it("fails when deadline contains 5-digit year 52027", () => {
      const res = validateOpportunityForm({
        title: "CREATIVEARTS 2027",
        organizer: "Đại học Kiến trúc TP.HCM",
        deadline: "15/10/52027",
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.deadline).toContain("52027");
    });

    it("fails when eventDate contains invalid year", () => {
      const res = validateOpportunityForm({
        title: "CREATIVEARTS 2027",
        organizer: "Đại học Kiến trúc TP.HCM",
        deadline: "15/10/2026",
        eventDate: "20/05/52027",
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.eventDate).toContain("52027");
    });

    it("strips empty enum strings so firestore.rules does not fail on enum constraints", () => {
      const res = validateOpportunityForm({
        title: "CREATIVEARTS 2027 – International Conference on Intermedia Arts",
        organizer: "Hội Mỹ thuật TP.HCM",
        deadline: "20/12/2026",
        category: "" as any,
        feeStatus: "" as any,
        abstractDeadline: "",
        fullPaperDeadline: "",
      });
      expect(res.isValid).toBe(true);
      expect(res.sanitized).toBeDefined();
      // category falls back to valid default 'QT' so it satisfies rules
      expect(["TN", "QT"]).toContain(res.sanitized?.category);
      // feeStatus empty string is stripped to prevent violating enum
      expect(res.sanitized?.feeStatus).toBeUndefined();
      expect(res.sanitized?.abstractDeadline).toBeUndefined();
    });

    it("cleans undefined fields and preserves valid values", () => {
      const res = validateOpportunityForm({
        title: "Hội thảo Quốc gia MTCN 2026",
        organizer: "Đại học Mỹ thuật",
        deadline: "2026-11-30",
        level: "Quốc gia",
        category: "TN",
        feeStatus: "FREE",
        publicationFee: "Miễn phí",
      });
      expect(res.isValid).toBe(true);
      expect(res.sanitized?.deadline).toBe("30/11/2026");
      expect(res.sanitized?.category).toBe("TN");
      expect(res.sanitized?.feeStatus).toBe("FREE");
      expect(res.sanitized?.organizer).toBe("Đại học Mỹ thuật");
    });

    it("validates that the sanitized payload conforms to firestore.rules isValidOpportunity requirements", () => {
      const res = validateOpportunityForm({
        title: "CREATIVEARTS 2027 – International Conference on Intermedia Arts and Creative Technology",
        organizer: "Đại học Mỹ thuật Công nghiệp",
        country: "Việt Nam",
        type: "Hội thảo",
        level: "Quốc tế",
        category: "QT",
        field: "Mỹ thuật & Thiết kế",
        deadline: "15/12/2026",
        eventDate: "20/03/2027 - 22/03/2027",
        location: "TP. Hồ Chí Minh",
        status: "published",
        feeStatus: "SPECIFIED",
        publicationFee: "2.000.000 VNĐ",
        registrationFee: "1.000.000 VNĐ",
      });

      expect(res.isValid).toBe(true);
      const data = res.sanitized!;

      // Check fields required by isValidOpportunity:
      expect(typeof data.title).toBe("string");
      expect(data.title!.length).toBeGreaterThanOrEqual(1);
      expect(data.title!.length).toBeLessThanOrEqual(500);

      expect(typeof data.organizer).toBe("string");
      expect(data.organizer!.length).toBeGreaterThanOrEqual(1);
      expect(data.organizer!.length).toBeLessThanOrEqual(200);

      expect(typeof data.deadline).toBe("string");
      expect(data.deadline!.length).toBeGreaterThanOrEqual(1);
      expect(data.deadline!.length).toBeLessThanOrEqual(50);

      expect(["published", "archived", "hidden", "recalled"]).toContain(data.status);
      expect(["SPECIFIED", "UNKNOWN", "FREE"]).toContain(data.feeStatus);
      expect(["TN", "QT"]).toContain(data.category);
    });
  });
});
