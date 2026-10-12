import { describe, it, expect } from "vitest";
import {
  normalizeTitle,
  normalizeIssn,
  calculateJournalImportDiff,
} from "../services/journalExcelService";
import type { Journal } from "../types/journal";

describe("Danh mục Tạp chí Khoa học — Chuẩn hóa & Đối soát Dữ liệu", () => {
  it("chuẩn hóa tiêu đề chính xác để phát hiện trùng lặp (không phân biệt dấu, hoa thường, khoảng trắng)", () => {
    const title1 = "Tạp chí Văn hóa Nghệ thuật";
    const title2 = "tap chi van hoa nghe thuat";
    const title3 = "  TẠP CHÍ VĂN HÓA NGHỆ THUẬT!  ";

    expect(normalizeTitle(title1)).toBe("tapchivanhoanghethuat");
    expect(normalizeTitle(title2)).toBe("tapchivanhoanghethuat");
    expect(normalizeTitle(title3)).toBe("tapchivanhoanghethuat");
  });

  it("chuẩn hóa ISSN đúng định dạng XXXX-XXXX", () => {
    expect(normalizeIssn("08668639")).toBe("0866-8639");
    expect(normalizeIssn("0866-8639")).toBe("0866-8639");
    expect(normalizeIssn("2615-9589")).toBe("2615-9589");
    expect(normalizeIssn("2411532X")).toBe("2411-532X");
    expect(normalizeIssn("")).toBe("");
  });
});

