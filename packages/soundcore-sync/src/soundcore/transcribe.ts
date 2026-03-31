import type { AppConfig } from "../config.js";
import { logger } from "../logger.js";
import { appAudioPost } from "./client.js";
import { getSessionOrThrow } from "./session.js";

export async function createTranscribeSummaryTask(
  cfg: AppConfig,
  noteId: string,
  audioDurationMs: number,
  recordTimeSec: number,
): Promise<void> {
  const session = getSessionOrThrow();
  const inner = {
    audio_duration: Math.max(1, Math.floor(audioDurationMs / 1000) || 3600),
    record_time: recordTimeSec,
    template_id: "auto",
    language: cfg.SOUNDCORE_LANGUAGE,
    aes_key: null,
    diarization: true,
    key_prefixs: [] as string[],
    note_id: noteId,
    model_id: "",
  };
  try {
    await appAudioPost("/app/audio/transcribe/create_transcribe_summary_task", inner, session, cfg.SOUNDCORE_LANGUAGE);
    logger.info("Started transcribe task", { noteId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn("createTranscribeSummaryTask skipped/failed", { noteId, msg });
    throw e;
  }
}

export async function queryTranscription(cfg: AppConfig, noteId: string): Promise<string> {
  const session = getSessionOrThrow();
  const inner = { note_id: noteId };
  const res = await appAudioPost("/app/audio/note/query_trans", inner, session, cfg.SOUNDCORE_LANGUAGE);
  const r = res as Record<string, unknown>;
  const text = String(
    r.transcription ?? r.transcript ?? r.text ?? r.content ?? r.data ?? "",
  );
  return text;
}

export async function querySummary(cfg: AppConfig, noteId: string): Promise<string> {
  const session = getSessionOrThrow();
  const inner = { note_id: noteId };
  const res = await appAudioPost("/app/audio/note/query_summary", inner, session, cfg.SOUNDCORE_LANGUAGE);
  const r = res as Record<string, unknown>;
  const s = String(r.summary ?? r.summary_text ?? r.text ?? r.content ?? "");
  return s;
}
