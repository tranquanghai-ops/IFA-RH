import React from "react";

export const Footer: React.FC = () => {
  return (
    <footer className="site-footer" style={{ padding: "18px 0", borderTop: "1px solid var(--line-strong)", background: "#0f172a", color: "#94a3b8" }}>
      <div className="app-container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, fontSize: "0.8125rem" }}>
          <div>
            <span style={{ color: "#ffffff", fontWeight: 700 }}>IFA-RH · IFA Research Hub</span>
            <span style={{ margin: "0 8px", color: "#475569" }}>—</span>
            <span>Khoa Mỹ thuật Công nghiệp · Trường Đại học Tôn Đức Thắng</span>
          </div>
          <div style={{ color: "#64748b" }}>
            <span>© {new Date().getFullYear()} IFA Research Hub</span>
            <span style={{ margin: "0 8px" }}>·</span>
            <a href="https://ifa.tdtu.edu.vn" target="_blank" rel="noreferrer" style={{ color: "#38bdf8", textDecoration: "none" }}>
              ifa.tdtu.edu.vn
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
