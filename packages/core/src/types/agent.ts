import type { z } from "zod";
import type { Phase } from "../config/constants.js";

export interface AgentInput<T> {
  tenantId: string;
  data: T;
  context?: Record<string, unknown>;
}

export interface AgentOutput<T> {
  success: boolean;
  data?: T;
  error?: string;
  notionPageIds?: string[];
  nextPhase?: Phase;
  notifications?: NotificationPayload[];
}

export interface NotificationPayload {
  type: "approval_request" | "approval_complete" | "rejection" | "submission" | "operation" | "report" | "error";
  tenantId: string;
  phase?: Phase;
  title: string;
  message: string;
  notionUrl?: string;
  slackChannel?: string;
  mentionUserIds?: string[];
}

export interface BaseAgentDefinition<TInput, TOutput> {
  name: string;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>;
  execute(input: AgentInput<TInput>): Promise<AgentOutput<TOutput>>;
}
