"use client";

import { use, useState, useCallback, useRef } from "react";
import {
  Search, Package, TrendingUp, Users, Globe, Star, Shield, Truck,
  Heart, DollarSign, ExternalLink, Image, Plus, X, ChevronRight,
  ChevronLeft, ChevronDown, ChevronUp, Zap, Palette, BookOpen, Award, Tag, Building,
  ArrowRight, Calendar, MessageSquare, Play, Check, Eye, CheckCircle2,
} from "lucide-react";
import { VoiceInputButton } from "@/components/voice-input-button";

// ─── Types ────────────────────────────────────────────
type TabKey = "product" | "market" | "customer";
type ProductSubTab = "hero" | "overview" | "reviews" | "operations" | "experienceLog" | "usp";
type CustomerSub = "potential" | "existing";

// Product Hero types
type HeroInfo = {
  productName: string;
  logoText: string;
  category: string;
  price: string;
  summaryPoints: string[];
  topReview: string;
  usageScene: string;
};

type GalleryItem = { id: number; type: "LP" | "バナー" | "動画"; label: string; url: string };

// Product Overview types — Function bubble
type FunctionBubble = {
  id: number;
  name: string;
  description: string;
  customerValue: string;
  effects: { emoji: string; text: string }[];
  researchData: { icon: string; title: string; detail: string; source: string }[];
};

// Design panel
type DesignColor = { label: string; key: string; color: string };

// Experience panel
type EmotionKeyword = { id: number; emoji: string; text: string; x: number; y: number };
type ExperienceQuote = { id: number; text: string; author: string };

// Story panel
type StoryNode = { id: number; year: string; description: string };

// Offer panel
type OfferPlan = {
  title: string;
  price: string;
  items: string[];
  isSpecial: boolean;
  badge?: string;
};

// Reviews / Authority types
type ReviewCard = {
  id: number;
  rating: number;
  text: string;
  source: string;
  author: string;
  date: string;
};
type AwardBubble = { id: number; name: string; year: string };
type MediaBubble = { id: number; name: string; date: string };

// Operations types
type FlowNode = { id: number; text: string };
type FlowSection = { title: string; nodes: FlowNode[] };

// Experience Log types
type ExperienceLog = {
  id: number;
  date: string;
  tags: string[];
  text: string;
};

// USP types
type USPCard = {
  id: number;
  title: string;
  functionTags: string[];
  benefit: string;
};

// Market types
type MarketRow = { label: string; values: string[] };
type RefCreative = { id: number; name: string; platform: string; url: string; notes: string };

// Customer types
type SurveyRow = { label: string; source: string; item: string; percentages: string[] };
type SurveySection = { title: string; rows: SurveyRow[] };

// ─── Constants ────────────────────────────────────────
const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "product", label: "商品リサーチ", icon: <Package className="w-4 h-4" /> },
  { key: "market", label: "市場リサーチ", icon: <TrendingUp className="w-4 h-4" /> },
  { key: "customer", label: "顧客リサーチ", icon: <Users className="w-4 h-4" /> },
];

const PRODUCT_SUB_TABS: { key: ProductSubTab; label: string }[] = [
  { key: "hero", label: "商品" },
  { key: "overview", label: "商品概要" },
  { key: "reviews", label: "口コミ・権威性" },
  { key: "operations", label: "提供体制" },
  { key: "experienceLog", label: "製品体験" },
  { key: "usp", label: "USP" },
];

const MARKET_COLUMNS = ["商品市場", "仲裁市場", "周辺市場"];
const MARKET_ROW_LABELS = [
  "市場名", "市場規模", "市場シェア", "成長率", "主要競合商品",
  "商品URL", "主要機能価値", "主要情緒価値", "主要金銭価値", "主要信頼価値", "主要体制価値",
];

const SURVEY_SECTIONS_LABELS = [
  "購入目的", "最重要判断軸", "課題/願望", "比較対象", "購入阻害要因",
  "自由記入①", "自由記入②", "自由記入③",
];

const PERCENTAGE_COLUMNS = ["回答1", "回答2", "回答3", "回答4", "回答5"];

// ─── Initial Data ────────────────────────────────────
function makeHeroInfo(): HeroInfo {
  return {
    productName: "DOT-AI BOOTCAMP",
    logoText: "LOGO",
    category: "AIフリーランススクール",
    price: "498,000円",
    summaryPoints: [
      "SNS運用に特化したオリジナルAIツール付き",
      "連続起業家による直接メンタリング",
      "3ヶ月で月収超えの実績多数",
    ],
    topReview: "未経験から3ヶ月で月収を超えました。AIツールのおかげで投稿作成が圧倒的に楽です。",
    usageScene: "",
  };
}

function makeGalleryItems(): GalleryItem[] {
  return [
    { id: 1, type: "LP", label: "メインLP", url: "" },
    { id: 2, type: "LP", label: "サブLP A", url: "" },
    { id: 3, type: "LP", label: "サブLP B", url: "" },
    { id: 4, type: "LP", label: "キャンペーンLP", url: "" },
    { id: 5, type: "LP", label: "リニューアルLP", url: "" },
    { id: 6, type: "バナー", label: "バナー広告 A", url: "" },
    { id: 7, type: "バナー", label: "バナー広告 B", url: "" },
    { id: 8, type: "バナー", label: "バナー広告 C", url: "" },
    { id: 9, type: "バナー", label: "バナー広告 D", url: "" },
    { id: 10, type: "バナー", label: "バナー広告 E", url: "" },
    { id: 11, type: "動画", label: "ショート動画 A", url: "" },
    { id: 12, type: "動画", label: "ショート動画 B", url: "" },
    { id: 13, type: "動画", label: "ショート動画 C", url: "" },
    { id: 14, type: "動画", label: "ショート動画 D", url: "" },
    { id: 15, type: "動画", label: "ショート動画 E", url: "" },
  ];
}

function makeFunctionBubbles(): FunctionBubble[] {
  return [
    {
      id: 1, name: "AIツール提供", description: "SNS運用に特化したAI", customerValue: "未経験でも投稿作成可能",
      effects: [
        { emoji: "🎯", text: "SNS投稿の半自動化" },
        { emoji: "✨", text: "高品質コンテンツ量産" },
      ],
      researchData: [
        { icon: "📊", title: "AIツール利用満足度調査", detail: "受講生の92%がAIツールに満足と回答。特に投稿生成機能の評価が高い。", source: "社内アンケート 2025年12月" },
      ],
    },
    {
      id: 2, name: "SNS運用スキル", description: "実践的なノウハウ", customerValue: "短期間で成果を出せる",
      effects: [
        { emoji: "💡", text: "フォロワー獲得メソッド" },
        { emoji: "🔧", text: "案件受注テクニック" },
      ],
      researchData: [
        { icon: "📊", title: "受講後成果データ", detail: "受講3ヶ月後の平均フォロワー増加数: +2,500名。案件獲得率80%。", source: "受講生追跡調査 2025年" },
      ],
    },
    {
      id: 3, name: "起業家メンター", description: "連続起業家が直接指導", customerValue: "実務レベルのアドバイス",
      effects: [
        { emoji: "🎯", text: "個別戦略立案サポート" },
        { emoji: "✨", text: "業界コネクション紹介" },
      ],
      researchData: [],
    },
  ];
}

function makeDesignColors(): DesignColor[] {
  return [
    { label: "ベースカラー", key: "base", color: "#1a1a2e" },
    { label: "メインカラー", key: "main", color: "#9333EA" },
    { label: "アクセントカラー", key: "accent", color: "#22D3EE" },
    { label: "テキストカラー", key: "text", color: "#FFFFFF" },
  ];
}

function makeEmotionKeywords(): EmotionKeyword[] {
  return [
    { id: 1, emoji: "✨", text: "ワクワク", x: 10, y: 10 },
    { id: 2, emoji: "💪", text: "自信", x: 40, y: 40 },
    { id: 3, emoji: "😌", text: "安心", x: 70, y: 70 },
    { id: 4, emoji: "🎯", text: "集中", x: 70, y: 15 },
    { id: 5, emoji: "🚀", text: "成長実感", x: 15, y: 70 },
  ];
}

function makeExperienceQuotes(): ExperienceQuote[] {
  return [
    { id: 1, text: "AIツールを使った瞬間、未来のスキルを手にした感覚があった", author: "田中さん" },
    { id: 2, text: "メンターの指導で、3ヶ月で人生が変わった", author: "佐藤さん" },
  ];
}

function makeStoryNodes(): StoryNode[] {
  return [
    { id: 1, year: "2023", description: "創業者がAI×マーケに着目" },
    { id: 2, year: "2024", description: "DOT-AI BOOTCAMP ローンチ" },
    { id: 3, year: "2025", description: "受講者500名突破" },
    { id: 4, year: "2026", description: "法人向けサービス開始" },
  ];
}

function makeOfferPlans(): OfferPlan[] {
  return [
    {
      title: "通常",
      price: "498,000円",
      items: ["AIツール利用（1年間）", "オンライン講座全コース", "月2回グループメンタリング", "コミュニティ参加"],
      isSpecial: false,
    },
    {
      title: "特別オファー",
      price: "398,000円",
      items: ["AIツール永久利用権", "オンライン講座全コース", "月4回個別メンタリング", "コミュニティ参加", "案件紹介サポート", "無料相談 + 限定特典付き"],
      isSpecial: true,
      badge: "先着30名限定",
    },
  ];
}

