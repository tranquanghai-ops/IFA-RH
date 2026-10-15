import { describe, it, expect } from "vitest";
import {
  getCandidatePrimaryCategory,
  isAutoClosedProposal,
  isDiscoveredTodayVN,
  getVietnamDateString,
  matchesCandidateSearch,
  getCandidateCategory,
} from "../pages/AdminCandidatesPage";
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

  it("phân loại 'pending' cho tất cả ứng viên mới chưa duyệt kể cả khi tạo hôm nay", () => {
    const todayStr = new Date().toISOString();
    const cat = getCandidatePrimaryCategory({
      ...baseCandidate,
      status: "pending",
      createdAt: todayStr,
      deadline: "2026-12-31",
    });
    expect(cat).toBe("pending");
  });

  it("phân loại 'expired' khi sheetStatus là 'HẾT HẠN', không tính vào pending", () => {
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

  it("phân loại 'updates' khi candidate có changeType là 'update' hoặc có publishedOpportunityId, tuyệt đối không vào 'today'", () => {
    const todayStr = new Date().toISOString();
    // Tạo hôm nay và có changeType = 'update'
    const cat1 = getCandidatePrimaryCategory({
      ...baseCandidate,
      status: "pending",
      changeType: "update",
      publishedOpportunityId: "opp-published-1",
      createdAt: todayStr,
      discoveredAt: todayStr,
    });
    expect(cat1).toBe("updates");

    // Chỉ có publishedOpportunityId
    const cat2 = getCandidatePrimaryCategory({
      ...baseCandidate,
      status: "pending",
      publishedOpportunityId: "opp-published-1",
      createdAt: todayStr,
    });
    expect(cat2).toBe("updates");
  });

  it("ưu tiên phân loại đề xuất cập nhật vào 'updates' ngay cả khi hạn nộp đã quá hạn (sheetStatus HẾT HẠN hoặc deadline quá hạn)", () => {
    // Đề xuất cập nhật cho hồ sơ có hạn nộp trong quá khứ
    const cat = getCandidatePrimaryCategory({
      ...baseCandidate,
      status: "pending",
      changeType: "update",
      publishedOpportunityId: "opp_ietbhec_2027",
      deadline: "2024-01-01",
      sheetStatus: "HẾT HẠN",
    });
    expect(cat).toBe("updates");
    expect(cat).not.toBe("expired");
  });

  // Test 1: Spark cập nhật trước (updatedBy=SPARK_SYNC), Admin từ chối sau
  it("Test 1: Khi Spark cập nhật trước (updatedBy = SPARK_SYNC) nhưng Admin từ chối, kết quả bắt buộc là 'rejected' và không bao giờ bị phân loại nhầm thành 'closed'", () => {
    // Trường hợp A: Có resolutionType = ADMIN_REJECTED
    const rejectedWithResType: OpportunityCandidate = {
      ...baseCandidate,
      status: "rejected",
      changeType: "update",
      publishedOpportunityId: "opp_ietbhec_2027",
      resolutionType: "ADMIN_REJECTED",
      rejectionReason: "Hội thảo chưa có văn bản chính thức của BTC.",
      reviewedBy: "tranquanghai@tdtu.edu.vn",
      updatedBy: "SPARK_SYNC", // Giả lập trường hợp Spark đã từng ghi SPARK_SYNC trước đó
    };
    expect(isAutoClosedProposal(rejectedWithResType)).toBe(false);
    expect(getCandidatePrimaryCategory(rejectedWithResType)).toBe("rejected");

    // Trường hợp B: Dữ liệu legacy không có resolutionType nhưng có reviewedBy là email Admin
    const rejectedLegacy: OpportunityCandidate = {
      ...baseCandidate,
      status: "rejected",
      changeType: "update",
      publishedOpportunityId: "opp_letj_2027",
      rejectionReason: "Không thuộc định hướng nghiên cứu Khoa MTCN",
      reviewedBy: "admin@tdtu.edu.vn",
      updatedBy: "SPARK_SYNC", // Giá trị cũ từ lần sync trước
    };
    expect(isAutoClosedProposal(rejectedLegacy)).toBe(false);
    expect(getCandidatePrimaryCategory(rejectedLegacy)).toBe("rejected");
  });

  // Test 2: Hệ thống tự đóng thực sự
  it("Test 2: Hệ thống tự đóng thực sự (AUTO_CLOSED) được phân loại vào 'closed', không cộng vào 'rejected'", () => {
    // Trường hợp có resolutionType = AUTO_CLOSED
    const autoClosedExplicit: OpportunityCandidate = {
      ...baseCandidate,
      status: "rejected",
      changeType: "update",
      publishedOpportunityId: "opp_icisn_2027",
      resolutionType: "AUTO_CLOSED",
      rejectionReason: "Đồng bộ chuẩn hóa: Dữ liệu Google Sheets và hội thảo đã công bố đã hoàn toàn trùng khớp, không có thay đổi thực tế.",
      reviewedBy: "SPARK_SYNC",
      updatedBy: "SPARK_SYNC",
    };
    expect(isAutoClosedProposal(autoClosedExplicit)).toBe(true);
    expect(getCandidatePrimaryCategory(autoClosedExplicit)).toBe("closed");

    // Trường hợp legacy tự đóng có chuỗi text chuẩn hóa và không có email admin
    const autoClosedLegacy: OpportunityCandidate = {
      ...baseCandidate,
      status: "rejected",
      publishedOpportunityId: "opp_icisn_2027",
      rejectionReason: "Đồng bộ chuẩn hóa: Dữ liệu Google Sheets và hội thảo đã công bố đã hoàn toàn trùng khớp, không có thay đổi thực tế.",
      updatedBy: "SPARK_SYNC",
    };
    expect(isAutoClosedProposal(autoClosedLegacy)).toBe(true);
    expect(getCandidatePrimaryCategory(autoClosedLegacy)).toBe("closed");
  });

  // Test 9: Phân loại hết hạn theo thứ tự ưu tiên
  it("Test 9: Bảo toàn phân loại đúng cho các trạng thái khi đã hết hạn nộp", () => {
    const pastDeadline = "2024-01-01";

    // 1. Hội thảo mới chưa duyệt mà hết hạn -> "expired"
    const newExpired: OpportunityCandidate = {
      ...baseCandidate,
      status: "pending",
      deadline: pastDeadline,
      sheetStatus: "HẾT HẠN",
    };
    expect(getCandidatePrimaryCategory(newExpired)).toBe("expired");

    // 2. Đề xuất cập nhật của hội thảo đã hết hạn -> "updates" (Cập nhật chờ duyệt)
    const updateExpired: OpportunityCandidate = {
      ...baseCandidate,
      status: "pending",
      changeType: "update",
      publishedOpportunityId: "opp_ietbhec_2027",
      deadline: pastDeadline,
      sheetStatus: "HẾT HẠN",
    };
    expect(getCandidatePrimaryCategory(updateExpired)).toBe("updates");

    // 3. Hồ sơ đã duyệt mà hết hạn -> "approved" (không bị đẩy sang expired)
    const approvedExpired: OpportunityCandidate = {
      ...baseCandidate,
      status: "approved",
      deadline: pastDeadline,
    };
    expect(getCandidatePrimaryCategory(approvedExpired)).toBe("approved");

    // 4. Hồ sơ bị từ chối mà hết hạn -> "rejected" (không bị đẩy sang expired)
    const rejectedExpired: OpportunityCandidate = {
      ...baseCandidate,
      status: "rejected",
      resolutionType: "ADMIN_REJECTED",
      deadline: pastDeadline,
      reviewedBy: "admin@tdtu.edu.vn",
    };
    expect(getCandidatePrimaryCategory(rejectedExpired)).toBe("rejected");

    // 5. Đề xuất tự đóng mà hết hạn -> "closed" (không bị đẩy sang expired)
    const closedExpired: OpportunityCandidate = {
      ...baseCandidate,
      status: "rejected",
      resolutionType: "AUTO_CLOSED",
      publishedOpportunityId: "opp_1",
      deadline: pastDeadline,
    };
    expect(getCandidatePrimaryCategory(closedExpired)).toBe("closed");
  });

  it("phân loại 'pending' khi candidate được đồng bộ hôm nay nhưng ngày phát hiện gốc (discoveredAt) là ngày cũ", () => {
    const todayStr = new Date().toISOString();
    const cat = getCandidatePrimaryCategory({
      ...baseCandidate,
      status: "pending",
      createdAt: todayStr, // Đồng bộ hôm nay
      discoveredAt: "2026-10-06T00:00:00.000Z", // Ngày phát hiện gốc từ Spark
    });
    expect(cat).toBe("pending");
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
      {
        ...baseCandidate,
        id: "c8",
        status: "pending",
        changeType: "update",
        publishedOpportunityId: "opp-123",
        createdAt: new Date().toISOString(),
      },
      {
        ...baseCandidate,
        id: "c9",
        status: "rejected",
        publishedOpportunityId: "opp-123",
        rejectionReason: "Đồng bộ chuẩn hóa: Dữ liệu Google Sheets và hội thảo đã công bố đã hoàn toàn trùng khớp, không có thay đổi thực tế.",
        updatedBy: "SPARK_SYNC",
      },
    ];

    const counts = {
      updates: 0,
      pending: 0,
      needs_review: 0,
      approved: 0,
      expired: 0,
      rejected: 0,
      closed: 0,
      out_of_scope: 0,
    };

    for (const c of mockList) {
      counts[getCandidatePrimaryCategory(c)]++;
    }

    expect(counts.pending).toBe(3); // c1, c2, c7 (tất cả hồ sơ mới chưa duyệt vào pending)
    expect(counts.updates).toBe(1); // c8
    expect(counts.expired).toBe(1); // c3
    expect(counts.approved).toBe(1);// c4
    expect(counts.rejected).toBe(1);// c5
    expect(counts.closed).toBe(1);  // c9
    expect(counts.needs_review).toBe(1); // c6

    const sum = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(mockList.length);
  });

  describe("Huy hiệu NEW theo múi giờ Việt Nam (Asia/Ho_Chi_Minh) & hết hạn vào 00:00", () => {
    it("trả về true khi candidate pending và được phát hiện hôm nay theo giờ VN", () => {
      const nowVN = new Date();
      const cand: OpportunityCandidate = {
        ...baseCandidate,
        status: "pending",
        discoveredAt: nowVN.toISOString(),
      };
      expect(isDiscoveredTodayVN(cand)).toBe(true);
    });

    it("trả về false khi candidate đã được duyệt (approved) kể cả khi phát hiện hôm nay", () => {
      const nowVN = new Date();
      const cand: OpportunityCandidate = {
        ...baseCandidate,
        status: "approved",
        discoveredAt: nowVN.toISOString(),
      };
      expect(isDiscoveredTodayVN(cand)).toBe(false);
    });

    it("trả về false khi candidate là đề xuất cập nhật (changeType = update)", () => {
      const nowVN = new Date();
      const cand: OpportunityCandidate = {
        ...baseCandidate,
        status: "pending",
        changeType: "update",
        publishedOpportunityId: "opp-123",
        discoveredAt: nowVN.toISOString(),
      };
      expect(isDiscoveredTodayVN(cand)).toBe(false);
    });

    it("tuyệt đối không dùng updatedAt hay thời điểm sync để đánh dấu NEW", () => {
      const nowVN = new Date();
      const cand: OpportunityCandidate = {
        ...baseCandidate,
        status: "pending",
        discoveredAt: "2026-10-01T08:00:00.000Z", // Phát hiện ngày cũ
        createdAt: "2026-10-01T08:00:00.000Z",
        updatedAt: nowVN.toISOString(), // Cập nhật/đồng bộ hôm nay
      };
      expect(isDiscoveredTodayVN(cand)).toBe(false);
    });

    it("tự động hết hạn khi sang ngày mới: ngày phát hiện hôm qua trả về false", () => {
      const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
      const cand: OpportunityCandidate = {
        ...baseCandidate,
        status: "pending",
        discoveredAt: yesterday.toISOString(),
      };
      expect(isDiscoveredTodayVN(cand)).toBe(false);
    });
  });

  describe("Bộ lọc động theo nhóm (Tất cả, Trong nước, Quốc tế) và từ khóa tìm kiếm", () => {
    // Mô phỏng chính xác dataset 11 candidates hiện tại của IFA-RH
    const official11Candidates: OpportunityCandidate[] = [
      // 7 hội thảo Trong nước đã công bố (TN0001 - TN0007)
      { ...baseCandidate, id: "c_tn1", conferenceCode: "TN0001", country: "Việt Nam", status: "approved" },
      { ...baseCandidate, id: "c_tn2", conferenceCode: "TN0002", country: "Việt Nam", status: "approved" },
      { ...baseCandidate, id: "c_tn3", conferenceCode: "TN0003", country: "Việt Nam", status: "approved" },
      { ...baseCandidate, id: "c_tn4", conferenceCode: "TN0004", country: "Việt Nam", status: "approved" },
      { ...baseCandidate, id: "c_tn5", conferenceCode: "TN0005", country: "Việt Nam", status: "approved" },
      { ...baseCandidate, id: "c_tn6", conferenceCode: "TN0006", country: "Việt Nam", status: "approved" },
      { ...baseCandidate, id: "c_tn7", conferenceCode: "TN0007", country: "Việt Nam", status: "approved" },
      // 4 hội thảo Quốc tế (QT0001 - QT0003)
      { ...baseCandidate, id: "c_qt1", conferenceCode: "QT0001", country: "Thái Lan", status: "pending" }, // Chờ duyệt
      { ...baseCandidate, id: "c_qt2", conferenceCode: "QT0002", country: "Malaysia", status: "pending" }, // Chờ duyệt
      { ...baseCandidate, id: "c_qt3_app", conferenceCode: "QT0003", country: "Singapore", status: "approved" }, // Đã duyệt
      {
        ...baseCandidate,
        id: "c_qt3_upd",
        conferenceCode: "QT0003",
        country: "Singapore",
        status: "pending",
        changeType: "update",
        publishedOpportunityId: "opp_qt0003",
      }, // Đề xuất cập nhật chờ duyệt
    ];

    const computeTabCountsForCategory = (
      candidates: OpportunityCandidate[],
      category: "ALL" | "TN" | "QT"
    ) => {
      const filteredByCategory = candidates.filter((c) => {
        if (category === "ALL") return true;
        const cat = getCandidateCategory(c);
        return cat === category;
      });

      const counts = {
        approved: 0,
        pending: 0,
        updates: 0,
        needs_review: 0,
        expired: 0,
        rejected: 0,
        closed: 0,
        out_of_scope: 0,
        all: filteredByCategory.length,
      };

      for (const c of filteredByCategory) {
        counts[getCandidatePrimaryCategory(c)]++;
      }

      return counts;
    };

    it("tính đúng số lượng tab khi chọn 'Tất cả' (11 bản ghi: 8 Đã duyệt, 2 Chờ duyệt, 1 Cập nhật)", () => {
      const countsAll = computeTabCountsForCategory(official11Candidates, "ALL");
      expect(countsAll.all).toBe(11);
      expect(countsAll.approved).toBe(8);
      expect(countsAll.pending).toBe(2);
      expect(countsAll.updates).toBe(1);
      expect(countsAll.closed).toBe(0);
      expect(countsAll.out_of_scope).toBe(0);
    });

    it("tính đúng số lượng tab khi chọn 'Trong nước' (7 bản ghi: 7 Đã duyệt, 0 Chờ duyệt, 0 Cập nhật)", () => {
      const countsTN = computeTabCountsForCategory(official11Candidates, "TN");
      expect(countsTN.all).toBe(7);
      expect(countsTN.approved).toBe(7);
      expect(countsTN.pending).toBe(0);
      expect(countsTN.updates).toBe(0);
    });

    it("tính đúng số lượng tab khi chọn 'Quốc tế' (4 bản ghi: 1 Đã duyệt, 2 Chờ duyệt, 1 Cập nhật)", () => {
      const countsQT = computeTabCountsForCategory(official11Candidates, "QT");
      expect(countsQT.all).toBe(4);
      expect(countsQT.approved).toBe(1);
      expect(countsQT.pending).toBe(2);
      expect(countsQT.updates).toBe(1);
    });

    it("tìm kiếm lọc chính xác theo mã hội thảo, tiêu đề hoặc đơn vị tổ chức", () => {
      const matchTN1 = matchesCandidateSearch(official11Candidates[0], "TN0001");
      expect(matchTN1).toBe(true);

      const matchNone = matchesCandidateSearch(official11Candidates[0], "NonExistentKeywordXYZ");
      expect(matchNone).toBe(false);

      const matchQT = matchesCandidateSearch(official11Candidates[7], "QT0001");
      expect(matchQT).toBe(true);
    });
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
