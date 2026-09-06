import { createPortal } from "react-dom";
import { Plus, Repeat, Trash2, X } from "lucide-react";
import { CATEGORIES, getCategoryColors } from "../../constants/categories";
import { CategoryChips } from "./CategoryChips";
import { ProductRow } from "./ProductRow";
import type { Entry } from "../../types";

type Props = {
  search: string;
  setSearch: (v: string) => void;
  filtered: Entry[];
  activeCategories: string[];
  sortedCategories: string[];
  categoryFilter: string;
  setCategoryFilter: (v: string | ((p: string) => string)) => void;
  isDark: boolean;
  filteredSelectedCount: number;
  addToShoppingList: () => void;
  addMsg: string;
  editMode: boolean;
  canKeepSelected: boolean;
  keepSelected: () => void;
  deleteSelected: () => void;
  setSelected: React.Dispatch<React.SetStateAction<Set<number>>>;
  canonical: number | null;
  setCanonical: React.Dispatch<React.SetStateAction<number | null>>;
  setCanonicalInput: (v: string) => void;
  selectedCount: number;
  canUnify: boolean;
  unify: () => void;
  categoryMsg: string;
  assignCategory: (cat: string) => void;
  unifyCatOpen: boolean;
  setUnifyCatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  unifyCatRef: React.RefObject<HTMLButtonElement>;
  unifyCatPos: { top: number; left: number };
  setUnifyCatPos: (v: { top: number; left: number }) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  canonicalInput: string;
  dbListRef: React.RefObject<HTMLDivElement>;
  openAddModal: (prefill?: string) => void;
  filteredSelected: Set<number>;
  isEntryInList: (e: Entry) => boolean;
  editingEntry: number | null;
  editingValue: string;
  setEditingValue: (v: string) => void;
  saveEditing: () => void;
  cancelEditing: () => void;
  toggleSelected: (l: number) => void;
  setAsCanonical: (l: number) => void;
  startEditing: (e: Entry) => void;
  addSingle: (e: Entry) => void;
  removeSingle: (e: Entry) => void;
  openCatPopover: (id: string, btn: HTMLButtonElement) => void;
  leftPct?: never;
};