function makeUSPCards(): USPCard[] {
  return [
    {
      id: 1,
      title: "実践的AIツール × 連続起業家メソッド",
      functionTags: ["AIツール提供", "SNS運用スキル"],
      benefit: "AIで収入アップ・独立支援。学ぶだけでなく、即座に収益化できる仕組み。",
    },
    {
      id: 2,
      title: "3ヶ月以内案件獲得率80%",
      functionTags: ["案件獲得サポート", "メンター制"],
      benefit: "受講後すぐに実案件に取り組める環境とサポート体制。",
    },
  ];
}

function makeReviewCards(): ReviewCard[] {
  return [
    { id: 1, rating: 5, text: "AIツールが直感的で、すぐに実務に使えました。メンターの対応も早くて安心。", source: "Google", author: "田中太郎", date: "2025-12-15" },
    { id: 2, rating: 4, text: "カリキュラムが実践的。ただし、もう少し基礎編があると初心者にはありがたい。", source: "X", author: "佐藤花子", date: "2025-11-28" },
    { id: 3, rating: 5, text: "入会2ヶ月で初案件獲得！SNS運用の知識がビジネスに直結している。", source: "Instagram", author: "鈴木一郎", date: "2026-01-05" },
    { id: 4, rating: 4, text: "価格は高めだが、AIツールの永久利用権を考えるとコスパは良い。", source: "Amazon", author: "高橋めぐみ", date: "2026-02-10" },
  ];
}

function makeAwards(): AwardBubble[] {
  return [
    { id: 1, name: "AIスクールランキング1位", year: "2025" },
    { id: 2, name: "EdTech Innovation Award", year: "2025" },
    { id: 3, name: "ベストオンライン教育賞", year: "2024" },
  ];
}

function makeMedia(): MediaBubble[] {
  return [
    { id: 1, name: "Forbes Japan", date: "2025-10" },
    { id: 2, name: "日経MJ", date: "2025-08" },
    { id: 3, name: "TechCrunch JP", date: "2025-06" },
  ];
}

function makeFlowSections(): FlowSection[] {
  return [
    { title: "流通体制", nodes: [
      { id: 1, text: "オンライン申込" }, { id: 2, text: "決済" }, { id: 3, text: "アカウント発行" }, { id: 4, text: "コンテンツ提供" },
    ]},
    { title: "CS体制", nodes: [
      { id: 1, text: "お問い合わせ" }, { id: 2, text: "チャットサポート" }, { id: 3, text: "個別対応" }, { id: 4, text: "フォローアップ" },
    ]},
    { title: "販売体制", nodes: [
      { id: 1, text: "広告" }, { id: 2, text: "LP" }, { id: 3, text: "無料相談" }, { id: 4, text: "セミナー" }, { id: 5, text: "入会" },
    ]},
  ];
}

function makeExperienceLogs(): ExperienceLog[] {
  return [
    { id: 1, date: "2026-03-20", tags: ["初回体験", "UI確認"], text: "初回ログイン。ダッシュボードのUIは直感的で、チュートリアル動画がすぐに表示される。AIツールの初期設定は5分ほどで完了。" },
    { id: 2, date: "2026-03-18", tags: ["機能テスト", "AIツール"], text: "SNS投稿生成AIを試用。テンプレート選択→キーワード入力→生成の3ステップ。生成品質は高く、そのまま投稿可能なレベル。" },
    { id: 3, date: "2026-03-15", tags: ["メンター面談", "カリキュラム"], text: "メンター初回面談。個別の目標設定と学習プランの策定。レスポンスが早く、LINEでの質問にも即返答。" },
    { id: 4, date: "2026-03-12", tags: ["競合比較", "価格調査"], text: "類似サービス3社を比較体験。DOT-AIはツール提供+メンタリングの組み合わせが独自。価格帯は中〜上位だが、永久利用権を考慮すると割安感。" },
  ];
}

// Market initial data
function makeMarketRows(): MarketRow[] {
  return MARKET_ROW_LABELS.map((label) => {
    const vals: Record<string, string[]> = {
      "市場名": ["AIスクール市場", "フリーランススクール市場", "オンライン教育市場"],
      "市場規模": ["約500億円", "約300億円", "約5,000億円"],
      "市場シェア": ["推定5%", "推定3%", "推定0.5%"],
      "成長率": ["年率25%成長", "年率15%成長", "年率12%成長"],
      "主要競合商品": ["Aidemy Premium / テックアカデミーAI", "デイトラ / ランサーズデジタルアカデミー", "Udemy / Schoo"],
      "商品URL": ["https://example.com/comp1", "https://example.com/comp2", "https://example.com/comp3"],
      "主要機能価値": ["AI技術習得カリキュラム", "案件獲得サポート", "動画講座ライブラリ"],
      "主要情緒価値": ["先端技術のワクワク感", "独立への自信", "手軽に学べる安心感"],
      "主要金銭価値": ["月額制で始めやすい", "案件保証付きプラン", "月額1,000円〜"],
      "主要信頼価値": ["企業研修実績多数", "卒業生の独立実績", "講師の実務経験"],
      "主要体制価値": ["オンライン+メンター", "コミュニティ型サポート", "自習型"],
    };
    return { label, values: vals[label] || ["", "", ""] };
  });
}

function makeRefCreatives(): RefCreative[] {
  return [
    { id: 1, name: "Aidemy Premium LP動画", platform: "YouTube", url: "https://youtube.com/example1", notes: "冒頭3秒で成果訴求。受講生インタビュー中心。" },
    { id: 2, name: "デイトラ Instagram広告", platform: "Instagram", url: "https://instagram.com/example2", notes: "Before/After形式。収入変化を数字で見せる。" },
    { id: 3, name: "テックアカデミー TikTok", platform: "TikTok", url: "https://tiktok.com/example3", notes: "UGC風。受講生の日常を切り取り。" },
    { id: 4, name: "ランサーズ YouTube広告", platform: "YouTube", url: "https://youtube.com/example4", notes: "比較表で差別化。ロジカルな構成。" },
  ];
}

function makeSurveySections(type: "potential" | "existing"): SurveySection[] {
  const prefix = type === "potential" ? "潜在" : "既存";
  return SURVEY_SECTIONS_LABELS.map((title) => {
    const sampleData: Record<string, SurveyRow[]> = {
      "購入目的": [
        { label: "①", source: `${prefix}顧客アンケート`, item: "副業収入を得たい", percentages: ["42%", "28%", "15%", "10%", "5%"] },
        { label: "②", source: `${prefix}顧客アンケート`, item: "AIスキルを身につけたい", percentages: ["35%", "30%", "20%", "10%", "5%"] },
      ],
      "最重要判断軸": [
        { label: "①", source: `${prefix}顧客インタビュー`, item: "実践で使えるか", percentages: ["50%", "25%", "15%", "7%", "3%"] },
        { label: "②", source: `${prefix}顧客インタビュー`, item: "サポート体制", percentages: ["30%", "35%", "20%", "10%", "5%"] },
      ],
      "課題/願望": [
        { label: "①", source: "SNS分析", item: "会社員の収入に限界を感じる", percentages: ["45%", "25%", "18%", "8%", "4%"] },
        { label: "②", source: "SNS分析", item: "AIを使いこなせるようになりたい", percentages: ["38%", "30%", "18%", "9%", "5%"] },
      ],
      "比較対象": [
        { label: "①", source: "Google検索分析", item: "プログラミングスクール", percentages: ["40%", "30%", "15%", "10%", "5%"] },
        { label: "②", source: "Google検索分析", item: "独学（YouTube/書籍）", percentages: ["35%", "25%", "22%", "12%", "6%"] },
      ],
      "購入阻害要因": [
        { label: "①", source: `${prefix}顧客アンケート`, item: "価格が高い", percentages: ["48%", "22%", "16%", "9%", "5%"] },
        { label: "②", source: `${prefix}顧客アンケート`, item: "本当に稼げるか不安", percentages: ["40%", "28%", "18%", "10%", "4%"] },
      ],
      "自由記入①": [
        { label: "①", source: "自由記述", item: "オンラインだけで大丈夫？", percentages: ["30%", "25%", "20%", "15%", "10%"] },
      ],
      "自由記入②": [
        { label: "①", source: "自由記述", item: "どのくらいで成果が出る？", percentages: ["35%", "28%", "20%", "12%", "5%"] },
      ],
      "自由記入③": [
        { label: "①", source: "自由記述", item: "他のスクールとの違いは？", percentages: ["32%", "26%", "22%", "13%", "7%"] },
      ],
    };
    return { title, rows: sampleData[title] || [] };
  });
}

