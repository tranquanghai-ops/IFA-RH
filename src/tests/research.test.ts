import { describe, it, expect } from "vitest";
import { RESEARCH_STATUS_ORDER, type ResearchStatus, type ResearchWork } from "../types";

describe("RESEARCH & Progress Workflow", () => {
  it("should contain all valid sequential research workflow statuses", () => {
    expect(RESEARCH_STATUS_ORDER).toContain("Ý tưởng");
    expect(RESEARCH_STATUS_ORDER).toContain("Đang chuẩn bị");
    expect(RESEARCH_STATUS_ORDER).toContain("Đang viết");
    expect(RESEARCH_STATUS_ORDER).toContain("Đã gửi");
    expect(RESEARCH_STATUS_ORDER).toContain("Chờ phản biện");
    expect(RESEARCH_STATUS_ORDER).toContain("Sửa theo phản biện");
    expect(RESEARCH_STATUS_ORDER).toContain("Được chấp nhận");
    expect(RESEARCH_STATUS_ORDER).toContain("Đã xuất bản");
    expect(RESEARCH_STATUS_ORDER).toContain("Nghiệm thu / Hoàn tất");
  });

  it("should allow mapping in-progress work to a completed publication", () => {
    const mockResearch: ResearchWork = {
      id: "res_123",
      userId: "uid_456",
      userEmail: "gv@tdtu.edu.vn",
      userName: "ThS. Nguyễn Văn A",
      title: "Ứng dụng vật liệu tái chế trong đồ chơi trẻ em",
      category: "Bài báo",
      topic: "Thiết kế bền vững",
      venue: "Tạp chí Khoa học TDTU",
      status: "Đã xuất bản",
      role: "Tác giả chính",
      coAuthors: "Trần Thị B",
      isCompleted: true,
      createdAt: "2026-01-10T00:00:00.000Z",
      updatedAt: "2026-06-15T00:00:00.000Z",
    };

    const pubDetails = {
      year: 2026,
      publisher: "TDTU Press",
      journalOrConference: "Tạp chí Khoa học TDTU",
      volume: "12",
      issue: "2",
      doi: "10.1234/tdtu.2026.001",
      indexing: "ACI",
    };

    const publicationRecord = {
      userId: mockResearch.userId,
      userEmail: mockResearch.userEmail,
      userName: mockResearch.userName,
      title: mockResearch.title,
      type: mockResearch.category,
      role: mockResearch.role,
      coAuthors: mockResearch.coAuthors,
      sourceResearchId: mockResearch.id,
      ...pubDetails,
    };

    expect(publicationRecord.sourceResearchId).toBe("res_123");
    expect(publicationRecord.year).toBe(2026);
    expect(publicationRecord.type).toBe("Bài báo");
  });
});
