import Database from "better-sqlite3";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DB_PATH = join(ROOT, "base", "shoplist.db");
const SEED_JSON = join(ROOT, "base", "productos.json");

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS entries (
  linea INTEGER PRIMARY KEY,
  original TEXT NOT NULL,
  categoria TEXT
);
CREATE TABLE IF NOT EXISTS shopping_items (
  id TEXT PRIMARY KEY,
  linea INTEGER,
  original TEXT NOT NULL,
  checked INTEGER DEFAULT 0,
  categoria TEXT,
  sort_order INTEGER
);
CREATE TABLE IF NOT EXISTS saved_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  items_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

function seedIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) as c FROM entries").get().c;
  if (count > 0) return;
  if (!existsSync(SEED_JSON)) {
    console.log(`[db] No seed ${SEED_JSON}, starting empty`);
    return;
  }
  try {
    const raw = readFileSync(SEED_JSON, "utf-8");
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return;
    const insert = db.prepare("INSERT INTO entries (linea, original, categoria) VALUES (?, ?, ?)");
    const tx = db.transaction((items) => {
      for (const e of items) {
        insert.run(e.linea, e.original, e.categoria || null);
      }
    });
    tx(list);
    console.log(`[db] Seeded ${list.length} entries from productos.json`);
  } catch (e) {
    console.error("[db] Seed failed:", e.message);
  }
}

seedIfEmpty();

export function getEntries() {
  return db
    .prepare("SELECT linea, original, categoria FROM entries ORDER BY linea")
    .all()
    .map((r) => ({
      linea: r.linea,
      original: r.original,
      ...(r.categoria ? { categoria: r.categoria } : {}),
    }));
}

export function setEntries(entries) {
  const del = db.prepare("DELETE FROM entries");
  const ins = db.prepare("INSERT INTO entries (linea, original, categoria) VALUES (?, ?, ?)");
  const tx = db.transaction((list) => {
    del.run();
    for (const e of list) ins.run(e.linea, e.original, e.categoria || null);
  });
  tx(entries);
}

export function upsertEntry(entry) {
  db.prepare(
    "INSERT INTO entries (linea, original, categoria) VALUES (?, ?, ?) ON CONFLICT(linea) DO UPDATE SET original=excluded.original, categoria=excluded.categoria",
  ).run(entry.linea, entry.original, entry.categoria || null);
}

export function deleteEntry(linea) {
  db.prepare("DELETE FROM entries WHERE linea=?").run(linea);
}

export function getShoppingList() {
  const rows = db
    .prepare(
      "SELECT id, linea, original, checked, categoria FROM shopping_items ORDER BY sort_order, rowid",
    )
    .all();
  return rows.map((r) => ({
    id: r.id,
    linea: r.linea,
    original: r.original,
    checked: !!r.checked,
    ...(r.categoria ? { categoria: r.categoria } : {}),
  }));
}

export function setShoppingList(items) {
  const del = db.prepare("DELETE FROM shopping_items");
  const ins = db.prepare(
    "INSERT INTO shopping_items (id, linea, original, checked, categoria, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const tx = db.transaction((list) => {
    del.run();
    list.forEach((it, idx) =>
      ins.run(it.id, it.linea, it.original, it.checked ? 1 : 0, it.categoria || null, idx),
    );
  });
  tx(items);
}

export function getHistory() {
  const rows = db
    .prepare("SELECT id, name, date, items_json FROM saved_lists ORDER BY date DESC")
    .all();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    date: r.date,
    items: JSON.parse(r.items_json),
  }));
}

export function setHistory(lists) {
  const del = db.prepare("DELETE FROM saved_lists");
  const ins = db.prepare(
    "INSERT INTO saved_lists (id, name, date, items_json) VALUES (?, ?, ?, ?)",
  );
  const tx = db.transaction((list) => {
    del.run();
    for (const h of list) ins.run(h.id, h.name, h.date, JSON.stringify(h.items));
  });
  tx(lists);
}
