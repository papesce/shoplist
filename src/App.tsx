import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  Plus,
  Repeat,
  Trash2,
  X,
  ClipboardCopy,
  Check,
  List,
  LayoutGrid,
  FolderOpen,
  Save,
} from "lucide-react";
import type { Entry } from "./types";
import { CATEGORIES, getCategoryColors } from "./constants/categories";
import { uid } from "./utils/id";
import { computeMenuPosition } from "./utils/menuPosition";
import { calcSummary } from "./utils/summary";
import { useTheme } from "./hooks/useTheme";
import { useEditMode } from "./hooks/useEditMode";
import { useToast } from "./hooks/useToast";
import { useCatPopover } from "./hooks/usePopover";
import { useResizer } from "./hooks/useResizer";
import { useEntries } from "./hooks/useEntries";
import { useShoppingList } from "./hooks/useShoppingList";
import { useHistory } from "./hooks/useHistory";
import { Topbar } from "./components/layout/Topbar";
import { Resizer } from "./components/layout/Resizer";
import { CategoryChips } from "./components/catalog/CategoryChips";
import { ProductRow } from "./components/catalog/ProductRow";
import { CategoryPopover } from "./components/catalog/CategoryPopover";
import { ShoppingList } from "./components/shopping/ShoppingList";
import { HistoryDrawer } from "./components/history/HistoryDrawer";
import { ToastStack } from "./components/ui/ToastStack";
import { ConfirmModal } from "./components/ui/Modal";

const STORAGE_KEY = "shopier-productos";
const ENABLE_UNIFY = false;

