"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Mic, MicOff, MessageSquare, Pencil, Check, X, Edit3 } from "lucide-react";

// ─── Types ───────────────────────────────────────────
type VoiceMode = "text" | "feedback";

type VoiceInputButtonProps = {
  onTranscript: (text: string) => void;
  onFeedback?: (text: string) => void;
};

// ─── SpeechRecognition type ──────────────────────────
type SpeechRecognitionType = typeof window extends { webkitSpeechRecognition: infer T } ? T : any;

function getSpeechRecognition(): SpeechRecognitionType | null {
  if (typeof window === "undefined") return null;
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return SR ? new SR() : null;
}

// ─── Component ───────────────────────────────────────
export function VoiceInputButton({ onTranscript, onFeedback }: VoiceInputButtonProps) {
  const [mode, setMode] = useState<VoiceMode>("text");
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [showBubble, setShowBubble] = useState(true);
  const [supported, setSupported] = useState(true);
  const [proposal, setProposal] = useState<{ text: string; mode: VoiceMode } | null>(null);
  const [editingProposal, setEditingProposal] = useState(false);
  const [proposalEdit, setProposalEdit] = useState("");
  const recognitionRef = useRef<any>(null);
  const finalTextRef = useRef("");

  // Check browser support
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setSupported(!!SR);
    }
  }, []);

  // Auto-hide bubble after 30 seconds (keeps visible long enough)
  useEffect(() => {
    if (!showBubble) return;
    const timer = setTimeout(() => setShowBubble(false), 30000);
    return () => clearTimeout(timer);
  }, [showBubble]);

  const startRecording = useCallback(() => {
    const recognition = getSpeechRecognition();
    if (!recognition) {
      setSupported(false);
      return;
    }

    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;

    finalTextRef.current = "";
    setInterimText("");

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      finalTextRef.current = final;
      setInterimText(final + interim);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      const text = finalTextRef.current.trim();
      if (text) {
        // Show proposal instead of directly applying
        setProposal({ text, mode });
        setProposalEdit(text);
      }
      setInterimText("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [mode, onTranscript, onFeedback]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const toggleMode = useCallback(() => {
    if (isRecording) return;
    setMode((m) => (m === "text" ? "feedback" : "text"));
  }, [isRecording]);

  // Proposal handlers
  const applyProposal = useCallback(() => {
    if (!proposal) return;
    const text = editingProposal ? proposalEdit : proposal.text;
    if (proposal.mode === "feedback" && onFeedback) {
      onFeedback(text);
    } else {
      onTranscript(text);
    }
    setProposal(null);
    setEditingProposal(false);
  }, [proposal, proposalEdit, editingProposal, onTranscript, onFeedback]);

  const cancelProposal = useCallback(() => {
    setProposal(null);
    setEditingProposal(false);
  }, []);

  if (!supported) return null;

  return (
    <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end gap-2">
      {/* Recording overlay - shows interim text */}
      {isRecording && (
        <div className="fixed inset-0 z-40 pointer-events-none flex items-end justify-center pb-28">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-black/[0.08] px-6 py-4 max-w-md mx-4 pointer-events-auto">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-red-500">
                {mode === "text" ? "テキスト入力中..." : "フィードバック入力中..."}
              </span>
            </div>
            <p className="text-sm text-[#1A1A2E]/70 leading-relaxed min-h-[24px]">
              {interimText || "話してください..."}
            </p>
          </div>
        </div>
      )}

      {/* AI Proposal confirmation popup */}
      {proposal && !isRecording && (
        <div className="bg-white rounded-2xl shadow-2xl border border-[#9333EA]/20 px-4 py-3 max-w-[320px] w-[320px]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full bg-[#9333EA]/10 flex items-center justify-center">
              <span className="text-[10px]">🤖</span>
            </div>
            <span className="text-[11px] font-bold text-[#1A1A2E]/70">
              {proposal.mode === "text" ? "テキストに反映しますか？" : "フィードバックに反映しますか？"}
            </span>
          </div>
          {editingProposal ? (
            <textarea
              autoFocus
              value={proposalEdit}
              onChange={(e) => setProposalEdit(e.target.value)}
              className="w-full text-[12px] text-[#1A1A2E]/80 bg-[#FAF8F5] border border-[#9333EA]/20 rounded-lg px-3 py-2 outline-none resize-none leading-relaxed"
              rows={3}
            />
          ) : (
            <div className="bg-[#FAF8F5] rounded-lg px-3 py-2 text-[12px] text-[#1A1A2E]/70 leading-relaxed whitespace-pre-line">
              {proposal.text}
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <button onClick={applyProposal}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-[#9333EA] text-white text-[11px] font-semibold hover:bg-[#7E22CE] transition-colors">
              <Check className="w-3 h-3" /> 適用
            </button>
            <button onClick={() => { setEditingProposal(!editingProposal); if (!editingProposal) setProposalEdit(proposal.text); }}
              className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg border border-[#1A1A2E]/10 text-[11px] font-medium text-[#1A1A2E]/50 hover:text-[#9333EA] hover:border-[#9333EA]/30 transition-all">
              <Edit3 className="w-3 h-3" /> 修正
            </button>
            <button onClick={cancelProposal}
              className="flex items-center justify-center px-2 py-1.5 rounded-lg border border-[#1A1A2E]/10 text-[#1A1A2E]/30 hover:text-red-500 hover:border-red-300 transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Bubble tooltip */}
      {showBubble && !isRecording && (
        <div
          className="relative bg-gradient-to-r from-[#9333EA] to-[#7C3AED] text-white rounded-xl px-3 py-2 shadow-lg cursor-pointer"
          onClick={() => setShowBubble(false)}
        >
          <p className="text-[11px] font-bold whitespace-nowrap">
            テキスト入力より3倍早い ⚡
          </p>
          <p className="text-[9px] text-white/70 mt-0.5">
            音声で台本入力・フィードバック
          </p>
          {/* Arrow pointing down-right to button */}
          <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-[#7C3AED] rotate-45" />
        </div>
      )}

      {/* Button group */}
      <div className="flex items-center gap-2">
        {/* Mode toggle */}
        <button
          onClick={toggleMode}
          disabled={isRecording}
          className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all ${
            isRecording
              ? "opacity-50 cursor-not-allowed bg-gray-200"
              : mode === "text"
                ? "bg-white border border-[#9333EA]/20 text-[#9333EA] hover:bg-[#9333EA]/5"
                : "bg-white border border-amber-400/30 text-amber-600 hover:bg-amber-50"
          }`}
          title={mode === "text" ? "テキスト入力モード" : "フィードバックモード"}
        >
          {mode === "text" ? (
            <Pencil className="w-4 h-4" />
          ) : (
            <MessageSquare className="w-4 h-4" />
          )}
        </button>

        {/* Main mic button */}
        <button
          onClick={toggleRecording}
          onMouseEnter={() => { if (!isRecording) setShowBubble(true); }}
          className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all relative ${
            isRecording
              ? "bg-red-500 hover:bg-red-600 scale-110"
              : mode === "text"
                ? "bg-[#9333EA] hover:bg-[#7E22CE]"
                : "bg-amber-500 hover:bg-amber-600"
          }`}
        >
          {/* Pulse animation when recording */}
          {isRecording && (
            <>
              <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30" />
              <span className="absolute inset-[-4px] rounded-full border-2 border-red-400 animate-pulse opacity-50" />
            </>
          )}
          {isRecording ? (
            <MicOff className="w-6 h-6 text-white relative z-10" />
          ) : (
            <Mic className="w-6 h-6 text-white" />
          )}
        </button>
      </div>

      {/* Mode label */}
      <span className={`text-[9px] font-medium mr-1 ${
        mode === "text" ? "text-[#9333EA]/60" : "text-amber-600/60"
      }`}>
        {mode === "text" ? "テキスト入力" : "フィードバック"}
      </span>

    </div>
  );
}
