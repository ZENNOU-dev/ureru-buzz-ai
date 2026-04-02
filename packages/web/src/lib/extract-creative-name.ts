/**
 * ad_daily_conversions の行から creative_name を取得する。
 * creative_id が紐付いている場合はビューの creative_name を使い、
 * NULL の場合は ad_name の命名規則からCR名を抽出する。
 *
 * 広告名パターン: {prefix}/{CR名}/{記事LP名}/{担当者}/{案件名}/{日付}
 * 例: meta010/渋谷_まだ大丈夫_A/羽田_若年改善_男性ホルモン/羽田/REDEN/2026-03-20
 *
 * 注意: Meta APIのデータはNFD (濁点分離) で格納されることがあるため、
 * NFC正規化して返す。
 */
export function resolveCreativeName(row: Record<string, unknown>): string | null {
  const raw = row.creative_name as string | null | undefined;
  if (raw) return raw.normalize("NFC");

  const adName = row.ad_name as string | undefined;
  if (!adName) return null;

  const parts = adName.split("/");
  if (parts.length >= 2 && parts[1].trim()) {
    return parts[1].normalize("NFC");
  }
  return null;
}
