import ExcelJS from "exceljs";

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, any>[];
  rawRows: (string | number | null | undefined)[][];
}

/**
 * Read Excel (.xlsx) or CSV file from browser File object
 */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();

  const isCsv = file.name.endsWith(".csv") || file.type === "text/csv";
  if (isCsv) {
    // Decode text
    const text = new TextDecoder("utf-8").decode(buffer);
    return parseCsvText(text);
  }

  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("File Excel không có sheet nào!");
  }

  const rawRows: (string | number | null | undefined)[][] = [];
  worksheet.eachRow((row) => {
    const rowValues = (row.values as any[]) || [];
    // ExcelJS row.values is 1-indexed (index 0 is undefined)
    const normalizedRow = rowValues.slice(1).map((val) => {
      if (val === null || val === undefined) return "";
      if (typeof val === "object" && val.text) return String(val.text).trim();
      if (typeof val === "object" && val.result !== undefined) return String(val.result).trim();
      return String(val).trim();
    });
    rawRows.push(normalizedRow);
  });

  if (rawRows.length === 0) {
    return { headers: [], rows: [], rawRows: [] };
  }

  // First non-empty row as header
  const headerRowIndex = rawRows.findIndex((r) => r.some((c) => c !== ""));
  if (headerRowIndex === -1) {
    return { headers: [], rows: [], rawRows: [] };
  }

  const headers = rawRows[headerRowIndex].map((h, i) => (h ? String(h) : `Cột_${i + 1}`));
  const rows: Record<string, any>[] = [];

  for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (r.every((c) => !c)) continue; // skip empty rows
    const obj: Record<string, any> = { _rowIndex: i + 1 };
    headers.forEach((h, colIdx) => {
      obj[h] = r[colIdx] ?? "";
    });
    rows.push(obj);
  }

  return { headers, rows, rawRows };
}

/**
 * Parse CSV text into headers and rows
 */
export function parseCsvText(text: string): ParsedSheet {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return { headers: [], rows: [], rawRows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const rawRows = lines.map(parseLine);
  const headers = rawRows[0].map((h, i) => (h ? h : `Cột_${i + 1}`));
  const rows: Record<string, any>[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    const obj: Record<string, any> = { _rowIndex: i + 1 };
    headers.forEach((h, colIdx) => {
      obj[h] = r[colIdx] ?? "";
    });
    rows.push(obj);
  }

  return { headers, rows, rawRows };
}

/**
 * Export data array to Excel (.xlsx) and trigger browser download
 */
export async function exportToExcel(
  fileName: string,
  sheetName: string,
  columns: { header: string; key: string; width?: number }[],
  data: Record<string, any>[]
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "IFA-RH - Khoa MTCN TDTU";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || 20,
  }));

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF10394C" }, // Primary IFA Navy
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 28;

  // Add data
  data.forEach((item) => {
    worksheet.addRow(item);
  });

  // Border & padding for all cells
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > 1) {
      row.alignment = { vertical: "middle", wrapText: true };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export data array to CSV and trigger browser download
 */
export function exportToCsv(
  fileName: string,
  columns: { header: string; key: string }[],
  data: Record<string, any>[]
) {
  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerLine = columns.map((c) => escapeCsv(c.header)).join(",");
  const rowLines = data.map((item) =>
    columns.map((col) => escapeCsv(item[col.key])).join(",")
  );

  const csvContent = "\uFEFF" + [headerLine, ...rowLines].join("\r\n"); // UTF-8 BOM
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
