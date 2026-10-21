# MallMap Navigator

MallMap Navigator is a React + TypeScript + Vite demo web app for exploring a fictional two-floor mall, searching items, visualizing a walkable navigation graph, generating shortest walking routes, and stepping through a minimum spanning tree (MST) computation.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite.

## Scripts

- `npm run dev` – start development server
- `npm run build` – typecheck and production build
- `npm run preview` – preview production build
- `npm run test` – run Vitest tests
- `npm run typecheck` – TypeScript check
- `npm run lint` – oxlint

## Features

- Interactive SVG mall map with floor selector, pan/zoom/reset
- 8 stores, multiple sections, facilities, entrances, stairs, elevator
- Search across 40+ sample items by name/category/keyword/store
- Full location output: `Floor → Store → Section → Aisle/Shelf`
- Route mode with Dijkstra shortest path and accessible-route filtering
- MST mode with Kruskal + union-find, deterministic tie-breaking, and step playback
- Connected-components handling (minimum spanning forest when disconnected)
- Local demo edit mode (items, stores, sections, nodes/edges, edge weights)
- localStorage persistence + reset/import/export JSON with validation
- Light/dark theme and accessible non-visual location list

## Architecture overview

- `src/algorithms/`: pure graph algorithms (`kruskal`, `dijkstra`, `unionFind`)
- `src/models/`: typed data model
- `src/data/`: fictional sample dataset JSON
- `src/services/`: replaceable `DataService` + `LocalDataService`
- `src/hooks/`: app data loading/persistence hook
- `src/components/`: map and supporting UI
- `src/utils/validation.ts`: import/edit validation
- `src/tests/`: Vitest algorithm and data-validation tests

## MST vs shortest-path mode

- **MST mode**: graph-structure visualization connecting all navigation nodes using minimum total edge weight. It does **not** represent user route guidance.
- **Route mode**: shortest walkable path from a selected start node to an item location using Dijkstra, optionally accessibility-filtered.

## Demo limitations

- Fictional mall and sample data only.
- Local demo edit mode is intentionally simple and stored in browser localStorage.
- No backend, external maps, paid services, or API keys.
