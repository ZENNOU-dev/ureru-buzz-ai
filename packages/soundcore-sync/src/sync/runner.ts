import type { AppConfig } from "../config.js";
import { ensureNotionSummary } from "../ai/notionSummary.js";
import { extractNextActions } from "../ai/nextActions.js";
import { NotionWriter, type NotionRowPayload } from "../notion/writer.js";
import { formatDurationMs, inferRecordTimeSeconds, toRecordedAtIso } from "../time.js";
import { isRecycled, isTranscribed, listNotes } from "../soundcore/notes.js";
import { establishSession, setSession } from "../soundcore/session.js";
import { createTranscribeSummaryTask, querySummary, queryTranscription } from "../soundcore/transcribe.js";
import { logger } from "../logger.js";

export async function runSync(cfg: AppConfig): Promise<void> {
  setSession(null);
  await establishSession(cfg);

  const notes = await listNotes(cfg, 200);
  const writer = new NotionWriter(cfg);
  let generateCount = 0;

  for (const note of notes) {
    if (isRecycled(note)) continue;

    if (!isTranscribed(note)) {
      if (generateCount >= cfg.MAX_GENERATE_PER_RUN) continue;
      try {
        const dur = note.audio_duration ?? 3600_000;
        const rt = inferRecordTimeSeconds(note);
        await createTranscribeSummaryTask(cfg, note.note_id, dur, rt);
        generateCount++;
      } catch {
        /* logged in transcribe */
      }
      continue;
    }

    let transcript: string;
    try {
      transcript = await queryTranscription(cfg, note.note_id);
    } catch (e) {
      logger.warn("queryTranscription failed; skip note", {
        noteId: note.note_id,
        msg: e instanceof Error ? e.message : String(e),
      });
      continue;
    }
    if (!transcript.trim()) {
      logger.warn("Empty transcript; skip Notion upsert", { noteId: note.note_id });
      continue;
    }

    let summaryRaw = "";
    try {
      summaryRaw = await querySummary(cfg, note.note_id);
    } catch {
      summaryRaw = "";
    }

    const summary = await ensureNotionSummary(cfg, summaryRaw, transcript);
    const nextActions = await extractNextActions(cfg, summary, transcript);

    const title = (note.note_title || "").trim() || `Recording ${note.note_id.slice(0, 8)}`;
    const payload: NotionRowPayload = {
      title,
      summary,
      nextActions,
      recordedAtIso: toRecordedAtIso(note),
      durationText: formatDurationMs(note.audio_duration),
      soundcoreId: note.note_id,
      transcription: transcript,
    };

    await writer.upsertRow(payload);
  }

  setSession(null);
  logger.info("runSync finished", { notesSeen: notes.length, generateStarted: generateCount });
}
