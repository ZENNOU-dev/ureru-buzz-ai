import { z } from "zod";
import type {
  AgentInput,
  AgentOutput,
  BaseAgentDefinition,
  NotionEditBriefRecord,
  NotionCut,
} from "@ureru-buzz-ai/core";
import { logger, ensureTenantId, AgentExecutionError } from "@ureru-buzz-ai/core";
import type { EditBriefAgentInput, EditBriefAgentOutput } from "./types.js";
import { parseScriptIntoSections } from "./script-parser.js";
import { generateSubtitles } from "./subtitle-generator.js";
import { selectBgm } from "./bgm-selector.js";

// Skill interfaces (avoid direct import to keep loose coupling)
interface NotionSkillLike {
  getPage(pageId: string): Promise<any>;
  createPage(params: { databaseId: string; properties: Record<string, unknown>; children?: object[] }): Promise<string>;
}

interface LLMSkillLike {
  generate(params: any): Promise<string>;
  generateStructured<T>(params: any): Promise<T>;
}

interface MaterialMatchSkillLike {
  match(input: any): Promise<any>;
}

export class EditBriefAgent implements BaseAgentDefinition<EditBriefAgentInput, EditBriefAgentOutput> {
  name = "EditBriefAgent";

  inputSchema = z.object({
    scriptId: z.string().min(1),
  });

  outputSchema = z.object({
    editBriefPageId: z.string(),
    totalCuts: z.number(),
    materialsNeedingAttention: z.number(),
  });

  constructor(
    private notion: NotionSkillLike,
    private llm: LLMSkillLike,
    private materialMatch: MaterialMatchSkillLike,
    private config: {
      editBriefDbId: string;
      slackChannel?: string;
    },
  ) {}

  async execute(
    input: AgentInput<EditBriefAgentInput>,
  ): Promise<AgentOutput<EditBriefAgentOutput>> {
    const agentLogger = logger.withContext({
      agentName: this.name,
      tenantId: input.tenantId,
      phase: "edit_brief",
    });

    try {
      // 1. Validate tenant
      ensureTenantId(input.tenantId);
      agentLogger.info("execute-start", { scriptId: input.data.scriptId });

      // 2. Fetch script from Notion
      const scriptPage = await this.notion.getPage(input.data.scriptId);
      const scriptProps = scriptPage.properties ?? {};

      // Extract script data (simplified - in production, use mappers)
      const scriptText = this.extractRichText(scriptProps, "台本テキスト") ||
                         this.extractRichText(scriptProps, "scriptText") || "";
      const interestType = this.extractSelect(scriptProps, "興味の型") || "product";
      const structureType = input.context?.structureType as string ?? "ugc";

      if (!scriptText) {
        throw new AgentExecutionError(this.name, "Script text is empty");
      }

      agentLogger.info("script-fetched", {
        charCount: scriptText.length,
        interestType,
        structureType,
      });

      // 3. Parse script into sections
      const sections = parseScriptIntoSections(scriptText);
      agentLogger.info("script-parsed", { sectionCount: sections.length });

      // 4. Match materials for each section
      const cuts: NotionCut[] = [];
      let materialsNeedingAttention = 0;

      for (const section of sections) {
        const matchResult = await this.materialMatch.match({
          sectionText: section.text,
          section: section.section,
          tenantId: input.tenantId,
          structureType,
          concept: input.context?.concept as string ?? "",
          targetAudience: input.context?.targetAudience as string ?? "",
        });

        if (matchResult.needsMaterial) {
          materialsNeedingAttention++;
        }

        cuts.push({
          section: section.section,
          scriptText: section.text,
          materialId: matchResult.selected?.materialId,
          materialUrl: matchResult.selected?.url,
          materialName: matchResult.selected?.materialName,
          isAiGenerated: matchResult.selected?.isAiGenerated ?? false,
        });
      }

      agentLogger.info("materials-matched", {
        totalCuts: cuts.length,
        materialsNeedingAttention,
      });

      // 5. Generate subtitles, effects, timing
      const subtitleData = await generateSubtitles(
        this.llm,
        cuts.map((c) => ({
          section: c.section as any,
          scriptText: c.scriptText,
          materialUrl: c.materialUrl,
        })),
        structureType,
      );

      // Merge subtitle data into cuts
      for (let i = 0; i < cuts.length && i < subtitleData.length; i++) {
        const sub = subtitleData[i];
        cuts[i].subtitleText = sub.subtitleText;
        cuts[i].subtitleStyle = sub.subtitleStyle;
        cuts[i].effects = sub.effects;
        cuts[i].soundEffects = sub.soundEffects;
        cuts[i].durationSeconds = sub.durationSeconds;
      }

      // 6. Select BGM
      const bgm = await selectBgm(
        this.llm,
        scriptText.slice(0, 200),
        structureType,
        interestType,
      );

      // 7. Calculate total char count
      const totalCharCount = cuts.reduce(
        (sum, c) => sum + (c.scriptText?.length ?? 0),
        0,
      );

      // 8. Build EditBrief record
      const editBrief: NotionEditBriefRecord = {
        tenantId: input.tenantId,
        scriptId: input.data.scriptId,
        cuts,
        bgm,
        totalCharCount,
        status: "承認待ち",
      };

      // 9. Write to Notion
      const { buildEditBriefProperties } = await import("@ureru-buzz-ai/skills");
      const editBriefPageId = await this.notion.createPage({
        databaseId: this.config.editBriefDbId,
        properties: buildEditBriefProperties(editBrief),
      });

      agentLogger.info("edit-brief-created", { editBriefPageId });

      // 10. Build notifications
      const notifications = [];
      if (materialsNeedingAttention > 0) {
        notifications.push({
          type: "approval_request" as const,
          tenantId: input.tenantId,
          phase: "edit_brief" as const,
          title: `編集概要の承認依頼（${materialsNeedingAttention}件の素材要確認）`,
          message: `編集概要が作成されました。${materialsNeedingAttention}カットで素材の確認が必要です。`,
          slackChannel: this.config.slackChannel,
        });
      }

      return {
        success: true,
        data: {
          editBriefPageId,
          totalCuts: cuts.length,
          materialsNeedingAttention,
        },
        notionPageIds: [editBriefPageId],
        notifications,
      };
    } catch (error) {
      agentLogger.error("execute-error", error instanceof Error ? error : undefined);

      if (error instanceof AgentExecutionError) throw error;

      throw new AgentExecutionError(
        this.name,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  // Helper methods for Notion property extraction
  private extractRichText(props: any, name: string): string {
    const prop = props[name];
    if (!prop) return "";
    if (prop.type === "rich_text") {
      return prop.rich_text?.map((t: any) => t.plain_text).join("") ?? "";
    }
    if (prop.type === "title") {
      return prop.title?.map((t: any) => t.plain_text).join("") ?? "";
    }
    return "";
  }

  private extractSelect(props: any, name: string): string {
    const prop = props[name];
    if (prop?.type === "select") return prop.select?.name ?? "";
    return "";
  }
}
