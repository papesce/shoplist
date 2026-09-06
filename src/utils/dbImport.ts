import type { Entry } from "../types";

export function parseEntriesJson(parsed: unknown): Entry[] {
  const raw: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { entries?: unknown })?.entries)
      ? (parsed as { entries: unknown[] }).entries
      : Array.isArray((parsed as { productos?: unknown })?.productos)
        ? (parsed as { productos: unknown[] }).productos
        : [];
  return raw.filter(
    (item: unknown): item is Entry =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Entry).original === "string" &&
      (item as Entry).original.trim().length > 0 &&
      typeof (item as Entry).linea === "number",
  );
}

export function normalizeEntries(entries: Entry[]): Entry[] {
  return entries.map((e) => ({
    original: e.original.trim(),
    linea: e.linea,
    ...(e.categoria ? { categoria: e.categoria } : {}),
  }));
}

export type ImportResult =
  | { type: "fresh"; entries: Entry[] }
  | { type: "merged"; entries: Entry[]; added: number; skipped: number }
  | { type: "noop"; skipped: number }
  | { type: "invalid" };

export function mergeEntries(existing: Entry[], imported: Entry[]): ImportResult {
  const normalized = normalizeEntries(imported);
  if (!normalized.length) return { type: "invalid" };
  if (existing.length === 0) {
    const reindexed = normalized.map((e, i) => ({ ...e, linea: i + 1 }));
    return { type: "fresh", entries: reindexed };
  }
  const existingNames = new Set(existing.map((e) => e.original.trim().toLowerCase()));
  const existingLineas = new Set(existing.map((e) => e.linea));
  let maxLinea = existing.reduce((m, e) => Math.max(m, e.linea), 0);
  const toAdd: Entry[] = [];
  let skipped = 0;
  for (const e of normalized) {
    const key = e.original.trim().toLowerCase();
    if (existingNames.has(key)) {
      skipped++;
      continue;
    }
    while (existingLineas.has(maxLinea + 1)) maxLinea++;
    maxLinea++;
    toAdd.push({ ...e, linea: maxLinea, original: e.original.trim() });
    existingNames.add(key);
    existingLineas.add(maxLinea);
  }
  if (!toAdd.length) return { type: "noop", skipped };
  return { type: "merged", entries: [...existing, ...toAdd], added: toAdd.length, skipped };
}

export function parseShoppingListJson(parsed: unknown): import("../types").ShoppingItem[] | null {
  const data = parsed as { items?: unknown };
  const items = Array.isArray(data?.items) ? data.items : [];
  const valid = items.filter(
    (item: unknown): item is import("../types").ShoppingItem =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as import("../types").ShoppingItem).id === "string" &&
      typeof (item as import("../types").ShoppingItem).original === "string" &&
      typeof (item as import("../types").ShoppingItem).linea === "number" &&
      typeof (item as import("../types").ShoppingItem).checked === "boolean",
  );
  return valid.length ? valid : null;
}
