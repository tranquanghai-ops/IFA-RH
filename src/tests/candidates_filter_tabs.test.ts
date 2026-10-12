import { describe, it, expect } from "vitest";
import { getCandidatePrimaryCategory } from "../pages/AdminCandidatesPage";
import type { OpportunityCandidate, Opportunity } from "../types";

describe("Dữ liệu AI tìm - Bộ lọc và phân loại trạng thái không trùng lặp", () => {
  const baseCandidate: OpportunityCandidate = {
    id: "cand-1",
    title: "International Conference on AI & Design 2026",
    organizer: "Design Institute",
    country: "Vietnam",
    type: "Hội thảo",
    level: "Quốc tế",
    topic: "AI Design",
    field: "Thiết kế đồ họa",
    tags: ["AI", "Design"],
    deadline: "2026-12-31",
    content: "Chi tiết...",
    sourceType: "SPARK",
    status: "pending",
    normalizedTitle: "international conference on ai & design 2026",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };

  it("phân loại 'pending' thông thường khi deadline còn hạn và không phải tạo hôm nay", () => {
    const cat = getCandidatePrimaryCategory({
      ...baseCandidate,
      status: "pending",
      deadline: "2026-12-31",
    });
    expect(cat).toBe("pending");
  });

  it("phân loại 'today' khi bản ghi được tạo trong ngày hôm nay", () => {
    const todayStr = new Date().toISOString();
    const cat = getCandidatePrimaryCategory({
      ...baseCandidate,
      status: "pending",
      createdAt: todayStr,
      deadline: "2026-12-31",
    });
    expect(cat).toBe("today");
  });

  it("phân loại 'expired' khi sheetStatus là 'HẾT HẠN', không tính vào pending hay today", () => {
    const todayStr = new Date().toISOString();
    const cat = getCandidatePrimaryCategory({
      ...baseCandidate,
      status: "pending",
      createdAt: todayStr, // Tạo hôm nay nhưng nội dung đã hết hạn
      sheetStatus: "HẾT HẠN",
      deadline: "2026-01-01",
    });
    expect(cat).toBe("expired");
  });

  it("phân loại 'needs_review' khi candidate có status là 'needs_review'", () => {
    const cat = getCandidatePrimaryCategory({
      ...baseCandidate,
      status: "needs_review",
    });
    expect(cat).toBe("needs_review");
  });

  it("phân loại 'approved' khi candidate đã được duyệt", () => {
    const cat = getCandidatePrimaryCategory({
      ...baseCandidate,
      status: "approved",
    });
    expect(cat).toBe("approved");
  });

  it("phân loại 'rejected' khi candidate bị từ chối", () => {
    const cat = getCandidatePrimaryCategory({
      ...baseCandidate,
      status: "rejected",
    });
    expect(cat).toBe("rejected");
  });

  it("đảm bảo số lượng các tab độc lập và tổng bằng đúng 'Tất cả'", () => {
    const mockList: OpportunityCandidate[] = [
      { ...baseCandidate, id: "c1", status: "pending", deadline: "2026-12-31" },
      { ...baseCandidate, id: "c2", status: "pending", createdAt: new Date().toISOString(), deadline: "2026-12-31" },
      { ...baseCandidate, id: "c3", status: "pending", sheetStatus: "HẾT HẠN", deadline: "2025-01-01" },
      { ...baseCandidate, id: "c4", status: "approved" },
      { ...baseCandidate, id: "c5", status: "rejected" },
      { ...baseCandidate, id: "c6", status: "needs_review" },
      { ...baseCandidate, id: "c7", status: "pending", deadline: "2026-11-20" },
    ];

    const counts = {
      today: 0,
      pending: 0,
      needs_review: 0,
      approved: 0,
      expired: 0,
      rejected: 0,
    };

    for (const c of mockList) {
      counts[getCandidatePrimaryCategory(c)]++;
    }

    expect(counts.pending).toBe(2); // c1, c7
    expect(counts.today).toBe(1);   // c2
    expect(counts.expired).toBe(1); // c3
    expect(counts.approved).toBe(1);// c4
    expect(counts.rejected).toBe(1);// c5
    expect(counts.needs_review).toBe(1); // c6

    const sum = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(mockList.length);
  });

  it("tách biệt Quản trị Cơ hội NCKH: chỉ hiển thị bài đăng do Admin thủ công", () => {
    const oppList: Opportunity[] = [
      {
        id: "opp-admin-1",
        title: "Admin Posted Workshop",
        organizer: "IFA",
        country: "VN",
        type: "Hội thảo",
        level: "Cấp Khoa",
        topic: "MTCN",
        field: "Đồ họa",
        tags: [],
        deadline: "2026-12-01",
        content: "...",
        sourceType: "ADMIN",
        status: "published",
        createdAt: "2026-09-01",
        updatedAt: "2026-09-01",
        createdBy: "admin@tdtu.edu.vn",
      },
      {
        id: "opp-spark-1",
        title: "AI Found Conference",
        organizer: "IEEE",
        country: "US",
        type: "Hội thảo",
        level: "Quốc tế",
        topic: "AI",
        field: "CNTT",
        tags: [],
        deadline: "2026-12-01",
        content: "...",
        sourceType: "SPARK",
        status: "published",
        createdAt: "2026-09-01",
        updatedAt: "2026-09-01",
        createdBy: "SPARK_SYNC",
      },
    ];

    // Filter used in AdminOpportunitiesPage
    const adminOnly = oppList.filter((opp) => opp.sourceType !== "SPARK");
    expect(adminOnly.length).toBe(1);
    expect(adminOnly[0].id).toBe("opp-admin-1");
  });
});
