# Customization Guide

## Replace fictional floor plan

1. Update `src/data/sampleMallData.json` store bounds, section markers, and facility coordinates.
2. Keep floor IDs consistent (`floors[]`, stores, sections, nodes, item locations).
3. Keep geometry (SVG rendering) separate from graph connections.

## Add floors, stores, sections, products

- Add floor entries in `floors`.
- Add stores with unique IDs and bounds.
- Add sections with matching `storeId` and `floorId`.
- Add items with one or more `locations[]` records.

## Adjust graph and edge weights

- Edit `graph.nodes` for entrances/intersections/store access/facilities.
- Edit `graph.edges` for walkable undirected links.
- Use explicit cross-floor edges (`stairs`/`elevator`) with tuned traversal costs.
- Keep weights in meters; never rely on straight-line-only assumptions.

## Replace local data with API later

Current architecture uses a replaceable service boundary:

- `src/services/DataService.ts` (interface)
- `src/services/LocalDataService.ts` (localStorage implementation)

To switch to HTTP/API data:

1. Create `HttpDataService` implementing `DataService`.
2. Keep `load/search/save/import/export/reset` signatures.
3. Swap the implementation used by `useMallData`.
4. Keep UI and algorithms unchanged.

## Extension points for Perplexity Computer workflows

- Data contracts are typed in `src/models/types.ts`.
- Validation rules are centralized in `src/utils/validation.ts`.
- Algorithms are pure functions in `src/algorithms/` and can be benchmarked independently.
- UI composition is component-based in `src/components/`.

No Perplexity integration endpoint is implemented in this version.
