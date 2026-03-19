export interface AgentLog {
  timestamp: string;
  level: "info" | "warn" | "error";
  tenantId?: string;
  agentName?: string;
  phase?: string;
  action: string;
  durationMs?: number;
  inputSummary?: string;
  outputSummary?: string;
  error?: string;
}

type LogLevel = "info" | "warn" | "error";

class Logger {
  private context: Partial<AgentLog> = {};

  withContext(ctx: Partial<AgentLog>): Logger {
    const child = new Logger();
    child.context = { ...this.context, ...ctx };
    return child;
  }

  info(action: string, data?: Record<string, unknown>): void {
    this.log("info", action, data);
  }

  warn(action: string, data?: Record<string, unknown>): void {
    this.log("warn", action, data);
  }

  error(action: string, error?: unknown, data?: Record<string, unknown>): void {
    const errorMessage = error instanceof Error ? error.message : String(error ?? "");
    this.log("error", action, { ...data, error: errorMessage });
  }

  private log(level: LogLevel, action: string, data?: Record<string, unknown>): void {
    const entry: AgentLog = {
      timestamp: new Date().toISOString(),
      level,
      action,
      ...this.context,
      ...(data?.error ? { error: String(data.error) } : {}),
    };

    const output = JSON.stringify(entry);

    switch (level) {
      case "error":
        console.error(output);
        break;
      case "warn":
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }
}

export const logger = new Logger();
