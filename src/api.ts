import type { Entry, ShoppingItem, SavedList } from "./types";

async function getJSON<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}
async function putJSON(url: string, data: unknown): Promise<boolean> {
  try {
    const r = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export const api = {
  getEntries: () => getJSON<Entry[]>("/api/entries"),
  setEntries: (v: Entry[]) => putJSON("/api/entries", v),
  getShoppingList: () => getJSON<ShoppingItem[]>("/api/shopping-list"),
  setShoppingList: (v: ShoppingItem[]) => putJSON("/api/shopping-list", v),
  getHistory: () => getJSON<SavedList[]>("/api/history"),
  setHistory: (v: SavedList[]) => putJSON("/api/history", v),
  migrate: (payload: { entries?: Entry[]; shoppingList?: ShoppingItem[]; history?: SavedList[] }) =>
    fetch("/api/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => r.ok)
      .catch(() => false),
};
