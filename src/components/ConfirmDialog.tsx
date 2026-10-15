import React from "react";
import { AlertTriangle, AlertCircle, HelpCircle, Loader2 } from "lucide-react";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "primary";
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  promptInput?: {
    label?: string;
    value: string;
    placeholder?: string;
    required?: boolean;
    onChange: (val: string) => void;
  };
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmText,
  cancelLabel,
  cancelText,
  variant = "primary",
  isLoading = false,
  onConfirm,
  onCancel,
  promptInput,
}) => {
  if (!isOpen) return null;

  const resolvedConfirmLabel = confirmLabel || confirmText || "Xác nhận";
  const resolvedCancelLabel = cancelLabel || cancelText || "Hủy";

  const isDanger = variant === "danger";
  const isWarning = variant === "warning";

  const confirmBg = isDanger ? "#e11d48" : isWarning ? "#d97706" : "#2563eb";
  const confirmHoverBg = isDanger ? "#be123c" : isWarning ? "#b45309" : "#1d4ed8";
  const iconColor = isDanger ? "#e11d48" : isWarning ? "#d97706" : "#2563eb";
  const iconBg = isDanger ? "#ffe4e6" : isWarning ? "#fef3c7" : "#dbeafe";

  const isConfirmDisabled =
    isLoading || (promptInput?.required && !promptInput.value.trim());

  return (
    <div
      className="modal-backdrop"
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
        padding: 16,
      }}
      onClick={(e) => {
        if (!isLoading && e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        className="confirm-dialog-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        style={{
          background: "#ffffff",
          borderRadius: 12,
          maxWidth: 440,
          width: "100%",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          animation: "dialogScaleUp 0.18s ease-out forwards",
        }}
      >
        <div style={{ padding: "20px 22px 16px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: iconBg,
                color: iconColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {isDanger && <AlertCircle size={22} />}
              {isWarning && <AlertTriangle size={22} />}
              {!isDanger && !isWarning && <HelpCircle size={22} />}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h3
                id="confirm-dialog-title"
                style={{
                  margin: "0 0 6px 0",
                  fontSize: 16.5,
                  fontWeight: 650,
                  color: "#0f172a",
                  lineHeight: 1.35,
                }}
              >
                {title}
              </h3>
              <div
                style={{
                  fontSize: 13.5,
                  color: "#475569",
                  lineHeight: 1.5,
                }}
              >
                {message}
              </div>
            </div>
          </div>

          {promptInput && (
            <div style={{ marginTop: 14, paddingLeft: 54 }}>
              {promptInput.label && (
                <label
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 5,
                  }}
                >
                  {promptInput.label}
                  {promptInput.required && <span style={{ color: "#e11d48" }}> *</span>}
                </label>
              )}
              <input
                type="text"
                autoFocus
                value={promptInput.value}
                onChange={(e) => promptInput.onChange(e.target.value)}
                placeholder={promptInput.placeholder || "Nhập nội dung..."}
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isConfirmDisabled) {
                    onConfirm();
                  }
                }}
                style={{
                  width: "100%",
                  padding: "7px 11px",
                  fontSize: 13.5,
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}
        </div>

        <div
          style={{
            background: "#f8fafc",
            padding: "12px 20px",
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            style={{
              padding: "7px 14px",
              fontSize: 13,
              fontWeight: 500,
              color: "#475569",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            {resolvedCancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirmDisabled}
            style={{
              padding: "7px 16px",
              fontSize: 13,
              fontWeight: 600,
              color: "#ffffff",
              background: confirmBg,
              border: "none",
              borderRadius: 6,
              cursor: isConfirmDisabled ? "not-allowed" : "pointer",
              opacity: isConfirmDisabled ? 0.65 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
            onMouseEnter={(e) => {
              if (!isConfirmDisabled) e.currentTarget.style.background = confirmHoverBg;
            }}
            onMouseLeave={(e) => {
              if (!isConfirmDisabled) e.currentTarget.style.background = confirmBg;
            }}
          >
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            {isLoading ? "Đang xử lý..." : resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
