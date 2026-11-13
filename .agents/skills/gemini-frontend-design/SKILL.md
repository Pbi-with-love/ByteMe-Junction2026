---
name: gemini-frontend-design
description: >-
  Use for the Argon Design subagent whenever a spec involves UI, frontend
  pages, components, layout, design tokens, or visual polish. Establishes a
  cohesive design system, accessible interactive states, and clean handoff
  criteria for Hydrogen implementation and playwright-cli verification.
---

# Gemini Frontend Design (Argon)

## Purpose
Deliver intentional, high-craft UI/UX design and frontend styling that fits the product domain and stays strictly within `Scope.May edit`.

## 1. Ground in Context First
1. Read the assigned spec (`docs/specs/NNN-<slug>.md`) and `docs/memory/CONVENTIONS.md` / `ARCHITECTURE.md`.
2. Inspect existing design tokens, CSS/Tailwind config, typography, and component patterns in the repo so new UI feels native and consistent.

## 2. Design Principles
- **Clear Visual Hierarchy**: Establish a deliberate primary focal point, readable type scale, consistent spacing rhythm, and purposeful use of contrast.
- **Cohesive Token System**: Define or reuse semantic tokens (surface, ink/text, border, accent, semantic status colors, spacing, radii) rather than ad-hoc magic values.
- **Complete Interactive States**: Explicitly design and style `default`, `hover`, `focus-visible`, `active`, `disabled`, `loading`, `empty`, and `error` states.
- **Responsive & Accessible**: Support mobile and desktop viewports cleanly without horizontal overflow; use semantic HTML, keyboard navigation, and sufficient color contrast.
- **Avoid Generic Templates**: Do not fall back to cliché gradients, cluttered card-in-card nesting, or unaligned grids.

## 3. Handoff for Hydrogen (TDD + Playwright)
When returning your work to the Argon Lead (for Hydrogen implementation/verification):
- List all design/style/component files created or updated.
- Document key UI states, responsive breakpoints, and stable selectors / accessible roles (`getByRole`, `data-testid` if used) so Hydrogen can write deterministic unit tests and `playwright-cli` flows.
- Note any visual assumptions or asset placeholders.
