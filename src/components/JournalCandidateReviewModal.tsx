import React, { useState, useEffect } from "react";
import type {
  JournalCandidate,
  JournalCouncilScore,
  CouncilScoreVerificationStatus,
} from "../types/journal";
import {
  OFFICIAL_HDGSNN_COUNCILS,
  normalizeCouncilIdentity,
} from "../services/journalGoogleSheetService";
import {
  formatVietnameseScore,
  getScoreBadgePalette,
  isValidDisplayIdentifier,
} from "../services/journalService";
import {
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Award,
  ShieldAlert,
  ArrowRight,
  HelpCircle,
  Plus,
  Trash2,
  Edit,
  Save,
  ExternalLink,
  History,
  Check,
  Building,
  FileText,
  Mail,
  ShieldCheck,
  Globe,
  Filter,
  Download,
  AlertCircle,
  Link as LinkIcon,
} from "lucide-react";

interface JournalCandidateReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: JournalCandidate | null;
  initialEditMode?: boolean;
  selectedCouncilId?: string;
  onSaveDraft?: (
    candidateId: string,
    updates: Partial<JournalCandidate>,
    editReason?: string
  ) => Promise<void>;
  onApprove: (
    candidateId: string,
    options?: {
      overrideManual?: boolean;
      candidateOverrides?: Partial<JournalCandidate>;
      editReason?: string;
      replaceCouncilScoresExact?: boolean;
    }
  ) => Promise<void>;
  onReject: (candidateId: string, reason: string) => Promise<void>;
  onMarkNeedsReview: (candidateId: string) => Promise<void>;
}

const EMPTY_COUNCIL_SCORE: JournalCouncilScore = {
  councilId: "HD24",
  councilName: "Văn hóa - Nghệ thuật - Thể dục thể thao",
  decisionNumber: "26/QĐ-HĐGSNN",
  decisionYear: 2025,
  sourceOrder: null,
  scientificFields: ["Văn hóa - Nghệ thuật - Thể dục thể thao"],
  publicationType: "Toàn tạp chí",
  maxScore: 0.75,
  validFrom: "Đầu kỳ",
  validTo: "Hiện hành",
  conditions: null,
  note: null,
  sourcePage: "Phụ lục 24",
  sourceUrl: "https://hdgsnn.gov.vn",
  verificationStatus: "VERIFIED",
};

