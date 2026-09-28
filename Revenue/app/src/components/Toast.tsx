import React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = "success",
  onClose,
}) => {
  if (!message) return null;

  return (
    <div className={`toast-notification toast-${type}`} role="alert">
      <div className="toast-icon">
        {type === "success" && <CheckCircle2 size={18} />}
        {type === "error" && <AlertCircle size={18} />}
        {type === "info" && <Info size={18} />}
      </div>
      <div className="toast-message">{message}</div>
      <button
        type="button"
        className="toast-close-btn"
        onClick={onClose}
        aria-label="Dismiss message"
      >
        <X size={14} />
      </button>
    </div>
  );
};
