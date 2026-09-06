#!/usr/bin/env node
import { execSync } from "node:child_process";

const PORT_API = Number(process.env.PORT || 4173);
const PORT_VITE = 5173;

function isPortInUse(port) {
  try {
    execSync(`lsof -ti :${port}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function hasPidfile(path) {
  try {
    const pid = execSync(`cat ${path} 2>/dev/null`, { encoding: "utf-8" }).trim();
    if (!pid) return false;
    execSync(`kill -0 ${pid} 2>/dev/null`);
    return true;
  } catch {
    return false;
  }
}

const mode = process.argv[2]?.replace(/^--?/, "") || ""; // dev | preview | server
const force = process.argv.includes("--force");

function fail(msg) {
  console.error(`\x1b[31m✘ ${msg}\x1b[0m`);
  process.exit(1);
}

if (mode === "dev") {
  if (!force && (hasPidfile("/tmp/shoplist-preview.pid") || isPortInUse(PORT_API))) {
    fail(
      `Preview is running on :${PORT_API}. Stop preview before starting dev.\n  → ./shopier.sh stop  (or ./scripts/stop-preview.sh)`,
    );
  }
} else if (mode === "preview" || mode === "server") {
  if (!force && isPortInUse(PORT_VITE)) {
    fail(
      `Dev mode is running on :${PORT_VITE}. Stop dev (Ctrl+C) before starting preview.\n  → lsof -ti :${PORT_VITE} | xargs kill -9  (or close the dev terminal)`,
    );
  }
  // preview vs preview is handled by EADDRINUSE on :4173, but also give friendly message
  if (!force && (isPortInUse(PORT_API) || hasPidfile("/tmp/shoplist-preview.pid"))) {
    // Allow launch-preview.sh to handle stale preview with its own kill, but npm run preview/server should be strict
    // Only fail if health check succeeds (real server running)
    try {
      const r = await fetch(`http://127.0.0.1:${PORT_API}/api/health`, {
        signal: AbortSignal.timeout(800),
      });
      if (r.ok)
        fail(
          `Preview/server already running on :${PORT_API}. Run ./shopier.sh stop before starting preview.`,
        );
    } catch {
      /* port in use but not our server - still warn */
      if (isPortInUse(PORT_API))
        fail(
          `Something is already listening on :${PORT_API}. Run ./shopier.sh stop or free the port before starting preview.`,
        );
    }
  }
}
