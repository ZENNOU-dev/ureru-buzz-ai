"use client";

import { use, useState, useCallback } from "react";
import {
  Search, Package, TrendingUp, Users, Globe, Star, Shield, Truck,
  Heart, DollarSign, ExternalLink, Image, Plus, X, ChevronRight,
  ChevronLeft, ChevronDown, ChevronUp, Zap, Palette, BookOpen, Award, Tag, Building,
  ArrowRight, Calendar, MessageSquare,
} from "lucide-react";
import { VoiceInputButton } from "@/components/voice-input-button";

// ─── Types ────────────────────────────────────────────
type TabKey = "product" | "market" | "customer";
type ProductSubTab = "overview" | "reviews" | "operations" | "experienceLog";
type CustomerSub = "potential" | "existing";

// Product Overview types
type HeroInfo = {
  productName: string;
  logoText: string;
  category: string;
  prevYearSales: string;
  offer: string;
};

type FunctionItem = { name: string; description: string; effect: string };
type ResearchItem = { data: string };
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
type FlowNode = { id: number; text: string };
type FlowSection = { title: string; nodes: FlowNode[] };
type ExperienceLog = {
  id: number;
  date: string;
  tags: string[];
  text: string;
};
type USPCard = {
  id: number;
  title: string;
  functionTags: string[];
  benefit: string;
};

type ValueCardData = {
  key: string;
  title: string;
  icon: React.ReactNode;
  summary: string;
  expanded: boolean;
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
  { key: "overview", label: "商品概要" },
  { key: "reviews", label: "口コミ・権威性" },
  { key: "operations", label: "提供体制" },
  { key: "experienceLog", label: "製品体験ログ" },
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
    prevYearSales: "—",
    offer: "無料相談 + 限定特典",
  };
}

function makeValueCards(): ValueCardData[] {
  return [
    { key: "function", title: "機能", icon: <Zap className="w-5 h-5" />, summary: "AIツール提供 + SNS運用スキル + 案件獲得サポート", expanded: false },
    { key: "design", title: "デザイン", icon: <Palette className="w-5 h-5" />, summary: "ダークネイビー × パープル × ゴールドのプレミアム感", expanded: false },
    { key: "experience", title: "体験", icon: <Heart className="w-5 h-5" />, summary: "直感的AIツールで初心者でも最先端を体感", expanded: false },
    { key: "story", title: "ストーリー", icon: <BookOpen className="w-5 h-5" />, summary: "連続起業家が自らの経験から生み出した実践型AI教育", expanded: false },
    { key: "authority", title: "権威性", icon: <Award className="w-5 h-5" />, summary: "AIスクールランキング1位・Forbes掲載・累計500名", expanded: false },
    { key: "offer", title: "オファー", icon: <Tag className="w-5 h-5" />, summary: "498,000円（税込）・無料相談+AIツール永久利用権", expanded: false },
    { key: "operations", title: "提供体制", icon: <Building className="w-5 h-5" />, summary: "オンライン完結型・専属メンター・LINEサポート24h", expanded: false },
  ];
}

function makeFunctionItems(): FunctionItem[] {
  return [
    { name: "AIツール提供", description: "独自開発のAIツールセット", effect: "SNS投稿の半自動化" },
    { name: "SNS運用スキル", description: "実践的なSNSマーケティング講座", effect: "フォロワー獲得・案件受注" },
    { name: "案件獲得サポート", description: "メンターによる案件紹介", effect: "受講3ヶ月以内に80%が案件獲得" },
  ];
}

function makeDesignColors() {
  return {
    base: "#1A1A2E",
    main: "#9333EA",
    accent: "#F59E0B",
    text: "#FFFFFF",
    brandImage: "AI時代の先駆者・実践派。最先端テクノロジーを身近にするプレミアムブランド。",
  };
}

