import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  acquireFirestoreSyncLock,
  releaseFirestoreSyncLock,
  RESEARCH_SYNC_LOCK_DOC_ID,
  RESEARCH_SYNC_LOCK_TTL_MS,
  ResearchDriveJsonError,
  fetchLatestConferencesFromDrive,
  setDriveConferencesCache,
  clearDriveConferencesCache,
} from "../services/researchDriveJsonService";
import { executeResearchSync } from "../services/researchSyncService";
import type { Opportunity, OpportunityCandidate } from "../types";

describe("Research Sync Guard & Concurrency Lock Suite", () => {
  beforeEach(() => {
    clearDriveConferencesCache();
    vi.restoreAllMocks();
  });

  describe("1. Atomic Firestore Transaction Session Lock", () => {
    // In-memory transactional Firestore simulation
    function createMockTransactionalFirestore() {
      const store: Record<string, any> = {};

      const sdk = {
        doc: (_db: any, col: string, id: string) => ({ col, id, path: `${col}/${id}` }),
        runTransaction: async <T>(_db: any, updateFunction: (transaction: any) => Promise<T>): Promise<T> => {
          // Transaction object providing atomic get & set
          const stagedWrites: Array<{ key: string; data: any; merge?: boolean }> = [];
          const transaction = {
            get: async (ref: any) => {
              const val = store[ref.path];
              return {
                exists: () => val !== undefined,
                data: () => (val ? JSON.parse(JSON.stringify(val)) : undefined),
              };
            },
            set: (ref: any, data: any, options?: any) => {
              stagedWrites.push({ key: ref.path, data: JSON.parse(JSON.stringify(data)), merge: options?.merge });
            },
          };

          const result = await updateFunction(transaction);
          // Commit staged writes atomically
          for (const write of stagedWrites) {
            if (write.merge && store[write.key]) {
              store[write.key] = { ...store[write.key], ...write.data };
            } else {
              store[write.key] = write.data;
            }
          }
          return result;
        },
      };

      return { store, sdk };
    }

    it("acquires session lock via transaction and records lockId and actor details", async () => {
      const { store, sdk } = createMockTransactionalFirestore();

      const res = await acquireFirestoreSyncLock({}, sdk, {
        email: "admin1@tdtu.edu.vn",
        uid: "u_admin1",
      });

      expect(res.acquired).toBe(true);
      expect(res.lockId).toMatch(/^lock_\d+_/);
      expect(res.lockedBy).toBe("admin1@tdtu.edu.vn");

      const docKey = `systemConfig/${RESEARCH_SYNC_LOCK_DOC_ID}`;
      expect(store[docKey]).toBeDefined();
      expect(store[docKey].isLocked).toBe(true);
      expect(store[docKey].lockId).toBe(res.lockId);
      expect(store[docKey].lockedBy).toBe("admin1@tdtu.edu.vn");
      expect(store[docKey].ttlMs).toBe(RESEARCH_SYNC_LOCK_TTL_MS);
    });

    it("strictly rejects concurrent lock acquisition during active TTL (no force bypass)", async () => {
      const { sdk } = createMockTransactionalFirestore();

      // Session A acquires lock
      const lockA = await acquireFirestoreSyncLock({}, sdk, {
        email: "admin_a@tdtu.edu.vn",
        uid: "u_a",
      });
      expect(lockA.acquired).toBe(true);

      // Session B attempts to acquire concurrently while TTL is active
      const lockB = await acquireFirestoreSyncLock({}, sdk, {
        email: "admin_b@tdtu.edu.vn",
        uid: "u_b",
      });

      expect(lockB.acquired).toBe(false);
      expect(lockB.message).toContain("Một phiên đồng bộ khác đang chạy bởi admin_a@tdtu.edu.vn");
      expect(lockB.lockedBy).toBe("admin_a@tdtu.edu.vn");
      expect(lockB.remainingSeconds).toBeGreaterThan(0);
      expect(lockB.remainingSeconds).toBeLessThanOrEqual(300);
    });

    it("automatically reclaims lock atomically if prior lock has expired beyond TTL (5 minutes)", async () => {
      const { store, sdk } = createMockTransactionalFirestore();

      // Seed expired lock (6 minutes ago)
      const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
      const expiredLockId = "lock_expired_old_session";
      store[`systemConfig/${RESEARCH_SYNC_LOCK_DOC_ID}`] = {
        isLocked: true,
        lockId: expiredLockId,
        lockedBy: "old_admin@tdtu.edu.vn",
        lockedAt: new Date(sixMinutesAgo).toISOString(),
        lockTimestampMs: sixMinutesAgo,
        ttlMs: RESEARCH_SYNC_LOCK_TTL_MS,
      };

      // New session acquires lock
      const res = await acquireFirestoreSyncLock({}, sdk, {
        email: "new_admin@tdtu.edu.vn",
        uid: "u_new",
      });

      expect(res.acquired).toBe(true);
      expect(res.lockId).not.toBe(expiredLockId);
      expect(res.lockedBy).toBe("new_admin@tdtu.edu.vn");

      // Verify store updated with new session lock
      const currentDoc = store[`systemConfig/${RESEARCH_SYNC_LOCK_DOC_ID}`];
      expect(currentDoc.isLocked).toBe(true);
      expect(currentDoc.lockId).toBe(res.lockId);
      expect(currentDoc.lockedBy).toBe("new_admin@tdtu.edu.vn");
    });

    it("strictly verifies lock ownership on release — rejects unauthorized release attempts", async () => {
      const { store, sdk } = createMockTransactionalFirestore();

      const lockRes = await acquireFirestoreSyncLock({}, sdk, {
        email: "admin1@tdtu.edu.vn",
        uid: "u_1",
      });
      expect(lockRes.acquired).toBe(true);

      // Attempt 1: Unauthorized caller with different lockId
      const fakeRelease = await releaseFirestoreSyncLock({}, sdk, "lock_imposter_999");
      expect(fakeRelease.released).toBe(false);
      expect(fakeRelease.reason).toBe("lock_id_mismatch");

      // Active lock must remain intact
      expect(store[`systemConfig/${RESEARCH_SYNC_LOCK_DOC_ID}`].isLocked).toBe(true);
      expect(store[`systemConfig/${RESEARCH_SYNC_LOCK_DOC_ID}`].lockId).toBe(lockRes.lockId);

      // Attempt 2: Empty lockId
      const emptyRelease = await releaseFirestoreSyncLock({}, sdk, "");
      expect(emptyRelease.released).toBe(false);
      expect(store[`systemConfig/${RESEARCH_SYNC_LOCK_DOC_ID}`].isLocked).toBe(true);

      // Attempt 3: Authorized owner releases with correct lockId
      const validRelease = await releaseFirestoreSyncLock({}, sdk, lockRes.lockId);
      expect(validRelease.released).toBe(true);
      expect(store[`systemConfig/${RESEARCH_SYNC_LOCK_DOC_ID}`].isLocked).toBe(false);
      expect(store[`systemConfig/${RESEARCH_SYNC_LOCK_DOC_ID}`].lockId).toBe("");
      expect(store[`systemConfig/${RESEARCH_SYNC_LOCK_DOC_ID}`].lastReleasedLockId).toBe(lockRes.lockId);
    });

    it("prevents an old session from releasing a lock that expired and was re-claimed by a new session", async () => {
      const { store, sdk } = createMockTransactionalFirestore();

      const oldLockId = "lock_session_A";
      const newLockId = "lock_session_B";

      // Session B now holds the lock
      store[`systemConfig/${RESEARCH_SYNC_LOCK_DOC_ID}`] = {
        isLocked: true,
        lockId: newLockId,
        lockedBy: "session_b@tdtu.edu.vn",
        lockedAt: new Date().toISOString(),
        lockTimestampMs: Date.now(),
        ttlMs: RESEARCH_SYNC_LOCK_TTL_MS,
      };

      // Session A (which woke up late) attempts to release its old lock
      const lateRelease = await releaseFirestoreSyncLock({}, sdk, oldLockId);
      expect(lateRelease.released).toBe(false);
      expect(lateRelease.reason).toBe("lock_id_mismatch");

      // Session B's lock remains active and untouched
      expect(store[`systemConfig/${RESEARCH_SYNC_LOCK_DOC_ID}`].isLocked).toBe(true);
      expect(store[`systemConfig/${RESEARCH_SYNC_LOCK_DOC_ID}`].lockId).toBe(newLockId);
    });
  });

  describe("2. Untrusted Source & Cached Fallback Guard", () => {
    it("allows preview (dryRun: true) with cached_fallback but strictly forbids live Firestore write (dryRun: false)", async () => {
      // Mock fetch to simulate Google Drive connection failure
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Drive API Network timeout"));

      // Pre-seed valid in-memory cache
      setDriveConferencesCache({
        fileId: "127reAKNmLzef51KjI8j-tn97xlY9ZR5q",
        fileName: "IFA_RH_CONFERENCES.json",
        cachedAt: new Date().toISOString(),
        payload: {
          schemaVersion: 1,
          revision: 1,
          runId: "20261015-01",
          generatedAt: new Date().toISOString(),
          conferences: [
            {
              code: "TN0001",
              category: "TN",
              title: "Hội thảo quốc tế ICISN 2027",
              organizer: "Học viện CNBCVT",
              country: "Việt Nam",
              content: "Nội dung ICISN",
            },
          ],
        },
      });

      const store: Record<string, any> = {};
      const mockSdk: any = {
        doc: (_db: any, col: string, id: string) => ({ col, id, path: `${col}/${id}` }),
        getDoc: async () => ({ exists: () => false, data: () => undefined }),
        setDoc: async (ref: any, data: any) => { store[ref.path] = data; },
        updateDoc: async (ref: any, data: any) => { store[ref.path] = { ...store[ref.path], ...data }; },
        collection: (_db: any, path: string) => ({ path }),
        getDocs: async () => ({ docs: [] }),
        addDoc: async (_col: any, data: any) => {
          const id = `cand_${Date.now()}`;
          store[`opportunityCandidates/${id}`] = data;
          return { id };
        },
        serverTimestamp: () => new Date().toISOString(),
        runTransaction: async (_db: any, fn: any) => fn({
          get: async () => ({ exists: () => false, data: () => undefined }),
          set: () => {},
        }),
      };

      try {
        // Step A: Dry run succeeds and flags isCached: true
        const dryRunRes = await executeResearchSync({
          db: {},
          sdk: mockSdk,
          user: { uid: "u_admin", email: "admin@tdtu.edu.vn", role: "admin" },
          options: {
            dryRun: true,
            dataSource: "drive_json",
          },
        });

        expect(dryRunRes.skipped).toBe(false);
        expect(dryRunRes.driveMeta?.isCached).toBe(true);
        expect(dryRunRes.items?.length).toBe(1);
        expect(Object.keys(store).length).toBe(0); // Zero Firestore writes in dry-run

        // Step B: Live sync attempt with cached fallback is STRICTLY REJECTED
        await expect(
          executeResearchSync({
            db: {},
            sdk: mockSdk,
            user: { uid: "u_admin", email: "admin@tdtu.edu.vn", role: "admin" },
            options: {
              dryRun: false,
              dataSource: "drive_json",
            },
          })
        ).rejects.toThrow("CACHED_SOURCE_WRITE_FORBIDDEN");

        // Step C: Verify zero data was written to Firestore
        const candidateKeys = Object.keys(store).filter((k) => k.startsWith("opportunityCandidates/"));
        expect(candidateKeys.length).toBe(0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("strictly aborts execution when Drive revision does not match expectedRevision (prevents stale preview write)", async () => {
      // Mock fetch returning revision 2
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("files?q=")) {
          return {
            ok: true,
            json: async () => ({
              files: [{ id: "file_rev_2", name: "IFA_RH_CONFERENCES.json" }],
            }),
          };
        }
        if (url.includes("files/file_rev_2?alt=media")) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                schemaVersion: 1,
                revision: 2, // Revision is now 2
                runId: "20261015-02",
                generatedAt: new Date().toISOString(),
                conferences: [
                  {
                    code: "TN0001",
                    category: "TN",
                    title: "Hội thảo quốc tế ICISN 2027",
                    organizer: "Học viện CNBCVT",
                    country: "Việt Nam",
                    content: "Nội dung ICISN",
                  },
                ],
              }),
          };
        }
        return { ok: false, status: 404 };
      });

      const store: Record<string, any> = {};
      const mockSdk: any = {
        doc: (_db: any, col: string, id: string) => ({ col, id, path: `${col}/${id}` }),
        getDoc: async () => ({ exists: () => false, data: () => undefined }),
        setDoc: async (ref: any, data: any) => { store[ref.path] = data; },
        collection: () => ({}),
        getDocs: async () => ({ docs: [] }),
        addDoc: async () => ({ id: "cand_1" }),
        serverTimestamp: () => new Date().toISOString(),
        runTransaction: async (_db: any, fn: any) => fn({
          get: async () => ({ exists: () => false, data: () => undefined }),
          set: () => {},
        }),
      };

      try {
        // Caller expected revision 1 (stale preview), but Drive is now revision 2
        await expect(
          executeResearchSync({
            db: {},
            sdk: mockSdk,
            user: { uid: "u_admin", email: "admin@tdtu.edu.vn", role: "admin" },
            options: {
              dryRun: false,
              dataSource: "drive_json",
              expectedRevision: 1, // Stale!
            },
          })
        ).rejects.toThrow("REVISION_MISMATCH");

        // Verify zero candidates created
        expect(Object.keys(store).filter((k) => k.startsWith("opportunityCandidates/")).length).toBe(0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("3. Unified Dry-Run Engine Equivalence & TN/QT Item Mapping", () => {
    it("returns structured items with conferenceCode, category, and targetId for both TN and QT records", async () => {
      // Mock fetch with 3 conferences: 1 TN matched, 1 QT matched (QT0003), 1 new QT (QT0001)
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("files?q=")) {
          return {
            ok: true,
            json: async () => ({
              files: [{ id: "file_test", name: "IFA_RH_CONFERENCES.json" }],
            }),
          };
        }
        if (url.includes("files/file_test?alt=media")) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                schemaVersion: 1,
                revision: 1,
                runId: "20261015-01",
                generatedAt: "2026-10-15T00:00:00Z",
                conferences: [
                  {
                    code: "TN0001",
                    category: "TN",
                    title: "Hội thảo quốc tế ICISN 2027",
                    organizer: "Học viện Công nghệ Bưu chính Viễn thông (PTIT)",
                    country: "Việt Nam",
                    submissionDeadline: "20/11/2026",
                    deadline: "20/11/2026",
                    content: "Nội dung ICISN",
                  },
                  {
                    code: "QT0003",
                    category: "QT",
                    title: "Hội thảo quốc tế: “Shaping the Future of the Global South: Trends and Insights”",
                    organizer: "Đại học Kinh tế Quốc dân (NEU), IEASA và Đại học SMU (Nam Phi)",
                    country: "Nam Phi / Việt Nam",
                    deadline: "Nhận bài thường xuyên",
                    content: "Nội dung Global South",
                  },
                  {
                    code: "QT0001",
                    category: "QT",
                    title: "Hội thảo quốc tế HAXD 2027",
                    organizer: "Đại học Federico II, Naples",
                    country: "Ý",
                    content: "Nội dung HAXD",
                  },
                ],
              }),
          };
        }
        return { ok: false, status: 404 };
      });

      // Existing published opportunities: ICISN 2027 and Global South 2026 (QT0003)
      const publishedOpps: Opportunity[] = [
        {
          id: "opp_icisn_2027",
          title: "Hội thảo quốc tế ICISN 2027",
          organizer: "Học viện Công nghệ Bưu chính Viễn thông (PTIT)",
          country: "Việt Nam",
          type: "Hội thảo",
          level: "Quốc tế",
          topic: "AI",
          field: "Chung Khoa MTCN",
          tags: ["ICISN"],
          deadline: "20/11/2026",
          fullPaperDeadline: "20/11/2026",
          suitability: "Phù hợp",
          content: "Nội dung ICISN",
          sourceType: "SPARK",
          status: "published",
          createdAt: "2026-10-07T00:00:00Z",
          updatedAt: "2026-10-07T00:00:00Z",
          createdBy: "tranquanghai@tdtu.edu.vn",
        },
        {
          id: "opp_global_south_2026",
          title: "Hội thảo quốc tế: “Shaping the Future of the Global South: Trends and Insights” (Hội thảo Nam bán cầu)",
          organizer: "Đại học Kinh tế Quốc dân (NEU), IEASA và Đại học SMU (Nam Phi)",
          country: "Nam Phi / Việt Nam",
          type: "Hội thảo",
          level: "Quốc tế",
          topic: "Nam bán cầu",
          field: "Chung Khoa MTCN",
          tags: ["Global South"],
          deadline: "Nhận bài thường xuyên",
          fullPaperDeadline: "Nhận bài thường xuyên",
          suitability: "Phù hợp",
          content: "Nội dung Global South",
          sourceType: "SPARK",
          status: "published",
          createdAt: "2026-10-07T01:41:19.661950Z",
          updatedAt: "2026-10-07T01:41:19.661950Z",
          createdBy: "tranquanghai@tdtu.edu.vn",
        },
      ];

      const mockSdk: any = {
        doc: (_db: any, col: string, id: string) => ({ col, id, path: `${col}/${id}` }),
        getDoc: async () => ({ exists: () => false, data: () => undefined }),
        setDoc: async () => {},
        collection: (_db: any, path: string) => ({ path }),
        getDocs: async (colRef: any) => {
          if (colRef.path === "opportunities") {
            return {
              docs: publishedOpps.map((o) => ({
                id: o.id,
                data: () => o,
              })),
            };
          }
          return { docs: [] };
        },
        addDoc: async () => ({ id: "cand_new" }),
        serverTimestamp: () => new Date().toISOString(),
      };

      try {
        const dryRunOutcome = await executeResearchSync({
          db: {},
          sdk: mockSdk,
          user: { uid: "u_admin", email: "admin@tdtu.edu.vn", role: "admin" },
          options: {
            dryRun: true,
            dataSource: "drive_json",
          },
        });

        expect(dryRunOutcome.skipped).toBe(false);
        expect(dryRunOutcome.stats?.read).toBe(3);
        expect(dryRunOutcome.stats?.created).toBe(1); // QT0001
        expect(dryRunOutcome.stats?.matched).toBe(2); // TN0001 and QT0003

        const items = dryRunOutcome.items || [];
        expect(items.length).toBe(3);

        // TN0001: matched to opp_icisn_2027
        const tnItem = items.find((i) => i.code === "TN0001");
        expect(tnItem).toBeDefined();
        expect(tnItem?.category).toBe("TN");
        expect(tnItem?.status).toBe("matched");
        expect(tnItem?.targetId).toBe("opp_icisn_2027");

        // QT0003: matched to opp_global_south_2026
        const qt3Item = items.find((i) => i.code === "QT0003");
        expect(qt3Item).toBeDefined();
        expect(qt3Item?.category).toBe("QT");
        expect(qt3Item?.status).toBe("matched");
        expect(qt3Item?.targetId).toBe("opp_global_south_2026");

        // QT0001: created as new international candidate
        const qt1Item = items.find((i) => i.code === "QT0001");
        expect(qt1Item).toBeDefined();
        expect(qt1Item?.category).toBe("QT");
        expect(qt1Item?.status).toBe("created");
        expect(qt1Item?.action).toBe("Tạo mới");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
