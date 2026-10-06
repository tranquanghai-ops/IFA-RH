import React from "react";

export const Footer: React.FC = () => {
  return (
    <footer className="site-footer">
      <div className="app-container">
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-brand">
              <h4>IFA-RH · IFA Research Hub</h4>
              <p style={{ marginTop: 4, fontSize: "0.8125rem", color: "#94a3b8" }}>
                Hệ thống Quản lý và Phát triển Nghiên cứu Khoa học Giảng viên
              </p>
              <p style={{ fontSize: "0.8125rem", color: "#94a3b8" }}>
                Khoa Mỹ thuật Công nghiệp — Trường Đại học Tôn Đức Thắng (TDTU)
              </p>
            </div>
            <div style={{ textAlign: "right", fontSize: "0.8125rem" }}>
              <p style={{ color: "#e2e8f0", fontWeight: 600 }}>19 Nguyễn Hữu Thọ, P. Tân Phong, Q.7, TP.HCM</p>
              <p style={{ color: "#94a3b8" }}>Website: <a href="https://ifa.tdtu.edu.vn" target="_blank" rel="noreferrer" style={{ color: "#38bdf8" }}>ifa.tdtu.edu.vn</a></p>
            </div>
          </div>
          <div className="footer-bottom">
            <div>
              © {new Date().getFullYear()} IFA Research Hub. Bản quyền thuộc về Khoa Mỹ thuật Công nghiệp, ĐH Tôn Đức Thắng.
            </div>
            <div>
              Production URL: <span style={{ color: "#38bdf8" }}>https://ifa-rh.web.app</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
