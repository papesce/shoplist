import { memo } from "react";
import { Star, Check, ChevronRight, ChevronLeft, Pencil, X } from "lucide-react";
import { getCategoryColors } from "../../constants/categories";
import { highlight } from "../../utils/highlight";
import type { Entry } from "../../types";

type Props = {
  entry: Entry;
  isSelected: boolean;
  isCanonical: boolean;
  inList: boolean;
  selectedCount: number;
  search: string;
  isDark: boolean;
  editMode: boolean;
  editingEntry: number | null;
  editingValue: string;
  setEditingValue: (v: string) => void;
  saveEditing: () => void;
  cancelEditing: () => void;
  toggleSelected: (linea: number) => void;
  setAsCanonical: (linea: number) => void;
  startEditing: (e: Entry) => void;
  addSingle: (e: Entry) => void;
  removeSingle: (e: Entry) => void;
  openCatPopover: (id: string, btn: HTMLButtonElement) => void;
  setCategoryFilter: (v: string | ((p: string) => string)) => void;
  categoryFilter: string;
};

function ProductRowComp({
  entry,
  isSelected,
  isCanonical,
  inList,
  selectedCount,
  search,
  isDark,
  editMode,
  editingEntry,
  editingValue,
  setEditingValue,
  saveEditing,
  cancelEditing,
  toggleSelected,
  setAsCanonical,
  startEditing,
  addSingle,
  removeSingle,
  openCatPopover,
  setCategoryFilter,
}: Props) {
  const cls =
    "entry" +
    (isSelected ? " entry-selected" : "") +
    (isCanonical ? " entry-canonical" : "") +
    (inList ? " entry-in-list-row" : "");

  return (
    <article className={cls}>
      <input
        type="checkbox"
        className="entry-check"
        checked={isSelected}
        onChange={() => toggleSelected(entry.linea)}
      />
      {selectedCount >= 2 && isSelected && (
        <button
          className="entry-radio"
          onClick={() => setAsCanonical(entry.linea)}
          title="Set as canonical"
        >
          <Star size={16} fill={isCanonical ? "currentColor" : "none"} />
        </button>
      )}
      <span className="entry-line">{entry.linea}</span>
      {editingEntry === entry.linea ? (
        <>
          <input
            className="entry-text entry-edit-input"
            value={editingValue}
            onChange={(ev) => setEditingValue(ev.target.value)}
            onBlur={saveEditing}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") saveEditing();
              if (ev.key === "Escape") cancelEditing();
            }}
            autoFocus
            onClick={(ev) => ev.stopPropagation()}
          />
          <button
            className="entry-edit-action entry-edit-save"
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={saveEditing}
            title="Save (Enter)"
            aria-label="Save"
          >
            <Check size={14} />
          </button>
          <button
            className="entry-edit-action entry-edit-cancel"
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={cancelEditing}
            title="Cancel (Escape)"
            aria-label="Cancel"
          >
            <X size={14} />
          </button>
        </>
      ) : (
        <>
          <span
            className="entry-text"
            onDoubleClick={() => editMode && startEditing(entry)}
            onClick={() => toggleSelected(entry.linea)}
            title={editMode ? "Double-click to edit" : undefined}
          >
            {highlight(entry.original, search)}
          </span>
          {!inList ? (
            <button
              className="entry-add-btn"
              onClick={(ev) => {
                ev.stopPropagation();
                addSingle(entry);
              }}
              title="Add to list"
              aria-label={`Add ${entry.original} to list`}
            >
              <ChevronRight size={14} />
            </button>
          ) : (
            <span className="entry-status">
              <span className="entry-in-mark" title="Already in list">
                <Check size={14} />
              </span>
              <button
                className="entry-remove-btn"
                onClick={(ev) => {
                  ev.stopPropagation();
                  removeSingle(entry);
                }}
                title="Remove from list"
                aria-label={`Remove ${entry.original} from list`}
              >
                <ChevronLeft size={14} />
              </button>
            </span>
          )}
          {editMode && (
            <button
              className="entry-edit-btn"
              onClick={(ev) => {
                ev.stopPropagation();
                startEditing(entry);
              }}
              title="Edit name"
              aria-label={`Edit ${entry.original}`}
            >
              <Pencil size={14} />
            </button>
          )}
        </>
      )}
      <button
        className={"cat-badge" + (entry.categoria ? "" : " cat-badge-empty")}
        style={
          entry.categoria && getCategoryColors(isDark)[entry.categoria]
            ? {
                background: getCategoryColors(isDark)[entry.categoria].bg,
                color: getCategoryColors(isDark)[entry.categoria].text,
              }
            : undefined
        }
        onClick={(ev) => {
          ev.stopPropagation();
          if (editMode) {
            openCatPopover(`db-${entry.linea}`, ev.currentTarget);
          } else if (entry.categoria) {
            setCategoryFilter((prev) => (prev === entry.categoria ? "" : entry.categoria!));
          }
        }}
        title={editMode ? "Change category" : "Filter by category"}
      >
        {entry.categoria || "None"}
      </button>
      {isCanonical && <span className="tag">canonical</span>}
    </article>
  );
}

export const ProductRow = memo(ProductRowComp);
