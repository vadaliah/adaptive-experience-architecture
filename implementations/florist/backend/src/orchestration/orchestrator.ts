import { messageResult } from "../models/intent-result.js";
import type {
  DecisionTrace,
  InteractionContext,
  Proposal,
  ExecutionPlan,
  InteractionResult,
} from "./decision.js";
// One proposal and at most one execution today. Capability policy is supplied by the caller.
export class Orchestrator {
  constructor(
    private readonly record: (trace: DecisionTrace) => void = (trace) =>
      console.info(JSON.stringify({ event: "interaction_decision", ...trace })),
  ) {}
  async run(
    context: InteractionContext,
    propose: () => Promise<Proposal>,
    prepare: (proposal: Proposal) => Promise<ExecutionPlan>,
  ): Promise<InteractionResult> {
    const trace: DecisionTrace = {
      ...context,
      proposedCapability: null,
      validatedArguments: null,
      executedCapabilities: [],
      appliedCriteria: [],
      outcome: "failed",
      resultCount: 0,
      validation: "not_executed",
    };
    try {
      const proposal = await propose();
      trace.explicitCriteria = [...context.explicitCriteria];
      trace.proposedCapability = proposal.capability;
      const plan = await prepare(proposal);
      let result;
      if (plan.kind === "message") {
        trace.outcome = plan.outcome;
        result = messageResult(plan.message);
      } else {
        trace.validatedArguments = plan.arguments;
        trace.validation = plan.validation;
        try {
          result = await plan.execute();
          trace.executedCapabilities = proposal.capability
            ? [proposal.capability]
            : [];
          trace.appliedCriteria = plan.appliedCriteria;
          trace.outcome = "succeeded";
        } catch (error) {
          const message = plan.rejectOnError?.(error);
          if (!message) throw error;
          trace.outcome = "rejected";
          result = messageResult(message);
        }
      }
      trace.resultCount = result.dataset.length;
      return { ...result, requestId: context.requestId, trace };
    } finally {
      // No prompts, model reasoning, provider responses, credentials, or exception internals.
      // Observability failures must not change the business result. Isolate the sink from returned data.
      try {
        this.record(structuredClone(trace));
      } catch {
        /* best-effort logging */
      }
    }
  }
}
