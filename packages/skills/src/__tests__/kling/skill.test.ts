import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { KlingSkill } from "../../kling/skill.js";

describe("KlingSkill", () => {
  let skill: KlingSkill;

  beforeEach(() => {
    vi.useFakeTimers();
    skill = new KlingSkill("test-api-key", "https://api.test.com/v1");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("generateVideo", () => {
    it("creates task and polls until completion", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      // POST create task
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { task_id: "task-123" } }), { status: 200 }),
      );

      // GET poll - processing
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { status: "processing" } }), { status: 200 }),
      );

      // GET poll - completed
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { status: "completed", output: { video_url: "https://cdn.kling.ai/video.mp4" } },
          }),
          { status: 200 },
        ),
      );

      // Run the generateVideo call with timer advancement
      const resultPromise = skill.generateVideo({
        imageUrl: "https://example.com/image.png",
        prompt: "Slow zoom in on product",
        duration: 5,
        aspectRatio: "9:16",
        mode: "professional",
      });

      // Advance timers for polling intervals
      await vi.advanceTimersByTimeAsync(15_000);

      const result = await resultPromise;

      expect(result.taskId).toBe("task-123");
      expect(result.videoUrl).toBe("https://cdn.kling.ai/video.mp4");
    });

    it("throws on failed task", async () => {
      vi.useRealTimers(); // This test doesn't need fake timers since it fails on first poll

      const fetchSpy = vi.spyOn(globalThis, "fetch");

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { task_id: "task-456" } }), { status: 200 }),
      );

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { status: "failed", error: "Content violation" } }),
          { status: 200 },
        ),
      );

      await expect(
        skill.generateVideo({
          imageUrl: "https://example.com/img.png",
          prompt: "test",
          duration: 5,
          aspectRatio: "9:16",
          mode: "standard",
        }),
      ).rejects.toThrow("Content violation");
    });
  });
});
