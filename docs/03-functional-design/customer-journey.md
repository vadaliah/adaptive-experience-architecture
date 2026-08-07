# MVP Customer Journey

The customer journey is intentionally confirmation-driven rather than form-driven.

1. **Intent & Discovery** — Customer describes the goal naturally.
2. **Shared Understanding** — AI progressively captures recipient, occasion, preferences, budget, and constraints.
3. **Curated Workspace** — RAG/hybrid retrieval grounds product recommendations in Lily's product knowledge and current business constraints.
4. **Selection & Refinement** — Customer selects products and adjusts the desired outcome.
5. **AI Execution Plan** — Agent assembles known recipient, delivery, availability, pricing, and payment context and identifies only genuine gaps.
6. **Customer Approval** — Customer validates the assembled plan, corrects anything necessary, and approves the consequential action.
7. **Order Orchestration** — Deterministic business services execute the transaction and coordinate state changes through Kafka events.
8. **Live Order Companion** — AI monitors fulfillment and proactively surfaces delays, substitutions, or decisions requiring customer attention.
9. **Future Reorder** — Customer Memory may later enable preference-aware reordering with minimal interaction.
