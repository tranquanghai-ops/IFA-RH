export type UserRole = "owner" | "admin" | "lecturer";

export interface UserProfile {
  id: string; // doc ID (usually auth UID or normalized email before linked)
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string; // Bộ môn / ngành
  academicDegree?: string; // Học vị: TS, ThS, PGS, GS, Cử nhân, v.v.
  orcid?: string;
  googleScholar?: string;
  researchGate?: string;
  website?: string;
  active: boolean;
  photoURL?: string;
  createdAt?: string;
  updatedAt?: string;
  linkedAt?: string;
  promotedAt?: string;
  promotedBy?: string;
}

export type OpportunityType =
  | "Hội thảo"
  | "Hội nghị"
  | "Call for Papers"
  | "Special Issue"
  | "Book Chapter"
  | "Seminar"
  | "Hợp tác nghiên cứu"
  | "Đổi mới sáng tạo"
  | "Khác";

export type OpportunityLevel =
  | "Quốc tế"
  | "Quốc gia"
  | "Cấp Trường"
  | "Cấp Khoa"
  | "Khác";

export type OpportunitySourceType = "SPARK" | "ADMIN";

export type OpportunityStatus = "published" | "archived";

export interface Opportunity {
  id: string;
  title: string;
  organizer: string;
  country: string;
  type: OpportunityType;
  level: OpportunityLevel;
  topic: string;
  field: string; // Ngành MTCN phù hợp
  tags: string[];
  deadline: string; // yyyy-mm-dd or dd/mm/yyyy
  abstractDeadline?: string;
  fullPaperDeadline?: string;
  registrationDeadline?: string;
  eventDate?: string;
  location?: string; // Địa điểm / Online / Hybrid
  fee?: string;
  publicationFormat?: string; // ISBN, ISSN, Scopus, WoS, v.v.
  indexing?: string;
  content: string;
  submissionUrl?: string;
  sourceUrl?: string;
  directions?: string; // Gợi ý hướng bài cho GV MTCN
  suitability?: string; // Mức độ phù hợp MTCN: Rất phù hợp, Phù hợp, Tham khảo
  notes?: string;
  runId?: string;
  discoveredAt?: string;
  sheetStatus?: string;
  sourceType: OpportunitySourceType;
  status: OpportunityStatus;
  candidateId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

export type CandidateStatus = "pending" | "approved" | "rejected";

export interface OpportunityCandidate {
  id: string;
  title: string;
  organizer: string;
  country: string;
  type: OpportunityType;
  level: OpportunityLevel;
  topic: string;
  field: string;
  tags: string[];
  deadline: string;
  abstractDeadline?: string;
  fullPaperDeadline?: string;
  registrationDeadline?: string;
  eventDate?: string;
  location?: string;
  fee?: string;
  publicationFormat?: string;
  indexing?: string;
  content: string;
  submissionUrl?: string;
  sourceUrl?: string;
  directions?: string;
  suitability?: string;
  notes?: string;
  runId?: string;
  discoveredAt?: string;
  sheetStatus?: string;
  sourceType: "SPARK";
  status: CandidateStatus;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  normalizedTitle: string;
  createdAt: string;
  updatedAt: string;
}

export type ResearchStatus =
  | "Ý tưởng"
  | "Đang chuẩn bị"
  | "Đang viết"
  | "Đã gửi"
  | "Chờ phản biện"
  | "Sửa theo phản biện"
  | "Được chấp nhận"
  | "Đã xuất bản"
  | "Nghiệm thu / Hoàn tất";

export const RESEARCH_STATUS_ORDER: ResearchStatus[] = [
  "Ý tưởng",
  "Đang chuẩn bị",
  "Đang viết",
  "Đã gửi",
  "Chờ phản biện",
  "Sửa theo phản biện",
  "Được chấp nhận",
  "Đã xuất bản",
  "Nghiệm thu / Hoàn tất",
];

export interface ResearchWork {
  id: string;
  userId: string; // UID của GV sở hữu
  userEmail: string;
  userName: string;
  title: string;
  category: string; // Bài báo, Hội thảo, Đề tài NCKH, Sách, Chương sách, Sản phẩm sáng tạo / nghệ thuật, Khác
  topic: string;
  venue?: string; // Hội thảo / tạp chí dự kiến
  deadline?: string;
  plannedSubmissionDate?: string;
  actualSubmissionDate?: string;
  eventDate?: string;
  plannedPublishDate?: string;
  role: string; // Tác giả chính, Đồng tác giả, Chủ nhiệm đề tài, v.v.
  coAuthors?: string;
  status: ResearchStatus;
  notes?: string;
  reminderMilestone?: string;
  isCompleted: boolean;
  convertedToPublicationId?: string;
  convertedBy?: string;
  convertedAt?: string;
  lastUpdatedBy?: string;
  lastUpdatedByRole?: string;
  onBehalfOfUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchProgress {
  id: string;
  researchId: string;
  userId: string;
  userEmail: string;
  actorUid?: string;
  actorEmail?: string;
  actorRole?: string;
  status: ResearchStatus;
  date: string; // dd/mm/yyyy
  notes: string;
  createdAt: string;
}

export interface Publication {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  year: number; // e.g., 2026
  title: string;
  type: string; // Bài báo, Hội thảo, Đề tài NCKH, Sách, Chương sách, Sản phẩm sáng tạo / nghệ thuật, Khác
  role: string; // Tác giả chính, Đồng tác giả, Chủ nhiệm đề tài, v.v.
  coAuthors?: string;
  publisher?: string; // Đơn vị xuất bản / tổ chức
  journalOrConference?: string; // Tên tạp chí / hội thảo
  volume?: string;
  issue?: string;
  pages?: string;
  isbn?: string;
  issn?: string;
  doi?: string;
  indexing?: string; // Scopus, WoS, ACI, v.v.
  link?: string;
  notes?: string;
  sourceResearchId?: string; // Nếu chuyển từ researchWork
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorUid: string;
  actorEmail: string;
  actorRole: UserRole;
  action: string;
  entityType: "opportunity" | "candidate" | "user" | "research" | "publication" | "system" | "import";
  entityId: string;
  summary: string;
}

export interface ImportBatch {
  id: string;
  timestamp: string;
  importedBy: string;
  fileName: string;
  type: "opportunities" | "research_works" | "publications" | "lecturers";
  totalRows: number;
  successCount: number;
  errorCount: number;
  skippedCount?: number;
  errors?: { row: number; reason: string }[];
}

export interface SharedPersonnelRecord {
  emailNormalized: string;
  displayName: string;
  departmentId: string;
  departmentName: string;
  lecturerType: string;
  academicDegree: string;
  employeeId?: string;
  active: boolean;
  inactiveAt?: string | null;
  sourceUpdatedAt: string;
  sharedUpdatedAt: string;
}

export interface SharedPersonnelExportPayload {
  schemaVersion: 1;
  source: 'IFA-WORK';
  generatedAt: string;
  totalRecords: number;
  personnel: SharedPersonnelRecord[];
}

export type RowValidationStatus =
  | 'VALID'
  | 'SKIPPED_MISSING_EMAIL'
  | 'SKIPPED_INVALID_EMAIL'
  | 'SKIPPED_DUPLICATE_EMAIL'
  | 'SKIPPED_INVALID_RECORD';

export interface SkippedRowDetail {
  rowNumber: number;
  displayName: string;
  email: string;
  status: RowValidationStatus;
  reason: string;
}

export interface PersonnelSyncLog {
  id: string;
  timestamp: string;
  method: 'manual_json' | 'github_action';
  triggeredBy: string;
  sourceFile?: string;
  schemaVersion: number;
  totalRecords: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  deactivatedCount: number;
  reactivatedCount: number;
  durationMs?: number;
  // Enhanced row-level metrics
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
  // Aliases matching specific reporting requirements
  created?: number;
  updated?: number;
  unchanged?: number;
  inactive?: number;
  reactivated?: number;
  skipped?: number;
  skippedMissingEmail?: number;
  skippedInvalidEmail?: number;
  skippedDuplicateEmail?: number;
  errors?: number;
}

export type ResearchTrackingStatus = "ACTIVE" | "ARCHIVED";

export interface ResearchPersonnelSettings {
  emailNormalized: string;
  researchTrackingStatus: ResearchTrackingStatus;
  archivedAt?: string | null;
  archivedBy?: string | null;
  archiveReason?: string | null;
  updatedAt: string;
}
