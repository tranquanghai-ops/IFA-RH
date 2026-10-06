import React from "react";
import { useAuth } from "../firebase/auth";
import { Compass, LogIn } from "lucide-react";

interface PublicHeaderProps {
  onSelectTab: (tab: string) => void;
}

export const PublicHeader: React.FC<PublicHeaderProps> = ({ onSelectTab }) => {
  const { login } = useAuth();

  return (
    <header className="public-site-header">
      <div className="app-container">
        <div className="public-header-inner">
          {/* Brand section */}
          <div
            className="public-brand-section"
            onClick={() => onSelectTab("public")}
            style={{ cursor: "pointer" }}
          >
            <div className="public-logos-group">
              <img
                src="/tdtu-logo.png"
                alt="Đại học Tôn Đức Thắng"
                className="public-logo-tdtu"
              />
              <div className="public-logo-divider" />
              <img
                src="/ifa-logo.svg"
                alt="Khoa Mỹ thuật Công nghiệp"
                className="public-logo-ifa"
              />
            </div>
            <div className="public-brand-text">
              <div className="public-brand-title">
                IFA-RH
                <span className="public-brand-badge">RESEARCH HUB</span>
              </div>
              <div className="public-brand-subtitle">
                Hệ thống Nghiên cứu Khoa học Giảng viên · Khoa Mỹ thuật Công nghiệp
              </div>
            </div>
          </div>

          {/* Public Actions */}
          <div className="public-header-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm public-btn-portal"
              onClick={() => onSelectTab("public")}
            >
              <Compass size={16} />
              <span>Cổng Cơ hội NCKH</span>
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm public-btn-login"
              onClick={login}
            >
              <LogIn size={16} />
              <span className="public-login-full">Đăng nhập TDTU</span>
              <span className="public-login-short">Đăng nhập</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
