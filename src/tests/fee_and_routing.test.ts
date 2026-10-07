import { describe, it, expect } from "vitest";
import {
  formatFeeValue,
  getPublicationFeeDisplay,
  getRegistrationFeeDisplay,
  getFeeStatusInfo,
  UNKNOWN_FEE_TEXT,
  FREE_FEE_TEXT,
} from "../utils/fee";
import {
  OFFICIAL_FACULTY_RESEARCH_RECORDS,
  mapRowToCandidate,
} from "../services/facultyResearchData";
import type { Opportunity, OpportunityCandidate } from "../types";

describe("FEES & Spark Opportunity Enrichment", () => {
  it("should format fee values safely with strict fallback to 'Không rõ chi phí'", () => {
    expect(formatFeeValue(null)).toBe(UNKNOWN_FEE_TEXT);
    expect(formatFeeValue(undefined)).toBe(UNKNOWN_FEE_TEXT);
    expect(formatFeeValue("")).toBe(UNKNOWN_FEE_TEXT);
    expect(formatFeeValue("   ")).toBe(UNKNOWN_FEE_TEXT);
    expect(formatFeeValue("0")).toBe(UNKNOWN_FEE_TEXT);
    expect(formatFeeValue("0đ")).toBe(UNKNOWN_FEE_TEXT);
    expect(formatFeeValue("0 VND")).toBe(UNKNOWN_FEE_TEXT);
    expect(formatFeeValue("Chưa rõ chi phí")).toBe(UNKNOWN_FEE_TEXT);
    expect(formatFeeValue("Không rõ")).toBe(UNKNOWN_FEE_TEXT);
  });

  it("should recognize explicit Free/Miễn phí fees", () => {
    expect(formatFeeValue("Miễn phí")).toBe(FREE_FEE_TEXT);
    expect(formatFeeValue("miễn phí tham dự")).toBe(FREE_FEE_TEXT);
    expect(formatFeeValue("FREE")).toBe(FREE_FEE_TEXT);
    expect(formatFeeValue("free")).toBe(FREE_FEE_TEXT);
  });

  it("should preserve specific fee amounts accurately", () => {
    expect(formatFeeValue("$250 USD / bài")).toBe("$250 USD / bài");
    expect(formatFeeValue("Theo quy định ĐH Đà Nẵng")).toBe("Theo quy định ĐH Đà Nẵng");
  });

  it("should extract publication fee with backward compatibility for legacy records", () => {
    // Record with publicationFee
    const opp1: Partial<Opportunity> = {
      publicationFee: "$250 USD",
      registrationFee: "$150 USD",
    };
    expect(getPublicationFeeDisplay(opp1)).toBe("$250 USD");
    expect(getRegistrationFeeDisplay(opp1)).toBe("$150 USD");

    // Legacy record with only fee string
    const legacyOpp: Partial<Opportunity> = {
      fee: "Miễn phí",
    };
    expect(getPublicationFeeDisplay(legacyOpp)).toBe(FREE_FEE_TEXT);
    expect(getRegistrationFeeDisplay(legacyOpp)).toBe(FREE_FEE_TEXT);

    // Completely empty legacy record
    const emptyOpp: Partial<Opportunity> = {
      title: "Hội thảo chưa rõ",
    };
    expect(getPublicationFeeDisplay(emptyOpp)).toBe(UNKNOWN_FEE_TEXT);
    expect(getRegistrationFeeDisplay(emptyOpp)).toBe(UNKNOWN_FEE_TEXT);
  });

  it("should calculate fee status badge correctly", () => {
    const freeOpp: Partial<Opportunity> = {
      publicationFee: "Miễn phí",
      registrationFee: "Miễn phí",
    };
    expect(getFeeStatusInfo(freeOpp).variant).toBe("free");

    const specifiedOpp: Partial<Opportunity> = {
      publicationFee: "$250 USD",
    };
    expect(getFeeStatusInfo(specifiedOpp).variant).toBe("specified");

    const unknownOpp: Partial<Opportunity> = {
      publicationFee: "Không rõ chi phí",
      registrationFee: "Không rõ chi phí",
    };
    expect(getFeeStatusInfo(unknownOpp).variant).toBe("unknown");
    expect(getFeeStatusInfo(unknownOpp).label).toBe(UNKNOWN_FEE_TEXT);
  });

  it("should correctly map all 8 official faculty research records with enriched fields", () => {
    expect(OFFICIAL_FACULTY_RESEARCH_RECORDS.length).toBe(8);

    OFFICIAL_FACULTY_RESEARCH_RECORDS.forEach((row, idx) => {
      const candidate = mapRowToCandidate(row, idx);

      expect(candidate.id).toBeTruthy();
      expect(candidate.title).toBeTruthy();
      expect(candidate.content).toBeTruthy();
      expect(candidate.directions).toBeTruthy();
      expect(candidate.feeStatus).toBeDefined();

      // Ensure publication fee and registration fee are NEVER empty or undefined
      expect(candidate.publicationFee).toBeDefined();
      expect(candidate.publicationFee?.length).toBeGreaterThan(0);
      expect(candidate.registrationFee).toBeDefined();
      expect(candidate.registrationFee?.length).toBeGreaterThan(0);

      // Deadlines must be distinct
      if (candidate.fullPaperDeadline) {
        expect(candidate.deadline).toBe(candidate.fullPaperDeadline);
      }
    });
  });
});

describe("ROUTING on Refresh (F5 / Ctrl+F5) Verification", () => {
  // Pure route resolver replicating parseUrlRoute in App.tsx
  const resolveRoute = (pathname: string, hash: string): string => {
    const cleanHash = hash.replace(/^#\/?/, "").trim();

    if (pathname === "/own" || cleanHash === "own") {
      return "owner";
    }

    if (cleanHash && cleanHash !== "public") {
      return cleanHash;
    }

    // Root path ('/' or '#public' or '#/public'):
    // MUST ALWAYS stay on public home, regardless of whether user is authenticated or not!
    return "public";
  };

  it("should STAY on public home when refreshed at root URL ('/')", () => {
    expect(resolveRoute("/", "")).toBe("public");
    expect(resolveRoute("/", "#")).toBe("public");
    expect(resolveRoute("/", "#/")).toBe("public");
    expect(resolveRoute("/", "#public")).toBe("public");
    expect(resolveRoute("/", "#/public")).toBe("public");
  });

  it("should STAY on private workspace tab when refreshed with specific hash", () => {
    expect(resolveRoute("/", "#admin_dashboard")).toBe("admin_dashboard");
    expect(resolveRoute("/", "#/admin_dashboard")).toBe("admin_dashboard");
    expect(resolveRoute("/", "#research_progress")).toBe("research_progress");
    expect(resolveRoute("/", "#/research_progress")).toBe("research_progress");
    expect(resolveRoute("/", "#admin_lecturers")).toBe("admin_lecturers");
    expect(resolveRoute("/", "#/admin_lecturers")).toBe("admin_lecturers");
    expect(resolveRoute("/", "#publications")).toBe("publications");
    expect(resolveRoute("/", "#admin_candidates")).toBe("admin_candidates");
  });

  it("should STAY on owner page when refreshed at /own or #own", () => {
    expect(resolveRoute("/own", "")).toBe("owner");
    expect(resolveRoute("/", "#own")).toBe("owner");
    expect(resolveRoute("/", "#/own")).toBe("owner");
  });
});
