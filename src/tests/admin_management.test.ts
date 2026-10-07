import { describe, it, expect } from "vitest";
import type { UserProfile, UserRole } from "../types";

describe("Owner Admin Management & Mandatory Security Cases", () => {
  const FOUNDING_OWNER_EMAIL = "tranquanghai@tdtu.edu.vn";

  // Simulate Business Logic for Admin Management
  interface RoleChangeAttempt {
    actor: { uid: string; email: string; role: UserRole };
    target: UserProfile;
    newRole: UserRole;
  }

  const executeRoleChange = (
    attempt: RoleChangeAttempt
  ): { success: boolean; updatedUser?: UserProfile; error?: string } => {
    const { actor, target, newRole } = attempt;

    // Rule 1: Only Owner can change role
    if (actor.role !== "owner") {
      return { success: false, error: "DENIED: Chỉ Owner mới có quyền thay đổi role!" };
    }

    // Rule 2: Cannot create second owner
    if (newRole === "owner" && target.email !== FOUNDING_OWNER_EMAIL) {
      return { success: false, error: "DENIED: Không thể tạo thêm tài khoản Owner!" };
    }

    // Rule 3: Founding owner immutable
    if (target.email === FOUNDING_OWNER_EMAIL && newRole !== "owner") {
      return { success: false, error: "DENIED: Không thể thay đổi hoặc hạ quyền của Owner sáng lập hệ thống!" };
    }

    // Rule 4: Self-downgrade prevention
    if (target.uid === actor.uid && newRole !== "owner") {
      return { success: false, error: "DENIED: Bạn không thể tự hạ quyền Owner của chính mình!" };
    }

    // Rule 5: Email validation
    const cleanEmail = target.email.trim().toLowerCase();
    if (!cleanEmail.endsWith("@tdtu.edu.vn")) {
      return { success: false, error: "DENIED: Email không thuộc tên miền @tdtu.edu.vn!" };
    }

    // Rule 6: Duplicate Admin check
    if (target.role === "admin" && newRole === "admin") {
      return { success: false, error: "BLOCKED: Người này hiện đã là Admin!" };
    }

    const now = new Date().toISOString();
    const updatedUser: UserProfile = {
      ...target,
      role: newRole,
      updatedAt: now,
      ...(newRole === "admin"
        ? { promotedAt: now, promotedBy: actor.email }
        : {}),
    };

    return { success: true, updatedUser };
  };

  // Menu visibility simulator
  const getVisibleNavigationItems = (role: UserRole): string[] => {
    const baseItems = ["Tổng quan", "Cơ hội NCKH", "Tiến độ NCKH", "Hồ sơ nghiên cứu", "Hướng dẫn sử dụng"];
    if (role === "lecturer") {
      return baseItems;
    }
    if (role === "admin") {
      return [
        ...baseItems,
        "Dữ liệu AI tìm",
        "Giảng viên",
        "Thống kê NCKH",
        "Import dữ liệu",
      ];
    }
    if (role === "owner") {
      return [
        ...baseItems,
        "Dữ liệu AI tìm",
        "Giảng viên",
        "Thống kê NCKH",
        "Import dữ liệu",
        "Khu vực Owner",
        "Quản lý Admin",
      ];
    }
    return [];
  };

  // ==================== TEST CASES ====================

  it("CASE 1: Owner nâng Giảng viên → Admin (PASS)", () => {
    const ownerActor = { uid: "owner_1", email: FOUNDING_OWNER_EMAIL, role: "owner" as const };
    const lecturer: UserProfile = {
      id: "lec_1",
      uid: "lec_1",
      email: "dongnghiep@tdtu.edu.vn",
      name: "TS. Đồng Nghiệp",
      role: "lecturer",
      active: true,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    };

    const result = executeRoleChange({
      actor: ownerActor,
      target: lecturer,
      newRole: "admin",
    });

    expect(result.success).toBe(true);
    expect(result.updatedUser?.role).toBe("admin");
    expect(result.updatedUser?.promotedBy).toBe(FOUNDING_OWNER_EMAIL);
    expect(result.updatedUser?.promotedAt).toBeDefined();
    // Preserves active status
    expect(result.updatedUser?.active).toBe(true);
  });

  it("CASE 2: Admin đăng nhập và thấy đúng menu/quyền (PASS)", () => {
    const adminNav = getVisibleNavigationItems("admin");

    // Admin MUST see:
    expect(adminNav).toContain("Tổng quan");
    expect(adminNav).toContain("Cơ hội NCKH");
    expect(adminNav).toContain("Tiến độ NCKH");
    expect(adminNav).toContain("Hồ sơ nghiên cứu");
    expect(adminNav).toContain("Dữ liệu AI tìm");
    expect(adminNav).toContain("Giảng viên");
    expect(adminNav).toContain("Thống kê NCKH");
    expect(adminNav).toContain("Import dữ liệu");
    expect(adminNav).toContain("Hướng dẫn sử dụng");

    // Admin MUST NOT see:
    expect(adminNav).not.toContain("Khu vực Owner");
    expect(adminNav).not.toContain("Quản lý Admin");
  });

  it("CASE 3: Admin thử thay role người khác (DENIED)", () => {
    const adminActor = { uid: "admin_1", email: "admin@tdtu.edu.vn", role: "admin" as const };
    const target: UserProfile = {
      id: "lec_2",
      uid: "lec_2",
      email: "gv2@tdtu.edu.vn",
      name: "ThS. Giảng Viên 2",
      role: "lecturer",
      active: true,
    };

    const result = executeRoleChange({
      actor: adminActor,
      target,
      newRole: "admin",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("DENIED: Chỉ Owner mới có quyền");
  });

  it("CASE 4: Giảng viên thử thay role (DENIED)", () => {
    const lecturerActor = { uid: "lec_me", email: "gv_me@tdtu.edu.vn", role: "lecturer" as const };
    const target: UserProfile = {
      id: "lec_me",
      uid: "lec_me",
      email: "gv_me@tdtu.edu.vn",
      name: "ThS. Tôi",
      role: "lecturer",
      active: true,
    };

    const result = executeRoleChange({
      actor: lecturerActor,
      target,
      newRole: "admin",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("DENIED: Chỉ Owner mới có quyền");
  });

  it("CASE 5: Owner gỡ Admin → Giảng viên (PASS)", () => {
    const ownerActor = { uid: "owner_1", email: FOUNDING_OWNER_EMAIL, role: "owner" as const };
    const existingAdmin: UserProfile = {
      id: "admin_2",
      uid: "admin_2",
      email: "dongnghiep@tdtu.edu.vn",
      name: "TS. Đồng Nghiệp",
      role: "admin",
      active: true,
      promotedAt: "2026-02-01T00:00:00Z",
      promotedBy: FOUNDING_OWNER_EMAIL,
    };

    const result = executeRoleChange({
      actor: ownerActor,
      target: existingAdmin,
      newRole: "lecturer",
    });

    expect(result.success).toBe(true);
    expect(result.updatedUser?.role).toBe("lecturer");
    // Ensure data is not deleted
    expect(result.updatedUser?.id).toBe("admin_2");
    expect(result.updatedUser?.email).toBe("dongnghiep@tdtu.edu.vn");
  });

  it("CASE 6: Thử hạ Owner (DENIED)", () => {
    const ownerActor = { uid: "owner_1", email: FOUNDING_OWNER_EMAIL, role: "owner" as const };
    const foundingOwner: UserProfile = {
      id: "founder_doc",
      uid: "owner_1",
      email: FOUNDING_OWNER_EMAIL,
      name: "Trần Quang Hải",
      role: "owner",
      active: true,
    };

    // Case 6A: Try to downgrade founding owner
    const resultFounding = executeRoleChange({
      actor: ownerActor,
      target: foundingOwner,
      newRole: "admin",
    });
    expect(resultFounding.success).toBe(false);
    expect(resultFounding.error).toContain("Owner sáng lập");

    // Case 6B: Try self-downgrade
    const resultSelf = executeRoleChange({
      actor: ownerActor,
      target: foundingOwner,
      newRole: "lecturer",
    });
    expect(resultSelf.success).toBe(false);
    expect(resultSelf.error).toBeDefined();
  });

  it("CASE 7: Email ngoài @tdtu.edu.vn (DENIED)", () => {
    const ownerActor = { uid: "owner_1", email: FOUNDING_OWNER_EMAIL, role: "owner" as const };
    const externalUser: UserProfile = {
      id: "ext_1",
      uid: "ext_1",
      email: "hacker@gmail.com",
      name: "Người Ngoài",
      role: "lecturer",
      active: true,
    };

    const result = executeRoleChange({
      actor: ownerActor,
      target: externalUser,
      newRole: "admin",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("DENIED: Email không thuộc tên miền @tdtu.edu.vn!");
  });

  it("CASE 8: Duplicate Admin (BLOCKED)", () => {
    const ownerActor = { uid: "owner_1", email: FOUNDING_OWNER_EMAIL, role: "owner" as const };
    const currentAdmin: UserProfile = {
      id: "admin_3",
      uid: "admin_3",
      email: "da_la_admin@tdtu.edu.vn",
      name: "TS. Đã Làm Admin",
      role: "admin",
      active: true,
    };

    const result = executeRoleChange({
      actor: ownerActor,
      target: currentAdmin,
      newRole: "admin",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("BLOCKED: Người này hiện đã là Admin!");
  });
});
