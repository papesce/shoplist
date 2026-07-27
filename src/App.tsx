import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Undo2,
  Download,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  X,
  ClipboardCopy,
  Check,
  List,
  LayoutGrid,
  FolderOpen,
  Ellipsis,
  GripVertical,
  Star,
} from "lucide-react";
import type { Entry, ShoppingItem, Summary } from "./types";

const STORAGE_KEY = "shopier-productos";
const SHOPPING_KEY = "shopier-lista";
const EDIT_MODE_KEY = "shopier-edit-mode";

type ToastAction = {
  id: string;
  message: string;
  undo: () => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

const CATEGORIES = [
  "Almacén",
  "Bebidas",
  "Carnicería",
  "Congelados",
  "Fiambrería",
  "Higiene",
  "Lácteos",
  "Limpieza",
  "Mascotas",
  "Otros",
  "Panadería",
  "Verdulería",
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Almacén":    { bg: "#fef3c7", text: "#92400e" },
  "Bebidas":    { bg: "#dbeafe", text: "#1e40af" },
  "Carnicería": { bg: "#fee2e2", text: "#991b1b" },
  "Congelados": { bg: "#e0e7ff", text: "#3730a3" },
  "Fiambrería": { bg: "#fce7f3", text: "#9d174d" },
  "Higiene":    { bg: "#d1fae5", text: "#065f46" },
  "Lácteos":    { bg: "#ede9fe", text: "#5b21b6" },
  "Limpieza":   { bg: "#ccfbf1", text: "#134e4a" },
  "Mascotas":   { bg: "#fed7aa", text: "#9a3412" },
  "Otros":      { bg: "#f3f4f6", text: "#374151" },
  "Panadería":  { bg: "#fef9c3", text: "#854d0e" },
  "Verdulería": { bg: "#dcfce7", text: "#166534" },
};

function computeMenuPosition(
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

let nextId = Date.now();
function uid() {
  return String(nextId++);
}

function calcSummary(list: Entry[]): Summary {
  const withQuantity = list.filter((e) => /^[\d.,/]/.test(e.original)).length;
  return {
    total: list.length,
    withQuantity,
    textOnly: list.length - withQuantity,
  };
}

function highlight(text: string, query: string) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? <mark key={i}>{part}</mark> : part
  );
}

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

const ENABLE_UNIFY = false;

