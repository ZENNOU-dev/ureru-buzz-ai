import type { NoteListItem } from "./soundcore/types.js";

/** Prefer record_time → start_time → created_at → updated_at; detect sec vs ms (DESIGN.md §7.2) */
export function toRecordedAtIso(note: NoteListItem): string {
  const raw = note.record_time ?? note.start_time ?? note.created_at ?? note.updated_at;
  if (raw == null || raw === 0) {
    return new Date().toISOString();
  }
  const n = Number(raw);
  const ms = n < 1e12 ? n * 1000 : n;
  return new Date(ms).toISOString();
}

export function formatDurationMs(ms: number | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return "";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m <= 0) return `${s}秒`;
  return `${m}分${s}秒`;
}

export function inferRecordTimeSeconds(note: NoteListItem): number {
  const raw = note.record_time ?? note.start_time ?? note.created_at ?? note.updated_at;
  if (raw == null) return Math.floor(Date.now() / 1000);
  const n = Number(raw);
  return n < 1e12 ? n : Math.floor(n / 1000);
}
