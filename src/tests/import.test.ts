import { describe, it, expect } from "vitest";
import { parseCsvText } from "../utils/excel";

describe("IMPORT Engine Tests", () => {
  it("should accurately parse CSV rows and headers with quotes", () => {
    const csvData = `Tên công trình,Năm,Loại hình,Tác giả\n"Nghiên cứu văn hoa dân gian, phần 1",2025,Bài báo,Nguyễn Văn A\n"Thiết kế bền vững",2026,Hội thảo,Trần Thị B`;
    const parsed = parseCsvText(csvData);

    expect(parsed.headers).toEqual(["Tên công trình", "Năm", "Loại hình", "Tác giả"]);
    expect(parsed.rows.length).toBe(2);
    expect(parsed.rows[0]["Tên công trình"]).toBe("Nghiên cứu văn hoa dân gian, phần 1");
    expect(parsed.rows[0]["Năm"]).toBe("2025");
    expect(parsed.rows[1]["Tên công trình"]).toBe("Thiết kế bền vững");
  });

  it("should detect invalid rows with missing required columns", () => {
    const csvData = `Tên công trình,Năm,Tác giả\n"",2025,Nguyễn Văn A\n"Bài báo số 2",invalid_year,Trần Văn C`;
    const parsed = parseCsvText(csvData);

    const validateRow = (r: Record<string, any>) => {
      const errors: string[] = [];
      if (!r["Tên công trình"]?.trim()) errors.push("Thiếu tên công trình");
      if (isNaN(Number(r["Năm"]))) errors.push("Năm không hợp lệ");
      return errors;
    };

    const row1Errors = validateRow(parsed.rows[0]);
    expect(row1Errors).toContain("Thiếu tên công trình");

    const row2Errors = validateRow(parsed.rows[1]);
    expect(row2Errors).toContain("Năm không hợp lệ");
  });
});