// ─── Page Component ──────────────────────────────────
export default function ResearchPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const [activeTab, setActiveTab] = useState<TabKey>("product");

  // Product sub-tab
  const [productSubTab, setProductSubTab] = useState<ProductSubTab>("hero");
  const [overviewPanel, setOverviewPanel] = useState(0);
  const OVERVIEW_PANELS = ["機能", "デザイン", "体験", "ストーリー", "オファー"] as const;

  // Hero state
  const [heroInfo, setHeroInfo] = useState<HeroInfo>(makeHeroInfo);
  const [gallery] = useState<GalleryItem[]>(makeGalleryItems);
  const [galleryIdx, setGalleryIdx] = useState<Record<string, number>>({ "LP": 0, "バナー": 0, "動画": 0 });

  // Overview state
  const [functionBubbles, setFunctionBubbles] = useState<FunctionBubble[]>(makeFunctionBubbles);
  const [expandedBubble, setExpandedBubble] = useState<number | null>(null);
  const [researchModal, setResearchModal] = useState<{ bubbleId: number; dataIdx: number } | null>(null);
  const [designColors, setDesignColors] = useState<DesignColor[]>(makeDesignColors);
  const [moodboardSlots] = useState(6);
  const [emotionKeywords, setEmotionKeywords] = useState<EmotionKeyword[]>(makeEmotionKeywords);
  const [experienceQuotes, setExperienceQuotes] = useState<ExperienceQuote[]>(makeExperienceQuotes);
  const [storyNodes, setStoryNodes] = useState<StoryNode[]>(makeStoryNodes);
  const [offerPlans, setOfferPlans] = useState<OfferPlan[]>(makeOfferPlans);

  // Reviews & Authority state
  const [reviewCards, setReviewCards] = useState<ReviewCard[]>(makeReviewCards);
  const [reviewScrollIdx, setReviewScrollIdx] = useState(0);
  const [awards, setAwards] = useState<AwardBubble[]>(makeAwards);
  const [media, setMedia] = useState<MediaBubble[]>(makeMedia);

  // Operations state
  const [flowSections, setFlowSections] = useState<FlowSection[]>(makeFlowSections);

  // Experience Log state
  const [experienceLogs, setExperienceLogs] = useState<ExperienceLog[]>(makeExperienceLogs);

  // USP state
  const [uspCards, setUSPCards] = useState<USPCard[]>(makeUSPCards);

  // Market state
  const [marketRows, setMarketRows] = useState<MarketRow[]>(makeMarketRows);
  const [marketCols, setMarketCols] = useState<string[]>(MARKET_COLUMNS);
  const [refCreatives, setRefCreatives] = useState<RefCreative[]>(makeRefCreatives);

  // Customer state
  const [customerSub, setCustomerSub] = useState<CustomerSub>("potential");
  const [potentialSurveys, setPotentialSurveys] = useState<SurveySection[]>(() => makeSurveySections("potential"));
  const [existingSurveys, setExistingSurveys] = useState<SurveySection[]>(() => makeSurveySections("existing"));

  // ─── Updaters ────────────────────────────────────────
  const updateMarketCell = useCallback((rowIdx: number, colIdx: number, val: string) => {
    setMarketRows((prev) => {
      const next = [...prev];
      const row = { ...next[rowIdx], values: [...next[rowIdx].values] };
      row.values[colIdx] = val;
      next[rowIdx] = row;
      return next;
    });
  }, []);

  const updateSurveyCell = useCallback(
    (sectionIdx: number, rowIdx: number, field: "source" | "item", val: string) => {
      const setter = customerSub === "potential" ? setPotentialSurveys : setExistingSurveys;
      setter((prev) => {
        const next = [...prev];
        const sec = { ...next[sectionIdx], rows: [...next[sectionIdx].rows] };
        sec.rows[rowIdx] = { ...sec.rows[rowIdx], [field]: val };
        next[sectionIdx] = sec;
        return next;
      });
    },
    [customerSub],
  );

  const updateSurveyPercentage = useCallback(
    (sectionIdx: number, rowIdx: number, pctIdx: number, val: string) => {
      const setter = customerSub === "potential" ? setPotentialSurveys : setExistingSurveys;
      setter((prev) => {
        const next = [...prev];
        const sec = { ...next[sectionIdx], rows: [...next[sectionIdx].rows] };
        const row = { ...sec.rows[rowIdx], percentages: [...sec.rows[rowIdx].percentages] };
        row.percentages[pctIdx] = val;
        sec.rows[rowIdx] = row;
        next[sectionIdx] = sec;
        return next;
      });
    },
    [customerSub],
  );

  const surveys = customerSub === "potential" ? potentialSurveys : existingSurveys;

  // ─── Render helpers ─────────────────────────────────
  const inputClass =
    "w-full bg-white/80 border border-black/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#1A1A2E] placeholder-[#1A1A2E]/30 outline-none focus:ring-2 focus:ring-[#9333EA]/20 focus:border-[#9333EA]/40 transition-all";

  const sectionHeader = (title: string, sub?: string) => (
    <div className="mb-4">
      <h2 className="text-[15px] font-bold text-[#1A1A2E]">{title}</h2>
      {sub && <p className="text-[11px] text-[#1A1A2E]/40 mt-0.5">{sub}</p>}
    </div>
  );

  const renderStars = (rating: number, onChange?: (r: number) => void) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          onClick={() => onChange?.(s)}
          className={`text-lg ${s <= rating ? "text-yellow-400" : "text-gray-200"} ${onChange ? "cursor-pointer hover:text-yellow-300" : "cursor-default"}`}
        >
          ★
        </button>
      ))}
    </div>
  );

  // ─── Sub-tab 1: 商品 (Hero) ─────────────────────────
  function renderHeroTab() {
    const lpItems = gallery.filter((g) => g.type === "LP");
    const bannerItems = gallery.filter((g) => g.type === "バナー");
    const videoItems = gallery.filter((g) => g.type === "動画");

    function GalleryCarousel({ items, type, aspect }: { items: GalleryItem[]; type: string; aspect: string }) {
      const idx = galleryIdx[type] || 0;
      const current = items[idx];
      if (!items.length) return <div className="flex-1 rounded-lg bg-[#FAF8F5] border border-black/[0.06] flex items-center justify-center h-full"><span className="text-[10px] text-[#1A1A2E]/20">なし</span></div>;
      return (
        <div className="flex-1 flex flex-col">
          <div className="mb-1.5">
            <span className="text-[11px] font-bold text-[#1A1A2E]/60">{type}</span>
          </div>
          <div className="flex-1 relative">
            {/* Arrows - always show if multiple items */}
            {items.length > 1 && (
              <>
                <button onClick={() => setGalleryIdx((p) => ({ ...p, [type]: (idx - 1 + items.length) % items.length }))}
                  className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white/90 shadow flex items-center justify-center text-[#1A1A2E]/40 hover:text-[#9333EA] transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setGalleryIdx((p) => ({ ...p, [type]: (idx + 1) % items.length }))}
                  className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white/90 shadow flex items-center justify-center text-[#1A1A2E]/40 hover:text-[#9333EA] transition-colors">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <div className={`${aspect} rounded-lg overflow-hidden border border-black/[0.06] bg-[#FAF8F5] w-full h-full`}>
              {current?.url && type === "LP" ? (
                <iframe src={current.url} className="w-full h-full" title="LP" sandbox="allow-scripts allow-same-origin" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  {type === "動画" ? <Play className="w-6 h-6 text-[#1A1A2E]/15 mb-1" /> : type === "LP" ? <Globe className="w-6 h-6 text-[#1A1A2E]/15 mb-1" /> : <Package className="w-6 h-6 text-[#1A1A2E]/15 mb-1" />}
                  <span className="text-[9px] text-[#1A1A2E]/25">{current?.label || type}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {/* ── Product Hero Card ── */}
        <div className="rounded-2xl bg-gradient-to-br from-[#9333EA] to-[#6D28D9] p-5 shadow-lg">
          {/* Logo centered */}
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center shadow-md overflow-hidden">
              <img src={`https://www.google.com/s2/favicons?domain=dot-ai-bootcamp.com&sz=64`} alt="logo" className="w-9 h-9 object-contain"
                onError={(e) => { const el = e.target as HTMLImageElement; el.style.display = "none"; }} />
            </div>
          </div>
          <div className="flex gap-3">
            {/* Product info: name + category + price + features - 右寄せ */}
            <div className="flex-[30] min-w-0">
              <input className="bg-transparent text-white text-xl font-bold outline-none w-full placeholder-white/40"
                value={heroInfo.productName} onChange={(e) => setHeroInfo((p) => ({ ...p, productName: e.target.value }))} placeholder="商品名" />
              <input className="bg-transparent text-white/50 text-[11px] outline-none w-full placeholder-white/30 mb-1"
                value={heroInfo.category} onChange={(e) => setHeroInfo((p) => ({ ...p, category: e.target.value }))} placeholder="カテゴリ" />
              <div className="flex items-center gap-2 mb-2">
                <span className="text-white/40 text-[10px]">価格</span>
                <input className="bg-white/10 border border-white/20 rounded-lg px-2 py-0.5 text-[13px] text-white font-bold outline-none w-28 placeholder-white/30"
                  value={heroInfo.price} onChange={(e) => setHeroInfo((p) => ({ ...p, price: e.target.value }))} placeholder="価格" />
              </div>
              <div className="space-y-1">
                {heroInfo.summaryPoints.map((pt, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 shrink-0 mt-0.5" />
                    <input className="bg-transparent text-white/80 text-[11px] outline-none w-full placeholder-white/30"
                      value={pt} onChange={(e) => { const pts = [...heroInfo.summaryPoints]; pts[i] = e.target.value; setHeroInfo((p) => ({ ...p, summaryPoints: pts })); }}
                      placeholder="特徴を入力" />
                  </div>
                ))}
              </div>
            </div>

            {/* Middle: 口コミ - 左寄せ */}
            <div className="flex-[38] min-w-0 flex flex-col">
              <div className="flex items-center gap-1 mb-1.5">
                <Star className="w-3 h-3 text-yellow-300" />
                <span className="text-[9px] text-white/40 font-bold">代表的な口コミ</span>
              </div>
              <div className="flex-1 rounded-xl bg-white overflow-hidden flex flex-col shadow-md">
                <div className="bg-gradient-to-b from-gray-50 to-white flex-1 p-4 flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-[#9333EA]/20 flex items-center justify-center">
                      <Users className="w-3.5 h-3.5 text-[#9333EA]" />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-[#1A1A2E]/70">受講生A</div>
                      <div className="text-[7px] text-[#1A1A2E]/30">@user_a</div>
                    </div>
                  </div>
                  <textarea className="text-[11px] text-[#1A1A2E]/70 leading-relaxed flex-1 bg-transparent outline-none resize-none placeholder:text-[#1A1A2E]/20" rows={3}
                    value={heroInfo.topReview} onChange={(e) => setHeroInfo((p) => ({ ...p, topReview: e.target.value }))} placeholder="口コミ" />
                  <div className="flex items-center gap-1 mt-2">
                    {[1,2,3,4,5].map((s) => (
                      <Star key={s} className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: 利用シーン - 左寄せ */}
            <div className="flex-[32] min-w-0 flex flex-col">
              <div className="flex items-center gap-1 mb-1.5">
                <Users className="w-3 h-3 text-white/40" />
                <span className="text-[9px] text-white/40 font-bold">利用シーン</span>
              </div>
              <div className="flex-1 rounded-xl bg-white/10 border border-white/10 overflow-hidden flex items-center justify-center shadow-md min-h-0">
                <div className="text-center p-4">
                  <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-2">
                    <Package className="w-6 h-6 text-white/25" />
                  </div>
                  <span className="text-[9px] text-white/35">利用シーン画像</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── LP・広告ギャラリー (3分割カルーセル, リッチ) ── */}
        <div className="rounded-xl overflow-hidden shadow-sm border border-black/[0.06]">
          <div className="grid grid-cols-3">
            {/* LP section */}
            <div className="bg-gradient-to-b from-blue-50 to-white p-4 border-r border-black/[0.04]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <span className="text-[12px] font-bold text-[#1A1A2E]/70">LP</span>
                <span className="text-[9px] text-[#1A1A2E]/25 ml-auto">{lpItems.length}件</span>
              </div>
              <div className="relative flex justify-center" style={{ minHeight: 200 }}>
                {lpItems.length > 1 && (
                  <>
                    <button onClick={() => setGalleryIdx((p) => ({ ...p, LP: ((p.LP || 0) - 1 + lpItems.length) % lpItems.length }))}
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center text-[#1A1A2E]/30 hover:text-blue-600 transition-colors">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setGalleryIdx((p) => ({ ...p, LP: ((p.LP || 0) + 1) % lpItems.length }))}
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center text-[#1A1A2E]/30 hover:text-blue-600 transition-colors">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                <div className="w-[85%] aspect-[3/4] rounded-xl overflow-hidden border border-blue-100 bg-white shadow-inner">
                  {lpItems[galleryIdx.LP || 0]?.url ? (
                    <iframe src={lpItems[galleryIdx.LP || 0].url} className="w-full h-full" title="LP" sandbox="allow-scripts allow-same-origin" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-blue-50/50 to-white">
                      <Globe className="w-8 h-8 text-blue-200 mb-2" />
                      <span className="text-[10px] text-blue-300 font-medium">{lpItems[galleryIdx.LP || 0]?.label || "LP"}</span>
                    </div>
                  )}
                </div>
                {/* Dots */}
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  {lpItems.map((_, di) => (
                    <button key={di} onClick={() => setGalleryIdx((p) => ({ ...p, LP: di }))}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${di === (galleryIdx.LP || 0) ? "bg-blue-500 w-3" : "bg-blue-200"}`} />
                  ))}
                </div>
              </div>
            </div>

            {/* バナー section (正方形) */}
            <div className="bg-gradient-to-b from-amber-50 to-white p-4 border-r border-black/[0.04]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Package className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <span className="text-[12px] font-bold text-[#1A1A2E]/70">バナー</span>
                <span className="text-[9px] text-[#1A1A2E]/25 ml-auto">{bannerItems.length}件</span>
              </div>
              <div className="relative flex justify-center" style={{ minHeight: 240 }}>
                {bannerItems.length > 1 && (
                  <>
                    <button onClick={() => setGalleryIdx((p) => ({ ...p, "バナー": ((p["バナー"] || 0) - 1 + bannerItems.length) % bannerItems.length }))}
                      className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center text-[#1A1A2E]/30 hover:text-amber-600 transition-colors">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setGalleryIdx((p) => ({ ...p, "バナー": ((p["バナー"] || 0) + 1) % bannerItems.length }))}
                      className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center text-[#1A1A2E]/30 hover:text-amber-600 transition-colors">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                <div className="w-[85%] aspect-square rounded-xl overflow-hidden border border-amber-100 bg-white shadow-inner">
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-amber-50/50 to-white">
                    <Package className="w-10 h-10 text-amber-200 mb-2" />
                    <span className="text-[11px] text-amber-300 font-medium">{bannerItems[galleryIdx["バナー"] || 0]?.label || "バナー"}</span>
                  </div>
                </div>
                <div className="absolute bottom-0 flex items-center justify-center gap-1.5">
                  {bannerItems.map((_, di) => (
                    <button key={di} onClick={() => setGalleryIdx((p) => ({ ...p, "バナー": di }))}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${di === (galleryIdx["バナー"] || 0) ? "bg-amber-500 w-3" : "bg-amber-200"}`} />
                  ))}
                </div>
              </div>
            </div>

            {/* 動画 section (縦型スマホ画面) */}
            <div className="bg-gradient-to-b from-purple-50 to-white p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Play className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <span className="text-[12px] font-bold text-[#1A1A2E]/70">動画</span>
                <span className="text-[9px] text-[#1A1A2E]/25 ml-auto">{videoItems.length}件</span>
              </div>
              <div className="relative flex justify-center" style={{ minHeight: 240 }}>
                {videoItems.length > 1 && (
                  <>
                    <button onClick={() => setGalleryIdx((p) => ({ ...p, "動画": ((p["動画"] || 0) - 1 + videoItems.length) % videoItems.length }))}
                      className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center text-[#1A1A2E]/30 hover:text-purple-600 transition-colors">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setGalleryIdx((p) => ({ ...p, "動画": ((p["動画"] || 0) + 1) % videoItems.length }))}
                      className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center text-[#1A1A2E]/30 hover:text-purple-600 transition-colors">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                {/* スマホフレーム */}
                <div className="w-[55%] aspect-[9/16] rounded-[18px] border-2 border-purple-200 bg-[#0a0a0a] relative overflow-hidden flex flex-col shadow-inner">
                  <div className="w-[24px] h-[4px] bg-white/20 rounded-full mx-auto mt-[5px] shrink-0" />
                  <div className="flex-1 mx-[3px] mb-[5px] mt-[3px] rounded-[8px] bg-gradient-to-b from-purple-900/30 to-purple-900/60 flex flex-col items-center justify-center overflow-hidden">
                    <Play className="w-8 h-8 text-white/20 mb-2" />
                    <span className="text-[9px] text-white/30 font-medium">{videoItems[galleryIdx["動画"] || 0]?.label || "動画"}</span>
                  </div>
                  <div className="w-[20px] h-[3px] bg-white/20 rounded-full mx-auto mb-[4px] shrink-0" />
                </div>
                <div className="absolute bottom-0 flex items-center justify-center gap-1.5">
                  {videoItems.map((_, di) => (
                    <button key={di} onClick={() => setGalleryIdx((p) => ({ ...p, "動画": di }))}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${di === (galleryIdx["動画"] || 0) ? "bg-purple-500 w-3" : "bg-purple-200"}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Sub-tab 2: 商品概要 (5 panels) ─────────────────
  function renderOverviewTab() {
    const panelName = OVERVIEW_PANELS[overviewPanel];
    const prevPanel = () => setOverviewPanel((p) => (p - 1 + OVERVIEW_PANELS.length) % OVERVIEW_PANELS.length);
    const nextPanel = () => setOverviewPanel((p) => (p + 1) % OVERVIEW_PANELS.length);
    const prevName = OVERVIEW_PANELS[(overviewPanel - 1 + OVERVIEW_PANELS.length) % OVERVIEW_PANELS.length];
    const nextName = OVERVIEW_PANELS[(overviewPanel + 1) % OVERVIEW_PANELS.length];

    const panelIcons = ["⚡", "🎨", "💫", "📖", "🏷️"];
    const panelColors = [
      "from-purple-50 to-white border-purple-100",
      "from-blue-50 to-white border-blue-100",
      "from-green-50 to-white border-green-100",
      "from-amber-50 to-white border-amber-100",
      "from-rose-50 to-white border-rose-100",
    ];

    return (
      <div className="relative">
        {/* Panel navigation header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevPanel} className="flex items-center gap-1.5 text-[12px] text-[#1A1A2E]/30 hover:text-[#9333EA] transition-colors">
            <ChevronLeft className="w-4 h-4" />
            <span>{prevName}</span>
          </button>
          <div className="flex items-center gap-3">
            {OVERVIEW_PANELS.map((name, i) => (
              <button key={name} onClick={() => setOverviewPanel(i)}
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all ${
                  i === overviewPanel ? "bg-[#9333EA] text-white shadow-md" : "text-[#1A1A2E]/30 hover:text-[#1A1A2E]/50 hover:bg-black/[0.03]"
                }`}>
                {panelIcons[i]} {name}
              </button>
            ))}
          </div>
          <button onClick={nextPanel} className="flex items-center gap-1.5 text-[12px] text-[#1A1A2E]/30 hover:text-[#9333EA] transition-colors">
            <span>{nextName}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Full-screen panel */}
        <div className={`rounded-2xl bg-gradient-to-b ${panelColors[overviewPanel]} border p-6 min-h-[400px]`}>

        {/* ── 機能パネル ── */}
        {overviewPanel === 0 && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[16px] font-bold text-[#1A1A2E]/80">⚡ 機能</h3>
              <button onClick={() => {
                const newBubble = { id: Date.now(), name: "", description: "", customerValue: "", effects: [], researchData: [] };
                setFunctionBubbles((p) => [...p, newBubble]);
              }} className="flex items-center gap-1 text-[11px] text-[#9333EA] font-semibold hover:underline">
                <Plus className="w-3 h-3" /> 追加
              </button>
            </div>
            <div className="flex flex-wrap gap-4 justify-center">
              {functionBubbles.map((bubble, bi) => (
                <div key={bubble.id}
                  onClick={() => setExpandedBubble(expandedBubble === bi ? null : bi)}
                  className={`w-[140px] h-[140px] rounded-full flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-105 ${
                    expandedBubble === bi
                      ? "bg-[#9333EA] text-white shadow-xl scale-110"
                      : "bg-white border-2 border-[#9333EA]/20 hover:border-[#9333EA]/40 shadow-sm"
                  }`}>
                  <span className={`text-[13px] font-bold ${expandedBubble === bi ? "text-white" : "text-[#1A1A2E]/80"}`}>
                    {bubble.name || "機能名"}
                  </span>
                  <span className={`text-[9px] mt-1 px-2 leading-snug ${expandedBubble === bi ? "text-white/70" : "text-[#1A1A2E]/40"}`}>
                    {bubble.description || "説明"}
                  </span>
                  <span className={`text-[8px] mt-0.5 px-2 ${expandedBubble === bi ? "text-white/50" : "text-[#9333EA]/50"}`}>
                    {bubble.customerValue || "顧客価値"}
                  </span>
                </div>
              ))}
            </div>

            {/* Expanded bubble detail */}
            {expandedBubble !== null && functionBubbles[expandedBubble] && (() => {
              const b = functionBubbles[expandedBubble];
              const bi = expandedBubble;
              return (
                <div className="mt-6 bg-white rounded-xl border border-[#9333EA]/10 p-5 shadow-sm">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="text-[9px] font-bold text-[#1A1A2E]/30 uppercase">機能名</label>
                      <input className="w-full text-[13px] font-bold text-[#1A1A2E]/80 bg-transparent border-b border-black/[0.08] focus:border-[#9333EA]/40 outline-none mt-0.5"
                        value={b.name} onChange={(e) => { const n = [...functionBubbles]; n[bi] = { ...n[bi], name: e.target.value }; setFunctionBubbles(n); }} />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-[#1A1A2E]/30 uppercase">一言説明</label>
                      <input className="w-full text-[12px] text-[#1A1A2E]/60 bg-transparent border-b border-black/[0.08] focus:border-[#9333EA]/40 outline-none mt-0.5"
                        value={b.description} onChange={(e) => { const n = [...functionBubbles]; n[bi] = { ...n[bi], description: e.target.value }; setFunctionBubbles(n); }} />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-[#1A1A2E]/30 uppercase">顧客価値</label>
                      <input className="w-full text-[12px] text-[#9333EA]/70 bg-transparent border-b border-black/[0.08] focus:border-[#9333EA]/40 outline-none mt-0.5"
                        value={b.customerValue} onChange={(e) => { const n = [...functionBubbles]; n[bi] = { ...n[bi], customerValue: e.target.value }; setFunctionBubbles(n); }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-[10px] font-bold text-[#1A1A2E]/40 mb-2">効果・効能</h4>
                      {b.effects.map((ef, ei) => (
                        <div key={ei} className="flex items-center gap-2 mb-1.5">
                          <span className="text-[14px]">{ef.emoji}</span>
                          <input className="flex-1 text-[11px] text-[#1A1A2E]/60 bg-transparent border-b border-black/[0.06] focus:border-[#9333EA]/40 outline-none"
                            value={ef.text} onChange={(e) => { const n = [...functionBubbles]; const efs = [...n[bi].effects]; efs[ei] = { ...efs[ei], text: e.target.value }; n[bi] = { ...n[bi], effects: efs }; setFunctionBubbles(n); }} />
                        </div>
                      ))}
                      <button onClick={() => { const n = [...functionBubbles]; n[bi] = { ...n[bi], effects: [...n[bi].effects, { emoji: "✨", text: "" }] }; setFunctionBubbles(n); }}
                        className="text-[9px] text-[#9333EA]/50 hover:text-[#9333EA] flex items-center gap-1 mt-1"><Plus className="w-2.5 h-2.5" /> 追加</button>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold text-[#1A1A2E]/40 mb-2">研究データ</h4>
                      {b.researchData.map((rd, ri) => (
                        <div key={ri} className="flex items-start gap-2 mb-1.5 bg-[#FAF8F5] rounded-lg px-2 py-1.5">
                          <span className="text-[12px]">{rd.icon}</span>
                          <div className="flex-1 min-w-0">
                            <input className="text-[10px] font-semibold text-[#1A1A2E]/70 bg-transparent outline-none w-full"
                              value={rd.title} onChange={(e) => { const n = [...functionBubbles]; const rds = [...n[bi].researchData]; rds[ri] = { ...rds[ri], title: e.target.value }; n[bi] = { ...n[bi], researchData: rds }; setFunctionBubbles(n); }} />
                            <button onClick={() => setResearchModal({ bubbleIdx: bi, dataIdx: ri })}
                              className="text-[8px] text-[#9333EA] hover:underline mt-0.5">詳細を表示</button>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => { const n = [...functionBubbles]; n[bi] = { ...n[bi], researchData: [...n[bi].researchData, { icon: "📊", title: "", detail: "", source: "" }] }; setFunctionBubbles(n); }}
                        className="text-[9px] text-[#9333EA]/50 hover:text-[#9333EA] flex items-center gap-1 mt-1"><Plus className="w-2.5 h-2.5" /> 追加</button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── デザインパネル ── */}
        {overviewPanel === 1 && (
          <div>
            <h3 className="text-[16px] font-bold text-[#1A1A2E]/80 mb-5">🎨 デザイン</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-[11px] font-bold text-[#1A1A2E]/40 mb-3">カラーパレット</h4>
                <div className="flex gap-4">
                  {designColors.map((dc, di) => (
                    <div key={dc.key} className="flex flex-col items-center gap-1.5">
                      <label htmlFor={`color-${dc.key}`} className="cursor-pointer">
                        <div className="w-14 h-14 rounded-full border-2 border-white shadow-lg" style={{ backgroundColor: dc.color }} />
                      </label>
                      <input id={`color-${dc.key}`} type="color" value={dc.color} className="sr-only"
                        onChange={(e) => { const n = [...designColors]; n[di] = { ...n[di], color: e.target.value }; setDesignColors(n); }} />
                      <span className="text-[9px] font-medium text-[#1A1A2E]/50">{dc.label}</span>
                      <span className="text-[8px] text-[#1A1A2E]/25 font-mono">{dc.color}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-[#1A1A2E]/40 mb-3">ムードボード</h4>
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="aspect-video rounded-lg border-2 border-dashed border-black/10 bg-white flex items-center justify-center">
                      <Image className="w-5 h-5 text-[#1A1A2E]/10" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 体験パネル ── */}
        {overviewPanel === 2 && (
          <div>
            <h3 className="text-[16px] font-bold text-[#1A1A2E]/80 mb-5">💫 体験</h3>
            <div className="relative bg-white rounded-2xl border border-black/[0.06] p-8 min-h-[280px]">
              {emotionKeywords.map((kw, ki) => (
                <div key={kw.id} className="absolute" style={{ left: `${kw.x}%`, top: `${kw.y}%`, transform: "translate(-50%, -50%)" }}>
                  <div className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-full px-3 py-1.5 shadow-sm cursor-default hover:shadow-md transition-shadow">
                    <span className="text-[16px]">{kw.emoji}</span>
                    <input className="text-[11px] font-medium text-[#1A1A2E]/70 bg-transparent outline-none w-16"
                      value={kw.text} onChange={(e) => { const n = [...emotionKeywords]; n[ki] = { ...n[ki], text: e.target.value }; setEmotionKeywords(n); }} />
                  </div>
                </div>
              ))}
              <button onClick={() => setEmotionKeywords((p) => [...p, { id: Date.now(), emoji: "💡", text: "", x: 50, y: 50 }])}
                className="absolute bottom-3 right-3 text-[9px] text-[#1A1A2E]/20 hover:text-[#9333EA] flex items-center gap-1"><Plus className="w-3 h-3" /> キーワード追加</button>
            </div>
            <div className="mt-4 space-y-2">
              <h4 className="text-[11px] font-bold text-[#1A1A2E]/40">体験の声</h4>
              {experienceQuotes.map((q, qi) => (
                <div key={q.id} className="bg-white rounded-lg border border-black/[0.06] px-4 py-2.5 flex items-start gap-2">
                  <span className="text-[14px] shrink-0">💬</span>
                  <div className="flex-1 min-w-0">
                    <textarea className="text-[11px] text-[#1A1A2E]/60 bg-transparent outline-none w-full resize-none" rows={1}
                      value={q.text} onChange={(e) => { const n = [...experienceQuotes]; n[qi] = { ...n[qi], text: e.target.value }; setExperienceQuotes(n); }} />
                    <input className="text-[9px] text-[#1A1A2E]/30 bg-transparent outline-none"
                      value={q.author} onChange={(e) => { const n = [...experienceQuotes]; n[qi] = { ...n[qi], author: e.target.value }; setExperienceQuotes(n); }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ストーリーパネル ── */}
        {overviewPanel === 3 && (
          <div>
            <h3 className="text-[16px] font-bold text-[#1A1A2E]/80 mb-5">📖 ストーリー</h3>
            <div className="relative flex items-start gap-0 overflow-x-auto pb-4">
              {storyNodes.map((node, ni) => (
                <div key={node.id} className="flex items-start shrink-0">
                  <div className="flex flex-col items-center" style={{ width: 160 }}>
                    <div className="w-10 h-10 rounded-full bg-[#9333EA] text-white flex items-center justify-center text-[13px] font-bold shadow-md">
                      {ni + 1}
                    </div>
                    <input className="text-[11px] font-bold text-[#9333EA] bg-transparent outline-none text-center mt-2 w-24"
                      value={node.year} onChange={(e) => { const n = [...storyNodes]; n[ni] = { ...n[ni], year: e.target.value }; setStoryNodes(n); }} />
                    <textarea className="text-[10px] text-[#1A1A2E]/60 bg-transparent outline-none text-center resize-none mt-1 w-[140px]" rows={2}
                      value={node.description} onChange={(e) => { const n = [...storyNodes]; n[ni] = { ...n[ni], description: e.target.value }; setStoryNodes(n); }} />
                  </div>
                  {ni < storyNodes.length - 1 && (
                    <div className="w-12 h-0.5 bg-[#9333EA]/30 mt-5 shrink-0" />
                  )}
                </div>
              ))}
              <button onClick={() => setStoryNodes((p) => [...p, { id: Date.now(), year: "", description: "" }])}
                className="shrink-0 w-10 h-10 rounded-full border-2 border-dashed border-[#9333EA]/20 hover:border-[#9333EA]/40 flex items-center justify-center mt-0 ml-2 text-[#9333EA]/30 hover:text-[#9333EA] transition-all">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── オファーパネル ── */}
        {overviewPanel === 4 && (
          <div>
            <h3 className="text-[16px] font-bold text-[#1A1A2E]/80 mb-5">🏷️ オファー</h3>
            <div className="grid grid-cols-2 gap-6">
              {offerPlans.map((plan, pi) => (
                <div key={pi} className={`rounded-xl border-2 p-5 ${pi === 1 ? "border-[#9333EA] bg-[#9333EA]/[0.02] shadow-lg" : "border-black/[0.06] bg-white"}`}>
                  {pi === 1 && <span className="text-[9px] font-bold text-[#9333EA] bg-[#9333EA]/10 px-2 py-0.5 rounded-full mb-2 inline-block">おすすめ</span>}
                  <input className="text-[15px] font-bold text-[#1A1A2E]/80 bg-transparent outline-none w-full mb-1"
                    value={plan.title} onChange={(e) => { const n = [...offerPlans]; n[pi] = { ...n[pi], title: e.target.value }; setOfferPlans(n); }} />
                  <input className="text-[20px] font-bold text-[#9333EA] bg-transparent outline-none w-full mb-3"
                    value={plan.price} onChange={(e) => { const n = [...offerPlans]; n[pi] = { ...n[pi], price: e.target.value }; setOfferPlans(n); }} />
                  <div className="space-y-1.5">
                    {plan.items.map((item, ii) => (
                      <div key={ii} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        <input className="text-[11px] text-[#1A1A2E]/60 bg-transparent outline-none flex-1"
                          value={item} onChange={(e) => { const n = [...offerPlans]; const items = [...n[pi].items]; items[ii] = e.target.value; n[pi] = { ...n[pi], items }; setOfferPlans(n); }} />
                      </div>
                    ))}
                    <button onClick={() => { const n = [...offerPlans]; n[pi] = { ...n[pi], items: [...n[pi].items, ""] }; setOfferPlans(n); }}
                      className="text-[9px] text-[#9333EA]/40 hover:text-[#9333EA] flex items-center gap-1 mt-1"><Plus className="w-2.5 h-2.5" /> 追加</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        </div>
      </div>
    );
  }

  // (legacy panels removed - now full-screen panel switching)
  // ─── Sub-tab 2 end ─────────────────────────────────────
  // (旧パネルコードは全画面パネル切替に移行済み)

  // ─── Sub-tab 3: 口コミ・権威性 ─────────────────────────
  function renderReviewsTab() {
    const maxScroll = Math.max(0, reviewCards.length - 3);
    return (
      <div className="space-y-8">
        {/* 口コミ・レビュー */}
        <section>
          {sectionHeader("口コミ・レビュー", "ユーザーの声を収集・管理")}
          <div className="relative">
            {reviewScrollIdx > 0 && (
              <button
                onClick={() => setReviewScrollIdx((p) => Math.max(0, p - 1))}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center text-[#1A1A2E]/60 hover:text-[#9333EA] transition-colors -ml-4"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {reviewScrollIdx < maxScroll && (
              <button
                onClick={() => setReviewScrollIdx((p) => Math.min(maxScroll, p + 1))}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center text-[#1A1A2E]/60 hover:text-[#9333EA] transition-colors -mr-4"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            <div className="overflow-hidden">
              <div
                className="flex gap-4 transition-transform duration-300"
                style={{ transform: `translateX(-${reviewScrollIdx * 296}px)` }}
              >
                {reviewCards.map((card, ri) => (
                  <div key={card.id} className="min-w-[280px] max-w-[280px] bg-white rounded-xl border border-black/[0.06] shadow-sm overflow-hidden relative group">
                    <button
                      onClick={() => setReviewCards((p) => p.filter((_, i) => i !== ri))}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/90 shadow flex items-center justify-center text-[#1A1A2E]/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all z-10"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="p-4 space-y-2">
                      {renderStars(card.rating, (r) => {
                        const next = [...reviewCards]; next[ri] = { ...next[ri], rating: r }; setReviewCards(next);
                      })}
                      <textarea
                        className="w-full text-[12px] text-[#1A1A2E]/80 bg-transparent outline-none resize-none line-clamp-3"
                        rows={3}
                        value={card.text}
                        onChange={(e) => {
                          const next = [...reviewCards]; next[ri] = { ...next[ri], text: e.target.value }; setReviewCards(next);
                        }}
                      />
                      <div className="aspect-video border-2 border-dashed border-black/10 rounded-lg flex items-center justify-center bg-[#FAF8F5]">
                        <span className="text-[10px] text-[#1A1A2E]/30">スクリーンショット</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 bg-[#9333EA]/10 text-[#9333EA] text-[10px] font-semibold rounded-full px-2 py-0.5">
                          <Globe className="w-3 h-3" />
                          <input
                            className="bg-transparent outline-none text-[10px] w-16"
                            value={card.source}
                            onChange={(e) => {
                              const next = [...reviewCards]; next[ri] = { ...next[ri], source: e.target.value }; setReviewCards(next);
                            }}
                          />
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-[#1A1A2E]/40">
                        <input className="bg-transparent outline-none text-[10px] w-20" value={card.author}
                          onChange={(e) => { const next = [...reviewCards]; next[ri] = { ...next[ri], author: e.target.value }; setReviewCards(next); }} placeholder="投稿者名" />
                        <input className="bg-transparent outline-none text-[10px] w-24 text-right" value={card.date}
                          onChange={(e) => { const next = [...reviewCards]; next[ri] = { ...next[ri], date: e.target.value }; setReviewCards(next); }} placeholder="日付" />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setReviewCards((p) => [...p, { id: Date.now(), rating: 5, text: "", source: "", author: "", date: "" }])}
                  className="min-w-[280px] max-w-[280px] bg-white/50 rounded-xl border-2 border-dashed border-black/[0.08] flex flex-col items-center justify-center gap-2 hover:border-[#9333EA]/30 hover:bg-[#9333EA]/5 transition-all group"
                >
                  <Plus className="w-6 h-6 text-[#1A1A2E]/20 group-hover:text-[#9333EA]/50 transition-colors" />
                  <span className="text-[12px] font-medium text-[#1A1A2E]/30 group-hover:text-[#9333EA]/50 transition-colors">追加</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 受賞歴 */}
        <section>
          {sectionHeader("受賞歴", "獲得した賞・認定")}
          <div className="flex flex-wrap gap-6">
            {awards.map((aw, ai) => (
              <div key={aw.id} className="flex flex-col items-center gap-2 group relative">
                <button
                  onClick={() => setAwards((p) => p.filter((_, i) => i !== ai))}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center text-[#1A1A2E]/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all z-10"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#9333EA] to-[#6D28D9] flex items-center justify-center shadow-lg">
                  <textarea
                    className="w-16 h-12 bg-transparent text-white text-[10px] font-bold text-center outline-none resize-none flex items-center justify-center"
                    value={aw.name}
                    onChange={(e) => { const next = [...awards]; next[ai] = { ...next[ai], name: e.target.value }; setAwards(next); }}
                  />
                </div>
                <input className="text-[11px] text-[#1A1A2E]/60 font-semibold bg-transparent outline-none text-center w-16" value={aw.year}
                  onChange={(e) => { const next = [...awards]; next[ai] = { ...next[ai], year: e.target.value }; setAwards(next); }} />
              </div>
            ))}
            <button
              onClick={() => setAwards((p) => [...p, { id: Date.now(), name: "", year: "" }])}
              className="w-24 h-24 rounded-full border-2 border-dashed border-black/[0.08] flex items-center justify-center hover:border-[#9333EA]/30 hover:bg-[#9333EA]/5 transition-all"
            >
              <Plus className="w-5 h-5 text-[#1A1A2E]/20" />
            </button>
          </div>
        </section>

        {/* メディア掲載実績 */}
        <section>
          {sectionHeader("メディア掲載実績", "掲載メディア・取材実績")}
          <div className="flex flex-wrap gap-6">
            {media.map((m, mi) => (
              <div key={m.id} className="flex flex-col items-center gap-2 group relative">
                <button
                  onClick={() => setMedia((p) => p.filter((_, i) => i !== mi))}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center text-[#1A1A2E]/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all z-10"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg">
                  <textarea
                    className="w-16 h-12 bg-transparent text-white text-[10px] font-bold text-center outline-none resize-none"
                    value={m.name}
                    onChange={(e) => { const next = [...media]; next[mi] = { ...next[mi], name: e.target.value }; setMedia(next); }}
                  />
                </div>
                <input className="text-[11px] text-[#1A1A2E]/60 font-semibold bg-transparent outline-none text-center w-20" value={m.date}
                  onChange={(e) => { const next = [...media]; next[mi] = { ...next[mi], date: e.target.value }; setMedia(next); }} />
              </div>
            ))}
            <button
              onClick={() => setMedia((p) => [...p, { id: Date.now(), name: "", date: "" }])}
              className="w-24 h-24 rounded-full border-2 border-dashed border-black/[0.08] flex items-center justify-center hover:border-[#9333EA]/30 hover:bg-[#9333EA]/5 transition-all"
            >
              <Plus className="w-5 h-5 text-[#1A1A2E]/20" />
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ─── Sub-tab 4: 提供体制 ───────────────────────────────
  function renderOperationsTab() {
    return (
      <div className="space-y-8">
        {flowSections.map((section, si) => (
          <section key={section.title}>
            {sectionHeader(section.title)}
            <div className="bg-white rounded-xl border border-black/[0.06] shadow-sm p-6">
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {section.nodes.map((node, ni) => (
                  <div key={node.id} className="flex items-center gap-2 shrink-0">
                    <div className="relative group">
                      <div className="bg-white border-2 border-[#9333EA]/20 rounded-xl px-4 py-3 min-w-[140px] shadow-sm hover:border-[#9333EA]/40 transition-colors">
                        <input
                          className="text-[12px] text-[#1A1A2E] font-medium bg-transparent outline-none w-full text-center"
                          value={node.text}
                          onChange={(e) => {
                            const next = [...flowSections];
                            const nodes = [...next[si].nodes];
                            nodes[ni] = { ...nodes[ni], text: e.target.value };
                            next[si] = { ...next[si], nodes };
                            setFlowSections(next);
                          }}
                        />
                      </div>
                      <button
                        onClick={() => {
                          const next = [...flowSections];
                          next[si] = { ...next[si], nodes: next[si].nodes.filter((_, i) => i !== ni) };
                          setFlowSections(next);
                        }}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center text-[#1A1A2E]/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    {ni < section.nodes.length - 1 && (
                      <ArrowRight className="w-5 h-5 text-[#9333EA]/40 shrink-0" />
                    )}
                  </div>
                ))}
                <button
                  onClick={() => {
                    const next = [...flowSections];
                    next[si] = { ...next[si], nodes: [...next[si].nodes, { id: Date.now(), text: "" }] };
                    setFlowSections(next);
                  }}
                  className="shrink-0 w-10 h-10 rounded-xl border-2 border-dashed border-black/[0.08] flex items-center justify-center hover:border-[#9333EA]/30 hover:bg-[#9333EA]/5 transition-all"
                >
                  <Plus className="w-4 h-4 text-[#1A1A2E]/20" />
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>
    );
  }

  // ─── Sub-tab 5: 製品体験ログ ───────────────────────────
  function renderExperienceLogTab() {
    const tagColors = ["bg-purple-100 text-purple-700", "bg-blue-100 text-blue-700", "bg-green-100 text-green-700", "bg-amber-100 text-amber-700", "bg-pink-100 text-pink-700"];
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <button
            onClick={() => setExperienceLogs((p) => [{ id: Date.now(), date: new Date().toISOString().split("T")[0], tags: [], text: "" }, ...p])}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#9333EA] text-white text-[12px] font-semibold hover:bg-[#7C22CB] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> 新しいログを追加
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {experienceLogs.map((log, li) => (
            <div key={log.id} className="bg-white rounded-xl border border-black/[0.06] shadow-sm overflow-hidden relative group">
              <button
                onClick={() => setExperienceLogs((p) => p.filter((_, i) => i !== li))}
                className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/90 shadow flex items-center justify-center text-[#1A1A2E]/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all z-10"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#9333EA]" />
                  <input
                    type="date"
                    className="text-[14px] font-bold text-[#1A1A2E] bg-transparent outline-none"
                    value={log.date}
                    onChange={(e) => { const next = [...experienceLogs]; next[li] = { ...next[li], date: e.target.value }; setExperienceLogs(next); }}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {log.tags.map((tag, ti) => (
                    <span key={ti} className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${tagColors[ti % tagColors.length]}`}>
                      <input className="bg-transparent outline-none text-[10px] w-16" value={tag}
                        onChange={(e) => { const next = [...experienceLogs]; const tags = [...next[li].tags]; tags[ti] = e.target.value; next[li] = { ...next[li], tags }; setExperienceLogs(next); }} />
                      <button onClick={() => { const next = [...experienceLogs]; next[li] = { ...next[li], tags: next[li].tags.filter((_, i) => i !== ti) }; setExperienceLogs(next); }}>
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                  <button onClick={() => { const next = [...experienceLogs]; next[li] = { ...next[li], tags: [...next[li].tags, ""] }; setExperienceLogs(next); }}
                    className="text-[10px] text-[#9333EA]/60 hover:text-[#9333EA] font-semibold flex items-center gap-0.5">
                    <Plus className="w-3 h-3" /> タグ
                  </button>
                </div>
                <div className="aspect-video border-2 border-dashed border-black/10 rounded-lg flex items-center justify-center bg-[#FAF8F5]">
                  <span className="text-[10px] text-[#1A1A2E]/30">画像をアップロード（任意）</span>
                </div>
                <textarea
                  className={inputClass + " text-[12px] resize-none"}
                  rows={4}
                  value={log.text}
                  onChange={(e) => { const next = [...experienceLogs]; next[li] = { ...next[li], text: e.target.value }; setExperienceLogs(next); }}
                  placeholder="体験内容を記録..."
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Sub-tab 6: USP ──────────────────────────────────
  function renderUSPTab() {
    return (
      <div className="space-y-6">
        {sectionHeader("USPカード", "独自の強み・差別化ポイント")}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {uspCards.map((usp, ui) => (
            <div key={usp.id} className="bg-white rounded-xl border border-black/[0.06] shadow-sm p-5 relative group">
              <button
                onClick={() => setUSPCards((p) => p.filter((_, i) => i !== ui))}
                className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white shadow flex items-center justify-center text-[#1A1A2E]/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <input
                className="text-[16px] font-bold text-[#1A1A2E] bg-transparent outline-none w-full mb-3 placeholder-[#1A1A2E]/20"
                value={usp.title}
                onChange={(e) => setUSPCards((p) => p.map((c, i) => i === ui ? { ...c, title: e.target.value } : c))}
                placeholder="USPタイトル"
              />
              <div className="mb-3">
                <label className="text-[10px] text-[#1A1A2E]/50 font-semibold mb-1 block">紐づく機能価値</label>
                <div className="flex flex-wrap gap-1.5">
                  {usp.functionTags.map((tag, ti) => (
                    <span key={ti} className="inline-flex items-center gap-1 bg-[#9333EA]/10 text-[#9333EA] text-[10px] font-semibold rounded-full px-2.5 py-1">
                      <input className="bg-transparent outline-none text-[10px] w-20" value={tag}
                        onChange={(e) => { const next = [...uspCards]; const tags = [...next[ui].functionTags]; tags[ti] = e.target.value; next[ui] = { ...next[ui], functionTags: tags }; setUSPCards(next); }} />
                      <button onClick={() => { const next = [...uspCards]; next[ui] = { ...next[ui], functionTags: next[ui].functionTags.filter((_, i) => i !== ti) }; setUSPCards(next); }}>
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                  <button onClick={() => { const next = [...uspCards]; next[ui] = { ...next[ui], functionTags: [...next[ui].functionTags, ""] }; setUSPCards(next); }}
                    className="inline-flex items-center gap-0.5 text-[10px] text-[#9333EA]/60 hover:text-[#9333EA] font-semibold">
                    <Plus className="w-3 h-3" /> タグ追加
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-[#1A1A2E]/50 font-semibold mb-1 block">提供便益</label>
                <textarea
                  className={inputClass + " text-[12px] resize-none"}
                  rows={2}
                  value={usp.benefit}
                  onChange={(e) => setUSPCards((p) => p.map((c, i) => i === ui ? { ...c, benefit: e.target.value } : c))}
                  placeholder="提供便益を入力"
                />
              </div>
            </div>
          ))}
          <button
            onClick={() => setUSPCards((p) => [...p, { id: Date.now(), title: "", functionTags: [], benefit: "" }])}
            className="bg-white/50 rounded-xl border-2 border-dashed border-black/[0.08] flex flex-col items-center justify-center gap-2 py-12 hover:border-[#9333EA]/30 hover:bg-[#9333EA]/5 transition-all group"
          >
            <Plus className="w-6 h-6 text-[#1A1A2E]/20 group-hover:text-[#9333EA]/50 transition-colors" />
            <span className="text-[12px] font-medium text-[#1A1A2E]/30 group-hover:text-[#9333EA]/50 transition-colors">USP追加</span>
          </button>
        </div>
      </div>
    );
  }

  // ─── Tab: 商品リサーチ (with sub-tabs) ─────────────────
  function renderProductTab() {
    return (
      <div className="space-y-6">
        {/* Product sub-tabs */}
        <div className="flex items-center gap-1 bg-white rounded-xl border border-black/[0.06] p-1 shadow-sm w-fit">
          {PRODUCT_SUB_TABS.map((sub) => (
            <button
              key={sub.key}
              onClick={() => setProductSubTab(sub.key)}
              className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-all ${
                productSubTab === sub.key
                  ? "bg-[#9333EA] text-white shadow-sm"
                  : "text-[#1A1A2E]/50 hover:text-[#9333EA] hover:bg-[#9333EA]/5"
              }`}
            >
              {sub.label}
            </button>
          ))}
        </div>

        {productSubTab === "hero" && renderHeroTab()}
        {productSubTab === "overview" && renderOverviewTab()}
        {productSubTab === "reviews" && renderReviewsTab()}
        {productSubTab === "operations" && renderOperationsTab()}
        {productSubTab === "experienceLog" && renderExperienceLogTab()}
        {productSubTab === "usp" && renderUSPTab()}
      </div>
    );
  }

  // ─── Tab: 市場リサーチ ──────────────────────────────
  function renderMarketTab() {
    return (
      <div className="space-y-8">
        {/* 市場/競合調査 */}
        <section>
          {sectionHeader("市場/競合調査", "市場ごとに競合情報を整理")}
          <div className="bg-white rounded-xl border border-black/[0.06] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-black/[0.06]">
                    <th className="sticky left-0 z-10 bg-[#FAF8F5] text-left text-[11px] font-bold text-[#1A1A2E]/50 px-4 py-3 w-[180px] min-w-[180px]">
                      項目
                    </th>
                    {marketCols.map((col, ci) => (
                      <th key={ci} className="text-left text-[11px] font-bold text-[#9333EA]/70 px-4 py-3 min-w-[200px]">
                        <input
                          className="bg-transparent border-none outline-none text-[11px] font-bold text-[#9333EA]/70 w-full"
                          value={col}
                          onChange={(e) => { const next = [...marketCols]; next[ci] = e.target.value; setMarketCols(next); }}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {marketRows.map((row, ri) => (
                    <tr key={row.label} className={ri % 2 === 0 ? "bg-white" : "bg-[#FAF8F5]/50"}>
                      <td className="sticky left-0 z-10 px-4 py-2.5 text-[12px] font-semibold text-[#1A1A2E]/70 border-r border-black/[0.04] bg-inherit">
                        {row.label}
                      </td>
                      {row.values.map((val, ci) => (
                        <td key={ci} className="px-3 py-2">
                          <input
                            className={inputClass + " text-[12px]"}
                            value={val}
                            onChange={(e) => updateMarketCell(ri, ci, e.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 参考クリエイティブ */}
        <section>
          {sectionHeader("参考クリエイティブ", "競合や参考にしたい広告クリエイティブ")}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {refCreatives.map((cr, idx) => (
              <div key={cr.id} className="bg-white rounded-xl border border-black/[0.06] shadow-sm overflow-hidden group">
                <div className="aspect-video bg-gradient-to-br from-[#9333EA]/10 to-[#9333EA]/5 flex items-center justify-center relative">
                  <Image className="w-8 h-8 text-[#9333EA]/30" />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setRefCreatives((prev) => prev.filter((_, i) => i !== idx))}
                      className="w-6 h-6 rounded-full bg-white/90 shadow flex items-center justify-center text-[#1A1A2E]/40 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  <input
                    className={inputClass + " font-semibold text-[13px]"}
                    value={cr.name}
                    onChange={(e) => { const next = [...refCreatives]; next[idx] = { ...next[idx], name: e.target.value }; setRefCreatives(next); }}
                    placeholder="クリエイティブ名"
                  />
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#9333EA]/10 text-[#9333EA] text-[10px] font-semibold shrink-0">
                      <Globe className="w-3 h-3" />
                      <input className="bg-transparent outline-none w-16 text-[10px]" value={cr.platform}
                        onChange={(e) => { const next = [...refCreatives]; next[idx] = { ...next[idx], platform: e.target.value }; setRefCreatives(next); }} />
                    </div>
                    <input className={inputClass + " text-[11px] flex-1"} value={cr.url}
                      onChange={(e) => { const next = [...refCreatives]; next[idx] = { ...next[idx], url: e.target.value }; setRefCreatives(next); }} placeholder="URL" />
                  </div>
                  <textarea className={inputClass + " text-[11px] resize-none"} rows={2} value={cr.notes}
                    onChange={(e) => { const next = [...refCreatives]; next[idx] = { ...next[idx], notes: e.target.value }; setRefCreatives(next); }} placeholder="メモ・特徴" />
                </div>
              </div>
            ))}
            <button
              onClick={() => setRefCreatives((prev) => [...prev, { id: Date.now(), name: "", platform: "", url: "", notes: "" }])}
              className="bg-white/50 rounded-xl border-2 border-dashed border-black/[0.08] flex flex-col items-center justify-center gap-2 py-12 hover:border-[#9333EA]/30 hover:bg-[#9333EA]/5 transition-all group"
            >
              <Plus className="w-6 h-6 text-[#1A1A2E]/20 group-hover:text-[#9333EA]/50 transition-colors" />
              <span className="text-[12px] font-medium text-[#1A1A2E]/30 group-hover:text-[#9333EA]/50 transition-colors">追加</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ─── Tab: 顧客リサーチ ──────────────────────────────
  function renderCustomerTab() {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-1 bg-white rounded-xl border border-black/[0.06] p-1 w-fit shadow-sm">
          {(["potential", "existing"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setCustomerSub(key)}
              className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-all ${
                customerSub === key
                  ? "bg-[#9333EA] text-white shadow-sm"
                  : "text-[#1A1A2E]/50 hover:text-[#9333EA] hover:bg-[#9333EA]/5"
              }`}
            >
              {key === "potential" ? "潜在顧客調査" : "既存顧客調査"}
            </button>
          ))}
        </div>

        {surveys.map((sec, si) => (
          <section key={sec.title}>
            <div className="mb-2">
              <h3 className="text-[13px] font-bold text-[#1A1A2E]">{sec.title}</h3>
            </div>
            <div className="bg-white rounded-xl border border-black/[0.06] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-b border-black/[0.06]">
                      <th className="sticky left-0 z-10 bg-[#FAF8F5] text-left text-[10px] font-bold text-[#1A1A2E]/50 px-3 py-2 w-[50px]">#</th>
                      <th className="text-left text-[10px] font-bold text-[#1A1A2E]/50 px-3 py-2 w-[140px] min-w-[140px]">ソース</th>
                      <th className="text-left text-[10px] font-bold text-[#1A1A2E]/50 px-3 py-2 w-[200px] min-w-[200px]">項目</th>
                      {PERCENTAGE_COLUMNS.map((pc) => (
                        <th key={pc} className="text-center text-[10px] font-bold text-[#9333EA]/60 px-3 py-2 min-w-[80px]">{pc}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sec.rows.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-[#FAF8F5]/50"}>
                        <td className="sticky left-0 z-10 bg-inherit px-3 py-2 text-[11px] font-semibold text-[#1A1A2E]/40 border-r border-black/[0.04]">{row.label}</td>
                        <td className="px-2 py-1.5"><input className={inputClass + " text-[11px]"} value={row.source} onChange={(e) => updateSurveyCell(si, ri, "source", e.target.value)} /></td>
                        <td className="px-2 py-1.5"><input className={inputClass + " text-[11px]"} value={row.item} onChange={(e) => updateSurveyCell(si, ri, "item", e.target.value)} /></td>
                        {row.percentages.map((pct, pi) => (
                          <td key={pi} className="px-2 py-1.5"><input className={inputClass + " text-[11px] text-center"} value={pct} onChange={(e) => updateSurveyPercentage(si, ri, pi, e.target.value)} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ))}
      </div>
    );
  }

  // ─── Main render ────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white rounded-xl border border-black/[0.06] p-1 mb-6 shadow-sm w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[12px] font-semibold transition-all ${
                activeTab === tab.key
                  ? "bg-[#9333EA] text-white shadow-sm"
                  : "text-[#1A1A2E]/50 hover:text-[#9333EA] hover:bg-[#9333EA]/5"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "product" && renderProductTab()}
        {activeTab === "market" && renderMarketTab()}
        {activeTab === "customer" && renderCustomerTab()}
      </div>

      {/* Voice input */}
      <VoiceInputButton
        onTranscript={(text) => console.log("Voice transcript:", text)}
        onFeedback={(text) => console.log("Voice feedback:", text)}
      />
    </div>
  );
}
