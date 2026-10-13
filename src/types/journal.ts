export type JournalCategory = "domestic" | "international";

export type JournalStatus = "active" | "hidden";

export type VerificationStatus = "verified" | "unverified" | "needs_update";

export type CouncilScoreVerificationStatus = "VERIFIED" | "UNVERIFIED" | "NEEDS_REVIEW";

export type SparkScoreReconciliationStatus = "HOAN_TAT" | "CAN_KIEM_TRA" | "CHUA_XAC_MINH";

export type JournalIdentityMatchStatus = "MATCHED" | "AMBIGUOUS" | "UNMATCHED" | "CONFLICT";

export interface JournalCouncilScore {
  id?: string; // Composite key: councilId + decisionNumber + decisionYear + sourceOrder + publicationType + conditions + validFrom
  councilId: string; // e.g. "HD24", "HD23", "HD19"
  councilName: string; // Chuẩn hóa hiển thị, vd: "Văn hóa – Nghệ thuật – Thể dục thể thao (HD24)"
  rawCouncilName?: string; // Tên gốc trong nguồn Spark
  decisionNumber: string; // vd: "26/QĐ-HĐGSNN"
  decisionYear: number; // vd: 2025
  sourceOrder?: string | number | null; // Số TT trong phụ lục QĐ 26
  publicationType?: string | null; // "PRINT" | "ONLINE" | "PRINT_AND_ONLINE" | ...
  scientificFields?: string[]; // Nhóm ngành / chuyên ngành áp dụng
  minScore?: number | null;
  maxScore: number | null; // Phân biệt rõ 0 (dừng tính điểm) và null (chưa xác định / thiếu dữ liệu)
  validFrom?: string | null;
  validTo?: string | null;
  conditions?: string | null; // Nhóm ngành / chuyên mục / điều kiện tính điểm
  note?: string | null; // Ghi chú thêm
  sourceUrl?: string | null;
  sourcePage?: string | null; // vd: "Phụ lục 24, Trang 4"
  verificationStatus: CouncilScoreVerificationStatus;
}

export interface JournalScoreEditLog {
  editedBy: string;
  editedAt: string;
  reason: string;
  action?: "add" | "edit" | "delete" | "draft_save" | "approve" | string;
  actionType?: string;
  summary?: string;
  oldValue?: any;
  newValue?: any;
  previousCouncilScoresCount?: number;
  newCouncilScoresCount?: number;
}

export interface JournalScoreItem {
  id?: string;
  journalId?: string;
  councilCode: string;
  councilName: string;
  year: number;
  maxScore: number;
  rawMaxScore?: number | null;
  minScore?: number | null;
  decisionNumber?: string;
  decisionDate?: string;
  notes?: string;
  sourceOrder?: string | number | null;
  publicationType?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  conditions?: string | null;
  sourceUrl?: string | null;
  sourcePage?: string | null;
  verificationStatus?: CouncilScoreVerificationStatus;
}

export interface JournalGuidelines {
  hasGuidelines: boolean;
  summary?: string;
  manuscriptFormat?: string;
  wordLimitMin?: number;
  wordLimitMax?: number;
  pageLimit?: string;
  templateUrl?: string;
  citationStyle?: string;
  publicationLanguage?: string;
  reviewFee?: string;
  publicationFee?: string;
  publicationFrequency?: string;
  reviewTimeWeeks?: string;
  submissionUrl?: string;
  editorialEmail?: string;
  contactPhone?: string;
  officeAddress?: string;
}

export interface JournalLinkItem {
  id: string;
  journalId?: string;
  linkType: string; // 'Trang chủ' | 'Nộp bài' | 'Mẫu bài' | 'Thể lệ' | 'Tra cứu' | 'Khác'
  label: string;
  url: string;
  isVerified: boolean;
  verifiedAt?: string;
  notes?: string;
}

export interface JournalVerification {
  status: VerificationStatus;
  verifiedBy?: string;
  verifiedDate?: string;
  verifiedAt?: string;
  verificationMethod?: string;
  sourceReference?: string;
  notes?: string;
  schemaVersion: number;
  manualReviewNeeded?: boolean;
  manualReviewReason?: string;
  confidenceLevel?: string;
}

