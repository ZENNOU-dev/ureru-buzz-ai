import type { AppConfig } from "../config.js";
import { logger } from "../logger.js";
import { appAudioPost } from "./client.js";
import { getSessionOrThrow } from "./session.js";
import type { NoteListItem } from "./types.js";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

function extractNoteList(parsed: unknown): NoteListItem[] {
  const r = asRecord(parsed);
  if (!r) return [];
  const raw = (r.list ?? r.notes ?? r.items ?? r.data_list ?? r.records) as unknown;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof (x as NoteListItem).note_id === "string") as NoteListItem[];
}

export async function listNotes(cfg: AppConfig, pageSize = 200): Promise<NoteListItem[]> {
  const session = getSessionOrThrow();
  const inner = {
    sort_by: "app_note_id",
    order: "desc",
    page: 1,
    page_size: pageSize,
  };
  const res = await appAudioPost("/app/audio/note/list", inner, session, cfg.SOUNDCORE_LANGUAGE);
  const list = extractNoteList(res);
  logger.info("Soundcore listNotes", { count: list.length });
  return list;
}

export function isTranscribed(note: NoteListItem): boolean {
  const v = note.is_trans;
  if (v === true) return true;
  if (typeof v === "number") return v !== 0;
  return false;
}

export function isRecycled(note: NoteListItem): boolean {
  return note.is_recycled === 1;
}
