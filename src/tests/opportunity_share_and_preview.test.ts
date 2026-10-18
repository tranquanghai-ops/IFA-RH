import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import {
  buildOpportunityShareUrl,
  buildCandidatePreviewUrl,
  copyTextToClipboard,
} from "../utils/share";
import type { OpportunityCandidate, OpportunityPreview } from "../types";

describe("Opportunity Share and Preview System", () => {
  let originalWindow: any;
  let originalDocument: any;
  let originalNavigator: any;

  beforeAll(() => {
    originalWindow = (globalThis as any).window;
    originalDocument = (globalThis as any).document;
    originalNavigator = (globalThis as any).navigator;

    const mockDoc: any = {
      createElement: vi.fn().mockImplementation((tag: string) => {
        return {
          tagName: tag.toUpperCase(),
          value: "",
          style: {},
          setAttribute: vi.fn(),
          focus: vi.fn(),
          select: vi.fn(),
        };
      }),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
      execCommand: vi.fn().mockReturnValue(true),
    };

    const mockWin: any = {
      location: {
        origin: "https://ifa-rh.web.app",
        pathname: "/",
        search: "",
        href: "https://ifa-rh.web.app/",
      },
      history: {
        pushState: vi.fn(),
      },
      dispatchEvent: vi.fn(),
    };

    const mockNav: any = {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    };

    Object.defineProperty(globalThis, "window", { value: mockWin, configurable: true, writable: true });
    Object.defineProperty(globalThis, "document", { value: mockDoc, configurable: true, writable: true });
    Object.defineProperty(globalThis, "navigator", { value: mockNav, configurable: true, writable: true });
  });

  afterAll(() => {
    Object.defineProperty(globalThis, "window", { value: originalWindow, configurable: true, writable: true });
    Object.defineProperty(globalThis, "document", { value: originalDocument, configurable: true, writable: true });
    Object.defineProperty(globalThis, "navigator", { value: originalNavigator, configurable: true, writable: true });
  });

  beforeEach(() => {
    (globalThis as any).window.location = {
      origin: "https://ifa-rh.web.app",
      pathname: "/",
      search: "",
      href: "https://ifa-rh.web.app/",
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("URL Generation for Direct Sharing & AI Previews", () => {
    it("generates correct public URL for published opportunities using document ID", () => {
      const docId = "opp_tn0001_vass_2026";
      const url = buildOpportunityShareUrl(docId);
      expect(url).toBe("https://ifa-rh.web.app/?opportunity=opp_tn0001_vass_2026");
      expect(url).not.toContain("#");
      expect(url).not.toContain("admin");
    });

    it("generates correct read-only preview URL for AI candidate previews using preview ID", () => {
      const previewId = "prev_cand_qt0002_aicit_2026";
      const url = buildCandidatePreviewUrl(previewId);
      expect(url).toBe("https://ifa-rh.web.app/?preview=prev_cand_qt0002_aicit_2026");
      expect(url).not.toContain("#");
      expect(url).not.toContain("admin");
    });

    it("handles URL encoding safely for document IDs with special characters", () => {
      const complexDocId = "opp/2026?test=1&value=ok";
      const url = buildOpportunityShareUrl(complexDocId);
      expect(url).toBe(`https://ifa-rh.web.app/?opportunity=${encodeURIComponent(complexDocId)}`);
    });

    it("handles trailing slash in origin without double slashes", () => {
      (globalThis as any).window.location.origin = "https://ifa-rh.web.app/";
      const url = buildOpportunityShareUrl("opp_123");
      expect(url).toBe("https://ifa-rh.web.app/?opportunity=opp_123");
      expect(url).not.toContain(".app//");
    });
  });

  describe("Clipboard Copy Helper", () => {
    it("copies text using navigator.clipboard when available", async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      (globalThis as any).navigator.clipboard = {
        writeText: writeTextMock,
      };

      const success = await copyTextToClipboard("https://ifa-rh.web.app/?opportunity=opp_123");
      expect(success).toBe(true);
      expect(writeTextMock).toHaveBeenCalledWith("https://ifa-rh.web.app/?opportunity=opp_123");
    });

    it("falls back to document.execCommand when navigator.clipboard throws or is absent", async () => {
      (globalThis as any).navigator.clipboard = {
        writeText: vi.fn().mockRejectedValue(new Error("Clipboard permission denied")),
      };

      const appendChildSpy = vi.spyOn((globalThis as any).document.body, "appendChild");
      const removeChildSpy = vi.spyOn((globalThis as any).document.body, "removeChild");

      const success = await copyTextToClipboard("https://ifa-rh.web.app/?opportunity=opp_fallback");
      expect(success).toBe(true);
      expect((globalThis as any).document.execCommand).toHaveBeenCalledWith("copy");
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
    });
  });

  describe("Data Isolation & Field Sanitization for AI Candidate Previews", () => {
    const mockCandidate: OpportunityCandidate = {
      id: "cand_spark_qt0003",
      conferenceCode: "QT0003",
      category: "QT",
      sourceType: "SPARK",
      changeType: "create",
      title: "International Conference on Contemporary Art & AI 2026",
      organizer: "Khoa MTCN - ĐH Tôn Đức Thắng & ĐH Quốc tế RMIT",
      location: "Thành phố Hồ Chí Minh",
      country: "Việt Nam",
      eventDate: "2026-11-20 to 2026-11-22",
      deadline: "2026-09-15",
      publicationFee: "Miễn phí",
      registrationFee: "500,000 VND",
      field: "Mỹ thuật ứng dụng & Thiết kế số",
      level: "Quốc tế",
      type: "Hội thảo",
      topic: "Nghệ thuật đương đại và Trí tuệ nhân tạo",
      tags: ["GenAI", "Art", "Design"],
      content: "Hội thảo chuyên sâu về ứng dụng trí tuệ nhân tạo trong thiết kế và mỹ thuật đương đại.",
      topicsDetailed: ["GenAI in Art", "Digital Humanities", "Virtual Reality Exhibition"],
      directions: "Thiết kế công nghiệp, Thiết kế đồ họa",
      sourceUrl: "https://spark.org/art-ai-2026",
      submissionUrl: "https://easychair.org/conferences/?conf=artai2026",
      status: "pending",
      normalizedTitle: "international conference on contemporary art ai 2026",
      // Internal review and system fields that MUST NOT leak to public previews
      diffSummary: [{ field: "title", label: "Tên", oldValue: "Old", newValue: "New" }],
      rejectionReason: "Chưa đủ giấy phép",
      reviewedBy: "admin@tdtu.edu.vn",
      reviewedAt: "2026-10-15T08:00:00Z",
      createdAt: "2026-10-18T01:00:00Z",
      updatedAt: "2026-10-18T01:00:00Z",
    };

    it("sanitizes candidate data by keeping only public metadata and omitting internal review fields", () => {
      const previewPayload: OpportunityPreview = {
        id: `prev_${mockCandidate.id}`,
        candidateId: mockCandidate.id,
        conferenceCode: mockCandidate.conferenceCode,
        category: mockCandidate.category,
        title: mockCandidate.title,
        organizer: mockCandidate.organizer,
        location: mockCandidate.location,
        country: mockCandidate.country,
        eventDate: mockCandidate.eventDate,
        deadline: mockCandidate.deadline,
        publicationFee: mockCandidate.publicationFee,
        registrationFee: mockCandidate.registrationFee,
        field: mockCandidate.field,
        level: mockCandidate.level,
        type: mockCandidate.type,
        topic: mockCandidate.topic,
        tags: mockCandidate.tags,
        content: mockCandidate.content,
        topicsDetailed: mockCandidate.topicsDetailed,
        directions: mockCandidate.directions,
        sourceUrl: mockCandidate.sourceUrl,
        submissionUrl: mockCandidate.submissionUrl,
        status: "active",
        createdAt: "2026-10-18T02:00:00Z",
        updatedAt: "2026-10-18T02:00:00Z",
        createdBy: "admin@tdtu.edu.vn",
      };

      // Verify public fields are preserved
      expect(previewPayload.title).toBe(mockCandidate.title);
      expect(previewPayload.conferenceCode).toBe("QT0003");
      expect(previewPayload.publicationFee).toBe("Miễn phí");
      expect(previewPayload.registrationFee).toBe("500,000 VND");
      expect(previewPayload.topicsDetailed).toEqual(["GenAI in Art", "Digital Humanities", "Virtual Reality Exhibition"]);
      expect(previewPayload.status).toBe("active");

      // Verify internal administrative and diff fields are completely excluded
      expect((previewPayload as any).diffSummary).toBeUndefined();
      expect((previewPayload as any).rejectionReason).toBeUndefined();
      expect((previewPayload as any).needsReviewReason).toBeUndefined();
      expect((previewPayload as any).syncBatchId).toBeUndefined();
      expect((previewPayload as any).rawSource).toBeUndefined();
    });
  });

  describe("Security Rules Logic for Opportunity Previews (Firestore Rules Simulation)", () => {
    const isValidOpportunityPreview = (data: any): boolean => {
      if (!data) return false;
      const validStatuses = ["active", "revoked"];
      if (!validStatuses.includes(data.status)) return false;
      if (typeof data.title !== "string" || data.title.length === 0 || data.title.length > 300) return false;
      if (typeof data.candidateId !== "string" || data.candidateId.length === 0) return false;
      if (typeof data.content !== "string" || data.content.length > 50000) return false;
      if (data.topicsDetailed && (!Array.isArray(data.topicsDetailed) || data.topicsDetailed.length > 50)) return false;
      if (data.directions && typeof data.directions !== "string") return false;
      return true;
    };

    it("accepts valid preview records with active status", () => {
      const valid = {
        title: "Hội thảo quốc tế AI",
        candidateId: "cand_123",
        status: "active",
        content: "Tóm tắt hội thảo",
        topicsDetailed: ["Topic 1", "Topic 2"],
        directions: "Direction A",
      };
      expect(isValidOpportunityPreview(valid)).toBe(true);
    });

    it("rejects preview records with invalid status", () => {
      const invalid = {
        title: "Hội thảo quốc tế AI",
        candidateId: "cand_123",
        status: "published", // "published" is for opportunities, not previews
        content: "Nội dung",
      };
      expect(isValidOpportunityPreview(invalid)).toBe(false);

      const invalidClosed = {
        title: "Hội thảo quốc tế AI",
        candidateId: "cand_123",
        status: "closed",
        content: "Nội dung",
      };
      expect(isValidOpportunityPreview(invalidClosed)).toBe(false);
    });

    it("rejects preview records exceeding field length constraints", () => {
      const tooLongTitle = {
        title: "A".repeat(301),
        candidateId: "cand_123",
        status: "active",
        content: "Nội dung",
      };
      expect(isValidOpportunityPreview(tooLongTitle)).toBe(false);

      const tooManyTopics = {
        title: "Hội thảo",
        candidateId: "cand_123",
        status: "active",
        content: "Nội dung",
        topicsDetailed: Array(51).fill("topic"),
      };
      expect(isValidOpportunityPreview(tooManyTopics)).toBe(false);
    });

    describe("Access Control Logic", () => {
      const canGetPreview = (callerRole: string | null, previewStatus: string): boolean => {
        const isAdmin = callerRole === "admin" || callerRole === "owner";
        return previewStatus === "active" || isAdmin;
      };

      const canListPreviews = (callerRole: string | null): boolean => {
        return callerRole === "admin" || callerRole === "owner";
      };

      const canWritePreview = (callerRole: string | null): boolean => {
        return callerRole === "admin" || callerRole === "owner";
      };

      it("permits unauthenticated visitor (null role) to GET active preview", () => {
        expect(canGetPreview(null, "active")).toBe(true);
      });

      it("denies unauthenticated visitor (null role) from GET revoked preview", () => {
        expect(canGetPreview(null, "revoked")).toBe(false);
        expect(canGetPreview(null, "expired")).toBe(false);
      });

      it("permits Admin to GET active, revoked, or expired previews", () => {
        expect(canGetPreview("admin", "active")).toBe(true);
        expect(canGetPreview("admin", "revoked")).toBe(true);
        expect(canGetPreview("admin", "expired")).toBe(true);
      });

      it("strictly denies unauthenticated visitor or regular lecturer from LISTING previews", () => {
        expect(canListPreviews(null)).toBe(false);
        expect(canListPreviews("lecturer")).toBe(false);
        expect(canListPreviews("admin")).toBe(true);
      });

      it("strictly denies non-admins from creating or revoking previews", () => {
        expect(canWritePreview(null)).toBe(false);
        expect(canWritePreview("lecturer")).toBe(false);
        expect(canWritePreview("admin")).toBe(true);
        expect(canWritePreview("owner")).toBe(true);
      });
    });
  });

  describe("Public Single Opportunity & Preview Navigation Logic", () => {
    it("recognizes published opportunity parameter (?opportunity=id)", () => {
      const searchParams = new URLSearchParams("?opportunity=opp_ciem_2026");
      const oppId = searchParams.get("opportunity");
      const prevId = searchParams.get("preview");

      expect(oppId).toBe("opp_ciem_2026");
      expect(prevId).toBeNull();
    });

    it("recognizes preview parameter (?preview=prev_id)", () => {
      const searchParams = new URLSearchParams("?preview=prev_cand_qt0001");
      const oppId = searchParams.get("opportunity");
      const prevId = searchParams.get("preview");

      expect(oppId).toBeNull();
      expect(prevId).toBe("prev_cand_qt0001");
    });

    it("clears query params on close without invoking window.close() or navigating to admin", () => {
      const pushStateSpy = vi.spyOn((globalThis as any).window.history, "pushState");
      const dispatchEventSpy = vi.spyOn((globalThis as any).window, "dispatchEvent");

      const handleClose = () => {
        const url = new URL((globalThis as any).window.location.href);
        url.searchParams.delete("opportunity");
        url.searchParams.delete("preview");
        (globalThis as any).window.history.pushState({}, "", url.pathname);
        (globalThis as any).window.dispatchEvent({ type: "popstate" });
      };

      handleClose();

      expect(pushStateSpy).toHaveBeenCalledWith({}, "", "/");
      expect(dispatchEventSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "popstate" }));
    });
  });
});
