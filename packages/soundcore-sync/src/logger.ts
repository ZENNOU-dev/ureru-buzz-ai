type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function threshold(): number {
  const l = (process.env.LOG_LEVEL ?? "info").toLowerCase() as Level;
  return LEVEL_ORDER[l] ?? LEVEL_ORDER.info;
}

function log(level: Level, msg: string, extra?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < threshold()) return;
  const line = extra ? `${msg} ${JSON.stringify(extra)}` : msg;
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(`[soundcore-sync][${level}] ${line}`);
}

export const logger = {
  debug: (m: string, e?: Record<string, unknown>) => log("debug", m, e),
  info: (m: string, e?: Record<string, unknown>) => log("info", m, e),
  warn: (m: string, e?: Record<string, unknown>) => log("warn", m, e),
  error: (m: string, e?: Record<string, unknown>) => log("error", m, e),
};
