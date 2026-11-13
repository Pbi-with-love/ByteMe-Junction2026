---
name: gemini-frontend-design
description: >-
  Gemini/Argon-only frontend design skill for UI pages, components, layout,
  design tokens, and visual polish. Produces a cohesive accessible design and
  implementation handoff for Codex.
---

# Gemini Frontend Design (Argon)

## Purpose
Deliver intentional, high-craft UI/UX design that fits the product domain. Gemini owns frontend design; Codex owns implementation, TDD, testing, and Playwright verification.

## 1. Ground in Context First
1. Read the assigned spec (`docs/specs/NNN-<slug>.md`) and relevant project memory, especially `docs/memory/CONVENTIONS.md` and `ARCHITECTURE.md`.
2. Inspect existing design tokens, CSS/Tailwind config, typography, and component patterns so new UI feels native and consistent.
3. Respect the spec's `May edit` / `Must not touch` scope. Only edit design artifacts when explicitly permitted; otherwise provide the design handoff without changing files.

## 2. Design Principles
- **Clear Visual Hierarchy**: Establish a deliberate primary focal point, readable type scale, consistent spacing rhythm, and purposeful contrast.
- **Cohesive Token System**: Define or reuse semantic tokens (surface, text, border, accent, status colors, spacing, radii) rather than ad-hoc magic values.
- **Complete Interactive States**: Specify `default`, `hover`, `focus-visible`, `active`, `disabled`, `loading`, `empty`, and `error` states as applicable.
- **Responsive & Accessible**: Support mobile and desktop without horizontal overflow; specify semantic HTML, keyboard navigation, and sufficient color contrast.
- **Avoid Generic Templates**: Avoid cliché gradients, cluttered card nesting, and unaligned grids.

## 3. Handoff to Codex
Report design decisions, tokens, layout, typography, responsive behavior, interaction/accessibility states, stable selectors or accessible roles where relevant, files/artifacts changed if permitted, and any assumptions or asset placeholders. Do not implement application code or own tests/Playwright verification.
