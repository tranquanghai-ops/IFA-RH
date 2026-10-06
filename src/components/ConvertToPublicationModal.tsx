import React, { useState, useEffect } from "react";
import type { ResearchWork } from "../types";
import { Modal } from "./Modal";
import { convertResearchWorkToPublication } from "../firebase/firestore";
import { useAuth } from "../firebase/auth";
import { CheckCircle2 } from "lucide-react";

interface ConvertToPublicationModalProps {
  research: ResearchWork | null;
  onClose: () => void;
  onSuccess: (publicationId: string) => void;
}

export const ConvertToPublicationModal: React.FC<ConvertToPublicationModalProps> = ({
  research,
  onClose,
  onSuccess,
}) => {
  const { profile } = useAuth();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [publisher, setPublisher] = useState("");
  const [journalOrConference, setJournalOrConference] = useState("");
  const [volume, setVolume] = useState("");
  const [issue, setIssue] = useState("");
  const [pages, setPages] = useState("");
  const [isbn, setIsbn] = useState("");
  const [issn, setIssn] = useState("");
  const [doi, setDoi] = useState("");
  const [indexing, setIndexing] = useState("");
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (research) {
      setYear(new Date().getFullYear());
      setJournalOrConference(research.venue || "");
      setPublisher("");
      setVolume("");
      setIssue("");
      setPages("");
      setIsbn("");
      setIssn("");
      setDoi("");
      setIndexing("");
      setLink("");
      setError("");
    }
  }, [research]);

  if (!research) return null;

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      setLoading(true);
      setError("");
      const pubId = await convertResearchWorkToPublication(
        research,
        {
          year,
          publisher,
          journalOrConference,
          volume,
          issue,
          pages,
          isbn,
          issn,
          doi,
          indexing,
          link,
        },
        { uid: profile.uid, email: profile.email, role: profile.role }
      );
      onSuccess(pubId);
      onClose();
    } catch (err: any) {
      setError(err.message || "Lỗi chuyển vào Hồ sơ nghiên cứu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={!!research}
      onClose={onClose}
      title="Chuyển công trình vào Hồ sơ nghiên cứu"
      maxWidth="large"
      footer={
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Hủy
          </button>
          <button type="button" className="btn btn-success" onClick={handleConvert} disabled={loading}>
            <CheckCircle2 size={16} />
            {loading ? "Đang chuyển..." : "Xác nhận chuyển vào Hồ sơ"}
          </button>
        </div>
      }
    >
      <form onSubmit={handleConvert}>
        {error && (
          <div style={{ background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 6, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: 14, borderRadius: 8, marginBottom: 16 }}>
          <h4 style={{ color: "#166534", fontSize: "0.95rem", marginBottom: 4 }}>
            Thông tin kế thừa từ công trình:
          </h4>
          <div style={{ color: "#14532d", fontWeight: 700, fontSize: "1rem" }}>{research.title}</div>
          <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: "0.85rem", color: "#166534" }}>
            <span>Loại hình: <strong>{research.category}</strong></span>
            <span>·</span>
            <span>Vai trò: <strong>{research.role}</strong></span>
            {research.coAuthors && (
              <>
                <span>·</span>
                <span>Đồng tác giả: <strong>{research.coAuthors}</strong></span>
              </>
            )}
          </div>
        </div>

        <p style={{ fontSize: "0.875rem", color: "var(--text-sub)", marginBottom: 16 }}>
          Vui lòng bổ sung thêm thông tin xuất bản chính thức (nếu có). Toàn bộ dữ liệu tiến độ sẽ được lưu giữ và liên kết để theo dõi nguồn gốc.
        </p>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Năm xuất bản / hoàn thành <span style={{ color: "red" }}>*</span></label>
            <input
              type="number"
              className="form-control"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Tên tạp chí / Hội thảo</label>
            <input
              type="text"
              className="form-control"
              value={journalOrConference}
              onChange={(e) => setJournalOrConference(e.target.value)}
              placeholder="Tên tạp chí, hội thảo kỷ yếu..."
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Đơn vị xuất bản / Tổ chức</label>
            <input
              type="text"
              className="form-control"
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
              placeholder="NXB Khoa học Tự nhiên, Springer, Elsevier..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Chỉ mục (Indexing)</label>
            <input
              type="text"
              className="form-control"
              value={indexing}
              onChange={(e) => setIndexing(e.target.value)}
              placeholder="Scopus Q1, WoS, ACI, VAST, Không chỉ mục..."
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Tập (Volume)</label>
            <input
              type="text"
              className="form-control"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              placeholder="Vol. 12"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Số (Issue)</label>
            <input
              type="text"
              className="form-control"
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="No. 4"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Trang (Pages)</label>
            <input
              type="text"
              className="form-control"
              value={pages}
              onChange={(e) => setPages(e.target.value)}
              placeholder="pp. 120-135"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">DOI</label>
            <input
              type="text"
              className="form-control"
              value={doi}
              onChange={(e) => setDoi(e.target.value)}
              placeholder="10.1016/j.procs..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">ISBN / ISSN</label>
            <input
              type="text"
              className="form-control"
              value={isbn || issn}
              onChange={(e) => {
                setIsbn(e.target.value);
                setIssn(e.target.value);
              }}
              placeholder="ISBN hoặc ISSN"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Link bài báo / Kỷ yếu công khai</label>
          <input
            type="url"
            className="form-control"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://doi.org/... hoặc link xem trực tuyến"
          />
        </div>
      </form>
    </Modal>
  );
};
