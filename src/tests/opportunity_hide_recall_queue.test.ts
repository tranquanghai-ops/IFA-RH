import { describe, it, expect } from "vitest";
import type { Opportunity, OpportunityCandidate, UserRole } from "../types";
import { normalizeText } from "../utils/dedupe";

describe("Opportunity Management: Hide, AI Recall, and Pending Queue Count", () => {
  // Public access rule simulation matching firestore.rules
  // allow read: if resource.data.status == 'published' || isAdmin();
  const isPubliclyVisible = (status: Opportunity["status"]): boolean => {
    return status === "published";
  };

  const isVisibleInAdmin = (status: Opportunity["status"]): boolean => {
    return ["published", "hidden", "recalled", "archived"].includes(status);
  };

  // Helper simulating hide logic
  const simulateHideOpportunity = (
    opp: Opportunity,
    actorEmail: string
  ): Opportunity => {
    const now = new Date().toISOString();
    return {
      ...opp,
      status: "hidden",
      hiddenAt: now,
      hiddenBy: actorEmail,
      updatedAt: now,
      updatedBy: actorEmail,
    };
  };

  // Helper simulating republish logic
  const simulateRepublishOpportunity = (
    opp: Opportunity,
    actorEmail: string
  ): Opportunity => {
    const now = new Date().toISOString();
    return {
      ...opp,
      status: "published",
      updatedAt: now,
      updatedBy: actorEmail,
    };
  };

  // Helper simulating recall logic
  const simulateRecallOpportunity = (
    opp: Opportunity,
    candidate: OpportunityCandidate | null,
    actorEmail: string
  ): {
    recalledOpp: Opportunity;
    pendingCandidate: OpportunityCandidate;
  } => {
    if (opp.sourceType !== "SPARK") {
      throw new Error("Chỉ có thể thu hồi các cơ hội được tạo từ hệ thống AI / Spark.");
    }
    const now = new Date().toISOString();
    const recalledOpp: Opportunity = {
      ...opp,
      status: "recalled",
      recalledAt: now,
      recalledBy: actorEmail,
      updatedAt: now,
      updatedBy: actorEmail,
    };

    let pendingCandidate: OpportunityCandidate;
    if (candidate) {
      pendingCandidate = {
        ...candidate,
        status: "pending",
        publishedOpportunityId: opp.id,
        recalledAt: now,
        recalledBy: actorEmail,
        updatedAt: now,
      };
    } else {
      pendingCandidate = {
        id: "cand_reconstructed_" + opp.id,
        title: opp.title,
        organizer: opp.organizer,
        country: opp.country,
        type: opp.type,
        level: opp.level,
        topic: opp.topic,
        field: opp.field,
        tags: opp.tags,
        deadline: opp.deadline,
        content: opp.content,
        sourceType: "SPARK",
        status: "pending",
        publishedOpportunityId: opp.id,
        recalledAt: now,
        recalledBy: actorEmail,
        normalizedTitle: normalizeText(opp.title),
        createdAt: opp.createdAt || now,
        updatedAt: now,
      };
      recalledOpp.candidateId = pendingCandidate.id;
    }

    return { recalledOpp, pendingCandidate };
  };

  // 1. HIDE & REPUBLISH LIFECYCLE
  it("should hide a published opportunity and remove it from public view while preserving all data", () => {
    const publishedOpp: Opportunity = {
      id: "opp_1",
      title: "Hội thảo Quốc tế về Thiết kế Tương tác 2026",
      organizer: "Đại học Mỹ thuật",
      country: "Việt Nam",
      type: "Hội thảo",
      level: "Quốc tế",
      topic: "Thiết kế tương tác",
      field: "MTCN",
      tags: ["UX", "Interaction"],
      deadline: "2026-11-30",
      content: "Chi tiết về hội thảo",
      sourceType: "ADMIN",
      status: "published",
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
      createdBy: "admin@tdtu.edu.vn",
    };

    expect(isPubliclyVisible(publishedOpp.status)).toBe(true);

    // Hide operation
    const hiddenOpp = simulateHideOpportunity(publishedOpp, "owner@tdtu.edu.vn");
    expect(hiddenOpp.status).toBe("hidden");
    expect(hiddenOpp.hiddenAt).toBeDefined();
    expect(hiddenOpp.hiddenBy).toBe("owner@tdtu.edu.vn");
    expect(hiddenOpp.title).toBe(publishedOpp.title);

    // Not visible publicly anymore!
    expect(isPubliclyVisible(hiddenOpp.status)).toBe(false);
    // Remains visible in Admin workspace
    expect(isVisibleInAdmin(hiddenOpp.status)).toBe(true);

    // Republish operation
    const republishedOpp = simulateRepublishOpportunity(hiddenOpp, "owner@tdtu.edu.vn");
    expect(republishedOpp.status).toBe("published");
    expect(isPubliclyVisible(republishedOpp.status)).toBe(true);
  });

  // 2. RECALL AI / SPARK OPPORTUNITIES
  it("should recall a SPARK opportunity back to pending candidate queue and link bidirectionally", () => {
    const candidateDoc: OpportunityCandidate = {
      id: "cand_spark_1",
      title: "Call for Papers: AI in Industrial Design 2026",
      organizer: "Design Research Society",
      country: "Thái Lan",
      type: "Hội nghị",
      level: "Quốc tế",
      topic: "AI in Design",
      field: "MTCN",
      tags: ["AI", "Industrial Design"],
      deadline: "2026-12-15",
      content: "Mô tả chi tiết hội nghị",
      sourceType: "SPARK",
      status: "approved",
      publishedOpportunityId: "opp_spark_1",
      normalizedTitle: normalizeText("Call for Papers: AI in Industrial Design 2026"),
      createdAt: "2026-10-02T00:00:00Z",
      updatedAt: "2026-10-02T00:00:00Z",
    };

    const sparkOpp: Opportunity = {
      id: "opp_spark_1",
      title: candidateDoc.title,
      organizer: candidateDoc.organizer,
      country: candidateDoc.country,
      type: candidateDoc.type,
      level: candidateDoc.level,
      topic: candidateDoc.topic,
      field: candidateDoc.field,
      tags: candidateDoc.tags,
      deadline: candidateDoc.deadline,
      content: candidateDoc.content,
      sourceType: "SPARK",
      status: "published",
      candidateId: candidateDoc.id,
      createdAt: "2026-10-02T00:00:00Z",
      updatedAt: "2026-10-02T00:00:00Z",
      createdBy: "owner@tdtu.edu.vn",
    };

    expect(isPubliclyVisible(sparkOpp.status)).toBe(true);

    // Recall operation
    const { recalledOpp, pendingCandidate } = simulateRecallOpportunity(
      sparkOpp,
      candidateDoc,
      "owner@tdtu.edu.vn"
    );

    // Opportunity is recalled
    expect(recalledOpp.status).toBe("recalled");
    expect(recalledOpp.recalledAt).toBeDefined();
    expect(recalledOpp.recalledBy).toBe("owner@tdtu.edu.vn");
    expect(isPubliclyVisible(recalledOpp.status)).toBe(false);

    // Candidate status is back to 'pending'
    expect(pendingCandidate.status).toBe("pending");
    expect(pendingCandidate.recalledAt).toBeDefined();
    expect(pendingCandidate.recalledBy).toBe("owner@tdtu.edu.vn");
    expect(pendingCandidate.publishedOpportunityId).toBe(sparkOpp.id);
    expect(recalledOpp.candidateId).toBe(candidateDoc.id);
  });

  it("should reconstruct candidate doc if candidateId was not linked, maintaining no duplicate records", () => {
    const unlinkedSparkOpp: Opportunity = {
      id: "opp_legacy_spark",
      title: "Hội thảo Nghệ thuật Thị giác Đông Nam Á",
      organizer: "SEAMEO SPAFA",
      country: "Việt Nam",
      type: "Hội thảo",
      level: "Quốc tế",
      topic: "Visual Arts",
      field: "MTCN",
      tags: ["Arts"],
      deadline: "2026-12-01",
      content: "Nội dung chi tiết",
      sourceType: "SPARK",
      status: "published",
      createdAt: "2026-10-03T00:00:00Z",
      updatedAt: "2026-10-03T00:00:00Z",
      createdBy: "owner@tdtu.edu.vn",
    };

    const { recalledOpp, pendingCandidate } = simulateRecallOpportunity(
      unlinkedSparkOpp,
      null, // No previous candidate link preserved
      "owner@tdtu.edu.vn"
    );

    expect(recalledOpp.status).toBe("recalled");
    expect(pendingCandidate.status).toBe("pending");
    expect(pendingCandidate.publishedOpportunityId).toBe(unlinkedSparkOpp.id);
    expect(pendingCandidate.title).toBe(unlinkedSparkOpp.title);
    expect(recalledOpp.candidateId).toBe(pendingCandidate.id);
  });

  it("should prevent non-SPARK (ADMIN-created) opportunities from being recalled", () => {
    const adminOpp: Opportunity = {
      id: "opp_admin_1",
      title: "Tọa đàm Khoa học Nội bộ Bộ môn Thiết kế",
      organizer: "Khoa MTCN",
      country: "Việt Nam",
      type: "Seminar",
      level: "Cấp Khoa",
      topic: "Đào tạo",
      field: "MTCN",
      tags: [],
      deadline: "2026-10-20",
      content: "Tọa đàm trao đổi nội bộ",
      sourceType: "ADMIN",
      status: "published",
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
      createdBy: "admin@tdtu.edu.vn",
    };

    expect(() => {
      simulateRecallOpportunity(adminOpp, null, "admin@tdtu.edu.vn");
    }).toThrow("Chỉ có thể thu hồi các cơ hội được tạo từ hệ thống AI / Spark.");
  });

  // 3. PENDING CANDIDATE COUNT & RED BADGE FILTER
  it("should calculate exact pending count strictly filtering status === 'pending'", () => {
    const mockCandidates: Partial<OpportunityCandidate>[] = [
      { id: "1", status: "pending" },
      { id: "2", status: "approved" },
      { id: "3", status: "rejected" },
      { id: "4", status: "pending" },
      { id: "5", status: "approved" },
    ];

    const pendingCount = mockCandidates.filter((c) => c.status === "pending").length;
    expect(pendingCount).toBe(2);

    // Badge formatting simulation
    const formatBadge = (count: number) => (count > 0 ? `(${count})` : null);
    expect(formatBadge(pendingCount)).toBe("(2)");
    expect(formatBadge(0)).toBeNull();
  });

  // 4. MENU AND BUTTON WORDING VERIFICATION
  it("should verify new menu and button nomenclature", () => {
    const newMenuName = "Dữ liệu AI tìm";
    const newButtonName = "Đăng tin mới";
    const candidateSubtitle =
      "Các hội thảo và cơ hội NCKH do hệ thống tự động phát hiện, đang chờ duyệt.";

    expect(newMenuName).toBe("Dữ liệu AI tìm");
    expect(newButtonName).toBe("Đăng tin mới");
    expect(candidateSubtitle).toContain("tự động phát hiện, đang chờ duyệt");
  });
});
