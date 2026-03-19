export interface KlingVideoRequest {
  imageUrl: string;
  prompt: string;
  duration: 5 | 10;
  aspectRatio: "9:16";
  mode: "standard" | "professional";
}

export interface KlingVideoResult {
  videoUrl: string;
  taskId: string;
}

export interface KlingTaskStatus {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  output?: { video_url: string };
  error?: string;
}
