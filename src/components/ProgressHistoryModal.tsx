import React, { useState, useEffect } from "react";
import type { ResearchWork, ResearchProgress, ResearchStatus } from "../types";
import { Modal } from "./Modal";
import { fetchResearchProgressHistory } from "../firebase/firestore";
import { addDoc, collection } from "firebase/firestore";
import { firestore } from "../firebase/config";
import { Plus, History, Clock } from "lucide-react";

interface ProgressHistoryModalProps {
  research: ResearchWork | null;
  onClose: () => void;
  onStatusUpdated?: () => void;
}

const STATUS_LIST: ResearchStatus[] = [
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

export const ProgressHistoryModal: React.FC<ProgressHistoryModalProps> = ({
  research,
  onClose,
  onStatusUpdated,
}) => {
  const [history, setHistory] = useState<ResearchProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [newStatus, setNewStatus] = useState<ResearchStatus>("Đang viết");
  const [newNote, setNewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = async () => {
    if (!research) return;
    setLoading(true);
    try {
      const data = await fetchResearchProgressHistory(research.id);
      setHistory(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (research) {
      setNewStatus(research.status);
      setNewNote("");
      loadHistory();
    }
  }, [research]);

  if (!research) return null;

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) {
      setError("Vui lòng nhập ghi chú cho mốc tiến độ!");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const now = new Date().toISOString();
      await addDoc(collection(firestore, "researchProgress"), {
        researchId: research.id,
        userId: research.userId,
        userEmail: research.userEmail,
        status: newStatus,
        date: new Date().toLocaleDateString("vi-VN"),
        notes: newNote.trim(),
        createdAt: now,
      });

      setNewNote("");
      await loadHistory();
      if (onStatusUpdated) onStatusUpdated();
    } catch (err: any) {
      setError(err.message || "Lỗi lưu mốc tiến độ.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={!!research}
      onClose={onClose}
      title="Lịch sử Tiến độ Nghiên cứu Khoa học"
      maxWidth="large"
      footer={
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
          Đóng
        </button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Research info banner */}
        <div style={{ background: "#f8fafc", padding: 16, borderRadius: 8, border: "1px solid var(--line)" }}>
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 600 }}>CÔNG TRÌNH:</div>
          <h3 style={{ fontSize: "1.15rem", color: "var(--primary)", marginTop: 2 }}>{research.title}</h3>
          <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: "0.85rem", color: "var(--text-sub)" }}>
            <span>Loại hình: <strong>{research.category}</strong></span>
            <span>·</span>
            <span>Trạng thái hiện tại: <strong style={{ color: "var(--secondary)" }}>{research.status}</strong></span>
          </div>
        </div>

        {/* Append new milestone form */}
        <form onSubmit={handleAddMilestone} style={{ background: "#ffffff", padding: 16, borderRadius: 8, border: "1px solid var(--line-strong)" }}>
          <h4 style={{ fontSize: "0.95rem", marginBottom: 12, display: "flex", alignItems: "center", gap: 6, color: "var(--primary)" }}>
            <Plus size={16} /> Thêm mốc tiến độ mới
          </h4>

          {error && (
            <div style={{ background: "#fee2e2", color: "#991b1b", padding: 10, borderRadius: 6, marginBottom: 12, fontSize: "0.875rem" }}>
              {error}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Trạng thái mốc này:</label>
              <select
                className="form-control"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as ResearchStatus)}
              >
                {STATUS_LIST.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Ghi chú chi tiết sự kiện:</label>
              <input
                type="text"
                className="form-control"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Ví dụ: Đã gửi bản thảo cho tạp chí qua hệ thống Editorial Manager"
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? "Đang ghi..." : "Ghi nhận mốc tiến độ"}
            </button>
          </div>
        </form>

        {/* Timeline list */}
        <div>
          <h4 style={{ fontSize: "1rem", marginBottom: 14, display: "flex", alignItems: "center", gap: 6, color: "var(--primary)" }}>
            <History size={18} /> Dòng thời gian tiến độ (Append-only)
          </h4>

          {loading ? (
            <div style={{ textAlign: "center", padding: 20, color: "var(--muted)" }}>Đang tải lịch sử...</div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: "center", padding: 20, color: "var(--muted)", fontStyle: "italic" }}>
              Chưa có mốc ghi nhận nào khác.
            </div>
          ) : (
            <div className="timeline">
              {history.map((item) => (
                <div key={item.id} className="timeline-item">
                  <div className="timeline-point" />
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="timeline-date">{item.date}</span>
                    <span className="badge badge-neutral" style={{ fontWeight: 600 }}>{item.status}</span>
                  </div>
                  <div className="timeline-content">
                    <p style={{ fontSize: "0.875rem", color: "var(--text-main)" }}>{item.notes}</p>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={11} /> {new Date(item.createdAt).toLocaleString("vi-VN")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
