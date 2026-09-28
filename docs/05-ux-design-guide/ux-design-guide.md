# UX and Figma Design Guide

## Sections
- Header
- Conversation
- Shared Understanding
- Adaptive Workspace

## Typography
- AEA / H1
- AEA / H2
- AEA / H3
- AEA / Body
- AEA / Secondary
- AEA / Caption

## Layout rules
- Use Frames for major sections.
- Use Auto Layout for reusable containers.
- Keep Discovery vertical.
- Header is horizontal.
- Conversation stacks vertically.
- Avoid tabs and spaces for positioning.
- Preserve stable regions during updates.
- Use grayscale for low fidelity.

## Adaptive result rendering

The Adaptive Workspace consumes the Resulting Data Store rather than tool-specific response models.

For data-oriented results:

- `metadata.title` provides the primary result heading;
- `metadata.resultCount` communicates result volume;
- dataset fields may be used to derive the initial tabular presentation;
- `metadata.qualifiers` provide contextual filter information separately from the primary heading;
- an empty qualifier collection should be represented unobtrusively rather than incorporated into the title.

The heading should remain short, meaningful, and abstract. Detailed filtering criteria belong in secondary filter context, such as a qualifier region, filter summary, or tooltip.

The first MVP renderer uses a generic data grid to prove this contract. Future adaptive renderers may select cards, comparison views, product experiences, confirmation views, or other presentation patterns without changing the underlying capability execution boundary.
