"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { CheckCircle, AlertCircle, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

// Global toast context for the whole app
let toastListeners: Array<(message: ToastMessage) => void> = [];

export function showToast(message: string, type: ToastType = "success") {
  const id = Math.random().toString(36).substring(7);
  const toastMessage: ToastMessage = { id, message, type };
  toastListeners.forEach(listener => listener(toastMessage));
}

export default function Toast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const addToast = useCallback((message: ToastMessage) => {
    setToasts(prev => [...prev, message]);

    // Auto-remove after 4 seconds
    const timeout = setTimeout(() => {
      removeToast(message.id);
    }, 4000);

    timeoutRef.current.set(message.id, timeout);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timeout = timeoutRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRef.current.delete(id);
    }
  };

  useEffect(() => {
    toastListeners.push(addToast);
    return () => {
      toastListeners = toastListeners.filter(l => l !== addToast);
    };
  }, [addToast]);

  return (
    <div className="fixed bottom-20 left-4 right-4 md:bottom-4 md:left-auto md:right-4 md:max-w-sm z-50 space-y-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-[8px] shadow-subtle
            pointer-events-auto text-[14px]
            ${toast.type === "success" ? "bg-[#1C1C1C] text-[#F5F3EF]" : ""}
            ${toast.type === "error" ? "bg-[#1C1C1C] text-[#C86C6C]" : ""}
            ${toast.type === "info" ? "bg-[#1C1C1C] text-[#F5F3EF]" : ""}
          `}
        >
          {toast.type === "error" && <AlertCircle size={18} className="flex-shrink-0" />}
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="hover:opacity-80 transition-opacity duration-150 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
