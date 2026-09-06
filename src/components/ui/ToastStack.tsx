import { X } from "lucide-react";

type Toast = {
  id: string;
  message: string;
  undo: () => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

export function ToastStack({
  toasts,
  dismissToast,
}: {
  toasts: Toast[];
  dismissToast: (id: string) => void;
}) {
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span>{t.message}</span>
          <button
            className="toast-undo"
            onClick={() => {
              t.undo();
              dismissToast(t.id);
            }}
          >
            Undo
          </button>
          <button className="toast-close" onClick={() => dismissToast(t.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
