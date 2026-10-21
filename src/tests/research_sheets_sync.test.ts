import { describe, it, expect } from "vitest";
import {
  DEFAULT_RESEARCH_SHEET_ID,
  DEFAULT_RESEARCH_SHEET_NAME_TN,
  DEFAULT_RESEARCH_SHEET_NAME_QT,
  DEFAULT_RESEARCH_SPREADSHEET_TITLE,
  OFFICIAL_RESEARCH_SPREADSHEET_URL,
  SPARK_ORIGIN_SPREADSHEET_ID,
  SPARK_ORIGIN_SPREADSHEET_TITLE,
  SPARK_ORIGIN_SPREADSHEET_URL,
  fetchAllFacultyResearchSheets,
} from "../services/researchSheetService";
import { executeResearchSync, type ResearchSyncSdk } from "../services/researchSyncService";

describe("Research Data Sync — Google Sheets Multi-Tab Engine Suite (Two-File Architecture)", () => {
  it("strictly enforces Two-File architecture: IFA-RH reads intermediate sheet, NOT Spark source sheet directly", () => {
    // FILE 2: Intermediate Google Sheet for IFA-RH
    expect(DEFAULT_RESEARCH_SHEET_ID).toBe("1ug0b4Holu6nGp6NwO-JViqe7XexeDLlwirqRELGwh4U");
    expect(DEFAULT_RESEARCH_SPREADSHEET_TITLE).toBe("IFA Faculty Research");
    expect(DEFAULT_RESEARCH_SHEET_NAME_TN).toBe("HỘI THẢO");
    expect(DEFAULT_RESEARCH_SHEET_NAME_QT).toBe("HOI THAO QT");
    expect(OFFICIAL_RESEARCH_SPREADSHEET_URL).toBe(
      "https://docs.google.com/spreadsheets/d/1ug0b4Holu6nGp6NwO-JViqe7XexeDLlwirqRELGwh4U/edit"
    );

    // FILE 1: Spark write-only Google Sheet
    expect(SPARK_ORIGIN_SPREADSHEET_ID).toBe("1eLiEZNC-vidouurOJ-usM1wImJT0unaVceslm2cg-Do");
    expect(SPARK_ORIGIN_SPREADSHEET_TITLE).toBe("IFA Faculty Research Opportunities");
    expect(SPARK_ORIGIN_SPREADSHEET_URL).toBe(
      "https://docs.google.com/spreadsheets/d/1eLiEZNC-vidouurOJ-usM1wImJT0unaVceslm2cg-Do/edit"
    );

    // CRITICAL: Production source must NOT be Spark's private spreadsheet
    expect(DEFAULT_RESEARCH_SHEET_ID).not.toBe(SPARK_ORIGIN_SPREADSHEET_ID);
  });

  it("fetches both HỘI THẢO (7 rows) and HOI THAO QT (3 rows) successfully from intermediate Google Sheet GViz API", async () => {
    const { rows, tnRows, qtRows, sheetMeta } = await fetchAllFacultyResearchSheets();

    expect(sheetMeta.sheetId).toBe(DEFAULT_RESEARCH_SHEET_ID);
    expect(sheetMeta.sheetTitle).toBe("IFA Faculty Research");
    expect(sheetMeta.tabs).toEqual(["HỘI THẢO", "HOI THAO QT"]);

    expect(tnRows.length).toBe(7);
    expect(qtRows.length).toBe(3);
    expect(rows.length).toBe(10);

    // Verify domestic rows are tagged with category "TN"
    for (const r of tnRows) {
      expect((r as any).category).toBe("TN");
    }

    // Verify international rows are tagged with category "QT"
    for (const r of qtRows) {
      expect((r as any).category).toBe("QT");
    }
  });

  it("rejects sync and throws safe error if a tab is invalid or non-existent", async () => {
    // Attempting to fetch with an invalid tab name triggers the GViz duplicate fallback safeguard
    await expect(
      fetchAllFacultyResearchSheets({
        sheetNameQT: "NON_EXISTENT_TAB_ABCXYZ_999",
      })
    ).rejects.toThrow(/trùng dữ liệu cho hai tab khác nhau|không tồn tại/);
  });

  it("executes unified sync in dryRun mode with intermediate sheets source without writing to Firestore", async () => {
    let setDocCalls = 0;
    let addDocCalls = 0;
    let updateDocCalls = 0;

    const mockSdk: ResearchSyncSdk = {
      doc: (_db, col, id) => ({ col, id }),
      getDoc: async () => ({ exists: () => false, data: () => undefined }),
      setDoc: async () => { setDocCalls++; },
      updateDoc: async () => { updateDocCalls++; },
      collection: (_db, path) => ({ path }),
      getDocs: async () => ({ docs: [], size: 0 }),
      addDoc: async () => { addDocCalls++; return { id: "test" }; },
      serverTimestamp: () => new Date().toISOString(),
    };

    const outcome = await executeResearchSync({
      db: {},
      sdk: mockSdk,
      user: { uid: "test_admin", email: "admin@tdtu.edu.vn", role: "admin" },
      options: {
        dryRun: true,
        dataSource: "sheets",
      },
    });

    expect(outcome.status).toBe("success");
    expect(outcome.items).toBeDefined();
    expect(outcome.items!.length).toBe(10);
    expect(outcome.sheetMeta?.sheetTitle).toBe("IFA Faculty Research");
    expect(outcome.sheetMeta?.sheetId).toBe("1ug0b4Holu6nGp6NwO-JViqe7XexeDLlwirqRELGwh4U");
    expect(outcome.sheetMeta?.tnCount).toBe(7);
    expect(outcome.sheetMeta?.qtCount).toBe(3);

    // Dry-run must make ZERO Firestore mutations
    expect(setDocCalls).toBe(0);
    expect(addDocCalls).toBe(0);
    expect(updateDocCalls).toBe(0);
  });
});
