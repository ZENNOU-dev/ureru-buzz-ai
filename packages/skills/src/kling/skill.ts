import { withRetry, logger, AppError } from "@ureru-buzz-ai/core";
import type { KlingVideoRequest, KlingVideoResult, KlingTaskStatus } from "./types.js";

const DEFAULT_API_URL = "https://api.klingai.com/v1";
const POLL_INTERVAL_MS = 10_000; // 10 seconds
const MAX_WAIT_MS = 5 * 60 * 1000; // 5 minutes

export class KlingSkill {
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(apiKey: string, apiUrl?: string) {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl ?? DEFAULT_API_URL;
  }

  /**
   * Generate video from image (Image-to-Video)
   * Creates task then polls until completion
   */
  async generateVideo(req: KlingVideoRequest): Promise<KlingVideoResult> {
    logger.info("kling-generate-start", { prompt: req.prompt.slice(0, 80) });

    const taskId = await this.createTask(req);
    const result = await this.pollCompletion(taskId);

    if (!result.output?.video_url) {
      throw new AppError(`Kling task ${taskId} completed but no video URL`, "KLING_NO_OUTPUT", 500);
    }

    logger.info("kling-generate-complete", { taskId });
    return { videoUrl: result.output.video_url, taskId };
  }

  private async createTask(req: KlingVideoRequest): Promise<string> {
    const response = await withRetry(
      async () => {
        const res = await fetch(`${this.apiUrl}/videos/image2video`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: "kling-v2",
            input: { image_url: req.imageUrl, prompt: req.prompt },
            config: {
              duration: req.duration,
              aspect_ratio: req.aspectRatio,
              mode: req.mode,
            },
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          throw new AppError(`Kling API error: ${res.status} ${body}`, "KLING_API_ERROR", res.status);
        }

        return res.json();
      },
      { maxAttempts: 3, initialDelayMs: 2000 },
    );

    return response.data?.task_id ?? response.task_id;
  }

  private async pollCompletion(taskId: string, maxWaitMs: number = MAX_WAIT_MS): Promise<KlingTaskStatus> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getTaskStatus(taskId);

      if (status.status === "completed") {
        return status;
      }

      if (status.status === "failed") {
        throw new AppError(
          `Kling task ${taskId} failed: ${status.error ?? "unknown error"}`,
          "KLING_TASK_FAILED",
          500,
        );
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new AppError(`Kling task ${taskId} timed out after ${maxWaitMs}ms`, "KLING_TIMEOUT", 408);
  }

  private async getTaskStatus(taskId: string): Promise<KlingTaskStatus> {
    const res = await fetch(`${this.apiUrl}/videos/image2video/${taskId}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!res.ok) {
      throw new AppError(`Kling status check failed: ${res.status}`, "KLING_STATUS_ERROR", res.status);
    }

    const data = await res.json();
    return {
      id: taskId,
      status: data.data?.status ?? data.status,
      output: data.data?.output ?? data.output,
      error: data.data?.error ?? data.error,
    };
  }
}
