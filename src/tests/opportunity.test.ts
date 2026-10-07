import { describe, it, expect } from "vitest";
import { normalizeText, isDuplicateOpportunity } from "../utils/dedupe";
import { getDeadlineBadge, getOpportunityDeadlineInfo } from "../utils/date";

describe("OPPORTUNITY & Candidate Deduplication", () => {
  it("should normalize titles and text accurately across accents and casing", () => {
    expect(normalizeText("Hội Thảo Quốc Tế Về Mỹ Thuật 2026")).toBe(
      "hoi thao quoc te ve my thuat 2026"
    );
  });

  it("should detect duplicates by exact matching URL", () => {
    const candidate = {
      title: "Hội thảo Thiết kế & AI 2026",
      sourceUrl: "https://conference.org/ai-design",
      organizer: "ĐH TDTU",
    };
    const existing = [
      {
        title: "International AI Design Conference",
        sourceUrl: "https://conference.org/ai-design",
        organizer: "TDTU",
      },
    ];

    const result = isDuplicateOpportunity(candidate, existing);
    expect(result.isDuplicate).toBe(true);
    expect(result.matchReason).toContain("Trùng link nguồn chính thức");
  });

  it("should detect duplicates by matching title and organizer", () => {
    const candidate = {
      title: "Hội thảo quốc tế về thiết kế đồ họa tương tác 2026",
      organizer: "Khoa MTCN TDTU",
    };
    const existing = [
      {
        title: "Hội thảo Quốc tế về Thiết kế Đồ họa Tương tác 2026 (ICGD 2026)",
        organizer: "Khoa MTCN TDTU",
      },
    ];

    const result = isDuplicateOpportunity(candidate, existing);
    expect(result.isDuplicate).toBe(true);
  });

  it("should not flag distinct opportunities as duplicate", () => {
    const candidate = {
      title: "Hội thảo Thiết kế Nội thất Bền vững",
      sourceUrl: "https://interior-conf.org",
      organizer: "Hội KTS",
    };
    const existing = [
      {
        title: "Hội nghị Thiết kế Thời trang và Vật liệu Mới",
        sourceUrl: "https://fashion-conf.org",
        organizer: "ĐH Mỹ thuật",
      },
    ];

    const result = isDuplicateOpportunity(candidate, existing);
    expect(result.isDuplicate).toBe(false);
  });

  it("should detect duplicates by matching submission/registration URL", () => {
    const candidate = {
      title: "Hội thảo ICISN 2027",
      submissionUrl: "https://www.icisn.com/for-attendees",
      organizer: "ĐH Hải Dương",
    };
    const existing = [
      {
        title: "International Conference on Intelligent Systems and Networks 2027",
        submissionUrl: "https://www.icisn.com/for-attendees",
        organizer: "Đại học Hải Dương & Sở KHCN Hải Phòng",
      },
    ];

    const result = isDuplicateOpportunity(candidate, existing);
    expect(result.isDuplicate).toBe(true);
    expect(result.matchReason).toContain("Trùng link nộp bài / đăng ký");
  });

  it("should compute deadline badge statuses accurately with <=7 days urgent and <=14 days warning", () => {
    const now = new Date();
    // 3 days in future -> CẤP BÁCH (<= 7 ngày)
    const near = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const badgeNear = getDeadlineBadge(near.toISOString());
    expect(badgeNear.variant).toBe("urgent");

    // 10 days in future -> CẢNH BÁO (<= 14 ngày)
    const warningDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    const badgeWarning = getDeadlineBadge(warningDate.toISOString());
    expect(badgeWarning.variant).toBe("warning");

    // Past date -> HẾT HẠN
    const past = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const badgePast = getDeadlineBadge(past.toISOString());
    expect(badgePast.text).toBe("HẾT HẠN");

    // Far future -> CÒN HẠN
    const far = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const badgeFar = getDeadlineBadge(far.toISOString());
    expect(badgeFar.variant).toBe("success");
  });

  it("should prioritize abstract deadline over full paper deadline in getOpportunityDeadlineInfo", () => {
    const now = new Date();
    const abstractDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const fullPaperDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const info = getOpportunityDeadlineInfo({
      abstractDeadline: abstractDate.toISOString(),
      fullPaperDeadline: fullPaperDate.toISOString(),
    });

    expect(info.nearestDeadlineType).toBe("abstract");
    expect(info.nearestDeadlineLabel).toBe("Hạn nộp tóm tắt");
    expect(info.isUrgent).toBe(true);
    expect(info.countdownText).toBe("Còn 5 ngày");
  });
});

describe("DATE FORMATTING & SHEET DATA PIPELINE", () => {
  it("should safely format date ranges, ISO dates, and ignore 'Chưa xác minh'", async () => {
    const { formatDateVN } = await import("../utils/date");
    expect(formatDateVN("03/12/2026 - 04/12/2026")).toBe("03/12/2026 - 04/12/2026");
    expect(formatDateVN("Chưa xác minh")).toBe("");
    expect(formatDateVN("2026-10-30T00:00:00.000Z")).toBe("30/10/2026");
    expect(formatDateVN("")).toBe("");
    expect(formatDateVN(null)).toBe("");
  });

  it("should map all 8 records from official sheet correctly without errors", async () => {
    const { OFFICIAL_FACULTY_RESEARCH_RECORDS, mapRowToCandidate } = await import(
      "../services/facultyResearchData"
    );
    expect(OFFICIAL_FACULTY_RESEARCH_RECORDS.length).toBe(8);

    const candidates = OFFICIAL_FACULTY_RESEARCH_RECORDS.map((row, idx) =>
      mapRowToCandidate(row, idx)
    );

    // Verify all candidates have valid fields
    for (const c of candidates) {
      expect(c.title).toBeTruthy();
      expect(c.organizer).toBeTruthy();
      expect(c.sourceType).toBe("SPARK");
      expect(c.status).toBe("pending");
      expect(c.suitability).toBeTruthy();
      // No NaN in titles or content
      expect(c.title).not.toContain("NaN");
      expect(c.content).not.toContain("NaN");
    }

    // Verify specific records
    expect(candidates[0].title).toContain("9th CIEMB 2026");
    expect(candidates[0].suitability).toBe("Phù hợp");
    expect(candidates[2].title).toContain("ICISN 2027");
    expect(candidates[2].indexing).toContain("Scopus");
    expect(candidates[2].suitability).toBe("Rất phù hợp");
    expect(candidates[7].title).toContain("RTD 2026");
    expect(candidates[7].sheetStatus).toBe("HẾT HẠN");
  });
});
