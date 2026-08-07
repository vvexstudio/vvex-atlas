import React, { useEffect } from "react";
import { Icon } from "@/components/ui/icons";
import { CloseButton } from "@/components/ui/CloseButton";

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
    }, 8000); // Autoclose after 8s
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  return (
    <div className={`portal-toast toast-${toast.type}`}>
      <div className="toast-content">
        <div className="toast-title-row">
          <span className="toast-icon">
            {toast.type === "warning" ? <Icon name="warning" size={16} /> : toast.type === "success" ? <Icon name="checkCircle" size={16} /> : <Icon name="megaphone" size={16} />}
          </span>
          <span className="toast-toast-title">{toast.title}</span>
        </div>
        <p className="toast-message">{toast.message}</p>
        <span className="toast-time" suppressHydrationWarning>
          {toast.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>
      <CloseButton className="toast-close-btn" onClick={() => onRemove(toast.id)} />
    </div>
  );
};