export default function App() {
  const { isDark, toggleTheme } = useTheme();
  const { editMode, toggleEditMode } = useEditMode();
  const { toasts, undoStack, pushToast, dismissToast, performUndo } = useToast();
  const { leftPct, panelsRef, onResizerMouseDown } = useResizer(50);
  const { catPopover, catPopoverPos, openCatPopover, setCatPopover } = useCatPopover();

  const {
    entries,
    setEntries,
    loading,
    downloadJSON,
    handleDbFileLoadFromInput,
    loadDbFromFile: loadDbFromFileHook,
  } = useEntries(pushToast);
  const entriesCategoriaMap = useMemo(
    () => new Map(entries.map((e) => [e.linea, e.categoria])),
    [entries],
  );
  const {
    shoppingList,
    setShoppingList,
    dragOverIndex,
    groupByCategory,
    setGroupByCategory,
    copied,
    pending,
    shoppingGrouped,
    toggleShoppingItem,
    removeShoppingItem,
    clearCheckedItems,
    confirmClearAll: confirmClearAllHook,
    copyShoppingList,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    handleFileLoad: handleShoppingFileLoad,
    downloadList,
  } = useShoppingList(pushToast, entriesCategoriaMap);
  const {
    history,
    historyOpen,
    setHistoryOpen,
    historyQuery,
    setHistoryQuery,
    historyNameDraft,
    setHistoryNameDraft,
    showSaveModal,
    setShowSaveModal,
    renamingId,
    setRenamingId,
    renamingValue,
    setRenamingValue,
    deleteHistoryConfirm,
    setDeleteHistoryConfirm,
    filteredHistory,
    openSaveModal,
    confirmSaveToHistory,
    loadFromHistory,
    renameHistoryEntry,
    deleteHistoryEntry,
    downloadHistoryEntry,
  } = useHistory(shoppingList, setShoppingList, pushToast);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [canonical, setCanonical] = useState<number | null>(null);
  const [canonicalInput, setCanonicalInput] = useState("");
  const [addMsg, setAddMsg] = useState("");
  const [unifyConfirm, setUnifyConfirm] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categoryMsg, setCategoryMsg] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("");
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [shoppingMenuOpen, setShoppingMenuOpen] = useState(false);
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const startEditing = useCallback((entry: Entry) => {
    setEditingEntry(entry.linea);
    setEditingValue(entry.original);
  }, []);
  const cancelEditing = useCallback(() => setEditingEntry(null), []);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dbFileInputRef = useRef<HTMLInputElement>(null);
  const shoppingMenuRef = useRef<HTMLButtonElement>(null);
  const topMenuRef = useRef<HTMLButtonElement>(null);
  const unifyCatRef = useRef<HTMLButtonElement>(null);
  const addModalCatRef = useRef<HTMLButtonElement>(null);
  const [shoppingMenuPos, setShoppingMenuPos] = useState({ top: 0, left: 0 });
  const [topMenuPos, setTopMenuPos] = useState({ top: 0, left: 0 });
  const [unifyCatPos, setUnifyCatPos] = useState({ top: 0, left: 0 });
  const [addModalCatPos, setAddModalCatPos] = useState({ top: 0, left: 0 });
  const dbListRef = useRef<HTMLDivElement>(null);

  const saveEditing = useCallback(() => {
    if (editingEntry === null) return;
    const trimmed = editingValue.trim();
    if (trimmed === "") {
      setEditingEntry(null);
      return;
    }
    const linea = editingEntry;
    const prevEntry = entries.find((e) => e.linea === linea);
    if (!prevEntry || prevEntry.original === trimmed) {
      setEditingEntry(null);
      return;
    }
    const oldName = prevEntry.original;
    setEntries((prev) => {
      const next = prev.map((e) => (e.linea === linea ? { ...e, original: trimmed } : e));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setShoppingList((prev) =>
      prev.map((item) => (item.linea === linea ? { ...item, original: trimmed } : item)),
    );
    pushToast(`Renamed "${oldName}" → "${trimmed}"`, () => {
      setEntries((prev) => {
        const next = prev.map((e) => (e.linea === linea ? { ...e, original: oldName } : e));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      setShoppingList((prev) =>
        prev.map((item) => (item.linea === linea ? { ...item, original: oldName } : item)),
      );
    });
    setEditingEntry(null);
  }, [editingEntry, editingValue, entries, pushToast, setEntries, setShoppingList]);

  useEffect(() => {
    dbListRef.current?.scrollTo({ top: 0 });
  }, [search, categoryFilter]);

  const filtered = useMemo(() => {
    let result = entries;
    const q = search.toLowerCase();
    if (q) result = result.filter((e) => e.original.toLowerCase().includes(q));
    if (categoryFilter) result = result.filter((e) => e.categoria === categoryFilter);
    return result;
  }, [search, categoryFilter, entries]);

  const summary = useMemo(() => calcSummary(entries), [entries]);
  const activeCategories = useMemo(
    () => CATEGORIES.filter((cat) => entries.some((e) => e.categoria === cat)),
    [entries],
  );
  const sortedCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries)
      if (e.categoria) counts.set(e.categoria, (counts.get(e.categoria) || 0) + 1);
    return [...activeCategories].sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));
  }, [activeCategories, entries]);

  const [unifyCatOpen, setUnifyCatOpen] = useState(false);
  const [addModalCatOpen, setAddModalCatOpen] = useState(false);
  useEffect(() => {
    if (!shoppingMenuOpen && !topMenuOpen && !unifyCatOpen && !addModalCatOpen) return;
    const close = (e: MouseEvent) => {
      if ((e.target as Element).closest(".dropdown, .dropdown-menu")) return;
      setShoppingMenuOpen(false);
      setTopMenuOpen(false);
      setUnifyCatOpen(false);
      setAddModalCatOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [shoppingMenuOpen, topMenuOpen, unifyCatOpen, addModalCatOpen]);

  const assignCategory = useCallback(
    (cat: string) => {
      if (selected.size === 0) return;
      setEntries((prev) => {
        const next = prev.map((e) => (selected.has(e.linea) ? { ...e, categoria: cat } : e));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      setShoppingList((prev) =>
        prev.map((item) => (selected.has(item.linea) ? { ...item, categoria: cat } : item)),
      );
      setCategoryMsg(
        `Category "${cat}" assigned to ${selected.size} entr${selected.size !== 1 ? "ies" : "y"}`,
      );
      setTimeout(() => setCategoryMsg(""), 2000);
    },
    [selected, setEntries, setShoppingList],
  );
  const setCategoryItem = useCallback(
    (linea: number, cat: string) => {
      setEntries((prev) => {
        const next = prev.map((e) => (e.linea === linea ? { ...e, categoria: cat } : e));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      setShoppingList((prev) =>
        prev.map((item) => (item.linea === linea ? { ...item, categoria: cat } : item)),
      );
    },
    [setEntries, setShoppingList],
  );
  const openAddModal = useCallback((prefillName?: string) => {
    setNewProductName(prefillName ?? "");
    setNewProductCategory("");
    setShowAddModal(true);
  }, []);
  const addNewProduct = useCallback(() => {
    const name = newProductName.trim();
    if (!name) return;
    const maxLinea = entries.reduce((max, e) => Math.max(max, e.linea), 0);
    const newEntry: Entry = {
      original: name,
      linea: maxLinea + 1,
      ...(newProductCategory ? { categoria: newProductCategory } : {}),
    };
    setEntries((prev) => {
      const next = [...prev, newEntry];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setShowAddModal(false);
    setNewProductName("");
    setNewProductCategory("");
    pushToast(`"${name}" added to database`, () => {
      setEntries((prev) => {
        const next = prev.filter((e) => e.linea !== newEntry.linea);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    });
  }, [newProductName, newProductCategory, entries, pushToast, setEntries]);

  const shoppingLineas = useMemo(() => new Set(shoppingList.map((i) => i.linea)), [shoppingList]);
  const shoppingNames = useMemo(
    () => new Set(shoppingList.map((i) => i.original.trim().toLowerCase())),
    [shoppingList],
  );
  const isEntryInList = useCallback(
    (e: Entry) => shoppingLineas.has(e.linea) || shoppingNames.has(e.original.trim().toLowerCase()),
    [shoppingLineas, shoppingNames],
  );
  const filteredSelected = useMemo(
    () => new Set([...selected].filter((l) => filtered.some((e) => e.linea === l))),
    [selected, filtered],
  );
  const selectedCount = selected.size;
  const filteredSelectedCount = filteredSelected.size;
  const hasCanonical = canonical !== null;
  const canUnify = selectedCount >= 2 && hasCanonical && canonicalInput.trim().length > 0;
  const canKeepSelected =
    search !== "" && filteredSelectedCount > 0 && filteredSelectedCount < filtered.length;
  const toggleSelected = useCallback((linea: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(linea)) next.delete(linea);
      else next.add(linea);
      return next;
    });
  }, []);
  const setAsCanonical = useCallback(
    (linea: number) => {
      const entry = entries.find((e) => e.linea === linea);
      if (!entry) return;
      setCanonical(linea);
      setCanonicalInput(entry.original);
      setSelected((prev) => (prev.has(linea) ? prev : new Set(prev).add(linea)));
    },
    [entries],
  );
  const addToShoppingList = useCallback(() => {
    const items = entries.filter((e) => filteredSelected.has(e.linea));
    if (!items.length) return;
    setShoppingList((prev) => [
      ...items.map((e) => ({
        id: uid(),
        original: e.original,
        linea: e.linea,
        checked: false,
        categoria: e.categoria,
      })),
      ...prev,
    ]);
    setSelected(new Set());
    setAddMsg(`Added ${items.length} item${items.length > 1 ? "s" : ""}`);
    setTimeout(() => setAddMsg(""), 2000);
  }, [entries, filteredSelected, setShoppingList]);
  const addSingleToShoppingList = useCallback(
    (entry: Entry) => {
      if (isEntryInList(entry)) return;
      const item = {
        id: uid(),
        original: entry.original,
        linea: entry.linea,
        checked: false,
        categoria: entry.categoria,
      };
      setShoppingList((prev) => [item, ...prev]);
      pushToast(`"${entry.original}" added to list`, () =>
        setShoppingList((prev) => prev.filter((i) => i.id !== item.id)),
      );
    },
    [isEntryInList, pushToast, setShoppingList],
  );
  const removeSingleFromShoppingList = useCallback(
    (entry: Entry) => {
      const key = entry.original.trim().toLowerCase();
      const removed = shoppingList.filter(
        (i) => i.linea === entry.linea || i.original.trim().toLowerCase() === key,
      );
      if (!removed.length) return;
      const removedIds = new Set(removed.map((i) => i.id));
      setShoppingList((prev) => prev.filter((i) => !removedIds.has(i.id)));
      pushToast(`"${entry.original}" removed from list`, () =>
        setShoppingList((prev) => [...removed, ...prev]),
      );
    },
    [shoppingList, pushToast, setShoppingList],
  );

  // shopping list helpers proxied from hook
  const handleFileLoad = useCallback(
    () => handleShoppingFileLoad(fileInputRef.current),
    [handleShoppingFileLoad],
  );
  const loadListFromFile = useCallback(() => {
    const input = fileInputRef.current;
    if (!input) return;
    input.value = "";
    input.click();
  }, []);
  const clearAllItems = useCallback(() => setClearAllConfirm(true), []);
  const confirmClearAll = useCallback(() => {
    confirmClearAllHook(() => setClearAllConfirm(false));
  }, [confirmClearAllHook]);

  // db import helpers proxied
  const loadDbFromFile = useCallback(
    () => loadDbFromFileHook(dbFileInputRef),
    [loadDbFromFileHook],
  );
  const handleDbFileLoad = useCallback(
    () => handleDbFileLoadFromInput(dbFileInputRef.current),
    [handleDbFileLoadFromInput],
  );

  const unify = useCallback(() => {
    if (canonical === null || selected.size < 2) return;
    const name = canonicalInput.trim();
    if (!name) return;
    setUnifyConfirm(true);
  }, [canonical, selected, canonicalInput]);
  const confirmUnify = useCallback(() => {
    if (canonical === null || selected.size < 2) return;
    const name = canonicalInput.trim();
    if (!name) return;
    setUnifyConfirm(false);
    setEntries((prev) => {
      const keepLinea = selected.has(canonical) ? canonical : [...selected][0];
      const next = prev
        .map((e) => (e.linea === keepLinea ? { ...e, original: name } : e))
        .filter((e) => !selected.has(e.linea) || e.linea === keepLinea);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setShoppingList((prev) =>
      prev.map((item) =>
        item.linea === (selected.has(canonical) ? canonical : [...selected][0])
          ? { ...item, original: name }
          : item,
      ),
    );
    setSelected(new Set());
    setCanonical(null);
    setCanonicalInput("");
  }, [canonical, selected, canonicalInput, setEntries, setShoppingList]);
  const keepSelected = useCallback(() => {
    const selectedInFilter = new Set(
      [...selected].filter((l) => filtered.some((e) => e.linea === l)),
    );
    if (!search || selectedInFilter.size === 0) return;
    const toRemove = new Set(
      filtered.filter((e) => !selectedInFilter.has(e.linea)).map((e) => e.linea),
    );
    if (toRemove.size === 0) return;
    const removedEntries = entries.filter((e) => toRemove.has(e.linea));
    const removedShop = shoppingList.filter((i) => toRemove.has(i.linea));
    setEntries((prev) => {
      const next = prev.filter((e) => !toRemove.has(e.linea));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setShoppingList((prev) => prev.filter((item) => !toRemove.has(item.linea)));
    setSelected(new Set());
    setCanonical(null);
    setCanonicalInput("");
    const n = toRemove.size;
    pushToast(`Removed ${n} entr${n !== 1 ? "ies" : "y"} outside selection`, () => {
      setEntries((prev) => {
        const next = [...prev, ...removedEntries];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      setShoppingList((prev) => [...prev, ...removedShop]);
    });
  }, [search, filtered, selected, entries, shoppingList, pushToast, setEntries, setShoppingList]);
  const deleteSelected = useCallback(() => {
    if (selected.size === 0) return;
    const n = selected.size;
    const removedEntries = entries.filter((e) => selected.has(e.linea));
    const removedShop = shoppingList.filter((i) => selected.has(i.linea));
    setEntries((prev) => {
      const next = prev.filter((e) => !selected.has(e.linea));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setShoppingList((prev) => prev.filter((item) => !selected.has(item.linea)));
    setSelected(new Set());
    pushToast(`${n} entr${n > 1 ? "ies" : "y"} deleted`, () => {
      setEntries((prev) => {
        const next = [...prev, ...removedEntries];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      setShoppingList((prev) => [...prev, ...removedShop]);
    });
  }, [selected, entries, shoppingList, pushToast, setEntries, setShoppingList]);

  if (loading) {
    return (
      <div className="app-full-center">
        <h1>Shoplist</h1>
        <p>Loading database…</p>
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="app">
        <Topbar
          summary={summary}
          shoppingCount={shoppingList.length}
          undoStack={undoStack}
          performUndo={performUndo}
          editMode={editMode}
          toggleEditMode={toggleEditMode}
          isDark={isDark}
          toggleTheme={toggleTheme}
          downloadJSON={downloadJSON}
          loadDbFromFile={loadDbFromFile}
          topMenuOpen={topMenuOpen}
          topMenuPos={topMenuPos}
          setTopMenuPos={setTopMenuPos}
          setTopMenuOpen={setTopMenuOpen}
          topMenuRef={topMenuRef as React.RefObject<HTMLButtonElement>}
        />
        <input
          ref={dbFileInputRef}
          type="file"
          accept=".json"
          style={{ display: "none" }}
          onChange={handleDbFileLoad}
        />
        <div className="panels" ref={panelsRef}>
          <div className="panel panel-db" style={{ flex: `0 0 ${leftPct}%` }}>
            <div className="search-bar">
              <input
                type="search"
                placeholder="Search products…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              <span className="result-count">0</span>
            </div>
            <div className="empty">
              <p>No products yet.</p>
              <p className="muted">Start by adding your first product.</p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                <button className="btn-primary" onClick={() => openAddModal(search)}>
                  <Plus size={16} /> Add product
                </button>
                <button className="ghost" onClick={loadDbFromFile}>
                  <FolderOpen size={16} /> Import from JSON
                </button>
              </div>
            </div>
          </div>
          <Resizer onMouseDown={onResizerMouseDown} />
          <div className="panel panel-list" style={{ flex: "1 1 0", minWidth: 0 }}>
            <div className="panel-header">
              <div>
                <p className="eyebrow">Shopping list</p>
                <h2>{pending} pending items</h2>
              </div>
            </div>
            <div className="entry-list">
              <div className="empty small">
                <p>Your shopping list will appear here.</p>
              </div>
            </div>
          </div>
        </div>
        {showAddModal && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2 className="modal-title">Add new product</h2>
              <input
                type="text"
                className="modal-input"
                placeholder="Product name…"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") addNewProduct();
                }}
              />
              <div className="dropdown" style={{ position: "relative" }}>
                <button
                  ref={addModalCatRef}
                  className="modal-select"
                  onClick={() => {
                    if (addModalCatRef.current) {
                      const r = addModalCatRef.current.getBoundingClientRect();
                      setAddModalCatPos(computeMenuPosition(r, 200, 400));
                    }
                    setAddModalCatOpen((p) => !p);
                  }}
                >
                  {newProductCategory || "No category"}
                </button>
                {addModalCatOpen && (
                  <div
                    className="dropdown-menu"
                    style={{
                      position: "fixed",
                      top: addModalCatPos.top,
                      left: addModalCatPos.left,
                      zIndex: 301,
                    }}
                  >
                    <button
                      className={
                        "dropdown-item" + (!newProductCategory ? " dropdown-item-active" : "")
                      }
                      onClick={() => {
                        setNewProductCategory("");
                        setAddModalCatOpen(false);
                      }}
                    >
                      No category
                    </button>
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        className={
                          "dropdown-item" +
                          (newProductCategory === cat ? " dropdown-item-active" : "")
                        }
                        onClick={() => {
                          setNewProductCategory(cat);
                          setAddModalCatOpen(false);
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="modal-actions">
                <button className="ghost" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button disabled={!newProductName.trim()} onClick={addNewProduct}>
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
        <ToastStack toasts={toasts} dismissToast={dismissToast} />
      </div>
    );
  }

  return (
    <div className="app">
      <Topbar
        summary={summary}
        shoppingCount={shoppingList.length}
        undoStack={undoStack}
        performUndo={performUndo}
        editMode={editMode}
        toggleEditMode={toggleEditMode}
        isDark={isDark}
        toggleTheme={toggleTheme}
        downloadJSON={downloadJSON}
        loadDbFromFile={loadDbFromFile}
        topMenuOpen={topMenuOpen}
        topMenuPos={topMenuPos}
        setTopMenuPos={setTopMenuPos}
        setTopMenuOpen={setTopMenuOpen}
        topMenuRef={topMenuRef as React.RefObject<HTMLButtonElement>}
      />
      <input
        ref={dbFileInputRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={handleDbFileLoad}
      />
      <div className="panels" ref={panelsRef}>
        <div className="panel panel-db" style={{ flex: `0 0 ${leftPct}%` }}>
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
            setCategoryFilter={setCategoryFilter}
            isDark={isDark}
          />
          <div className="action-bar">
            <div className="action-bar-main">
              <button
                className="btn-primary"
                disabled={filteredSelectedCount === 0}
                onClick={addToShoppingList}
              >
                <Plus size={16} /> Add{" "}
                {filteredSelectedCount > 0 ? `(${filteredSelectedCount})` : ""} to list
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
                        setUnifyCatPos(computeMenuPosition(r, 200, 400));
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
                  addSingle={addSingleToShoppingList}
                  removeSingle={removeSingleFromShoppingList}
                  openCatPopover={openCatPopover}
                  setCategoryFilter={setCategoryFilter}
                  categoryFilter={categoryFilter}
                />
              ))
            )}
          </div>
        </div>
        <Resizer onMouseDown={onResizerMouseDown} />
        <div className="panel panel-list" style={{ flex: "1 1 0", minWidth: 0 }}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Shopping list</p>
              <h2>{pending} pending items</h2>
            </div>
            <div className="panel-header-actions">
              <button
                className="ghost"
                onClick={openSaveModal}
                disabled={shoppingList.length === 0}
                title="Save to history"
              >
                <Save size={16} /> Save
              </button>
              <button
                className="ghost"
                onClick={() => setHistoryOpen(true)}
                title={`History (${history.length})`}
              >
                History{" "}
                {history.length > 0 && <span className="history-badge">{history.length}</span>}
              </button>
              <button className="btn-primary" onClick={copyShoppingList} disabled={pending === 0}>
                {copied ? (
                  <>
                    <Check size={16} /> Copied
                  </>
                ) : (
                  <>
                    <ClipboardCopy size={16} /> Copy list
                  </>
                )}
              </button>
              <div className="dropdown">
                <button
                  ref={shoppingMenuRef}
                  className={"dropdown-btn" + (shoppingMenuOpen ? " active" : "")}
                  onClick={() => {
                    if (shoppingMenuRef.current) {
                      const r = shoppingMenuRef.current.getBoundingClientRect();
                      setShoppingMenuPos(computeMenuPosition(r, 220, 260));
                    }
                    setShoppingMenuOpen((p) => !p);
                  }}
                  disabled={shoppingList.length === 0}
                >
                  ⋯
                </button>
                {shoppingMenuOpen &&
                  createPortal(
                    <div
                      className="dropdown-menu"
                      style={{
                        position: "fixed",
                        top: shoppingMenuPos.top,
                        left: shoppingMenuPos.left,
                      }}
                    >
                      <button
                        className="dropdown-item"
                        onClick={() => {
                          setGroupByCategory(!groupByCategory);
                          setShoppingMenuOpen(false);
                        }}
                      >
                        {groupByCategory ? (
                          <>
                            <List size={16} /> Free list
                          </>
                        ) : (
                          <>
                            <LayoutGrid size={16} /> Group by category
                          </>
                        )}
                      </button>
                      <div className="dropdown-sep" />
                      <button
                        className="dropdown-item"
                        onClick={() => {
                          clearCheckedItems();
                          setShoppingMenuOpen(false);
                        }}
                        disabled={shoppingList.filter((i) => i.checked).length === 0}
                      >
                        <Trash2 size={16} /> Remove checked
                      </button>
                      <button
                        className="dropdown-item dropdown-item-danger"
                        onClick={() => {
                          clearAllItems();
                          setShoppingMenuOpen(false);
                        }}
                        disabled={shoppingList.length === 0}
                      >
                        <Trash2 size={16} /> Clear all
                      </button>
                      <div className="dropdown-sep" />
                      <button
                        className="dropdown-item"
                        onClick={() => {
                          downloadList();
                          setShoppingMenuOpen(false);
                        }}
                        disabled={shoppingList.length === 0}
                      >
                        <Download size={16} /> Download list
                      </button>
                      <button
                        className="dropdown-item"
                        onClick={() => {
                          loadListFromFile();
                          setShoppingMenuOpen(false);
                        }}
                      >
                        <FolderOpen size={16} /> Load list
                      </button>
                    </div>,
                    document.body,
                  )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: "none" }}
                onChange={handleFileLoad}
              />
            </div>
          </div>
          <div className="entry-list">
            <ShoppingList
              shoppingList={shoppingList}
              shoppingGrouped={shoppingGrouped}
              dragOverIndex={dragOverIndex}
              isDark={isDark}
              toggleShoppingItem={toggleShoppingItem}
              removeShoppingItem={removeShoppingItem}
              handleDragStart={handleDragStart}
              handleDragOver={handleDragOver}
              handleDragLeave={handleDragLeave}
              handleDrop={handleDrop}
              handleDragEnd={handleDragEnd}
            />
          </div>
        </div>
      </div>
      {ENABLE_UNIFY && unifyConfirm && (
        <ConfirmModal
          message={
            <>
              Unify <strong>{selected.size}</strong> entries as{" "}
              <strong>"{canonicalInput.trim()}"</strong>? The others will be deleted.
            </>
          }
          confirmLabel="Unify"
          onConfirm={confirmUnify}
          onClose={() => setUnifyConfirm(false)}
        />
      )}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Add new product</h2>
            <input
              type="text"
              className="modal-input"
              placeholder="Product name…"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") addNewProduct();
              }}
            />
            <div className="dropdown" style={{ position: "relative" }}>
              <button
                ref={addModalCatRef}
                className="modal-select"
                onClick={() => {
                  if (addModalCatRef.current) {
                    const r = addModalCatRef.current.getBoundingClientRect();
                    setAddModalCatPos(computeMenuPosition(r, 200, 400));
                  }
                  setAddModalCatOpen((p) => !p);
                }}
              >
                {newProductCategory || "No category"}
              </button>
              {addModalCatOpen && (
                <div
                  className="dropdown-menu"
                  style={{
                    position: "fixed",
                    top: addModalCatPos.top,
                    left: addModalCatPos.left,
                    zIndex: 301,
                  }}
                >
                  <button
                    className={
                      "dropdown-item" + (!newProductCategory ? " dropdown-item-active" : "")
                    }
                    onClick={() => {
                      setNewProductCategory("");
                      setAddModalCatOpen(false);
                    }}
                  >
                    No category
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      className={
                        "dropdown-item" +
                        (newProductCategory === cat ? " dropdown-item-active" : "")
                      }
                      onClick={() => {
                        setNewProductCategory(cat);
                        setAddModalCatOpen(false);
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button disabled={!newProductName.trim()} onClick={addNewProduct}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}
      {clearAllConfirm && (
        <ConfirmModal
          message={
            <>
              Clear all <strong>{shoppingList.length}</strong> items from the list?
            </>
          }
          confirmLabel="Clear all"
          onConfirm={confirmClearAll}
          onClose={() => setClearAllConfirm(false)}
        />
      )}
      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Save to history</h2>
            <p className="modal-msg" style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
              {shoppingList.length} items will be saved. Checked state is preserved.
            </p>
            <input
              type="text"
              className="modal-input"
              value={historyNameDraft}
              onChange={(e) => setHistoryNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmSaveToHistory();
                if (e.key === "Escape") setShowSaveModal(false);
              }}
              autoFocus
            />
            <div className="modal-actions">
              <button className="ghost" onClick={() => setShowSaveModal(false)}>
                Cancel
              </button>
              <button disabled={!historyNameDraft.trim()} onClick={confirmSaveToHistory}>
                <Save size={16} /> Save
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteHistoryConfirm && (
        <ConfirmModal
          message={
            <>
              Delete <strong>{history.find((h) => h.id === deleteHistoryConfirm)?.name}</strong>{" "}
              from history?
            </>
          }
          confirmLabel="Delete"
          onConfirm={() => deleteHistoryEntry(deleteHistoryConfirm)}
          onClose={() => setDeleteHistoryConfirm(null)}
        />
      )}
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={history}
        filteredHistory={filteredHistory}
        historyQuery={historyQuery}
        setHistoryQuery={setHistoryQuery}
        renamingId={renamingId}
        renamingValue={renamingValue}
        setRenamingId={setRenamingId}
        setRenamingValue={setRenamingValue}
        renameHistoryEntry={renameHistoryEntry}
        deleteHistoryConfirm={deleteHistoryConfirm}
        setDeleteHistoryConfirm={setDeleteHistoryConfirm}
        loadFromHistory={loadFromHistory}
        downloadHistoryEntry={downloadHistoryEntry}
        deleteHistoryEntry={deleteHistoryEntry}
      />
      <CategoryPopover
        catPopover={catPopover}
        catPopoverPos={catPopoverPos}
        entries={entries}
        isDark={isDark}
        setCategoryItem={setCategoryItem}
        setCatPopover={setCatPopover}
      />
      <ToastStack toasts={toasts} dismissToast={dismissToast} />
    </div>
  );
}
