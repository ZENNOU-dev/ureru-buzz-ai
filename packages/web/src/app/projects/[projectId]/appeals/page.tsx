import { ComingSoon } from "@/components/ui/coming-soon";
import { VoiceInputButton } from "@/components/voice-input-button";

export default function AppealsPage() {
  return (
    <div className="flex-1 flex flex-col p-6">
      <ComingSoon
        title="訴求開発"
        description="訴求軸の開発・管理機能を開発中です"
      />
      <VoiceInputButton onTranscript={(text) => console.log("voice:", text)} />
    </div>
  );
}
