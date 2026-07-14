import React, { useEffect } from "react";

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success";
  timestamp: Date;
}

interface ToastsProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export const Toasts: React.FC<ToastsProps> = ({ toasts, onRemove }) => {
  return (
    <div className="portal-toast-container">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, 60000); // Autoclose after 60s
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  return (
    <div className={`portal-toast toast-${toast.type}`}>
      <div className="toast-content">
        <div className="toast-title-row">
          <span className="toast-icon">
            {toast.type === "warning" ? "⚠️" : toast.type === "success" ? "✅" : "📢"}
          </span>
          <span className="toast-toast-title">{toast.title}</span>
        </div>
        <p className="toast-message">{toast.message}</p>
        <span className="toast-time">
          {toast.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>
      <button type="button" className="toast-close-btn" onClick={() => onRemove(toast.id)}>
        ✕
      </button>
    </div>
  );
};
