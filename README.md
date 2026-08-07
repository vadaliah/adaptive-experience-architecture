# Adaptive Experience Architecture (AEA)

Designing AI-native experiences that evolve with shared understanding and reduce customer effort through intelligent confirmation rather than repetitive data collection.

## Reference implementation
Lily's Florist Shop.

## Architectural direction
AEA combines conversational and agentic AI with deterministic transaction services. The AI layer interprets intent, retrieves grounded context, recommends actions, and orchestrates approved tools; authoritative business services perform transactions and publish domain events.

The current reference stack direction is:
- React Native + Expo + TypeScript for responsive mobile/web UI
- Python/FastAPI for application and integration services
- Claude as the LLM reasoning and interaction layer
- LangChain/LangGraph for RAG, tool invocation, stateful agent workflows, and human approval points
- PostgreSQL + pgvector for transactional data, structured filtering, and semantic product retrieval
- Kafka as the event messaging backbone
- Deterministic application orchestration for business-process state transitions
- External trusted services such as Apple Pay exposed through controlled business APIs/tools

## Repository areas
- Product vision
- Business analysis
- Functional design
- Technical architecture
- UX design guide
- Architecture Decision Records
- Roadmap
- Florist reference implementation

## North star
Adaptive Experience Architecture enables AI-native applications where shared understanding continuously reshapes the workspace without disrupting the user's flow. The system should retrieve or infer what it can, clearly present what it knows, and involve the customer primarily for validation, correction, and consequential approval.
