export type JournalCategory = "domestic" | "international";

export type JournalStatus = "active" | "hidden";

export type VerificationStatus = "verified" | "unverified" | "needs_update";

export interface JournalScoreItem {
  id?: string;
  journalId?: string;
  councilCode: string;
  councilName: string;
  year: number;
  maxScore: number;
  minScore?: number;
  decisionNumber?: string;
  decisionDate?: string;
  notes?: string;
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
  sourceReference?: string;
  notes?: string;
  schemaVersion: number;
}

export interface Journal {
  id: string; // Firestore document ID
  journalId: string; // Stable primary key, e.g. "TC-VHNT-001"
  name: string; // Tên tiếng Việt
  englishName?: string;
  abbreviation?: string;
  publisher: string; // Cơ quan xuất bản / chủ quản
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
