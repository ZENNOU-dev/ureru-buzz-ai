import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.AD_ORCH_SUPABASE_URL;
const key = process.env.AD_ORCH_SUPABASE_KEY;

export const adOrchSupabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null;

/**
 * Supabase はデフォルト1000行制限。全件取得するためにページネーションで取得する。
 * buildQuery に渡す関数は毎回新しいクエリビルダーを返す必要がある。
 */
export async function fetchAllRows<T = Record<string, unknown>>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
