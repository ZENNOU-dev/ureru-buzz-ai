"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface Props {
  previewUrl: string;
  onClose: () => void;
}

export function VideoPreviewModal({ previewUrl, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="relative w-[360px] max-h-[90vh] rounded-2xl overflow-hidden bg-black shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="aspect-[9/16]">
          <iframe
            src={previewUrl}
            className="w-full h-full"
            allow="autoplay"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
