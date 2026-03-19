import PQueue from "p-queue";

const limiters = new Map<string, PQueue>();

/**
 * 名前付きレートリミッターを取得（シングルトン）
 * @param name リミッター名（例: "notion", "meta-ads"）
 * @param concurrency 同時実行数
 * @param intervalMs インターバル（ms）
 */
export function getRateLimiter(
  name: string,
  concurrency: number,
  intervalMs: number,
): PQueue {
  const existing = limiters.get(name);
  if (existing) return existing;

  const queue = new PQueue({
    concurrency,
    interval: intervalMs,
    intervalCap: concurrency,
  });

  limiters.set(name, queue);
  return queue;
}

/**
 * Notion API用レートリミッター（3req/秒）
 */
export function getNotionLimiter(): PQueue {
  return getRateLimiter("notion", 3, 1000);
}

/**
 * レートリミッター付きで関数を実行
 */
export async function withRateLimit<T>(
  limiterName: string,
  concurrency: number,
  intervalMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const limiter = getRateLimiter(limiterName, concurrency, intervalMs);
  return limiter.add(fn) as Promise<T>;
}

/**
 * テスト用: 全リミッターをクリア
 */
export function clearAllLimiters(): void {
  for (const queue of limiters.values()) {
    queue.clear();
  }
  limiters.clear();
}
