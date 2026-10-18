import React from "react";
import type { Opportunity, OpportunityPreview } from "../types";
import { Modal } from "./Modal";
import { OpportunityDetailContent } from "./OpportunityDetailContent";
import { buildOpportunityShareUrl, copyTextToClipboard } from "../utils/share";
import { useToast } from "../context/ToastContext";
import { ExternalLink, Link2 } from "lucide-react";

interface OpportunityDetailModalProps {
  opportunity: Opportunity | OpportunityPreview | null;
  onClose: () => void;
  isPreview?: boolean;
  statusNotice?: string;
  shareUrl?: string;
}

export const OpportunityDetailModal: React.FC<OpportunityDetailModalProps> = ({
  opportunity,
  onClose,
  isPreview = false,
  statusNotice,
  shareUrl,
}) => {
  const { showSuccess } = useToast();

  if (!opportunity) return null;

  const handleCopyLink = async () => {
    const url = shareUrl || buildOpportunityShareUrl(opportunity.id);
    await copyTextToClipboard(url);
    showSuccess("Đã sao chép liên kết hội thảo.");
  };

  return (
    <Modal
      isOpen={!!opportunity}
      onClose={onClose}
      title={isPreview ? "Thông tin Hội thảo (Xem trước)" : "Chi tiết Thông tin Nghiên cứu Khoa học"}
      maxWidth="large"
      footer={
        <div
          style={{
            display: "flex",
            gap: 10,
            width: "100%",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            Nguồn: <strong style={{ color: "var(--text-main)" }}>Ban biên tập NCKH Khoa MTCN</strong>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {opportunity.sourceUrl && (
              <a
                href={opportunity.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
              >
                <span>Xem nguồn chính thức</span>
                <ExternalLink size={14} />
              </a>
            )}
            {opportunity.submissionUrl &&
              !opportunity.submissionUrl.startsWith("mailto:") &&
              /^https?:\/\//i.test(opportunity.submissionUrl) && (
                <a
                  href={opportunity.submissionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                >
                  <span>Nộp bài</span>
                  <ExternalLink size={14} />
                </a>
              )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCopyLink}
              title="Sao chép đường dẫn chia sẻ hội thảo"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#2563eb", fontWeight: 600 }}
            >
              <Link2 size={14} />
              <span>Sao chép liên kết</span>
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>
      }
    >
      <OpportunityDetailContent
        opportunity={opportunity}
        isPreview={isPreview}
        statusNotice={statusNotice}
      />
    </Modal>
  );
};