export default function App() {
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<Entry[]>(() => loadJSON<Entry[]>(STORAGE_KEY, []));
  const [loading, setLoading] = useState(entries.length === 0);
  const [fetchError, setFetchError] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [canonical, setCanonical] = useState<number | null>(null);
  const [canonicalInput, setCanonicalInput] = useState("");

  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(
    () => loadJSON<ShoppingItem[]>(SHOPPING_KEY, [])
  );
  const [addMsg, setAddMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<ToastAction[]>([]);
  const [undoStack, setUndoStack] = useState<Array<{ description: string; undo: () => void }>>([]);
  const [unifyConfirm, setUnifyConfirm] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [groupByCategory, setGroupByCategory] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categoryMsg, setCategoryMsg] = useState("");
  const [catPopover, setCatPopover] = useState<string | null>(null);
  const [catPopoverPos, setCatPopoverPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("");
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [shoppingMenuOpen, setShoppingMenuOpen] = useState(false);
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const [editMode, setEditMode] = useState(() => localStorage.getItem(EDIT_MODE_KEY) === "true");
  const [editingEntry, setEditingEntry] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => {
      const next = !prev;
      localStorage.setItem(EDIT_MODE_KEY, String(next));
      return next;
    });
  }, []);

  const startEditing = useCallback((entry: Entry) => {
    setEditingEntry(entry.linea);
    setEditingValue(entry.original);
  }, []);

  const saveEditing = useCallback(() => {
    if (editingEntry === null || editingValue.trim() === "") {
      setEditingEntry(null);
      return;
    }
    setEntries((prev) => {
      const next = prev.map((e) =>
        e.linea === editingEntry ? { ...e, original: editingValue.trim() } : e
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setEditingEntry(null);
  }, [editingEntry, editingValue]);

  const openCatPopover = useCallback((id: string, btn: HTMLButtonElement) => {
    const r = btn.getBoundingClientRect();
    const pos = computeMenuPosition(r, 260, 350);
    setCatPopoverPos({ top: pos.top, right: window.innerWidth - pos.left - 260 });
    setCatPopover((prev) => (prev === id ? null : id));
  }, []);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shoppingMenuRef = useRef<HTMLButtonElement>(null);
  const topMenuRef = useRef<HTMLButtonElement>(null);
  const unifyCatRef = useRef<HTMLButtonElement>(null);
  const addModalCatRef = useRef<HTMLButtonElement>(null);
  const [shoppingMenuPos, setShoppingMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [topMenuPos, setTopMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [unifyCatPos, setUnifyCatPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [addModalCatPos, setAddModalCatPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [leftPct, setLeftPct] = useState(50);
  const panelsRef = useRef<HTMLDivElement>(null);
  const dbListRef = useRef<HTMLDivElement>(null);
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

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => {
      const toast = prev.find((t) => t.id === id);
      if (toast) clearTimeout(toast.timeoutId);
      return prev.filter((t) => t.id !== id);
    });
  }, []);

  const pushToast = useCallback(
    (message: string, undo: () => void, duration = 5500) => {
      const id = uid();
      const timeoutId = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
      setToasts((prev) => [...prev, { id, message, undo, timeoutId }]);
      setUndoStack((prev) => [...prev.slice(-19), { description: message, undo }]);
    },
    []
  );

  const performUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const action = next.pop()!;
      action.undo();
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        performUndo();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [performUndo]);

  useEffect(() => {
    if (entries.length > 0) return;
    fetch("/base/productos.json")
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? (data as Entry[]) : [];
        setEntries(list);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        setLoading(false);
      })
      .catch(() => {
        import("../base/productos.json")
          .then((mod) => {
            const list = (Array.isArray(mod.default) ? mod.default : []) as Entry[];
            setEntries(list);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
            setLoading(false);
          })
          .catch(() => {
            setFetchError(true);
            setLoading(false);
          });
      });
  }, [entries.length]);

  useEffect(() => {
    localStorage.setItem(SHOPPING_KEY, JSON.stringify(shoppingList));
  }, [shoppingList]);

  useEffect(() => {
    dbListRef.current?.scrollTo({ top: 0 });
  }, [search, categoryFilter]);

  useEffect(() => {
    if (!catPopover) return;
    const close = (e: MouseEvent) => {
      if ((e.target as Element).closest('.cat-popover, .cat-badge')) return;
      setCatPopover(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [catPopover]);

  // Backfill categoria for shopping list items saved before the field existed
  useEffect(() => {
    if (!entries.length) return;
    const byLinea = new Map(entries.map((e) => [e.linea, e.categoria]));
    setShoppingList((prev) => {
      const needsFix = prev.some((item) => !item.categoria && byLinea.has(item.linea));
      if (!needsFix) return prev;
      return prev.map((item) =>
        !item.categoria && byLinea.has(item.linea)
          ? { ...item, categoria: byLinea.get(item.linea) }
          : item
      );
    });
  }, [entries]);

  const filtered = useMemo(() => {
    let result = entries;
    const q = search.toLowerCase();
    if (q) {
      result = result.filter((e) => e.original.toLowerCase().includes(q));
    }
    if (categoryFilter) {
      result = result.filter((e) => e.categoria === categoryFilter);
    }
    return result;
  }, [search, categoryFilter, entries]);

  const summary = useMemo(() => calcSummary(entries), [entries]);

  const activeCategories = useMemo(
    () => CATEGORIES.filter((cat) => entries.some((e) => e.categoria === cat)),
    [entries]
  );

  const sortedCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      if (e.categoria) counts.set(e.categoria, (counts.get(e.categoria) || 0) + 1);
    }
    return [...activeCategories].sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));
  }, [activeCategories, entries]);

  const [unifyCatOpen, setUnifyCatOpen] = useState(false);
  const [addModalCatOpen, setAddModalCatOpen] = useState(false);

  useEffect(() => {
    if (!shoppingMenuOpen && !topMenuOpen && !unifyCatOpen && !addModalCatOpen) return;
    const close = (e: MouseEvent) => {
      if ((e.target as Element).closest('.dropdown, .dropdown-menu')) return;
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
        const next = prev.map((e) =>
          selected.has(e.linea) ? { ...e, categoria: cat } : e
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      setShoppingList((prev) =>
        prev.map((item) =>
          selected.has(item.linea) ? { ...item, categoria: cat } : item
        )
      );
      setCategoryMsg(
        `Category "${cat}" assigned to ${selected.size} entr${selected.size !== 1 ? "ies" : "y"}`
      );
      setTimeout(() => setCategoryMsg(""), 2000);
    },
    [selected]
  );

  const setCategoryItem = useCallback(
    (linea: number, cat: string) => {
      setEntries((prev) => {
        const next = prev.map((e) => e.linea === linea ? { ...e, categoria: cat } : e);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      setShoppingList((prev) =>
        prev.map((item) => item.linea === linea ? { ...item, categoria: cat } : item)
      );
    },
    []
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
  }, [newProductName, newProductCategory, entries, pushToast]);

  const filteredSelected = useMemo(
    () => new Set([...selected].filter((l) => filtered.some((e) => e.linea === l))),
    [selected, filtered]
  );

  const selectedCount = selected.size;
  const filteredSelectedCount = filteredSelected.size;
  const hasCanonical = canonical !== null;
  const canUnify = selectedCount >= 2 && hasCanonical && canonicalInput.trim().length > 0;
  const canKeepSelected = search !== "" && filteredSelectedCount > 0 && filteredSelectedCount < filtered.length;

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
    [entries]
  );

  const addToShoppingList = useCallback(() => {
    const items = entries.filter((e) => filteredSelected.has(e.linea));
    if (!items.length) return;
    setShoppingList((prev) => [
      ...items.map((e) => ({ id: uid(), original: e.original, linea: e.linea, checked: false, categoria: e.categoria })),
      ...prev,
    ]);
    setSelected(new Set());
    setAddMsg(`Added ${items.length} item${items.length > 1 ? "s" : ""}`);
    setTimeout(() => setAddMsg(""), 2000);
  }, [entries, filteredSelected]);

  const toggleShoppingItem = useCallback((id: string) => {
    setShoppingList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  }, []);

  const removeShoppingItem = useCallback(
    (id: string) => {
      const item = shoppingList.find((i) => i.id === id);
      if (!item) return;
      setShoppingList((prev) => prev.filter((i) => i.id !== id));
      pushToast(
        `"${item.original}" removed from list`,
        () => setShoppingList((p) => [...p, item])
      );
    },
    [shoppingList, pushToast]
  );

  const clearCheckedItems = useCallback(() => {
    const removed = shoppingList.filter((i) => i.checked);
    if (!removed.length) return;
    setShoppingList((prev) => prev.filter((i) => !i.checked));
    pushToast(
      `${removed.length} checked item${removed.length > 1 ? "s" : ""} removed`,
      () => setShoppingList((p) => [...p, ...removed])
    );
  }, [shoppingList, pushToast]);

  const clearAllItems = useCallback(() => {
    setClearAllConfirm(true);
  }, []);

  const confirmClearAll = useCallback(() => {
    setClearAllConfirm(false);
    const items = shoppingList;
    if (!items.length) return;
    setShoppingList([]);
    pushToast(
      `Cleared ${items.length} item${items.length > 1 ? "s" : ""} from list`,
      () => setShoppingList(items)
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
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const items = Array.isArray(data?.items) ? data.items : [];
        const valid = items.filter(
          (item: unknown): item is ShoppingItem =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as ShoppingItem).id === "string" &&
            typeof (item as ShoppingItem).original === "string" &&
            typeof (item as ShoppingItem).linea === "number" &&
            typeof (item as ShoppingItem).checked === "boolean"
        );
        if (!valid.length) {
          pushToast("No valid items found in file", () => {});
          return;
        }
        const prev = shoppingList;
        setShoppingList(valid);
        pushToast(
          `Loaded ${valid.length} item${valid.length !== 1 ? "s" : ""} from file`,
          () => setShoppingList(prev)
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

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIdx: number) => {
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
    },
    []
  );

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
    for (const [cat, items] of map) {
      groups.push([cat, items]);
    }
    return groups;
  }, [groupByCategory, shoppingList]);

  const copyShoppingList = useCallback(async () => {
    const text = (groupByCategory && shoppingGrouped
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
          : item
      )
    );

    setSelected(new Set());
    setCanonical(null);
    setCanonicalInput("");
  }, [canonical, selected, canonicalInput]);

  const keepSelected = useCallback(() => {
    const selectedInFilter = new Set(
      [...selected].filter((l) => filtered.some((e) => e.linea === l))
    );
    if (!search || selectedInFilter.size === 0) return;
    const toRemove = new Set(
      filtered.filter((e) => !selectedInFilter.has(e.linea)).map((e) => e.linea)
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
    pushToast(
      `Removed ${n} entr${n !== 1 ? "ies" : "y"} outside selection`,
      () => {
        setEntries((prev) => {
          const next = [...prev, ...removedEntries];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
        setShoppingList((prev) => [...prev, ...removedShop]);
      }
    );
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

    pushToast(
      `${n} entr${n > 1 ? "ies" : "y"} deleted`,
      () => {
        setEntries((prev) => {
          const next = [...prev, ...removedEntries];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
        setShoppingList((prev) => [...prev, ...removedShop]);
      }
    );
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

  const pending = shoppingList.filter((item) => !item.checked).length;

  if (loading) {
    return (
      <div className="app-full-center">
        <h1>Shoplist</h1>
        <p>Loading database…</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="app-full-center">
        <h1>Shoplist</h1>
        <p>Could not load the database.</p>
        <p>Run <code>npm run parse</code> to generate <code>base/productos.json</code></p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="app-full-center">
        <h1>Shoplist</h1>
        <p>No products loaded. Run <code>npm run parse</code> to generate the database.</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand">
          <img src="/logo.svg" alt="" className="topbar-logo" />
          <div>
            <p className="eyebrow">Home ERP</p>
            <h1>Shoplist</h1>
          </div>
        </div>
        <div className="status-strip">
          <span><strong>{summary.total}</strong> entries</span>
          <span><strong>{summary.withQuantity}</strong> with quantity</span>
          <span><strong>{shoppingList.length}</strong> in list</span>
        </div>
        <div className="topbar-actions">
          <button
            className="ghost"
            onClick={performUndo}
            disabled={undoStack.length === 0}
            title={undoStack.length > 0 ? `Undo: ${undoStack[undoStack.length - 1].description}` : "Nothing to undo"}
          >
            <Undo2 size={16} />
          </button>
          <div className="dropdown">
            <button
              ref={topMenuRef}
              className={"dropdown-btn" + (topMenuOpen ? " active" : "")}
              onClick={() => {
                if (topMenuRef.current) {
                  const r = topMenuRef.current.getBoundingClientRect();
                  setTopMenuPos(computeMenuPosition(r, 200, 120));
                }
                setTopMenuOpen((p) => !p);
              }}
            >
              <Ellipsis size={16} />
            </button>
            {topMenuOpen && createPortal(
              <div className="dropdown-menu" style={{ position: "fixed", top: topMenuPos.top, left: topMenuPos.left }}>
                <button
                  className="dropdown-item"
                  onClick={() => { downloadJSON(); setTopMenuOpen(false); }}
                >
                  <Download size={16} /> Export database
                </button>
                <div className="dropdown-sep" />
                <button
                  className="dropdown-item"
                  onClick={() => { toggleEditMode(); setTopMenuOpen(false); }}
                >
                  <Pencil size={16} /> Edit mode
                  <span className={"toggle-switch" + (editMode ? " active" : "")} />
                </button>
              </div>,
              document.body,
            )}
          </div>
        </div>
      </header>

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

          {activeCategories.length > 0 && (
            <div className="cat-chips">
              <button
                className={"cat-chip" + (!categoryFilter ? " active" : "")}
                onClick={() => setCategoryFilter("")}
              >
                All
              </button>
              {sortedCategories.map((cat) => (
                <button
                  key={cat}
                  className={"cat-chip" + (categoryFilter === cat ? " active" : "")}
                  style={categoryFilter !== cat && CATEGORY_COLORS[cat] ? { background: CATEGORY_COLORS[cat].bg, color: CATEGORY_COLORS[cat].text } : undefined}
                  onClick={() => setCategoryFilter(categoryFilter === cat ? "" : cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <div className="action-bar">
            <div className="action-bar-main">
              <button
                className="btn-primary"
                disabled={filteredSelectedCount === 0}
                onClick={addToShoppingList}
              >
                <Plus size={16} /> Add {filteredSelectedCount > 0 ? `(${filteredSelectedCount})` : ""} to list
              </button>
              {addMsg && <span className="add-msg">{addMsg}</span>}
              {editMode && canKeepSelected && (
                <button className="btn-keep" onClick={keepSelected}>
                  <Repeat size={16} /> Keep {filteredSelectedCount} (remove {filtered.length - filteredSelectedCount})
                </button>
              )}
              {editMode && filteredSelectedCount > 0 && (
                <button
                  className="btn-danger"
                  onClick={deleteSelected}
                >
                  <Trash2 size={16} /> Delete ({filteredSelectedCount})
                </button>
              )}
              {filteredSelectedCount > 0 && (
                <button
                  className="ghost"
                  onClick={() => { setSelected(new Set()); setCanonical(null); setCanonicalInput(""); }}
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
                  {unifyCatOpen && createPortal(
                    <div className="dropdown-menu" style={{ position: "fixed", top: unifyCatPos.top, left: unifyCatPos.left }}>
                      <button
                        className="dropdown-item"
                        onClick={() => { assignCategory(""); setUnifyCatOpen(false); }}
                      >
                        No category
                      </button>
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          className="dropdown-item"
                          onClick={() => { assignCategory(cat); setUnifyCatOpen(false); }}
                        >
                          <span
                            className="cat-pop-dot"
                            style={CATEGORY_COLORS[cat] ? { background: CATEGORY_COLORS[cat].bg, color: CATEGORY_COLORS[cat].text } : undefined}
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
                <p>No entries found for <strong>"{search}"</strong></p>
                <button onClick={() => openAddModal(search)}><Plus size={16} /> Add "{search}" as new product</button>
              </div>
            ) : (
              filtered.map((e) => {
                const isSelected = filteredSelected.has(e.linea);
                const isCanonical = canonical === e.linea;
                const cls =
                  "entry" +
                  (isSelected ? " entry-selected" : "") +
                  (isCanonical ? " entry-canonical" : "");

                return (
                  <article key={e.linea} className={cls}>
                    <input
                      type="checkbox"
                      className="entry-check"
                      checked={isSelected}
                      onChange={() => toggleSelected(e.linea)}
                    />
                    {selectedCount >= 2 && isSelected && (
                      <button
                        className="entry-radio"
                        onClick={() => setAsCanonical(e.linea)}
                        title="Set as canonical"
                      >
                        <Star size={16} fill={isCanonical ? "currentColor" : "none"} />
                      </button>
                    )}
                    <span className="entry-line">{e.linea}</span>
                    {editingEntry === e.linea ? (
                      <input
                        className="entry-text entry-edit-input"
                        value={editingValue}
                        onChange={(ev) => setEditingValue(ev.target.value)}
                        onBlur={saveEditing}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter") saveEditing();
                          if (ev.key === "Escape") setEditingEntry(null);
                        }}
                        autoFocus
                        onClick={(ev) => ev.stopPropagation()}
                      />
                    ) : (
                      <span
                        className="entry-text"
                        onDoubleClick={() => editMode && startEditing(e)}
                        onClick={() => toggleSelected(e.linea)}
                      >
                        {highlight(e.original, search)}
                      </span>
                    )}
                    <button
                      className={"cat-badge" + (e.categoria ? "" : " cat-badge-empty")}
                      style={e.categoria && CATEGORY_COLORS[e.categoria] ? { background: CATEGORY_COLORS[e.categoria].bg, color: CATEGORY_COLORS[e.categoria].text } : undefined}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        if (editMode) {
                          openCatPopover(`db-${e.linea}`, ev.currentTarget);
                        } else if (e.categoria) {
                          setCategoryFilter((prev) => prev === e.categoria ? "" : e.categoria!);
                        }
                      }}
                      title={editMode ? "Change category" : "Filter by category"}
                    >
                      {e.categoria || "None"}
                    </button>
                    {isCanonical && <span className="tag">canonical</span>}
                  </article>
                );
              })
            )}
          </div>
        </div>

        <div className="resizer" onMouseDown={onResizerMouseDown} />

        <div className="panel panel-list" style={{ flex: "1 1 0", minWidth: 0 }}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Shopping list</p>
              <h2>{pending} pending item{pending !== 1 ? "s" : ""}</h2>
            </div>
            <div className="panel-header-actions">
              <button className="btn-primary" onClick={copyShoppingList} disabled={pending === 0}>
                {copied ? <><Check size={16} /> Copied</> : <><ClipboardCopy size={16} /> Copy list</>}
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
                  <Ellipsis size={16} />
                </button>
                {shoppingMenuOpen && createPortal(
                  <div className="dropdown-menu" style={{ position: "fixed", top: shoppingMenuPos.top, left: shoppingMenuPos.left }}>
                    <button
                      className="dropdown-item"
                      onClick={() => { setGroupByCategory(!groupByCategory); setShoppingMenuOpen(false); }}
                    >
                      {groupByCategory ? <><List size={16} /> Free list</> : <><LayoutGrid size={16} /> Group by category</>}
                    </button>
                    <div className="dropdown-sep" />
                    <button
                      className="dropdown-item"
                      onClick={() => { clearCheckedItems(); setShoppingMenuOpen(false); }}
                      disabled={shoppingList.filter((i) => i.checked).length === 0}
                    >
                      <Trash2 size={16} /> Remove checked
                    </button>
                    <button
                      className="dropdown-item dropdown-item-danger"
                      onClick={() => { clearAllItems(); setShoppingMenuOpen(false); }}
                      disabled={shoppingList.length === 0}
                    >
                      <Trash2 size={16} /> Clear all
                    </button>
                    <div className="dropdown-sep" />
                    <button
                      className="dropdown-item"
                      onClick={() => { downloadList(); setShoppingMenuOpen(false); }}
                      disabled={shoppingList.length === 0}
                    >
                      <Download size={16} /> Download list
                    </button>
                    <button
                      className="dropdown-item"
                      onClick={() => { loadListFromFile(); setShoppingMenuOpen(false); }}
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
            {shoppingList.length === 0 ? (
              <div className="empty small">
                <p>Search for products in the database and add them with <Plus size={14} style={{ verticalAlign: "middle" }} /></p>
              </div>
            ) : shoppingGrouped ? (
              shoppingGrouped.map(([cat, items]) => (
                <div key={cat} className="group-section">
                  <div className="group-header">{cat} <span className="group-count">{items.length}</span></div>
                  {items.map((item) => (
                    <article key={item.id} className={"entry" + (item.checked ? " entry-tachado" : "")}>
                      <input
                        type="checkbox"
                        className="entry-check"
                        checked={item.checked}
                        onChange={() => toggleShoppingItem(item.id)}
                      />
                      <span className="entry-text">{item.original}</span>
                      <button
                        className="entry-remove"
                        onClick={() => removeShoppingItem(item.id)}
                        title="Remove from list"
                      >
                        <X size={14} />
                      </button>
                    </article>
                  ))}
                </div>
              ))
            ) : (
              shoppingList.map((item, idx) => (
                <article
                  key={item.id}
                  draggable
                  className={
                    "entry" +
                    (item.checked ? " entry-tachado" : "") +
                    (dragOverIndex === idx ? " entry-drag-over" : "")
                  }
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                >
                  <span className="drag-handle"><GripVertical size={16} /></span>
                  <input
                    type="checkbox"
                    className="entry-check"
                    checked={item.checked}
                    onChange={() => toggleShoppingItem(item.id)}
                  />
                  <span className="entry-text">{item.original}</span>
                  {item.categoria && (
                    <span
                      className="cat-tag"
                      style={CATEGORY_COLORS[item.categoria] ? { background: CATEGORY_COLORS[item.categoria].bg, color: CATEGORY_COLORS[item.categoria].text } : undefined}
                    >
                      {item.categoria}
                    </span>
                  )}
                  <button
                    className="entry-remove"
                    onClick={() => removeShoppingItem(item.id)}
                    title="Remove from list"
                  >
                    <X size={14} />
                  </button>
                </article>
              ))
            )}
          </div>
        </div>
      </div>

      {ENABLE_UNIFY && unifyConfirm && (
        <div className="modal-overlay" onClick={() => setUnifyConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p className="modal-msg">
              Unify <strong>{selected.size}</strong> entries as{" "}
              <strong>"{canonicalInput.trim()}"</strong>? The others will be deleted.
            </p>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setUnifyConfirm(false)}>
                Cancel
              </button>
              <button className="btn-unify" onClick={confirmUnify}>
                Unify
              </button>
            </div>
          </div>
        </div>
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
              onKeyDown={(e) => { if (e.key === "Enter") addNewProduct(); }}
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
                <div className="dropdown-menu" style={{ position: "fixed", top: addModalCatPos.top, left: addModalCatPos.left, zIndex: 301 }}>
                  <button
                    className={"dropdown-item" + (!newProductCategory ? " dropdown-item-active" : "")}
                    onClick={() => { setNewProductCategory(""); setAddModalCatOpen(false); }}
                  >
                    {!newProductCategory && <span className="cat-pop-check"><Check size={14} /></span>}
                    No category
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      className={"dropdown-item" + (newProductCategory === cat ? " dropdown-item-active" : "")}
                      onClick={() => { setNewProductCategory(cat); setAddModalCatOpen(false); }}
                    >
                      {newProductCategory === cat && <span className="cat-pop-check"><Check size={14} /></span>}
                      <span
                        className="cat-pop-dot"
                        style={CATEGORY_COLORS[cat] ? { background: CATEGORY_COLORS[cat].bg, color: CATEGORY_COLORS[cat].text } : undefined}
                      />
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
        <div className="modal-overlay" onClick={() => setClearAllConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p className="modal-msg">
              Clear all <strong>{shoppingList.length}</strong> item{shoppingList.length !== 1 ? "s" : ""} from the list?
            </p>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setClearAllConfirm(false)}>
                Cancel
              </button>
              <button className="btn-unify" onClick={confirmClearAll}>
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}

      {catPopover && (() => {
        const linea = parseInt(catPopover.replace(/^(db|sl)-/, ""));
        const currentEntry = entries.find((e) => e.linea === linea);
        const currentCat = currentEntry?.categoria ?? "";
        return (
          <div
            className="cat-popover"
            style={{ position: "fixed", top: catPopoverPos.top, right: catPopoverPos.right, left: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={"cat-pop-item cat-pop-clear" + (!currentCat ? " cat-pop-active" : "")}
              onClick={() => {
                setCategoryItem(linea, "");
                setCatPopover(null);
              }}
            >
              {!currentCat && <span className="cat-pop-check"><Check size={14} /></span>}
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
                {currentCat === c && <span className="cat-pop-check"><Check size={14} /></span>}
                <span
                  className="cat-pop-dot"
                  style={CATEGORY_COLORS[c] ? { background: CATEGORY_COLORS[c].bg, color: CATEGORY_COLORS[c].text } : undefined}
                />
                {c}
              </button>
            ))}
          </div>
        );
      })()}

      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <span>{t.message}</span>
            <button
              className="toast-undo"
              onClick={() => {
                t.undo();
                dismissToast(t.id);
              }}
            >
              Undo
            </button>
            <button className="toast-close" onClick={() => dismissToast(t.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
