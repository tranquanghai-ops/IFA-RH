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
});
