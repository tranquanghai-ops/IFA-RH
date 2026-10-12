import { describe, it, expect } from "vitest";
import {
  getJournalCandidateCategory,
  isTodayDate,
  type CandidateQueueTab,
} from "../pages/JournalDirectoryPage";
import type { JournalCandidate } from "../types/journal";

describe("Danh mục Tạp chí Khoa học — Tinh gọn Hàng chờ & Phân loại Sub-tabs", () => {
  const baseCandidate = {
    id: "cand_test_01",
    journalId: "TC-VHNT-001",
    name: "Tạp chí Văn hóa Nghệ thuật",
    publisher: "Bộ Văn hóa, Thể thao và Du lịch",
    maxScore: 1.0,
    maxScoreYear: 2025,
    status: "pending",
    changeType: "create",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    category: "domestic",
    primaryField: "Văn hóa - Nghệ thuật",
    fields: ["Văn hóa - Nghệ thuật"],
    websiteVerified: true,
    verification: {
      status: "unverified" as const,
      schemaVersion: 1,
    },
  } as unknown as JournalCandidate;

  it("gộp 'Mới hôm nay' và 'Chờ duyệt' vào cùng category 'pending', không tách riêng tab", () => {
    const todayStr = new Date().toISOString();
    const candidateToday: JournalCandidate = {
      ...baseCandidate,
      createdAt: todayStr,
      status: "pending",
    };

    const candidatePast: JournalCandidate = {
      ...baseCandidate,
      createdAt: "2026-09-15T00:00:00.000Z",
      status: "pending",
    };

    expect(isTodayDate(candidateToday.createdAt)).toBe(true);
    expect(isTodayDate(candidatePast.createdAt)).toBe(false);

    // Cả hai đều thuộc về tab "pending" (Chờ duyệt)
    expect(getJournalCandidateCategory(candidateToday)).toBe("pending");
    expect(getJournalCandidateCategory(candidatePast)).toBe("pending");
  });

  it("phân loại đúng vào 'needs_review' (Cần hiệu chỉnh) khi có status needs_review hoặc cờ manualReviewNeeded", () => {
    const candidateWithFlag: JournalCandidate = {
      ...baseCandidate,
      status: "pending",
      verification: {
        status: "unverified",
        schemaVersion: 1,
        manualReviewNeeded: true,
        manualReviewReason: "Có 2 khung điểm năm 2025: 1.00 và 0.75",
      },
    };

    const candidateWithStatus: JournalCandidate = {
      ...baseCandidate,
      status: "needs_review",
    };

    expect(getJournalCandidateCategory(candidateWithFlag)).toBe("needs_review");
    expect(getJournalCandidateCategory(candidateWithStatus)).toBe("needs_review");
  });

  it("phân loại 'rejected' khi ứng viên bị từ chối", () => {
    const rejectedCand: JournalCandidate = {
      ...baseCandidate,
      status: "rejected",
      rejectionReason: "Không thuộc danh mục HĐGSNN",
    };

    expect(getJournalCandidateCategory(rejectedCand)).toBe("rejected");
  });

  it("nhận diện 'approved' để loại bỏ khỏi hàng chờ duyệt (đã hiển thị ở Danh mục Công khai)", () => {
    const approvedCand: JournalCandidate = {
      ...baseCandidate,
      status: "approved",
    };

    expect(getJournalCandidateCategory(approvedCand)).toBe("approved");
  });

  it("đảm bảo tổng số lượng các sub-tab trong hàng chờ duyệt (pending + needs_review + rejected) bằng đúng tab 'Tất cả'", () => {
    const list: JournalCandidate[] = [
      { ...baseCandidate, id: "c1", status: "pending" },
      { ...baseCandidate, id: "c2", status: "pending", createdAt: new Date().toISOString() }, // Mới hôm nay -> pending
      { ...baseCandidate, id: "c3", status: "needs_review" },
      {
        ...baseCandidate,
        id: "c4",
        status: "pending",
        verification: { status: "unverified", schemaVersion: 1, manualReviewNeeded: true },
      }, // Cần kiểm tra -> needs_review
      { ...baseCandidate, id: "c5", status: "rejected" },
      { ...baseCandidate, id: "c6", status: "approved" }, // Đã duyệt -> Loại khỏi hàng chờ
    ];

    const counts: Record<CandidateQueueTab, number> = {
      pending: 0,
      needs_review: 0,
      rejected: 0,
      all: 0,
    };

    list.forEach((c) => {
      if (c.status === "approved") return; // Exclude approved items from review queue
      const cat = getJournalCandidateCategory(c);
      if (cat === "rejected") counts.rejected++;
      else if (cat === "needs_review") counts.needs_review++;
      else if (cat === "pending") counts.pending++;
      counts.all++;
    });

    expect(counts.pending).toBe(2);
    expect(counts.needs_review).toBe(2);
    expect(counts.rejected).toBe(1);
    expect(counts.all).toBe(5);
    expect(counts.pending + counts.needs_review + counts.rejected).toBe(counts.all);
  });
});
