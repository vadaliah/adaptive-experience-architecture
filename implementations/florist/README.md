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

## Campaign capability

The Campaign Ribbon and natural-language prompts are independent inputs to one
Campaign capability: registered tool → `CampaignService` → `CampaignRepository`.
Ribbon clicks bypass Claude. Prompt decisions use the existing Bedrock tool
registry, grounded with current campaign IDs, names and descriptions from the
database. IDs are checked against those records before execution and looked up
again by the service. A conservative name-evidence guard rejects ungrounded
campaign selections; unsupported or ambiguous language can return a message.
Categories and occasions are not campaigns.

Tool contracts (inside the existing `{request, metadata}` agent envelope):

- `listCampaigns({})` → `{campaigns: [{campaignId, campaignName, campaignDescription, displaySequence}]}`.
- `getCampaignProducts({campaignId: string})` → `{campaign, products}`. No other
  arguments or filters are accepted. Products come from a parameterized join
  through `product_campaign_assignment`, with price and inventory data.

HTTP contracts:

- `GET /api/campaigns` lists campaigns in `display_sequence, campaign_id` order.
- `POST /api/intent` accepts exactly `{campaignId}` for explicit selection or
  `{prompt}` for agent orchestration. Mixed payloads/context/filters return 400;
  unknown explicit campaign IDs return 404.
- Intent results retain `metadata` and `dataset`, and add `kind` (`products`,
  `campaigns`, `message`), optional `message`, and
  `presentation: {selectedCampaignId: string | null}`.

Presentation selection and product results commit together after a successful
response. Failed/stale requests cannot replace a newer result. The selected ID is
never sent with a prompt, and no conversational filtering state is stored. Result
qualifiers are derived by the server from actual retrieval, never copied from
model-generated claims. Campaign results include all assigned products; price,
occasion, category and flower-only filtering are not implemented.

The canonical V003 database model is used without modifying database artifacts,
CDK, connection configuration, or the SQL runner. Tests use disposable local data;
application deployment and live model evaluation are separate activities.