export interface Journal {
  id: string; // Firestore document ID
  journalId: string; // Stable primary key, e.g. "TC-VHNT-001" or "J_001"
  name: string; // Tên tiếng Việt
  englishName?: string;
  abbreviation?: string;
  publisher: string; // Cơ quan xuất bản / chủ quản
  hostAgency?: string; // Cơ quan chủ quản riêng (nếu có)
  nameHistory?: string; // Lịch sử thay đổi tên gọi
  issnPrint?: string;
  issnOnline?: string;
  isbn?: string;
  category: JournalCategory;
  primaryField: string;
  fields: string[]; // Danh sách nhóm ngành được công nhận
  website?: string;
  websiteVerified: boolean;
  maxScore: number; // Điểm tối đa hiện hành (vd: 1.0)
  maxScoreYear: number; // Năm đạt điểm tối đa (vd: 2025)
  scores: JournalScoreItem[];
  councilScores?: JournalCouncilScore[]; // Danh sách điểm chi tiết theo từng Hội đồng Giáo sư (53 cột)
  recognizedCouncilCount?: number; // so_hoi_dong_cong_nhan
  verifiedCouncils?: string[]; // hoi_dong_da_xac_minh (vd: ["HD24", "HD23"])
  decisionYear?: string | number; // nam_quyet_dinh
  scoreReconciliationStatus?: SparkScoreReconciliationStatus; // trang_thai_doi_soat_diem
  scoreSourceNote?: string; // nguon_diem_theo_hoi_dong
  scoreEditHistory?: JournalScoreEditLog[]; // Lịch sử Admin chỉnh sửa điểm
  guidelines?: JournalGuidelines;
  links?: JournalLinkItem[];
  verification?: JournalVerification;
  status: JournalStatus;
  isManualEdited: boolean;
  lastImportedAt?: string;
  lastImportBatch?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

export interface JournalImportPreviewItem {
  journalId: string;
  name: string;
  publisher: string;
  issnPrint?: string;
  issnOnline?: string;
  category: JournalCategory;
  primaryField: string;
  maxScore: number;
  maxScoreYear: number;
  action: "create" | "update" | "unchanged" | "skip" | "error";
  reasons: string[];
  isManualPreserved?: boolean;
  unverifiedFields: string[];
  parsedJournal: Journal;
  selected: boolean;
}

export interface JournalImportResult {
  batchId: string;
  fileName: string;
  totalParsed: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: Array<{ journalId?: string; message: string }>;
  importedAt: string;
  importedBy: string;
  schemaVersion: number;
}

export type JournalCandidateStatus = "pending" | "approved" | "rejected" | "needs_review";

export type JournalCandidateChangeType = "create" | "update";

export interface JournalFieldDiff {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
}

export interface JournalCandidate {
  id: string; // Document ID in 'journalCandidates' collection
  journalId: string; // Stable primary key
  name: string;
  englishName?: string;
  abbreviation?: string;
  publisher: string;
  hostAgency?: string;
  nameHistory?: string;
  issnPrint?: string;
  issnOnline?: string;
  isbn?: string;
  category: JournalCategory;
  primaryField: string;
  fields: string[];
  website?: string;
  websiteVerified: boolean;
  maxScore: number;
  maxScoreYear: number;
  scores: JournalScoreItem[];
  councilScores?: JournalCouncilScore[];
  recognizedCouncilCount?: number;
  verifiedCouncils?: string[];
  decisionYear?: string | number;
  scoreReconciliationStatus?: SparkScoreReconciliationStatus;
  scoreSourceNote?: string;
  scoreEditHistory?: JournalScoreEditLog[];
  identityMatchStatus?: JournalIdentityMatchStatus;
  identityMatchMethod?: string;
  identityMatchNotes?: string;
  identityMatchNote?: string;
  newScoresCount?: number;
  changedScoresCount?: number;
  newCouncilRecordsCount?: number;
  updatedCouncilRecordsCount?: number;
  needsReviewCouncilCount?: number;
  draftCouncilScores?: JournalCouncilScore[];
  draftReason?: string;
  draftSavedAt?: string;
  draftSavedBy?: string;
  adminEditReason?: string;
  guidelines?: JournalGuidelines;
  links?: JournalLinkItem[];
  verification?: JournalVerification;
  sourceType: "GOOGLE_SHEETS" | "SPARK" | "EXCEL" | "MANUAL";
  changeType: JournalCandidateChangeType;
  existingJournalId?: string;
  diffSummary?: JournalFieldDiff[];
  status: JournalCandidateStatus;
  rejectionReason?: string;
  isManualPreserved?: boolean;
  isManualEdited?: boolean;
  unverifiedFields: string[];
  sheetRowIndex?: number;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  publishedJournalId?: string;
}

export interface JournalSyncSettings {
  sheetId: string;
  sheetName: string;
  hdgsnnSheetId?: string;
  hdgsnnSheetName?: string;
  multiCouncilSheetId?: string;
  multiCouncilSheetName?: string;
  folderUrl?: string;
  autoSyncEnabled?: boolean;
  lastSyncedAt?: string;
  lastSyncedBy?: string;
  lastHdgsnnSyncedAt?: string;
  lastHdgsnnSyncedBy?: string;
  lastMultiCouncilSyncedAt?: string;
  lastMultiCouncilSyncedBy?: string;
  lastStats?: {
    totalRead: number;
    validRows: number;
    newCount: number;
    updatedCount: number;
    unchangedCount: number;
    skippedCount: number;
    errorCount: number;
  };
  lastMultiCouncilStats?: any;
}
