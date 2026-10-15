import { describe, it, expect } from "vitest";
import {
  normalizeCanonicalUrl,
  normalizeLocationForComparison,
  isMeaningfulFieldChange,
  findMatchingResearchOpportunity,
  type ResearchMatchTarget,
} from "../utils/researchDedupe";
import {
  getCandidatePrimaryCategory,
  isAutoClosedProposal,
  getCandidateCategory,
} from "../pages/AdminCandidatesPage";
import type { OpportunityCandidate } from "../types";

describe("Conference Deduplication & Governance Suite", () => {
  describe("URL and Location Normalization", () => {
    it("normalizeCanonicalUrl strips mailto: protocol as well as http/https/www", () => {
      expect(normalizeCanonicalUrl("mailto:pqlkh@neu.edu.vn")).toBe("pqlkh@neu.edu.vn");
      expect(normalizeCanonicalUrl("pqlkh@neu.edu.vn")).toBe("pqlkh@neu.edu.vn");
      expect(normalizeCanonicalUrl("https://pqlkh.neu.edu.vn/")).toBe("pqlkh.neu.edu.vn");
      expect(normalizeCanonicalUrl("http://www.neu.edu.vn/conf")).toBe("neu.edu.vn/conf");
    });

    it("normalizeLocationForComparison equates Hybrid and Trực tiếp kết hợp trực tuyến", () => {
      const loc1 = normalizeLocationForComparison("Đại học Kinh tế Quốc dân, Hà Nội / Trực tiếp kết hợp trực tuyến");
      const loc2 = normalizeLocationForComparison("Đại học Kinh tế Quốc dân, Hà Nội / Hybrid");
      expect(loc1).toBe(loc2);

      const loc3 = normalizeLocationForComparison("Pretoria, Nam Phi / Kết hợp trực tuyến");
      const loc4 = normalizeLocationForComparison("Pretoria, Nam Phi / Hybrid");
      expect(loc3).toBe(loc4);
    });

    it("isMeaningfulFieldChange does not trigger update for mailto vs plain email or Hybrid location phrasing", () => {
      const overrides = new Set<string>();

      // Email with or without mailto:
      expect(
        isMeaningfulFieldChange("submissionUrl", "pqlkh@neu.edu.vn", "mailto:pqlkh@neu.edu.vn", overrides)
      ).toBe(false);

      // Location with Hybrid vs Trực tiếp kết hợp trực tuyến
      expect(
        isMeaningfulFieldChange(
          "location",
          "Đại học Kinh tế Quốc dân, Hà Nội / Hybrid",
          "Đại học Kinh tế Quốc dân, Hà Nội / Trực tiếp kết hợp trực tuyến",
          overrides
        )
      ).toBe(false);
    });
  });

  describe("Conference Code Matching (Rule 0a)", () => {
    const existingList: ResearchMatchTarget[] = [
      {
        id: "opp_ietbhec_2027",
        title: "Hội thảo quốc tế IETBHEC 2027",
        conferenceCode: "TN0001",
        category: "TN",
        status: "published",
      },
      {
        id: "opp_global_south_2026",
        title: "Shaping the Future of the Global South",
        conferenceCode: "QT0003",
        category: "QT",
        status: "published",
      },
      {
        id: "cand_auto_haxd",
        title: "HAXD 2027",
        conferenceCode: "QT0001",
        category: "QT",
        status: "pending",
      },
    ];

    it("matches directly by conferenceCode for TN and QT", () => {
      const rowTN = {
        title: "Hội thảo khác biệt tiêu đề nhưng cùng mã",
        conferenceCode: "TN0001",
      };
      const matchTN = findMatchingResearchOpportunity(rowTN as any, existingList);
      expect(matchTN.isMatch).toBe(true);
      expect(matchTN.matchedId).toBe("opp_ietbhec_2027");

      const rowQT = {
        title: "Global South Conference",
        conferenceCode: "QT0003",
      };
      const matchQT = findMatchingResearchOpportunity(rowQT as any, existingList);
      expect(matchQT.isMatch).toBe(true);
      expect(matchQT.matchedId).toBe("opp_global_south_2026");

      const rowQTNew = {
        title: "3rd International Conference on Human-Agent Interaction",
        conferenceCode: "QT0001",
      };
      const matchQTNew = findMatchingResearchOpportunity(rowQTNew as any, existingList);
      expect(matchQTNew.isMatch).toBe(true);
      expect(matchQTNew.matchedId).toBe("cand_auto_haxd");
    });
  });

  describe("Candidate Filtering and Classification", () => {
    const baseCandidate: OpportunityCandidate = {
      id: "cand-test",
      title: "Test Conference",
      organizer: "Test Organizer",
      country: "Việt Nam",
      type: "Hội thảo",
      level: "Quốc gia",
      topic: "Topic",
      field: "Field",
      tags: [],
      deadline: "2027-12-31",
      content: "Content",
      sourceType: "SPARK",
      status: "pending",
      normalizedTitle: "test conference",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };

    it("approved candidate always categorizes as 'approved' and never appears in pending/updates", () => {
      const approvedCandidate: OpportunityCandidate = {
        ...baseCandidate,
        id: "spark_opp_1",
        title: "Hội thảo đã duyệt",
        status: "approved",
        conferenceCode: "TN0001",
        category: "TN",
        publishedOpportunityId: "opp_ietbhec_2027",
      };

      expect(getCandidatePrimaryCategory(approvedCandidate)).toBe("approved");
    });

    it("auto-closed update proposal categorizes as 'closed' and not 'rejected' or 'updates'", () => {
      const autoClosedProposal: OpportunityCandidate = {
        ...baseCandidate,
        id: "cand_upd_opp_ietbhec_2027",
        title: "IETBHEC 2027",
        status: "closed",
        resolutionType: "AUTO_CLOSED",
        rejectionReason: "Đồng bộ chuẩn hóa: Hội thảo đã được công bố chính thức. Đề xuất cập nhật do khác biệt định dạng đã được tự động đóng để chống trùng lặp.",
        conferenceCode: "TN0001",
        publishedOpportunityId: "opp_ietbhec_2027",
      };

      expect(isAutoClosedProposal(autoClosedProposal)).toBe(true);
      expect(getCandidatePrimaryCategory(autoClosedProposal)).toBe("closed");
    });

    it("pending update proposal categorizes as 'updates'", () => {
      const pendingUpdate: OpportunityCandidate = {
        ...baseCandidate,
        id: "cand_upd_opp_global_south_2026",
        title: "Shaping the Future of the Global South",
        status: "pending",
        changeType: "update",
        conferenceCode: "QT0003",
        publishedOpportunityId: "opp_global_south_2026",
      };

      expect(getCandidatePrimaryCategory(pendingUpdate)).toBe("updates");
    });

    it("new pending candidate categorizes as 'pending'", () => {
      const newCandidate: OpportunityCandidate = {
        ...baseCandidate,
        id: "cand_auto_haxd_2027",
        title: "HAXD 2027",
        organizer: "Naples, Italy",
        country: "Ý",
        status: "pending",
        changeType: "create",
        conferenceCode: "QT0001",
      };

      expect(getCandidatePrimaryCategory(newCandidate)).toBe("pending");
      expect(getCandidateCategory(newCandidate)).toBe("QT");
    });
  });
});
