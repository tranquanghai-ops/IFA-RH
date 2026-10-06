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
});
