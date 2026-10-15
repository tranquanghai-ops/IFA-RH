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

  describe("4. Distributed Lock Safety, TTL Expiration, and Finally Block Verification", () => {
    it("guarantees lock is released in finally block when an error occurs during sync", async () => {
      const store: Record<string, any> = {};
      const sdk: any = {
        doc: (_db: any, col: string, id: string) => ({ col, id, path: `${col}/${id}` }),
        runTransaction: async <T>(_db: any, fn: (tx: any) => Promise<T>): Promise<T> => {
          const stagedWrites: any[] = [];
          const tx = {
            get: async (ref: any) => ({
              exists: () => store[ref.path] !== undefined,
              data: () => store[ref.path],
            }),
            set: (ref: any, data: any, opts: any) => {
              stagedWrites.push({ key: ref.path, data, merge: opts?.merge });
            },
          };
          const res = await fn(tx);
          for (const w of stagedWrites) {
            store[w.key] = w.merge && store[w.key] ? { ...store[w.key], ...w.data } : w.data;
          }
          return res;
        },
        getDoc: async (ref: any) => ({
          exists: () => store[ref.path] !== undefined,
          data: () => store[ref.path],
        }),
        setDoc: async (ref: any, data: any, opts: any) => {
          store[ref.path] = opts?.merge && store[ref.path] ? { ...store[ref.path], ...data } : data;
        },
        collection: (_db: any, path: string) => ({ path }),
        getDocs: async (ref: any) => {
          if (ref.path === "opportunityCandidates") {
            throw new Error("Simulated network failure while fetching candidates");
          }
          return { docs: [] };
        },
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async () => ({
        ok: true,
        json: async () => ({
          files: [{ id: "f1", name: "IFA_RH_CONFERENCES.json" }],
        }),
        text: async () =>
          JSON.stringify({
            schemaVersion: 1,
            revision: 1,
            runId: "20261015-01",
            generatedAt: "2026-10-15T00:00:00Z",
            conferences: [
              {
                code: "QT0001",
                category: "QT",
                title: "Hội thảo quốc tế HAXD 2027",
                organizer: "IEEE",
                country: "Ý",
                content: "Content",
              },
            ],
          }),
      }));

      try {
        await expect(
          executeResearchSync({
            db: {},
            sdk,
            user: { uid: "u_admin", email: "admin@tdtu.edu.vn", role: "admin" },
            options: { dryRun: false, dataSource: "drive_json" },
          })
        ).rejects.toThrow();

        // Lock must be released by finally block
        const lockDoc = store[`systemConfig/${RESEARCH_SYNC_LOCK_DOC_ID}`];
        expect(lockDoc).toBeDefined();
        expect(lockDoc.isLocked).toBe(false);
        expect(lockDoc.lockId).toBe("");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("aborts writes and throws LOCK_EXPIRED if sync duration exceeds TTL 5 minutes before writing", async () => {
      const store: Record<string, any> = {};
      const sdk: any = {
        doc: (_db: any, col: string, id: string) => ({ col, id, path: `${col}/${id}` }),
        runTransaction: async <T>(_db: any, fn: (tx: any) => Promise<T>): Promise<T> => {
          const stagedWrites: any[] = [];
          const tx = {
            get: async (ref: any) => ({
              exists: () => store[ref.path] !== undefined,
              data: () => store[ref.path],
            }),
            set: (ref: any, data: any, opts: any) => {
              stagedWrites.push({ key: ref.path, data, merge: opts?.merge });
            },
          };
          const res = await fn(tx);
          for (const w of stagedWrites) {
            store[w.key] = w.merge && store[w.key] ? { ...store[w.key], ...w.data } : w.data;
          }
          return res;
        },
        getDoc: async (ref: any) => ({
          exists: () => store[ref.path] !== undefined,
          data: () => store[ref.path],
        }),
        setDoc: async (ref: any, data: any, opts: any) => {
          store[ref.path] = opts?.merge && store[ref.path] ? { ...store[ref.path], ...data } : data;
        },
        collection: (_db: any, path: string) => ({ path }),
        getDocs: async () => ({ docs: [] }),
        addDoc: vi.fn(),
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async () => ({
        ok: true,
        json: async () => ({
          files: [{ id: "f1", name: "IFA_RH_CONFERENCES.json" }],
        }),
        text: async () =>
          JSON.stringify({
            schemaVersion: 1,
            revision: 1,
            runId: "20261015-01",
            generatedAt: "2026-10-15T00:00:00Z",
            conferences: [
              {
                code: "QT0001",
                category: "QT",
                title: "Hội thảo quốc tế HAXD 2027",
                organizer: "IEEE",
                country: "Ý",
                content: "Content",
              },
            ],
          }),
      }));

      // Mock Date.now to simulate a delay of 6 minutes (360,000ms) between start and pre-write
      const realNow = Date.now;
      let callCount = 0;
      vi.spyOn(Date, "now").mockImplementation(() => {
        callCount++;
        // Start time = 1,000,000; pre-write check = 1,000,000 + 360,000
        return callCount === 1 ? 1000000 : 1360000;
      });

      try {
        await expect(
          executeResearchSync({
            db: {},
            sdk,
            user: { uid: "u_admin", email: "admin@tdtu.edu.vn", role: "admin" },
            options: { dryRun: false, dataSource: "drive_json" },
          })
        ).rejects.toThrow("Phiên đồng bộ đã vượt quá giới hạn thời gian (TTL 5 phút)");

        // Assert zero documents written
        expect(sdk.addDoc).not.toHaveBeenCalled();
      } finally {
        vi.restoreAllMocks();
        Date.now = realNow;
        globalThis.fetch = originalFetch;
      }
    });

    it("aborts writes and throws LOCK_LOST if lock was reclaimed by another session, preserving the other session lock", async () => {
      const store: Record<string, any> = {};
      let hasSwappedLock = false;

      const sdk: any = {
        doc: (_db: any, col: string, id: string) => ({ col, id, path: `${col}/${id}` }),
        runTransaction: async <T>(_db: any, fn: (tx: any) => Promise<T>): Promise<T> => {
          const stagedWrites: any[] = [];
          const tx = {
            get: async (ref: any) => ({
              exists: () => store[ref.path] !== undefined,
              data: () => store[ref.path],
            }),
            set: (ref: any, data: any, opts: any) => {
              stagedWrites.push({ key: ref.path, data, merge: opts?.merge });
            },
          };
          const res = await fn(tx);
          for (const w of stagedWrites) {
            store[w.key] = w.merge && store[w.key] ? { ...store[w.key], ...w.data } : w.data;
          }
          return res;
        },
        getDoc: async (ref: any) => {
          // If checking lockDoc during pre-write, simulate that another session claimed it
          if (ref.path === `systemConfig/${RESEARCH_SYNC_LOCK_DOC_ID}` && hasSwappedLock) {
            return {
              exists: () => true,
              data: () => ({
                isLocked: true,
                lockId: "lock_other_admin_new_session",
                lockedBy: "admin_b@tdtu.edu.vn",
              }),
            };
          }
          return {
            exists: () => store[ref.path] !== undefined,
            data: () => store[ref.path],
          };
        },
        setDoc: async (ref: any, data: any, opts: any) => {
          store[ref.path] = opts?.merge && store[ref.path] ? { ...store[ref.path], ...data } : data;
        },
        collection: (_db: any, path: string) => ({ path }),
        getDocs: async () => {
          // Right after fetching docs, another session claims the lock
          hasSwappedLock = true;
          store[`systemConfig/${RESEARCH_SYNC_LOCK_DOC_ID}`] = {
            isLocked: true,
            lockId: "lock_other_admin_new_session",
            lockedBy: "admin_b@tdtu.edu.vn",
          };
          return { docs: [] };
        },
        addDoc: vi.fn(),
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async () => ({
        ok: true,
        json: async () => ({
          files: [{ id: "f1", name: "IFA_RH_CONFERENCES.json" }],
        }),
        text: async () =>
          JSON.stringify({
            schemaVersion: 1,
            revision: 1,
            runId: "20261015-01",
            generatedAt: "2026-10-15T00:00:00Z",
            conferences: [
              {
                code: "QT0001",
                category: "QT",
                title: "Hội thảo quốc tế HAXD 2027",
                organizer: "IEEE",
                country: "Ý",
                content: "Content",
              },
            ],
          }),
      }));

      try {
        await expect(
          executeResearchSync({
            db: {},
            sdk,
            user: { uid: "u_admin_a", email: "admin_a@tdtu.edu.vn", role: "admin" },
            options: { dryRun: false, dataSource: "drive_json" },
          })
        ).rejects.toThrow("Khóa phiên đồng bộ đã bị chiếm bởi phiên khác (admin_b@tdtu.edu.vn)");

        // Assert zero documents written by Session A
        expect(sdk.addDoc).not.toHaveBeenCalled();

        // And Session A's finally block did NOT release Session B's lock!
        const lockDoc = store[`systemConfig/${RESEARCH_SYNC_LOCK_DOC_ID}`];
        expect(lockDoc.isLocked).toBe(true);
        expect(lockDoc.lockId).toBe("lock_other_admin_new_session");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("aborts writes and throws LOCK_LOST if lock document cannot be read (getDoc throws)", async () => {
      let isInitialAcquisitionDone = false;
      const store: Record<string, any> = {};

      const sdk: any = {
        doc: (_db: any, col: string, id: string) => ({ col, id, path: `${col}/${id}` }),
        runTransaction: async <T>(_db: any, fn: (tx: any) => Promise<T>): Promise<T> => {
          const tx = {
            get: async (ref: any) => ({
              exists: () => store[ref.path] !== undefined,
              data: () => store[ref.path],
            }),
            set: (ref: any, data: any) => {
              store[ref.path] = data;
            },
          };
          return await fn(tx);
        },
        getDoc: async (ref: any) => {
          if (ref.path === `systemConfig/${RESEARCH_SYNC_LOCK_DOC_ID}` && isInitialAcquisitionDone) {
            throw new Error("Network timeout or Firestore connection reset");
          }
          return { exists: () => store[ref.path] !== undefined, data: () => store[ref.path] };
        },
        setDoc: async (ref: any, data: any) => {
          store[ref.path] = data;
        },
        collection: (_db: any, path: string) => ({ path }),
        getDocs: async () => {
          isInitialAcquisitionDone = true;
          return { docs: [] };
        },
        addDoc: vi.fn(),
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async () => ({
        ok: true,
        json: async () => ({ files: [{ id: "f1", name: "IFA_RH_CONFERENCES.json" }] }),
        text: async () => JSON.stringify({ schemaVersion: 1, revision: 1, runId: "1", conferences: [{ code: "QT0001", category: "QT", title: "Hội thảo quốc tế HAXD 2027", organizer: "IEEE", country: "Ý", content: "Content" }] }),
      }));

      try {
        await expect(
          executeResearchSync({
            db: {},
            sdk,
            user: { uid: "u_admin", email: "admin@tdtu.edu.vn", role: "admin" },
            options: { dryRun: false, dataSource: "drive_json" },
          })
        ).rejects.toThrow("Không thể đọc tài liệu khóa để xác minh trước khi ghi");

        expect(sdk.addDoc).not.toHaveBeenCalled();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("aborts writes and throws LOCK_LOST if lock document was deleted or already released (!isLocked)", async () => {
      let isInitialAcquisitionDone = false;
      const store: Record<string, any> = {};

      const sdk: any = {
        doc: (_db: any, col: string, id: string) => ({ col, id, path: `${col}/${id}` }),
        runTransaction: async <T>(_db: any, fn: (tx: any) => Promise<T>): Promise<T> => {
          const tx = {
            get: async (ref: any) => ({ exists: () => store[ref.path] !== undefined, data: () => store[ref.path] }),
            set: (ref: any, data: any) => { store[ref.path] = data; },
          };
          return await fn(tx);
        },
        getDoc: async (ref: any) => {
          if (ref.path === `systemConfig/${RESEARCH_SYNC_LOCK_DOC_ID}` && isInitialAcquisitionDone) {
            return { exists: () => true, data: () => ({ isLocked: false }) };
          }
          return { exists: () => store[ref.path] !== undefined, data: () => store[ref.path] };
        },
        setDoc: async (ref: any, data: any) => { store[ref.path] = data; },
        collection: (_db: any, path: string) => ({ path }),
        getDocs: async () => {
          isInitialAcquisitionDone = true;
          return { docs: [] };
        },
        addDoc: vi.fn(),
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async () => ({
        ok: true,
        json: async () => ({ files: [{ id: "f1", name: "IFA_RH_CONFERENCES.json" }] }),
        text: async () => JSON.stringify({ schemaVersion: 1, revision: 1, runId: "1", conferences: [{ code: "QT0001", category: "QT", title: "Hội thảo quốc tế HAXD 2027", organizer: "IEEE", country: "Ý", content: "Content" }] }),
      }));

      try {
        await expect(
          executeResearchSync({
            db: {},
            sdk,
            user: { uid: "u_admin", email: "admin@tdtu.edu.vn", role: "admin" },
            options: { dryRun: false, dataSource: "drive_json" },
          })
        ).rejects.toThrow("Khóa đồng bộ đã bị giải phóng hoặc bị hủy bởi hệ thống");

        expect(sdk.addDoc).not.toHaveBeenCalled();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("verifies two concurrent sync sessions: Session 1 holds lock, Session 2 is skipped; then Session 2 can run after Session 1 completes", async () => {
      const store: Record<string, any> = {};

      const sdk: any = {
        doc: (_db: any, col: string, id: string) => ({ col, id, path: `${col}/${id}` }),
        runTransaction: async <T>(_db: any, fn: (tx: any) => Promise<T>): Promise<T> => {
          const stagedWrites: any[] = [];
          const tx = {
            get: async (ref: any) => ({
              exists: () => store[ref.path] !== undefined,
              data: () => store[ref.path],
            }),
            set: (ref: any, data: any, opts: any) => {
              stagedWrites.push({ key: ref.path, data, merge: opts?.merge });
            },
          };
          const res = await fn(tx);
          for (const w of stagedWrites) {
            store[w.key] = w.merge && store[w.key] ? { ...store[w.key], ...w.data } : w.data;
          }
          return res;
        },
        getDoc: async (ref: any) => ({
          exists: () => store[ref.path] !== undefined,
          data: () => store[ref.path],
        }),
        setDoc: async (ref: any, data: any, opts: any) => {
          store[ref.path] = opts?.merge && store[ref.path] ? { ...store[ref.path], ...data } : data;
        },
        updateDoc: async (ref: any, data: any) => {
          store[ref.path] = { ...store[ref.path], ...data };
        },
        collection: (_db: any, path: string) => ({ path }),
        getDocs: async () => ({ docs: [] }),
        addDoc: async (colRef: any, data: any) => {
          const id = `cand_${Object.keys(store).length + 1}`;
          store[`${colRef.path}/${id}`] = { id, ...data };
          return { id };
        },
        serverTimestamp: () => new Date().toISOString(),
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async () => ({
        ok: true,
        json: async () => ({ files: [{ id: "f1", name: "IFA_RH_CONFERENCES.json" }] }),
        text: async () => JSON.stringify({ schemaVersion: 1, revision: 1, runId: "1", conferences: [{ code: "QT0001", category: "QT", title: "Hội thảo quốc tế HAXD 2027", organizer: "IEEE", country: "Ý", content: "Content" }] }),
      }));

      try {
        // Step 1: Session 1 acquires lock
        const lock1 = await acquireFirestoreSyncLock({}, sdk, { email: "admin1@tdtu.edu.vn", uid: "u1" });
        expect(lock1.acquired).toBe(true);

        // Step 2: Session 2 tries to run while Session 1 is active
        const session2Outcome = await executeResearchSync({
          db: {},
          sdk,
          user: { uid: "u2", email: "admin2@tdtu.edu.vn", role: "admin" },
          options: { dryRun: false, dataSource: "drive_json" },
        });

        // Session 2 is cleanly skipped with lock message
        expect(session2Outcome.skipped).toBe(true);
        expect(session2Outcome.reason).toContain("Một phiên đồng bộ khác đang chạy");

        // Step 3: Session 1 finishes and releases lock
        const release1 = await releaseFirestoreSyncLock({}, sdk, lock1.lockId);
        expect(release1.released).toBe(true);

        // Step 4: Session 2 can now run successfully
        const session2Success = await executeResearchSync({
          db: {},
          sdk,
          user: { uid: "u2", email: "admin2@tdtu.edu.vn", role: "admin" },
          options: { dryRun: false, dataSource: "drive_json" },
        });

        expect(session2Success.skipped).toBe(false);
        expect(session2Success.stats?.created).toBe(1);
        expect(session2Success.stats?.conferenceWrites).toBe(1);
        expect(session2Success.stats?.systemWrites).toBe(2);

        // Lock is released after Session 2 finishes
        const lockDoc = store[`systemConfig/${RESEARCH_SYNC_LOCK_DOC_ID}`];
        expect(lockDoc.isLocked).toBe(false);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("5. Complete Initial Sync Lifecycle Simulation (Production Equivalent)", () => {
    it("runs dry-run (0 writes), first live sync (2 created QT + 1 update proposal), and idempotent second sync (0 duplicates)", async () => {
      // 10 conferences matching Spark official JSON
      const mock10Conferences = [
        { code: "TN0001", category: "TN", title: "Hội thảo IETBHEC 2027", organizer: "ĐH Đà Nẵng", country: "Việt Nam", content: "C1" },
        { code: "TN0002", category: "TN", title: "Hội thảo CELG 2026", organizer: "UEH-CELG", country: "Việt Nam", content: "C2" },
        { code: "TN0003", category: "TN", title: "Hội thảo 9th CIEMB 2026", organizer: "NEU", country: "Việt Nam", content: "C3" },
        { code: "TN0004", category: "TN", title: "Hội thảo LETJ 2027", organizer: "NEU", country: "Việt Nam", content: "C4" },
        { code: "TN0005", category: "TN", title: "Hội thảo ICISN 2027", organizer: "ĐH Hải Dương", country: "Việt Nam", content: "C5" },
        { code: "TN0006", category: "TN", title: "Hội thảo Đương đại trong phát triển", organizer: "NEU", country: "Việt Nam", content: "C6" },
        { code: "TN0007", category: "TN", title: "Hội thảo RTD 2026 FutureScape", organizer: "UEH", country: "Việt Nam", content: "C7" },
        { code: "QT0001", category: "QT", title: "Hội thảo quốc tế HAXD 2027", organizer: "IEEE Italy Section", country: "Ý", lastUpdated: "2026-10-12", content: "C8" },
        { code: "QT0002", category: "QT", title: "Hội thảo quốc tế EvoMUSART 2027", organizer: "SPECIES Society", country: "Đức", lastUpdated: "2026-10-08", content: "C9" },
        { code: "QT0003", category: "QT", title: "Hội thảo quốc tế Shaping the Future of the Global South", organizer: "NEU, IEASA & SMU", country: "Nam Phi / Việt Nam", location: "Pretoria (Updated)", content: "C10" },
      ];

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async () => ({
        ok: true,
        json: async () => ({ files: [{ id: "f_official", name: "IFA_RH_CONFERENCES.json" }] }),
        text: async () =>
          JSON.stringify({
            schemaVersion: 1,
            revision: 1,
            runId: "20261015-01",
            generatedAt: "2026-10-15T00:00:00Z",
            conferences: mock10Conferences,
          }),
      }));

      // In-memory Firestore store seeded with production state: 8 published opportunities + 7 pending TN update proposals
      const store: Record<string, any> = {};

      // Seed 8 published opportunities (7 TN + 1 QT)
      const publishedOpps: Opportunity[] = [
        { id: "opp_ietbhec_2027", title: "Hội thảo IETBHEC 2027", organizer: "ĐH Đà Nẵng", country: "Việt Nam", type: "Hội thảo", level: "Quốc tế", topic: "T", field: "F", tags: [], deadline: "2027-02-25", suitability: "Phù hợp", content: "C1", sourceType: "SPARK", status: "published", createdAt: "2026-10-07T00:00:00Z", updatedAt: "2026-10-07T00:00:00Z", createdBy: "admin" },
        { id: "opp_celg_2026", title: "Hội thảo CELG 2026", organizer: "UEH-CELG", country: "Việt Nam", type: "Hội thảo", level: "Quốc gia", topic: "T", field: "F", tags: [], deadline: "2026-11-15", suitability: "Phù hợp", content: "C2", sourceType: "SPARK", status: "published", createdAt: "2026-10-07T00:00:00Z", updatedAt: "2026-10-07T00:00:00Z", createdBy: "admin" },
        { id: "opp_ciemb_2026", title: "Hội thảo 9th CIEMB 2026", organizer: "NEU", country: "Việt Nam", type: "Hội thảo", level: "Quốc tế", topic: "T", field: "F", tags: [], deadline: "2026-11-20", suitability: "Phù hợp", content: "C3", sourceType: "SPARK", status: "published", createdAt: "2026-10-07T00:00:00Z", updatedAt: "2026-10-07T00:00:00Z", createdBy: "admin" },
        { id: "opp_letj_2027", title: "Hội thảo LETJ 2027", organizer: "NEU", country: "Việt Nam", type: "Hội thảo", level: "Quốc tế", topic: "T", field: "F", tags: [], deadline: "2027-01-15", suitability: "Phù hợp", content: "C4", sourceType: "SPARK", status: "published", createdAt: "2026-10-07T00:00:00Z", updatedAt: "2026-10-07T00:00:00Z", createdBy: "admin" },
        { id: "opp_icisn_2027", title: "Hội thảo ICISN 2027", organizer: "ĐH Hải Dương", country: "Việt Nam", type: "Hội thảo", level: "Quốc tế", topic: "T", field: "F", tags: [], deadline: "2027-02-10", suitability: "Phù hợp", content: "C5", sourceType: "SPARK", status: "published", createdAt: "2026-10-07T00:00:00Z", updatedAt: "2026-10-07T00:00:00Z", createdBy: "admin" },
        { id: "opp_neu_duongdai_2026", title: "Hội thảo Đương đại trong phát triển", organizer: "NEU", country: "Việt Nam", type: "Hội thảo", level: "Quốc gia", topic: "T", field: "F", tags: [], deadline: "2026-11-30", suitability: "Phù hợp", content: "C6", sourceType: "SPARK", status: "published", createdAt: "2026-10-07T00:00:00Z", updatedAt: "2026-10-07T00:00:00Z", createdBy: "admin" },
        { id: "opp_rtd_2026", title: "Hội thảo RTD 2026 FutureScape", organizer: "UEH", country: "Việt Nam", type: "Hội thảo", level: "Quốc tế", topic: "T", field: "F", tags: [], deadline: "2026-12-01", suitability: "Phù hợp", content: "C7", sourceType: "SPARK", status: "published", createdAt: "2026-10-07T00:00:00Z", updatedAt: "2026-10-07T00:00:00Z", createdBy: "admin" },
        { id: "opp_global_south_2026", title: "Hội thảo quốc tế Shaping the Future of the Global South", organizer: "NEU, IEASA & SMU", country: "Nam Phi / Việt Nam", type: "Hội thảo", level: "Quốc tế", topic: "T", field: "F", tags: [], deadline: "2026-10-16", suitability: "Phù hợp", location: "Pretoria", content: "C10", sourceType: "SPARK", status: "published", createdAt: "2026-10-07T01:41:19Z", updatedAt: "2026-10-07T01:41:19Z", createdBy: "tranquanghai@tdtu.edu.vn" },
      ];

      for (const opp of publishedOpps) {
        store[`opportunities/${opp.id}`] = opp;
      }

      // Seed 7 pending TN update proposals (matching existing proposals from previous sync)
      const proposalIds = [
        "cand_upd_opp_ietbhec_2027", "cand_upd_opp_celg_2026", "cand_upd_opp_ciemb_2026",
        "cand_upd_opp_letj_2027", "cand_upd_opp_icisn_2027", "cand_upd_opp_neu_duongdai_2026",
        "cand_upd_opp_rtd_2026"
      ];
      for (let i = 0; i < 7; i++) {
        const pubOpp = publishedOpps[i];
        const propId = proposalIds[i];
        store[`opportunityCandidates/${propId}`] = {
          id: propId,
          title: pubOpp.title,
          organizer: pubOpp.organizer,
          country: pubOpp.country,
          type: pubOpp.type,
          level: pubOpp.level,
          status: "rejected",
          resolutionType: "AUTO_CLOSED",
          rejectionReason: "Đồng bộ chuẩn hóa: Dữ liệu Google Sheets và hội thảo đã công bố đã hoàn toàn trùng khớp, không có thay đổi thực tế.",
          changeType: "update",
          publishedOpportunityId: pubOpp.id,
          sourceType: "SPARK",
          conferenceCode: `TN000${i + 1}`,
          category: "TN",
          normalizedTitle: pubOpp.title.toLowerCase(),
          createdAt: "2026-10-14T00:00:00Z",
          updatedAt: "2026-10-14T00:00:00Z",
        };
      }

      // Create full transactional mock SDK
      const sdk: any = {
        doc: (_db: any, col: string, id: string) => ({ col, id, path: `${col}/${id}` }),
        runTransaction: async <T>(_db: any, fn: (tx: any) => Promise<T>): Promise<T> => {
          const stagedWrites: any[] = [];
          const tx = {
            get: async (ref: any) => ({
              exists: () => store[ref.path] !== undefined,
              data: () => store[ref.path],
            }),
            set: (ref: any, data: any, opts: any) => {
              stagedWrites.push({ key: ref.path, data, merge: opts?.merge });
            },
          };
          const res = await fn(tx);
          for (const w of stagedWrites) {
            store[w.key] = w.merge && store[w.key] ? { ...store[w.key], ...w.data } : w.data;
          }
          return res;
        },
        getDoc: async (ref: any) => ({
          exists: () => store[ref.path] !== undefined,
          data: () => store[ref.path],
        }),
        setDoc: async (ref: any, data: any, opts: any) => {
          store[ref.path] = opts?.merge && store[ref.path] ? { ...store[ref.path], ...data } : data;
        },
        updateDoc: async (ref: any, data: any) => {
          store[ref.path] = { ...store[ref.path], ...data };
        },
        collection: (_db: any, path: string) => ({ path }),
        getDocs: async (colRef: any) => {
          const prefix = `${colRef.path}/`;
          const docs = Object.keys(store)
            .filter((k) => k.startsWith(prefix))
            .map((k) => ({
              id: k.replace(prefix, ""),
              data: () => store[k],
            }));
          return { docs, size: docs.length };
        },
        addDoc: async (colRef: any, data: any) => {
          const autoId = `cand_auto_${Object.keys(store).length + 1}`;
          store[`${colRef.path}/${autoId}`] = { id: autoId, ...data };
          return { id: autoId };
        },
        serverTimestamp: () => new Date().toISOString(),
      };

      try {
        // --- PHASE 1: Dry-Run ---
        const initialDocCount = Object.keys(store).length;
        const dryRunOutcome = await executeResearchSync({
          db: {},
          sdk,
          user: { uid: "u_admin", email: "tranquanghai@tdtu.edu.vn", role: "admin" },
          options: { dryRun: true, dataSource: "drive_json" },
        });

        expect(dryRunOutcome.skipped).toBe(false);
        expect(dryRunOutcome.stats?.read).toBe(10);
        expect(dryRunOutcome.stats?.created).toBe(2); // QT0001, QT0002
        expect(dryRunOutcome.stats?.updateProposals).toBe(1); // QT0003
        expect(dryRunOutcome.stats?.unchanged).toBe(7); // 7 TN proposals unchanged
        expect(dryRunOutcome.stats?.successWrites).toBe(0);
        // Absolute verification: Dry run committed 0 writes to store
        expect(Object.keys(store).length).toBe(initialDocCount);

        // --- PHASE 2: First Real Sync ---
        const firstSyncOutcome = await executeResearchSync({
          db: {},
          sdk,
          user: { uid: "u_admin", email: "tranquanghai@tdtu.edu.vn", role: "admin" },
          options: { dryRun: false, dataSource: "drive_json" },
        });

        expect(firstSyncOutcome.skipped).toBe(false);
        expect(firstSyncOutcome.stats?.read).toBe(10);
        expect(firstSyncOutcome.stats?.created).toBe(2); // QT0001, QT0002
        expect(firstSyncOutcome.stats?.updateProposals).toBe(1); // QT0003 proposal
        expect(firstSyncOutcome.stats?.unchanged).toBe(7); // 7 TN proposals unchanged (0 writes)
        expect(firstSyncOutcome.stats?.successWrites).toBe(3); // 2 created + 1 proposal

        // Verify exactly 10 candidates exist in store (7 TN + 2 new QT + 1 QT0003 proposal)
        const allCandidates = Object.keys(store)
          .filter((k) => k.startsWith("opportunityCandidates/"))
          .map((k) => store[k]);
        expect(allCandidates.length).toBe(10);

        // Verify QT0001 created
        const candQt1 = allCandidates.find((c) => c.conferenceCode === "QT0001");
        expect(candQt1).toBeDefined();
        expect(candQt1.status).toBe("pending");
        expect(candQt1.changeType).toBe("create");
        expect(candQt1.category).toBe("QT");
        expect(candQt1.lastUpdated).toBe("2026-10-12");

        // Verify QT0002 created
        const candQt2 = allCandidates.find((c) => c.conferenceCode === "QT0002");
        expect(candQt2).toBeDefined();
        expect(candQt2.status).toBe("pending");
        expect(candQt2.changeType).toBe("create");
        expect(candQt2.category).toBe("QT");
        expect(candQt2.lastUpdated).toBe("2026-10-08");

        // Verify QT0003 update proposal created
        const candQt3 = allCandidates.find((c) => c.conferenceCode === "QT0003");
        expect(candQt3).toBeDefined();
        expect(candQt3.status).toBe("pending");
        expect(candQt3.changeType).toBe("update");
        expect(candQt3.publishedOpportunityId).toBe("opp_global_south_2026");

        // Verify 8 published opportunities were completely untouched
        for (const opp of publishedOpps) {
          const storedOpp = store[`opportunities/${opp.id}`];
          expect(storedOpp).toBeDefined();
          expect(storedOpp.status).toBe("published");
          expect(storedOpp.title).toBe(opp.title);
        }

        // Verify lock is released
        const lockDoc = store[`systemConfig/${RESEARCH_SYNC_LOCK_DOC_ID}`];
        expect(lockDoc?.isLocked).toBe(false);

        // --- PHASE 3: Second Real Sync (Idempotent, Same Revision) ---
        const secondSyncOutcome = await executeResearchSync({
          db: {},
          sdk,
          user: { uid: "u_admin", email: "tranquanghai@tdtu.edu.vn", role: "admin" },
          options: { dryRun: false, dataSource: "drive_json" },
        });

        expect(secondSyncOutcome.skipped).toBe(false);
        expect(secondSyncOutcome.stats?.read).toBe(10);
        expect(secondSyncOutcome.stats?.created).toBe(0); // 0 new created!
        expect(secondSyncOutcome.stats?.updateProposals).toBe(0); // 0 new proposals!
        expect(secondSyncOutcome.stats?.unchanged).toBe(10); // All 10 unchanged!
        expect(secondSyncOutcome.stats?.successWrites).toBe(0); // 0 writes!

        // Total candidates strictly preserved at 10, no duplicate documents generated!
        const finalCandidates = Object.keys(store)
          .filter((k) => k.startsWith("opportunityCandidates/"))
          .map((k) => store[k]);
        expect(finalCandidates.length).toBe(10);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});