function makeExperienceData() {
  return {
    usability: "直感的なAIツールで初心者でも簡単に操作可能。チュートリアルも充実。",
    feeling: "最先端を使いこなしている感覚。未来のスキルを手にしている実感。",
  };
}

function makeStoryData() {
  return {
    story: "「AIで人生を変える」—連続起業家が自らの失敗と成功を経て、本当に使えるAIスキルを教えるために立ち上げたプロジェクト。従来のプログラミングスクールでは実践に結びつかないことに疑問を感じ、ツール提供と実務直結型カリキュラムを融合。",
    brandStory: "テクノロジーは一部の人のものではない。誰でもAIを使いこなし、新しい働き方を実現できる世界を創る。",
  };
}

function makeAuthorityData() {
  return {
    celebrity: "連続起業家監修",
    salesRecord: "累計受講者500名突破",
    researchData: [
      { data: "受講生の80%が3ヶ月以内に案件獲得" },
      { data: "受講後の平均月収+15万円" },
    ] as ResearchItem[],
  };
}

function makeOfferData() {
  return {
    normalPrice: "498,000円（税込）",
    offerContent: "無料相談 + 特典（AIツール永久利用権）\n入会金50%OFF（先着30名）",
    exclusivity: "毎月先着30名限定",
  };
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
  const [productSubTab, setProductSubTab] = useState<ProductSubTab>("overview");

  // Product Overview state
  const [heroInfo, setHeroInfo] = useState<HeroInfo>(makeHeroInfo);
  const [valueCards, setValueCards] = useState<ValueCardData[]>(makeValueCards);
  const [functionItems, setFunctionItems] = useState<FunctionItem[]>(makeFunctionItems);
  const [designColors, setDesignColors] = useState(makeDesignColors);
  const [experienceData, setExperienceData] = useState(makeExperienceData);
  const [storyData, setStoryData] = useState(makeStoryData);
  const [authorityData, setAuthorityData] = useState(makeAuthorityData);
  const [offerData, setOfferData] = useState(makeOfferData);
  const [uspCards, setUSPCards] = useState<USPCard[]>(makeUSPCards);

  // Reviews & Authority state
  const [reviewCards, setReviewCards] = useState<ReviewCard[]>(makeReviewCards);
  const [reviewScrollIdx, setReviewScrollIdx] = useState(0);
  const [awards, setAwards] = useState<AwardBubble[]>(makeAwards);
  const [media, setMedia] = useState<MediaBubble[]>(makeMedia);

  // Operations state
  const [flowSections, setFlowSections] = useState<FlowSection[]>(makeFlowSections);

  // Experience Log state
  const [experienceLogs, setExperienceLogs] = useState<ExperienceLog[]>(makeExperienceLogs);

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

  const toggleValueCard = (idx: number) => {
    setValueCards((prev) => prev.map((c, i) => i === idx ? { ...c, expanded: !c.expanded } : c));
  };

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

  // ─── Sub-tab: 商品概要 ───────────────────────────────
  function renderOverviewTab() {
    return (
      <div className="space-y-8">
        {/* Hero Section */}
        <section className="rounded-2xl bg-gradient-to-r from-[#9333EA] to-[#6D28D9] p-8 shadow-lg">
          <div className="flex items-start gap-6">
            {/* Logo placeholder */}
            <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-md">
              <input
                className="w-full h-full text-center text-[#9333EA] font-bold text-sm bg-transparent outline-none rounded-2xl"
                value={heroInfo.logoText}
                onChange={(e) => setHeroInfo((p) => ({ ...p, logoText: e.target.value }))}
              />
            </div>
            <div className="flex-1 space-y-3">
              <input
                className="bg-transparent text-white text-3xl font-bold outline-none w-full placeholder-white/40"
                value={heroInfo.productName}
                onChange={(e) => setHeroInfo((p) => ({ ...p, productName: e.target.value }))}
                placeholder="商品名を入力"
              />
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-white/70 text-[12px]">カテゴリー:</span>
                  <input
                    className="bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-[12px] text-white outline-none w-48 placeholder-white/30"
                    value={heroInfo.category}
                    onChange={(e) => setHeroInfo((p) => ({ ...p, category: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/70 text-[12px]">前年度売上:</span>
                  <input
                    className="bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-[12px] text-white outline-none w-24 placeholder-white/30"
                    value={heroInfo.prevYearSales}
                    onChange={(e) => setHeroInfo((p) => ({ ...p, prevYearSales: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
                  <Tag className="w-3 h-3 text-white/80" />
                  <input
                    className="bg-transparent text-white text-[11px] font-semibold outline-none w-40 placeholder-white/40"
                    value={heroInfo.offer}
                    onChange={(e) => setHeroInfo((p) => ({ ...p, offer: e.target.value }))}
                    placeholder="オファー"
                  />
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 価値カード - 7 cards horizontal scrollable */}
        <section>
          {sectionHeader("価値カード", "7つの視点で商品価値を分析")}
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
            {valueCards.map((card, ci) => (
              <div key={card.key} className="min-w-[220px] max-w-[220px] bg-white rounded-xl border border-black/[0.06] shadow-sm flex flex-col">
                {/* Card header */}
                <div className="p-4 flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-xl bg-[#9333EA]/10 flex items-center justify-center text-[#9333EA] mb-2">
                    {card.icon}
                  </div>
                  <h3 className="text-[13px] font-bold text-[#1A1A2E] mb-2">{card.title}</h3>
                  {/* Image area */}
                  <div className="w-[160px] h-[100px] border-2 border-dashed border-black/10 rounded-lg flex items-center justify-center bg-[#FAF8F5] mb-2">
                    <span className="text-[10px] text-[#1A1A2E]/30">画像をアップロード</span>
                  </div>
                  {/* Summary */}
                  <textarea
                    className="w-full text-[11px] text-[#1A1A2E]/70 bg-transparent outline-none resize-none text-center"
                    rows={2}
                    value={card.summary}
                    onChange={(e) => setValueCards((prev) => prev.map((c, i) => i === ci ? { ...c, summary: e.target.value } : c))}
                  />
                </div>
                {/* Expand toggle */}
                <button
                  onClick={() => toggleValueCard(ci)}
                  className="flex items-center justify-center gap-1 py-2 border-t border-black/[0.04] text-[11px] text-[#9333EA] font-semibold hover:bg-[#9333EA]/5 transition-colors"
                >
                  {card.expanded ? "閉じる" : "詳細を見る"}
                  {card.expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {/* Expanded content */}
                {card.expanded && (
                  <div className="px-4 pb-4 border-t border-black/[0.04] pt-3 space-y-3">
                    {card.key === "function" && (
                      <>
                        {functionItems.map((item, fi) => (
                          <div key={fi} className="space-y-1 bg-[#FAF8F5] rounded-lg p-2">
                            <input className={inputClass + " text-[11px] font-semibold"} placeholder="機能名" value={item.name} onChange={(e) => {
                              const next = [...functionItems]; next[fi] = { ...next[fi], name: e.target.value }; setFunctionItems(next);
                            }} />
                            <input className={inputClass + " text-[11px]"} placeholder="説明" value={item.description} onChange={(e) => {
                              const next = [...functionItems]; next[fi] = { ...next[fi], description: e.target.value }; setFunctionItems(next);
                            }} />
                            <input className={inputClass + " text-[11px]"} placeholder="効果・効能" value={item.effect} onChange={(e) => {
                              const next = [...functionItems]; next[fi] = { ...next[fi], effect: e.target.value }; setFunctionItems(next);
                            }} />
                          </div>
                        ))}
                        <button onClick={() => setFunctionItems((p) => [...p, { name: "", description: "", effect: "" }])}
                          className="flex items-center gap-1 text-[11px] text-[#9333EA] font-semibold hover:underline">
                          <Plus className="w-3 h-3" /> 追加
                        </button>
                      </>
                    )}
                    {card.key === "design" && (
                      <>
                        <div className="flex items-center gap-3 flex-wrap">
                          {([["ベース", "base"], ["メイン", "main"], ["アクセント", "accent"], ["テキスト", "text"]] as const).map(([label, key]) => (
                            <div key={key} className="flex flex-col items-center gap-1">
                              <input
                                type="color"
                                className="w-8 h-8 rounded-full border-2 border-white shadow cursor-pointer"
                                value={designColors[key]}
                                onChange={(e) => setDesignColors((p) => ({ ...p, [key]: e.target.value }))}
                              />
                              <span className="text-[9px] text-[#1A1A2E]/50">{label}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <label className="text-[10px] text-[#1A1A2E]/50 font-semibold">ブランドイメージ</label>
                          <textarea className={inputClass + " text-[11px] resize-none mt-1"} rows={3} value={designColors.brandImage}
                            onChange={(e) => setDesignColors((p) => ({ ...p, brandImage: e.target.value }))} />
                        </div>
                      </>
                    )}
                    {card.key === "experience" && (
                      <>
                        <div>
                          <label className="text-[10px] text-[#1A1A2E]/50 font-semibold">使用感</label>
                          <textarea className={inputClass + " text-[11px] resize-none mt-1"} rows={3} value={experienceData.usability}
                            onChange={(e) => setExperienceData((p) => ({ ...p, usability: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#1A1A2E]/50 font-semibold">体感</label>
                          <textarea className={inputClass + " text-[11px] resize-none mt-1"} rows={3} value={experienceData.feeling}
                            onChange={(e) => setExperienceData((p) => ({ ...p, feeling: e.target.value }))} />
                        </div>
                      </>
                    )}
                    {card.key === "story" && (
                      <>
                        <div>
                          <label className="text-[10px] text-[#1A1A2E]/50 font-semibold">ストーリー</label>
                          <textarea className={inputClass + " text-[11px] resize-none mt-1"} rows={5} value={storyData.story}
                            onChange={(e) => setStoryData((p) => ({ ...p, story: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#1A1A2E]/50 font-semibold">ブランドストーリー</label>
                          <textarea className={inputClass + " text-[11px] resize-none mt-1"} rows={3} value={storyData.brandStory}
                            onChange={(e) => setStoryData((p) => ({ ...p, brandStory: e.target.value }))} />
                        </div>
                      </>
                    )}
                    {card.key === "authority" && (
                      <>
                        <div>
                          <label className="text-[10px] text-[#1A1A2E]/50 font-semibold">有名人</label>
                          <input className={inputClass + " text-[11px] mt-1"} value={authorityData.celebrity}
                            onChange={(e) => setAuthorityData((p) => ({ ...p, celebrity: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#1A1A2E]/50 font-semibold">売上/企業実績</label>
                          <input className={inputClass + " text-[11px] mt-1"} value={authorityData.salesRecord}
                            onChange={(e) => setAuthorityData((p) => ({ ...p, salesRecord: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#1A1A2E]/50 font-semibold">研究データ</label>
                          {authorityData.researchData.map((rd, ri) => (
                            <div key={ri} className="flex items-center gap-1 mt-1">
                              <input className={inputClass + " text-[11px] flex-1"} value={rd.data}
                                onChange={(e) => {
                                  const next = { ...authorityData, researchData: [...authorityData.researchData] };
                                  next.researchData[ri] = { data: e.target.value };
                                  setAuthorityData(next);
                                }} />
                              <button onClick={() => {
                                const next = { ...authorityData, researchData: authorityData.researchData.filter((_, i) => i !== ri) };
                                setAuthorityData(next);
                              }} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                            </div>
                          ))}
                          <button onClick={() => setAuthorityData((p) => ({ ...p, researchData: [...p.researchData, { data: "" }] }))}
                            className="flex items-center gap-1 text-[11px] text-[#9333EA] font-semibold hover:underline mt-1">
                            <Plus className="w-3 h-3" /> 追加
                          </button>
                        </div>
                      </>
                    )}
                    {card.key === "offer" && (
                      <>
                        <div>
                          <label className="text-[10px] text-[#1A1A2E]/50 font-semibold">通常価格</label>
                          <input className={inputClass + " text-[11px] mt-1"} value={offerData.normalPrice}
                            onChange={(e) => setOfferData((p) => ({ ...p, normalPrice: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#1A1A2E]/50 font-semibold">オファー内容</label>
                          <textarea className={inputClass + " text-[11px] resize-none mt-1"} rows={3} value={offerData.offerContent}
                            onChange={(e) => setOfferData((p) => ({ ...p, offerContent: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#1A1A2E]/50 font-semibold">限定性</label>
                          <input className={inputClass + " text-[11px] mt-1"} value={offerData.exclusivity}
                            onChange={(e) => setOfferData((p) => ({ ...p, exclusivity: e.target.value }))} />
                        </div>
                      </>
                    )}
                    {card.key === "operations" && (
                      <div className="text-[11px] text-[#1A1A2E]/60">
                        <p>オンライン完結型 / 専属メンター制（LINEサポート24h）/ LP + SNS広告 + 無料セミナー</p>
                        <button onClick={() => setProductSubTab("operations")}
                          className="flex items-center gap-1 text-[#9333EA] font-semibold hover:underline mt-2">
                          提供体制タブで詳細を見る <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* USPカード */}
        <section>
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
                        <input
                          className="bg-transparent outline-none text-[10px] w-20"
                          value={tag}
                          onChange={(e) => {
                            const next = [...uspCards];
                            const tags = [...next[ui].functionTags];
                            tags[ti] = e.target.value;
                            next[ui] = { ...next[ui], functionTags: tags };
                            setUSPCards(next);
                          }}
                        />
                        <button onClick={() => {
                          const next = [...uspCards];
                          next[ui] = { ...next[ui], functionTags: next[ui].functionTags.filter((_, i) => i !== ti) };
                          setUSPCards(next);
                        }}>
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                    <button
                      onClick={() => {
                        const next = [...uspCards];
                        next[ui] = { ...next[ui], functionTags: [...next[ui].functionTags, ""] };
                        setUSPCards(next);
                      }}
                      className="inline-flex items-center gap-0.5 text-[10px] text-[#9333EA]/60 hover:text-[#9333EA] font-semibold"
                    >
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
            {/* Add USP card */}
            <button
              onClick={() => setUSPCards((p) => [...p, { id: Date.now(), title: "", functionTags: [], benefit: "" }])}
              className="bg-white/50 rounded-xl border-2 border-dashed border-black/[0.08] flex flex-col items-center justify-center gap-2 py-12 hover:border-[#9333EA]/30 hover:bg-[#9333EA]/5 transition-all group"
            >
              <Plus className="w-6 h-6 text-[#1A1A2E]/20 group-hover:text-[#9333EA]/50 transition-colors" />
              <span className="text-[12px] font-medium text-[#1A1A2E]/30 group-hover:text-[#9333EA]/50 transition-colors">USP追加</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ─── Sub-tab: 口コミ・権威性 ─────────────────────────
  function renderReviewsTab() {
    const maxScroll = Math.max(0, reviewCards.length - 3);
    return (
      <div className="space-y-8">
        {/* 口コミ・レビュー */}
        <section>
          {sectionHeader("口コミ・レビュー", "ユーザーの声を収集・管理")}
          <div className="relative">
            {/* Scroll arrows */}
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
                      {/* Screenshot area */}
                      <div className="aspect-video border-2 border-dashed border-black/10 rounded-lg flex items-center justify-center bg-[#FAF8F5]">
                        <span className="text-[10px] text-[#1A1A2E]/30">スクリーンショット</span>
                      </div>
                      {/* Source badge */}
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
                        <input
                          className="bg-transparent outline-none text-[10px] w-20"
                          value={card.author}
                          onChange={(e) => {
                            const next = [...reviewCards]; next[ri] = { ...next[ri], author: e.target.value }; setReviewCards(next);
                          }}
                          placeholder="投稿者名"
                        />
                        <input
                          className="bg-transparent outline-none text-[10px] w-24 text-right"
                          value={card.date}
                          onChange={(e) => {
                            const next = [...reviewCards]; next[ri] = { ...next[ri], date: e.target.value }; setReviewCards(next);
                          }}
                          placeholder="日付"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {/* Add card */}
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
                    onChange={(e) => {
                      const next = [...awards]; next[ai] = { ...next[ai], name: e.target.value }; setAwards(next);
                    }}
                  />
                </div>
                <input
                  className="text-[11px] text-[#1A1A2E]/60 font-semibold bg-transparent outline-none text-center w-16"
                  value={aw.year}
                  onChange={(e) => {
                    const next = [...awards]; next[ai] = { ...next[ai], year: e.target.value }; setAwards(next);
                  }}
                />
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
                    onChange={(e) => {
                      const next = [...media]; next[mi] = { ...next[mi], name: e.target.value }; setMedia(next);
                    }}
                  />
                </div>
                <input
                  className="text-[11px] text-[#1A1A2E]/60 font-semibold bg-transparent outline-none text-center w-20"
                  value={m.date}
                  onChange={(e) => {
                    const next = [...media]; next[mi] = { ...next[mi], date: e.target.value }; setMedia(next);
                  }}
                />
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

  // ─── Sub-tab: 提供体制 ───────────────────────────────
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
                {/* Add node */}
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

  // ─── Sub-tab: 製品体験ログ ───────────────────────────
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
                {/* Date */}
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#9333EA]" />
                  <input
                    type="date"
                    className="text-[14px] font-bold text-[#1A1A2E] bg-transparent outline-none"
                    value={log.date}
                    onChange={(e) => {
                      const next = [...experienceLogs]; next[li] = { ...next[li], date: e.target.value }; setExperienceLogs(next);
                    }}
                  />
                </div>
                {/* Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {log.tags.map((tag, ti) => (
                    <span key={ti} className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${tagColors[ti % tagColors.length]}`}>
                      <input
                        className="bg-transparent outline-none text-[10px] w-16"
                        value={tag}
                        onChange={(e) => {
                          const next = [...experienceLogs];
                          const tags = [...next[li].tags]; tags[ti] = e.target.value;
                          next[li] = { ...next[li], tags };
                          setExperienceLogs(next);
                        }}
                      />
                      <button onClick={() => {
                        const next = [...experienceLogs];
                        next[li] = { ...next[li], tags: next[li].tags.filter((_, i) => i !== ti) };
                        setExperienceLogs(next);
                      }}>
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                  <button
                    onClick={() => {
                      const next = [...experienceLogs];
                      next[li] = { ...next[li], tags: [...next[li].tags, ""] };
                      setExperienceLogs(next);
                    }}
                    className="text-[10px] text-[#9333EA]/60 hover:text-[#9333EA] font-semibold flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> タグ
                  </button>
                </div>
                {/* Image area */}
                <div className="aspect-video border-2 border-dashed border-black/10 rounded-lg flex items-center justify-center bg-[#FAF8F5]">
                  <span className="text-[10px] text-[#1A1A2E]/30">画像をアップロード（任意）</span>
                </div>
                {/* Text body */}
                <textarea
                  className={inputClass + " text-[12px] resize-none"}
                  rows={4}
                  value={log.text}
                  onChange={(e) => {
                    const next = [...experienceLogs]; next[li] = { ...next[li], text: e.target.value }; setExperienceLogs(next);
                  }}
                  placeholder="体験内容を記録..."
                />
              </div>
            </div>
          ))}
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

        {productSubTab === "overview" && renderOverviewTab()}
        {productSubTab === "reviews" && renderReviewsTab()}
        {productSubTab === "operations" && renderOperationsTab()}
        {productSubTab === "experienceLog" && renderExperienceLogTab()}
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
                          onChange={(e) => {
                            const next = [...marketCols];
                            next[ci] = e.target.value;
                            setMarketCols(next);
                          }}
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
                {/* Thumbnail placeholder */}
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
                    onChange={(e) => {
                      const next = [...refCreatives];
                      next[idx] = { ...next[idx], name: e.target.value };
                      setRefCreatives(next);
                    }}
                    placeholder="クリエイティブ名"
                  />
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#9333EA]/10 text-[#9333EA] text-[10px] font-semibold shrink-0">
                      <Globe className="w-3 h-3" />
                      <input
                        className="bg-transparent outline-none w-16 text-[10px]"
                        value={cr.platform}
                        onChange={(e) => {
                          const next = [...refCreatives];
                          next[idx] = { ...next[idx], platform: e.target.value };
                          setRefCreatives(next);
                        }}
                      />
                    </div>
                    <input
                      className={inputClass + " text-[11px] flex-1"}
                      value={cr.url}
                      onChange={(e) => {
                        const next = [...refCreatives];
                        next[idx] = { ...next[idx], url: e.target.value };
                        setRefCreatives(next);
                      }}
                      placeholder="URL"
                    />
                  </div>
                  <textarea
                    className={inputClass + " text-[11px] resize-none"}
                    rows={2}
                    value={cr.notes}
                    onChange={(e) => {
                      const next = [...refCreatives];
                      next[idx] = { ...next[idx], notes: e.target.value };
                      setRefCreatives(next);
                    }}
                    placeholder="メモ・特徴"
                  />
                </div>
              </div>
            ))}
            {/* Add card */}
            <button
              onClick={() =>
                setRefCreatives((prev) => [
                  ...prev,
                  { id: Date.now(), name: "", platform: "", url: "", notes: "" },
                ])
              }
              className="bg-white/50 rounded-xl border-2 border-dashed border-black/[0.08] flex flex-col items-center justify-center gap-2 py-12 hover:border-[#9333EA]/30 hover:bg-[#9333EA]/5 transition-all group"
            >
              <Plus className="w-6 h-6 text-[#1A1A2E]/20 group-hover:text-[#9333EA]/50 transition-colors" />
              <span className="text-[12px] font-medium text-[#1A1A2E]/30 group-hover:text-[#9333EA]/50 transition-colors">
                追加
              </span>
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
        {/* Sub toggle */}
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

        {/* Survey tables */}
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
                        <th key={pc} className="text-center text-[10px] font-bold text-[#9333EA]/60 px-3 py-2 min-w-[80px]">
                          {pc}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sec.rows.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-[#FAF8F5]/50"}>
                        <td className="sticky left-0 z-10 bg-inherit px-3 py-2 text-[11px] font-semibold text-[#1A1A2E]/40 border-r border-black/[0.04]">
                          {row.label}
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className={inputClass + " text-[11px]"}
                            value={row.source}
                            onChange={(e) => updateSurveyCell(si, ri, "source", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className={inputClass + " text-[11px]"}
                            value={row.item}
                            onChange={(e) => updateSurveyCell(si, ri, "item", e.target.value)}
                          />
                        </td>
                        {row.percentages.map((pct, pi) => (
                          <td key={pi} className="px-2 py-1.5">
                            <input
                              className={inputClass + " text-[11px] text-center"}
                              value={pct}
                              onChange={(e) => updateSurveyPercentage(si, ri, pi, e.target.value)}
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
        ))}
      </div>
    );
  }

  // ─── Main render ────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header removed - tab nav already shows page name */}

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
