import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditBriefAgent } from "../../edit-brief/agent.js";

describe("EditBriefAgent", () => {
  let agent: EditBriefAgent;
  let mockNotion: any;
  let mockLlm: any;
  let mockMaterialMatch: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockNotion = {
      getPage: vi.fn().mockResolvedValue({
        id: "script-page-1",
        properties: {
          "台本テキスト": {
            type: "rich_text",
            rich_text: [{ plain_text: "[フック]フックテキスト\n[共感]共感テキスト\n[CTA]CTAテキスト" }],
          },
          "興味の型": {
            type: "select",
            select: { name: "product" },
          },
        },
      }),
      createPage: vi.fn().mockResolvedValue("new-edit-brief-page-id"),
    };

    mockLlm = {
      generate: vi.fn().mockResolvedValue("Upbeat Pop"),
      generateStructured: vi.fn().mockResolvedValue([
        { subtitleText: "【フック】テロップ", subtitleStyle: "white-bold-center", effects: ["zoom_in"], soundEffects: [], durationSeconds: 8 },
        { subtitleText: "【共感】テロップ", subtitleStyle: "white-bold-center", effects: [], soundEffects: [], durationSeconds: 10 },
        { subtitleText: "【CTA】テロップ", subtitleStyle: "yellow-impact-bottom", effects: ["pulse"], soundEffects: ["ポン"], durationSeconds: 5 },
      ]),
    };

    mockMaterialMatch = {
      match: vi.fn().mockResolvedValue({
        existingCandidates: [{ materialId: "m1", url: "https://drive.google.com/file/d/abc/view", score: 0.7, isAiGenerated: false }],
        selected: { materialId: "m1", materialName: "素材1", url: "https://drive.google.com/file/d/abc/view", score: 0.7, isAiGenerated: false },
        needsMaterial: false,
      }),
    };

    // Mock the dynamic import
    vi.mock("@ureru-buzz-ai/skills", () => ({
      buildEditBriefProperties: vi.fn().mockReturnValue({ title: { title: [{ text: { content: "test" } }] } }),
    }));

    agent = new EditBriefAgent(mockNotion, mockLlm, mockMaterialMatch, {
      editBriefDbId: "edit-brief-db-id",
      slackChannel: "#test-channel",
    });
  });

  it("creates edit brief from approved script", async () => {
    const result = await agent.execute({
      tenantId: "11111111-1111-1111-1111-111111111111",
      data: { scriptId: "script-page-1" },
      context: { structureType: "ugc", concept: "育毛剤", targetAudience: "40代男性" },
    });

    expect(result.success).toBe(true);
    expect(result.data?.editBriefPageId).toBe("new-edit-brief-page-id");
    expect(result.data?.totalCuts).toBe(3);
    expect(result.data?.materialsNeedingAttention).toBe(0);
  });

  it("reports materials needing attention", async () => {
    mockMaterialMatch.match.mockResolvedValue({
      existingCandidates: [],
      selected: null,
      needsMaterial: true,
      aiSuggestion: { type: "image_only", imagePrompt: "test", estimatedCost: "$0.04", reason: "素材不足" },
    });

    const result = await agent.execute({
      tenantId: "11111111-1111-1111-1111-111111111111",
      data: { scriptId: "script-page-1" },
      context: { structureType: "ugc" },
    });

    expect(result.success).toBe(true);
    expect(result.data?.materialsNeedingAttention).toBe(3);
    expect(result.notifications?.length).toBeGreaterThan(0);
    expect(result.notifications?.[0].type).toBe("approval_request");
  });

  it("throws on invalid tenantId", async () => {
    await expect(
      agent.execute({
        tenantId: "invalid",
        data: { scriptId: "script-page-1" },
      }),
    ).rejects.toThrow();
  });

  it("throws on empty script text", async () => {
    mockNotion.getPage.mockResolvedValueOnce({
      id: "empty-script",
      properties: {
        "台本テキスト": { type: "rich_text", rich_text: [] },
        "興味の型": { type: "select", select: { name: "product" } },
      },
    });

    await expect(
      agent.execute({
        tenantId: "11111111-1111-1111-1111-111111111111",
        data: { scriptId: "empty-script" },
      }),
    ).rejects.toThrow("Script text is empty");
  });
});
