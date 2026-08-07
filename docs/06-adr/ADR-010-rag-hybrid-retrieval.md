# ADR-010 — RAG and Hybrid Retrieval
Status: Accepted

Ground recommendations in Lily's product knowledge using retrieval-augmented generation. Use structured PostgreSQL filters for exact business constraints and pgvector semantic search for fuzzy intent. Combine both when appropriate.

Retrieved candidates must be validated against authoritative product, inventory, pricing, and delivery data before claims are displayed or transactions are executed.