export function CatalogPanel({
  search,
  setSearch,
  filtered,
  activeCategories,
  sortedCategories,
  categoryFilter,
  setCategoryFilter,
  isDark,
  filteredSelectedCount,
  addToShoppingList,
  addMsg,
  editMode,
  canKeepSelected,
  keepSelected,
  deleteSelected,
  setSelected,
  canonical,
  setCanonical,
  setCanonicalInput,
  selectedCount,
  canUnify,
  unify,
  categoryMsg,
  assignCategory,
  unifyCatOpen,
  setUnifyCatOpen,
  unifyCatRef,
  unifyCatPos,
  setUnifyCatPos,
  inputRef,
  canonicalInput,
  dbListRef,
  openAddModal,
  filteredSelected,
  isEntryInList,
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
}: Props) {
  const ENABLE_UNIFY = false;
  return (
    <>
      <div className="search-bar">
        <input
          type="search"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <span className="result-count">{filtered.length}</span>
      </div>
      <CategoryChips
        activeCategories={activeCategories}
        sortedCategories={sortedCategories}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter as (v: string) => void}
        isDark={isDark}
      />
      <div className="action-bar">
        <div className="action-bar-main">
          <button
            className="btn-primary"
            disabled={filteredSelectedCount === 0}
            onClick={addToShoppingList}
          >
            <Plus size={16} /> Add {filteredSelectedCount > 0 ? `(${filteredSelectedCount})` : ""}{" "}
            to list
          </button>
          {addMsg && <span className="add-msg">{addMsg}</span>}
          {editMode && canKeepSelected && (
            <button className="btn-keep" onClick={keepSelected}>
              <Repeat size={16} /> Keep {filteredSelectedCount} (remove{" "}
              {filtered.length - filteredSelectedCount})
            </button>
          )}
          {editMode && filteredSelectedCount > 0 && (
            <button className="btn-danger" onClick={deleteSelected}>
              <Trash2 size={16} /> Delete ({filteredSelectedCount})
            </button>
          )}
          {filteredSelectedCount > 0 && (
            <button
              className="ghost"
              onClick={() => {
                setSelected(new Set());
                setCanonical(null);
                setCanonicalInput("");
              }}
            >
              <X size={14} /> Clear selection
            </button>
          )}
        </div>
        {ENABLE_UNIFY && editMode && selectedCount >= 2 && (
          <div className="action-bar-unify">
            <div className="canonical-field">
              <input
                ref={inputRef}
                type="text"
                placeholder="Canonical name…"
                value={canonicalInput}
                onChange={(e) => setCanonicalInput(e.target.value)}
              />
            </div>
            <div className="dropdown" style={{ position: "relative" }}>
              <button
                ref={unifyCatRef}
                className="cat-select"
                onClick={() => {
                  if (unifyCatRef.current) {
                    const r = unifyCatRef.current.getBoundingClientRect();
                    const gap = 4;
                    let top = r.bottom + gap;
                    let left = r.left;
                    if (top + 400 > window.innerHeight) top = r.top - 400 - gap;
                    if (left + 200 > window.innerWidth) left = r.right - 200;
                    setUnifyCatPos({ top: Math.max(8, top), left: Math.max(8, left) });
                  }
                  setUnifyCatOpen((p) => !p);
                }}
              >
                Category…
              </button>
              {unifyCatOpen &&
                createPortal(
                  <div
                    className="dropdown-menu"
                    style={{ position: "fixed", top: unifyCatPos.top, left: unifyCatPos.left }}
                  >
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        assignCategory("");
                        setUnifyCatOpen(false);
                      }}
                    >
                      No category
                    </button>
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        className="dropdown-item"
                        onClick={() => {
                          assignCategory(cat);
                          setUnifyCatOpen(false);
                        }}
                      >
                        <span
                          className="cat-pop-dot"
                          style={
                            getCategoryColors(isDark)[cat]
                              ? {
                                  background: getCategoryColors(isDark)[cat].bg,
                                  color: getCategoryColors(isDark)[cat].text,
                                }
                              : undefined
                          }
                        />
                        {cat}
                      </button>
                    ))}
                  </div>,
                  document.body,
                )}
            </div>
            {categoryMsg && <span className="cat-msg">{categoryMsg}</span>}
            <button className="btn-unify" disabled={!canUnify} onClick={unify}>
              <Trash2 size={16} /> Unify {canUnify ? `(${selectedCount})` : ""}
            </button>
          </div>
        )}
      </div>
      <div className="entry-list" ref={dbListRef}>
        {filtered.length === 0 ? (
          <div className="empty small">
            <p>
              No entries found for <strong>"{search}"</strong>
            </p>
            <button onClick={() => openAddModal(search)}>
              <Plus size={16} /> Add "{search}" as new product
            </button>
          </div>
        ) : (
          filtered.map((e) => (
            <ProductRow
              key={e.linea}
              entry={e}
              isSelected={filteredSelected.has(e.linea)}
              isCanonical={canonical === e.linea}
              inList={isEntryInList(e)}
              selectedCount={selectedCount}
              search={search}
              isDark={isDark}
              editMode={editMode}
              editingEntry={editingEntry}
              editingValue={editingValue}
              setEditingValue={setEditingValue}
              saveEditing={saveEditing}
              cancelEditing={cancelEditing}
              toggleSelected={toggleSelected}
              setAsCanonical={setAsCanonical}
              startEditing={startEditing}
              addSingle={addSingle}
              removeSingle={removeSingle}
              openCatPopover={openCatPopover}
              setCategoryFilter={setCategoryFilter}
              categoryFilter={categoryFilter}
            />
          ))
        )}
      </div>
    </>
  );
}
