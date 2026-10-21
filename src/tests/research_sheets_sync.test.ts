import { describe, it, expect } from "vitest";
import {
  DEFAULT_RESEARCH_SHEET_ID,
  DEFAULT_RESEARCH_SHEET_NAME_TN,
  DEFAULT_RESEARCH_SHEET_NAME_QT,
  DEFAULT_RESEARCH_SPREADSHEET_TITLE,
  OFFICIAL_RESEARCH_SPREADSHEET_URL,
  fetchAllFacultyResearchSheets,
} from "../services/researchSheetService";
import { executeResearchSync, type ResearchSyncSdk } from "../services/researchSyncService";

describe("Research Data Sync — Google Sheets Multi-Tab Engine Suite", () => {
  it("verifies official Google Sheet constants and spreadsheet URL", () => {
    expect(DEFAULT_RESEARCH_SHEET_ID).toBe("1eLiEZNC-vidouurOJ-usM1wImJT0unaVceslm2cg-Do");
    expect(DEFAULT_RESEARCH_SPREADSHEET_TITLE).toBe("IFA Faculty Research Opportunities");
    expect(DEFAULT_RESEARCH_SHEET_NAME_TN).toBe("HOI THAO");
    expect(DEFAULT_RESEARCH_SHEET_NAME_QT).toBe("HOI THAO QT");
    expect(OFFICIAL_RESEARCH_SPREADSHEET_URL).toBe(
      "https://docs.google.com/spreadsheets/d/1eLiEZNC-vidouurOJ-usM1wImJT0unaVceslm2cg-Do/edit"
    );
  });

  it("fetches both HOI THAO (7 rows) and HOI THAO QT (3 rows) successfully from Google Sheets GViz API", async () => {
    const { rows, tnRows, qtRows, sheetMeta } = await fetchAllFacultyResearchSheets();

    expect(sheetMeta.sheetId).toBe(DEFAULT_RESEARCH_SHEET_ID);
    expect(sheetMeta.sheetTitle).toBe(DEFAULT_RESEARCH_SPREADSHEET_TITLE);
    expect(sheetMeta.tabs).toEqual(["HOI THAO", "HOI THAO QT"]);

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

  it("executes unified sync in dryRun mode with sheets source without writing to Firestore", async () => {
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
    expect(outcome.items!.length).toBe(10);
    expect(outcome.sheetMeta?.sheetTitle).toBe("IFA Faculty Research Opportunities");
    expect(outcome.sheetMeta?.tnCount).toBe(7);
    expect(outcome.sheetMeta?.qtCount).toBe(3);

    // Dry-run must make ZERO Firestore mutations
    expect(setDocCalls).toBe(0);
    expect(addDocCalls).toBe(0);
    expect(updateDocCalls).toBe(0);
  });
});
