import type { ReactNode } from "react";

export function ModalOverlay({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  message: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ModalOverlay onClose={onClose}>
      <p className="modal-msg">{message}</p>
      <div className="modal-actions">
        <button className="ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-unify" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </ModalOverlay>
  );
}
