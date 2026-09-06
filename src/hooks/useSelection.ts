import { useState, useMemo, useCallback } from "react";
import type { Entry } from "../types";

export function useSelection(entries: Entry[], filtered: Entry[], search: string) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [canonical, setCanonical] = useState<number | null>(null);
  const [canonicalInput, setCanonicalInput] = useState("");

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

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setCanonical(null);
    setCanonicalInput("");
  }, []);

  return {
    selected,
    setSelected,
    canonical,
    setCanonical,
    canonicalInput,
    setCanonicalInput,
    filteredSelected,
    selectedCount,
    filteredSelectedCount,
    hasCanonical,
    canUnify,
    canKeepSelected,
    toggleSelected,
    setAsCanonical,
    clearSelection,
  };
}
