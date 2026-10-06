import { describe, it, expect } from "vitest";
import { normalizeText, isDuplicateOpportunity } from "../utils/dedupe";
import { getDeadlineBadge } from "../utils/date";

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

  it("should compute deadline badge statuses accurately", () => {
    const now = new Date();
    // 3 days in future -> SẮP HẾT HẠN
    const near = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const badgeNear = getDeadlineBadge(near.toISOString());
    expect(badgeNear.variant).toBe("warning");

    // Past date -> HẾT HẠN
    const past = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const badgePast = getDeadlineBadge(past.toISOString());
    expect(badgePast.text).toBe("HẾT HẠN");

    // Far future -> CÒN HẠN
    const far = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const badgeFar = getDeadlineBadge(far.toISOString());
    expect(badgeFar.variant).toBe("success");
  });
});
