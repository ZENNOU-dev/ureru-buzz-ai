export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotionError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "NOTION_ERROR", 502, details);
    this.name = "NotionError";
  }
}

export class NotionRateLimitError extends AppError {
  constructor() {
    super("Notion API rate limit exceeded", "NOTION_RATE_LIMIT", 429);
    this.name = "NotionRateLimitError";
  }
}

export class SupabaseError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "SUPABASE_ERROR", 502, details);
    this.name = "SupabaseError";
  }
}

export class AgentExecutionError extends AppError {
  constructor(agentName: string, message: string, details?: Record<string, unknown>) {
    super(`[${agentName}] ${message}`, "AGENT_EXECUTION_ERROR", 500, details);
    this.name = "AgentExecutionError";
  }
}

export class TenantNotFoundError extends AppError {
  constructor(tenantId: string) {
    super(`Tenant not found: ${tenantId}`, "TENANT_NOT_FOUND", 404);
    this.name = "TenantNotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", 400, details);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends AppError {
  constructor(service: string) {
    super(`Authentication failed for ${service}`, "AUTH_ERROR", 401);
    this.name = "AuthenticationError";
  }
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.statusCode === 429 || error.statusCode >= 500;
  }
  if (error instanceof Error && "status" in error) {
    const status = (error as { status: number }).status;
    return status === 429 || status >= 500;
  }
  return false;
}
