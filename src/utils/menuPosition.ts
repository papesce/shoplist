export function computeMenuPosition(
  trigger: DOMRect,
  menuWidth = 200,
  menuHeight = 250,
): { top: number; left: number } {
  const gap = 4;
  let top = trigger.bottom + gap;
  let left = trigger.left;
  if (top + menuHeight > window.innerHeight) {
    top = trigger.top - menuHeight - gap;
  }
  if (left + menuWidth > window.innerWidth) {
    left = trigger.right - menuWidth;
  }
  left = Math.max(8, left);
  top = Math.max(8, top);
  return { top, left };
}
