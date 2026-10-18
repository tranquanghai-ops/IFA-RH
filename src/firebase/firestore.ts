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
  onSnapshot,
  runTransaction,
  deleteField,
  type DocumentReference,
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
import { normalizeCanonicalUrl, extractConferenceYear, computeOpportunityDiff } from "../utils/researchDedupe";
import { validateOpportunityForm, validateAndNormalizeDate } from "../utils/opportunityValidation";

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
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as AuditLog));
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
  const rawList = snap.docs.map((d) => ({ ...d.data(), id: d.id } as UserProfile));
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
      .map((d) => ({ ...d.data(), id: d.id } as UserProfile))
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
    return { ...snap.data(), id: snap.id } as UserProfile;
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
  const list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Opportunity));
  // Sort descending by deadline or createdAt
  return list.sort((a, b) => (b.deadline || b.createdAt).localeCompare(a.deadline || a.createdAt));
}

export async function fetchAllOpportunities(): Promise<Opportunity[]> {
  const snap = await getDocs(collection(firestore, "opportunities"));
  const list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Opportunity));
  return list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

async function getNextConferenceCode(category: "TN" | "QT"): Promise<string> {
  try {
    const oppsSnap = await getDocs(collection(firestore, "opportunities"));
    let maxNum = 0;
    oppsSnap.docs.forEach((d) => {
      const code = d.data().conferenceCode;
      if (code && typeof code === "string" && code.startsWith(category)) {
        const num = parseInt(code.slice(2), 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    return `${category}${String(maxNum + 1).padStart(4, "0")}`;
  } catch {
    return `${category}0001`;
  }
}

export async function createOpportunity(
  data: Omit<Opportunity, "id" | "createdAt" | "updatedAt">,
  actor: { uid: string; email: string; role: UserRole }
): Promise<string> {
  const now = new Date().toISOString();

  // Validate and sanitize data
  const valResult = validateOpportunityForm(data);
  if (!valResult.isValid) {
    const firstErr = Object.values(valResult.errors)[0];
    throw new Error(firstErr || "Dữ liệu cơ hội không hợp lệ.");
  }

  const sanitized = valResult.sanitized!;
  const category = sanitized.category || (sanitized.level === "Quốc tế" ? "QT" : "TN");

  let conferenceCode = sanitized.conferenceCode;
  if (!conferenceCode) {
    conferenceCode = await getNextConferenceCode(category);
  }

  const payload: any = {
    ...sanitized,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.email,
    updatedBy: actor.email,
  };
  if (conferenceCode) payload.conferenceCode = conferenceCode;

  // Clean any remaining undefined
  const cleanPayload: any = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v !== undefined) cleanPayload[k] = v;
  }

  const ref = await addDoc(collection(firestore, "opportunities"), cleanPayload);

  await logAudit(
    actor,
    "CREATE_OPPORTUNITY",
    "opportunity",
    ref.id,
    `Đăng mới cơ hội NCKH: "${sanitized.title}" (${conferenceCode || "Chưa có mã"})`
  );
  return ref.id;
}

export async function updateOpportunity(
  id: string,
  data: Partial<Opportunity>,
  actor: { uid: string; email: string; role: UserRole }
) {
  const docRef = doc(firestore, "opportunities", id);
  const now = new Date().toISOString();

  const updatePayload: Record<string, any> = {
    updatedAt: now,
    updatedBy: actor.email,
  };

  const mutableFields = [
    "title", "organizer", "country", "type", "level", "topic",
    "field", "tags", "deadline", "abstractDeadline", "fullPaperDeadline",
    "registrationDeadline", "eventDate", "location", "fee", "publicationFormat",
    "indexing", "content", "submissionUrl", "sourceUrl", "directions",
    "suitability", "notes", "runId", "discoveredAt", "sheetStatus",
    "status", "publicationFee", "registrationFee", "feeStatus", "feeSourceUrl",
    "detailedContent", "topicsDetailed", "recalledAt", "recalledBy", "hiddenAt", "hiddenBy",
    "normalizedTitle", "editedByAdmin", "manualOverrides", "conferenceCode", "category", "lastUpdated"
  ] as const;

  for (const f of mutableFields) {
    if (f in data) {
      const val = (data as any)[f];
      if (val !== undefined) {
        if (f === "category" && val !== "TN" && val !== "QT") continue;
        if (f === "feeStatus" && !["SPECIFIED", "UNKNOWN", "FREE"].includes(val)) continue;
        updatePayload[f] = val;
      }
    }
  }

  // Date normalization if dates were passed
  if (updatePayload.deadline) {
    const check = validateAndNormalizeDate(updatePayload.deadline);
    if (check.normalized) updatePayload.deadline = check.normalized;
  }
  for (const df of ["abstractDeadline", "fullPaperDeadline", "registrationDeadline", "eventDate"] as const) {
    if (updatePayload[df]) {
      const check = validateAndNormalizeDate(updatePayload[df]);
      if (check.normalized) updatePayload[df] = check.normalized;
    }
  }

  // CRITICAL: Ensure immutable fields are never present in update payload
  delete updatePayload.createdAt;
  delete updatePayload.createdBy;
  delete updatePayload.id;

  await updateDoc(docRef, updatePayload);

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

export async function hideOpportunity(
  id: string,
  actor: { uid: string; email: string; role: UserRole }
) {
  const now = new Date().toISOString();
  const oppRef = doc(firestore, "opportunities", id);
  await updateDoc(oppRef, {
    status: "hidden",
    hiddenAt: now,
    hiddenBy: actor.email,
    updatedAt: now,
    updatedBy: actor.email,
  });

  await logAudit(
    actor,
    "HIDE_OPPORTUNITY",
    "opportunity",
    id,
    `Ẩn cơ hội NCKH khỏi trang công khai (ID: ${id})`
  );
}

export async function republishOpportunity(
  id: string,
  actor: { uid: string; email: string; role: UserRole }
) {
  const now = new Date().toISOString();
  const oppRef = doc(firestore, "opportunities", id);
  await updateDoc(oppRef, {
    status: "published",
    updatedAt: now,
    updatedBy: actor.email,
  });

  await logAudit(
    actor,
    "REPUBLISH_OPPORTUNITY",
    "opportunity",
    id,
    `Công bố lại cơ hội NCKH lên trang công khai (ID: ${id})`
  );
}

export async function recallOpportunityToCandidateQueue(
  opp: Opportunity,
  actor: { uid: string; email: string; role: UserRole }
) {
  if (opp.sourceType !== "SPARK") {
    throw new Error("Chỉ có thể thu hồi các cơ hội được tạo từ hệ thống AI / Spark.");
  }
  const now = new Date().toISOString();
  const batch = writeBatch(firestore);

  // 1. Mark opportunity status as recalled
  const oppRef = doc(firestore, "opportunities", opp.id);
  batch.update(oppRef, {
    status: "recalled",
    recalledAt: now,
    recalledBy: actor.email,
    updatedAt: now,
    updatedBy: actor.email,
  });

  // 2. Identify or reconstruct candidate doc
  let candRef: DocumentReference;
  if (opp.candidateId) {
    candRef = doc(firestore, "opportunityCandidates", opp.candidateId);
    batch.update(candRef, {
      status: "pending",
      publishedOpportunityId: opp.id,
      recalledAt: now,
      recalledBy: actor.email,
      updatedAt: now,
      updatedBy: actor.email,
    });
  } else {
    const norm = normalizeText(opp.title);
    const existingSnap = await getDocs(
      query(
        collection(firestore, "opportunityCandidates"),
        where("normalizedTitle", "==", norm),
        limit(1)
      )
    );
    if (!existingSnap.empty) {
      candRef = existingSnap.docs[0].ref;
      batch.update(candRef, {
        status: "pending",
        publishedOpportunityId: opp.id,
        recalledAt: now,
        recalledBy: actor.email,
        updatedAt: now,
        updatedBy: actor.email,
      });
      batch.update(oppRef, { candidateId: candRef.id });
    } else {
      candRef = doc(collection(firestore, "opportunityCandidates"));
      const candData: any = {
        title: opp.title,
        organizer: opp.organizer,
        country: opp.country || "Việt Nam",
        type: opp.type,
        level: opp.level,
        topic: opp.topic || "",
        field: opp.field || "",
        tags: opp.tags || [],
        deadline: opp.deadline,
        content: opp.content || "",
        sourceType: "SPARK",
        status: "pending",
        publishedOpportunityId: opp.id,
        recalledAt: now,
        recalledBy: actor.email,
        normalizedTitle: norm,
        createdAt: opp.createdAt || now,
        updatedAt: now,
        updatedBy: actor.email,
      };
      if (opp.abstractDeadline) candData.abstractDeadline = opp.abstractDeadline;
      if (opp.fullPaperDeadline) candData.fullPaperDeadline = opp.fullPaperDeadline;
      if (opp.registrationDeadline) candData.registrationDeadline = opp.registrationDeadline;
      if (opp.eventDate) candData.eventDate = opp.eventDate;
      if (opp.location) candData.location = opp.location;
      if (opp.fee) candData.fee = opp.fee;
      if (opp.publicationFee) candData.publicationFee = opp.publicationFee;
      if (opp.registrationFee) candData.registrationFee = opp.registrationFee;
      if (opp.feeStatus) candData.feeStatus = opp.feeStatus;
      if (opp.feeSourceUrl) candData.feeSourceUrl = opp.feeSourceUrl;
      if (opp.detailedContent) candData.detailedContent = opp.detailedContent;
      if (opp.topicsDetailed) candData.topicsDetailed = opp.topicsDetailed;
      if (opp.publicationFormat) candData.publicationFormat = opp.publicationFormat;
      if (opp.indexing) candData.indexing = opp.indexing;
      if (opp.submissionUrl) candData.submissionUrl = opp.submissionUrl;
      if (opp.sourceUrl) candData.sourceUrl = opp.sourceUrl;
      if (opp.directions) candData.directions = opp.directions;
      if (opp.suitability) candData.suitability = opp.suitability;
      if (opp.notes) candData.notes = opp.notes;
      if (opp.runId) candData.runId = opp.runId;
      if (opp.discoveredAt) candData.discoveredAt = opp.discoveredAt;
      if (opp.sheetStatus) candData.sheetStatus = opp.sheetStatus;

      batch.set(candRef, candData);
      batch.update(oppRef, { candidateId: candRef.id });
    }
  }

  // 3. Auto-close any pending update proposals associated with this opportunity
  try {
    const stalePropsSnap = await getDocs(
      query(
        collection(firestore, "opportunityCandidates"),
        where("publishedOpportunityId", "==", opp.id)
      )
    );
    stalePropsSnap.docs.forEach((pDoc) => {
      if (pDoc.id !== candRef.id) {
        const pData = pDoc.data();
        if (["pending", "needs_review"].includes(pData.status)) {
          batch.update(pDoc.ref, {
            status: "rejected",
            resolutionType: "ADMIN_REJECTED",
            rejectionReason: `Hội thảo gốc đã được Admin (${actor.email}) thu hồi về hàng chờ duyệt ban đầu. Đề xuất cập nhật này bị hủy tương ứng.`,
            reviewedBy: actor.email,
            reviewedAt: now,
            updatedAt: now,
            updatedBy: actor.email,
          });
        }
      }
    });
  } catch (err) {
    console.warn("Could not query stale update proposals during recall:", err);
  }

  await batch.commit();

  await logAudit(
    actor,
    "RECALL_OPPORTUNITY",
    "opportunity",
    opp.id,
    `Thu hồi cơ hội Spark về hàng chờ AI duyệt: "${opp.title}" (Candidate: ${candRef.id})`
  );
}

export async function recallOpportunityCandidate(
  cand: OpportunityCandidate,
  actor: { uid: string; email: string; role: UserRole }
) {
  const now = new Date().toISOString();
  const batch = writeBatch(firestore);

  // 1. Identify candidate doc ref
  const candRef = await resolveCandidateDocRef(cand.id);

  // 2. Identify and recall the published opportunity if linked or matching
  let matchedOppId: string | null = cand.publishedOpportunityId || null;
  if (!matchedOppId) {
    const oppsSnap = await getDocs(
      query(collection(firestore, "opportunities"), where("status", "==", "published"))
    );
    const norm = cand.normalizedTitle || normalizeText(cand.title);
    const found = oppsSnap.docs.find((d) => {
      const data = d.data();
      return (
        data.candidateId === cand.id ||
        (data.title && normalizeText(data.title) === norm) ||
        (data.sourceUrl && cand.sourceUrl && data.sourceUrl === cand.sourceUrl)
      );
    });
    if (found) {
      matchedOppId = found.id;
    }
  }

  const candUpdate: any = {
    status: "pending",
    recalledAt: now,
    recalledBy: actor.email,
    updatedAt: now,
    updatedBy: actor.email,
  };

  // If candidate was an approved full opportunity, clear resolutionType so it displays cleanly in pending
  if (cand.changeType !== "update" && cand.resolutionType === "APPROVED_UPDATE") {
    candUpdate.resolutionType = deleteField();
  }

  if (matchedOppId) {
    candUpdate.publishedOpportunityId = matchedOppId;
    const oppRef = doc(firestore, "opportunities", matchedOppId);
    batch.update(oppRef, {
      status: "recalled",
      recalledAt: now,
      recalledBy: actor.email,
      updatedAt: now,
      updatedBy: actor.email,
      candidateId: cand.id,
    });

    // Auto-close any other pending update proposals for this opportunity
    try {
      const stalePropsSnap = await getDocs(
        query(
          collection(firestore, "opportunityCandidates"),
          where("publishedOpportunityId", "==", matchedOppId)
        )
      );
      stalePropsSnap.docs.forEach((pDoc) => {
        if (pDoc.id !== candRef.id) {
          const pData = pDoc.data();
          if (["pending", "needs_review"].includes(pData.status)) {
            batch.update(pDoc.ref, {
              status: "rejected",
              resolutionType: "ADMIN_REJECTED",
              rejectionReason: `Hội thảo gốc đã được Admin (${actor.email}) thu hồi về hàng chờ duyệt ban đầu. Đề xuất cập nhật này bị hủy tương ứng.`,
              reviewedBy: actor.email,
              reviewedAt: now,
              updatedAt: now,
              updatedBy: actor.email,
            });
          }
        }
      });
    } catch (err) {
      console.warn("Could not query stale update proposals during candidate recall:", err);
    }
  }

  batch.update(candRef, candUpdate);
  await batch.commit();

  await logAudit(
    actor,
    "RECALL_OPPORTUNITY",
    "opportunity",
    matchedOppId || cand.id,
    `Thu hồi hội thảo đã duyệt "${cand.title}" về hàng chờ AI duyệt (Candidate ID: ${cand.id})`
  );
}

// ======================== OPPORTUNITY CANDIDATES (SPARK) ========================
export async function fetchOpportunityCandidates(): Promise<OpportunityCandidate[]> {
  const snap = await getDocs(collection(firestore, "opportunityCandidates"));
  const list = snap.docs.map(
    (d) => ({ ...d.data(), id: d.id } as OpportunityCandidate)
  );
  return list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

async function resolveCandidateDocRef(candidateId: string): Promise<DocumentReference> {
  const directRef = doc(firestore, "opportunityCandidates", candidateId);
  try {
    const directSnap = await getDoc(directRef);
    if (directSnap.exists()) {
      return directRef;
    }
    const fallbackSnap = await getDocs(
      query(
        collection(firestore, "opportunityCandidates"),
        where("id", "==", candidateId),
        limit(1)
      )
    );
    if (!fallbackSnap.empty) {
      return fallbackSnap.docs[0].ref;
    }
  } catch {
    // Fallback to directRef if lookup fails
  }
  return directRef;
}

export async function addCandidate(
  data: Omit<OpportunityCandidate, "id" | "createdAt" | "updatedAt" | "normalizedTitle">,
  actor?: { uid: string; email: string; role: UserRole }
): Promise<string> {
  const now = new Date().toISOString();
  
  // Clean undefined properties and any conflicting internal id for Firestore safety
  const cleanData: any = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && k !== "id") {
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

  const resolvedTitle = String(candidate.title || "").trim();
  if (!resolvedTitle) {
    throw new Error("Chưa thể công bố: thiếu tiêu đề hội thảo / cơ hội NCKH.");
  }

  const resolvedOrganizer = String(candidate.organizer || "Đang cập nhật").trim();
  const resolvedCountry = String(candidate.country || "Việt Nam").trim();
  const resolvedType = candidate.type || "Hội thảo";
  const resolvedLevel = candidate.level || "Quốc tế";
  const resolvedTopic = String(candidate.topic || candidate.field || resolvedTitle || "Nghiên cứu khoa học").trim();
  const resolvedField = String(candidate.field || "Chung Khoa MTCN").trim();
  const resolvedDeadline = String(
    candidate.deadline ||
      candidate.fullPaperDeadline ||
      candidate.abstractDeadline ||
      candidate.registrationDeadline ||
      candidate.eventDate ||
      "Đang cập nhật"
  ).trim();
  const resolvedContent = String(
    candidate.content || candidate.detailedContent || resolvedTitle || "Thông tin cơ hội NCKH"
  ).trim();

  const candRef = await resolveCandidateDocRef(candidate.id);
  const resolvedCandId = candRef.id;

  // 1. Prepare published opportunity data
  const oppData: any = {
    title: resolvedTitle,
    organizer: resolvedOrganizer,
    country: resolvedCountry,
    type: resolvedType,
    level: resolvedLevel,
    topic: resolvedTopic,
    field: resolvedField,
    tags: Array.isArray(candidate.tags) ? candidate.tags : [],
    deadline: resolvedDeadline,
    content: resolvedContent,
    sourceType: "SPARK",
    status: "published",
    candidateId: resolvedCandId,
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
  if (candidate.conferenceCode) oppData.conferenceCode = candidate.conferenceCode;
  if (candidate.category) oppData.category = candidate.category;
  if (candidate.lastUpdated) oppData.lastUpdated = candidate.lastUpdated;

  // 2. Check if candidate is linked to an existing opportunity
  let targetOppId = candidate.publishedOpportunityId || null;
  if (!targetOppId) {
    const previous = await getDocs(
      query(
        collection(firestore, "opportunities"),
        where("candidateId", "==", resolvedCandId),
        limit(1)
      )
    );
    if (!previous.empty) {
      targetOppId = previous.docs[0].id;
    }
  }

  // 2b. If still unlinked, search existing opportunities by conferenceCode to prevent duplicate creation
  if (!targetOppId && candidate.conferenceCode) {
    const codeSnap = await getDocs(
      query(
        collection(firestore, "opportunities"),
        where("conferenceCode", "==", candidate.conferenceCode),
        limit(1)
      )
    );
    if (!codeSnap.empty) {
      targetOppId = codeSnap.docs[0].id;
    }
  }

  // 2c. If still unlinked, search existing opportunities by normalized title & year, or sourceUrl
  if (!targetOppId) {
    const oppsSnap = await getDocs(collection(firestore, "opportunities"));
    const norm = candidate.normalizedTitle || normalizeText(resolvedTitle);
    const candYear =
      extractConferenceYear(resolvedTitle) ||
      extractConferenceYear(candidate.eventDate) ||
      extractConferenceYear(candidate.deadline);
    const candSource = normalizeCanonicalUrl(candidate.sourceUrl);

    for (const d of oppsSnap.docs) {
      const o = d.data();
      const oNorm = normalizeText(o.title || "");
      const oYear =
        extractConferenceYear(o.title) ||
        extractConferenceYear(o.eventDate) ||
        extractConferenceYear(o.deadline);
      const oSource = normalizeCanonicalUrl(o.sourceUrl);

      // Exact title match (must match year if both present)
      if (oNorm && oNorm === norm && (!candYear || !oYear || candYear === oYear)) {
        targetOppId = d.id;
        break;
      }
      // Canonical URL match
      if (candSource && oSource && candSource === oSource && candSource.length > 8) {
        if (!candYear || !oYear || candYear === oYear) {
          targetOppId = d.id;
          break;
        }
      }
    }
  }

  const helperAutoCloseRelatedProposals = async (batchRef: any, oppId: string, latestOppData: any) => {
    try {
      const relatedSnap = await getDocs(
        query(
          collection(firestore, "opportunityCandidates"),
          where("publishedOpportunityId", "==", oppId)
        )
      );
      relatedSnap.docs.forEach((pDoc) => {
        if (pDoc.id !== resolvedCandId) {
          const pData = pDoc.data();
          if (["pending", "needs_review"].includes(pData.status)) {
            // Check if this pending proposal still has substantive unmerged changes compared to latest published opportunity
            const diffAgainstNewOpp = computeOpportunityDiff(latestOppData, pData as any);
            if (!diffAgainstNewOpp.hasChanges) {
              // Completely redundant proposal -> safe to auto-close
              batchRef.update(pDoc.ref, {
                status: "closed",
                resolutionType: "AUTO_CLOSED",
                rejectionReason: `Đã hoàn tất duyệt hội thảo (${actor.email}). Toàn bộ nội dung trong đề xuất này đã hoàn toàn trùng khớp với thông tin công bố mới nhất.`,
                reviewedBy: actor.email,
                reviewedAt: now,
                updatedAt: now,
                updatedBy: actor.email,
              });
            } else {
              // Proposal still has unmerged substantive changes -> preserve pending for Admin review
              // Update diffSummary to reflect remaining diff against new published state
              batchRef.update(pDoc.ref, {
                diffSummary: diffAgainstNewOpp.diffSummary,
                updatedAt: now,
                updatedBy: "SYSTEM_SYNC",
              });
            }
          }
        }
      });
    } catch (err) {
      console.warn("Could not auto-close related update proposals on approve:", err);
    }
  };

  if (targetOppId) {
    const oppRef = doc(firestore, "opportunities", targetOppId);
    const oppSnap = await getDoc(oppRef);
    if (oppSnap.exists()) {
      const currentOpp = oppSnap.data();

      // Preserve immutable fields and existing admin state
      const updateOppData: any = {
        ...oppData,
        createdAt: currentOpp.createdAt || now,
        createdBy: currentOpp.createdBy || actor.email,
        status: "published",
        updatedAt: now,
        updatedBy: actor.email,
      };
      if (currentOpp.manualOverrides) {
        updateOppData.manualOverrides = currentOpp.manualOverrides;
      }
      if (currentOpp.editedByAdmin !== undefined) {
        updateOppData.editedByAdmin = currentOpp.editedByAdmin;
      }
      if (candidate.conferenceCode) updateOppData.conferenceCode = candidate.conferenceCode;
      if (candidate.category) updateOppData.category = candidate.category;
      if (candidate.lastUpdated) updateOppData.lastUpdated = candidate.lastUpdated;

      // Clean undefined fields
      const cleanUpdate: any = {};
      for (const [k, v] of Object.entries(updateOppData)) {
        if (v !== undefined) cleanUpdate[k] = v;
      }
      // CRITICAL: Strip immutable fields from update payload to prevent rules rejection
      delete cleanUpdate.createdAt;
      delete cleanUpdate.createdBy;

      const batch = writeBatch(firestore);
      batch.update(oppRef, cleanUpdate);
      batch.update(candRef, {
        status: "approved",
        resolutionType: "APPROVED_UPDATE",
        reviewedBy: actor.email,
        reviewedAt: now,
        publishedOpportunityId: targetOppId,
        updatedBy: actor.email,
        updatedAt: now,
      });

      await helperAutoCloseRelatedProposals(batch, targetOppId, cleanUpdate);
      await batch.commit();

      await logAudit(
        actor,
        "APPROVE_CANDIDATE",
        "opportunity",
        targetOppId,
        `Duyệt cơ hội Spark: "${resolvedTitle}" -> cập nhật Opportunities (${targetOppId})`
      );
      return;
    }
  }

  if (candidate.normalizedTitle) oppData.normalizedTitle = candidate.normalizedTitle;

  // 3. Brand new candidate approval -> Create new published opportunity
  const oppRef = doc(collection(firestore, "opportunities"));
  const newOppData: any = {
    ...oppData,
    id: oppRef.id,
    createdAt: now,
    updatedAt: now,
    updatedBy: actor.email,
  };

  // Clean undefined fields to ensure Firestore DocumentReference.set() succeeds
  const cleanNewOppData: any = {};
  for (const [k, v] of Object.entries(newOppData)) {
    if (v !== undefined) cleanNewOppData[k] = v;
  }

  const batch = writeBatch(firestore);
  batch.set(oppRef, cleanNewOppData);
  batch.update(candRef, {
    status: "approved",
    resolutionType: "APPROVED_NEW",
    reviewedBy: actor.email,
    reviewedAt: now,
    publishedOpportunityId: oppRef.id,
    updatedBy: actor.email,
    updatedAt: now,
  });

  await helperAutoCloseRelatedProposals(batch, oppRef.id, cleanNewOppData);
  await batch.commit();

  await logAudit(
    actor,
    "APPROVE_CANDIDATE",
    "candidate",
    resolvedCandId,
    `Duyệt cơ hội Spark: "${resolvedTitle}" -> công bố sang Opportunities (${oppRef.id})`
  );
}

export async function rejectCandidate(
  candidateId: string,
  candidateTitle: string,
  reason: string,
  actor: { uid: string; email: string; role: UserRole }
) {
  const now = new Date().toISOString();
  const candRef = await resolveCandidateDocRef(candidateId);
  await updateDoc(candRef, {
    id: candRef.id,
    status: "rejected",
    resolutionType: "ADMIN_REJECTED",
    rejectionReason: reason,
    reviewedBy: actor.email,
    reviewedAt: now,
    updatedBy: actor.email,
    updatedAt: now,
  });

  await logAudit(
    actor,
    "REJECT_CANDIDATE",
    "candidate",
    candRef.id,
    `Từ chối ứng viên cơ hội Spark: "${candidateTitle}" (Lý do: ${reason})`
  );
}

export async function markCandidateNeedsReview(
  candidateId: string,
  candidateTitle: string,
  reason: string,
  actor: { uid: string; email: string; role: UserRole }
) {
  const now = new Date().toISOString();
  const candRef = await resolveCandidateDocRef(candidateId);
  await updateDoc(candRef, {
    id: candRef.id,
    status: "needs_review",
    rejectionReason: reason || "Yêu cầu hiệu chỉnh thông tin",
    reviewedBy: actor.email,
    reviewedAt: now,
    updatedBy: actor.email,
    updatedAt: now,
  });

  await logAudit(
    actor,
    "UPDATE_CANDIDATE",
    "candidate",
    candRef.id,
    `Yêu cầu hiệu chỉnh ứng viên cơ hội Spark: "${candidateTitle}" (Lý do: ${reason || "Không có"})`
  );
}

export async function deleteCandidate(
  candidateId: string,
  candidateTitle: string,
  actor: { uid: string; email: string; role: UserRole }
) {
  const candRef = await resolveCandidateDocRef(candidateId);
  await deleteDoc(candRef);
  await logAudit(
    actor,
    "DELETE_CANDIDATE",
    "candidate",
    candRef.id,
    `Xóa ứng viên cơ hội: "${candidateTitle}"`
  );
}

export function subscribePendingCandidatesCount(
  callback: (count: number) => void
): () => void {
  const q = query(
    collection(firestore, "opportunityCandidates"),
    where("status", "==", "pending")
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.size);
    },
    (error) => {
      console.error("Lỗi khi theo dõi số lượng tin AI chờ duyệt:", error);
      callback(0);
    }
  );
}

export async function fetchPendingCandidatesCount(): Promise<number> {
  const q = query(
    collection(firestore, "opportunityCandidates"),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);
  return snap.size;
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
  let list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as ResearchWork));

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
  const list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as ResearchProgress));
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
  let list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Publication));

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
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as ImportBatch));
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

