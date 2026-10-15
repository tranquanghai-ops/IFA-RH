import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showSuccess: (message: string, duration?: number) => void;
  showError: (userMessage: string, technicalDetails?: any) => void;
  showInfo: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, duration: number = 3500) => {
      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      setToasts((prev) => [...prev, { id, type, message, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const showSuccess = useCallback(
    (message: string, duration: number = 3500) => {
      addToast("success", message, duration);
    },
    [addToast]
  );

  const showError = useCallback(
    (userMessage: string, technicalDetails?: any) => {
      if (technicalDetails !== undefined) {
        console.error("[IFA-RH Error Details]:", userMessage, technicalDetails);
      }
      // Error toasts stay longer (8s) or until closed by user
      addToast("error", userMessage, 8000);
    },
    [addToast]
  );

  const showInfo = useCallback(
    (message: string, duration: number = 4000) => {
      addToast("info", message, duration);
    },
    [addToast]
  );

  const showWarning = useCallback(
    (message: string, duration: number = 5000) => {
      addToast("warning", message, duration);
    },
    [addToast]
  );

  return (
    <ToastContext.Provider
      value={{ showSuccess, showError, showInfo, showWarning, removeToast }}
    >
      {children}
      {/* Toast Notification Container */}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxWidth: "calc(100vw - 32px)",
          width: 380,
          pointerEvents: "none",
        }}
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const isSuccess = toast.type === "success";
          const isError = toast.type === "error";
          const isWarning = toast.type === "warning";

          const bg = isSuccess
            ? "#ecfdf5"
            : isError
            ? "#fff1f2"
            : isWarning
            ? "#fffbeb"
            : "#eff6ff";
          const border = isSuccess
            ? "#a7f3d0"
            : isError
            ? "#fecdd3"
            : isWarning
            ? "#fde68a"
            : "#bfdbfe";
          const text = isSuccess
            ? "#065f46"
            : isError
            ? "#9f1239"
            : isWarning
            ? "#92400e"
            : "#1e40af";
          const iconColor = isSuccess
            ? "#059669"
            : isError
            ? "#e11d48"
            : isWarning
            ? "#d97706"
            : "#2563eb";

          return (
            <div
              key={toast.id}
              role="alert"
              style={{
                pointerEvents: "auto",
                background: bg,
                border: `1px solid ${border}`,
                color: text,
                borderRadius: 8,
                padding: "12px 14px",
                boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.08)",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                fontSize: 13.5,
                lineHeight: 1.45,
                animation: "toastSlideIn 0.25s ease-out forwards",
              }}
            >
              <div style={{ flexShrink: 0, marginTop: 1, color: iconColor }}>
                {isSuccess && <CheckCircle2 size={18} />}
                {isError && <AlertCircle size={18} />}
                {isWarning && <AlertTriangle size={18} />}
                {!isSuccess && !isError && !isWarning && <Info size={18} />}
              </div>
              <div style={{ flex: 1, wordBreak: "break-word", fontWeight: 500 }}>
                {toast.message}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                aria-label="Đóng thông báo"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: text,
                  opacity: 0.6,
                  padding: 2,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: -2,
                  marginRight: -4,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Graceful fallback for tests or components rendered outside provider
    return {
      showSuccess: (msg) => console.log("[Toast Success]:", msg),
      showError: (msg, tech) => console.error("[Toast Error]:", msg, tech),
      showInfo: (msg) => console.info("[Toast Info]:", msg),
      showWarning: (msg) => console.warn("[Toast Warning]:", msg),
      removeToast: () => {},
    };
  }
  return ctx;
};
