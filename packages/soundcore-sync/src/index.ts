import { createServer } from "node:http";
import { loadConfig } from "./config.js";
import { logger } from "./logger.js";
import { runSync } from "./sync/runner.js";

function unauthorized(res: import("node:http").ServerResponse): void {
  res.writeHead(401, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("unauthorized");
}

function startHttpServer(): void {
  const port = Number(process.env.PORT ?? 8080);
  const cronSecret = process.env.CRON_SECRET ?? "";

  const server = createServer(async (req, res) => {
    const path = req.url?.split("?")[0] ?? "";

    if (req.method === "GET" && (path === "/" || path === "/health")) {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("ok");
      return;
    }

    if (req.method === "POST" && path === "/run") {
      if (cronSecret) {
        const h = req.headers["x-cron-secret"];
        const sent = Array.isArray(h) ? h[0] : h;
        if (sent !== cronSecret) {
          unauthorized(res);
          return;
        }
      }
      try {
        const cfg = loadConfig();
        await runSync(cfg);
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("ok");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error("runSync failed", { msg });
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(msg.slice(0, 2000));
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("not found");
  });

  server.listen(port, () => {
    logger.info("HTTP server listening", { port, pathRun: "POST /run" });
  });
}

async function main(): Promise<void> {
  if (process.env.HTTP_MODE === "1") {
    startHttpServer();
    return;
  }
  const cfg = loadConfig();
  await runSync(cfg);
}

main().catch((e) => {
  logger.error("Fatal", { msg: e instanceof Error ? e.message : String(e) });
  process.exit(1);
});
