import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  addDoc,
  limit,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "./config";
import type {
  UserProfile,
  UserRole,
  Opportunity,
  OpportunityCandidate,
  ResearchWork,
  ResearchProgress,
  Publication,
  AuditLog,
  ImportBatch,
  SharedPersonnelRecord,
  PersonnelSyncLog,
  ResearchPersonnelSettings,
  ResearchTrackingStatus,
} from "../types";
import { normalizeText } from "../utils/dedupe";

// ======================== AUDIT LOGS ========================
export async function logAudit(
  actor: { uid: string; email: string; role: UserRole },
  action: string,
  entityType: AuditLog["entityType"],
  entityId: string,
  summary: string
) {
  try {
    await addDoc(collection(firestore, "auditLogs"), {
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp(),
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action,
      entityType,
      entityId,
      summary,
    });
  } catch (err) {
    console.warn("Failed to write audit log:", err);
  }
}

export async function fetchAuditLogs(limitCount = 100): Promise<AuditLog[]> {
  const q = query(
    collection(firestore, "auditLogs"),
    orderBy("timestamp", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog));
}

export function deduplicateUsers(users: UserProfile[]): UserProfile[] {
  const map = new Map<string, UserProfile>();

  for (const u of users) {
    const rawData = u as any;
    // Skip documents explicitly marked migrated or inactive duplicate
    if (rawData.status === "migrated" || rawData.migratedTo) {
      continue;
    }
    const emailNorm = (u.email || "").trim().toLowerCase();
    if (!emailNorm) continue;

    const existing = map.get(emailNorm);
    if (!existing) {
      map.set(emailNorm, u);
      continue;
    }

    // Determine canonical priority:
    // Priority 1: Real authenticated account with Google UID (!id.startsWith('prov_'))
    // Priority 2: Standard provisioned id (id === 'prov_' + emailNorm)
    // Priority 3: Retain admin or owner role if conflicting with lecturer
    const isUReal = !u.id.startsWith("prov_");
    const isExReal = !existing.id.startsWith("prov_");
    if (isUReal && !isExReal) {
      map.set(emailNorm, { ...existing, ...u });
    } else if (!isUReal && isExReal) {
      map.set(emailNorm, { ...u, ...existing });
    } else {
      const isUStandard = u.id === `prov_${emailNorm}`;
      const isExStandard = existing.id === `prov_${emailNorm}`;
      if (isUStandard && !isExStandard) {
        map.set(emailNorm, { ...existing, ...u });
      } else if (!isUStandard && isExStandard) {
        map.set(emailNorm, { ...u, ...existing });
      } else {
        if ((u.role === "admin" || u.role === "owner") && existing.role === "lecturer") {
          map.set(emailNorm, u);
        }
      }
    }
  }

  return Array.from(map.values());
}

// ======================== USERS & ROLES ========================
export async function fetchAllUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(collection(firestore, "users"));
  const rawList = snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserProfile));
  return deduplicateUsers(rawList);
}

export async function fetchActiveLecturers(): Promise<UserProfile[]> {
  try {
    const [sharedList, usersList, settingsMap] = await Promise.all([
      fetchSharedPersonnel(),
      fetchAllUsers(),
      fetchResearchPersonnelSettings(),
    ]);

    const usersMap = new Map<string, UserProfile>();
    usersList.forEach((u) => {
      if (u.email) usersMap.set(u.email.toLowerCase().trim(), u);
    });

    const activeList: UserProfile[] = [];
    const seenEmails = new Set<string>();

    if (sharedList.length > 0) {
      sharedList.forEach((p) => {
        const emailNorm = p.emailNormalized.toLowerCase().trim();
        if (!emailNorm || seenEmails.has(emailNorm)) return;

        const setting = settingsMap.get(emailNorm);
        const researchTrackingStatus: ResearchTrackingStatus =
          setting?.researchTrackingStatus || "ACTIVE";

        // Exclude archived from research tracking or inactive personnel
        if (researchTrackingStatus === "ARCHIVED" || p.active === false) {
          return;
        }

        seenEmails.add(emailNorm);
        const user = usersMap.get(emailNorm);

        activeList.push({
          id: user?.id || emailNorm,
          uid: user?.uid || user?.id || emailNorm,
          email: p.emailNormalized,
          name: user?.name || p.displayName,
          department: user?.department || p.departmentName || "Chưa phân ngành",
          academicDegree: user?.academicDegree || p.academicDegree || "",
          active: true,
          role: user?.role || "lecturer",
          photoURL: user?.photoURL,
          orcid: user?.orcid,
          googleScholar: user?.googleScholar,
          researchGate: user?.researchGate,
          website: user?.website,
          createdAt: user?.createdAt || p.sourceUpdatedAt || p.sharedUpdatedAt,
          updatedAt: user?.updatedAt || p.sharedUpdatedAt,
        });
      });
    }

    // Also include any active users from users collection not present in sharedPersonnel
    usersList.forEach((u) => {
      const emailNorm = (u.email || "").toLowerCase().trim();
      if (!emailNorm || seenEmails.has(emailNorm)) return;

      const setting = settingsMap.get(emailNorm);
      const researchTrackingStatus: ResearchTrackingStatus =
        setting?.researchTrackingStatus || "ACTIVE";

      if (researchTrackingStatus === "ARCHIVED" || u.active === false) {
        return;
      }

      seenEmails.add(emailNorm);
      activeList.push(u);
    });

    return deduplicateUsers(activeList).sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", "vi")
    );
  } catch (err) {
    console.warn("fetchActiveLecturers error, falling back to users collection:", err);
    const snap = await getDocs(collection(firestore, "users"));
    const rawList = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as UserProfile))
      .filter((u) => u.active === true);
    return deduplicateUsers(rawList).sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", "vi")
    );
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const docRef = doc(firestore, "users", uid);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as UserProfile;
  }
  return null;
}

