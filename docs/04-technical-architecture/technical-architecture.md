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

### Agentic capability contract

Agent-accessible application capabilities are registered through a common tool registry.

Each capability defines:

- a capability name and semantic description;
- an input schema describing deterministic execution criteria;
- a result definition describing how capability output maps into the Resulting Data Store;
- an execution function implemented by controlled application code.

Registered capability definitions are transformed into the tool contract exposed to Claude through Amazon Bedrock. Claude interprets natural-language intent and selects a capability while producing structured request criteria and semantic result metadata.

Claude does not execute application code directly. Agent orchestration resolves the requested capability through the application-owned tool registry and invokes its deterministic implementation.

### Resulting Data Store

Capability-specific execution results are normalized into a presentation-independent Resulting Data Store:

    metadata
      title
      qualifiers
      resultCount

    dataset
      records...

The contract forms the boundary between agent/application orchestration and adaptive presentation.

The Experience layer does not need to know which tool, repository, database query, or infrastructure component produced the dataset. It renders metadata and records supplied through this contract.

This enables additional capabilities to participate in the Adaptive Workspace without requiring capability-specific page flows.

### Application and domain layer
- TypeScript + Node.js + Express for the current MVP application service layer
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

The first implemented vertical slice proves the discovery path:

Intent → Claude/Bedrock interpretation → capability selection → structured tool request → deterministic product retrieval → Resulting Data Store → adaptive React rendering.

The broader MVP continues this pathway through:

Product selection → approval → order transaction → Kafka event → inventory consumer → orchestration state update → UI confirmation.

This incremental approach validates the architectural boundaries before transactional capabilities are introduced.

## Future performance patterns
- Semantic caching
- Precomputed experience seeds
- Progressive hydration
- Optimistic acknowledgment
- Advanced event-stream analytics
