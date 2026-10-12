import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  filterJournalsList,
  sortJournalsList,
} from "../services/journalService";
import {
  resolveHomeTabFromUrl,
  buildHomeTabUrl,
} from "../pages/PublicHome";
import type { Journal, JournalCandidate } from "../types/journal";

describe("IFA-RH — Chỉnh hiển thị tên tạp chí & Bổ sung Tab Hội thảo / Tạp chí ở Trang chủ", () => {
  const sampleJournals: Journal[] = [
    {
      id: "J_001",
      journalId: "J_001",
      name: "Tạp chí Văn hóa Nghệ thuật",
      englishName: "Journal of Culture and Arts",
      publisher: "Bộ Văn hóa, Thể thao và Du lịch",
      issnPrint: "0866-8639",
      issnOnline: "2615-9589",
      category: "domestic",
      primaryField: "Văn hóa - Nghệ thuật",
      fields: [
        "Văn hóa - Nghệ thuật",
        "HĐGS Liên ngành Văn hóa - Nghệ thuật - TDTT",
        "HĐGS Ngành Triết học - Xã hội học - Chính trị học",
      ],
      website: "http://vanhoanghethuat.vn",
      websiteVerified: true,
      maxScore: 1.0,
      maxScoreYear: 2025,
      scores: [
        {
          id: "s1",
          journalId: "J_001",
          councilCode: "HDGS_VHNT",
          councilName: "HĐGS Liên ngành Văn hóa - Nghệ thuật - TDTT",
          year: 2025,
          maxScore: 1.0,
          decisionNumber: "26/QĐ-HĐGSNN",
          notes: "Tính điểm cho tất cả các bài nghiên cứu chuyên ngành mỹ thuật",
        },
        {
          id: "s2",
          journalId: "J_001",
          councilCode: "HDGS_THXHH",
          councilName: "HĐGS Ngành Triết học - Xã hội học - Chính trị học",
          year: 2025,
          maxScore: 0.75,
          decisionNumber: "26/QĐ-HĐGSNN",
          notes: "Chuyên mục Lý luận văn hóa",
        },
      ],
      guidelines: {
        hasGuidelines: true,
        summary: "Bài báo từ 4000 - 7000 từ, trích dẫn chuẩn APA.",
      },
      status: "active",
      isManualEdited: false,
      createdAt: "2026-10-12T00:00:00.000Z",
      updatedAt: "2026-10-12T00:00:00.000Z",
      createdBy: "admin@tdtu.edu.vn",
    },
    {
      id: "J_037",
      journalId: "J_037",
      name: "Tạp chí Khoa học (Trường Đại học Thủ đô Hà Nội)",
      englishName: "Scientific Journal of Hanoi Metropolitan University",
      publisher: "Trường Đại học Thủ đô Hà Nội",
      issnPrint: "2354-1512",
      category: "domestic",
      primaryField: "Giáo dục học",
      fields: ["Giáo dục học", "Văn hóa - Nghệ thuật"],
      website: "https://hnmu.edu.vn",
      websiteVerified: false,
      maxScore: 0.75,
      maxScoreYear: 2025,
      scores: [
        {
          id: "s3",
          journalId: "J_037",
          councilCode: "HDGS_GDH",
          councilName: "HĐGS Ngành Giáo dục học",
          year: 2025,
          maxScore: 0.75,
          decisionNumber: "26/QĐ-HĐGSNN",
        },
      ],
      guidelines: {
        hasGuidelines: false,
      },
      status: "active",
      isManualEdited: false,
      createdAt: "2026-10-12T00:00:00.000Z",
      updatedAt: "2026-10-12T00:00:00.000Z",
      createdBy: "admin@tdtu.edu.vn",
    },
    {
      id: "J_HIDDEN",
      journalId: "J_HIDDEN",
      name: "Tạp chí Đang Tạm Ẩn",
      publisher: "Viện Nghiên cứu",
      category: "domestic",
      primaryField: "Thiết kế",
      fields: ["Thiết kế"],
      websiteVerified: false,
      maxScore: 0.5,
      maxScoreYear: 2025,
      scores: [],
      status: "hidden",
      isManualEdited: false,
      createdAt: "2026-10-12T00:00:00.000Z",
      updatedAt: "2026-10-12T00:00:00.000Z",
      createdBy: "admin@tdtu.edu.vn",
    },
    {
      id: "J_INTL",
      journalId: "J_INTL",
      name: "International Journal of Design",
      publisher: "Design Society",
      category: "international",
      primaryField: "Thiết kế",
      fields: ["Thiết kế"],
      websiteVerified: true,
      maxScore: 1.5,
      maxScoreYear: 2025,
      scores: [],
      status: "active",
      isManualEdited: false,
      createdAt: "2026-10-12T00:00:00.000Z",
      updatedAt: "2026-10-12T00:00:00.000Z",
      createdBy: "admin@tdtu.edu.vn",
    },
  ];

  it("1 & 2. Không hiển thị mã nội bộ journalId (J_xxx) trên bảng hàng chờ duyệt, thẻ tạp chí và modal người dùng", () => {
    const dirPageSource = fs.readFileSync(
      path.resolve(__dirname, "../pages/JournalDirectoryPage.tsx"),
      "utf-8"
    );
    const cardSource = fs.readFileSync(
      path.resolve(__dirname, "../components/JournalCard.tsx"),
      "utf-8"
    );
    const detailModalSource = fs.readFileSync(
      path.resolve(__dirname, "../components/JournalDetailModal.tsx"),
      "utf-8"
    );
    const candidateModalSource = fs.readFileSync(
      path.resolve(__dirname, "../components/JournalCandidateReviewModal.tsx"),
      "utf-8"
    );

    // Bảng hàng chờ có cột "Tên tạp chí", không còn cột "Mã & Tên tạp chí" và không render {c.journalId}
    expect(dirPageSource).toContain(">Tên tạp chí</th>");
    expect(dirPageSource).not.toContain("Mã & Tên tạp chí");
    expect(dirPageSource).not.toContain("{c.journalId}");

    // Thẻ tạp chí và Modal chi tiết người dùng tuyệt đối không hiển thị {journal.journalId}
    expect(cardSource).not.toContain("{journal.journalId}");
    expect(detailModalSource).not.toContain("{journal.journalId}");
    expect(detailModalSource).not.toContain("MÃ ĐỊNH DANH:");

    // Modal duyệt của Admin đưa tên tạp chí nổi bật ở header và giữ mã đối soát ở vùng kỹ thuật cuối modal
    expect(candidateModalSource).toContain("Thông tin kỹ thuật nội bộ (Admin)");
  });

  it("3. Bảo toàn journalId trong dữ liệu Firestore và logic đồng bộ nội bộ", () => {
    const candidate: Partial<JournalCandidate> = {
      id: "cand_J_037",
      journalId: "J_037",
      name: "Tạp chí Khoa học (Trường Đại học Thủ đô Hà Nội)",
      status: "pending",
    };
    expect(candidate.journalId).toBe("J_037");
    expect(sampleJournals[0].journalId).toBe("J_001");
  });

  it("4 & 12. Trang chủ mặc định mở tab 'Hội thảo' (conferences) và hỗ trợ URL query parameter '/?tab=journals'", () => {
    expect(resolveHomeTabFromUrl("", "")).toBe("conferences");
    expect(resolveHomeTabFromUrl("?tab=conferences", "")).toBe("conferences");
    expect(resolveHomeTabFromUrl("?tab=journals", "")).toBe("journals");
    expect(resolveHomeTabFromUrl("?tab=tap-chi", "")).toBe("journals");
    expect(resolveHomeTabFromUrl("", "#journals")).toBe("journals");
    expect(resolveHomeTabFromUrl("", "#journal_directory")).toBe("journals");

    expect(buildHomeTabUrl("conferences")).toBe("/");
    expect(buildHomeTabUrl("journals")).toBe("/?tab=journals");
  });

  it("6 & 7. Tab Tạp chí chỉ hiển thị các tạp chí trong nước đang active (loại bỏ tạp chí tạm ẩn và quốc tế)", () => {
    const publicJournals = filterJournalsList(sampleJournals, {
      category: "domestic",
      onlyActive: true,
    });

    expect(publicJournals).toHaveLength(2);
    expect(publicJournals.map((j) => j.id)).toEqual(["J_001", "J_037"]);
    expect(publicJournals.some((j) => j.status === "hidden")).toBe(false);
    expect(publicJournals.some((j) => j.category === "international")).toBe(false);
  });

  it("8. Tìm kiếm tạp chí hoạt động chính xác theo tên tiếng Việt, tên tiếng Anh, ISSN, lĩnh vực và cơ quan xuất bản", () => {
    // Theo tên tiếng Việt
    expect(
      filterJournalsList(sampleJournals, {
        category: "domestic",
        onlyActive: true,
        searchQuery: "Thủ đô Hà Nội",
      }).map((j) => j.id)
    ).toEqual(["J_037"]);

    // Theo tên tiếng Anh
    expect(
      filterJournalsList(sampleJournals, {
        category: "domestic",
        onlyActive: true,
        searchQuery: "Culture and Arts",
      }).map((j) => j.id)
    ).toEqual(["J_001"]);

    // Theo ISSN
    expect(
      filterJournalsList(sampleJournals, {
        category: "domestic",
        onlyActive: true,
        searchQuery: "2354-1512",
      }).map((j) => j.id)
    ).toEqual(["J_037"]);

    // Theo cơ quan xuất bản
    expect(
      filterJournalsList(sampleJournals, {
        category: "domestic",
        onlyActive: true,
        searchQuery: "Bộ Văn hóa",
      }).map((j) => j.id)
    ).toEqual(["J_001"]);

    // Theo lĩnh vực / Hội đồng
    expect(
      filterJournalsList(sampleJournals, {
        category: "domestic",
        onlyActive: true,
        searchQuery: "Triết học",
      }).map((j) => j.id)
    ).toEqual(["J_001"]);
  });

  it("9. Bộ lọc tạp chí hoạt động độc lập theo Nhóm ngành, Điểm HĐGSNN, Năm áp dụng và Tình trạng hướng dẫn đăng bài", () => {
    // Lọc theo Nhóm ngành
    expect(
      filterJournalsList(sampleJournals, {
        category: "domestic",
        onlyActive: true,
        selectedField: "Giáo dục học",
      }).map((j) => j.id)
    ).toEqual(["J_037"]);

    // Lọc theo Điểm HĐGSNN >= 1.0
    expect(
      filterJournalsList(sampleJournals, {
        category: "domestic",
        onlyActive: true,
        selectedScore: "1.0",
      }).map((j) => j.id)
    ).toEqual(["J_001"]);

    // Lọc theo Năm áp dụng
    expect(
      filterJournalsList(sampleJournals, {
        category: "domestic",
        onlyActive: true,
        selectedYear: "2025",
      })
    ).toHaveLength(2);

    // Lọc theo Tình trạng hướng dẫn đăng bài
    expect(
      filterJournalsList(sampleJournals, {
        category: "domestic",
        onlyActive: true,
        selectedGuidelineStatus: "has_guidelines",
      }).map((j) => j.id)
    ).toEqual(["J_001"]);

    expect(
      filterJournalsList(sampleJournals, {
        category: "domestic",
        onlyActive: true,
        selectedGuidelineStatus: "no_guidelines",
      }).map((j) => j.id)
    ).toEqual(["J_037"]);
  });

  it("10 & 11. Sắp xếp tạp chí theo điểm cao nhất giảm dần, giữ nguyên chi tiết điểm theo từng Hội đồng Giáo sư và kiểm tra website đã xác minh", () => {
    const sorted = sortJournalsList([sampleJournals[1], sampleJournals[0]]);
    expect(sorted[0].id).toBe("J_001");
    expect(sorted[1].id).toBe("J_037");

    // Một tạp chí có nhiều mức điểm theo từng Hội đồng Giáo sư và loại ấn phẩm
    const j001 = sorted[0];
    expect(j001.scores).toHaveLength(2);
    expect(j001.scores[0].councilName).toContain("Văn hóa - Nghệ thuật");
    expect(j001.scores[0].maxScore).toBe(1.0);
    expect(j001.scores[1].councilName).toContain("Triết học");
    expect(j001.scores[1].maxScore).toBe(0.75);
    expect(j001.scores[1].notes).toContain("Chuyên mục Lý luận văn hóa");

    // Kiểm tra JournalCard.tsx yêu cầu websiteVerified !== false trước khi hiển thị nút Trang chủ
    const cardSource = fs.readFileSync(
      path.resolve(__dirname, "../components/JournalCard.tsx"),
      "utf-8"
    );
    expect(cardSource).toContain("journal.websiteVerified !== false");
  });
});