export async function updateUserProfile(
  uid: string,
  data: Partial<UserProfile>,
  actor: { uid: string; email: string; role: UserRole }
) {
  const docRef = doc(firestore, "users", uid);
  await updateDoc(docRef, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
  await logAudit(
    actor,
    "UPDATE_USER_PROFILE",
    "user",
    uid,
    `Cập nhật thông tin giảng viên: ${data.name || uid}`
  );
}

export async function promoteLecturerToAdmin(
  targetUser: UserProfile,
  actor: { uid: string; email: string; role: UserRole }
) {
  if (actor.role !== "owner") {
    throw new Error("Chỉ Owner mới có quyền cấp quyền Admin!");
  }
  const cleanEmail = targetUser.email.trim().toLowerCase();
  if (!cleanEmail.endsWith("@tdtu.edu.vn")) {
    throw new Error(`Email ${cleanEmail} không thuộc tên miền @tdtu.edu.vn!`);
  }
  if (targetUser.role === "admin" || targetUser.role === "owner") {
    throw new Error(`Tài khoản ${targetUser.email} đã có vai trò ${targetUser.role.toUpperCase()}!`);
  }

  const docRef = doc(firestore, "users", targetUser.id);
  const now = new Date().toISOString();
  await updateDoc(docRef, {
    role: "admin",
    promotedAt: now,
    promotedBy: actor.email,
    updatedAt: now,
  });

  await logAudit(
    actor,
    "ROLE_CHANGED",
    "user",
    targetUser.id,
    `Owner cấp quyền Admin cho ${targetUser.name} (${cleanEmail}). Vai trò cũ: lecturer -> Mới: admin`
  );
}

export async function revokeAdminRole(
  targetUser: UserProfile,
  actor: { uid: string; email: string; role: UserRole }
) {
  if (actor.role !== "owner") {
    throw new Error("Chỉ Owner mới có quyền gỡ quyền Admin!");
  }
  if (targetUser.email === "tranquanghai@tdtu.edu.vn" || targetUser.role === "owner") {
    throw new Error("Không thể thay đổi hoặc hạ quyền của tài khoản Owner sáng lập hệ thống!");
  }
  if (targetUser.uid === actor.uid) {
    throw new Error("Bạn không thể tự hạ quyền của chính mình!");
  }

  const docRef = doc(firestore, "users", targetUser.id);
  const now = new Date().toISOString();
  await updateDoc(docRef, {
    role: "lecturer",
    updatedAt: now,
  });

  await logAudit(
    actor,
    "ROLE_CHANGED",
    "user",
    targetUser.id,
    `Owner gỡ quyền Admin của ${targetUser.name} (${targetUser.email}), chuyển về Giảng viên`
  );
}

export async function setUserRole(
  targetUid: string,
  targetEmail: string,
  newRole: UserRole,
  actor: { uid: string; email: string; role: UserRole },
  targetName?: string,
  oldRole?: UserRole
) {
  if (actor.role !== "owner") {
    throw new Error("Chỉ Owner mới có quyền thay đổi role!");
  }
  if ((targetEmail === "tranquanghai@tdtu.edu.vn" || oldRole === "owner") && newRole !== "owner") {
    throw new Error("Không thể thay đổi hoặc hạ quyền của tài khoản Owner sáng lập hệ thống!");
  }
  if (targetUid === actor.uid && newRole !== "owner") {
    throw new Error("Bạn không thể tự hạ quyền Owner của chính mình!");
  }

  const docRef = doc(firestore, "users", targetUid);
  const now = new Date().toISOString();
  const updatePayload: Record<string, any> = {
    role: newRole,
    updatedAt: now,
  };
  if (newRole === "admin") {
    updatePayload.promotedAt = now;
    updatePayload.promotedBy = actor.email;
  }

  await updateDoc(docRef, updatePayload);
  await logAudit(
    actor,
    "ROLE_CHANGED",
    "user",
    targetUid,
    `Owner thay đổi vai trò của ${targetName || targetEmail} (${targetEmail}): ${oldRole || "cũ"} -> ${newRole}`
  );
}

export async function createOrProvisionUser(
  userData: {
    email: string;
    name: string;
    role: UserRole;
    department?: string;
    academicDegree?: string;
    active: boolean;
  },
  actor: { uid: string; email: string; role: UserRole }
) {
  const normalizedEmail = userData.email.trim().toLowerCase();

  // Validate email domain: must end with @tdtu.edu.vn
  if (!normalizedEmail.endsWith("@tdtu.edu.vn")) {
    throw new Error(
      `Email ${normalizedEmail} không hợp lệ! IFA-RH chỉ chấp nhận email trường kết thúc bằng @tdtu.edu.vn`
    );
  }

  // Admin cannot provision an owner
  if (userData.role === "owner" && actor.role !== "owner") {
    throw new Error("Chỉ Owner mới có thể tạo hoặc gán quyền Owner!");
  }

  // Check if exists
  const q = query(
    collection(firestore, "users"),
    where("email", "==", normalizedEmail)
  );
  const existing = await getDocs(q);
  if (!existing.empty) {
    throw new Error(`Email ${normalizedEmail} đã tồn tại trong hệ thống!`);
  }

  const id = `prov_${normalizedEmail}`;
  const now = new Date().toISOString();
  const provPayload = {
    id,
    uid: id,
    email: normalizedEmail,
    name: userData.name.trim(),
    role: userData.role,
    department: userData.department || "",
    academicDegree: userData.academicDegree || "",
    active: userData.active,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(doc(firestore, "users", id), provPayload);

  await logAudit(
    actor,
    "PROVISION_USER",
    "user",
    id,
    `Thêm mới nhân sự: ${userData.name} (${normalizedEmail}) với quyền ${userData.role}`
  );
}

// ======================== OPPORTUNITIES ========================
export async function fetchPublishedOpportunities(): Promise<Opportunity[]> {
  const q = query(
    collection(firestore, "opportunities"),
    where("status", "==", "published")
  );
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Opportunity));
  // Sort descending by deadline or createdAt
  return list.sort((a, b) => (b.deadline || b.createdAt).localeCompare(a.deadline || a.createdAt));
}

