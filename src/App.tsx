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
import type { Entry, ShoppingItem, SavedList } from "./types";
import { api } from "./api";
import { CATEGORIES, getCategoryColors } from "./constants/categories";
import { loadJSON } from "./utils/storage";
import { uid } from "./utils/id";
import { computeMenuPosition } from "./utils/menuPosition";
import { calcSummary } from "./utils/summary";
import { parseEntriesJson, mergeEntries, parseShoppingListJson } from "./utils/dbImport";
import { useTheme } from "./hooks/useTheme";
import { useEditMode } from "./hooks/useEditMode";
import { useToast } from "./hooks/useToast";
import { useCatPopover } from "./hooks/usePopover";
import { useResizer } from "./hooks/useResizer";
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
const SHOPPING_KEY = "shopier-lista";
const HISTORY_KEY = "shopier-historial";
const ENABLE_UNIFY = false;

export default function App() {
  const { isDark, toggleTheme } = useTheme();
  const { editMode, toggleEditMode } = useEditMode();
  const { toasts, undoStack, pushToast, dismissToast, performUndo } = useToast();
  const { leftPct, panelsRef, onResizerMouseDown } = useResizer(50);
  const { catPopover, catPopoverPos, openCatPopover, setCatPopover } = useCatPopover();

  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<Entry[]>(() => loadJSON<Entry[]>(STORAGE_KEY, []));
  const [loading, setLoading] = useState(entries.length === 0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [canonical, setCanonical] = useState<number | null>(null);
  const [canonicalInput, setCanonicalInput] = useState("");
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(() =>
    loadJSON<ShoppingItem[]>(SHOPPING_KEY, []),
  );
  const [addMsg, setAddMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [unifyConfirm, setUnifyConfirm] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [groupByCategory, setGroupByCategory] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categoryMsg, setCategoryMsg] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("");
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [shoppingMenuOpen, setShoppingMenuOpen] = useState(false);
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const [history, setHistory] = useState<SavedList[]>(() => loadJSON<SavedList[]>(HISTORY_KEY, []));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyNameDraft, setHistoryNameDraft] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  const [deleteHistoryConfirm, setDeleteHistoryConfirm] = useState<string | null>(null);
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
  }, [editingEntry, editingValue, entries, pushToast]);

  const apiReady = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [apiEntries, apiList, apiHist] = await Promise.all([
        api.getEntries(),
        api.getShoppingList(),
        api.getHistory(),
      ]);
      if (cancelled) return;
      const lsEntries = loadJSON<Entry[]>(STORAGE_KEY, []);
      const lsList = loadJSON<ShoppingItem[]>(SHOPPING_KEY, []);
      const lsHist = loadJSON<SavedList[]>(HISTORY_KEY, []);
      if (apiEntries !== null) {
        if (apiEntries.length > 0) {
          setEntries(apiEntries);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(apiEntries));
        } else if (lsEntries.length > 0) {
          setEntries(lsEntries);
          api.setEntries(lsEntries);
        } else {
          fetch("/base/productos.json")
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((data) => {
              const list = Array.isArray(data) ? (data as Entry[]) : [];
              if (list.length) {
                setEntries(list);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
                api.setEntries(list);
              }
              setLoading(false);
            })
            .catch(() => setLoading(false));
          if (lsList.length) api.setShoppingList(lsList);
          if (lsHist.length) api.setHistory(lsHist);
          apiReady.current = true;
          if (apiEntries !== null) setLoading(false);
          return;
        }
      }
      if (apiList !== null) {
        if (apiList.length > 0) setShoppingList(apiList);
        else if (lsList.length > 0) {
          setShoppingList(lsList);
          api.setShoppingList(lsList);
        }
      }
      if (apiHist !== null) {
        if (apiHist.length > 0) setHistory(apiHist);
        else if (lsHist.length > 0) {
          setHistory(lsHist);
          api.setHistory(lsHist);
        }
      }
      if (
        (lsEntries.length && apiEntries?.length === 0) ||
        (lsList.length && apiList?.length === 0) ||
        (lsHist.length && apiHist?.length === 0)
      ) {
        api.migrate({ entries: lsEntries, shoppingList: lsList, history: lsHist });
      }
      apiReady.current = true;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(SHOPPING_KEY, JSON.stringify(shoppingList));
    if (!apiReady.current) return;
    const t = setTimeout(() => api.setShoppingList(shoppingList), 400);
    return () => clearTimeout(t);
  }, [shoppingList]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      pushToast("History storage full — delete old entries or export", () => {});
    }
    if (!apiReady.current) return;
    const t = setTimeout(() => api.setHistory(history), 400);
    return () => clearTimeout(t);
  }, [history, pushToast]);

  useEffect(() => {
    if (!entries.length) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    if (!apiReady.current) return;
    const t = setTimeout(() => api.setEntries(entries), 400);
    return () => clearTimeout(t);
  }, [entries]);

  useEffect(() => {
    dbListRef.current?.scrollTo({ top: 0 });
  }, [search, categoryFilter]);

  useEffect(() => {
    if (!entries.length) return;
    const byLinea = new Map(entries.map((e) => [e.linea, e.categoria]));
    setShoppingList((prev) => {
      const needsFix = prev.some((item) => !item.categoria && byLinea.has(item.linea));
      if (!needsFix) return prev;
      return prev.map((item) =>
        !item.categoria && byLinea.has(item.linea)
          ? { ...item, categoria: byLinea.get(item.linea) }
          : item,
      );
    });
  }, [entries]);

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
    [selected],
  );
  const setCategoryItem = useCallback((linea: number, cat: string) => {
    setEntries((prev) => {
      const next = prev.map((e) => (e.linea === linea ? { ...e, categoria: cat } : e));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setShoppingList((prev) =>
      prev.map((item) => (item.linea === linea ? { ...item, categoria: cat } : item)),
    );
  }, []);
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
  }, [newProductName, newProductCategory, entries, pushToast]);

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
  }, [entries, filteredSelected]);
  const addSingleToShoppingList = useCallback(
    (entry: Entry) => {
      if (isEntryInList(entry)) return;
      const item: ShoppingItem = {
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
    [isEntryInList, pushToast],
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
    [shoppingList, pushToast],
  );
  const toggleShoppingItem = useCallback(
    (id: string) =>
      setShoppingList((prev) =>
        prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
      ),
    [],
  );
  const removeShoppingItem = useCallback(
    (id: string) => {
      const item = shoppingList.find((i) => i.id === id);
      if (!item) return;
      setShoppingList((prev) => prev.filter((i) => i.id !== id));
      pushToast(`"${item.original}" removed from list`, () => setShoppingList((p) => [...p, item]));
    },
    [shoppingList, pushToast],
  );
  const clearCheckedItems = useCallback(() => {
    const removed = shoppingList.filter((i) => i.checked);
    if (!removed.length) return;
    setShoppingList((prev) => prev.filter((i) => !i.checked));
    pushToast(`${removed.length} checked item${removed.length > 1 ? "s" : ""} removed`, () =>
      setShoppingList((p) => [...p, ...removed]),
    );
  }, [shoppingList, pushToast]);
  const clearAllItems = useCallback(() => setClearAllConfirm(true), []);
  const confirmClearAll = useCallback(() => {
    setClearAllConfirm(false);
    const items = shoppingList;
    if (!items.length) return;
    setShoppingList([]);
    pushToast(`Cleared ${items.length} item${items.length > 1 ? "s" : ""} from list`, () =>
      setShoppingList(items),
    );
  }, [shoppingList, pushToast]);
  const loadListFromFile = useCallback(() => {
    const input = fileInputRef.current;
    if (!input) return;
    input.value = "";
    input.click();
  }, []);
  const handleFileLoad = useCallback(() => {
    const input = fileInputRef.current;
    if (!input?.files?.[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const valid = parseShoppingListJson(data);
        if (!valid) {
          pushToast("No valid items found in file", () => {});
          return;
        }
        const prev = shoppingList;
        setShoppingList(valid);
        pushToast(`Loaded ${valid.length} item${valid.length !== 1 ? "s" : ""} from file`, () =>
          setShoppingList(prev),
        );
      } catch {
        pushToast("Invalid JSON file", () => {});
      }
    };
    reader.readAsText(file);
  }, [shoppingList, pushToast]);
  const downloadList = useCallback(() => {
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const data = { date: now.toISOString(), items: shoppingList };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shopping-list-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [shoppingList]);
  const openSaveModal = useCallback(() => {
    if (shoppingList.length === 0) return;
    const now = new Date();
    const defaultName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} — ${shoppingList.length} items`;
    setHistoryNameDraft(defaultName);
    setShowSaveModal(true);
  }, [shoppingList]);
  const confirmSaveToHistory = useCallback(() => {
    const name = historyNameDraft.trim() || new Date().toLocaleString();
    const entry: SavedList = {
      id: uid(),
      name,
      date: new Date().toISOString(),
      items: shoppingList.map((i) => ({ ...i })),
    };
    if (history.length >= 50)
      pushToast("History limit (50) reached — oldest will be trimmed", () => {});
    const next = [entry, ...history].slice(0, 50);
    setHistory(next);
    setShowSaveModal(false);
    setHistoryOpen(true);
    pushToast(`Saved "${name}" to history`, () =>
      setHistory((prev) => prev.filter((h) => h.id !== entry.id)),
    );
  }, [history, historyNameDraft, shoppingList, pushToast]);
  const loadFromHistory = useCallback(
    (id: string, mode: "replace" | "append" = "replace") => {
      const entry = history.find((h) => h.id === id);
      if (!entry) return;
      const prev = shoppingList;
      if (mode === "replace") {
        const restored = entry.items.map((i) => ({ ...i, id: uid() }));
        setShoppingList(restored);
        pushToast(`Loaded "${entry.name}" (${restored.length} items)`, () => setShoppingList(prev));
      } else {
        const existingLineas = new Set(shoppingList.map((i) => i.linea));
        const existingNames = new Set(shoppingList.map((i) => i.original.trim().toLowerCase()));
        const toAdd = entry.items.filter(
          (i) =>
            !existingLineas.has(i.linea) && !existingNames.has(i.original.trim().toLowerCase()),
        );
        if (toAdd.length === 0) {
          pushToast("All items already in list", () => {});
          return;
        }
        const added = toAdd.map((i) => ({ ...i, id: uid() }));
        setShoppingList((prev2) => [...prev2, ...added]);
        pushToast(`Appended ${added.length} items from "${entry.name}"`, () =>
          setShoppingList(prev),
        );
      }
    },
    [history, shoppingList, pushToast],
  );
  const renameHistoryEntry = useCallback((id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setHistory((prev) => prev.map((h) => (h.id === id ? { ...h, name: trimmed } : h)));
    setRenamingId(null);
  }, []);
  const deleteHistoryEntry = useCallback(
    (id: string) => {
      const removed = history.find((h) => h.id === id);
      if (!removed) return;
      setHistory((prev) => prev.filter((h) => h.id !== id));
      setDeleteHistoryConfirm(null);
      pushToast(`Deleted "${removed.name}" from history`, () =>
        setHistory((prev) => [removed, ...prev]),
      );
    },
    [history, pushToast],
  );
  const downloadHistoryEntry = useCallback(
    (id: string) => {
      const entry = history.find((h) => h.id === id);
      if (!entry) return;
      const blob = new Blob(
        [JSON.stringify({ date: entry.date, name: entry.name, items: entry.items }, null, 2)],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shopping-list-${entry.date.slice(0, 16).replace("T", "_")}-${entry.name.replace(/[^a-z0-9]+/gi, "-").slice(0, 20)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [history],
  );
  const filteredHistory = useMemo(() => {
    const q = historyQuery.toLowerCase().trim();
    if (!q) return history;
    return history.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.date.toLowerCase().includes(q) ||
        h.items.some((i) => i.original.toLowerCase().includes(q)),
    );
  }, [history, historyQuery]);
  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
    (e.currentTarget as HTMLElement).classList.add("entry-dragging");
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(idx);
  }, []);
  const handleDragLeave = useCallback(() => setDragOverIndex(null), []);
  const handleDrop = useCallback((e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (isNaN(from) || from === dropIdx) return;
    setShoppingList((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(dropIdx, 0, moved);
      return next;
    });
  }, []);
  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove("entry-dragging");
    setDragOverIndex(null);
  }, []);
  const shoppingGrouped = useMemo(() => {
    if (!groupByCategory) return null;
    const map = new Map<string, ShoppingItem[]>();
    for (const item of shoppingList) {
      const cat = item.categoria || "Uncategorized";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    const groups: [string, ShoppingItem[]][] = [];
    for (const cat of CATEGORIES) {
      if (map.has(cat)) {
        groups.push([cat, map.get(cat)!]);
        map.delete(cat);
      }
    }
    for (const [cat, items] of map) groups.push([cat, items]);
    return groups;
  }, [groupByCategory, shoppingList]);
  const copyShoppingList = useCallback(async () => {
    const text = (
      groupByCategory && shoppingGrouped
        ? shoppingGrouped.flatMap(([, items]) => items)
        : shoppingList
    )
      .filter((item) => !item.checked)
      .map((item) => `• ${item.original}`)
      .join("\n");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Could not copy to clipboard");
    }
  }, [shoppingList, groupByCategory, shoppingGrouped]);
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
  }, [canonical, selected, canonicalInput]);
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
  }, [search, filtered, selected, entries, shoppingList, pushToast]);
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
  }, [selected, entries, shoppingList, pushToast]);
  const downloadJSON = useCallback(() => {
    const data = JSON.stringify(entries, null, 2);
    localStorage.setItem(STORAGE_KEY, data);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `productos-${new Date().toISOString().slice(0, 16).replace("T", "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entries]);
  const importEntries = useCallback(
    (parsed: unknown) => {
      const valid = parseEntriesJson(parsed);
      if (!valid.length) {
        pushToast("No valid products found in file", () => {});
        return;
      }
      const prev = entries;
      const result = mergeEntries(prev, valid);
      if (result.type === "invalid") {
        pushToast("No valid products found in file", () => {});
        return;
      }
      if (result.type === "noop") {
        pushToast(
          result.skipped
            ? `All ${result.skipped} products already exist — nothing imported`
            : "Nothing to import",
          () => {},
        );
        return;
      }
      if (result.type === "fresh") {
        setEntries(result.entries);
        pushToast(`Imported ${result.entries.length} products`, () => setEntries(prev));
      } else {
        setEntries(result.entries);
        pushToast(
          `Imported ${result.added} products${result.skipped ? ` (${result.skipped} duplicates skipped)` : ""}`,
          () => setEntries(prev),
        );
      }
    },
    [entries, pushToast],
  );

  const loadDbFromFile = useCallback(() => {
    const trigger = (input: HTMLInputElement) => {
      input.value = "";
      input.click();
    };
    const existing = dbFileInputRef.current;
    if (existing) {
      trigger(existing);
      return;
    }
    const tmp = document.createElement("input");
    tmp.type = "file";
    tmp.accept = ".json";
    tmp.style.display = "none";
    tmp.onchange = () => {
      const file = tmp.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string);
          importEntries(parsed);
        } catch {
          pushToast("Invalid JSON file", () => {});
        }
        tmp.remove();
      };
      reader.readAsText(file);
    };
    document.body.appendChild(tmp);
    trigger(tmp);
  }, [importEntries, pushToast]);

  const handleDbFileLoad = useCallback(() => {
    const input = dbFileInputRef.current;
    if (!input?.files?.[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        importEntries(parsed);
      } catch {
        pushToast("Invalid JSON file", () => {});
      }
    };
    reader.readAsText(file);
  }, [importEntries, pushToast]);
  const pending = shoppingList.filter((item) => !item.checked).length;

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
