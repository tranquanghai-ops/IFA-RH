import React, { useState, useEffect } from "react";
import type { Opportunity, OpportunityPreview } from "../types";
import { fetchOpportunityById, fetchOpportunityPreview } from "../firebase/firestore";
import { OpportunityDetailContent } from "../components/OpportunityDetailContent";
import { copyTextToClipboard } from "../utils/share";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../firebase/auth";
import {
  ExternalLink,
  Link2,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Home,
  CheckCircle2,
} from "lucide-react";

interface SingleOpportunityPageProps {
  opportunityId?: string | null;
  previewId?: string | null;
  onBackToPublic: () => void;
}

export const SingleOpportunityPage: React.FC<SingleOpportunityPageProps> = ({
  opportunityId,
  previewId,
  onBackToPublic,
}) => {
  const { profile } = useAuth();
  const { showSuccess, showError } = useToast();
  const isAdmin = profile?.role === "admin" || profile?.role === "owner";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Opportunity | OpportunityPreview | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusNotice, setStatusNotice] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadSingleRecord = async () => {
      setLoading(true);
      setErrorMessage("");
      setStatusNotice("");
      setData(null);

      try {
        if (opportunityId) {
          setIsPreview(false);
          const opp = await fetchOpportunityById(opportunityId);
          if (!isMounted) return;

          if (!opp) {
            setErrorMessage("Không tìm thấy thông tin hội thảo hoặc liên kết không hợp lệ.");
            return;
          }

          if (opp.status !== "published" && !isAdmin) {
            setErrorMessage("Hội thảo này hiện không khả dụng (đã tạm ẩn, đã thu hồi hoặc lưu trữ).");
            return;
          }

          if (opp.status !== "published" && isAdmin) {
            setStatusNotice(
              `Chế độ xem Quản trị: Hội thảo hiện đang ở trạng thái "${opp.status.toUpperCase()}" (chưa công bố công khai).`
            );
          }

          setData(opp);
        } else if (previewId) {
          setIsPreview(true);
          const prev = await fetchOpportunityPreview(previewId);
          if (!isMounted) return;

          if (!prev || prev.status !== "active") {
            setErrorMessage("Liên kết xem trước không tồn tại hoặc đã được thu hồi bởi Ban biên tập.");
            return;
          }

          setData(prev);
        } else {
          setErrorMessage("Liên kết không chứa mã định danh hội thảo hợp lệ.");
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error("[SingleOpportunityPage] Load Error:", err);
        setErrorMessage("Không thể tải thông tin hội thảo. Vui lòng kiểm tra lại liên kết hoặc kết nối mạng.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadSingleRecord();

    return () => {
      isMounted = false;
    };
  }, [opportunityId, previewId, isAdmin]);

  const handleCopyCurrentLink = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const success = await copyTextToClipboard(url);
    if (success) {
      showSuccess("Đã sao chép liên kết hội thảo.");
    } else {
      showError("Không thể tự động sao chép. Vui lòng sao chép địa chỉ trên thanh trình duyệt.");
    }
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="app-container" style={{ padding: "80px 20px", textAlign: "center" }}>
        <Loader2 size={36} className="animate-spin" style={{ color: "var(--primary)", margin: "0 auto 16px" }} />
        <div style={{ fontSize: "1.05rem", fontWeight: 650, color: "var(--primary)" }}>
          Đang tải thông tin hội thảo...
        </div>
        <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: 6 }}>
          Hệ thống Nghiên cứu Khoa học Giảng viên · Khoa Mỹ thuật Công nghiệp
        </p>
      </div>
    );
  }

  // 2. Error / Unavailable State
  if (errorMessage || !data) {
    return (
      <div className="app-container" style={{ padding: "60px 20px", maxWidth: 680, margin: "0 auto" }}>
        <div
          style={{
            background: "#ffffff",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: "36px 30px",
            textAlign: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "#fee2e2",
              color: "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <AlertCircle size={26} />
          </div>

          <h2 style={{ fontSize: "1.25rem", color: "var(--primary)", marginBottom: 10, fontWeight: 700 }}>
            Thông báo Liên kết
          </h2>

          <p style={{ color: "#475569", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: 24 }}>
            {errorMessage || "Không tìm thấy thông tin hội thảo."}
          </p>

          <button
            type="button"
            className="btn btn-primary"
            onClick={onBackToPublic}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 20px" }}
          >
            <Home size={16} />
            <span>Về Cổng thông tin NCKH IFA-RH</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Success State: Render Complete Dedicated Opportunity View
  return (
    <div className="app-container" style={{ maxWidth: 940, padding: "24px 20px 60px", margin: "0 auto" }}>
      {/* Top Breadcrumbs & Back Navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={onBackToPublic}
          className="btn btn-secondary btn-sm"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <ArrowLeft size={14} />
          <span>Về trang chủ</span>
        </button>

        <button
          type="button"
          onClick={handleCopyCurrentLink}
          className="btn btn-secondary btn-sm"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#2563eb", fontWeight: 600 }}
        >
          <Link2 size={14} />
          <span>Sao chép liên kết</span>
        </button>
      </div>

      {/* Main Conference Content Card */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: "28px 28px 24px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
        }}
      >
        <OpportunityDetailContent
          opportunity={data}
          isPreview={isPreview}
          statusNotice={statusNotice}
        />

        {/* Bottom Actions Bar */}
        <div
          style={{
            marginTop: 30,
            paddingTop: 20,
            borderTop: "1px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            Nguồn: <strong style={{ color: "var(--text-main)" }}>Ban biên tập NCKH Khoa MTCN</strong>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {data.sourceUrl && (
              <a
                href={data.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
              >
                <span>Xem nguồn chính thức</span>
                <ExternalLink size={14} />
              </a>
            )}

            {data.submissionUrl &&
              !data.submissionUrl.startsWith("mailto:") &&
              /^https?:\/\//i.test(data.submissionUrl) && (
                <a
                  href={data.submissionUrl}
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
              onClick={handleCopyCurrentLink}
              title="Sao chép đường dẫn hiện tại"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#2563eb", fontWeight: 600 }}
            >
              <Link2 size={14} />
              <span>Sao chép liên kết</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onBackToPublic}
              style={{ fontWeight: 600 }}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
