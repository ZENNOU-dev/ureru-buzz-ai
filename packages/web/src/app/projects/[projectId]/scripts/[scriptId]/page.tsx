"use client";

import { use, useState, useMemo } from "react";
import { Plus, Eye } from "lucide-react";
import { ScriptHeader } from "@/components/sections/script-header";
import { ContextCards } from "@/components/sections/context-cards";
import {
  SceneRow,
  SectionDivider,
  SceneColumnHeader,
  type Scene,
} from "@/components/sections/scene-row";

const INITIAL_SCENES: Scene[] = [
  {
    id: 1,
    section: "フック",
    text: "未経験なら\nAIフリーランス\nめちゃチャンスです\u{1F97A}",
    annotation:
      "全体に常時表示\n※個人の感想であり効果を\n保証するものではありません",
    regulationWarning: "",
    regulationCheck: false,
    materialName: "PC作業女性3",
    materialUrl: "25.mp4",
    telop: "未経験なら\nAIフリーランス\nめちゃチャンスです\u{1F97A}",
    cut: "",
    me: "",
    se: "",
    revision: "",
  },
  {
    id: 2,
    section: "フック",
    text: "AIのおかげで\n収入変わりすぎて\n正直びっくり\u{1F929}",
    annotation: "",
    materialName: "PC作業女性3",
    materialUrl: "25.mp4",
    telop: "AIのおかげで\n収入変わりすぎて\n正直びっくり\u{1F929}",
  },
  {
    id: 3,
    section: "共感",
    text: "給料・職場環境\n変わらない\n会社員辞めて",
    annotation: "",
    materialName: "歩く女性2",
    materialUrl: "夜道2.MOV",
    telop: "給料・職場環境\n変わらない\n会社員辞めて",
  },
  {
    id: 4,
    section: "共感",
    text: "AIフリーランスに\n転身したら・・・",
    annotation: "",
    materialName: "PC作業女性2",
    materialUrl: "89(1).mp4",
    telop: "AIフリーランスに\n転身したら・・・",
  },
  {
    id: 5,
    section: "コンセプト",
    text: "バブルすぎて\nびっくりしてます\u{1F62D}",
    annotation: "",
    materialName: "PC作業女性3",
    materialUrl: "25.mp4",
    telop: "バブルすぎて\nびっくりしてます\u{1F62D}",
  },
  {
    id: 6,
    section: "商品紹介",
    text: "私は\nAIとXを使って\n会社員時代の月収を上回る\nフリーランス",
    annotation: "",
    materialName: "ベネ女性2",
    materialUrl: "8(2).mp4",
    telop: "私は\nAIとXを使って\n会社員時代の\n月収を上回る\nフリーランス",
  },
  {
    id: 7,
    section: "商品紹介",
    text: "初めは\nAI使わなきゃな〜\nって",
    annotation: "",
    materialName: "ダラダラ女性",
    materialUrl: "39.mp4",
    telop: "初めは\nAI使わなきゃな〜\nって",
  },
  {
    id: 8,
    section: "商品紹介",
    text: "チャッピー愛用\nしてたけど",
    annotation: "",
    materialName: "PC作業女性4",
    materialUrl: "IMG_6666.MOV",
    telop: "チャッピー愛用\nしてたけど",
  },
  {
    id: 9,
    section: "商品紹介",
    text: "仕事で使えなくて挫折",
    annotation: "",
    materialName: "ダラダラ女性2",
    materialUrl: "IMG_3271.MOV",
    telop: "仕事で使えなくて挫折",
  },
  {
    id: 10,
    section: "商品紹介",
    text: "そんな時に\n出会ったのが",
    annotation: "",
    materialName: "歩く女性1",
    materialUrl: "2(1).mp4",
    telop: "そんな時に\n出会ったのが",
  },
  {
    id: 11,
    section: "商品紹介",
    text: "SNS投稿用\nオリジナルAIを\n使わせてもらえる",
    annotation: "",
    materialName: "自動ポスト",
    materialUrl: "DOT-AI自動ポスト.mp4",
    telop: "SNS投稿用\nオリジナルAIを\n使わせてもらえる",
  },
  {
    id: 12,
    section: "商品紹介",
    text: "AI時代の\nフリーランススクール\nDOT-AI\nBOOTCAMP",
    annotation: "",
    materialName: "ロゴ1",
    materialUrl: "ロゴ.png",
    telop: "AI時代の\nフリーランススクール",
  },
  {
    id: 13,
    section: "商品紹介",
    text: "マーケで成功してる\n連続起業家\n発案だから",
    annotation: "",
    materialName: "連続起業家",
    materialUrl: "連続起業家.png",
    telop: "マーケで成功してる\n連続起業家\n発案だから",
  },
  {
    id: 14,
    section: "商品紹介",
    text: "SNSでの\nフリーランス\nロードマップが",
    annotation: "",
    materialName: "ロードマップ1",
    materialUrl: "kling.mp4",
    telop: "SNSでの\nフリーランス\nロードマップが",
  },
  {
    id: 15,
    section: "商品紹介",
    text: "分かりやすく\n学習できたし、",
    annotation: "",
    materialName: "講座1",
    materialUrl: "講座1.png",
    telop: "分かりやすく\n学習できたし、",
  },
  {
    id: 16,
    section: "ベネフィット",
    text: "SNS投稿を\n半自動で作れる\nツールのおかげで",
    annotation: "",
    materialName: "自動ポスト",
    materialUrl: "DOT-AI自動ポスト.mp4",
    telop: "SNS投稿を\n半自動で作れる\nツールのおかげで",
  },
  {
    id: 17,
    section: "ベネフィット",
    text: "アイデア出しと\n調整だけで\n万バズいっぱい\u270C\uFE0F",
    annotation: "",
    materialName: "喜ぶ女性1",
    materialUrl: "68.mp4",
    telop: "アイデア出しと\n調整だけで\n万バズいっぱい\u270C\uFE0F",
  },
  {
    id: 18,
    section: "CTA",
    text: "AIで仕事の効率\n上がったおかげで",
    annotation: "",
    materialName: "PC作業女性4",
    materialUrl: "IMG_6666.MOV",
    telop: "AIで仕事の効率\n上がったおかげで",
  },
  {
    id: 19,
    section: "CTA",
    text: "3ヶ月で\n会社員時代の\n収入額更新\u2728",
    annotation: "",
    materialName: "ベネ女性3",
    materialUrl: "36(2).mp4",
    telop: "3ヶ月で\n会社員時代の\n収入額更新\u2728",
  },
];

