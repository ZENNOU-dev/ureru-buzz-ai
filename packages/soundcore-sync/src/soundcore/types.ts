/** Subset of Soundcore list API item (DESIGN.md §10.1) */
export interface NoteListItem {
  note_id: string;
  note_title?: string;
  audio_duration?: number;
  is_trans?: boolean | number;
  is_recycled?: number;
  updated_at?: number;
  record_time?: number;
  created_at?: number;
  start_time?: number;
}

export interface SoundcoreListResponse {
  list?: NoteListItem[];
  notes?: NoteListItem[];
  items?: NoteListItem[];
}

/** Generic API envelope (observed shape; field names may vary) */
export interface SoundcoreApiEnvelope {
  code: number;
  msg?: string;
  data?: string;
  signature?: string;
  randomStr?: string;
  randomField?: string;
}
