import { useState, useEffect, useRef, useCallback } from "react";
import type { Entry } from "../types";
import { api } from "../api";
import { loadJSON } from "../utils/storage";
import { parseEntriesJson, mergeEntries } from "../utils/dbImport";

const STORAGE_KEY = "shopier-productos";

export function useEntries(
  pushToast: (msg: string, undo: () => void) => void,
  onLoaded?: (entries: Entry[]) => void,
) {
  const [entries, setEntries] = useState<Entry[]>(() => loadJSON<Entry[]>(STORAGE_KEY, []));
  const [loading, setLoading] = useState(entries.length === 0);
  const apiReady = useRef(false);

  // initial load / migration (SQLite is truth) — caller can observe via onLoaded if needed
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const apiEntries = await api.getEntries();
      if (cancelled) return;
      const lsEntries = loadJSON<Entry[]>(STORAGE_KEY, []);
      if (apiEntries !== null) {
        if (apiEntries.length > 0) {
          setEntries(apiEntries);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(apiEntries));
          onLoaded?.(apiEntries);
        } else if (lsEntries.length > 0) {
          setEntries(lsEntries);
          api.setEntries(lsEntries);
          onLoaded?.(lsEntries);
        } else {
          // try optional seed
          fetch("/base/productos.json")
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((data) => {
              const list = Array.isArray(data) ? (data as Entry[]) : [];
              if (list.length) {
                setEntries(list);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
                api.setEntries(list);
                onLoaded?.(list);
              }
              setLoading(false);
            })
            .catch(() => setLoading(false));
          apiReady.current = true;
          if (apiEntries !== null) setLoading(false);
          return;
        }
      }
      apiReady.current = true;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist to SQLite (debounced) + localStorage cache
  useEffect(() => {
    if (!entries.length) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    if (!apiReady.current) return;
    const t = setTimeout(() => api.setEntries(entries), 400);
    return () => clearTimeout(t);
  }, [entries]);

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

  const importFromJson = useCallback(
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

  const handleDbFileLoadFromInput = useCallback(
    (input: HTMLInputElement | null) => {
      if (!input?.files?.[0]) return;
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string);
          importFromJson(parsed);
        } catch {
          pushToast("Invalid JSON file", () => {});
        }
      };
      reader.readAsText(file);
    },
    [importFromJson, pushToast],
  );

  const loadDbFromFile = useCallback(
    (fallbackInputRef: React.RefObject<HTMLInputElement | null>) => {
      const trigger = (input: HTMLInputElement) => {
        input.value = "";
        input.click();
      };
      const existing = fallbackInputRef.current;
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
            importFromJson(parsed);
          } catch {
            pushToast("Invalid JSON file", () => {});
          }
          tmp.remove();
        };
        reader.readAsText(file);
      };
      document.body.appendChild(tmp);
      trigger(tmp);
    },
    [importFromJson, pushToast],
  );

  return {
    entries,
    setEntries,
    loading,
    apiReady,
    downloadJSON,
    importFromJson,
    handleDbFileLoadFromInput,
    loadDbFromFile,
  };
}
