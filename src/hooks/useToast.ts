import { useState, useCallback, useEffect } from "react";
import { uid } from "../utils/id";

type ToastAction = {
  id: string;
  message: string;
  undo: () => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

export function useToast() {
  const [toasts, setToasts] = useState<ToastAction[]>([]);
  const [undoStack, setUndoStack] = useState<Array<{ description: string; undo: () => void }>>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => {
      const toast = prev.find((t) => t.id === id);
      if (toast) clearTimeout(toast.timeoutId);
      return prev.filter((t) => t.id !== id);
    });
  }, []);

  const pushToast = useCallback((message: string, undo: () => void, duration = 5500) => {
    const id = uid();
    const timeoutId = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
    setToasts((prev) => [...prev, { id, message, undo, timeoutId }]);
    setUndoStack((prev) => [...prev.slice(-19), { description: message, undo }]);
  }, []);

  const performUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const action = next.pop()!;
      action.undo();
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        performUndo();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [performUndo]);

  return { toasts, undoStack, pushToast, dismissToast, performUndo };
}
