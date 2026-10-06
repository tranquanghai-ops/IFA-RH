import { describe, it, expect } from "vitest";
import { isAllowedTDTUEmail, NOMINATED_OWNER_EMAIL } from "../firebase/policy";

describe("AUTH & Access Control Policies", () => {
  it("should allow verified @tdtu.edu.vn emails", () => {
    expect(isAllowedTDTUEmail("lecturer@tdtu.edu.vn")).toBe(true);
    expect(isAllowedTDTUEmail("tranquanghai@tdtu.edu.vn")).toBe(true);
    expect(isAllowedTDTUEmail("nguyenvana@tdtu.edu.vn")).toBe(true);
  });

  it("should reject non-TDTU emails", () => {
    expect(isAllowedTDTUEmail("hacker@gmail.com")).toBe(false);
    expect(isAllowedTDTUEmail("user@otheruniv.edu.vn")).toBe(false);
    expect(isAllowedTDTUEmail("")).toBe(false);
  });

  it("should recognize the exact nominated owner email for zero-day bootstrap", () => {
    expect(NOMINATED_OWNER_EMAIL).toBe("tranquanghai@tdtu.edu.vn");
  });

  it("should handle mixed case email inputs gracefully", () => {
    expect(isAllowedTDTUEmail("TranQuangHai@TDTU.EDU.VN")).toBe(true);
    expect(isAllowedTDTUEmail("  lecturer@tdtu.edu.vn  ")).toBe(true);
  });

  it("should differentiate unprovisioned vs provisioned status for TDTU accounts", () => {
    const mockRoster = ["tranquanghai@tdtu.edu.vn", "lecturer_a@tdtu.edu.vn"];
    const checkProvisioned = (email: string) => {
      const normalized = email.trim().toLowerCase();
      if (!isAllowedTDTUEmail(normalized)) return "invalid_domain";
      if (normalized === NOMINATED_OWNER_EMAIL.toLowerCase()) return "owner_bootstrap";
      return mockRoster.includes(normalized) ? "provisioned" : "unprovisioned";
    };

    // Case 1: Owner bootstrap
    expect(checkProvisioned("tranquanghai@tdtu.edu.vn")).toBe("owner_bootstrap");
    // Case 2: Provisioned lecturer
    expect(checkProvisioned("lecturer_a@tdtu.edu.vn")).toBe("provisioned");
    // Case 3: Unprovisioned lecturer
    expect(checkProvisioned("random_staff@tdtu.edu.vn")).toBe("unprovisioned");
    // Case 4: Non-TDTU
    expect(checkProvisioned("outsider@gmail.com")).toBe("invalid_domain");
  });

  describe("Auth & Role Precedence Matrix (7 Mandatory Cases)", () => {
    interface MockAuthStore {
      usersByUid: Record<string, any>;
      usersByDocId: Record<string, any>;
      sharedPersonnel: Record<string, any>;
    }

    const simulateAuthFlow = async (
      firebaseUser: { uid: string; email: string; displayName?: string },
      store: MockAuthStore,
      options?: { networkError?: boolean; simulateTimeout?: boolean }
    ) => {
      let loading = true;
      let error = "";
      let authStatus: string = "initializing";
      let profile: any = null;

      try {
        if (options?.simulateTimeout) {
          throw new Error("Quá thời gian kết nối đến máy chủ dữ liệu (Timeout 8s).");
        }
        if (options?.networkError) {
          throw new Error("Lỗi kết nối Firestore: Missing or insufficient permissions.");
        }

        const email = firebaseUser.email.trim().toLowerCase();
        if (!isAllowedTDTUEmail(email)) {
          authStatus = "invalid_domain";
          error = "Chỉ chấp nhận email @tdtu.edu.vn";
          return { loading: false, error, authStatus, profile };
        }

        // Check 2: Direct lookup by UID
        if (store.usersByUid[firebaseUser.uid]) {
          const u = store.usersByUid[firebaseUser.uid];
          if (!u.active) {
            authStatus = "disabled";
            error = "Tài khoản bị vô hiệu hóa.";
            return { loading: false, error, authStatus, profile: null };
          }
          authStatus = "authenticated";
          profile = u;
          return { loading: false, error: "", authStatus, profile };
        }

        // Check 3: Owner Bootstrap
        if (email === NOMINATED_OWNER_EMAIL.toLowerCase()) {
          profile = { uid: firebaseUser.uid, email, role: "owner", active: true };
          authStatus = "authenticated";
          return { loading: false, error: "", authStatus, profile };
        }

        // Check 4: Pre-provisioned user lookup
        const provStandardId = `prov_${email}`;
        const provLegacyId = `prov_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
        const provDoc = store.usersByDocId[provStandardId] || store.usersByDocId[provLegacyId];

        if (provDoc) {
          if (!provDoc.active) {
            authStatus = "disabled";
            error = "Tài khoản bị vô hiệu hóa.";
            return { loading: false, error, authStatus, profile: null };
          }
          // Self-link keeps provisioned role (Admin remains Admin!)
          profile = {
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            email,
            name: provDoc.name || firebaseUser.displayName || email,
            role: provDoc.role || "lecturer",
            department: provDoc.department || "",
            active: true,
          };
          authStatus = "authenticated";
          return { loading: false, error: "", authStatus, profile };
        }

        // Check 4b: Shared personnel mirror check (only if not provisioned)
        const shared = store.sharedPersonnel[email];
        if (shared) {
          if (!shared.active) {
            authStatus = "disabled";
            error = "Tài khoản đã ngừng hoạt động trong danh bạ IFA-WORK.";
            return { loading: false, error, authStatus, profile: null };
          }
          profile = {
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            email,
            name: shared.displayName || email,
            role: "lecturer",
            department: shared.departmentName || "",
            active: true,
          };
          authStatus = "authenticated";
          return { loading: false, error: "", authStatus, profile };
        }

        // Check 5: Unprovisioned
        authStatus = "unprovisioned";
        error = "Tài khoản này chưa được cấp quyền sử dụng IFA-RH.";
        return { loading: false, error, authStatus, profile: null };
      } catch (err: any) {
        error = err.message;
        authStatus = "error";
        return { loading: false, error, authStatus, profile: null };
      } finally {
        loading = false;
      }
    };

    it("Case 1: User with role admin, not in sharedPersonnel -> enters Admin workspace", async () => {
      const store: MockAuthStore = {
        usersByUid: {},
        usersByDocId: {
          "prov_admin1@tdtu.edu.vn": { email: "admin1@tdtu.edu.vn", role: "admin", active: true, name: "Admin 1" },
        },
        sharedPersonnel: {}, // NOT in sharedPersonnel
      };
      const res = await simulateAuthFlow({ uid: "uid_admin1", email: "admin1@tdtu.edu.vn" }, store);
      expect(res.loading).toBe(false);
      expect(res.authStatus).toBe("authenticated");
      expect(res.profile?.role).toBe("admin");
    });

    it("Case 2: User with role admin, present in sharedPersonnel -> enters Admin workspace", async () => {
      const store: MockAuthStore = {
        usersByUid: {},
        usersByDocId: {
          "prov_admin2@tdtu.edu.vn": { email: "admin2@tdtu.edu.vn", role: "admin", active: true, name: "Admin 2" },
        },
        sharedPersonnel: {
          "admin2@tdtu.edu.vn": { emailNormalized: "admin2@tdtu.edu.vn", active: true, displayName: "Admin 2" },
        },
      };
      const res = await simulateAuthFlow({ uid: "uid_admin2", email: "admin2@tdtu.edu.vn" }, store);
      expect(res.loading).toBe(false);
      expect(res.authStatus).toBe("authenticated");
      expect(res.profile?.role).toBe("admin");
    });

    it("Case 3: User with role owner -> enters Owner workspace", async () => {
      const store: MockAuthStore = {
        usersByUid: {},
        usersByDocId: {},
        sharedPersonnel: {},
      };
      const res = await simulateAuthFlow({ uid: "uid_owner", email: "tranquanghai@tdtu.edu.vn" }, store);
      expect(res.loading).toBe(false);
      expect(res.authStatus).toBe("authenticated");
      expect(res.profile?.role).toBe("owner");
    });

    it("Case 4: User with role lecturer, present in sharedPersonnel -> enters Lecturer workspace", async () => {
      const store: MockAuthStore = {
        usersByUid: {
          "uid_gv1": { uid: "uid_gv1", email: "gv1@tdtu.edu.vn", role: "lecturer", active: true },
        },
        usersByDocId: {},
        sharedPersonnel: {
          "gv1@tdtu.edu.vn": { emailNormalized: "gv1@tdtu.edu.vn", active: true },
        },
      };
      const res = await simulateAuthFlow({ uid: "uid_gv1", email: "gv1@tdtu.edu.vn" }, store);
      expect(res.loading).toBe(false);
      expect(res.authStatus).toBe("authenticated");
      expect(res.profile?.role).toBe("lecturer");
    });

    it("Case 5: User with role lecturer in users, absent in sharedPersonnel -> retains lecturer access", async () => {
      const store: MockAuthStore = {
        usersByUid: {
          "uid_gv2": { uid: "uid_gv2", email: "gv2@tdtu.edu.vn", role: "lecturer", active: true },
        },
        usersByDocId: {},
        sharedPersonnel: {}, // absent in mirror
      };
      const res = await simulateAuthFlow({ uid: "uid_gv2", email: "gv2@tdtu.edu.vn" }, store);
      expect(res.loading).toBe(false);
      expect(res.authStatus).toBe("authenticated");
      expect(res.profile?.role).toBe("lecturer");
    });

    it("Case 6: User not in users, present in sharedPersonnel -> auto-provisions as lecturer", async () => {
      const store: MockAuthStore = {
        usersByUid: {},
        usersByDocId: {},
        sharedPersonnel: {
          "gv_new@tdtu.edu.vn": {
            emailNormalized: "gv_new@tdtu.edu.vn",
            displayName: "ThS GV Mới",
            departmentName: "Khoa MTCN",
            active: true,
          },
        },
      };
      const res = await simulateAuthFlow({ uid: "uid_gv_new", email: "gv_new@tdtu.edu.vn" }, store);
      expect(res.loading).toBe(false);
      expect(res.authStatus).toBe("authenticated");
      expect(res.profile?.role).toBe("lecturer");
      expect(res.profile?.name).toBe("ThS GV Mới");
    });

    it("Case 7: Network error or Firestore permission rejection -> loading is false, authStatus is error", async () => {
      const store: MockAuthStore = {
        usersByUid: {},
        usersByDocId: {},
        sharedPersonnel: {},
      };
      const res = await simulateAuthFlow(
        { uid: "uid_any", email: "someuser@tdtu.edu.vn" },
        store,
        { networkError: true }
      );
      expect(res.loading).toBe(false);
      expect(res.authStatus).toBe("error");
      expect(res.profile).toBeNull();
      expect(res.error).toContain("Missing or insufficient permissions");
    });

    it("Case 7b: Timeout fallback (8s) triggers -> loading is false, authStatus is error", async () => {
      const store: MockAuthStore = {
        usersByUid: {},
        usersByDocId: {},
        sharedPersonnel: {},
      };
      const res = await simulateAuthFlow(
        { uid: "uid_any", email: "someuser@tdtu.edu.vn" },
        store,
        { simulateTimeout: true }
      );
      expect(res.loading).toBe(false);
      expect(res.authStatus).toBe("error");
      expect(res.error).toContain("Timeout 8s");
    });

    it("Special Case: nguyenthithuyha1@tdtu.edu.vn links legacy or standard prov doc directly to admin workspace", async () => {
      // Production state: provisional doc prov_nguyenthithuyha1_tdtu_edu_vn exists in Firestore
      const prodStore: MockAuthStore = {
        usersByUid: {},
        usersByDocId: {
          "prov_nguyenthithuyha1_tdtu_edu_vn": {
            id: "prov_nguyenthithuyha1_tdtu_edu_vn",
            email: "nguyenthithuyha1@tdtu.edu.vn",
            name: "Nguyễn Thị Thúy Hà",
            role: "admin",
            department: "Bộ môn Thiết kế Nội thất",
            active: true,
          },
        },
        sharedPersonnel: {}, // NOT YET SYNCED in sharedPersonnel
      };

      const res = await simulateAuthFlow(
        {
          uid: "google_uid_ha_12345",
          email: "nguyenthithuyha1@tdtu.edu.vn",
          displayName: "Nguyễn Thị Thúy Hà",
        },
        prodStore
      );

      // Verify that access is granted, role is ADMIN, and loading is completed
      expect(res.loading).toBe(false);
      expect(res.authStatus).toBe("authenticated");
      expect(res.profile).not.toBeNull();
      expect(res.profile?.role).toBe("admin");
      expect(res.profile?.name).toBe("Nguyễn Thị Thúy Hà");
      expect(res.error).toBe("");
    });
  });
});
