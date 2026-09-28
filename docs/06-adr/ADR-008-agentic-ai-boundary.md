# ADR-008 — Agentic AI Boundary
Status: Accepted

Use the LLM/agent layer to understand intent, retrieve grounded context, reason, recommend, invoke approved tools, and prepare execution plans. The agent shall not directly mutate authoritative transactional tables.

Business services validate rules, perform transactions, persist state, and publish resulting events. Consequential actions require explicit customer approval where appropriate.

# ADR-008 — Agentic AI Boundary

Status: Accepted

## Decision

Use the LLM/agent layer to understand intent, retrieve grounded context, reason, recommend, select approved capabilities, and prepare execution plans.

The agent shall not directly mutate authoritative transactional tables or directly execute application implementation code.

Agent-accessible capabilities are registered through an application-owned tool registry. Each capability exposes a structured input contract and result definition to the agent while retaining deterministic execution within application code.

For data-producing capabilities, the agent may generate semantic metadata appropriate to the interpreted intent, while application code executes the capability and derives deterministic facts such as the actual result count.

Capability output is normalized into a Resulting Data Store before reaching the Experience layer.

Business services validate rules, perform transactions, persist state, and publish resulting events. Consequential actions require explicit customer approval where appropriate.

## Rationale

This boundary allows probabilistic reasoning to determine what the customer means and which approved capability should be used without allowing the model to become the system of record or bypass application controls.

It also prevents the Experience layer from becoming coupled to individual agent tools. The view consumes a normalized result contract rather than knowing how the underlying data was obtained.

## Implemented proof

The Lily reference implementation currently demonstrates:

    Natural-language intent
        ↓
    Claude through Amazon Bedrock
        ↓
    Agentic capability selection and structured request
        ↓
    Application tool registry
        ↓
    Deterministic searchProducts execution
        ↓
    PostgreSQL / Aurora
        ↓
    Resulting Data Store
        ↓
    React Native / Expo adaptive rendering

This constitutes the first working end-to-end proof of the agentic boundary.
