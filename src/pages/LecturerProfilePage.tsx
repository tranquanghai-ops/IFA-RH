import React, { useState, useEffect } from "react";
import { useAuth } from "../firebase/auth";
import { updateUserProfile } from "../firebase/firestore";
import {
  User,
  Mail,
  GraduationCap,
  Building,
  Globe,
  Save,
  CheckCircle,
  ExternalLink,
} from "lucide-react";

export const LecturerProfilePage: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [academicDegree, setAcademicDegree] = useState("");
  const [orcid, setOrcid] = useState("");
  const [googleScholar, setGoogleScholar] = useState("");
  const [researchGate, setResearchGate] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setDepartment(profile.department || "");
      setAcademicDegree(profile.academicDegree || "");
      setOrcid(profile.orcid || "");
      setGoogleScholar(profile.googleScholar || "");
      setResearchGate(profile.researchGate || "");
      setWebsite(profile.website || "");
    }
  }, [profile]);

  if (!profile) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Vui lòng nhập họ và tên!");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");
      await updateUserProfile(
        profile.uid,
        {
          name: name.trim(),
          department: department.trim(),
          academicDegree: academicDegree.trim(),
          orcid: orcid.trim(),
          googleScholar: googleScholar.trim(),
          researchGate: researchGate.trim(),
          website: website.trim(),
        },
        { uid: profile.uid, email: profile.email, role: profile.role }
      );
      await refreshProfile();
      setMessage("Cập nhật hồ sơ giảng viên thành công!");
    } catch (err: any) {
      setError(err.message || "Lỗi cập nhật hồ sơ.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container" style={{ maxWidth: 840 }}>
      <div className="card" style={{ padding: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid var(--line)" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#e0f2fe",
              color: "#0369a1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <User size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: "1.5rem", color: "var(--primary)" }}>Hồ sơ Giảng viên</h1>
            <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
              Cập nhật thông tin học thuật và các liên kết nghiên cứu khoa học công khai
            </p>
          </div>
        </div>

        {message && (
          <div
            style={{
              background: "#dcfce7",
              color: "#15803d",
              padding: 12,
              borderRadius: 6,
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <CheckCircle size={18} />
            {message}
          </div>
        )}

        {error && (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              padding: 12,
              borderRadius: 6,
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              Họ và tên giảng viên <span style={{ color: "red" }}>*</span>
            </label>
            <input
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email TDTU</label>
            <input
              type="email"
              className="form-control"
              value={profile.email}
              disabled
              style={{ backgroundColor: "#f1f5f9", cursor: "not-allowed" }}
            />
            <small style={{ color: "var(--muted)" }}>Tài khoản định danh qua Google Workspace TDTU.</small>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Bộ môn / Ngành</label>
              <input
                type="text"
                className="form-control"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Bộ môn Thiết kế Đồ họa..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Học vị / Học hàm</label>
              <input
                type="text"
                className="form-control"
                value={academicDegree}
                onChange={(e) => setAcademicDegree(e.target.value)}
                placeholder="ThS, TS, PGS.TS..."
              />
            </div>
          </div>

          <div style={{ marginTop: 16, marginBottom: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
            <h3 style={{ fontSize: "1.1rem", color: "var(--primary)", marginBottom: 12 }}>
              Định danh Học thuật Quốc tế & Hồ sơ NCKH
            </h3>

            <div className="form-group">
              <label className="form-label">Mã ORCID (Open Researcher and Contributor ID)</label>
              <input
                type="text"
                className="form-control"
                value={orcid}
                onChange={(e) => setOrcid(e.target.value)}
                placeholder="0000-0002-1825-0097"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Hồ sơ Google Scholar</label>
              <input
                type="url"
                className="form-control"
                value={googleScholar}
                onChange={(e) => setGoogleScholar(e.target.value)}
                placeholder="https://scholar.google.com/citations?user=..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Hồ sơ ResearchGate</label>
              <input
                type="url"
                className="form-control"
                value={researchGate}
                onChange={(e) => setResearchGate(e.target.value)}
                placeholder="https://www.researchgate.net/profile/..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Website cá nhân / Portfolio nghệ thuật</label>
              <input
                type="url"
                className="form-control"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://mywebsite.com"
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Save size={16} />
              {loading ? "Đang lưu..." : "Lưu thay đổi hồ sơ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
