import { describe, it, expect, afterEach } from "vitest";
import { getRateLimiter, getNotionLimiter, clearAllLimiters } from "../utils/rate-limiter.js";

afterEach(() => {
  clearAllLimiters();
});

describe("getRateLimiter", () => {
  it("should return same instance for same name", () => {
    const a = getRateLimiter("test", 3, 1000);
    const b = getRateLimiter("test", 3, 1000);
    expect(a).toBe(b);
  });

  it("should return different instances for different names", () => {
    const a = getRateLimiter("test-a", 3, 1000);
    const b = getRateLimiter("test-b", 3, 1000);
    expect(a).not.toBe(b);
  });
});

describe("getNotionLimiter", () => {
  it("should return a limiter", () => {
    const limiter = getNotionLimiter();
    expect(limiter).toBeDefined();
    expect(limiter.concurrency).toBe(3);
  });
});

describe("clearAllLimiters", () => {
  it("should clear all cached limiters", () => {
    const a = getRateLimiter("test", 3, 1000);
    clearAllLimiters();
    const b = getRateLimiter("test", 3, 1000);
    expect(a).not.toBe(b);
  });
});
