import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import type { Entrada, ShoppingItem, Resumen } from "./types";

const STORAGE_KEY = "shopier-productos";
const SHOPPING_KEY = "shopier-lista";

type ToastAction = {
  id: string;
  message: string;
  undo: () => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

const CATEGORIAS = [
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

let nextId = Date.now();
function uid() {
  return String(nextId++);
}

function calcularResumen(lista: Entrada[]): Resumen {
  const conCantidad = lista.filter((e) => /^[\d.,/]/.test(e.original)).length;
  return {
    total: lista.length,
    conCantidad,
    soloTexto: lista.length - conCantidad,
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

function cargarJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<Entrada[]>(() => cargarJSON<Entrada[]>(STORAGE_KEY, []));
  const [loading, setLoading] = useState(entries.length === 0);
  const [fetchError, setFetchError] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [canonical, setCanonical] = useState<number | null>(null);
  const [canonicalInput, setCanonicalInput] = useState("");
  const [saved, setSaved] = useState(false);

  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(
    () => cargarJSON<ShoppingItem[]>(SHOPPING_KEY, [])
  );
  const [addMsg, setAddMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<ToastAction[]>([]);
  const [unifyConfirm, setUnifyConfirm] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [agruparCategorias, setAgruparCategorias] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [categoriaMsg, setCategoriaMsg] = useState("");
  const [catPopover, setCatPopover] = useState<string | null>(null);
  const [catPopoverPos, setCatPopoverPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  const openCatPopover = useCallback((id: string, btn: HTMLButtonElement) => {
    const r = btn.getBoundingClientRect();
    setCatPopoverPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    setCatPopover((prev) => (prev === id ? null : id));
  }, []);
  const inputRef = useRef<HTMLInputElement>(null);
  const [leftPct, setLeftPct] = useState(50);
  const panelsRef = useRef<HTMLDivElement>(null);
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
    },
    []
  );

  useEffect(() => {
    if (entries.length > 0) return;
    fetch("/base/productos.json")
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? (data as Entrada[]) : [];
        setEntries(list);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        setLoading(false);
      })
      .catch(() => {
        import("../base/productos.json")
          .then((mod) => {
            const list = (Array.isArray(mod.default) ? mod.default : []) as Entrada[];
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
    if (!catPopover) return;
    const close = () => setCatPopover(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
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
    if (filtroCategoria) {
      result = result.filter((e) => e.categoria === filtroCategoria);
    }
    return result;
  }, [search, filtroCategoria, entries]);

  const resumen = useMemo(() => calcularResumen(entries), [entries]);

  const categoriasActivas = useMemo(
    () => CATEGORIAS.filter((cat) => entries.some((e) => e.categoria === cat)),
    [entries]
  );

  const assignCategoria = useCallback(
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
      setCategoriaMsg(
        `Categoría "${cat}" asignada a ${selected.size} entrada${selected.size !== 1 ? "s" : ""}`
      );
      setTimeout(() => setCategoriaMsg(""), 2000);
    },
    [selected]
  );

  const setCategoriaItem = useCallback(
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
    setAddMsg(`Agregados ${items.length} item${items.length > 1 ? "s" : ""}`);
    setTimeout(() => setAddMsg(""), 2000);
  }, [entries, filteredSelected]);

  const toggleShoppingItem = useCallback((id: string) => {
    setShoppingList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  }, []);

  const removeShoppingItem = useCallback(
    (id: string) => {
      setShoppingList((prev) => {
        const item = prev.find((i) => i.id === id);
        if (!item) return prev;
        const next = prev.filter((i) => i.id !== id);
        pushToast(
          `"${item.original}" quitado de la lista`,
          () => setShoppingList((p) => [...p, item])
        );
        return next;
      });
    },
    [pushToast]
  );

  const clearCheckedShopping = useCallback(() => {
    setShoppingList((prev) => {
      const removed = prev.filter((i) => i.checked);
      if (!removed.length) return prev;
      pushToast(
        `${removed.length} producto${removed.length > 1 ? "s" : ""} tachado${removed.length > 1 ? "s" : ""} quitado${removed.length > 1 ? "s" : ""}`,
        () => setShoppingList((p) => [...p, ...removed])
      );
      return prev.filter((i) => !i.checked);
    });
  }, [pushToast]);

  const descargarLista = useCallback(() => {
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const data = { fecha: now.toISOString(), items: shoppingList };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lista-super-${ts}.json`;
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

  const shoppingAgrupado = useMemo(() => {
    if (!agruparCategorias) return null;
    const map = new Map<string, ShoppingItem[]>();
    for (const item of shoppingList) {
      const cat = item.categoria || "Sin categoría";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    const grupos: [string, ShoppingItem[]][] = [];
    for (const cat of CATEGORIAS) {
      if (map.has(cat)) {
        grupos.push([cat, map.get(cat)!]);
        map.delete(cat);
      }
    }
    for (const [cat, items] of map) {
      grupos.push([cat, items]);
    }
    return grupos;
  }, [agruparCategorias, shoppingList]);

  const copyShoppingList = useCallback(async () => {
    const text = (agruparCategorias && shoppingAgrupado
      ? shoppingAgrupado.flatMap(([, items]) => items)
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
      alert("No se pudo copiar al portapapeles");
    }
  }, [shoppingList, agruparCategorias, shoppingAgrupado]);

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
    setSaved(false);
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
      `Eliminadas ${n} entrada${n !== 1 ? "s" : ""} fuera de la selección`,
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
      `${n} entrada${n > 1 ? "s" : ""} eliminada${n > 1 ? "s" : ""}`,
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
    a.download = "productos.json";
    a.click();
    URL.revokeObjectURL(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, [entries]);

  const pendientes = shoppingList.filter((item) => !item.checked).length;

  if (loading) {
    return (
      <div className="app-full-center">
        <h1>Shoplist</h1>
        <p>Cargando base de datos…</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="app-full-center">
        <h1>Shoplist</h1>
        <p>No se pudo cargar la base de datos.</p>
        <p>Ejecutá <code>npm run parse</code> para generar <code>base/productos.json</code></p>
        <button onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="app-full-center">
        <h1>Shoplist</h1>
        <p>No hay productos cargados. Ejecutá <code>npm run parse</code> para generar la base.</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">ERP doméstico</p>
          <h1>Shoplist</h1>
        </div>
        <div className="status-strip">
          <span><strong>{resumen.total}</strong> entradas</span>
          <span><strong>{resumen.conCantidad}</strong> con cantidad</span>
          <span><strong>{shoppingList.length}</strong> en lista</span>
        </div>
      </header>

      <div className="panels" ref={panelsRef}>
        <div className="panel panel-db" style={{ flex: `0 0 ${leftPct}%` }}>
          <div className="search-bar">
            <input
              type="search"
              placeholder="Buscar productos…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <span className="result-count">{filtered.length}</span>
          </div>

          {categoriasActivas.length > 0 && (
            <div className="cat-chips">
              <button
                className={"cat-chip" + (!filtroCategoria ? " active" : "")}
                onClick={() => setFiltroCategoria("")}
              >
                Todas
              </button>
              {categoriasActivas.map((cat) => (
                <button
                  key={cat}
                  className={"cat-chip" + (filtroCategoria === cat ? " active" : "")}
                  onClick={() => setFiltroCategoria(filtroCategoria === cat ? "" : cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <div className="action-bar">
            <div className="action-bar-main">
              <button
                disabled={filteredSelectedCount === 0}
                onClick={addToShoppingList}
              >
                ➕ Agregar {filteredSelectedCount > 0 ? `(${filteredSelectedCount})` : ""} a la lista
              </button>
              {addMsg && <span className="add-msg">{addMsg}</span>}
              {filteredSelectedCount > 0 && (
                <>
                  <button className="btn-del-view" onClick={deleteSelected}>
                    🗑️ Eliminar ({filteredSelectedCount})
                  </button>
                  {canKeepSelected && (
                    <button className="btn-keep" onClick={keepSelected}>
                      🔁 Quedarse con {filteredSelectedCount} (eliminar {filtered.length - filteredSelectedCount})
                    </button>
                  )}
                  <button className="ghost" onClick={() => { setSelected(new Set()); setCanonical(null); setCanonicalInput(""); }}>
                    Limpiar
                  </button>
                </>
              )}
            </div>

            {selectedCount >= 2 && (
              <div className="action-bar-unify">
                <div className="canonical-field">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Nombre canónico…"
                    value={canonicalInput}
                    onChange={(e) => setCanonicalInput(e.target.value)}
                  />
                </div>
                <select
                  className="cat-select"
                  defaultValue=""
                  onChange={(e) => assignCategoria(e.target.value)}
                >
                  <option value="" disabled>Categoría…</option>
                  {CATEGORIAS.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {categoriaMsg && <span className="cat-msg">{categoriaMsg}</span>}
                <button className="btn-unify" disabled={!canUnify} onClick={unify}>
                  🗑️ Unificar {canUnify ? `(${selectedCount})` : ""}
                </button>
                <button className="ghost" onClick={downloadJSON}>
                  📥 {saved ? "¡Descargado!" : "Guardar"}
                </button>
              </div>
            )}
          </div>

          <div className="entry-list">
            {filtered.length === 0 ? (
              <div className="empty small">
                <p>No se encontraron entradas para <strong>"{search}"</strong></p>
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
                        title="Fijar como canónica"
                      >
                        {isCanonical ? "★" : "☆"}
                      </button>
                    )}
                    <span className="entry-line">{e.linea}</span>
                    <span
                      className="entry-text"
                      onClick={() => toggleSelected(e.linea)}
                    >
                      {highlight(e.original, search)}
                    </span>
                    <button
                      className={"cat-badge" + (e.categoria ? "" : " cat-badge-empty")}
                      onClick={(ev) => { ev.stopPropagation(); openCatPopover(`db-${e.linea}`, ev.currentTarget); }}
                      title="Cambiar categoría"
                    >
                      {e.categoria || "·"}
                    </button>
                    {isCanonical && <span className="tag">canónica</span>}
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
              <p className="eyebrow">Lista del super</p>
              <h2>{pendientes} pendiente{pendientes !== 1 ? "s" : ""}</h2>
            </div>
            <div className="panel-header-actions">
              <div className="view-toggle">
                <button
                  className={"ghost" + (!agruparCategorias ? " active" : "")}
                  onClick={() => setAgruparCategorias(false)}
                  title="Lista libre"
                >
                  ☰
                </button>
                <button
                  className={"ghost" + (agruparCategorias ? " active" : "")}
                  onClick={() => setAgruparCategorias(true)}
                  title="Agrupar por categoría"
                >
                  ▤
                </button>
              </div>
              <button onClick={copyShoppingList} disabled={pendientes === 0}>
                {copied ? "✅ Copiadas" : "📋 Copiar lista"}
              </button>
              <button
                className="ghost"
                onClick={clearCheckedShopping}
                disabled={shoppingList.filter((i) => i.checked).length === 0}
              >
                🗑️ Quitar tachados
              </button>
              <button
                className="ghost"
                onClick={descargarLista}
                disabled={shoppingList.length === 0}
                title="Descargar lista"
              >
                💾
              </button>
            </div>
          </div>

          <div className="entry-list">
            {shoppingList.length === 0 ? (
              <div className="empty small">
                <p>Buscá productos en la base y agregalos con ➕</p>
              </div>
            ) : shoppingAgrupado ? (
              shoppingAgrupado.map(([cat, items]) => (
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
                        title="Quitar de la lista"
                      >
                        ✕
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
                  <span className="drag-handle">⠿</span>
                  <input
                    type="checkbox"
                    className="entry-check"
                    checked={item.checked}
                    onChange={() => toggleShoppingItem(item.id)}
                  />
                  <span className="entry-text">{item.original}</span>
                  {item.categoria && <span className="cat-tag">{item.categoria}</span>}
                  <button
                    className="entry-remove"
                    onClick={() => removeShoppingItem(item.id)}
                    title="Quitar de la lista"
                  >
                    ✕
                  </button>
                </article>
              ))
            )}
          </div>
        </div>
      </div>

      {unifyConfirm && (
        <div className="modal-overlay" onClick={() => setUnifyConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p className="modal-msg">
              ¿Unificar <strong>{selected.size}</strong> entradas como{" "}
              <strong>"{canonicalInput.trim()}"</strong>? Las demás se eliminarán.
            </p>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setUnifyConfirm(false)}>
                Cancelar
              </button>
              <button className="btn-unify" onClick={confirmUnify}>
                Unificar
              </button>
            </div>
          </div>
        </div>
      )}

      {catPopover && (
        <div
          className="cat-popover"
          style={{ position: "fixed", top: catPopoverPos.top, right: catPopoverPos.right, left: "auto" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="cat-pop-item cat-pop-clear" onClick={() => {
            const linea = parseInt(catPopover.replace(/^(db|sl)-/, ""));
            setCategoriaItem(linea, "");
            setCatPopover(null);
          }}>sin categoría</button>
          {CATEGORIAS.map((c) => (
            <button
              key={c}
              className="cat-pop-item"
              onClick={() => {
                const linea = parseInt(catPopover.replace(/^(db|sl)-/, ""));
                setCategoriaItem(linea, c);
                setCatPopover(null);
              }}
            >{c}</button>
          ))}
        </div>
      )}

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
              Deshacer
            </button>
            <button className="toast-close" onClick={() => dismissToast(t.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
