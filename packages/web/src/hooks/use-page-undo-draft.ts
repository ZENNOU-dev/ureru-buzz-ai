"use client";

import { useCallback } from "react";
import type { SetStateAction } from "react";
import { useUndoableState, type UseUndoableStateOptions } from "@/hooks/use-undoable-state";
import { useBindPageUndo } from "@/components/providers/global-undo-provider";

/**
 * ページ用: ドラフトオブジェクト + setField + グローバル Cmd+Z/Cmd+Shift+Z 登録
 */
export function usePageUndoDraft<T extends Record<string, unknown>>(
  initial: () => T,
  options?: UseUndoableStateOptions,
): readonly [
  T,
  <K extends keyof T>(key: K, value: SetStateAction<T[K]>) => void,
  (update: T | ((prev: T) => T)) => void,
] {
  const [draft, setDraft, { undo, redo }] = useUndoableState(initial, options);
  useBindPageUndo(undo, redo);
  const setField = useCallback(
    <K extends keyof T>(key: K, value: SetStateAction<T[K]>) => {
      setDraft((s) => ({
        ...s,
        [key]: typeof value === "function" ? (value as (p: T[K]) => T[K])(s[key]) : value,
      }));
    },
    [setDraft],
  );
  return [draft, setField, setDraft] as const;
}
