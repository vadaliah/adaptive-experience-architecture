# ADR-008 — Agentic AI Boundary
Status: Accepted

Use the LLM/agent layer to understand intent, retrieve grounded context, reason, recommend, invoke approved tools, and prepare execution plans. The agent shall not directly mutate authoritative transactional tables.

Business services validate rules, perform transactions, persist state, and publish resulting events. Consequential actions require explicit customer approval where appropriate.
