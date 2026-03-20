"use client";

import { useState, useCallback } from "react";
import { Image, AlertTriangle, Check } from "lucide-react";

export type Scene = {
  id: number;
  section: string;
  text: string;
  annotation?: string;
  regulationWarning?: string;
  regulationCheck?: boolean;
  materialName?: string;
  materialUrl?: string;
  telop?: string;
  cut?: string;
  me?: string;
  se?: string;
  revision?: string;
};

const SECTION_COLORS: Record<
  string,
  { border: string; badge: string; badgeText: string }
> = {
  フック: {
    border: "border-l-rose-500",
    badge: "bg-rose-100 text-rose-700",
    badgeText: "フック",
  },
  共感: {
    border: "border-l-blue-500",
    badge: "bg-blue-100 text-blue-700",
    badgeText: "共感",
  },
  コンセプト: {
    border: "border-l-emerald-500",
    badge: "bg-emerald-100 text-emerald-700",
    badgeText: "コンセプト",
  },
  商品紹介: {
    border: "border-l-amber-500",
    badge: "bg-amber-100 text-amber-700",
    badgeText: "商品紹介",
  },
  ベネフィット: {
    border: "border-l-purple-500",
    badge: "bg-purple-100 text-purple-700",
    badgeText: "ベネフィット",
  },
  オファー: {
    border: "border-l-orange-500",
    badge: "bg-orange-100 text-orange-700",
    badgeText: "オファー",
  },
  CTA: {
    border: "border-l-pink-500",
    badge: "bg-pink-100 text-pink-700",
    badgeText: "CTA",
  },
};

function EditableCell({
  value,
  onChange,
  className = "",
  multiline = false,
  placeholder = "",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = useCallback(() => {
    setEditing(false);
    if (draft !== value) onChange(draft);
  }, [draft, value, onChange]);

  if (editing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          className={`w-full text-xs leading-relaxed bg-white border border-blue-400 rounded px-1.5 py-1 outline-none resize-none ${className}`}
          rows={Math.max(3, draft.split("\n").length + 1)}
          placeholder={placeholder}
        />
      );
    }
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={`w-full text-xs bg-white border border-blue-400 rounded px-1.5 py-1 outline-none ${className}`}
        placeholder={placeholder}
      />
    );
  }

  return (
    <div
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={`text-xs leading-relaxed whitespace-pre-wrap cursor-text rounded px-1.5 py-1 min-h-[28px] border border-transparent hover:border-zinc-300 transition-colors ${className} ${!value ? "text-zinc-300 italic" : "text-zinc-700"}`}
    >
      {value || placeholder || "ー"}
    </div>
  );
}

