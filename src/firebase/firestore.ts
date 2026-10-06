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

// ======================== USERS & ROLES ========================
export async function fetchAllUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(collection(firestore, "users"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserProfile));
}

export async function fetchActiveLecturers(): Promise<UserProfile[]> {
  const q = query(collection(firestore, "users"), where("active", "==", true));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserProfile));
  return list.sort((a, b) => a.name.localeCompare(b.name, "vi"));
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

  const id = `prov_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const now = new Date().toISOString();
  await setDoc(doc(firestore, "users", id), {
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
  });

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
  const ref = await addDoc(collection(firestore, "opportunityCandidates"), {
    ...data,
    normalizedTitle: normalizeText(data.title),
    createdAt: now,
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

  // 1. Create published opportunity
  const oppData: Omit<Opportunity, "id" | "createdAt" | "updatedAt"> = {
    title: candidate.title,
    organizer: candidate.organizer,
    country: candidate.country,
    type: candidate.type,
    level: candidate.level,
    topic: candidate.topic,
    field: candidate.field,
    tags: candidate.tags || [],
    deadline: candidate.deadline,
    abstractDeadline: candidate.abstractDeadline,
    fullPaperDeadline: candidate.fullPaperDeadline,
    registrationDeadline: candidate.registrationDeadline,
    eventDate: candidate.eventDate,
    location: candidate.location,
    fee: candidate.fee,
    publicationFormat: candidate.publicationFormat,
    indexing: candidate.indexing,
    content: candidate.content,
    submissionUrl: candidate.submissionUrl,
    sourceUrl: candidate.sourceUrl,
    directions: candidate.directions,
    sourceType: "SPARK",
    status: "published",
    candidateId: candidate.id,
    createdBy: actor.email,
  };

  const oppRef = await addDoc(collection(firestore, "opportunities"), {
    ...oppData,
    createdAt: now,
    updatedAt: now,
  });

  // 2. Mark candidate as approved
  const candRef = doc(firestore, "opportunityCandidates", candidate.id);
  await updateDoc(candRef, {
    status: "approved",
    reviewedBy: actor.email,
    reviewedAt: now,
    updatedAt: now,
  });

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
export async function fetchResearchWorks(userId?: string): Promise<ResearchWork[]> {
  let q = query(collection(firestore, "researchWorks"));
  if (userId) {
    q = query(collection(firestore, "researchWorks"), where("userId", "==", userId));
  }
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ResearchWork));
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
export async function fetchPublications(userId?: string): Promise<Publication[]> {
  let q = query(collection(firestore, "publications"));
  if (userId) {
    q = query(collection(firestore, "publications"), where("userId", "==", userId));
  }
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Publication));
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

export async function syncSharedPersonnelBatch(
  records: SharedPersonnelRecord[],
  sourceFile: string,
  actor: { uid: string; email: string; role: UserRole }
): Promise<PersonnelSyncLog> {
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

  for (const record of records) {
    const emailNorm = record.emailNormalized.trim().toLowerCase();
    const existing = existingMap.get(emailNorm);

    if (!existing) {
      createdCount++;
      toWrite.push({
        ...record,
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
          sharedUpdatedAt: now,
        });
      } else {
        unchangedCount++;
        toWrite.push({
          ...record,
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
      const docRef = doc(firestore, "sharedPersonnel", rec.emailNormalized);
      batch.set(docRef, rec, { merge: true });

      // If user profile doc exists with provisioned/matching email, keep profile synced while preserving role
      const userRef = doc(firestore, "users", `prov_${rec.emailNormalized}`);
      batch.set(
        userRef,
        {
          id: `prov_${rec.emailNormalized}`,
          uid: `prov_${rec.emailNormalized}`,
          email: rec.emailNormalized,
          name: rec.displayName,
          department: rec.departmentName,
          academicDegree: rec.academicDegree,
          active: rec.active,
          updatedAt: now,
        },
        { merge: true }
      );
    }
    await batch.commit();
  }

  const durationMs = Date.now() - startTime;
  const logId = `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const logData: PersonnelSyncLog = {
    id: logId,
    timestamp: now,
    method: "manual_json",
    triggeredBy: actor.email,
    sourceFile,
    schemaVersion: 1,
    totalRecords: records.length,
    createdCount,
    updatedCount,
    unchangedCount,
    deactivatedCount,
    reactivatedCount,
    durationMs,
  };

  await setDoc(doc(firestore, "personnelSyncLogs", logId), logData);

  await logAudit(
    actor,
    "SYNC_SHARED_PERSONNEL",
    "import",
    logId,
    `Đồng bộ danh bạ dùng chung từ IFA-WORK: ${records.length} bản ghi (+${createdCount} mới, ~${updatedCount} cập nhật, -${deactivatedCount} ngừng CT) trong ${durationMs}ms.`
  );

  return logData;
}

