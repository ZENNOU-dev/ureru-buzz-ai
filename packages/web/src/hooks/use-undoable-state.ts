"use client";

import { useCallback, useRef, useState } from "react";

type Bundle<T> = { past: T[]; present: T; future: T[] };

export type UseUndoableStateOptions = {
  maxHistory?: number;
  /** 連続入力を1つのUndoにまとめる（ms）。新しいバーストは操作が途切れてから開始 */
  mergeWindowMs?: number;
};

function cloneState<T>(v: T): T {
  try {
    return structuredClone(v);
  } catch {
    return JSON.parse(JSON.stringify(v)) as T;
  }
}

/**
 * スナップショット履歴付き state。Cmd+Z は GlobalUndoProvider + useBindPageUndo と併用。
 */
export function useUndoableState<T>(
  initialState: T | (() => T),
  options?: UseUndoableStateOptions,
): readonly [T, (update: T | ((prev: T) => T)) => void, { undo: () => boolean; redo: () => boolean }] {
  const maxHistory = options?.maxHistory ?? 80;
  const mergeWindowMs = options?.mergeWindowMs ?? 420;

  const [bundle, setBundle] = useState<Bundle<T>>(() => ({
    past: [],
    present: typeof initialState === "function" ? (initialState as () => T)() : initialState,
    future: [],
  }));

  const bundleRef = useRef(bundle);
  bundleRef.current = bundle;
  const mergeAnchor = useRef(0);

  const setState = useCallback(
    (update: T | ((prev: T) => T)) => {
      setBundle((b) => {
        const prev = b.present;
        const next = typeof update === "function" ? (update as (p: T) => T)(prev) : update;
        if (Object.is(prev, next)) return b;
        const now = Date.now();
        const inMergeBurst = now - mergeAnchor.current < mergeWindowMs && b.past.length > 0;
        if (!inMergeBurst) {
          mergeAnchor.current = now;
          let newPast = [...b.past, cloneState(prev)];
          if (newPast.length > maxHistory) newPast = newPast.slice(-maxHistory);
          return { past: newPast, present: next, future: [] };
        }
        mergeAnchor.current = now;
        return { ...b, present: next };
      });
    },
    [maxHistory, mergeWindowMs],
  );

  const undo = useCallback((): boolean => {
    const b = bundleRef.current;
    if (!b.past.length) return false;
    const prev = b.past[b.past.length - 1]!;
    const nextBundle: Bundle<T> = {
      past: b.past.slice(0, -1),
      present: prev,
      future: [cloneState(b.present), ...b.future],
    };
    bundleRef.current = nextBundle;
    setBundle(nextBundle);
    return true;
  }, []);

  const redo = useCallback((): boolean => {
    const b = bundleRef.current;
    if (!b.future.length) return false;
    const head = b.future[0]!;
    const nextBundle: Bundle<T> = {
      past: [...b.past, cloneState(b.present)],
      present: head,
      future: b.future.slice(1),
    };
    bundleRef.current = nextBundle;
    setBundle(nextBundle);
    return true;
  }, []);

  return [bundle.present, setState, { undo, redo }] as const;
}