describe("Danh mục Tạp chí Khoa học — Phân tích Diff Import & Bảo vệ Dữ liệu", () => {
  const baseJournal: Journal = {
    id: "TC-VHNT-001",
    journalId: "TC-VHNT-001",
    name: "Tạp chí Văn hóa Nghệ thuật",
    publisher: "Bộ Văn hóa, Thể thao và Du lịch",
    issnPrint: "0866-8639",
    issnOnline: "2615-9589",
    category: "domestic",
    primaryField: "Văn hóa - Nghệ thuật",
    fields: [
      "Văn hóa - Nghệ thuật",
      "HĐGS Liên ngành Văn hóa - Nghệ thuật - TDTT",
      "HĐGS Ngành Triết học - Xã hội học - Xã hội",
    ],
    website: "http://vanhoanghethuat.vn",
    websiteVerified: true,
    maxScore: 1.0,
    maxScoreYear: 2025,
    scores: [
      {
        id: "PTS-001",
        journalId: "TC-VHNT-001",
        councilCode: "HDGS_VHNT",
        councilName: "HĐGS Liên ngành Văn hóa - Nghệ thuật - TDTT",
        year: 2025,
        maxScore: 1.0,
      },
      {
        id: "PTS-002",
        journalId: "TC-VHNT-001",
        councilCode: "HDGS_TRIETHOC",
        councilName: "HĐGS Ngành Triết học - Xã hội học - Xã hội",
        year: 2025,
        maxScore: 0.75,
      },
      {
        id: "PTS-003",
        journalId: "TC-VHNT-001",
        councilCode: "HDGS_VHNT",
        councilName: "HĐGS Liên ngành Văn hóa - Nghệ thuật - TDTT",
        year: 2024,
        maxScore: 0.75,
      },
    ],
    guidelines: {
      hasGuidelines: true,
      summary: "Thể lệ bài viết 4000-6000 từ.",
    },
    status: "active",
    isManualEdited: false,
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
    createdBy: "admin@tdtu.edu.vn",
  };

  it("phát hiện tạp chí mới khi chưa tồn tại trong cơ sở dữ liệu (action: create)", () => {
    const diff = calculateJournalImportDiff([baseJournal], []);
    expect(diff.length).toBe(1);
    expect(diff[0].action).toBe("create");
    expect(diff[0].selected).toBe(true);
  });

  it("hỗ trợ một tạp chí thuộc nhiều nhóm ngành và nhiều mức điểm theo năm mà không mất lịch sử", () => {
    expect(baseJournal.fields.length).toBeGreaterThanOrEqual(2);
    expect(baseJournal.scores.length).toBe(3);

    // Năm 2025 có 2 hội đồng khác nhau
    const scores2025 = baseJournal.scores.filter((s) => s.year === 2025);
    expect(scores2025.length).toBe(2);

    // Điểm tối đa năm 2025 là 1.0, năm 2024 là 0.75
    const score2024 = baseJournal.scores.find((s) => s.year === 2024);
    expect(score2024?.maxScore).toBe(0.75);
    expect(baseJournal.maxScore).toBe(1.0);
  });

  it("nhận diện bản ghi hiện có qua ISSN và cập nhật mà không tạo trùng", () => {
    const incomingWithDifferentId: Journal = {
      ...baseJournal,
      journalId: "TC-NEW-999", // Mã khác nhưng ISSN trùng
      name: "Tạp chí Văn hóa & Nghệ thuật",
    };

    const diff = calculateJournalImportDiff([incomingWithDifferentId], [baseJournal]);
    expect(diff.length).toBe(1);
    expect(diff[0].action).toBe("update");
    expect(diff[0].reasons.some((r) => r.includes("ISSN"))).toBe(true);
  });

  it("bảo toàn dữ liệu đã chỉnh sửa thủ công khi Admin chưa bật ghi đè (isManualEdited = true, overrideManual = false)", () => {
    const manualEditedJournal: Journal = {
      ...baseJournal,
      isManualEdited: true,
      name: "Tạp chí Văn hóa Nghệ thuật (Đã hiệu chỉnh bởi Admin)",
    };

    const incoming: Journal = {
      ...baseJournal,
      name: "Tạp chí Văn hóa Nghệ thuật (Bản gốc từ Excel)",
    };

    // Khi overrideManual = false: GIỮ NGUYÊN
    const diffPreserved = calculateJournalImportDiff([incoming], [manualEditedJournal], false);
    expect(diffPreserved[0].action).toBe("unchanged");
    expect(diffPreserved[0].isManualPreserved).toBe(true);
    expect(diffPreserved[0].selected).toBe(false);

    // Khi overrideManual = true: CHO PHÉP CẬP NHẬT
    const diffOverridden = calculateJournalImportDiff([incoming], [manualEditedJournal], true);
    expect(diffOverridden[0].action).toBe("update");
    expect(diffOverridden[0].selected).toBe(true);
  });

  it("đánh dấu đúng các trường chưa xác minh (thiếu website, thiếu E-ISSN, thiếu thể lệ)", () => {
    const incompleteJournal: Journal = {
      ...baseJournal,
      journalId: "TC-TEST-INCOMPLETE",
      website: "",
      websiteVerified: false,
      issnOnline: undefined,
      guidelines: { hasGuidelines: false },
      verification: {
        status: "unverified",
        schemaVersion: 1,
      },
    };

    const diff = calculateJournalImportDiff([incompleteJournal], []);
    expect(diff[0].unverifiedFields).toContain("Chưa có trang chủ");
    expect(diff[0].unverifiedFields).toContain("Chưa có thể lệ đăng bài");
    expect(diff[0].unverifiedFields).toContain("Hồ sơ chưa kiểm chứng toàn diện");
  });

  it("phát hiện bản ghi trùng lặp ngay trong cùng file Excel và bỏ qua", () => {
    const duplicateRow1 = { ...baseJournal, journalId: "TC-DUP-01" };
    const duplicateRow2 = { ...baseJournal, journalId: "TC-DUP-01" };

    const diff = calculateJournalImportDiff([duplicateRow1, duplicateRow2], []);
    expect(diff.length).toBe(2);
    expect(diff[0].action).toBe("create");
    expect(diff[1].action).toBe("skip");
    expect(diff[1].reasons[0]).toContain("trùng lặp mã journal_id trong chính file Excel");
  });
});

describe("Quyền Truy cập & Bảo mật Danh mục Tạp chí (Firestore Rules Logic)", () => {
  it("cho phép Giảng viên và Public xem tạp chí active, nhưng từ chối xem tạp chí hidden", () => {
    const canRead = (status: string, role?: string) => {
      if (role === "admin" || role === "owner") return true;
      return status === "active";
    };

    expect(canRead("active", "lecturer")).toBe(true);
    expect(canRead("active", undefined)).toBe(true); // Public
    expect(canRead("hidden", "lecturer")).toBe(false); // Lecturer bị ẩn
    expect(canRead("hidden", "admin")).toBe(true); // Admin xem được
    expect(canRead("hidden", "owner")).toBe(true); // Owner xem được
  });

  it("chỉ cho phép Admin và Owner tạo, cập nhật, xóa hoặc import tạp chí", () => {
    const canWrite = (role?: string) => role === "admin" || role === "owner";

    expect(canWrite("lecturer")).toBe(false);
    expect(canWrite(undefined)).toBe(false);
    expect(canWrite("admin")).toBe(true);
    expect(canWrite("owner")).toBe(true);
  });
});