export async function fetchAllOpportunities(): Promise<Opportunity[]> {
  const snap = await getDocs(collection(firestore, "opportunities"));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Opportunity));
  return list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export async function createOpportunity(
  data: Omit<Opportunity, "id" | "createdAt" | "updatedAt">,
  actor: { uid: string; email: string; role: UserRole }
): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(firestore, "opportunities"), {
    ...data,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.email,
  });

  await logAudit(
    actor,
    "CREATE_OPPORTUNITY",
    "opportunity",
    ref.id,
    `Đăng mới cơ hội NCKH: "${data.title}"`
  );
  return ref.id;
}

export async function updateOpportunity(
  id: string,
  data: Partial<Opportunity>,
  actor: { uid: string; email: string; role: UserRole }
) {
  const docRef = doc(firestore, "opportunities", id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.email,
  });

  await logAudit(
    actor,
    "UPDATE_OPPORTUNITY",
    "opportunity",
    id,
    `Cập nhật cơ hội NCKH: "${data.title || id}"`
  );
}

export async function deleteOpportunity(
  id: string,
  title: string,
  actor: { uid: string; email: string; role: UserRole }
) {
  await deleteDoc(doc(firestore, "opportunities", id));
  await logAudit(
    actor,
    "DELETE_OPPORTUNITY",
    "opportunity",
    id,
    `Xóa cơ hội NCKH: "${title}"`
  );
}

// ======================== OPPORTUNITY CANDIDATES (SPARK) ========================
export async function fetchOpportunityCandidates(): Promise<OpportunityCandidate[]> {
  const snap = await getDocs(collection(firestore, "opportunityCandidates"));
  const list = snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as OpportunityCandidate)
  );
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addCandidate(
  data: Omit<OpportunityCandidate, "id" | "createdAt" | "updatedAt" | "normalizedTitle">,
  actor?: { uid: string; email: string; role: UserRole }
): Promise<string> {
  const now = new Date().toISOString();
  
  // Clean undefined properties for Firestore safety
  const cleanData: any = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      cleanData[k] = v;
    }
  }

  const ref = await addDoc(collection(firestore, "opportunityCandidates"), {
    ...cleanData,
    normalizedTitle: normalizeText(data.title),
    createdAt: cleanData.createdAt || now,
    updatedAt: now,
  });

  if (actor) {
    await logAudit(
      actor,
      "ADD_CANDIDATE",
      "candidate",
      ref.id,
      `Thêm ứng viên cơ hội Spark: "${data.title}"`
    );
  }
  return ref.id;
}

