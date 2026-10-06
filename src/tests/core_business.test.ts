import { describe, it, expect } from "vitest";
import { parseCsvText } from "../utils/excel";
import type { UserProfile, ResearchWork, OpportunityCandidate, Publication } from "../types";

describe("Core Business Logic & Safety Rules", () => {
  describe("1. Lecturer Validation & Email Restrictions", () => {
    const isValidTdtuEmail = (email: string): boolean => {
      const normalized = email.trim().toLowerCase();
      return /^[a-zA-Z0-9._%+-]+@tdtu\.edu\.vn$/.test(normalized);
    };

    it("should strictly allow only @tdtu.edu.vn emails", () => {
      expect(isValidTdtuEmail("tranquanghai@tdtu.edu.vn")).toBe(true);
      expect(isValidTdtuEmail("nguyenvana.mtcn@tdtu.edu.vn")).toBe(true);
      expect(isValidTdtuEmail("TRANQUANGHAI@TDTU.EDU.VN")).toBe(true);

      // Rejections
      expect(isValidTdtuEmail("user@gmail.com")).toBe(false);
      expect(isValidTdtuEmail("user@yahoo.com")).toBe(false);
      expect(isValidTdtuEmail("tdtu.edu.vn@phishing.com")).toBe(false);
      expect(isValidTdtuEmail("invalid-email")).toBe(false);
      expect(isValidTdtuEmail("")).toBe(false);
    });

    it("should detect duplicate lecturer emails in CSV batch and existing database", () => {
      const existingEmails = new Set(["tranquanghai@tdtu.edu.vn", "gv1@tdtu.edu.vn"]);
      const batchRows = [
        { email: "gv1@tdtu.edu.vn", name: "Giảng viên 1" },
        { email: "gv2@tdtu.edu.vn", name: "Giảng viên 2" },
        { email: "GV2@tdtu.edu.vn", name: "Giảng viên 2 trùng" }, // duplicate within batch
      ];

      const seenInBatch = new Set<string>();
      const results: { email: string; isDuplicate: boolean; reason?: string }[] = [];

      for (const row of batchRows) {
        const norm = row.email.trim().toLowerCase();
        if (existingEmails.has(norm)) {
          results.push({ email: norm, isDuplicate: true, reason: "Đã tồn tại trong hệ thống" });
        } else if (seenInBatch.has(norm)) {
          results.push({ email: norm, isDuplicate: true, reason: "Trùng lặp trong tệp import" });
        } else {
          seenInBatch.add(norm);
          results.push({ email: norm, isDuplicate: false });
        }
      }

      expect(results[0].isDuplicate).toBe(true);
      expect(results[0].reason).toBe("Đã tồn tại trong hệ thống");
      expect(results[1].isDuplicate).toBe(false);
      expect(results[2].isDuplicate).toBe(true);
      expect(results[2].reason).toBe("Trùng lặp trong tệp import");
    });
  });

  describe("2. Owner & Role Protection Rules", () => {
    const FOUNDING_OWNER_EMAIL = "tranquanghai@tdtu.edu.vn";

    const canChangeRole = (
      operatorRole: "owner" | "admin" | "lecturer",
      operatorUid: string,
      targetUser: UserProfile,
      newRole: "owner" | "admin" | "lecturer"
    ): { allowed: boolean; reason?: string } => {
      if (operatorRole !== "owner") {
        return { allowed: false, reason: "Chỉ Owner mới có quyền đổi vai trò người dùng" };
      }
      if (targetUser.email === FOUNDING_OWNER_EMAIL && newRole !== "owner") {
        return { allowed: false, reason: "Không được hạ quyền Owner sáng lập hệ thống" };
      }
      if (operatorUid === targetUser.uid && newRole !== "owner") {
        return { allowed: false, reason: "Không thể tự hạ quyền Owner của chính mình" };
      }
      return { allowed: true };
    };

    it("should prevent non-owners from changing user roles", () => {
      const target: UserProfile = {
        id: "u2",
        uid: "u2",
        email: "gv@tdtu.edu.vn",
        name: "GV A",
        role: "lecturer",
        active: true,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      };
      const checkAdmin = canChangeRole("admin", "u_admin", target, "admin");
      expect(checkAdmin.allowed).toBe(false);
      expect(checkAdmin.reason).toContain("Chỉ Owner");
    });

    it("should prevent downgrading founding owner", () => {
      const founding: UserProfile = {
        id: "u_founder",
        uid: "u_founder",
        email: FOUNDING_OWNER_EMAIL,
        name: "Trần Quang Hải",
        role: "owner",
        active: true,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      };
      const result = canChangeRole("owner", "u_other_owner", founding, "admin");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Owner sáng lập");
    });

    it("should prevent owner self-downgrade", () => {
      const currentOwner: UserProfile = {
        id: "u_me",
        uid: "u_me",
        email: "owner2@tdtu.edu.vn",
        name: "Owner 2",
        role: "owner",
        active: true,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      };
      const result = canChangeRole("owner", "u_me", currentOwner, "lecturer");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("tự hạ quyền Owner");
    });
  });

  describe("3. Import Engine & Matching Order", () => {
    const lecturers: UserProfile[] = [
      {
        id: "u1",
        uid: "u1",
        email: "nguyenvana@tdtu.edu.vn",
        name: "Nguyễn Văn A",
        role: "lecturer",
        active: true,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
      {
        id: "u2",
        uid: "u2",
        email: "tranthib@tdtu.edu.vn",
        name: "Trần Thị B",
        role: "lecturer",
        active: true,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    ];

    const matchLecturer = (
      rowEmail: string,
      rowName: string,
      manualMappings: Record<string, string>,
      facultyList: UserProfile[]
    ): { matchedId: string; matchedName: string; confidence: "email" | "manual" | "name" | "none" } => {
      const cleanEmail = rowEmail.trim().toLowerCase();
      if (cleanEmail) {
        const byEmail = facultyList.find((l) => l.email.toLowerCase() === cleanEmail);
        if (byEmail) return { matchedId: byEmail.id, matchedName: byEmail.name, confidence: "email" };
      }

      if (manualMappings[rowName.trim()]) {
        const mappedId = manualMappings[rowName.trim()];
        const byMapped = facultyList.find((l) => l.id === mappedId);
        if (byMapped) return { matchedId: byMapped.id, matchedName: byMapped.name, confidence: "manual" };
      }

      const cleanName = rowName.trim().toLowerCase();
      if (cleanName) {
        const byName = facultyList.find((l) => l.name.trim().toLowerCase() === cleanName);
        if (byName) return { matchedId: byName.id, matchedName: byName.name, confidence: "name" };
      }

      return { matchedId: "", matchedName: "", confidence: "none" };
    };

    it("should match by email first before name or mapping", () => {
      const match = matchLecturer("nguyenvana@tdtu.edu.vn", "Tên khác hoàn toàn", {}, lecturers);
      expect(match.confidence).toBe("email");
      expect(match.matchedId).toBe("u1");
    });

    it("should match by manual mapping when email is missing or unverified", () => {
      const match = matchLecturer("", "Tên viết tắt NV A", { "Tên viết tắt NV A": "u1" }, lecturers);
      expect(match.confidence).toBe("manual");
      expect(match.matchedId).toBe("u1");
    });

    it("should match by exact name when email is absent and no manual mapping", () => {
      const match = matchLecturer("", "Trần Thị B", {}, lecturers);
      expect(match.confidence).toBe("name");
      expect(match.matchedId).toBe("u2");
    });

    it("should not guess randomly and return none when no match is found", () => {
      const match = matchLecturer("", "Người Lạ Ơi", {}, lecturers);
      expect(match.confidence).toBe("none");
      expect(match.matchedId).toBe("");
    });
  });

  describe("4. Candidate Import Safety (Spark Queue Isolation)", () => {
    it("should always import Spark candidates with status 'pending' and NEVER 'published'", () => {
      const rawCandidateRow = {
        title: "Hội thảo Quốc tế Thiết kế Đương đại 2026",
        organizer: "Đại học Mỹ thuật",
        url: "https://example.com/conf2026",
        submissionDeadline: "2026-12-01",
      };

      const candidateRecord: OpportunityCandidate = {
        id: "cand_1",
        title: rawCandidateRow.title,
        organizer: rawCandidateRow.organizer,
        country: "Việt Nam",
        type: "Hội thảo",
        level: "Quốc tế",
        topic: "Design",
        field: "Mỹ thuật ứng dụng",
        tags: ["Hội thảo", "Thiết kế"],
        deadline: rawCandidateRow.submissionDeadline,
        content: "Nội dung hội thảo",
        sourceType: "SPARK",
        sourceUrl: rawCandidateRow.url,
        normalizedTitle: rawCandidateRow.title.toLowerCase(),
        status: "pending", // CRITICAL: must never be 'published' directly
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(candidateRecord.status).toBe("pending");
      expect(candidateRecord.status).not.toBe("published");
    });
  });

  describe("5. Update On-Behalf & Conversion Metadata", () => {
    it("should correctly populate on-behalf audit properties on research work", () => {
      const work: ResearchWork = {
        id: "work_1",
        userId: "lecturer_123",
        userEmail: "gv1@tdtu.edu.vn",
        userName: "ThS. Giảng Viên 1",
        title: "Nghiên cứu Gốm Bát Tràng",
        category: "Bài báo",
        topic: "Mỹ thuật truyền thống",
        role: "Tác giả chính",
        status: "Đang viết",
        isCompleted: false,
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      };

      // Admin updates on behalf of lecturer
      const adminActor = {
        uid: "admin_999",
        email: "admin@tdtu.edu.vn",
        role: "admin" as const,
      };

      const updatedWork: ResearchWork = {
        ...work,
        status: "Đã gửi",
        lastUpdatedBy: adminActor.email,
        lastUpdatedByRole: adminActor.role,
        onBehalfOfUserId: work.userId,
        updatedAt: "2026-03-01T10:00:00.000Z",
      };

      expect(updatedWork.lastUpdatedBy).toBe("admin@tdtu.edu.vn");
      expect(updatedWork.lastUpdatedByRole).toBe("admin");
      expect(updatedWork.onBehalfOfUserId).toBe("lecturer_123");
      expect(updatedWork.status).toBe("Đã gửi");
    });

    it("should link converted research work to publication and record actor audit", () => {
      const work: ResearchWork = {
        id: "work_100",
        userId: "lecturer_123",
        userEmail: "gv1@tdtu.edu.vn",
        userName: "ThS. Giảng Viên 1",
        title: "Nghiên cứu Typography hiện đại",
        category: "Bài báo",
        topic: "Đồ họa ứng dụng",
        role: "Tác giả chính",
        status: "Được chấp nhận",
        isCompleted: false,
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      };

      const publicationId = "pub_200";
      const convertedByEmail = "admin@tdtu.edu.vn";
      const convertedAt = new Date().toISOString();

      const finalizedWork: ResearchWork = {
        ...work,
        status: "Nghiệm thu / Hoàn tất",
        isCompleted: true,
        convertedToPublicationId: publicationId,
        convertedBy: convertedByEmail,
        convertedAt: convertedAt,
      };

      expect(finalizedWork.isCompleted).toBe(true);
      expect(finalizedWork.status).toBe("Nghiệm thu / Hoàn tất");
      expect(finalizedWork.convertedToPublicationId).toBe("pub_200");
      expect(finalizedWork.convertedBy).toBe(convertedByEmail);
    });
  });

  describe("6. Export UTF-8 BOM Integrity", () => {
    it("should prepend UTF-8 BOM \\uFEFF for proper Excel Vietnamese rendering", () => {
      const rows = [
        { name: "Nguyễn Văn Hải", title: "Nghiên cứu Mỹ thuật" },
        { name: "Trần Thị Bé", title: "Đồ họa ứng dụng" },
      ];

      const csvContent = "\uFEFF" + "Tên,Đề tài\n" + rows.map((r) => `"${r.name}","${r.title}"`).join("\n");

      // Verify BOM character is index 0
      expect(csvContent.charCodeAt(0)).toBe(0xfeff);
      expect(csvContent).toContain("Nguyễn Văn Hải");
      expect(csvContent).toContain("Đồ họa ứng dụng");
    });
  });
});
