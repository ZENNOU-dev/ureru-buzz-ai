"use client";

import { use, useState, useRef } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { VoiceInputButton } from "@/components/voice-input-button";

// ─── Types ────────────────────────────────────────────
type Appeal = {
  id: number;
  name: string;
  who: string;
  what: string;
  why: string;
  assignee: string;
  hypothesis: string;
  funcValue: string;
  benefit: string;
  benefitScene: string;
  noBenefitStatus: string;
  painDesire: string;
  desireFunnel: string;
  infoBarrier: string;
  competitor: string;
  whoState: string;
  whoAwareness: string;
  whoConstraint: string;
};

// ─── Constants ────────────────────────────────────────
const ASSIGNEES = ["横野", "渋谷", "松永"];
const HYPOTHESES = ["機能訴求", "便益訴求", "情緒訴求", "体験訴求"];
const FUNNELS = ["認知", "興味", "検討", "行動"];

let _nextId = 10;
function nextId() { return _nextId++; }

function emptyAppeal(): Appeal {
  return {
    id: nextId(), name: "", who: "", what: "", why: "", assignee: "横野",
    hypothesis: "便益訴求", funcValue: "", benefit: "", benefitScene: "",
    noBenefitStatus: "", painDesire: "", desireFunnel: "興味",
    infoBarrier: "", competitor: "", whoState: "", whoAwareness: "", whoConstraint: "",
  };
}

// ─── Sample Data ──────────────────────────────────────
const INITIAL: Appeal[] = [
  {
    id: 1, name: "AI活用型訴求",
    who: "会社員で給料・環境に不満を持つ20〜30代",
    what: "AI活用フリーランスとして収入アップ",
    why: "AIスキル×SNS運用で未経験からでも短期間で成果",
    assignee: "横野", hypothesis: "便益訴求",
    funcValue: "AIツール提供+SNS運用スキル", benefit: "短期間での収入アップ",
    benefitScene: "本業の合間にAIで副収入を得る",
    noBenefitStatus: "給料だけでは将来が不安",
    painDesire: "収入を上げたいが方法がわからない",
    desireFunnel: "興味",
    infoBarrier: "AIは難しそうというイメージ",
    competitor: "プログラミングスクール、副業コンサル",
    whoState: "現職に不満を感じている",
    whoAwareness: "AI副業の存在を知らない",
    whoConstraint: "時間と初期費用が限られている",
  },
  {
    id: 2, name: "AIフリーランス訴求",
    who: "副業・フリーランスに興味がある会社員",
    what: "実践的なAIツール提供+連続起業家監修",
    why: "実践的なAIツール提供+連続起業家",
    assignee: "横野", hypothesis: "機能訴求",
    funcValue: "実践特化AIツール群", benefit: "最短3ヶ月で独立可能",
    benefitScene: "", noBenefitStatus: "", painDesire: "",
    desireFunnel: "検討", infoBarrier: "", competitor: "",
    whoState: "独立を検討中", whoAwareness: "フリーランスに興味あり", whoConstraint: "",
  },
  {
    id: 3, name: "副業スタート訴求",
    who: "副業を始めたいが何から始めればいいかわからない20〜40代",
    what: "AIを使った副業の始め方を体系的に学べる",
    why: "3ヶ月で成果を出した実績",
    assignee: "松永", hypothesis: "体験訴求",
    funcValue: "体系的カリキュラム", benefit: "迷わず副業をスタートできる",
    benefitScene: "", noBenefitStatus: "", painDesire: "",
    desireFunnel: "認知", infoBarrier: "", competitor: "",
    whoState: "副業未経験", whoAwareness: "何から始めるかわからない", whoConstraint: "",
  },
];

// ─── Section / Row definitions ────────────────────────
type RowDef = {
  key: keyof Appeal | "_no";
  label: string;
  type: "auto" | "text" | "textarea" | "dropdown";
  options?: string[];
};

type SectionDef = {
  title: string;
  color: string;       // tailwind bg class for section header
  textColor: string;
  rows: RowDef[];
};

const SECTIONS: SectionDef[] = [
  {
    title: "訴求",
    color: "bg-blue-100",
    textColor: "text-blue-800",
    rows: [
      { key: "_no", label: "訴求No.", type: "auto" },
      { key: "name", label: "訴求名", type: "text" },
      { key: "who", label: "WHO", type: "textarea" },
      { key: "what", label: "WHAT", type: "textarea" },
      { key: "why", label: "WHY", type: "textarea" },
      { key: "assignee", label: "担当者", type: "dropdown", options: ASSIGNEES },
    ],
  },
  {
    title: "USP / 訴求軸",
    color: "bg-green-100",
    textColor: "text-green-800",
    rows: [
      { key: "hypothesis", label: "訴求仮説", type: "dropdown", options: HYPOTHESES },
      { key: "funcValue", label: "機能価値", type: "text" },
      { key: "benefit", label: "提供便益", type: "text" },
      { key: "benefitScene", label: "便益提供シーン", type: "text" },
      { key: "noBenefitStatus", label: "便益のない現状", type: "text" },
      { key: "painDesire", label: "強いペイン/願望", type: "text" },
      { key: "desireFunnel", label: "欲求ファネル", type: "dropdown", options: FUNNELS },
      { key: "infoBarrier", label: "情報/行動障壁", type: "text" },
      { key: "competitor", label: "想定競合", type: "text" },
    ],
  },
  {
    title: "WHO",
    color: "bg-orange-100",
    textColor: "text-orange-800",
    rows: [
      { key: "whoState", label: "状態", type: "text" },
      { key: "whoAwareness", label: "認知", type: "text" },
      { key: "whoConstraint", label: "制約", type: "text" },
    ],
  },
];