export async function approveCandidate(
  candidate: OpportunityCandidate,
  actor: { uid: string; email: string; role: UserRole }
) {
  const now = new Date().toISOString();

  const requiredText = [
    ["tiêu đề", candidate.title], ["đơn vị tổ chức", candidate.organizer],
    ["chủ đề", candidate.topic], ["ngành phù hợp", candidate.field],
    ["hạn nộp", candidate.deadline], ["mô tả", candidate.content],
  ] as const;
  const missing = requiredText.find(([, value]) => !String(value || "").trim());
  if (missing) throw new Error(`Chưa thể công bố: thiếu ${missing[0]}. Vui lòng bổ sung thông tin trước khi duyệt.`);

  // 1. Create published opportunity
  const oppData: any = {
    title: candidate.title,
    organizer: candidate.organizer,
    country: candidate.country || "Việt Nam",
    type: candidate.type,
    level: candidate.level,
    topic: candidate.topic || "",
    field: candidate.field || "",
    tags: candidate.tags || [],
    deadline: candidate.deadline,
    content: candidate.content || "",
    sourceType: "SPARK",
    status: "published",
    candidateId: candidate.id,
    createdBy: actor.email,
  };

  if (candidate.abstractDeadline) oppData.abstractDeadline = candidate.abstractDeadline;
  if (candidate.fullPaperDeadline) oppData.fullPaperDeadline = candidate.fullPaperDeadline;
  if (candidate.registrationDeadline) oppData.registrationDeadline = candidate.registrationDeadline;
  if (candidate.eventDate) oppData.eventDate = candidate.eventDate;
  if (candidate.location) oppData.location = candidate.location;
  if (candidate.fee) oppData.fee = candidate.fee;
  if (candidate.publicationFee) oppData.publicationFee = candidate.publicationFee;
  if (candidate.registrationFee) oppData.registrationFee = candidate.registrationFee;
  if (candidate.feeStatus) oppData.feeStatus = candidate.feeStatus;
  if (candidate.feeSourceUrl) oppData.feeSourceUrl = candidate.feeSourceUrl;
  if (candidate.detailedContent) oppData.detailedContent = candidate.detailedContent;
  if (candidate.topicsDetailed) oppData.topicsDetailed = candidate.topicsDetailed;
  if (candidate.publicationFormat) oppData.publicationFormat = candidate.publicationFormat;
  if (candidate.indexing) oppData.indexing = candidate.indexing;
  if (candidate.submissionUrl) oppData.submissionUrl = candidate.submissionUrl;
  if (candidate.sourceUrl) oppData.sourceUrl = candidate.sourceUrl;
  if (candidate.directions) oppData.directions = candidate.directions;
  if (candidate.suitability) oppData.suitability = candidate.suitability;
  if (candidate.notes) oppData.notes = candidate.notes;
  if (candidate.runId) oppData.runId = candidate.runId;
  if (candidate.discoveredAt) oppData.discoveredAt = candidate.discoveredAt;
  if (candidate.sheetStatus) oppData.sheetStatus = candidate.sheetStatus;

  // A previous attempt may have published the opportunity before failing to
  // mark its candidate. Reuse that document instead of creating a duplicate.
  const previous = await getDocs(query(
    collection(firestore, "opportunities"),
    where("candidateId", "==", candidate.id),
    limit(1)
  ));
  if (!previous.empty && previous.docs[0].data().status !== "published") {
    throw new Error("Cơ hội này đã có bản công bố được lưu trữ. Vui lòng kiểm tra trước khi duyệt lại.");
  }
  const oppRef = previous.empty ? doc(collection(firestore, "opportunities")) : previous.docs[0].ref;
  const candRef = doc(firestore, "opportunityCandidates", candidate.id);
  const batch = writeBatch(firestore);
  if (previous.empty) batch.set(oppRef, { ...oppData, createdAt: now, updatedAt: now });
  batch.update(candRef, {
    status: "approved",
    reviewedBy: actor.email,
    reviewedAt: now,
    updatedAt: now,
  });
  await batch.commit();

  await logAudit(
    actor,
    "APPROVE_CANDIDATE",
    "candidate",
    candidate.id,
    `Duyệt cơ hội Spark: "${candidate.title}" -> công bố sang Opportunities (${oppRef.id})`
  );
}

export async function rejectCandidate(
  candidateId: string,
  candidateTitle: string,
  reason: string,
  actor: { uid: string; email: string; role: UserRole }
) {
  const now = new Date().toISOString();
  const candRef = doc(firestore, "opportunityCandidates", candidateId);
  await updateDoc(candRef, {
    status: "rejected",
    rejectionReason: reason,
    reviewedBy: actor.email,
    reviewedAt: now,
    updatedAt: now,
  });

  await logAudit(
    actor,
    "REJECT_CANDIDATE",
    "candidate",
    candidateId,
    `Từ chối ứng viên cơ hội Spark: "${candidateTitle}" (Lý do: ${reason})`
  );
}

export async function deleteCandidate(
  candidateId: string,
  candidateTitle: string,
  actor: { uid: string; email: string; role: UserRole }
) {
  await deleteDoc(doc(firestore, "opportunityCandidates", candidateId));
  await logAudit(
    actor,
    "DELETE_CANDIDATE",
    "candidate",
    candidateId,
    `Xóa ứng viên cơ hội: "${candidateTitle}"`
  );
}

// ======================== RESEARCH WORKS (TIẾN ĐỘ NCKH) ========================
export async function fetchResearchWorks(
  targetIdentifier?: string,
  isStaff = false
): Promise<ResearchWork[]> {
  let q = query(collection(firestore, "researchWorks"));
  if (targetIdentifier && !isStaff) {
    q = query(collection(firestore, "researchWorks"), where("userId", "==", targetIdentifier));
  }
  const snap = await getDocs(q);
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ResearchWork));

  if (isStaff && targetIdentifier && targetIdentifier !== "all") {
    const term = targetIdentifier.trim().toLowerCase();
    list = list.filter((w) =>
      (w.userId && w.userId.toLowerCase() === term) ||
      (w.userEmail && w.userEmail.toLowerCase() === term)
    );
  }

  return list.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export async function createResearchWork(
  data: Omit<ResearchWork, "id" | "createdAt" | "updatedAt">,
  actor: { uid: string; email: string; role: UserRole }
): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(firestore, "researchWorks"), {
    ...data,
    createdAt: now,
    updatedAt: now,
  });

  // Initial progress entry
  await addDoc(collection(firestore, "researchProgress"), {
    researchId: ref.id,
    userId: data.userId,
    userEmail: data.userEmail,
    status: data.status,
    date: new Date().toLocaleDateString("vi-VN"),
    notes: "Khởi tạo công trình NCKH",
    createdAt: now,
  });

  await logAudit(
    actor,
    "CREATE_RESEARCH_WORK",
    "research",
    ref.id,
    `Tạo mới công trình NCKH: "${data.title}"`
  );
  return ref.id;
}

