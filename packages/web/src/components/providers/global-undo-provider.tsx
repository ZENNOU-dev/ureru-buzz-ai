"use client";

import { createContext, useContext, useEffect, useRef } from "react";

type UndoApi = {
  undo: () => boolean;
  redo: () => boolean;
};

const defaultApi: UndoApi = {
  undo: () => false,
  redo: () => false,
};

const GlobalUndoContext = createContext<React.MutableRefObject<UndoApi> | null>(null);

/**
 * アクティブページが useBindPageUndo で登録した Undo/Redo を
 * Cmd+Z / Cmd+Shift+Z（Windows は Ctrl）で実行する。
 * `data-undo-ignore` 内では無視（フローティングチャット等）。
 */
export function GlobalUndoProvider({ children }: { children: React.ReactNode }) {
  const apiRef = useRef<UndoApi>(defaultApi);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest?.("[data-undo-ignore]")) return;

      if (e.key === "z" || e.key === "Z") {
        if (e.shiftKey) {
          if (apiRef.current.redo()) {
            e.preventDefault();
            e.stopPropagation();
          }
          return;
        }
        if (apiRef.current.undo()) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      // Windows 等: Ctrl+Y で Redo
      if ((e.key === "y" || e.key === "Y") && e.ctrlKey && !e.metaKey) {
        if (apiRef.current.redo()) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return <GlobalUndoContext.Provider value={apiRef}>{children}</GlobalUndoContext.Provider>;
}

/** マウント中のページがグローバル Cmd+Z の対象になる */
export function useBindPageUndo(undo: () => boolean, redo: () => boolean) {
  const ctx = useContext(GlobalUndoContext);
  if (!ctx) return;
  ctx.current.undo = undo;
  ctx.current.redo = redo;
}
