import { describe, it, expect, vi } from "vitest";
import { withRetry } from "../utils/retry.js";
import { AppError } from "../errors/index.js";

describe("withRetry", () => {
  it("should return result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on retryable error and succeed", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new AppError("rate limit", "RATE_LIMIT", 429))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, { initialDelayMs: 10 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should throw after max attempts", async () => {
    const fn = vi.fn().mockRejectedValue(new AppError("server error", "SERVER", 500));

    await expect(
      withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 }),
    ).rejects.toThrow("server error");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should not retry on non-retryable error (401)", async () => {
    const fn = vi.fn().mockRejectedValue(new AppError("auth error", "AUTH", 401));

    await expect(
      withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 }),
    ).rejects.toThrow("auth error");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should use exponential backoff", async () => {
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation((fn: any, ms?: number) => {
      if (ms && ms > 0) delays.push(ms);
      return originalSetTimeout(fn, 0);
    });

    const fnMock = vi.fn()
      .mockRejectedValueOnce(new AppError("err", "E", 500))
      .mockRejectedValueOnce(new AppError("err", "E", 500))
      .mockResolvedValue("ok");

    await withRetry(fnMock, { maxAttempts: 3, initialDelayMs: 1000 });

    expect(delays[0]).toBe(1000);
    expect(delays[1]).toBe(2000);

    vi.restoreAllMocks();
  });
});