export async function updateResearchWork(
  id: string,
  data: Partial<ResearchWork>,
  progressNote?: string,
  actor?: { uid: string; email: string; role: UserRole }
) {
  const now = new Date().toISOString();
  const docRef = doc(firestore, "researchWorks", id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: now,
  });

  // If status changed or progress note provided, append to history
  if (data.status || progressNote) {
    const workSnap = await getDoc(docRef);
    const work = workSnap.data() as ResearchWork;
    await addDoc(collection(firestore, "researchProgress"), {
      researchId: id,
      userId: work.userId,
      userEmail: work.userEmail,
      status: data.status || work.status,
      date: new Date().toLocaleDateString("vi-VN"),
      notes: progressNote || `Cập nhật trạng thái thành: ${data.status}`,
      createdAt: now,
    });
  }

  if (actor) {
    await logAudit(
      actor,
      "UPDATE_RESEARCH_WORK",
      "research",
      id,
      `Cập nhật công trình: "${data.title || id}" (Trạng thái: ${data.status || "không đổi"})`
    );
  }
}

export async function updateResearchWorkOnBehalf(
  id: string,
  data: Partial<ResearchWork>,
  progressNote: string,
  actor: { uid: string; email: string; role: UserRole }
) {
  const now = new Date().toISOString();
  const docRef = doc(firestore, "researchWorks", id);
  const workSnap = await getDoc(docRef);
  if (!workSnap.exists()) {
    throw new Error("Không tìm thấy công trình NCKH!");
  }
  const work = workSnap.data() as ResearchWork;

  await updateDoc(docRef, {
    ...data,
    updatedAt: now,
    lastUpdatedBy: actor.email,
    lastUpdatedByRole: actor.role,
    onBehalfOfUserId: work.userId,
  });

  // Append to progress history with actor credentials
  await addDoc(collection(firestore, "researchProgress"), {
    researchId: id,
    userId: work.userId,
    userEmail: work.userEmail,
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    status: data.status || work.status,
    date: new Date().toLocaleDateString("vi-VN"),
    notes: progressNote || `Cập nhật hộ GV bởi ${actor.role.toUpperCase()}: ${actor.email}`,
    createdAt: now,
  });

  await logAudit(
    actor,
    "UPDATE_RESEARCH_WORK_ON_BEHALF",
    "research",
    id,
    `Cập nhật hộ GV ${work.userName} (${work.userEmail}): "${work.title}" - Trạng thái: ${data.status || work.status}`
  );
}

export async function deleteResearchWork(
  id: string,
  title: string,
  actor: { uid: string; email: string; role: UserRole }
) {
  await deleteDoc(doc(firestore, "researchWorks", id));
  await logAudit(
    actor,
    "DELETE_RESEARCH_WORK",
    "research",
    id,
    `Xóa công trình NCKH: "${title}"`
  );
}

// ======================== RESEARCH PROGRESS HISTORY ========================
export async function fetchResearchProgressHistory(
  researchId: string
): Promise<ResearchProgress[]> {
  const q = query(
    collection(firestore, "researchProgress"),
    where("researchId", "==", researchId)
  );
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ResearchProgress));
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ======================== PUBLICATIONS (HỒ SƠ NGHIÊN CỨU) ========================
export async function fetchPublications(
  targetIdentifier?: string,
  isStaff = false
): Promise<Publication[]> {
  let q = query(collection(firestore, "publications"));
  if (targetIdentifier && !isStaff) {
    q = query(collection(firestore, "publications"), where("userId", "==", targetIdentifier));
  }
  const snap = await getDocs(q);
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Publication));

  if (isStaff && targetIdentifier && targetIdentifier !== "all") {
    const term = targetIdentifier.trim().toLowerCase();
    list = list.filter((p) =>
      (p.userId && p.userId.toLowerCase() === term) ||
      (p.userEmail && p.userEmail.toLowerCase() === term)
    );
  }

  return list.sort((a, b) => (b.year || 0) - (a.year || 0));
}

export async function createPublication(
  data: Omit<Publication, "id" | "createdAt" | "updatedAt">,
  actor: { uid: string; email: string; role: UserRole }
): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(firestore, "publications"), {
    ...data,
    createdAt: now,
    updatedAt: now,
  });

  await logAudit(
    actor,
    "CREATE_PUBLICATION",
    "publication",
    ref.id,
    `Thêm công trình vào Hồ sơ nghiên cứu: "${data.title}" (${data.year})`
  );
  return ref.id;
}

export async function updatePublication(
  id: string,
  data: Partial<Publication>,
  actor: { uid: string; email: string; role: UserRole }
) {
  const now = new Date().toISOString();
  const docRef = doc(firestore, "publications", id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: now,
  });

  await logAudit(
    actor,
    "UPDATE_PUBLICATION",
    "publication",
    id,
    `Cập nhật công trình nghiên cứu: "${data.title || id}"`
  );
}

export async function deletePublication(
  id: string,
  title: string,
  actor: { uid: string; email: string; role: UserRole }
) {
  await deleteDoc(doc(firestore, "publications", id));
  await logAudit(
    actor,
    "DELETE_PUBLICATION",
    "publication",
    id,
    `Xóa công trình khỏi hồ sơ: "${title}"`
  );
}

