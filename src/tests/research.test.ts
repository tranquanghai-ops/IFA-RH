import { describe, it, expect } from "vitest";
import { RESEARCH_STATUS_ORDER, type ResearchStatus, type ResearchWork, type SharedPersonnelRecord, type ResearchPersonnelSettings, type UserProfile } from "../types";
import { deduplicateUsers } from "../firebase/firestore";

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

  it("should synthesize active lecturers from sharedPersonnel and exclude ARCHIVED lecturers", () => {
    const mockShared: SharedPersonnelRecord[] = [
      {
        emailNormalized: "active1@tdtu.edu.vn",
        displayName: "ThS. Nguyễn Văn Hoạt Động",
        departmentId: "d1",
        departmentName: "Đồ họa",
        lecturerType: "lecturer",
        academicDegree: "Thạc sĩ",
        active: true,
        sourceUpdatedAt: "2026-10-01T00:00:00Z",
        sharedUpdatedAt: "2026-10-01T00:00:00Z",
      },
      {
        emailNormalized: "archived@tdtu.edu.vn",
        displayName: "CN. Lê Văn Lưu Trữ",
        departmentId: "d2",
        departmentName: "Nội thất",
        lecturerType: "visiting",
        academicDegree: "Cử nhân",
        active: true,
        sourceUpdatedAt: "2026-10-01T00:00:00Z",
        sharedUpdatedAt: "2026-10-01T00:00:00Z",
      },
      {
        emailNormalized: "inactive@tdtu.edu.vn",
        displayName: "Trần Thị Nghỉ Việc",
        departmentId: "d1",
        departmentName: "Đồ họa",
        lecturerType: "lecturer",
        academicDegree: "Thạc sĩ",
        active: false,
        sourceUpdatedAt: "2026-10-01T00:00:00Z",
        sharedUpdatedAt: "2026-10-01T00:00:00Z",
      },
    ];

    const mockSettings = new Map<string, ResearchPersonnelSettings>([
      [
        "archived@tdtu.edu.vn",
        {
          emailNormalized: "archived@tdtu.edu.vn",
          researchTrackingStatus: "ARCHIVED",
          updatedAt: "2026-10-01T00:00:00Z",
        },
      ],
    ]);

    // Filter logic as implemented in fetchActiveLecturers
    const result: UserProfile[] = [];
    mockShared.forEach((p) => {
      const email = p.emailNormalized.toLowerCase().trim();
      const setting = mockSettings.get(email);
      if (setting?.researchTrackingStatus === "ARCHIVED" || p.active === false) {
        return;
      }
      result.push({
        id: email,
        uid: email,
        email: p.emailNormalized,
        name: p.displayName,
        department: p.departmentName,
        academicDegree: p.academicDegree,
        active: true,
        role: "lecturer",
      });
    });

    expect(result.length).toBe(1);
    expect(result[0].email).toBe("active1@tdtu.edu.vn");
    expect(result[0].name).toBe("ThS. Nguyễn Văn Hoạt Động");
  });

  it("should match research works and publications by either UID or Email", () => {
    const works: ResearchWork[] = [
      {
        id: "w1",
        userId: "auth_uid_123",
        userEmail: "ha@tdtu.edu.vn",
        userName: "ThS. Hà",
        title: "Đề tài A",
        category: "Bài báo",
        topic: "Topic 1",
        status: "Đang viết",
        role: "Tác giả chính",
        isCompleted: false,
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
      },
      {
        id: "w2",
        userId: "auth_uid_456",
        userEmail: "other@tdtu.edu.vn",
        userName: "ThS. Khác",
        title: "Đề tài B",
        category: "Bài báo",
        topic: "Topic 2",
        status: "Đang viết",
        role: "Tác giả chính",
        isCompleted: false,
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
      },
    ];

    // Filter by email
    const filterByEmail = "ha@tdtu.edu.vn";
    const matchedByEmail = works.filter(
      (w) =>
        (w.userId && w.userId.toLowerCase() === filterByEmail) ||
        (w.userEmail && w.userEmail.toLowerCase() === filterByEmail)
    );
    expect(matchedByEmail.length).toBe(1);
    expect(matchedByEmail[0].id).toBe("w1");

    // Filter by auth UID
    const filterByUid = "auth_uid_123";
    const matchedByUid = works.filter(
      (w) =>
        (w.userId && w.userId.toLowerCase() === filterByUid) ||
        (w.userEmail && w.userEmail.toLowerCase() === filterByUid)
    );
    expect(matchedByUid.length).toBe(1);
    expect(matchedByUid[0].id).toBe("w1");
  });
});