export default function ScriptDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; scriptId: string }>;
}) {
  const { projectId, scriptId } = use(params);
  const [scenes, setScenes] = useState<Scene[]>(INITIAL_SCENES);
  const [title, setTitle] = useState("台本 A-001: フック重視パターン");
  const [status, setStatus] = useState("作成中");

  const totalChars = useMemo(() => {
    return scenes.reduce((sum, s) => sum + s.text.replace(/\n/g, "").length, 0);
  }, [scenes]);

  const updateScene = (index: number, updated: Scene) => {
    setScenes((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  };

  const addScene = () => {
    const lastScene = scenes[scenes.length - 1];
    const newScene: Scene = {
      id: scenes.length + 1,
      section: lastScene?.section || "CTA",
      text: "",
      annotation: "",
      materialName: "",
      materialUrl: "",
      telop: "",
      cut: "",
      me: "",
      se: "",
      revision: "",
    };
    setScenes((prev) => [...prev, newScene]);
  };

  // Group scenes to insert section dividers
  const renderSceneList = () => {
    const elements: React.ReactNode[] = [];
    let lastSection = "";

    scenes.forEach((scene, index) => {
      if (scene.section !== lastSection) {
        elements.push(
          <SectionDivider key={`divider-${scene.section}-${index}`} label={scene.section} />
        );
        lastSection = scene.section;
      }
      elements.push(
        <SceneRow
          key={scene.id}
          scene={scene}
          onChange={(updated) => updateScene(index, updated)}
        />
      );
    });

    return elements;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Script Header */}
      <ScriptHeader
        projectId={projectId}
        title={title}
        status={status}
        totalChars={totalChars}
        onTitleChange={setTitle}
        onStatusChange={setStatus}
      />

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-4 max-w-[1400px]">
          {/* Context Cards */}
          <ContextCards />

          {/* Scene List */}
          <div className="space-y-1.5 overflow-x-auto">
            <SceneColumnHeader />
            {renderSceneList()}
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center gap-3 pt-2 pb-8">
            <button
              onClick={addScene}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-dashed border-zinc-300 text-xs font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 hover:bg-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              シーン追加
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-colors">
              <Eye className="w-3.5 h-3.5" />
              クライアント共有用プレビュー
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
