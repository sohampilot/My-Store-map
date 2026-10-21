# Data Schema

## Core model

```ts
Node: {
  id, label, type, floorId, x, y, storeId?, sectionId?
}

Edge: {
  id, from, to, weight, accessible, connectionType
}

connectionType: corridor | doorway | stairs | elevator
```

Additional records:

- `floors`: `{ id, label }`
- `stores`: `{ id, name, floorId, bounds }`
- `sections`: `{ id, storeId, floorId, name, marker }`
- `facilities`: entrances, restrooms, info desks, stairs, elevators
- `items`: `{ id, name, category, keywords, locations[] }`
- `item.locations[]`: `{ id, floorId, storeId, sectionId, aisleLabel, navigationNodeId }`

## Coordinate and distance conventions

- Map coordinates use a shared SVG grid (x/y in map units).
- Edge `weight` values are meters (positive finite values).
- Cross-floor transitions use explicit elevator/stairs edges and configured costs.

## Cross-floor rules

- Floor transitions must be represented only by `stairs` or `elevator` edges.
- Accessible routing excludes edges where `accessible === false`.
- Item locations always point to a valid navigation node.

## Example records

```json
{
  "id": "n-f1-elevator",
  "label": "Elevator Floor 1",
  "type": "elevator",
  "floorId": "f1",
  "x": 360,
  "y": 320
}
```

```json
{
  "id": "e17",
  "from": "n-f1-elevator",
  "to": "n-f2-elevator",
  "weight": 24,
  "accessible": true,
  "connectionType": "elevator"
}
```

```json
{
  "id": "item-1",
  "name": "Laptop Pro 14",
  "category": "electronics",
  "keywords": ["laptop", "electronics"],
  "locations": [
    {
      "id": "loc-1-1",
      "floorId": "f1",
      "storeId": "s-tech",
      "sectionId": "s-tech-sec-a",
      "aisleLabel": "Aisle 2",
      "navigationNodeId": "n-s-tech-sec-a"
    }
  ]
}
```

## Import validation rules

- IDs must be unique in each entity group.
- Foreign keys must reference existing floor/store/section/node IDs.
- Section floor must match parent store floor.
- Node coordinates must be finite.
- Edge endpoints must exist and edge weights must be positive finite numbers.
- Item location `navigationNodeId` must exist.
- Broken references produce explicit validation errors and are never silently retained.
