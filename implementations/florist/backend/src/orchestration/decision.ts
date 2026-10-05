import type { IntentResult } from "../models/intent-result.js";
export type Criterion = { kind: "campaign"; campaignId: string };
export interface InteractionContext {
  requestId: string;
  interactionSource: "ribbon" | "prompt";
  // Only supported criteria explicitly recognized by application policy, not raw prompt text.
  explicitCriteria: Criterion[];
}
export interface DecisionTrace extends InteractionContext {
  proposedCapability: string | null;
  validatedArguments: Record<string, unknown> | null;
  executedCapabilities: string[];
  appliedCriteria: Criterion[];
  outcome: "succeeded" | "message" | "rejected" | "failed";
  resultCount: number;
  validation: "not_executed" | "arguments_validated" | "grounded_campaign";
}
export interface Proposal {
  capability: string | null;
  input?: unknown;
  message?: string;
}
export type ExecutionPlan =
  | {
      kind: "execute";
      arguments: Record<string, unknown>;
      appliedCriteria: Criterion[];
      validation: DecisionTrace["validation"];
      execute: () => Promise<IntentResult>;
      rejectOnError?: (error: unknown) => string | undefined;
    }
  | { kind: "message"; message: string; outcome: "message" | "rejected" };
export type InteractionResult = IntentResult & {
  requestId: string;
  trace: DecisionTrace;
};
