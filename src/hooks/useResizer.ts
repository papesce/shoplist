import { useState, useRef, useCallback } from "react";

export function useResizer(defaultPct = 50) {
  const [leftPct, setLeftPct] = useState(defaultPct);
  const panelsRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onResizerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !panelsRef.current) return;
      const { left, width } = panelsRef.current.getBoundingClientRect();
      const pct = Math.min(75, Math.max(25, ((ev.clientX - left) / width) * 100));
      setLeftPct(pct);
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  return { leftPct, panelsRef, onResizerMouseDown };
}