// ======================== FACULTY RESEARCH SYNC (SPAK -> IFA-RH) ========================
export interface FacultyResearchSyncState {
  syncInProgress?: boolean;
  lockId?: string;
  syncStartedAt?: string;
  syncStartedAtMs?: number;
  syncStartedBy?: string;
  lastSyncAt?: string;
  lastSyncDate?: string;
  lastSyncStatus?: "running" | "success" | "partial_success" | "failed";
  lastSyncSource?: "github_schedule" | "github_dispatch" | "manual_admin" | "manual_cli";
  lastSyncStats?: {
    read: number;
    valid: number;
    created: number;
    matched: number;
    updated: number;
    preservedAdmin: number;
    duplicates: number;
    errorCount: number;
  };
  durationMs?: number;
  diagnostics?: Array<{
    row: number;
    stt: number | string;
    title: string;
    status: "created" | "matched" | "updated" | "preserved_admin" | "skipped" | "invalid";
    action: string;
    reason: string;
    targetId?: string;
  }>;
  lastError?: string;
  updatedAt?: string;
}

export async function fetchFacultyResearchSyncState(): Promise<FacultyResearchSyncState | null> {
  try {
    const snap = await getDoc(doc(firestore, "systemConfig", "facultyResearchSync"));
    if (snap.exists()) {
      return snap.data() as FacultyResearchSyncState;
    }
  } catch (err) {
    console.warn("Could not fetch facultyResearchSync state:", err);
  }
  return null;
}

