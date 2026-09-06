import { useState, useCallback, useEffect } from "react";
import { computeMenuPosition } from "../utils/menuPosition";

export function usePopover(menuWidth = 200, menuHeight = 250) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const toggle = useCallback(
    (anchor: HTMLElement | null) => {
      if (anchor) {
        setPos(computeMenuPosition(anchor.getBoundingClientRect(), menuWidth, menuHeight));
      }
      setOpen((p) => !p);
    },
    [menuWidth, menuHeight],
  );

  const close = useCallback(() => setOpen(false), []);
  const openAt = useCallback(
    (anchor: HTMLElement) => {
      setPos(computeMenuPosition(anchor.getBoundingClientRect(), menuWidth, menuHeight));
      setOpen(true);
    },
    [menuWidth, menuHeight],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if ((e.target as Element).closest(".dropdown, .dropdown-menu")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return { open, pos, toggle, close, openAt, setOpen };
}

export function useCatPopover() {
  const [catPopover, setCatPopover] = useState<string | null>(null);
  const [catPopoverPos, setCatPopoverPos] = useState({ top: 0, left: 0 });

  const openCatPopover = useCallback((id: string, btn: HTMLButtonElement) => {
    const r = btn.getBoundingClientRect();
    const pos = computeMenuPosition(r, 200, 420);
    setCatPopoverPos({ top: pos.top, left: pos.left });
    setCatPopover((prev) => (prev === id ? null : id));
  }, []);

  useEffect(() => {
    if (!catPopover) return;
    const close = (e: MouseEvent) => {
      if ((e.target as Element).closest(".cat-popover, .cat-badge")) return;
      setCatPopover(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [catPopover]);

  return { catPopover, catPopoverPos, openCatPopover, setCatPopover };
}
