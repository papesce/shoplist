import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { ShoppingItem } from "../types";
import { api } from "../api";
import { uid } from "../utils/id";
import { CATEGORIES } from "../constants/categories";
import { parseShoppingListJson } from "../utils/dbImport";

export function useShoppingList(
  pushToast: (msg: string, undo: () => void) => void,
  entriesCategoriaMap?: Map<number, string | undefined>,
) {
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const apiReady = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const apiList = await api.getShoppingList();
      if (cancelled) return;
      if (apiList !== null && apiList.length > 0) setShoppingList(apiList);
      apiReady.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!apiReady.current) return;
    const t = setTimeout(() => api.setShoppingList(shoppingList), 400);
    return () => clearTimeout(t);
  }, [shoppingList]);

  // backfill categoria when entries load
  useEffect(() => {
    if (!entriesCategoriaMap || entriesCategoriaMap.size === 0) return;
    setShoppingList((prev) => {
      const needsFix = prev.some((item) => !item.categoria && entriesCategoriaMap.has(item.linea));
      if (!needsFix) return prev;
      return prev.map((item) =>
        !item.categoria && entriesCategoriaMap.has(item.linea)
          ? { ...item, categoria: entriesCategoriaMap.get(item.linea) }
          : item,
      );
    });
  }, [entriesCategoriaMap]);

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [groupByCategory, setGroupByCategory] = useState(true);
  const [copied, setCopied] = useState(false);

  const pending = useMemo(() => shoppingList.filter((i) => !i.checked).length, [shoppingList]);

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
  const clearAllItems = useCallback(() => {}, []);
  const confirmClearAll = useCallback(
    (onDone: () => void) => {
      onDone();
      const items = shoppingList;
      if (!items.length) return;
      setShoppingList([]);
      pushToast(`Cleared ${items.length} items`, () => setShoppingList(items));
    },
    [shoppingList, pushToast],
  );
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

  const handleFileLoad = useCallback(
    (input: HTMLInputElement | null) => {
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
          pushToast(`Loaded ${valid.length} items from file`, () => setShoppingList(prev));
        } catch {
          pushToast("Invalid JSON file", () => {});
        }
      };
      reader.readAsText(file);
    },
    [shoppingList, pushToast],
  );

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

  return {
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
    clearAllItems,
    confirmClearAll,
    copyShoppingList,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    handleFileLoad,
    downloadList,
    uidFactory: uid,
  };
}
