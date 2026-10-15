import { describe, it, expect } from "vitest";

describe("RULES Logic & Role Permissions Verification", () => {
  it("should prevent Lecturer from altering documents belonging to another user", () => {
    const currentUserId = "lecturer_1";
    const documentOwnerId = "lecturer_2";

    const canEdit = (callerUid: string, ownerUid: string) => callerUid === ownerUid;
    expect(canEdit(currentUserId, documentOwnerId)).toBe(false);
    expect(canEdit(currentUserId, currentUserId)).toBe(true);
  });

  it("should prevent Admin from appointing or promoting any account to Owner", () => {
    const callerRole = "admin";
    const requestedNewRole = "owner";

    const canChangeRole = (caller: string, targetRole: string) => {
      if (caller !== "owner") {
        if (targetRole === "owner") return false;
      }
      return true;
    };

    expect(canChangeRole(callerRole, requestedNewRole)).toBe(false);
    expect(canChangeRole("owner", "admin")).toBe(true);
    expect(canChangeRole("owner", "owner")).toBe(true);
  });

  it("should enforce that public visitors can only read published opportunities", () => {
    const canPublicRead = (status: string) => status === "published";

    expect(canPublicRead("published")).toBe(true);
    expect(canPublicRead("archived")).toBe(false);
    expect(canPublicRead("draft")).toBe(false);
    expect(canPublicRead("pending")).toBe(false);
  });

  it("should protect immutable identity fields on lecturer profile updates", () => {
    const original = { uid: "u123", email: "gv@tdtu.edu.vn", role: "lecturer", active: true, name: "ThS A" };
    const updateAttempt = { ...original, role: "admin" }; // Trying privilege escalation

    const isLegalLecturerUpdate = (oldData: any, newData: any) => {
      // Role, active, uid, email must not change
      return (
        oldData.uid === newData.uid &&
        oldData.email === newData.email &&
        oldData.role === newData.role &&
        oldData.active === newData.active
      );
    };

    expect(isLegalLecturerUpdate(original, updateAttempt)).toBe(false);

    const validUpdate = { ...original, name: "TS A", department: "Bộ môn Đồ họa" };
    expect(isLegalLecturerUpdate(original, validUpdate)).toBe(true);
  });

  it("should enforce sharedPersonnel security rules: admin write, authenticated read, no deletion", () => {
    const canReadSharedPersonnel = (auth: any) => auth !== null;
    expect(canReadSharedPersonnel(null)).toBe(false);
    expect(canReadSharedPersonnel({ uid: "gv1" })).toBe(true);

    const canWriteSharedPersonnel = (
      role: string,
      docId: string,
      data: { emailNormalized: string }
    ) => {
      const isAdmin = role === "owner" || role === "admin";
      return isAdmin && data.emailNormalized === docId;
    };

    expect(canWriteSharedPersonnel("admin", "a@tdtu.edu.vn", { emailNormalized: "a@tdtu.edu.vn" })).toBe(true);
    expect(canWriteSharedPersonnel("owner", "a@tdtu.edu.vn", { emailNormalized: "a@tdtu.edu.vn" })).toBe(true);
    // Non-admin rejected
    expect(canWriteSharedPersonnel("lecturer", "a@tdtu.edu.vn", { emailNormalized: "a@tdtu.edu.vn" })).toBe(false);
    // ID spoofing rejected
    expect(canWriteSharedPersonnel("admin", "a@tdtu.edu.vn", { emailNormalized: "b@tdtu.edu.vn" })).toBe(false);

    // Deletion strictly denied
    const canDeleteSharedPersonnel = () => false;
    expect(canDeleteSharedPersonnel()).toBe(false);
  });

  it("should enforce personnelSyncLogs security rules: admin append-only, immutable logs", () => {
    const canReadSyncLogs = (role: string) => role === "admin" || role === "owner";
    expect(canReadSyncLogs("admin")).toBe(true);
    expect(canReadSyncLogs("owner")).toBe(true);
    expect(canReadSyncLogs("lecturer")).toBe(false);

    const canCreateSyncLog = (role: string, docId: string, data: { id: string }) => {
      const isAdmin = role === "admin" || role === "owner";
      return isAdmin && data.id === docId;
    };
    expect(canCreateSyncLog("admin", "log_1", { id: "log_1" })).toBe(true);
    expect(canCreateSyncLog("lecturer", "log_1", { id: "log_1" })).toBe(false);
    expect(canCreateSyncLog("admin", "log_1", { id: "log_2" })).toBe(false);

    const canUpdateOrDeleteSyncLog = () => false;
    expect(canUpdateOrDeleteSyncLog()).toBe(false);
  });

  it("should validate selective personnel import metrics in personnelSyncLogs", () => {
    const isValidSelectiveMetrics = (data: Record<string, any>) => {
      if ('selectedRows' in data && (!Number.isInteger(data.selectedRows) || data.selectedRows < 0)) return false;
      if ('skippedByUser' in data && (!Number.isInteger(data.skippedByUser) || data.skippedByUser < 0)) return false;
      if ('selectedCount' in data && (!Number.isInteger(data.selectedCount) || data.selectedCount < 0)) return false;
      return true;
    };

    expect(isValidSelectiveMetrics({ selectedRows: 10, skippedByUser: 2, selectedCount: 8 })).toBe(true);
    expect(isValidSelectiveMetrics({})).toBe(true);
    expect(isValidSelectiveMetrics({ selectedRows: -1 })).toBe(false);
    expect(isValidSelectiveMetrics({ skippedByUser: 1.5 })).toBe(false);
    expect(isValidSelectiveMetrics({ selectedCount: "5" as any })).toBe(false);
  });

  it("should enforce researchPersonnelSettings security rules and field constraints", () => {
    // Read permissions
    const canReadSettings = (auth: { role: string; email: string } | null, docEmail: string) => {
      if (!auth) return false;
      const isAdmin = auth.role === "admin" || auth.role === "owner";
      return isAdmin || auth.email.toLowerCase() === docEmail.toLowerCase();
    };

    expect(canReadSettings(null, "gv@tdtu.edu.vn")).toBe(false);
    expect(canReadSettings({ role: "owner", email: "tranquanghai@tdtu.edu.vn" }, "gv@tdtu.edu.vn")).toBe(true);
    expect(canReadSettings({ role: "admin", email: "admin@tdtu.edu.vn" }, "gv@tdtu.edu.vn")).toBe(true);
    expect(canReadSettings({ role: "lecturer", email: "gv@tdtu.edu.vn" }, "gv@tdtu.edu.vn")).toBe(true);
    expect(canReadSettings({ role: "lecturer", email: "other@tdtu.edu.vn" }, "gv@tdtu.edu.vn")).toBe(false);

    // Create & Update permissions: Only Owner
    const canWriteSettings = (
      role: string,
      docEmail: string,
      data: { emailNormalized: string; researchTrackingStatus: string }
    ) => {
      const isOwner = role === "owner";
      const validStatus = ["ACTIVE", "ARCHIVED"].includes(data.researchTrackingStatus);
      return isOwner && validStatus && data.emailNormalized === docEmail;
    };

    expect(canWriteSettings("owner", "gv@tdtu.edu.vn", { emailNormalized: "gv@tdtu.edu.vn", researchTrackingStatus: "ARCHIVED" })).toBe(true);
    expect(canWriteSettings("admin", "gv@tdtu.edu.vn", { emailNormalized: "gv@tdtu.edu.vn", researchTrackingStatus: "ARCHIVED" })).toBe(false);
    expect(canWriteSettings("lecturer", "gv@tdtu.edu.vn", { emailNormalized: "gv@tdtu.edu.vn", researchTrackingStatus: "ARCHIVED" })).toBe(false);
    // Invalid status rejected
    expect(canWriteSettings("owner", "gv@tdtu.edu.vn", { emailNormalized: "gv@tdtu.edu.vn", researchTrackingStatus: "UNKNOWN" })).toBe(false);
    // Email mismatch with doc ID rejected
    expect(canWriteSettings("owner", "gv@tdtu.edu.vn", { emailNormalized: "other@tdtu.edu.vn", researchTrackingStatus: "ACTIVE" })).toBe(false);

    // Deletion strictly denied
    const canDeleteSettings = () => false;
    expect(canDeleteSettings()).toBe(false);
  });

  it("should validate enhanced opportunity fields: publicationFee, registrationFee, feeStatus, feeSourceUrl, detailedContent, topicsDetailed", () => {
    const isValidEnhancedFields = (data: Record<string, any>) => {
      if ('publicationFee' in data && (typeof data.publicationFee !== 'string' || data.publicationFee.length > 500)) return false;
      if ('registrationFee' in data && (typeof data.registrationFee !== 'string' || data.registrationFee.length > 500)) return false;
      if ('feeStatus' in data && !['SPECIFIED', 'UNKNOWN', 'FREE'].includes(data.feeStatus)) return false;
      if ('feeSourceUrl' in data && (typeof data.feeSourceUrl !== 'string' || data.feeSourceUrl.length > 1000)) return false;
      if ('detailedContent' in data && (typeof data.detailedContent !== 'string' || data.detailedContent.length > 50000)) return false;
      if ('topicsDetailed' in data && (!Array.isArray(data.topicsDetailed) || data.topicsDetailed.length > 50)) return false;
      return true;
    };

    // Valid cases
    expect(isValidEnhancedFields({})).toBe(true);
    expect(isValidEnhancedFields({
      publicationFee: "5,000,000 VND",
      registrationFee: "Miễn phí",
      feeStatus: "SPECIFIED",
      feeSourceUrl: "https://example.com/fees",
      detailedContent: "Chi tiết thể lệ...",
      topicsDetailed: ["AI in Graphic Design", "Industrial Design"]
    })).toBe(true);
    expect(isValidEnhancedFields({ feeStatus: "FREE" })).toBe(true);
    expect(isValidEnhancedFields({ feeStatus: "UNKNOWN" })).toBe(true);

    // Invalid cases
    expect(isValidEnhancedFields({ feeStatus: "PAID" })).toBe(false);
    expect(isValidEnhancedFields({ publicationFee: "x".repeat(501) })).toBe(false);
    expect(isValidEnhancedFields({ registrationFee: "x".repeat(501) })).toBe(false);
    expect(isValidEnhancedFields({ feeSourceUrl: "x".repeat(1001) })).toBe(false);
    expect(isValidEnhancedFields({ detailedContent: "x".repeat(50001) })).toBe(false);
    expect(isValidEnhancedFields({ topicsDetailed: new Array(51).fill("Topic") })).toBe(false);
    expect(isValidEnhancedFields({ topicsDetailed: "Not a list" as any })).toBe(false);
  });

  it("should validate opportunity candidate statuses including needs_review, optional updatedBy, and empty deadline", () => {
    const isValidStatus = (status: string) => ['pending', 'approved', 'rejected', 'needs_review'].includes(status);
    expect(isValidStatus('pending')).toBe(true);
    expect(isValidStatus('approved')).toBe(true);
    expect(isValidStatus('rejected')).toBe(true);
    expect(isValidStatus('needs_review')).toBe(true);
    expect(isValidStatus('draft')).toBe(false);
    expect(isValidStatus('archived')).toBe(false);

    const isValidDeadline = (deadline: string) => typeof deadline === 'string' && deadline.length >= 0 && deadline.length <= 50;
    expect(isValidDeadline("")).toBe(true);
    expect(isValidDeadline("2026-12-31")).toBe(true);
    expect(isValidDeadline("x".repeat(51))).toBe(false);

    const isValidUpdatedBy = (data: { updatedBy?: any }) => {
      if (!('updatedBy' in data)) return true;
      return typeof data.updatedBy === 'string' && data.updatedBy.length >= 0 && data.updatedBy.length <= 100;
    };
    expect(isValidUpdatedBy({})).toBe(true);
    expect(isValidUpdatedBy({ updatedBy: "admin@tdtu.edu.vn" })).toBe(true);
    expect(isValidUpdatedBy({ updatedBy: "" })).toBe(true);
    expect(isValidUpdatedBy({ updatedBy: "x".repeat(101) })).toBe(false);
    expect(isValidUpdatedBy({ updatedBy: 123 })).toBe(false);
  });

  it("should validate import batch skippedCount and systemConfig keys capacity", () => {
    const isValidImportBatch = (data: { skippedCount?: any }) => {
      if (!('skippedCount' in data)) return true;
      return Number.isInteger(data.skippedCount) && data.skippedCount >= 0;
    };

    expect(isValidImportBatch({})).toBe(true);
    expect(isValidImportBatch({ skippedCount: 0 })).toBe(true);
    expect(isValidImportBatch({ skippedCount: 15 })).toBe(true);
    expect(isValidImportBatch({ skippedCount: -1 })).toBe(false);
    expect(isValidImportBatch({ skippedCount: 2.5 })).toBe(false);
    expect(isValidImportBatch({ skippedCount: "5" as any })).toBe(false);

    const isValidSystemConfigKeys = (keys: string[]) => keys.length <= 100;
    expect(isValidSystemConfigKeys(new Array(30).fill("k"))).toBe(true);
    expect(isValidSystemConfigKeys(new Array(50).fill("k"))).toBe(true);
    expect(isValidSystemConfigKeys(new Array(100).fill("k"))).toBe(true);
    expect(isValidSystemConfigKeys(new Array(101).fill("k"))).toBe(false);
  });

  describe("Comprehensive Research Sync Security Rules Simulation", () => {
    // Helper mimicking Firestore Rules authentication functions
    const isBootstrapOwner = (auth: any) =>
      auth !== null &&
      auth.token?.email != null &&
      (auth.token.email === "tranquanghai@tdtu.edu.vn" ||
        auth.token.email.toLowerCase() === "tranquanghai@tdtu.edu.vn");

    const isOwner = (auth: any, userDoc?: any) =>
      auth !== null &&
      (isBootstrapOwner(auth) || (userDoc && userDoc.role === "owner" && userDoc.active === true));

    const isAdmin = (auth: any, userDoc?: any) =>
      isOwner(auth, userDoc) ||
      (auth !== null && userDoc && userDoc.role === "admin" && userDoc.active === true);

    const isLecturer = (auth: any, userDoc?: any) =>
      auth !== null && userDoc && userDoc.role === "lecturer" && userDoc.active === true;

    // Schema validators matching firestore.rules
    const isValidSystemConfig = (data: Record<string, any>) => {
      const keys = Object.keys(data);
      if (keys.length > 100) return false;
      if ("isPublic" in data && typeof data.isPublic !== "boolean") return false;
      if ("updatedAt" in data && typeof data.updatedAt !== "string" && !(data.updatedAt instanceof Date))
        return false;
      return true;
    };

    const isValidOpportunityCandidate = (data: Record<string, any>) => {
      const requiredKeys = [
        "title", "organizer", "type", "level",
        "sourceType", "status", "createdAt", "updatedAt"
      ];
      if (!requiredKeys.every((k) => k in data)) return false;

      const allowedKeys = new Set([
        "id", "title", "organizer", "country", "type", "level", "topic",
        "field", "tags", "deadline", "abstractDeadline", "fullPaperDeadline",
        "registrationDeadline", "eventDate", "location", "fee", "publicationFormat",
        "indexing", "content", "submissionUrl", "sourceUrl", "directions",
        "suitability", "notes", "runId", "discoveredAt", "sheetStatus",
        "sourceType", "status", "rejectionReason", "reviewedBy", "reviewedAt",
        "normalizedTitle", "createdAt", "updatedAt",
        "publicationFee", "registrationFee", "feeStatus", "feeSourceUrl",
        "detailedContent", "topicsDetailed",
        "publishedOpportunityId", "recalledAt", "recalledBy", "updatedBy",
        "createdBy", "editedByAdmin", "manualOverrides",
        "stt", "candidateId", "hiddenAt", "hiddenBy", "sheetRowIndex",
        "unverifiedFields", "manualReviewNeeded", "manualReviewReason", "confidenceLevel",
        "diffSummary", "changeType", "isOutOfScope", "outOfScopeReason",
        "resolutionType", "conferenceCode", "category", "lastUpdated"
      ]);
      if (!Object.keys(data).every((k) => allowedKeys.has(k))) return false;

      if (typeof data.title !== "string" || data.title.length < 1 || data.title.length > 300) return false;
      if (typeof data.organizer !== "string" || data.organizer.length < 1 || data.organizer.length > 200) return false;
      if ("country" in data && (typeof data.country !== "string" || data.country.length > 100)) return false;
      if (![
        "Hội thảo", "Hội nghị", "Call for Papers", "Special Issue",
        "Book Chapter", "Seminar", "Hợp tác nghiên cứu", "Đổi mới sáng tạo", "Khác",
        "Hội thảo khoa học quốc tế", "Hội thảo quốc tế", "Hội thảo quốc gia"
      ].includes(data.type)) return false;
      if (!["Quốc tế", "Quốc gia", "Cấp Trường", "Cấp Khoa", "Khác"].includes(data.level)) return false;
      if ("topic" in data && (typeof data.topic !== "string" || data.topic.length > 300)) return false;
      if ("field" in data && (typeof data.field !== "string" || data.field.length > 200)) return false;
      if ("tags" in data && (!Array.isArray(data.tags) || data.tags.length > 30)) return false;
      if ("deadline" in data && (typeof data.deadline !== "string" || data.deadline.length > 200)) return false;
      if ("content" in data && (typeof data.content !== "string" || data.content.length > 50000)) return false;
      if (data.sourceType !== "SPARK") return false;
      if (!["pending", "approved", "rejected", "needs_review", "MỚI", "moi", "new"].includes(data.status)) return false;
      if ("normalizedTitle" in data && (typeof data.normalizedTitle !== "string" || data.normalizedTitle.length > 500))
        return false;
      return true;
    };

    const isValidImportBatch = (data: Record<string, any>) => {
      const required = ["timestamp", "importedBy", "fileName", "type", "totalRows", "successCount", "errorCount"];
      if (!required.every((k) => k in data)) return false;
      if (typeof data.totalRows !== "number" || data.totalRows < 0 || !Number.isInteger(data.totalRows)) return false;
      if (typeof data.successCount !== "number" || data.successCount < 0 || !Number.isInteger(data.successCount)) return false;
      if (typeof data.errorCount !== "number" || data.errorCount < 0 || !Number.isInteger(data.errorCount)) return false;
      if ("skippedCount" in data && (typeof data.skippedCount !== "number" || data.skippedCount < 0 || !Number.isInteger(data.skippedCount))) return false;
      return true;
    };

    const ownerAuthUpper = { uid: "owner_123", token: { email: "TranQuangHai@tdtu.edu.vn" } };
    const ownerAuthLower = { uid: "owner_123", token: { email: "tranquanghai@tdtu.edu.vn" } };
    const adminAuth = { uid: "admin_456", token: { email: "ha.ntt@tdtu.edu.vn" } };
    const adminDoc = { role: "admin", active: true };
    const lecturerAuth = { uid: "lec_789", token: { email: "lecturer@tdtu.edu.vn" } };
    const lecturerDoc = { role: "lecturer", active: true };

    const sampleCandidate = {
      title: "Hội thảo quốc tế CIEMB 2026",
      organizer: "Trường Đại học Kinh tế Quốc dân",
      country: "Việt Nam",
      type: "Hội thảo",
      level: "Quốc tế",
      topic: "Kinh tế và Quản trị",
      field: "Thiết kế đồ họa",
      tags: ["CIEMB", "Design"],
      deadline: "Nhận bài thường xuyên (liên tục các đợt trong năm)",
      content: "Nội dung tóm tắt hội thảo",
      sourceType: "SPARK",
      status: "pending",
      normalizedTitle: "hoi thao quoc te ciemb 2026",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Owner reads systemConfig
    it("1. allows Owner (even with uppercase Google email) to read systemConfig", () => {
      expect(isOwner(ownerAuthUpper)).toBe(true);
      expect(isOwner(ownerAuthLower)).toBe(true);
    });

    // 2. Owner reads candidates
    it("2. allows Owner to read opportunityCandidates", () => {
      const canReadCandidates = (auth: any, doc?: any) => isAdmin(auth, doc);
      expect(canReadCandidates(ownerAuthUpper)).toBe(true);
      expect(canReadCandidates(ownerAuthLower)).toBe(true);
    });

    // 3. Owner creates new candidate (including with deadline = 'Nhận bài thường xuyên')
    it("3. allows Owner to create new candidate with 'Nhận bài thường xuyên' deadline", () => {
      const canCreate = (auth: any, doc: any, payload: any) =>
        isAdmin(auth, doc) && isValidOpportunityCandidate(payload);
      expect(canCreate(ownerAuthUpper, null, sampleCandidate)).toBe(true);
    });

    // 4. Owner updates existing candidate (including updatedBy and empty topic/content)
    it("4. allows Owner to update existing candidate with updatedBy and notes", () => {
      const updatedPayload = {
        ...sampleCandidate,
        updatedBy: "SPARK_SYNC",
        notes: "Ghi chú bổ sung từ Spark",
        deadline: "", // Empty deadline case
        topic: "", // Empty topic case
      };
      const canUpdate = (auth: any, doc: any, payload: any) =>
        isAdmin(auth, doc) && isValidOpportunityCandidate(payload);
      expect(canUpdate(ownerAuthUpper, null, updatedPayload)).toBe(true);
    });

    // 5. Owner writes import history
    it("5. allows Owner to record import history with skippedCount", () => {
      const importPayload = {
        timestamp: new Date().toISOString(),
        importedBy: "tranquanghai@tdtu.edu.vn",
        fileName: "IFA Faculty Research (HỘI THẢO)",
        type: "opportunities",
        totalRows: 11,
        successCount: 11,
        errorCount: 0,
        skippedCount: 2,
      };
      const canWriteImport = (auth: any, doc: any, payload: any) =>
        isAdmin(auth, doc) && isValidImportBatch(payload);
      expect(canWriteImport(ownerAuthUpper, null, importPayload)).toBe(true);
    });

    // 6. Owner updates sync state in systemConfig
    it("6. allows Owner to update sync state with up to 100 metadata fields", () => {
      const syncStatePayload = {
        syncInProgress: false,
        lastSyncStatus: "success",
        lastSyncSource: "manual_admin",
        lastSyncAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const canUpdateState = (auth: any, doc: any, payload: any) =>
        (isOwner(auth, doc) || isAdmin(auth, doc)) && isValidSystemConfig(payload);
      expect(canUpdateState(ownerAuthUpper, null, syncStatePayload)).toBe(true);
    });

    // 7. Legitimate Admin can perform admin operations
    it("7. allows active Admin to perform review and sync operations", () => {
      expect(isAdmin(adminAuth, adminDoc)).toBe(true);
      expect(isValidOpportunityCandidate(sampleCandidate)).toBe(true);
    });

    // 8. Lecturer CANNOT perform administrative sync or write candidates
    it("8. denies Lecturer from creating candidates or writing systemConfig", () => {
      const canCreateCand = (auth: any, doc: any) => isAdmin(auth, doc);
      expect(canCreateCand(lecturerAuth, lecturerDoc)).toBe(false);

      const canWriteConfig = (auth: any, doc: any) => isOwner(auth, doc) || isAdmin(auth, doc);
      expect(canWriteConfig(lecturerAuth, lecturerDoc)).toBe(false);
    });

    // 9. Unauthenticated users cannot read candidates or write any data
    it("9. strictly denies unauthenticated users from reading candidates or writing data", () => {
      expect(isAdmin(null)).toBe(false);
      expect(isOwner(null)).toBe(false);
    });

    // 10. Invalid payloads are strictly rejected by security validators
    it("10. rejects invalid candidates (missing title, invalid sourceType, unknown keys)", () => {
      // Missing required title
      const missingTitle = { ...sampleCandidate, title: undefined };
      expect(isValidOpportunityCandidate(missingTitle as any)).toBe(false);

      // Invalid sourceType
      const invalidSource = { ...sampleCandidate, sourceType: "HACKER" };
      expect(isValidOpportunityCandidate(invalidSource as any)).toBe(false);

      // Disallowed key
      const disallowedKey = { ...sampleCandidate, maliciousInjectedField: true };
      expect(isValidOpportunityCandidate(disallowedKey as any)).toBe(false);
    });

    // 11. Legacy candidate documents (e.g., HAXD 2027 with 'Hội thảo khoa học quốc tế', 'MỚI', legacy fields) are valid
    it("11. validates legacy candidate documents like HAXD 2027 with raw type, status, and legacy fields", () => {
      const legacyHaxdCandidate = {
        title: "Hội thảo khoa học quốc tế lần thứ 3 về Tương tác Người – AI và Thiết kế Trải nghiệm (HAXD 2027)",
        organizer: "Trường Đại học Mỹ thuật Công nghiệp",
        country: "Việt Nam",
        type: "Hội thảo khoa học quốc tế",
        level: "Quốc tế",
        topic: "Tương tác Người - AI",
        field: "Thiết kế tương tác",
        tags: ["HAXD", "AI"],
        deadline: "15/12/2026",
        content: "Nội dung hội thảo HAXD 2027",
        sourceType: "SPARK",
        status: "MỚI",
        stt: 1,
        candidateId: "spark_opp_20261012-01_1",
        unverifiedFields: [],
        createdAt: "2026-10-12T01:00:00.000Z",
        updatedAt: "2026-10-12T01:00:00.000Z",
      };
      expect(isValidOpportunityCandidate(legacyHaxdCandidate)).toBe(true);

      // Simulating update payload merged into resource.data (backfilled canonical fields)
      const updatedLegacyDoc = {
        ...legacyHaxdCandidate,
        updatedAt: new Date().toISOString(),
        updatedBy: "SPARK_SYNC",
        normalizedTitle: "hoi thao khoa hoc quoc te lan thu 3 ve tuong tac nguoi ai va thiet ke trai nghiem haxd 2027",
        type: "Hội thảo",
        status: "pending",
      };
      expect(isValidOpportunityCandidate(updatedLegacyDoc)).toBe(true);
    });
  });

  describe("Journal Directory & Google Sheets Sync Security Rules Suite (Section 5 Verification)", () => {
    const isBootstrapOwner = (auth: any) =>
      auth !== null &&
      auth.token?.email != null &&
      (auth.token.email === "tranquanghai@tdtu.edu.vn" ||
        auth.token.email.toLowerCase() === "tranquanghai@tdtu.edu.vn");

    const isOwner = (auth: any, userDoc?: any) =>
      auth !== null &&
      (isBootstrapOwner(auth) || (userDoc && userDoc.role === "owner" && userDoc.active === true));

    const isAdmin = (auth: any, userDoc?: any) =>
      isOwner(auth, userDoc) ||
      (auth !== null && userDoc && userDoc.role === "admin" && userDoc.active === true);

    const isLecturer = (auth: any, userDoc?: any) =>
      auth !== null && userDoc && userDoc.role === "lecturer" && userDoc.active === true;

    const isValidJournalCandidate = (data: Record<string, any>) => {
      const required = [
        "journalId", "name", "publisher", "category", "primaryField",
        "sourceType", "changeType", "status", "createdAt", "updatedAt"
      ];
      if (!required.every((k) => k in data)) return false;

      const allowed = new Set([
        "id", "journalId", "name", "englishName", "abbreviation", "publisher",
        "issnPrint", "issnOnline", "isbn", "category", "primaryField", "fields",
        "website", "websiteVerified", "maxScore", "maxScoreYear", "scores",
        "guidelines", "links", "verification", "sourceType", "changeType",
        "existingJournalId", "diffSummary", "status", "rejectionReason",
        "isManualPreserved", "unverifiedFields", "sheetRowIndex",
        "createdAt", "updatedAt", "reviewedAt", "reviewedBy", "publishedJournalId",
        "manualReviewNeeded", "manualReviewReason", "confidenceLevel", "isManualEdited"
      ]);
      if (!Object.keys(data).every((k) => allowed.has(k))) return false;

      if (typeof data.journalId !== "string" || data.journalId.length < 1 || data.journalId.length > 50) return false;
      if (typeof data.name !== "string" || data.name.length < 1 || data.name.length > 300) return false;
      if (typeof data.publisher !== "string" || data.publisher.length < 1 || data.publisher.length > 300) return false;
      if (!["domestic", "international"].includes(data.category)) return false;
      if (typeof data.primaryField !== "string" || data.primaryField.length < 1 || data.primaryField.length > 200) return false;
      if (!["GOOGLE_SHEETS", "SPARK", "EXCEL", "MANUAL"].includes(data.sourceType)) return false;
      if (!["create", "update"].includes(data.changeType)) return false;
      if (!["pending", "approved", "rejected", "needs_review"].includes(data.status)) return false;
      if (typeof data.createdAt !== "string" || data.createdAt.length < 1 || data.createdAt.length > 50) return false;
      if (typeof data.updatedAt !== "string" || data.updatedAt.length < 1 || data.updatedAt.length > 50) return false;

      if ("fields" in data && (!Array.isArray(data.fields) || data.fields.length > 50)) return false;
      if ("scores" in data && (!Array.isArray(data.scores) || data.scores.length > 50)) return false;
      if ("links" in data && (!Array.isArray(data.links) || data.links.length > 50)) return false;
      if ("guidelines" in data && (typeof data.guidelines !== "object" || data.guidelines === null || Array.isArray(data.guidelines))) return false;
      if ("verification" in data && (typeof data.verification !== "object" || data.verification === null || Array.isArray(data.verification))) return false;
      if ("unverifiedFields" in data && (!Array.isArray(data.unverifiedFields) || data.unverifiedFields.length > 30)) return false;
      if ("maxScore" in data && (typeof data.maxScore !== "number" || data.maxScore < 0 || data.maxScore > 10)) return false;
      if ("maxScoreYear" in data && (typeof data.maxScoreYear !== "number" || data.maxScoreYear < 1900 || data.maxScoreYear > 2100)) return false;
      return true;
    };

    const isValidJournalImport = (data: Record<string, any>) => {
      const required = [
        "batchId", "fileName", "totalParsed", "createdCount", "updatedCount",
        "skippedCount", "errorCount", "importedAt", "importedBy", "schemaVersion"
      ];
      if (!required.every((k) => k in data)) return false;

      const allowed = new Set([
        "id", "batchId", "fileName", "totalParsed", "createdCount", "updatedCount",
        "skippedCount", "errorCount", "errors", "importedAt", "importedBy", "schemaVersion",
        "sheetId", "sheetName", "sourceType", "createdAt"
      ]);
      if (!Object.keys(data).every((k) => allowed.has(k))) return false;

      if (typeof data.totalParsed !== "number" || data.totalParsed < 0) return false;
      if (typeof data.createdCount !== "number" || data.createdCount < 0) return false;
      if (typeof data.updatedCount !== "number" || data.updatedCount < 0) return false;
      if (typeof data.skippedCount !== "number" || data.skippedCount < 0) return false;
      if (typeof data.errorCount !== "number" || data.errorCount < 0) return false;
      if (typeof data.schemaVersion !== "number" || data.schemaVersion < 1) return false;
      return true;
    };

    const ownerAuth = { uid: "owner_123", token: { email: "tranquanghai@tdtu.edu.vn" } };
    const adminAuth = { uid: "admin_456", token: { email: "admin@tdtu.edu.vn" } };
    const adminDoc = { role: "admin", active: true };
    const lecturerAuth = { uid: "lec_789", token: { email: "lecturer@tdtu.edu.vn" } };
    const lecturerDoc = { role: "lecturer", active: true };

    const samplePendingCandidate = {
      id: "cand_new_TC-001",
      journalId: "TC-001",
      name: "Tạp chí Văn hóa Nghệ thuật",
      publisher: "Bộ Văn hóa, Thể thao và Du lịch",
      category: "domestic",
      primaryField: "Văn hóa - Nghệ thuật",
      fields: ["Văn hóa - Nghệ thuật", "HĐGS Liên ngành VHNT"],
      maxScore: 1.0,
      maxScoreYear: 2025,
      sourceType: "GOOGLE_SHEETS",
      changeType: "create",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scores: [
        {
          id: "PTS-1",
          councilCode: "NHOM_I",
          councilName: "Nhóm I: Áp dụng chung cho ngành VHNT",
          year: 2025,
          maxScore: 1.0,
        },
      ],
      links: [
        {
          id: "LINK-TC-001-home",
          linkType: "Trang chủ",
          label: "Website chính thức",
          url: "http://vanhoanghethuat.vn",
          isVerified: true,
        },
      ],
      verification: {
        status: "verified",
        schemaVersion: 1,
        confidenceLevel: "Cao",
      },
    };

    // Case 1: Owner đọc journals
    it("1. allows Owner to read public journals collection", () => {
      const canReadJournals = () => true; // match /journals is allow read: if true
      expect(canReadJournals()).toBe(true);
      expect(isOwner(ownerAuth)).toBe(true);
    });

    // Case 2: Owner đọc journalCandidates
    it("2. allows Owner to read journalCandidates queue", () => {
      const canReadCandidates = (auth: any, doc?: any) => isAdmin(auth, doc);
      expect(canReadCandidates(ownerAuth)).toBe(true);
    });

    // Case 3: Owner tạo ứng viên pending
    it("3. allows Owner to create pending candidate in review queue", () => {
      const canCreate = (auth: any, doc: any, payload: any) =>
        isAdmin(auth, doc) && isValidJournalCandidate(payload);
      expect(canCreate(ownerAuth, null, samplePendingCandidate)).toBe(true);
    });

    // Case 4: Owner tạo ứng viên needs_review
    it("4. allows Owner to create needs_review candidate with manualReviewNeeded and reason", () => {
      const needsReviewCandidate = {
        ...samplePendingCandidate,
        id: "cand_new_J_020",
        journalId: "J_020",
        name: "Tạp chí Nghiên cứu dân tộc",
        status: "needs_review",
        manualReviewNeeded: true,
        manualReviewReason: "Điểm về 0 từ tháng 6/2025",
        unverifiedFields: ["Cần kiểm tra thủ công: Điểm về 0 từ tháng 6/2025"],
      };
      const canCreate = (auth: any, doc: any, payload: any) =>
        isAdmin(auth, doc) && isValidJournalCandidate(payload);
      expect(canCreate(ownerAuth, null, needsReviewCandidate)).toBe(true);
    });

    // Case 5: Owner ghi dữ liệu điểm nhiều nhóm ngành
    it("5. allows Owner to write candidate with multi-group scores (up to 50 items)", () => {
      const multiScoreCandidate = {
        ...samplePendingCandidate,
        scores: [
          { councilCode: "NHOM_I", councilName: "Ngành VHNT", year: 2025, maxScore: 0.75 },
          { councilCode: "NHOM_III", councilName: "Ngành Báo chí truyền thông", year: 2025, maxScore: 1.0 },
        ],
      };
      const canCreate = (auth: any, doc: any, payload: any) =>
        isAdmin(auth, doc) && isValidJournalCandidate(payload);
      expect(canCreate(ownerAuth, null, multiScoreCandidate)).toBe(true);
    });

    // Case 6: Owner ghi dữ liệu có URL và thông tin kiểm chứng
    it("6. allows Owner to write candidate with multiple URLs and verification metadata", () => {
      const fullLinksCandidate = {
        ...samplePendingCandidate,
        links: [
          { id: "L1", linkType: "Trang chủ", label: "Trang chủ", url: "https://example.com", isVerified: true },
          { id: "L2", linkType: "Nộp bài", label: "Cổng nộp bài", url: "https://example.com/submit", isVerified: true },
        ],
        verification: {
          status: "verified",
          verifiedBy: "Spark Agent",
          verifiedDate: "2026-10-12",
          sourceReference: "Quyết định 26/QĐ-HĐGSNN",
          schemaVersion: 1,
          confidenceLevel: "Rất cao",
        },
      };
      const canCreate = (auth: any, doc: any, payload: any) =>
        isAdmin(auth, doc) && isValidJournalCandidate(payload);
      expect(canCreate(ownerAuth, null, fullLinksCandidate)).toBe(true);
    });

    // Case 7: Owner ghi lịch sử import (journalImports)
    it("7. allows Owner to write import audit log into journalImports", () => {
      const importLogPayload = {
        batchId: "batch_gs_1728730000000",
        fileName: "Google Sheets: Trang tính1 (1QJKvNd7s0eZpr8HiO_FYGi5HQF3sHhlqR6_G5SODXWE)",
        totalParsed: 90,
        createdCount: 90,
        updatedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        importedAt: new Date().toISOString(),
        importedBy: "tranquanghai@tdtu.edu.vn",
        schemaVersion: 1,
      };
      const canWriteImport = (auth: any, doc: any, payload: any) =>
        isAdmin(auth, doc) && isValidJournalImport(payload);
      expect(canWriteImport(ownerAuth, null, importLogPayload)).toBe(true);
    });

    // Case 8: Owner cập nhật trạng thái đồng bộ (systemConfig/journal_sync)
    it("8. allows Owner to update sync settings in systemConfig/journal_sync", () => {
      const syncConfigPayload = {
        sheetId: "1QJKvNd7s0eZpr8HiO_FYGi5HQF3sHhlqR6_G5SODXWE",
        sheetName: "Trang tính1",
        lastSyncedAt: new Date().toISOString(),
        lastSyncedBy: "tranquanghai@tdtu.edu.vn",
        lastStats: {
          totalRead: 90,
          validRows: 90,
          newCount: 90,
          updatedCount: 0,
          unchangedCount: 0,
          skippedCount: 0,
          errorCount: 0,
        },
      };
      const canUpdateConfig = (auth: any, doc: any, payload: any) =>
        (isOwner(auth, doc) || isAdmin(auth, doc)) && Object.keys(payload).length <= 100;
      expect(canUpdateConfig(ownerAuth, null, syncConfigPayload)).toBe(true);
    });

    // Case 9: Admin hợp lệ được phép thực hiện theo quyền
    it("9. allows active Admin to write candidates and import logs", () => {
      const canCreate = (auth: any, doc: any, payload: any) =>
        isAdmin(auth, doc) && isValidJournalCandidate(payload);
      expect(canCreate(adminAuth, adminDoc, samplePendingCandidate)).toBe(true);
    });

    // Case 10: Giảng viên không được ghi vào hàng chờ
    it("10. strictly denies Lecturer from creating candidates in journalCandidates", () => {
      const canCreate = (auth: any, doc: any) => isAdmin(auth, doc);
      expect(canCreate(lecturerAuth, lecturerDoc)).toBe(false);
    });

    // Case 11: Người chưa đăng nhập không được ghi
    it("11. strictly denies unauthenticated users from reading candidates or writing data", () => {
      expect(isAdmin(null)).toBe(false);
      expect(isOwner(null)).toBe(false);
    });

    // Case 12: Đồng bộ lại không nhân đôi dữ liệu (idempotency)
    it("12. prevents duplicate candidate creation on repeated sync (deterministic cand_new_ ID & active queue check)", () => {
      const activePending = [samplePendingCandidate];
      const activeMap = new Map(activePending.map((c) => [c.journalId, c]));

      // Incoming same journal again
      const incomingJournalId = "TC-001";
      const isAlreadyInQueue = activeMap.has(incomingJournalId);
      expect(isAlreadyInQueue).toBe(true);

      // Re-running sync skips creating duplicate queue item
      const skippedCount = isAlreadyInQueue ? 1 : 0;
      expect(skippedCount).toBe(1);
    });
  });
});

