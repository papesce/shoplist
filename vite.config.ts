// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function shoplistApiPlugin() {
  return {
    name: "shoplist-api",
    configureServer(server) {
      // Lazy-load DB only when dev server starts (avoids loading better-sqlite3 during build)
      let db: typeof import("./server/db.mjs") | null = null;
      async function getDb() {
        if (!db) db = await import("./server/db.mjs");
        return db;
      }

      function json(res: import("node:http").ServerResponse, data: unknown, status = 200) {
        const body = JSON.stringify(data);
        res.statusCode = status;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Length", Buffer.byteLength(body));
        res.end(body);
      }

      function getBody(req: import("node:http").IncomingMessage): Promise<unknown> {
        return new Promise((resolve, reject) => {
          let data = "";
          req.on("data", (c) => (data += c));
          req.on("end", () => {
            if (!data) return resolve(undefined);
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
          req.on("error", reject);
        });
      }

      server.middlewares.use(async (req, res, next) => {
        const url = req.url || "";
        if (!url.startsWith("/api/")) return next();

        const pathname = url.split("?")[0];
        const method = (req.method || "GET").toUpperCase();
        const d = await getDb();

        try {
          if (pathname === "/api/quit" && method === "POST") {
            json(res, { ok: true });
            setTimeout(() => process.exit(0), 300);
            return;
          }
          if (pathname === "/api/health" && method === "GET") return json(res, { ok: true });

          if (pathname === "/api/entries" && method === "GET") return json(res, d.getEntries());
          if (pathname === "/api/entries" && method === "PUT") {
            const body = await getBody(req);
            if (!Array.isArray(body)) return json(res, { error: "expected array" }, 400);
            d.setEntries(body);
            return json(res, { ok: true, count: body.length });
          }

          if (pathname === "/api/shopping-list" && method === "GET")
            return json(res, d.getShoppingList());
          if (pathname === "/api/shopping-list" && method === "PUT") {
            const body = await getBody(req);
            if (!Array.isArray(body)) return json(res, { error: "expected array" }, 400);
            d.setShoppingList(body);
            return json(res, { ok: true, count: body.length });
          }

          if (pathname === "/api/history" && method === "GET") return json(res, d.getHistory());
          if (pathname === "/api/history" && method === "PUT") {
            const body = await getBody(req);
            if (!Array.isArray(body)) return json(res, { error: "expected array" }, 400);
            d.setHistory(body);
            return json(res, { ok: true, count: body.length });
          }

          if (pathname === "/api/migrate" && method === "POST") {
            const body = (await getBody(req)) as Record<string, unknown> | undefined;
            const { entries, shoppingList, history } = body || {};
            const migrated: Record<string, unknown> = {};
            if (Array.isArray(entries) && entries.length > 0) {
              const existing = d.getEntries();
              if (existing.length === 0) {
                d.setEntries(entries);
                migrated.entries = entries.length;
              } else migrated.entries = `skipped (db has ${existing.length})`;
            }
            if (Array.isArray(shoppingList) && shoppingList.length > 0) {
              const existing = d.getShoppingList();
              if (existing.length === 0) {
                d.setShoppingList(shoppingList);
                migrated.shoppingList = shoppingList.length;
              } else migrated.shoppingList = `skipped (db has ${existing.length})`;
            }
            if (Array.isArray(history) && history.length > 0) {
              const existing = d.getHistory();
              if (existing.length === 0) {
                d.setHistory(history);
                migrated.history = history.length;
              } else migrated.history = `skipped (db has ${existing.length})`;
            }
            return json(res, { ok: true, migrated });
          }

          return json(res, { error: "not found" }, 404);
        } catch (e) {
          console.error("[api-plugin]", e);
          return json(res, { error: String(e) }, 500);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), shoplistApiPlugin()],
});
