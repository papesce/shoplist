import express from "express";
import cors from "cors";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import {
  getEntries,
  setEntries,
  getShoppingList,
  setShoppingList,
  getHistory,
  setHistory,
} from "./db.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIST = join(ROOT, "dist");
const PORT = process.env.PORT ? Number(process.env.PORT) : 4173;

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// API
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/entries", (_req, res) => res.json(getEntries()));
app.put("/api/entries", (req, res) => {
  const list = req.body;
  if (!Array.isArray(list)) return res.status(400).json({ error: "expected array" });
  // basic validation
  for (const e of list)
    if (typeof e.linea !== "number" || typeof e.original !== "string")
      return res.status(400).json({ error: "invalid entry" });
  setEntries(list);
  res.json({ ok: true, count: list.length });
});

app.get("/api/shopping-list", (_req, res) => res.json(getShoppingList()));
app.put("/api/shopping-list", (req, res) => {
  const list = req.body;
  if (!Array.isArray(list)) return res.status(400).json({ error: "expected array" });
  setShoppingList(list);
  res.json({ ok: true, count: list.length });
});

app.get("/api/history", (_req, res) => res.json(getHistory()));
app.put("/api/history", (req, res) => {
  const list = req.body;
  if (!Array.isArray(list)) return res.status(400).json({ error: "expected array" });
  setHistory(list);
  res.json({ ok: true, count: list.length });
});

app.post("/api/migrate", (req, res) => {
  const { entries, shoppingList, history } = req.body || {};
  const migrated = {};
  if (Array.isArray(entries) && entries.length > 0) {
    const existing = getEntries();
    if (existing.length === 0) {
      setEntries(entries);
      migrated.entries = entries.length;
    } else {
      migrated.entries = `skipped (db has ${existing.length})`;
    }
  }
  if (Array.isArray(shoppingList) && shoppingList.length > 0) {
    const existing = getShoppingList();
    if (existing.length === 0) {
      setShoppingList(shoppingList);
      migrated.shoppingList = shoppingList.length;
    } else {
      migrated.shoppingList = `skipped (db has ${existing.length})`;
    }
  }
  if (Array.isArray(history) && history.length > 0) {
    const existing = getHistory();
    if (existing.length === 0) {
      setHistory(history);
      migrated.history = history.length;
    } else {
      migrated.history = `skipped (db has ${existing.length})`;
    }
  }
  res.json({ ok: true, migrated });
});

// Serve static dist (for Shoplist.app preview)
if (existsSync(DIST)) {
  app.use(express.static(DIST));
  // SPA fallback - must be after /api routes, use middleware not route
  app.use((req, res) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ error: "not found" });
    res.sendFile(join(DIST, "index.html"));
  });
} else {
  app.get("/", (_req, res) => res.json({ ok: true, msg: "Run npm run build first" }));
}

const server = app.listen(PORT, "127.0.0.1", () => {
  console.log(`[server] Shoplist API + static on http://127.0.0.1:${PORT}`);
  console.log(`[server] DB: base/shoplist.db`);
});
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[server] ✘ Port ${PORT} already in use.`);
    console.error(
      `[server] Preview/dev is already running on :${PORT}. Run ./shopier.sh stop to free it, then retry.`,
    );
    process.exit(1);
  }
  throw err;
});
