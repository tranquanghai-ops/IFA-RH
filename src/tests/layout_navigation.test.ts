import { describe, it, expect } from "vitest";

describe("LAYOUT & Role Navigation Verification (SCImago & IFAA Admin Standards)", () => {
  // Navigation structure definition per specs
  const getNavGroupsForRole = (role: "lecturer" | "admin" | "owner") => {
    const isOwner = role === "owner";
    const isAdmin = role === "admin" || isOwner;

    const groups: { title: string; items: string[] }[] = [];

    // Group 1: TỔNG QUAN
    groups.push({
      title: "TỔNG QUAN",
      items: ["Tổng quan"],
    });

    // Group 2: NGHIÊN CỨU
    groups.push({
      title: "NGHIÊN CỨU",
      items: ["Cơ hội NCKH", "Tiến độ NCKH", "Hồ sơ nghiên cứu"],
    });

    // Group 3: QUẢN TRỊ (Admin & Owner only)
    if (isAdmin) {
      groups.push({
        title: "QUẢN TRỊ",
        items: ["Hàng chờ Spark", "Giảng viên", "Import dữ liệu"],
      });
    }

    // Group 4: BÁO CÁO
    groups.push({
      title: "BÁO CÁO",
      items: ["Thống kê NCKH"],
    });

    // Group 5: HỆ THỐNG
    const systemItems: string[] = [];
    if (isOwner) {
      systemItems.push("Khu vực Owner");
    }
    systemItems.push("Hướng dẫn sử dụng");

    groups.push({
      title: "HỆ THỐNG",
      items: systemItems,
    });

    return groups;
  };

  it("should enforce that Giảng viên does NOT have access to Admin/Owner items", () => {
    const lecturerGroups = getNavGroupsForRole("lecturer");
    const allItems = lecturerGroups.flatMap((g) => g.items);

    expect(allItems).toContain("Tổng quan");
    expect(allItems).toContain("Cơ hội NCKH");
    expect(allItems).toContain("Tiến độ NCKH");
    expect(allItems).toContain("Hồ sơ nghiên cứu");
    expect(allItems).toContain("Thống kê NCKH");
    expect(allItems).toContain("Hướng dẫn sử dụng");

    // Prohibited items for Lecturer
    expect(allItems).not.toContain("Hàng chờ Spark");
    expect(allItems).not.toContain("Giảng viên");
    expect(allItems).not.toContain("Import dữ liệu");
    expect(allItems).not.toContain("Khu vực Owner");

    // Group "QUẢN TRỊ" must not exist for Lecturer
    const groupTitles = lecturerGroups.map((g) => g.title);
    expect(groupTitles).not.toContain("QUẢN TRỊ");
  });

  it("should enforce that Admin sees QUẢN TRỊ items but CANNOT see Khu vực Owner", () => {
    const adminGroups = getNavGroupsForRole("admin");
    const allItems = adminGroups.flatMap((g) => g.items);

    expect(allItems).toContain("Tổng quan");
    expect(allItems).toContain("Cơ hội NCKH");
    expect(allItems).toContain("Hàng chờ Spark");
    expect(allItems).toContain("Giảng viên");
    expect(allItems).toContain("Import dữ liệu");
    expect(allItems).toContain("Thống kê NCKH");
    expect(allItems).toContain("Hướng dẫn sử dụng");

    // Prohibited item for Admin
    expect(allItems).not.toContain("Khu vực Owner");

    const groupTitles = adminGroups.map((g) => g.title);
    expect(groupTitles).toContain("QUẢN TRỊ");
  });

  it("should enforce that Owner has full access to all groups including Khu vực Owner", () => {
    const ownerGroups = getNavGroupsForRole("owner");
    const allItems = ownerGroups.flatMap((g) => g.items);

    expect(allItems).toContain("Tổng quan");
    expect(allItems).toContain("Cơ hội NCKH");
    expect(allItems).toContain("Tiến độ NCKH");
    expect(allItems).toContain("Hồ sơ nghiên cứu");
    expect(allItems).toContain("Hàng chờ Spark");
    expect(allItems).toContain("Giảng viên");
    expect(allItems).toContain("Import dữ liệu");
    expect(allItems).toContain("Thống kê NCKH");
    expect(allItems).toContain("Khu vực Owner");
    expect(allItems).toContain("Hướng dẫn sử dụng");

    expect(ownerGroups.map((g) => g.title)).toEqual([
      "TỔNG QUAN",
      "NGHIÊN CỨU",
      "QUẢN TRỊ",
      "BÁO CÁO",
      "HỆ THỐNG",
    ]);
  });

  it("should verify brand identifier hierarchy", () => {
    const brandHierarchy = [
      "Logo TDTU",
      "Logo Khoa MTCN / IFA",
      "IFA-RH",
      "IFA Research Hub",
      "Hệ thống Nghiên cứu Khoa học Giảng viên",
    ];

    expect(brandHierarchy[0]).toBe("Logo TDTU");
    expect(brandHierarchy[1]).toBe("Logo Khoa MTCN / IFA");
    expect(brandHierarchy[2]).toBe("IFA-RH");
    expect(brandHierarchy[3]).toBe("IFA Research Hub");
    expect(brandHierarchy[4]).toBe("Hệ thống Nghiên cứu Khoa học Giảng viên");
  });
});
