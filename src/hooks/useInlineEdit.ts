import { useState, useCallback } from "react";
import type { Entry, ShoppingItem } from "../types";

export function useInlineEdit(
  entries: Entry[],
  setEntries: React.Dispatch<React.SetStateAction<Entry[]>>,
  setShoppingList: React.Dispatch<React.SetStateAction<ShoppingItem[]>>,
  pushToast: (msg: string, undo: () => void) => void,
) {
  const [editingEntry, setEditingEntry] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const startEditing = useCallback((entry: Entry) => {
    setEditingEntry(entry.linea);
    setEditingValue(entry.original);
  }, []);
  const cancelEditing = useCallback(() => setEditingEntry(null), []);

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
    setEntries((prev) => prev.map((e) => (e.linea === linea ? { ...e, original: trimmed } : e)));
    setShoppingList((prev) =>
      prev.map((item) => (item.linea === linea ? { ...item, original: trimmed } : item)),
    );
    pushToast(`Renamed "${oldName}" → "${trimmed}"`, () => {
      setEntries((prev) => prev.map((e) => (e.linea === linea ? { ...e, original: oldName } : e)));
      setShoppingList((prev) =>
        prev.map((item) => (item.linea === linea ? { ...item, original: oldName } : item)),
      );
    });
    setEditingEntry(null);
  }, [editingEntry, editingValue, entries, pushToast, setEntries, setShoppingList]);

  return { editingEntry, editingValue, setEditingValue, startEditing, cancelEditing, saveEditing };
}
