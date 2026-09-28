his immediately before ## Functional flow:
## Resulting Data Store

Data-producing agent capabilities return results through a common Resulting Data Store contract so that the Adaptive Workspace does not depend on the tool, repository, query, or infrastructure component that produced the data.

The current contract contains:

- `metadata.title` — a short semantic heading appropriate to the invoked capability and customer intent;
- `metadata.qualifiers` — structured criteria that describe filters or constraints applied to the result;
- `metadata.resultCount` — the number of records returned;
- `dataset` — the records produced by deterministic capability execution.

The title remains concise and should not attempt to encode every search criterion. Applied criteria are represented separately as qualifiers so the Adaptive Workspace can render them as filter context without making the primary heading verbose.

For example, an unfiltered request such as “Show me everything Lily has to offer” may produce:

- title: `Full Product Catalog`
- qualifiers: none
- result count: the number of matching products
- dataset: the matching product records

As search capabilities become richer, qualifiers may represent criteria such as product type, occasion, price range, inventory state, recipient context, or other capability-specific constraints.

The Resulting Data Store separates agentic interpretation and deterministic execution from presentation.

# Functional Design

## Functional vision
AEA replaces form-heavy commerce with a confirmation-driven experience. Customers express intent naturally, AI progressively builds Shared Understanding, relevant product and service knowledge is retrieved, and the workspace adapts while preserving context.

The AI layer facilitates the transaction; it does not own authoritative business records. Deterministic domain services validate and execute transactional changes.

## Core sections
- Header
- Conversation
- Shared Understanding
- Adaptive Workspace

## Core experiences
- Conversation
- Progressive Thought Completion
- Discovery
- Shared Understanding
- Recommendation
- Product Selection
- AI Execution Planning
- Customer Approval
- Order Execution
- Live Order Companion / Delivery Tracking

## Overlay experiences
- Customer Support
- Notifications
- Future Customer Memory

## Confirmation-driven interaction
The platform should avoid asking the customer to re-enter information that can be safely retrieved from approved sources. Known or inferred values are displayed for validation. Missing, ambiguous, or consequential information is explicitly requested.

Examples include:
- retrieving relevant customer or recipient context from authorized profile services;
- presenting delivery information for confirmation instead of recreating a full form;
- invoking a trusted payment service such as Apple Pay at the point of authorization;
- allowing natural-language correction such as “deliver after 6 PM instead.”

## RAG and product retrieval
Product discovery uses retrieval-augmented generation rather than relying solely on the LLM's built-in knowledge. PostgreSQL remains the transactional source of truth while pgvector enables semantic retrieval over product knowledge.

Retrieval may combine:
- structured filters such as price, inventory, occasion, and delivery eligibility;
- semantic similarity for fuzzy requests such as “romantic but understated, not roses”;
- live validation of product, price, inventory, and delivery claims before display.

Retrieved context is supplied to the LLM for grounded reasoning and explanation.

## Agentic AI role
Agentic AI coordinates the work needed to satisfy customer intent. It may:
- determine whether structured, semantic, or hybrid retrieval is appropriate;
- retrieve candidate products;
- invoke inventory, customer-context, delivery, and payment tools;
- assemble an execution plan;
- identify missing information;
- request customer confirmation where required;
- monitor post-order events and surface exceptions.

The agent does not directly mutate transactional tables. It invokes controlled business services that enforce rules and persist authoritative changes.

## Functional flow
1. Customer expresses intent in natural language.
2. AI interprets the request and progressively updates Shared Understanding.
3. Retrieval selects relevant product knowledge using structured and/or semantic search.
4. Live services validate price, availability, inventory, and delivery feasibility.
5. Recommendations materialize in the Adaptive Workspace.
6. Customer selects or refines products.
7. Agent prepares an execution plan using known customer, recipient, delivery, and payment context.
8. Workspace presents the assembled plan for customer validation rather than collecting redundant data.
9. Customer approves or modifies the plan conversationally.
10. Deterministic business services execute the approved transaction.
11. Domain events are published through Kafka and business-process orchestration advances the order state.
12. The workspace becomes a live order companion that monitors progress and surfaces only meaningful exceptions or decisions.

## MVP implementation boundary
The MVP should prove one thin end-to-end vertical slice rather than productionize every integration:

Customer intent → RAG/hybrid product retrieval → product selection → customer approval → order creation → Kafka event → inventory reservation → order-state update → confirmation to the customer.

Payment and delivery providers may initially be sandboxed or mocked, provided their service contracts and approval boundaries are represented.
