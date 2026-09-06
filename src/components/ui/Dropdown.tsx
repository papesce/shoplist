import { createPortal } from "react-dom";

export function DropdownMenu({
  pos,
  children,
}: {
  pos: { top: number; left: number };
  children: React.ReactNode;
}) {
  return createPortal(
    <div className="dropdown-menu" style={{ position: "fixed", top: pos.top, left: pos.left }}>
      {children}
    </div>,
    document.body,
  );
}
