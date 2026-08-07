# Technical Architecture

## Style
Asynchronous, event-driven, experience-oriented, and AI-assisted while preserving deterministic transactional control.

## Core architectural layers

### Experience layer
- React Native + Expo + TypeScript
- Adaptive Workspace
- Conversation and Shared Understanding experiences
- Selective experience refresh rather than full-page workflow transitions

### AI reasoning and agent layer
- Claude for natural-language understanding, reasoning, recommendation, and explanation
- LangChain/LangGraph for retrieval, tool invocation, stateful agent workflows, and human-in-the-loop approval
- RAG/hybrid retrieval grounded in Lily's product knowledge

The LLM does not directly update authoritative transactional data. It invokes controlled tools/business APIs.

### Application and domain layer
- Python/FastAPI as the preferred MVP service layer
- Product, Inventory, Order, Delivery, Payment, Support, and Customer Context services
- Deterministic validation and transaction processing
- Business-process orchestrator/state machine for order progression

### Data layer
- PostgreSQL as the transactional system of record
- pgvector for embeddings and semantic retrieval
- Hybrid retrieval combining relational/structured constraints with vector similarity
- Transactional facts such as inventory, price, order status, and payment status remain authoritative structured data

### Event layer
- Kafka as the messaging backbone
- Domain-oriented topics for commands and events
- Services publish facts without direct knowledge of all subscribers
- Business-process orchestration consumes outcomes and advances workflow state deterministically

Illustrative commands:
- ReserveInventory
- AuthorizePayment
- ScheduleDelivery

Illustrative events:
- OrderCreated
- InventoryReserved
- PaymentAuthorized
- DeliveryScheduled
- OrderConfirmed

## Two orchestration responsibilities

### AI / agent orchestration
Determines what information or capability is needed to satisfy intent: retrieval, customer context, inventory, delivery, payment, or clarification.

### Transaction / event orchestration
Determines whether business prerequisites are complete and advances order state based on deterministic events. This logic must not depend on probabilistic LLM reasoning.

## Message contract
Each request/event should include actor/source, actee or intended capability where applicable, topic, message type, schema version, correlation ID, session ID, stream/order key, context version, timestamp, security context, status/error information, and payload.

For order-related Kafka messages, `order_id` should be the message key where ordering by order is required.

## Transaction/event consistency
Where a domain service persists state and publishes an event, use a Transactional Outbox pattern so the database commit and eventual Kafka publication cannot silently diverge.

## Supersession
For the same session and stream, older responses must not overwrite newer accepted intent. Context versioning and correlation IDs remain part of the contract.

## External integrations
Trusted services such as Apple Pay and delivery providers are exposed through controlled application APIs/tools. The agent may initiate or coordinate these services but consequential authorization remains explicit and transactional execution remains deterministic.

## MVP implementation strategy
Prove the architecture through a thin vertical slice:

Intent → retrieval → recommendation → approval → order transaction → Kafka event → inventory consumer → orchestration state update → UI confirmation.

Defer production-depth concerns such as enterprise-scale Kafka topology, sophisticated saga compensation, multi-provider delivery integration, and advanced operational analytics until the vertical slice is working.

## Future performance patterns
- Semantic caching
- Precomputed experience seeds
- Progressive hydration
- Optimistic acknowledgment
- Advanced event-stream analytics
