# Contributing to TraceLens

Thanks for helping improve TraceLens. This document covers the local workflow and the conventions that keep the codebase easy to review.

## Setup

```bash
npm install
npm run dev
npm test
npm run typecheck
```

## Project layout

- `packages/core` — pure domain logic. No framework imports, no I/O beyond optional provider calls.
- `apps/server` — Express API and persistence.
- `apps/web` — React UI.
- `packages/cli` — terminal client.

## Conventions

- Use TypeScript strict mode; avoid `any`.
- Keep risk weights in `packages/core/src/scoring.ts` so scores stay explainable.
- New providers must implement `DataSourceProvider` and be deterministic when running in demo mode.
- Reports must remain valid Markdown with a Mermaid diagram.

## Pull requests

1. Fork the repo and create a topic branch.
2. Add or update tests for behavioural changes.
3. Ensure `npm test`, `npm run typecheck`, and `npm run build` pass.
4. Describe the change and include a screenshot for UI work.

## Responsible use

Do not add providers that collect data without authorisation. Keep synthetic demo data in reserved documentation ranges.
