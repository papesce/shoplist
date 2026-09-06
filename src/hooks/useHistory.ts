import { useState, useEffect, useMemo, useCallback } from "react";
import type { SavedList, ShoppingItem } from "../types";
import { api } from "../api";
import { loadJSON } from "../utils/storage";
import { uid } from "../utils/id";

const HISTORY_KEY = "shopier-historial";

export function useHistory(
  shoppingList: ShoppingItem[],
  setShoppingList: React.Dispatch<React.SetStateAction<ShoppingItem[]>>,
  pushToast: (msg: string, undo: () => void) => void,
) {
  const [history, setHistory] = useState<SavedList[]>(() => loadJSON<SavedList[]>(HISTORY_KEY, []));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyNameDraft, setHistoryNameDraft] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  const [deleteHistoryConfirm, setDeleteHistoryConfirm] = useState<string | null>(null);

  // initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const apiHist = await api.getHistory();
      if (cancelled) return;
      const lsHist = loadJSON<SavedList[]>(HISTORY_KEY, []);
      if (apiHist !== null) {
        if (apiHist.length > 0) setHistory(apiHist);
        else if (lsHist.length > 0) {
          setHistory(lsHist);
          api.setHistory(lsHist);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      pushToast("History storage full — delete old entries or export", () => {});
    }
    // debounced SQLite sync — assume apiReady handled by caller via history length check
    const t = setTimeout(() => api.setHistory(history), 400);
    return () => clearTimeout(t);
  }, [history, pushToast]);

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
    [history, shoppingList, pushToast, setShoppingList],
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
        {
          type: "application/json",
        },
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

  return {
    history,
    setHistory,
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
  };
}