export function subscribeFacultyResearchSyncState(
  callback: (state: FacultyResearchSyncState | null) => void
): () => void {
  const docRef = doc(firestore, "systemConfig", "facultyResearchSync");
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as FacultyResearchSyncState);
      } else {
        callback(null);
      }
    },
    (err) => {
      console.warn("Subscription error on facultyResearchSync:", err);
    }
  );
}

export async function runFacultyResearchSyncClient(
  user: { uid: string; email: string; role?: UserRole },
  options?: {
    force?: boolean;
    dryRun?: boolean;
    expectedRevision?: number;
    sheetConfig?: { sheetId?: string; sheetName?: string };
    dataSource?: "drive_json" | "sheets";
    driveConfig?: { folderId?: string; fileName?: string };
  }
) {
  const { executeResearchSync } = await import("../services/researchSyncService");
  const sdk = {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    getDocs,
    addDoc,
    serverTimestamp,
    runTransaction,
  };
  return executeResearchSync({
    db: firestore,
    sdk,
    user: { uid: user.uid, email: user.email, role: user.role },
    options: {
      manual: true,
      runSource: "manual_admin",
      force: options?.force,
      dryRun: options?.dryRun,
      expectedRevision: options?.expectedRevision,
      sheetConfig: options?.sheetConfig,
      dataSource: options?.dataSource || "drive_json",
      driveConfig: options?.driveConfig,
    },
  });
}


