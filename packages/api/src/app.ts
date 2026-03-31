import { Hono } from "hono";

/**
 * REST API（Hono）。エントリは server.ts。
 */
export const app = new Hono();

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "ureru-buzz-ai-api",
    time: new Date().toISOString(),
  }),
);

app.get("/", (c) =>
  c.json({
    name: "ureru-buzz-ai-api",
    health: "/health",
  }),
);