// ======================== CONVERT RESEARCH WORK TO PUBLICATION ========================
export async function convertResearchWorkToPublication(
  research: ResearchWork,
  publicationDetails: {
    year: number;
    publisher?: string;
    journalOrConference?: string;
    volume?: string;
    issue?: string;
    pages?: string;
    isbn?: string;
    issn?: string;
    doi?: string;
    indexing?: string;
    link?: string;
  },
  actor: { uid: string; email: string; role: UserRole }
): Promise<string> {
  const now = new Date().toISOString();

  // 1. Create publication
  const pubRef = await addDoc(collection(firestore, "publications"), {
    userId: research.userId,
    userEmail: research.userEmail,
    userName: research.userName,
    year: publicationDetails.year,
    title: research.title,
    type: research.category,
    role: research.role,
    coAuthors: research.coAuthors || "",
    publisher: publicationDetails.publisher || "",
    journalOrConference: publicationDetails.journalOrConference || research.venue || "",
    volume: publicationDetails.volume || "",
    issue: publicationDetails.issue || "",
    pages: publicationDetails.pages || "",
    isbn: publicationDetails.isbn || "",
    issn: publicationDetails.issn || "",
    doi: publicationDetails.doi || "",
    indexing: publicationDetails.indexing || "",
    link: publicationDetails.link || "",
    notes: research.notes || "",
    sourceResearchId: research.id,
    createdAt: now,
    updatedAt: now,
  });

  // 2. Mark research work as completed & converted
  const researchDocRef = doc(firestore, "researchWorks", research.id);
  await updateDoc(researchDocRef, {
    isCompleted: true,
    status: "Đã xuất bản",
    convertedToPublicationId: pubRef.id,
    convertedBy: actor.email,
    convertedAt: now,
    updatedAt: now,
  });

  // 3. Append progress record with actor credentials
  await addDoc(collection(firestore, "researchProgress"), {
    researchId: research.id,
    userId: research.userId,
    userEmail: research.userEmail,
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    status: "Đã xuất bản",
    date: new Date().toLocaleDateString("vi-VN"),
    notes: `Chuyển vào Hồ sơ nghiên cứu bởi ${actor.role.toUpperCase()}: ${actor.email} (Mã hồ sơ: ${pubRef.id})`,
    createdAt: now,
  });

  await logAudit(
    actor,
    "CONVERT_RESEARCH_TO_PUBLICATION",
    "research",
    research.id,
    `Chuyển công trình "${research.title}" vào Hồ sơ nghiên cứu (${pubRef.id})`
  );

  return pubRef.id;
}

// ======================== RECORD IMPORT BATCH ========================
export async function recordImportBatch(
  batch: ImportBatch,
  actor?: { uid: string; email: string; role: UserRole }
) {
  const ref = await addDoc(collection(firestore, "imports"), {
    ...batch,
    createdAt: serverTimestamp(),
  });

  if (actor) {
    await logAudit(
      actor,
      "IMPORT_BATCH",
      "import",
      ref.id,
      `Nhập dữ liệu [${batch.type}] từ file "${batch.fileName}": Thành công ${batch.successCount}/${batch.totalRows} dòng (Lỗi: ${batch.errorCount})`
    );
  }
}

export async function fetchImports(limitCount = 50): Promise<ImportBatch[]> {
  const q = query(
    collection(firestore, "imports"),
    orderBy("timestamp", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ImportBatch));
}

// ======================== SHARED PERSONNEL MIRROR ========================
export async function fetchSharedPersonnel(): Promise<SharedPersonnelRecord[]> {
  const snap = await getDocs(collection(firestore, "sharedPersonnel"));
  return snap.docs
    .map((d) => d.data() as SharedPersonnelRecord)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "vi"));
}

