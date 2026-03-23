import { ComingSoon } from "@/components/ui/coming-soon";
import { VoiceInputButton } from "@/components/voice-input-button";

export default function PlanningPage() {
  return (
    <div className="flex-1 flex flex-col p-6">
      <ComingSoon
        title="広告企画"
        description="広告企画の作成・管理機能を開発中です"
      />
      <VoiceInputButton onTranscript={(text) => console.log("voice:", text)} />
    </div>
  );
}