export function SceneRow({
  scene,
  onChange,
}: {
  scene: Scene;
  onChange: (updated: Scene) => void;
}) {
  const colors = SECTION_COLORS[scene.section] || SECTION_COLORS["商品紹介"];

  const update = (field: keyof Scene, value: string | boolean) => {
    onChange({ ...scene, [field]: value });
  };

  return (
    <div
      className={`flex items-stretch bg-white border border-zinc-200 rounded-lg overflow-hidden border-l-4 ${colors.border} hover:shadow-sm transition-shadow`}
    >
      {/* # + Section badge */}
      <div className="flex flex-col items-center justify-start gap-1 px-2 py-2.5 w-12 shrink-0 border-r border-zinc-100">
        <span className="text-[11px] font-bold text-zinc-400">
          {String(scene.id).padStart(2, "0")}
        </span>
        <span
          className={`text-[9px] font-semibold px-1 py-0.5 rounded ${colors.badge} leading-none whitespace-nowrap`}
        >
          {colors.badgeText}
        </span>
      </div>

      {/* テキスト - widest */}
      <div className="w-[200px] shrink-0 border-r border-zinc-100 p-1.5">
        <EditableCell
          value={scene.text}
          onChange={(v) => update("text", v)}
          multiline
          placeholder="テキスト"
        />
      </div>

      {/* 注釈 */}
      <div className="w-[120px] shrink-0 border-r border-zinc-100 p-1.5">
        <EditableCell
          value={scene.annotation || ""}
          onChange={(v) => update("annotation", v)}
          multiline
          placeholder="注釈"
        />
      </div>

      {/* レギュ警告 (AI auto) */}
      <div className="w-[80px] shrink-0 border-r border-zinc-100 p-1.5 flex items-start justify-center">
        {scene.regulationWarning ? (
          <div className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">
            <AlertTriangle className="w-3 h-3" />
            <span>{scene.regulationWarning}</span>
          </div>
        ) : (
          <span className="text-[10px] text-zinc-300">AI自動</span>
        )}
      </div>

      {/* レギュチェック */}
      <div className="w-[50px] shrink-0 border-r border-zinc-100 p-1.5 flex items-start justify-center">
        <button
          onClick={() => update("regulationCheck", !scene.regulationCheck)}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            scene.regulationCheck
              ? "bg-emerald-500 border-emerald-500 text-white"
              : "border-zinc-300 text-transparent hover:border-zinc-400"
          }`}
        >
          <Check className="w-3 h-3" />
        </button>
      </div>

      {/* 素材名 + サムネ */}
      <div className="w-[110px] shrink-0 border-r border-zinc-100 p-1.5">
        <EditableCell
          value={scene.materialName || ""}
          onChange={(v) => update("materialName", v)}
          placeholder="素材名"
        />
        <div className="mt-1 w-full h-14 bg-zinc-100 rounded flex items-center justify-center">
          <Image className="w-5 h-5 text-zinc-300" />
        </div>
      </div>

      {/* テロップ */}
      <div className="w-[160px] shrink-0 border-r border-zinc-100 p-1.5">
        <EditableCell
          value={scene.telop || ""}
          onChange={(v) => update("telop", v)}
          multiline
          placeholder="テロップ"
        />
      </div>

      {/* カット */}
      <div className="w-[70px] shrink-0 border-r border-zinc-100 p-1.5">
        <EditableCell
          value={scene.cut || ""}
          onChange={(v) => update("cut", v)}
          placeholder="カット"
        />
      </div>

      {/* ME */}
      <div className="w-[60px] shrink-0 border-r border-zinc-100 p-1.5">
        <EditableCell
          value={scene.me || ""}
          onChange={(v) => update("me", v)}
          placeholder="ME"
        />
      </div>

      {/* SE */}
      <div className="w-[60px] shrink-0 border-r border-zinc-100 p-1.5">
        <EditableCell
          value={scene.se || ""}
          onChange={(v) => update("se", v)}
          placeholder="SE"
        />
      </div>

      {/* 修正依頼 */}
      <div className="w-[140px] shrink-0 p-1.5">
        <EditableCell
          value={scene.revision || ""}
          onChange={(v) => update("revision", v)}
          multiline
          placeholder="修正依頼"
        />
      </div>
    </div>
  );
}

export function SectionDivider({ label }: { label: string }) {
  const colors = SECTION_COLORS[label];
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px bg-zinc-200" />
      <span
        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${colors ? colors.badge : "bg-zinc-100 text-zinc-500"}`}
      >
        {label}
      </span>
      <div className="flex-1 h-px bg-zinc-200" />
    </div>
  );
}

export function SceneColumnHeader() {
  return (
    <div className="flex items-stretch bg-zinc-50 border border-zinc-200 rounded-lg text-[10px] font-semibold text-zinc-500 uppercase tracking-wider sticky top-0 z-10">
      <div className="w-12 shrink-0 px-2 py-2 text-center border-r border-zinc-200">
        #
      </div>
      <div className="w-[200px] shrink-0 px-2 py-2 border-r border-zinc-200">
        テキスト
      </div>
      <div className="w-[120px] shrink-0 px-2 py-2 border-r border-zinc-200">
        注釈
      </div>
      <div className="w-[80px] shrink-0 px-2 py-2 border-r border-zinc-200 text-center">
        レギュ警告
      </div>
      <div className="w-[50px] shrink-0 px-2 py-2 border-r border-zinc-200 text-center">
        確認
      </div>
      <div className="w-[110px] shrink-0 px-2 py-2 border-r border-zinc-200">
        素材
      </div>
      <div className="w-[160px] shrink-0 px-2 py-2 border-r border-zinc-200">
        テロップ
      </div>
      <div className="w-[70px] shrink-0 px-2 py-2 border-r border-zinc-200">
        カット
      </div>
      <div className="w-[60px] shrink-0 px-2 py-2 border-r border-zinc-200">
        ME
      </div>
      <div className="w-[60px] shrink-0 px-2 py-2 border-r border-zinc-200">
        SE
      </div>
      <div className="w-[140px] shrink-0 px-2 py-2">修正依頼</div>
    </div>
  );
}
