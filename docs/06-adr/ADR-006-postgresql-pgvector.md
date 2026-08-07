# ADR-006 — PostgreSQL + pgvector
Status: Accepted

Use PostgreSQL as the authoritative transactional datastore and pgvector as the semantic retrieval extension. This supports relational consistency, structured filtering, flexible product metadata, and vector similarity without introducing a separate vector database for the MVP.

Embeddings support retrieval; transactional facts such as price, stock, order state, and payment state remain authoritative structured data.