export async function fetchLatestPersonnelSyncLog(): Promise<PersonnelSyncLog | null> {
  try {
    const q = query(
      collection(firestore, "personnelSyncLogs"),
      orderBy("timestamp", "desc"),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data() as PersonnelSyncLog;
  } catch (err) {
    console.warn("No personnel sync logs found or error reading logs:", err);
    return null;
  }
}

export interface SyncBatchStats {
  totalRows?: number;
  validRows?: number;
  selectedRows?: number;
  skippedByUser?: number;
  selectedCount?: number;
  skippedCount?: number;
  skippedMissingEmailCount?: number;
  skippedInvalidEmailCount?: number;
  skippedDuplicateEmailCount?: number;
  errorsCount?: number;
}

export async function syncSharedPersonnelBatch(
  records: SharedPersonnelRecord[],
  sourceFile: string,
  actor: { uid: string; email: string; role: UserRole },
  stats?: SyncBatchStats
): Promise<PersonnelSyncLog> {
  if (actor.role !== "owner") {
    throw new Error("Chỉ Owner mới có quyền cập nhật danh bạ từ IFA-WORK.");
  }
  const startTime = Date.now();
  const existingRecords = await fetchSharedPersonnel();
  const existingMap = new Map<string, SharedPersonnelRecord>();
  existingRecords.forEach((r) => existingMap.set(r.emailNormalized, r));

  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let deactivatedCount = 0;
  let reactivatedCount = 0;

  const now = new Date().toISOString();
  const toWrite: SharedPersonnelRecord[] = [];
  const seenBatchEmails = new Set<string>();

  for (const record of records) {
    const emailNorm = (record.emailNormalized || "").trim().toLowerCase();
    // Defensive row-level skip: skip if missing email, invalid domain, or duplicate in same batch
    if (!emailNorm || !emailNorm.endsWith("@tdtu.edu.vn") || !record.displayName?.trim()) {
      continue;
    }
    if (seenBatchEmails.has(emailNorm)) {
      continue;
    }
    seenBatchEmails.add(emailNorm);

    const existing = existingMap.get(emailNorm);

    if (!existing) {
      createdCount++;
      toWrite.push({
        ...record,
        emailNormalized: emailNorm,
        displayName: record.displayName.trim(),
        sharedUpdatedAt: now,
      });
    } else {
      let isChanged = false;
      if (existing.active === true && record.active === false) {
        deactivatedCount++;
        isChanged = true;
      } else if (existing.active === false && record.active === true) {
        reactivatedCount++;
        isChanged = true;
      }

      if (
        existing.displayName !== record.displayName ||
        existing.departmentId !== record.departmentId ||
        existing.departmentName !== record.departmentName ||
        existing.lecturerType !== record.lecturerType ||
        existing.academicDegree !== record.academicDegree ||
        (existing.employeeId || "") !== (record.employeeId || "")
      ) {
        isChanged = true;
      }

      if (isChanged) {
        updatedCount++;
        toWrite.push({
          ...record,
          emailNormalized: emailNorm,
          displayName: record.displayName.trim(),
          sharedUpdatedAt: now,
        });
      } else {
        unchangedCount++;
        toWrite.push({
          ...record,
          emailNormalized: emailNorm,
          displayName: record.displayName.trim(),
          sharedUpdatedAt: now,
        });
      }
    }
  }

  // NOTE: SAFETY RULE: Records in existingMap that are MISSING from records array
  // are NOT touched and NOT inactivated!

  // Write sharedPersonnel docs in chunks of 400
  const chunkSize = 400;
  for (let i = 0; i < toWrite.length; i += chunkSize) {
    const chunk = toWrite.slice(i, i + chunkSize);
    const batch = writeBatch(firestore);
    for (const rec of chunk) {
      const cleanDoc: Record<string, any> = {
        id: rec.emailNormalized,
        emailNormalized: rec.emailNormalized,
        displayName: rec.displayName.trim(),
        departmentId: (rec.departmentId || "").trim(),
        departmentName: (rec.departmentName || "Chưa phân ngành").trim(),
        lecturerType: (rec.lecturerType || "lecturer").trim(),
        active: Boolean(rec.active !== false),
        sourceUpdatedAt: rec.sourceUpdatedAt || now,
        sharedUpdatedAt: now,
      };

      if (rec.academicDegree && typeof rec.academicDegree === "string" && rec.academicDegree.trim()) {
        cleanDoc.academicDegree = rec.academicDegree.trim();
      }
      if (rec.employeeId && typeof rec.employeeId === "string" && rec.employeeId.trim()) {
        cleanDoc.employeeId = rec.employeeId.trim();
      }
      if (rec.inactiveAt && typeof rec.inactiveAt === "string" && rec.inactiveAt.trim()) {
        cleanDoc.inactiveAt = rec.inactiveAt.trim();
      }

      const docRef = doc(firestore, "sharedPersonnel", rec.emailNormalized);
      batch.set(docRef, cleanDoc);
    }
    await batch.commit();
  }

  const durationMs = Date.now() - startTime;
  const totalRows = stats?.totalRows ?? records.length;
  const validRows = stats?.validRows ?? records.length;
  const selectedRows = stats?.selectedRows ?? toWrite.length;
  const skippedByUser = stats?.skippedByUser ?? Math.max(0, validRows - selectedRows);
  const skippedCount = stats?.skippedCount ?? Math.max(0, totalRows - validRows + skippedByUser);
  const skippedMissingEmailCount = stats?.skippedMissingEmailCount ?? 0;
  const skippedInvalidEmailCount = stats?.skippedInvalidEmailCount ?? 0;
  const skippedDuplicateEmailCount = stats?.skippedDuplicateEmailCount ?? 0;
  const errorsCount = stats?.errorsCount ?? 0;

  const logId = `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const logData: PersonnelSyncLog = {
    id: logId,
    timestamp: now,
    method: "manual_json",
    triggeredBy: actor.email,
    sourceFile,
    schemaVersion: 1,
    totalRecords: totalRows,
    createdCount,
    updatedCount,
    unchangedCount,
    deactivatedCount,
    reactivatedCount,
    durationMs,
    totalRows,
    validRows,
    selectedRows,
    skippedByUser,
    selectedCount: selectedRows,
    skippedCount,
    skippedMissingEmailCount,
    skippedInvalidEmailCount,
    skippedDuplicateEmailCount,
    errorsCount,
    created: createdCount,
    updated: updatedCount,
    unchanged: unchangedCount,
    inactive: deactivatedCount,
    reactivated: reactivatedCount,
    skipped: skippedCount,
    skippedMissingEmail: skippedMissingEmailCount,
    skippedInvalidEmail: skippedInvalidEmailCount,
    skippedDuplicateEmail: skippedDuplicateEmailCount,
    errors: errorsCount,
  };

  await setDoc(doc(firestore, "personnelSyncLogs", logId), logData);

  await logAudit(
    actor,
    "SYNC_SHARED_PERSONNEL",
    "import",
    logId,
    `Đồng bộ danh bạ dùng chung từ IFA-WORK: ${selectedRows}/${totalRows} bản ghi được chọn (+${createdCount} mới, ~${updatedCount} cập nhật, -${deactivatedCount} ngừng CT, ${skippedCount} bỏ qua gồm ${skippedByUser} bỏ qua theo lựa chọn) trong ${durationMs}ms.`
  );

  return logData;
}

// ======================== RESEARCH PERSONNEL SETTINGS (ARCHIVE/ACTIVE) ========================

export async function fetchResearchPersonnelSettings(): Promise<Map<string, ResearchPersonnelSettings>> {
  const map = new Map<string, ResearchPersonnelSettings>();
  try {
    const snap = await getDocs(collection(firestore, "researchPersonnelSettings"));
    snap.docs.forEach((d) => {
      const data = d.data() as ResearchPersonnelSettings;
      const key = (data.emailNormalized || d.id).toLowerCase().trim();
      if (key) map.set(key, data);
    });
  } catch (err) {
    console.warn("Could not fetch researchPersonnelSettings:", err);
  }
  return map;
}

export async function setResearchTrackingStatus(
  emailNormalized: string,
  trackingStatus: ResearchTrackingStatus,
  actor: { uid: string; email: string; role: UserRole },
  archiveReason?: string
): Promise<ResearchPersonnelSettings> {
  if (actor.role !== "owner") {
    throw new Error("Chỉ Owner mới có quyền thay đổi trạng thái theo dõi NCKH của giảng viên.");
  }
  const cleanEmail = emailNormalized.toLowerCase().trim();
  if (!cleanEmail) {
    throw new Error("Email giảng viên không hợp lệ.");
  }

  const now = new Date().toISOString();
  const docRef = doc(firestore, "researchPersonnelSettings", cleanEmail);
  const snap = await getDoc(docRef);
  const before = snap.exists() ? (snap.data() as ResearchPersonnelSettings) : null;
  const oldStatus = before?.researchTrackingStatus || "ACTIVE";

  const settings: ResearchPersonnelSettings = {
    emailNormalized: cleanEmail,
    researchTrackingStatus: trackingStatus,
    updatedAt: now,
    archivedAt: trackingStatus === "ARCHIVED" ? (before?.archivedAt || now) : null,
    archivedBy: trackingStatus === "ARCHIVED" ? actor.email : null,
  };
  if (archiveReason && archiveReason.trim()) {
    settings.archiveReason = archiveReason.trim();
  } else if (before?.archiveReason) {
    settings.archiveReason = before.archiveReason;
  }

  const cleanDoc: Record<string, any> = {
    emailNormalized: settings.emailNormalized,
    researchTrackingStatus: settings.researchTrackingStatus,
    updatedAt: settings.updatedAt,
  };
  if (settings.archivedAt) cleanDoc.archivedAt = settings.archivedAt;
  if (settings.archivedBy) cleanDoc.archivedBy = settings.archivedBy;
  if (settings.archiveReason) cleanDoc.archiveReason = settings.archiveReason;

  await setDoc(docRef, cleanDoc);

  const actionName = trackingStatus === "ARCHIVED" ? "LECTURER_RESEARCH_ARCHIVED" : "LECTURER_RESEARCH_RESTORED";
  const summary = trackingStatus === "ARCHIVED"
    ? `Lưu trữ NCKH giảng viên ${cleanEmail} (trước đó: ${oldStatus}).`
    : `Khôi phục theo dõi NCKH giảng viên ${cleanEmail} (trước đó: ${oldStatus}).`;

  await logAudit(actor, actionName, "user", cleanEmail, summary);

  return settings;
}

export async function setResearchTrackingStatusBatch(
  emailsNormalized: string[],
  trackingStatus: ResearchTrackingStatus,
  actor: { uid: string; email: string; role: UserRole },
  archiveReason?: string
): Promise<number> {
  if (actor.role !== "owner") {
    throw new Error("Chỉ Owner mới có quyền thay đổi trạng thái theo dõi NCKH của giảng viên.");
  }
  const now = new Date().toISOString();
  const validEmails = Array.from(
    new Set(
      emailsNormalized
        .map((e) => (e || "").toLowerCase().trim())
        .filter((e) => e && e.endsWith("@tdtu.edu.vn"))
    )
  );

  if (validEmails.length === 0) return 0;

  const chunkSize = 400;
  for (let i = 0; i < validEmails.length; i += chunkSize) {
    const chunk = validEmails.slice(i, i + chunkSize);
    const batch = writeBatch(firestore);

    for (const email of chunk) {
      const docRef = doc(firestore, "researchPersonnelSettings", email);
      const cleanDoc: Record<string, any> = {
        emailNormalized: email,
        researchTrackingStatus: trackingStatus,
        updatedAt: now,
      };
      if (trackingStatus === "ARCHIVED") {
        cleanDoc.archivedAt = now;
        cleanDoc.archivedBy = actor.email;
        if (archiveReason && archiveReason.trim()) {
          cleanDoc.archiveReason = archiveReason.trim();
        }
      } else {
        cleanDoc.archivedAt = null;
        cleanDoc.archivedBy = null;
        cleanDoc.archiveReason = null;
      }
      batch.set(docRef, cleanDoc);
    }

    await batch.commit();
  }

  const actionName = trackingStatus === "ARCHIVED" ? "LECTURERS_RESEARCH_BATCH_ARCHIVED" : "LECTURERS_RESEARCH_BATCH_RESTORED";
  const summary = trackingStatus === "ARCHIVED"
    ? `Lưu trữ NCKH hàng loạt cho ${validEmails.length} giảng viên.`
    : `Khôi phục theo dõi NCKH hàng loạt cho ${validEmails.length} giảng viên.`;

  await logAudit(actor, actionName, "user", `${validEmails.length}_lecturers`, summary);

  return validEmails.length;
}

