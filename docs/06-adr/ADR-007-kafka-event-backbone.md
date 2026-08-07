# ADR-007 — Kafka Event Backbone
Status: Accepted

Use Kafka as the asynchronous messaging backbone for commands and domain events between application components. Kafka transports messages; deterministic application logic remains responsible for business-process orchestration and state transitions.

Use domain-oriented topics, versioned schemas, correlation identifiers, and stable business keys such as `order_id`.