// ─── Dropdown Component ───────────────────────────────
function Dropdown({
  value, options, onChange,
}: {
  value: string; options: string[]; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left px-2 py-1.5 text-sm border border-transparent rounded hover:border-gray-300 focus:border-[#9333EA]/40 focus:outline-none flex items-center justify-between gap-1 min-h-[32px]"
      >
        <span className="truncate">{value || "—"}</span>
        <ChevronDown size={12} className="shrink-0 text-gray-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-purple-50 ${
                  value === opt ? "text-[#9333EA] font-medium bg-purple-50/50" : "text-[#1A1A2E]/70"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────
export default function AppealsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [appeals, setAppeals] = useState<Appeal[]>(INITIAL);
  const scrollRef = useRef<HTMLDivElement>(null);

  function updateField(id: number, key: keyof Appeal, value: string) {
    setAppeals((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [key]: value } : a))
    );
  }

  function addAppeal() {
    setAppeals((prev) => [...prev, emptyAppeal()]);
    // scroll to right after render
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
      }
    });
  }

  // total row count for section header rowspan
  const allRows = SECTIONS.flatMap((s) => s.rows);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#FAF8F5]">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-200/60 bg-white/60 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <button
            onClick={addAppeal}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#9333EA] text-white rounded-lg text-sm font-medium hover:bg-[#7E22CE] transition-colors shadow-sm"
          >
            <Plus size={15} />
            訴求を追加
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left sticky labels */}
        <div className="shrink-0 w-[140px] border-r border-gray-200/80 bg-white overflow-y-auto">
          {SECTIONS.map((section, si) => (
            <div key={si}>
              {/* Section header */}
              <div
                className={`${section.color} ${section.textColor} px-3 py-2 text-xs font-bold border-b border-gray-200/60 sticky top-0`}
              >
                {section.title}
              </div>
              {/* Row labels */}
              {section.rows.map((row, ri) => (
                <div
                  key={ri}
                  className={`px-3 flex items-center text-xs font-medium text-[#1A1A2E]/60 border-b border-gray-100 ${
                    row.type === "textarea" ? "h-[72px]" : "h-[40px]"
                  }`}
                >
                  {row.label}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Scrollable columns */}
        <div ref={scrollRef} className="flex-1 overflow-auto">
          <div className="inline-flex min-w-full">
            {appeals.map((appeal, ai) => (
              <div
                key={appeal.id}
                className="w-[240px] shrink-0 border-r border-gray-200/60"
              >
                {SECTIONS.map((section, si) => (
                  <div key={si}>
                    {/* Section colored header for this column */}
                    <div
                      className={`${section.color} px-2 py-2 text-xs font-semibold ${section.textColor} border-b border-gray-200/60 text-center`}
                    >
                      {si === 0 ? `訴求 ${ai + 1}` : ""}
                    </div>
                    {/* Row cells */}
                    {section.rows.map((row, ri) => {
                      const cellH = row.type === "textarea" ? "h-[72px]" : "h-[40px]";

                      // Auto field (No.)
                      if (row.key === "_no") {
                        return (
                          <div
                            key={ri}
                            className={`${cellH} px-2 flex items-center justify-center text-sm font-bold text-[#9333EA] border-b border-gray-100 bg-purple-50/30`}
                          >
                            {ai + 1}
                          </div>
                        );
                      }

                      // Dropdown
                      if (row.type === "dropdown" && row.options) {
                        return (
                          <div
                            key={ri}
                            className={`${cellH} px-1 flex items-center border-b border-gray-100 bg-white`}
                          >
                            <Dropdown
                              value={appeal[row.key] as string}
                              options={row.options}
                              onChange={(v) => updateField(appeal.id, row.key, v)}
                            />
                          </div>
                        );
                      }

                      // Textarea
                      if (row.type === "textarea") {
                        return (
                          <div
                            key={ri}
                            className={`${cellH} px-1 py-1 border-b border-gray-100 bg-white`}
                          >
                            <textarea
                              value={appeal[row.key] as string}
                              onChange={(e) => updateField(appeal.id, row.key, e.target.value)}
                              placeholder="..."
                              className="w-full h-full px-1.5 py-1 text-xs leading-relaxed border border-transparent rounded hover:border-gray-200 focus:border-[#9333EA]/40 focus:outline-none resize-none bg-transparent"
                            />
                          </div>
                        );
                      }

                      // Text input
                      return (
                        <div
                          key={ri}
                          className={`${cellH} px-1 flex items-center border-b border-gray-100 bg-white`}
                        >
                          <input
                            type="text"
                            value={appeal[row.key] as string}
                            onChange={(e) => updateField(appeal.id, row.key, e.target.value)}
                            placeholder="..."
                            className="w-full px-1.5 py-1 text-xs border border-transparent rounded hover:border-gray-200 focus:border-[#9333EA]/40 focus:outline-none bg-transparent"
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}

            {/* Add column button */}
            <div className="w-[60px] shrink-0 flex flex-col items-center justify-start pt-2">
              <button
                onClick={addAppeal}
                className="w-10 h-10 rounded-full border-2 border-dashed border-[#9333EA]/30 flex items-center justify-center text-[#9333EA]/50 hover:border-[#9333EA] hover:text-[#9333EA] hover:bg-purple-50 transition-all mt-1"
                title="訴求を追加"
              >
                <Plus size={18} />
              </button>
              <span className="text-[10px] text-[#1A1A2E]/30 mt-1">追加</span>
            </div>
          </div>
        </div>
      </div>

      <VoiceInputButton onTranscript={(text) => console.log("voice:", text)} />
    </div>
  );
}
