import { describe, it, expect } from "vitest";
import {
  AppError,
  NotionError,
  NotionRateLimitError,
  SupabaseError,
  TenantNotFoundError,
  ValidationError,
  AuthenticationError,
  isRetryableError,
} from "../errors/index.js";

describe("isRetryableError", () => {
  it("should retry on 429", () => {
    expect(isRetryableError(new AppError("rate limit", "RL", 429))).toBe(true);
  });

  it("should retry on 500", () => {
    expect(isRetryableError(new AppError("server error", "SE", 500))).toBe(true);
  });

  it("should retry on 502", () => {
    expect(isRetryableError(new NotionError("bad gateway"))).toBe(true);
    expect(isRetryableError(new SupabaseError("bad gateway"))).toBe(true);
  });

  it("should not retry on 401", () => {
    expect(isRetryableError(new AuthenticationError("test"))).toBe(false);
  });

  it("should not retry on 400", () => {
    expect(isRetryableError(new ValidationError("bad input"))).toBe(false);
  });

  it("should not retry on 404", () => {
    expect(isRetryableError(new TenantNotFoundError("xxx"))).toBe(false);
  });

  it("should not retry on generic Error", () => {
    expect(isRetryableError(new Error("generic"))).toBe(false);
  });

  it("should handle status property on plain objects", () => {
    const err = Object.assign(new Error("rate limit"), { status: 429 });
    expect(isRetryableError(err)).toBe(true);
  });
});

describe("NotionRateLimitError", () => {
  it("should have correct properties", () => {
    const err = new NotionRateLimitError();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe("NOTION_RATE_LIMIT");
    expect(err.name).toBe("NotionRateLimitError");
  });
});