export const JournalCandidateReviewModal: React.FC<JournalCandidateReviewModalProps> = ({
  isOpen,
  onClose,
  candidate,
  initialEditMode = false,
  selectedCouncilId = "HD24",
  onSaveDraft,
  onApprove,
  onReject,
  onMarkNeedsReview,
}) => {
  const [overrideManual, setOverrideManual] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejectingOpen, setIsRejectingOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Council view mode toggle: "all" vs "selected"
  const [councilViewMode, setCouncilViewMode] = useState<"selected" | "all">("all");

  // Editable journal metadata
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [metaName, setMetaName] = useState("");
  const [metaEnglishName, setMetaEnglishName] = useState("");
  const [metaPublisher, setMetaPublisher] = useState("");
  const [metaIssnPrint, setMetaIssnPrint] = useState("");
  const [metaIssnOnline, setMetaIssnOnline] = useState("");
  const [metaIsbn, setMetaIsbn] = useState("");
  const [metaPrimaryField, setMetaPrimaryField] = useState("");
  const [metaWebsite, setMetaWebsite] = useState("");

  // Editable council scores list
  const [councilScores, setCouncilScores] = useState<JournalCouncilScore[]>([]);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [rowDraft, setRowDraft] = useState<JournalCouncilScore>(EMPTY_COUNCIL_SCORE);
  const [rowScoreText, setRowScoreText] = useState<string>("0.75");
  const [rowFieldsText, setRowFieldsText] = useState<string>("");
  const [isAddingNewRow, setIsAddingNewRow] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [hasModifiedScoresOrMeta, setHasModifiedScoresOrMeta] = useState(false);

  // Background scroll lock and escape listener
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.classList.add("modal-open");
    document.documentElement.classList.add("modal-open");

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.classList.remove("modal-open");
      document.documentElement.classList.remove("modal-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!candidate) return;
    setErrorMsg("");
    setSuccessMsg("");
    setIsRejectingOpen(false);
    setRejectReason("");
    setEditReason("");
    setIsEditingMeta(initialEditMode);
    setEditingRowIndex(null);
    setIsAddingNewRow(false);
    setHasModifiedScoresOrMeta(false);

    setMetaName(candidate.name || "");
    setMetaEnglishName(candidate.englishName || "");
    setMetaPublisher(candidate.publisher || "");
    setMetaIssnPrint(candidate.issnPrint || "");
    setMetaIssnOnline(candidate.issnOnline || "");
    setMetaIsbn(candidate.isbn || "");
    setMetaPrimaryField(candidate.primaryField || "");
    setMetaWebsite(candidate.website || "");

    let loadedScores: JournalCouncilScore[] = [];
    if (Array.isArray(candidate.councilScores) && candidate.councilScores.length > 0) {
      loadedScores = candidate.councilScores.map((cs) => ({ ...cs }));
    } else if (Array.isArray(candidate.scores) && candidate.scores.length > 0) {
      loadedScores = candidate.scores.map((s) => {
        const norm = normalizeCouncilIdentity(s.councilCode, s.councilName);
        return {
          councilId: norm.councilId,
          councilName: norm.councilName,
          decisionNumber: s.decisionNumber || "26/QĐ-HĐGSNN",
          decisionYear: s.year || candidate.maxScoreYear || 2025,
          sourceOrder: null,
          scientificFields: candidate.fields || [candidate.primaryField],
          publicationType: "Toàn tạp chí",
          maxScore: typeof s.maxScore === "number" ? s.maxScore : null,
          validFrom: s.decisionDate || "Đầu kỳ",
          validTo: "Hiện hành",
          conditions: null,
          note: s.notes || null,
          sourcePage: null,
          sourceUrl: s.sourceUrl || null,
          verificationStatus:
            candidate.scoreReconciliationStatus === "CAN_KIEM_TRA"
              ? "NEEDS_REVIEW"
              : "VERIFIED",
        };
      });
    }
    setCouncilScores(loadedScores);

    // Auto view mode: selected if council present, else all
    if (selectedCouncilId && selectedCouncilId !== "ALL") {
      const normSel = normalizeCouncilIdentity(selectedCouncilId).councilId;
      const hasSel = loadedScores.some(
        (cs) => normalizeCouncilIdentity(cs.councilId || cs.councilName).councilId === normSel
      );
      setCouncilViewMode(hasSel ? "selected" : "all");
    } else {
      setCouncilViewMode("all");
    }
  }, [candidate, isOpen, initialEditMode, selectedCouncilId]);

  if (!isOpen || !candidate) return null;

  const isUpdate = candidate.changeType === "update";
  const diffs = candidate.diffSummary || [];
  const guidelines = candidate.guidelines;
  const verification = candidate.verification;
  const links = candidate.links || [];

  const isValidUrl = (url?: string) =>
    Boolean(url && (url.startsWith("http://") || url.startsWith("https://")));

  const normSelectedCouncil =
    selectedCouncilId && selectedCouncilId !== "ALL"
      ? normalizeCouncilIdentity(selectedCouncilId)
      : null;

  const displayedCouncilScores =
    councilViewMode === "selected" && normSelectedCouncil
      ? councilScores.filter(
          (cs) =>
            normalizeCouncilIdentity(cs.councilId || cs.councilName).councilId ===
            normSelectedCouncil.councilId
        )
      : councilScores;

  const verifiedNumeric = councilScores
    .filter((cs) => cs.verificationStatus === "VERIFIED" && typeof cs.maxScore === "number")
    .map((cs) => cs.maxScore as number);
  const computedMaxScore =
    verifiedNumeric.length > 0 ? Math.max(...verifiedNumeric) : candidate.maxScore;

  const startEditRow = (csItem: JournalCouncilScore) => {
    const idx = councilScores.indexOf(csItem);
    if (idx === -1) return;
    setIsAddingNewRow(false);
    setEditingRowIndex(idx);
    setRowDraft({ ...csItem });
    setRowScoreText(csItem.maxScore === null ? "" : String(csItem.maxScore));
    setRowFieldsText((csItem.scientificFields || []).join(", "));
  };

  const startAddNewRow = () => {
    setEditingRowIndex(null);
    setIsAddingNewRow(true);
    const defaultItem: JournalCouncilScore = {
      ...EMPTY_COUNCIL_SCORE,
      scientificFields: [metaPrimaryField || candidate.primaryField || "Văn hóa - Nghệ thuật"],
    };
    setRowDraft(defaultItem);
    setRowScoreText("0.75");
    setRowFieldsText((defaultItem.scientificFields || []).join(", "));
  };

  const saveRowDraft = () => {
    const trimmedScore = rowScoreText.trim().replace(",", ".");
    let parsedScore: number | null = null;
    if (trimmedScore !== "") {
      const n = Number(trimmedScore);
      if (isNaN(n) || n < 0 || n > 2) {
        setErrorMsg("Mức điểm phải là số từ 0 đến 2.00 (hoặc để trống nếu chưa xác định).");
        return;
      }
      parsedScore = n;
    }

    const normCouncil = normalizeCouncilIdentity(rowDraft.councilId, rowDraft.councilName);
    const fieldsArr = rowFieldsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const finalizedRow: JournalCouncilScore = {
      ...rowDraft,
      councilId: normCouncil.councilId,
      councilName: normCouncil.councilName,
      maxScore: parsedScore,
      scientificFields:
        fieldsArr.length > 0 ? fieldsArr : [metaPrimaryField || candidate.primaryField],
      publicationType: rowDraft.publicationType?.trim() || "Toàn tạp chí",
      decisionNumber: rowDraft.decisionNumber?.trim() || "26/QĐ-HĐGSNN",
      decisionYear: Number(rowDraft.decisionYear) || 2025,
    };

    const nextList = [...councilScores];
    if (isAddingNewRow) {
      nextList.push(finalizedRow);
    } else if (editingRowIndex !== null) {
      nextList[editingRowIndex] = finalizedRow;
    }

    setCouncilScores(nextList);
    setEditingRowIndex(null);
    setIsAddingNewRow(false);
    setHasModifiedScoresOrMeta(true);
    setErrorMsg("");
  };

  const handleDeleteRow = (csItem: JournalCouncilScore) => {
    const nextList = councilScores.filter((item) => item !== csItem);
    setCouncilScores(nextList);
    setHasModifiedScoresOrMeta(true);
  };

  const handleQuickVerifyRow = (csItem: JournalCouncilScore) => {
    const idx = councilScores.indexOf(csItem);
    if (idx === -1) return;
    const nextList = [...councilScores];
    nextList[idx] = {
      ...nextList[idx],
      verificationStatus: "VERIFIED",
    };
    setCouncilScores(nextList);
    setHasModifiedScoresOrMeta(true);
  };

  const buildCandidateOverrides = (): Partial<JournalCandidate> => {
    const uniqueAllCouncils = Array.from(
      new Set(councilScores.map((cs) => cs.councilId || cs.councilName))
    );
    const uniqueVerifiedCouncils = Array.from(
      new Set(
        councilScores
          .filter((cs) => cs.verificationStatus === "VERIFIED")
          .map((cs) => cs.councilName)
      )
    );

    // Sync legacy scores array from councilScores
    const syncedLegacyScores = councilScores.map((cs) => ({
      year: cs.decisionYear,
      councilName: cs.councilName,
      councilCode: cs.councilId,
      maxScore: typeof cs.maxScore === "number" ? cs.maxScore : 0,
      decisionNumber: cs.decisionNumber,
      decisionDate: cs.validFrom || undefined,
      sourceUrl: cs.sourceUrl || undefined,
      notes: [cs.publicationType, cs.conditions, cs.note].filter(Boolean).join(" — "),
    }));

    return {
      name: metaName.trim() || candidate.name,
      englishName: metaEnglishName.trim() || undefined,
      publisher: metaPublisher.trim() || candidate.publisher,
      issnPrint: metaIssnPrint.trim() || undefined,
      issnOnline: metaIssnOnline.trim() || undefined,
      isbn: metaIsbn.trim() || undefined,
      primaryField: metaPrimaryField.trim() || candidate.primaryField,
      website: metaWebsite.trim() || undefined,
      websiteVerified: Boolean(metaWebsite.trim().startsWith("http")),
      councilScores,
      scores: syncedLegacyScores,
      recognizedCouncilCount: uniqueAllCouncils.length,
      verifiedCouncils: uniqueVerifiedCouncils,
      maxScore: computedMaxScore,
    };
  };

  const handleSaveDraftClick = async () => {
    if (!onSaveDraft) return;
    if (isAddingNewRow || editingRowIndex !== null) {
      setErrorMsg("Vui lòng bấm 'Lưu dòng điểm' hoặc 'Hủy' ở dòng đang sửa trước khi Lưu nháp.");
      return;
    }
    setErrorMsg("");
    setSuccessMsg("");
    setIsProcessing(true);
    try {
      const overrides = buildCandidateOverrides();
      await onSaveDraft(
        candidate.id,
        overrides,
        editReason.trim() || "Admin lưu nháp chỉnh sửa hồ sơ / điểm Hội đồng"
      );
      setSuccessMsg(
        "Đã lưu nháp thành công vào Hàng chờ duyệt (Chưa công bố ra danh mục công khai)."
      );
      setHasModifiedScoresOrMeta(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Lưu nháp thất bại.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async () => {
    if (isAddingNewRow || editingRowIndex !== null) {
      setErrorMsg("Vui lòng bấm 'Lưu dòng điểm' hoặc 'Hủy' ở dòng đang sửa trước khi Duyệt.");
      return;
    }
    setErrorMsg("");
    setSuccessMsg("");
    setIsProcessing(true);
    try {
      const overrides = buildCandidateOverrides();
      await onApprove(candidate.id, {
        overrideManual,
        candidateOverrides: overrides,
        editReason:
          editReason.trim() ||
          (hasModifiedScoresOrMeta
            ? "Admin hiệu chỉnh và phê duyệt công bố điểm HĐGSNN"
            : "Admin phê duyệt công bố"),
        replaceCouncilScoresExact: hasModifiedScoresOrMeta,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Duyệt thất bại.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) {
      setErrorMsg("Vui lòng nhập lý do từ chối.");
      return;
    }
    setErrorMsg("");
    setIsProcessing(true);
    try {
      await onReject(candidate.id, rejectReason);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Từ chối thất bại.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNeedsReview = async () => {
    setErrorMsg("");
    setIsProcessing(true);
    try {
      await onMarkNeedsReview(candidate.id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Thao tác thất bại.");
    } finally {
      setIsProcessing(false);
    }
  };

  const reconStatus = candidate.scoreReconciliationStatus || "HOAN_TAT";
  const idMatchStatus = candidate.identityMatchStatus || "MATCHED";

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
        overscrollBehavior: "contain",
      }}
      onClick={onClose}
      onWheel={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
    >
      <div
        className="modal-content viewport-safe-modal"
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          maxWidth: "1020px",
          width: "100%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
          overscrollBehavior: "contain",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — Harmonized with JournalDetailModal */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            backgroundColor: "#f8fafc",
            gap: "12px",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
                marginBottom: "6px",
              }}
            >
              {/* Max Score Badge matching user detail modal */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  color: "#1e40af",
                  backgroundColor: "#eff6ff",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  border: "1px solid #bfdbfe",
                }}
              >
                <Award size={14} />
                KHUNG ĐIỂM HĐGSNN ({candidate.decisionYear || candidate.maxScoreYear || 2025}): TỐI ĐA{" "}
                {formatVietnameseScore(computedMaxScore)} ĐIỂM
              </div>

              {/* Admin status tags */}
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: "4px",
                  backgroundColor: isUpdate ? "#f0fdf4" : "#ecfdf5",
                  color: isUpdate ? "#166534" : "#047857",
                  border: isUpdate ? "1px solid #bbf7d0" : "1px solid #a7f3d0",
                }}
              >
                {isUpdate ? "CẬP NHẬT TẠP CHÍ / ĐIỂM HĐGSNN" : "TẠP CHÍ MỚI"}
              </span>

              {/* Spark Reconciliation Status Badge */}
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: "4px",
                  backgroundColor:
                    reconStatus === "HOAN_TAT"
                      ? "#ecfdf5"
                      : reconStatus === "CAN_KIEM_TRA"
                      ? "#fffbeb"
                      : "#f1f5f9",
                  color:
                    reconStatus === "HOAN_TAT"
                      ? "#065f46"
                      : reconStatus === "CAN_KIEM_TRA"
                      ? "#b45309"
                      : "#475569",
                  border:
                    reconStatus === "HOAN_TAT"
                      ? "1px solid #a7f3d0"
                      : reconStatus === "CAN_KIEM_TRA"
                      ? "1px solid #fde68a"
                      : "1px solid #cbd5e1",
                }}
              >
                Đối soát Spark: {reconStatus}
              </span>

              {/* Identity Match Status Badge */}
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: "4px",
                  backgroundColor:
                    idMatchStatus === "MATCHED"
                      ? "#eff6ff"
                      : idMatchStatus === "UNMATCHED"
                      ? "#f0fdf4"
                      : "#fef2f2",
                  color:
                    idMatchStatus === "MATCHED"
                      ? "#1e40af"
                      : idMatchStatus === "UNMATCHED"
                      ? "#166534"
                      : "#991b1b",
                  border:
                    idMatchStatus === "MATCHED"
                      ? "1px solid #bfdbfe"
                      : idMatchStatus === "UNMATCHED"
                      ? "1px solid #bbf7d0"
                      : "1px solid #fecaca",
                }}
              >
                Định danh: {idMatchStatus}
              </span>
            </div>

            <h2
              style={{
                fontSize: "1.35rem",
                fontWeight: 700,
                color: "#0f172a",
                lineHeight: "1.3",
                margin: 0,
              }}
            >
              {metaName || candidate.name}
            </h2>
            {(metaEnglishName || candidate.englishName) && (
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "#64748b",
                  fontStyle: "italic",
                  margin: "4px 0 0 0",
                }}
              >
                {metaEnglishName || candidate.englishName}{" "}
                {isValidDisplayIdentifier(candidate.abbreviation)
                  ? `(${candidate.abbreviation})`
                  : ""}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#64748b",
              padding: "4px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Đóng modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div
          style={{
            padding: "24px",
            overflowY: "auto",
            overscrollBehavior: "contain",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          {errorMsg && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "6px",
                backgroundColor: "#fef2f2",
                color: "#991b1b",
                border: "1px solid #fecaca",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "6px",
                backgroundColor: "#f0fdf4",
                color: "#166534",
                border: "1px solid #bbf7d0",
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <CheckCircle2 size={16} />
              {successMsg}
            </div>
          )}

          {/* Identity Match Note / Warning */}
          {(idMatchStatus === "AMBIGUOUS" ||
            idMatchStatus === "CONFLICT" ||
            candidate.identityMatchNote) && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                backgroundColor:
                  idMatchStatus === "AMBIGUOUS" || idMatchStatus === "CONFLICT"
                    ? "#fef2f2"
                    : "#f8fafc",
                border:
                  idMatchStatus === "AMBIGUOUS" || idMatchStatus === "CONFLICT"
                    ? "1px solid #fecaca"
                    : "1px solid #e2e8f0",
                fontSize: "0.82rem",
                color:
                  idMatchStatus === "AMBIGUOUS" || idMatchStatus === "CONFLICT"
                    ? "#991b1b"
                    : "#334155",
              }}
            >
              <strong>Kết quả đối soát định danh tạp chí ({idMatchStatus}):</strong>{" "}
              {candidate.identityMatchNote}
            </div>
          )}

          {/* Manual Edit Protection Alert */}
          {candidate.isManualPreserved && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                backgroundColor: "#fefce8",
                border: "1px solid #fef08a",
                fontSize: "0.85rem",
                color: "#854d0e",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700 }}>
                <ShieldAlert size={18} />
                Bản ghi hiện có đã được Admin chỉnh sửa thủ công trên web!
              </div>
              <p style={{ margin: 0 }}>
                Hệ thống mặc định giữ nguyên các thông tin định danh do Admin hiệu chỉnh và chỉ cập nhật thêm lịch sử điểm Hội đồng. Nếu bạn muốn thay thế cả thông tin định danh bằng dữ liệu mới, vui lòng tick vào ô bên dưới.
              </p>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  fontWeight: 600,
                  color: "#713f12",
                }}
              >
                <input
                  type="checkbox"
                  checked={overrideManual}
                  onChange={(e) => setOverrideManual(e.target.checked)}
                />
                Ghi đè thông tin định danh đã sửa thủ công
              </label>
            </div>
          )}

          {/* Manual Inspection Needed Warning Alert */}
          {(reconStatus === "CAN_KIEM_TRA" ||
            candidate.verification?.manualReviewNeeded ||
            candidate.unverifiedFields?.some((f) => f.includes("Cần kiểm tra thủ công"))) && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                backgroundColor: "#fffbeb",
                border: "1px solid #fde68a",
                fontSize: "0.85rem",
                color: "#92400e",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontWeight: 700,
                  color: "#b45309",
                }}
              >
                <AlertTriangle size={18} />
                CẢNH BÁO ĐỐI SOÁT THỦ CÔNG (CAN_KIEM_TRA / NEEDS_REVIEW):
              </div>
              <p style={{ margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                {candidate.verification?.manualReviewReason ||
                  candidate.unverifiedFields?.find((f) => f.includes("Cần kiểm tra thủ công")) ||
                  "Hồ sơ này có bản ghi điểm hoặc nguồn văn bản cần Admin kiểm tra, xác nhận hoặc chỉnh sửa trước khi công bố."}
              </p>
            </div>
          )}

          {/* Section 1: Thông tin định danh & Cơ quan xuất bản — Harmonized with JournalDetailModal */}
          <div
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <h4
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  color: "#334155",
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Building size={16} color="#2563eb" />
                1. Thông tin định danh & Cơ quan xuất bản
              </h4>

              <button
                type="button"
                onClick={() => setIsEditingMeta(!isEditingMeta)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#1e3a8a",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Edit size={13} />
                {isEditingMeta ? "Thu gọn sửa định danh" : "Sửa thông tin định danh"}
              </button>
            </div>

            {isEditingMeta ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "12px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.76rem",
                      fontWeight: 600,
                      color: "#475569",
                      marginBottom: 3,
                    }}
                  >
                    Tên tạp chí (Tiếng Việt)
                  </label>
                  <input
                    type="text"
                    value={metaName}
                    onChange={(e) => {
                      setMetaName(e.target.value);
                      setHasModifiedScoresOrMeta(true);
                    }}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: "0.84rem",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.76rem",
                      fontWeight: 600,
                      color: "#475569",
                      marginBottom: 3,
                    }}
                  >
                    Tên tiếng Anh
                  </label>
                  <input
                    type="text"
                    value={metaEnglishName}
                    onChange={(e) => {
                      setMetaEnglishName(e.target.value);
                      setHasModifiedScoresOrMeta(true);
                    }}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: "0.84rem",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.76rem",
                      fontWeight: 600,
                      color: "#475569",
                      marginBottom: 3,
                    }}
                  >
                    Cơ quan xuất bản / Chủ quản
                  </label>
                  <input
                    type="text"
                    value={metaPublisher}
                    onChange={(e) => {
                      setMetaPublisher(e.target.value);
                      setHasModifiedScoresOrMeta(true);
                    }}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: "0.84rem",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.76rem",
                      fontWeight: 600,
                      color: "#475569",
                      marginBottom: 3,
                    }}
                  >
                    ISSN bản in (Print)
                  </label>
                  <input
                    type="text"
                    value={metaIssnPrint}
                    onChange={(e) => {
                      setMetaIssnPrint(e.target.value);
                      setHasModifiedScoresOrMeta(true);
                    }}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: "0.84rem",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.76rem",
                      fontWeight: 600,
                      color: "#475569",
                      marginBottom: 3,
                    }}
                  >
                    E-ISSN (Điện tử)
                  </label>
                  <input
                    type="text"
                    value={metaIssnOnline}
                    onChange={(e) => {
                      setMetaIssnOnline(e.target.value);
                      setHasModifiedScoresOrMeta(true);
                    }}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: "0.84rem",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.76rem",
                      fontWeight: 600,
                      color: "#475569",
                      marginBottom: 3,
                    }}
                  >
                    ISBN chuyên đề
                  </label>
                  <input
                    type="text"
                    value={metaIsbn}
                    onChange={(e) => {
                      setMetaIsbn(e.target.value);
                      setHasModifiedScoresOrMeta(true);
                    }}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: "0.84rem",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.76rem",
                      fontWeight: 600,
                      color: "#475569",
                      marginBottom: 3,
                    }}
                  >
                    Lĩnh vực chuyên môn chính
                  </label>
                  <input
                    type="text"
                    value={metaPrimaryField}
                    onChange={(e) => {
                      setMetaPrimaryField(e.target.value);
                      setHasModifiedScoresOrMeta(true);
                    }}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: "0.84rem",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.76rem",
                      fontWeight: 600,
                      color: "#475569",
                      marginBottom: 3,
                    }}
                  >
                    Website chính thức
                  </label>
                  <input
                    type="text"
                    value={metaWebsite}
                    onChange={(e) => {
                      setMetaWebsite(e.target.value);
                      setHasModifiedScoresOrMeta(true);
                    }}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      fontSize: "0.84rem",
                    }}
                  />
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "12px",
                  fontSize: "0.85rem",
                }}
              >
                <div>
                  <span style={{ color: "#64748b" }}>Cơ quan xuất bản / Chủ quản:</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {metaPublisher || candidate.publisher || "Đang cập nhật"}
                  </div>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Phân loại:</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {candidate.category === "international"
                      ? "Tạp chí quốc tế"
                      : "Tạp chí trong nước"}
                  </div>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>ISSN bản in (Print):</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {metaIssnPrint || candidate.issnPrint || "Chưa có"}
                  </div>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>E-ISSN (Điện tử):</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {metaIssnOnline || candidate.issnOnline || "Chưa có"}
                  </div>
                </div>
                {isValidDisplayIdentifier(metaIsbn || candidate.isbn) && (
                  <div>
                    <span style={{ color: "#64748b" }}>ISBN chuyên đề:</span>
                    <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                      {metaIsbn || candidate.isbn}
                    </div>
                  </div>
                )}
                <div>
                  <span style={{ color: "#64748b" }}>Lĩnh vực chuyên môn:</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {metaPrimaryField || candidate.primaryField || "—"}
                  </div>
                </div>
              </div>
            )}

            {/* Diff comparison table (If Update) */}
            {isUpdate && diffs.length > 0 && (
              <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px dashed #cbd5e1" }}>
                <div
                  style={{
                    fontSize: "0.84rem",
                    fontWeight: 700,
                    color: "#0f172a",
                    marginBottom: "8px",
                  }}
                >
                  So sánh thay đổi dữ liệu (Đang công khai vs Đề xuất mới từ Google Sheets):
                </div>
                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    overflow: "hidden",
                    fontSize: "0.82rem",
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        <th style={{ padding: "8px 12px", width: "180px", color: "#475569" }}>
                          Trường thông tin
                        </th>
                        <th
                          style={{
                            padding: "8px 12px",
                            backgroundColor: "#fef2f2",
                            color: "#991b1b",
                          }}
                        >
                          Dữ liệu hiện tại (Đang công khai)
                        </th>
                        <th style={{ padding: "8px 6px", width: "30px", textAlign: "center" }}></th>
                        <th
                          style={{
                            padding: "8px 12px",
                            backgroundColor: "#f0fdf4",
                            color: "#166534",
                          }}
                        >
                          Dữ liệu đề xuất mới (Spark)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {diffs.map((d, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "8px 12px", fontWeight: 600, color: "#334155" }}>
                            {d.label}
                          </td>
                          <td style={{ padding: "8px 12px", color: "#475569" }}>
                            {String(d.oldValue)}
                          </td>
                          <td style={{ padding: "8px 6px", textAlign: "center", color: "#94a3b8" }}>
                            <ArrowRight size={14} />
                          </td>
                          <td style={{ padding: "8px 12px", fontWeight: 600, color: "#15803d" }}>
                            {String(d.newValue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Điểm HĐGSNN theo Hội đồng Giáo sư — 100% Harmonized with JournalDetailModal */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
                marginBottom: "8px",
              }}
            >
              <h4
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color: "#0f172a",
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Award size={17} color="#2563eb" />
                2. Điểm HĐGSNN theo Hội đồng Giáo sư ({displayedCouncilScores.length} bản ghi)
              </h4>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {/* Filter Toggle: Hội đồng đang chọn vs Tất cả Hội đồng (Identical to JournalDetailModal) */}
                {normSelectedCouncil && (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      backgroundColor: "#f1f5f9",
                      padding: "3px",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setCouncilViewMode("selected")}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "5px 10px",
                        borderRadius: "6px",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: councilViewMode === "selected" ? "#ffffff" : "transparent",
                        color: councilViewMode === "selected" ? "#1e3a8a" : "#475569",
                        boxShadow:
                          councilViewMode === "selected"
                            ? "0 1px 2px rgba(0, 0, 0, 0.06)"
                            : "none",
                      }}
                    >
                      <Filter size={12} />
                      Hội đồng đang chọn ({normSelectedCouncil.councilName})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCouncilViewMode("all")}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "6px",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: councilViewMode === "all" ? "#ffffff" : "transparent",
                        color: councilViewMode === "all" ? "#1e3a8a" : "#475569",
                        boxShadow:
                          councilViewMode === "all" ? "0 1px 2px rgba(0, 0, 0, 0.06)" : "none",
                      }}
                    >
                      Tất cả Hội đồng ({councilScores.length})
                    </button>
                  </div>
                )}

                {/* Add new council score button */}
                <button
                  type="button"
                  onClick={startAddNewRow}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "5px 12px",
                    borderRadius: "6px",
                    border: "1px solid #2563eb",
                    backgroundColor: "#eff6ff",
                    color: "#1e40af",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={13} />
                  Thêm bản ghi điểm Hội đồng
                </button>
              </div>
            </div>

            <p
              style={{
                fontSize: "0.82rem",
                color: "#475569",
                margin: "0 0 12px 0",
                lineHeight: 1.5,
              }}
            >
              Lưu ý: Mức điểm công trình khoa học được tính theo từng Hội đồng Giáo sư ngành/liên ngành, năm quyết định, loại ấn phẩm/chuyên mục và điều kiện hiệu lực dưới đây:
            </p>

            {/* List of Disciplines badges matching JournalDetailModal */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
              <span
                style={{
                  backgroundColor: "#eff6ff",
                  color: "#1e40af",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "1px solid #bfdbfe",
                }}
              >
                Lĩnh vực chính: {metaPrimaryField || candidate.primaryField}
              </span>
              {(candidate.fields || [])
                .filter((f) => f !== (metaPrimaryField || candidate.primaryField))
                .map((f, i) => (
                  <span
                    key={i}
                    style={{
                      backgroundColor: "#f1f5f9",
                      color: "#334155",
                      fontSize: "0.8rem",
                      padding: "4px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    {f}
                  </span>
                ))}
            </div>

            {/* Inline Add / Edit Council Score Row Form */}
            {(isAddingNewRow || editingRowIndex !== null) && (
              <div
                style={{
                  padding: "14px 16px",
                  marginBottom: "12px",
                  borderRadius: "8px",
                  backgroundColor: "#eff6ff",
                  border: "1px solid #93c5fd",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "#1e3a8a" }}>
                  {isAddingNewRow
                    ? "Thêm mới bản ghi điểm theo Hội đồng Giáo sư"
                    : `Chỉnh sửa bản ghi điểm Hội đồng #${(editingRowIndex ?? 0) + 1}`}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "10px",
                  }}
                >
                  <div style={{ gridColumn: "span 2" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: 3,
                      }}
                    >
                      Hội đồng Giáo sư Ngành / Liên ngành *
                    </label>
                    <select
                      value={rowDraft.councilId}
                      onChange={(e) => {
                        const norm = normalizeCouncilIdentity(e.target.value);
                        setRowDraft({
                          ...rowDraft,
                          councilId: norm.councilId,
                          councilName: norm.councilName,
                        });
                      }}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: "0.82rem",
                        backgroundColor: "#fff",
                      }}
                    >
                      {Object.entries(OFFICIAL_HDGSNN_COUNCILS).map(([cId, cName]) => (
                        <option key={cId} value={cId}>
                          {cName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: 3,
                      }}
                    >
                      Năm quyết định *
                    </label>
                    <input
                      type="number"
                      value={rowDraft.decisionYear}
                      onChange={(e) =>
                        setRowDraft({
                          ...rowDraft,
                          decisionYear: parseInt(e.target.value, 10) || 2025,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: "0.82rem",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: 3,
                      }}
                    >
                      Điểm tối đa (0 - 2.00; trống = null)
                    </label>
                    <input
                      type="text"
                      placeholder="VD: 0.75 hoặc 0 hoặc để trống"
                      value={rowScoreText}
                      onChange={(e) => setRowScoreText(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: "0.82rem",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: 3,
                      }}
                    >
                      Loại ấn phẩm / Chuyên mục
                    </label>
                    <input
                      type="text"
                      value={rowDraft.publicationType || ""}
                      onChange={(e) =>
                        setRowDraft({ ...rowDraft, publicationType: e.target.value })
                      }
                      placeholder="Toàn tạp chí / Chuyên san..."
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: "0.82rem",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: 3,
                      }}
                    >
                      Trạng thái xác minh
                    </label>
                    <select
                      value={rowDraft.verificationStatus}
                      onChange={(e) =>
                        setRowDraft({
                          ...rowDraft,
                          verificationStatus: e.target.value as CouncilScoreVerificationStatus,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: "0.82rem",
                        backgroundColor: "#fff",
                      }}
                    >
                      <option value="VERIFIED">VERIFIED (Đã xác minh)</option>
                      <option value="NEEDS_REVIEW">NEEDS_REVIEW (Cần kiểm tra)</option>
                      <option value="UNVERIFIED">UNVERIFIED (Chưa xác minh)</option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: 3,
                      }}
                    >
                      Số quyết định
                    </label>
                    <input
                      type="text"
                      value={rowDraft.decisionNumber}
                      onChange={(e) =>
                        setRowDraft({ ...rowDraft, decisionNumber: e.target.value })
                      }
                      placeholder="26/QĐ-HĐGSNN"
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: "0.82rem",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: 3,
                      }}
                    >
                      Phụ lục / Trang nguồn
                    </label>
                    <input
                      type="text"
                      value={rowDraft.sourcePage || ""}
                      onChange={(e) =>
                        setRowDraft({ ...rowDraft, sourcePage: e.target.value || null })
                      }
                      placeholder="Phụ lục 24, mục 12..."
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: "0.82rem",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: 3,
                      }}
                    >
                      Hiệu lực từ → đến
                    </label>
                    <div style={{ display: "flex", gap: 4 }}>
                      <input
                        type="text"
                        value={rowDraft.validFrom || ""}
                        onChange={(e) =>
                          setRowDraft({ ...rowDraft, validFrom: e.target.value || null })
                        }
                        placeholder="Từ..."
                        style={{
                          width: "50%",
                          padding: "6px 6px",
                          borderRadius: 6,
                          border: "1px solid #cbd5e1",
                          fontSize: "0.8rem",
                        }}
                      />
                      <input
                        type="text"
                        value={rowDraft.validTo || ""}
                        onChange={(e) =>
                          setRowDraft({ ...rowDraft, validTo: e.target.value || null })
                        }
                        placeholder="Đến..."
                        style={{
                          width: "50%",
                          padding: "6px 6px",
                          borderRadius: 6,
                          border: "1px solid #cbd5e1",
                          fontSize: "0.8rem",
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ gridColumn: "span 2" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: 3,
                      }}
                    >
                      Nhóm ngành công nhận (cách nhau bởi dấu phẩy)
                    </label>
                    <input
                      type="text"
                      value={rowFieldsText}
                      onChange={(e) => setRowFieldsText(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: "0.82rem",
                      }}
                    />
                  </div>

                  <div style={{ gridColumn: "span 2" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: 3,
                      }}
                    >
                      Điều kiện / Ghi chú
                    </label>
                    <input
                      type="text"
                      value={rowDraft.note || rowDraft.conditions || ""}
                      onChange={(e) =>
                        setRowDraft({
                          ...rowDraft,
                          note: e.target.value || null,
                          conditions: e.target.value || null,
                        })
                      }
                      placeholder="Điều kiện áp dụng hoặc ghi chú kiểm chứng..."
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: "0.82rem",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNewRow(false);
                      setEditingRowIndex(null);
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      backgroundColor: "#ffffff",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={saveRowDraft}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 6,
                      border: "none",
                      backgroundColor: "#1e3a8a",
                      color: "#ffffff",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Lưu dòng điểm
                  </button>
                </div>
              </div>
            )}

            {/* Council Scores Table — Harmonized 10-column layout */}
            {displayedCouncilScores.length > 0 ? (
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  overflowX: "auto",
                  overscrollBehavior: "contain",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.82rem",
                    textAlign: "left",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#475569" }}>
                        Hội đồng
                      </th>
                      <th style={{ padding: "10px 10px", fontWeight: 600, color: "#475569" }}>
                        Năm
                      </th>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#475569" }}>
                        Điểm
                      </th>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#475569" }}>
                        Ấn phẩm
                      </th>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#475569" }}>
                        Nhóm ngành
                      </th>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#475569" }}>
                        Hiệu lực
                      </th>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#475569" }}>
                        Điều kiện
                      </th>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#475569" }}>
                        Nguồn
                      </th>
                      <th style={{ padding: "10px 12px", fontWeight: 600, color: "#475569" }}>
                        Trạng thái
                      </th>
                      <th
                        style={{
                          padding: "10px 12px",
                          fontWeight: 600,
                          color: "#475569",
                          textAlign: "right",
                        }}
                      >
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedCouncilScores.map((cs, idx) => {
                      const isVerified = cs.verificationStatus === "VERIFIED";
                      const palette = getScoreBadgePalette(cs.maxScore, isVerified);
                      const effRange =
                        cs.validFrom || cs.validTo
                          ? `${cs.validFrom || "Đầu kỳ"} → ${cs.validTo || "Hiện hành"}`
                          : "Theo kỳ quyết định";
                      const conditionText =
                        [cs.conditions, cs.note].filter(Boolean).join(" — ") || "—";

                      return (
                        <tr
                          key={idx}
                          style={{
                            borderBottom:
                              idx === displayedCouncilScores.length - 1
                                ? "none"
                                : "1px solid #f1f5f9",
                            backgroundColor:
                              cs.verificationStatus === "NEEDS_REVIEW" ? "#fffbeb" : "#ffffff",
                          }}
                        >
                          <td style={{ padding: "10px 12px", color: "#0f172a", fontWeight: 600 }}>
                            <div>{cs.councilName}</div>
                            <div style={{ fontSize: "0.73rem", color: "#64748b", fontWeight: 500 }}>
                              Mã: {cs.councilId}
                            </div>
                          </td>
                          <td style={{ padding: "10px 10px", fontWeight: 700, color: "#0f172a" }}>
                            {cs.decisionYear}
                          </td>
                          <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                display: "inline-block",
                                backgroundColor: palette.backgroundColor,
                                color: palette.color,
                                border: `1px solid ${palette.borderColor}`,
                                padding: "3px 8px",
                                borderRadius: "5px",
                                fontWeight: 700,
                                fontSize: "0.8rem",
                              }}
                            >
                              {cs.maxScore === 0
                                ? "0,00 (Dừng tính điểm)"
                                : cs.maxScore === null
                                ? "Chưa xác định"
                                : formatVietnameseScore(cs.maxScore)}
                            </span>
                            {!isVerified && (
                              <div
                                style={{
                                  fontSize: "0.7rem",
                                  color: "#b45309",
                                  marginTop: "3px",
                                  fontWeight: 600,
                                }}
                              >
                                Cần kiểm tra nguồn
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#334155" }}>
                            {cs.publicationType || "Toàn tạp chí"}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#334155", fontSize: "0.78rem" }}>
                            {(cs.scientificFields || []).length > 0
                              ? (cs.scientificFields || []).join(", ")
                              : metaPrimaryField || candidate.primaryField || "—"}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#475569", fontSize: "0.78rem" }}>
                            {effRange}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#475569", fontSize: "0.78rem" }}>
                            {conditionText}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#475569", fontSize: "0.78rem" }}>
                            <div>{cs.decisionNumber || "QĐ 26/QĐ-HĐGSNN"}</div>
                            {cs.sourcePage && (
                              <div style={{ color: "#64748b", fontSize: "0.74rem" }}>
                                {cs.sourcePage}
                              </div>
                            )}
                            {isValidUrl(cs.sourceUrl || undefined) && (
                              <a
                                href={cs.sourceUrl || undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                  color: "#2563eb",
                                  fontWeight: 600,
                                  textDecoration: "none",
                                  marginTop: "2px",
                                }}
                              >
                                <ExternalLink size={12} />
                                Xem văn bản
                              </a>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: 4,
                                backgroundColor:
                                  cs.verificationStatus === "VERIFIED"
                                    ? "#dcfce7"
                                    : cs.verificationStatus === "NEEDS_REVIEW"
                                    ? "#fef3c7"
                                    : "#f1f5f9",
                                color:
                                  cs.verificationStatus === "VERIFIED"
                                    ? "#166534"
                                    : cs.verificationStatus === "NEEDS_REVIEW"
                                    ? "#92400e"
                                    : "#475569",
                              }}
                            >
                              {cs.verificationStatus}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "10px 12px",
                              textAlign: "right",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <div style={{ display: "inline-flex", gap: 4 }}>
                              {cs.verificationStatus !== "VERIFIED" && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickVerifyRow(cs)}
                                  title="Xác nhận VERIFIED sau khi đã kiểm tra nguồn"
                                  style={{
                                    padding: "4px 6px",
                                    borderRadius: 4,
                                    border: "1px solid #86efac",
                                    backgroundColor: "#f0fdf4",
                                    color: "#166534",
                                    fontSize: "0.72rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 2,
                                  }}
                                >
                                  <Check size={12} /> Xác minh
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => startEditRow(cs)}
                                title="Sửa dòng điểm này"
                                style={{
                                  padding: "4px 6px",
                                  borderRadius: 4,
                                  border: "1px solid #cbd5e1",
                                  backgroundColor: "#ffffff",
                                  color: "#334155",
                                  cursor: "pointer",
                                }}
                              >
                                <Edit size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(cs)}
                                title="Xóa dòng điểm này"
                                style={{
                                  padding: "4px 6px",
                                  borderRadius: 4,
                                  border: "1px solid #fecaca",
                                  backgroundColor: "#fef2f2",
                                  color: "#991b1b",
                                  cursor: "pointer",
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "8px",
                  backgroundColor: "#f8fafc",
                  border: "1px dashed #cbd5e1",
                  color: "#475569",
                  fontSize: "0.84rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <span>
                  {councilViewMode === "selected" && normSelectedCouncil
                    ? `Chưa có bản ghi điểm nào thuộc Hội đồng "${normSelectedCouncil.councilName}".`
                    : "Chưa có bản ghi điểm theo Hội đồng nào. Bấm 'Thêm bản ghi điểm Hội đồng' để bổ sung."}
                </span>
                {councilViewMode === "selected" && councilScores.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCouncilViewMode("all")}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      border: "1px solid #bfdbfe",
                      backgroundColor: "#eff6ff",
                      color: "#1e40af",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Xem tất cả {councilScores.length} bản ghi Hội đồng khác
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Website & Liên kết chính thức — Harmonized with JournalDetailModal */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "8px",
              backgroundColor: "#f0fdfa",
              border: "1px solid #ccfbf1",
            }}
          >
            <h4
              style={{
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "#0f766e",
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Globe size={16} />
              3. Website chính thức & Đường dẫn liên quan
            </h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
              {isValidUrl(metaWebsite || candidate.website) ? (
                <a
                  href={metaWebsite || candidate.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "6px 12px",
                    backgroundColor: "#0d9488",
                    color: "#ffffff",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  <ExternalLink size={15} />
                  Mở Trang chủ tạp chí ({metaWebsite || candidate.website})
                </a>
              ) : (
                <span
                  style={{
                    color: "#64748b",
                    fontSize: "0.85rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <AlertCircle size={15} />
                  Chưa có trang chủ được xác minh.
                </span>
              )}

              {/* Extra links */}
              {links.map((l, i) =>
                isValidUrl(l.url) ? (
                  <a
                    key={i}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "5px 10px",
                      backgroundColor: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      color: "#334155",
                      fontSize: "0.8rem",
                      fontWeight: 500,
                      textDecoration: "none",
                    }}
                  >
                    <LinkIcon size={13} />
                    {l.label || l.linkType}
                  </a>
                ) : null
              )}
            </div>
          </div>

          {/* Section 4: Thể lệ, quy cách bản thảo & Quy chuẩn xuất bản — Harmonized with JournalDetailModal */}
          <div>
            <h4
              style={{
                fontSize: "0.95rem",
                fontWeight: 700,
                color: "#0f172a",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FileText size={17} color="#2563eb" />
              4. Thể lệ, quy cách bản thảo & Quy chuẩn xuất bản
            </h4>

            {guidelines && guidelines.hasGuidelines ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: "14px",
                  fontSize: "0.85rem",
                }}
              >
                {guidelines.summary && (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      backgroundColor: "#f8fafc",
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <span style={{ fontWeight: 600, color: "#334155" }}>
                      Tóm tắt thể lệ bài viết:
                    </span>
                    <p style={{ margin: "4px 0 0 0", color: "#1e293b", lineHeight: 1.5 }}>
                      {guidelines.summary}
                    </p>
                  </div>
                )}

                <div>
                  <span style={{ color: "#64748b" }}>Định dạng bản thảo:</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {guidelines.manuscriptFormat || "Microsoft Word / PDF"}
                  </div>
                </div>

                <div>
                  <span style={{ color: "#64748b" }}>Giới hạn số từ / số trang:</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {guidelines.wordLimitMin ? `${guidelines.wordLimitMin} - ` : ""}
                    {guidelines.wordLimitMax ? `${guidelines.wordLimitMax} từ` : "Theo quy định"}
                    {guidelines.pageLimit ? ` (${guidelines.pageLimit})` : ""}
                  </div>
                </div>

                <div>
                  <span style={{ color: "#64748b" }}>Chuẩn trích dẫn & TLTK:</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {guidelines.citationStyle || "APA 7th"}
                  </div>
                </div>

                <div>
                  <span style={{ color: "#64748b" }}>Ngôn ngữ công bố:</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {guidelines.publicationLanguage || "Tiếng Việt"}
                  </div>
                </div>

                <div>
                  <span style={{ color: "#64748b" }}>Tần suất xuất bản:</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {guidelines.publicationFrequency || "Đang cập nhật"}
                  </div>
                </div>

                <div>
                  <span style={{ color: "#64748b" }}>Thời gian phản biện ước tính:</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {guidelines.reviewTimeWeeks || "Chưa công bố"}
                  </div>
                </div>

                <div>
                  <span style={{ color: "#64748b" }}>Phí phản biện & Phí xuất bản:</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {guidelines.reviewFee ? `Phản biện: ${guidelines.reviewFee} · ` : ""}
                    {guidelines.publicationFee
                      ? `APC: ${guidelines.publicationFee}`
                      : "Miễn phí hoặc chưa công khai"}
                  </div>
                </div>

                {isValidUrl(guidelines.templateUrl) && (
                  <div>
                    <span style={{ color: "#64748b" }}>File mẫu bài viết:</span>
                    <div style={{ marginTop: "4px" }}>
                      <a
                        href={guidelines.templateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          color: "#2563eb",
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        <Download size={14} />
                        Tải file mẫu (.docx/.tex)
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  padding: "16px",
                  borderRadius: "8px",
                  backgroundColor: "#f8fafc",
                  border: "1px dashed #cbd5e1",
                  color: "#64748b",
                  fontSize: "0.85rem",
                  fontStyle: "italic",
                }}
              >
                Chưa có dữ liệu thể lệ đăng bài chi tiết cho tạp chí này. Sau khi duyệt, Admin có thể cập nhật thêm thông tin quy chuẩn xuất bản.
              </div>
            )}
          </div>

          {/* Section 5: Nộp bài trực tuyến & Liên hệ tòa soạn — Harmonized with JournalDetailModal */}
          <div
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <h4
              style={{
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "#334155",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Mail size={16} color="#2563eb" />
              5. Nộp bài trực tuyến & Liên hệ tòa soạn
            </h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "12px",
                fontSize: "0.85rem",
              }}
            >
              {guidelines?.submissionUrl && isValidUrl(guidelines.submissionUrl) && (
                <div>
                  <span style={{ color: "#64748b" }}>Cổng nộp bài trực tuyến:</span>
                  <div style={{ marginTop: "4px" }}>
                    <a
                      href={guidelines.submissionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        color: "#2563eb",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      <ExternalLink size={14} />
                      Mở cổng nộp bài
                    </a>
                  </div>
                </div>
              )}

              {guidelines?.editorialEmail && (
                <div>
                  <span style={{ color: "#64748b" }}>Email tòa soạn:</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {guidelines.editorialEmail}
                  </div>
                </div>
              )}

              {guidelines?.contactPhone && (
                <div>
                  <span style={{ color: "#64748b" }}>Điện thoại:</span>
                  <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                    {guidelines.contactPhone}
                  </div>
                </div>
              )}

              {guidelines?.officeAddress && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ color: "#64748b" }}>Địa chỉ tòa soạn:</span>
                  <div style={{ fontWeight: 500, color: "#0f172a", marginTop: "2px" }}>
                    {guidelines.officeAddress}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 6: Trạng thái kiểm chứng & Quản trị phê duyệt */}
          <div
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {/* Spark/HĐGSNN Verification State banner matching user detail modal */}
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                backgroundColor: verification?.status === "verified" ? "#f0fdf4" : "#fefce8",
                border: `1px solid ${
                  verification?.status === "verified" ? "#bbf7d0" : "#fef08a"
                }`,
                fontSize: "0.82rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <ShieldCheck
                  size={16}
                  color={verification?.status === "verified" ? "#166534" : "#854d0e"}
                />
                <span
                  style={{
                    fontWeight: 600,
                    color: verification?.status === "verified" ? "#166534" : "#854d0e",
                  }}
                >
                  6. Trạng thái kiểm chứng hệ thống:{" "}
                  {verification?.status === "verified"
                    ? "Đã xác minh chính thức"
                    : "Chưa kiểm chứng toàn diện"}
                </span>
              </div>
              <div style={{ color: "#64748b" }}>
                Nguồn:{" "}
                {candidate.scoreSourceNote ||
                  verification?.sourceReference ||
                  "Quyết định 26/QĐ-HĐGSNN"}{" "}
                · Ngày rà soát:{" "}
                {verification?.verifiedDate || candidate.updatedAt?.split("T")[0] || "Hôm nay"}
              </div>
            </div>

            {/* Unverified fields attention badges */}
            {candidate.unverifiedFields && candidate.unverifiedFields.length > 0 && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  backgroundColor: "#fffbeb",
                  border: "1px solid #fef3c7",
                  fontSize: "0.82rem",
                  color: "#92400e",
                }}
              >
                <strong>Các thông tin cần lưu ý khi đối soát:</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                  {candidate.unverifiedFields.map((f, i) => (
                    <span
                      key={i}
                      style={{
                        backgroundColor: "#fef3c7",
                        padding: "2px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Admin edit reason note */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#334155",
                  marginBottom: "4px",
                }}
              >
                Ghi chú / Lý do chỉnh sửa của Admin (lưu vào lịch sử kiểm duyệt):
              </label>
              <input
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Nhập ghi chú đối chiếu hoặc lý do chỉnh sửa mức điểm (ví dụ: Đã kiểm tra Phụ lục 24 QĐ 26/QĐ-HĐGSNN)..."
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.84rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Admin score edit history */}
            {candidate.scoreEditHistory && candidate.scoreEditHistory.length > 0 && (
              <div style={{ fontSize: "0.78rem", color: "#475569" }}>
                <div
                  style={{
                    fontWeight: 700,
                    color: "#334155",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    marginBottom: "4px",
                  }}
                >
                  <History size={14} /> Lịch sử chỉnh sửa / kiểm duyệt ({candidate.scoreEditHistory.length}):
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {candidate.scoreEditHistory.slice(-5).map((log, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "4px 8px",
                        backgroundColor: "#ffffff",
                        borderRadius: "4px",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <strong>{new Date(log.editedAt).toLocaleString("vi-VN")}</strong> ·{" "}
                      <span>{log.editedBy}</span> ·{" "}
                      <span style={{ color: "#1e40af", fontWeight: 600 }}>{log.reason}</span>
                      {log.summary ? ` (${log.summary})` : ""}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Subtle Technical Metadata for Admin */}
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                backgroundColor: "#ffffff",
                border: "1px dashed #cbd5e1",
                fontSize: "0.75rem",
                color: "#64748b",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <span>
                Thông tin kỹ thuật nội bộ (Admin): Mã đối soát <code>{candidate.journalId}</code>
                {candidate.existingJournalId && (
                  <span>
                    {" "}
                    → Khớp với tạp chí công khai <code>{candidate.existingJournalId}</code>
                  </span>
                )}
              </span>
              <span>Hàng nguồn Google Sheets: #{candidate.sheetRowIndex || "—"}</span>
            </div>
          </div>

          {/* Rejection input box */}
          {isRejectingOpen && (
            <div
              style={{
                padding: "14px",
                backgroundColor: "#fef2f2",
                borderRadius: "8px",
                border: "1px solid #fecaca",
              }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#991b1b",
                  marginBottom: "4px",
                }}
              >
                Lý do từ chối bản ghi:
              </label>
              <textarea
                rows={2}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Nhập lý do (ví dụ: Thiếu văn bản công nhận, không đúng chuyên ngành, v.v.)..."
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #fca5a5",
                  fontSize: "0.85rem",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "8px",
                  marginTop: "8px",
                }}
              >
                <button
                  onClick={() => setIsRejectingOpen(false)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  Hủy
                </button>
                <button
                  onClick={handleRejectConfirm}
                  disabled={isProcessing}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "#dc2626",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  Xác nhận Từ chối
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#f8fafc",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <button
            onClick={onClose}
            disabled={isProcessing}
            style={{
              padding: "8px 18px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              backgroundColor: "#ffffff",
              color: "#334155",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Đóng
          </button>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {!isRejectingOpen && (
              <button
                onClick={() => setIsRejectingOpen(true)}
                disabled={isProcessing}
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  border: "1px solid #fca5a5",
                  backgroundColor: "#fef2f2",
                  color: "#991b1b",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <XCircle size={15} />
                Từ chối
              </button>
            )}

            <button
              onClick={handleNeedsReview}
              disabled={isProcessing}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                border: "1px solid #fde047",
                backgroundColor: "#fefce8",
                color: "#854d0e",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <HelpCircle size={15} />
              Cần hiệu chỉnh
            </button>

            {onSaveDraft && (
              <button
                type="button"
                onClick={handleSaveDraftClick}
                disabled={isProcessing}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid #93c5fd",
                  backgroundColor: "#eff6ff",
                  color: "#1e3a8a",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
                title="Lưu các chỉnh sửa vào bản ghi ứng viên trong Hàng chờ duyệt mà chưa công bố ra danh mục công khai"
              >
                <Save size={15} />
                Lưu nháp
              </button>
            )}

            <button
              onClick={handleApprove}
              disabled={isProcessing}
              style={{
                padding: "8px 22px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#166534",
                color: "#ffffff",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <CheckCircle2 size={16} />
              {isProcessing ? "Đang xử lý..." : "Duyệt & Công bố"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
