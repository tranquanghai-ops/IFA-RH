import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseJournalWorkbook } from "../services/journalExcelService";

describe("Journal Excel Parser — Đọc Template Chuẩn schema_version = 1", () => {
  const templatePath = path.resolve("public", "templates", "IFA_RH_Journal_Directory_Template_v1.xlsx");

  it("tồn tại file template chuẩn tại thư mục public/templates và docs", () => {
    expect(fs.existsSync(templatePath)).toBe(true);
    const docsTemplatePath = path.resolve("docs", "IFA_RH_Journal_Directory_Template_v1.xlsx");
    expect(fs.existsSync(docsTemplatePath)).toBe(true);
  });

  it("phân tích thành công template chuẩn với schema_version = 1 và đầy đủ 5 sheets", async () => {
    const fileBuffer = fs.readFileSync(templatePath);
    const result = await parseJournalWorkbook(fileBuffer);

    expect(result.schemaVersion).toBe(1);
    expect(result.journals.length).toBe(5);

    // Verify Journal 1: TC-VHNT-001
    const vhnt = result.journals.find((j) => j.journalId === "TC-VHNT-001");
    expect(vhnt).toBeDefined();
    expect(vhnt?.name).toBe("Tạp chí Văn hóa Nghệ thuật");
    expect(vhnt?.publisher).toBe("Bộ Văn hóa, Thể thao và Du lịch");
    expect(vhnt?.issnPrint).toBe("0866-8639");
    expect(vhnt?.issnOnline).toBe("2615-9589");
    expect(vhnt?.category).toBe("domestic");
    expect(vhnt?.maxScore).toBe(1.0);
    expect(vhnt?.maxScoreYear).toBe(2025);
    expect(vhnt?.scores.length).toBe(3); // 2025 (2 councils), 2024
    expect(vhnt?.guidelines?.hasGuidelines).toBe(true);
    expect(vhnt?.guidelines?.citationStyle).toBe("APA 7th");
    expect(vhnt?.links?.length).toBeGreaterThan(0);
    expect(vhnt?.verification?.status).toBe("verified");

    // Verify Journal 2: TC-KT-002
    const kt = result.journals.find((j) => j.journalId === "TC-KT-002");
    expect(kt).toBeDefined();
    expect(kt?.name).toBe("Tạp chí Kiến trúc");
    expect(kt?.maxScore).toBe(1.0);
    expect(kt?.scores.length).toBe(2);

    // Verify Journal 3: TC-NCMT-003 (Chưa có website)
    const ncmt = result.journals.find((j) => j.journalId === "TC-NCMT-003");
    expect(ncmt).toBeDefined();
    expect(ncmt?.website).toBeFalsy();
    expect(ncmt?.websiteVerified).toBe(false);

    // Verify Journal 5: TC-TKST-005 (Needs update)
    const tkst = result.journals.find((j) => j.journalId === "TC-TKST-005");
    expect(tkst).toBeDefined();
    expect(tkst?.verification?.status).toBe("needs_update");
  });
});
