import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { CATEGORIES, getCategoryColors } from "../../constants/categories";
import type { Entry } from "../../types";

export function CategoryPopover({
  catPopover,
  catPopoverPos,
  entries,
  isDark,
  setCategoryItem,
  setCatPopover,
}: {
  catPopover: string | null;
  catPopoverPos: { top: number; left: number };
  entries: Entry[];
  isDark: boolean;
  setCategoryItem: (linea: number, cat: string) => void;
  setCatPopover: (v: string | null) => void;
}) {
  if (!catPopover) return null;
  const linea = parseInt(catPopover.replace(/^(db|sl)-/, ""));
  const currentEntry = entries.find((e) => e.linea === linea);
  const currentCat = currentEntry?.categoria ?? "";
  return createPortal(
    <div
      className="cat-popover"
      style={{ position: "fixed", top: catPopoverPos.top, left: catPopoverPos.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className={"cat-pop-item cat-pop-clear" + (!currentCat ? " cat-pop-active" : "")}
        onClick={() => {
          setCategoryItem(linea, "");
          setCatPopover(null);
        }}
      >
        {!currentCat && (
          <span className="cat-pop-check">
            <Check size={14} />
          </span>
        )}
        No category
      </button>
      {CATEGORIES.map((c) => (
        <button
          key={c}
          className={"cat-pop-item" + (currentCat === c ? " cat-pop-active" : "")}
          onClick={() => {
            setCategoryItem(linea, c);
            setCatPopover(null);
          }}
        >
          {currentCat === c && (
            <span className="cat-pop-check">
              <Check size={14} />
            </span>
          )}
          <span
            className="cat-pop-dot"
            style={
              getCategoryColors(isDark)[c]
                ? {
                    background: getCategoryColors(isDark)[c].bg,
                    color: getCategoryColors(isDark)[c].text,
                  }
                : undefined
            }
          />
          {c}
        </button>
      ))}
    </div>,
    document.body,
  );
}
