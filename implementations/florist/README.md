# Lily's Florist Reference Implementation

Primary pathway:
Discover → Understand → Recommend → Deliver → Confirm → Track → Remember


# Lily's Florist Reference Implementation

Lily is the reference implementation used to prove the Adaptive Experience Architecture (AEA).

Primary pathway:

Discover → Understand → Recommend → Deliver → Confirm → Track → Remember

## Current implementation milestone

The first end-to-end discovery vertical slice is operational.

A customer can express product-discovery intent in natural language through the Expo/React interface. The backend submits the intent to Claude through Amazon Bedrock, resolves the selected application capability through the AEA tool registry, executes deterministic product retrieval against Aurora PostgreSQL, normalizes the result into the Resulting Data Store, and returns it to the Adaptive Workspace for dynamic rendering.

Current implemented flow:

    Natural-language intent
        ↓
    Expo / React UI
        ↓
    Express intent API
        ↓
    Claude / Amazon Bedrock
        ↓
    AEA Tool Registry
        ↓
    searchProducts
        ↓
    Catalog Repository
        ↓
    Aurora PostgreSQL
        ↓
    Resulting Data Store
        ↓
    Dynamic result rendering

## Resulting Data Store

The UI receives a presentation-independent result contract containing:

- semantic title;
- applied qualifiers;
- deterministic result count;
- dataset records.

The UI does not require knowledge of the originating agent tool, repository, SQL query, or database infrastructure.

## Local runtime

The backend runtime initialization:

1. loads the local environment;
2. validates AWS authentication and initiates SSO login when required;
3. discovers the database AccessHost;
4. validates SSM availability;
5. discovers the Aurora endpoint;
6. establishes an SSM port-forwarding session;
7. starts the backend application.

Runtime state is maintained under:

    implementations/florist/backend/runtime/

The root npm commands provide the primary controls:

    npm run start:backend
    npm run stop:backend

The Expo web client can be started with:

    npm --prefix implementations/florist/ui run web

## Known development limitation

The local database route depends on a persistent AWS SSM port-forwarding session. A transient SSM network failure can terminate the forwarding session while the backend process remains active.

Runtime supervision/reconnection for a failed SSM session remains a development-runtime improvement.
