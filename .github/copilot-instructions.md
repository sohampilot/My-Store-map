# Copilot Instructions for MallMap Navigator

## Project conventions

- Keep graph algorithms pure and independent from React UI.
- Keep map rendering geometry separate from navigation graph topology.
- Keep item catalog and graph persistence concerns in service/hook layers.
- Preserve TypeScript typing across models and services.

## Architecture boundaries

- `src/algorithms/*`: pure Kruskal / Dijkstra / union-find.
- `src/services/*`: persistence and dataset operations.
- `src/utils/validation.ts`: import/edit validation rules.
- `src/components/*`: presentational and interaction UI.
- `src/App.tsx`: high-level orchestration.

## Commands for checking changes

```bash
npm install
npm run typecheck
npm run test
npm run build
```

## Non-negotiable requirement

Do not use MST output as route guidance. Keep shortest-path routing logic and MST visualization logic separate.
