import type { NavigationNode } from '../models/types';

interface StartPointSelectProps {
  id: string;
  value: string;
  nodes: NavigationNode[];
  floorLabel: (floorId: string) => string;
  onChange: (nodeId: string) => void;
}

export function StartPointSelect({ id, value, nodes, floorLabel, onChange }: StartPointSelectProps) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium" htmlFor={id}>
        Starting point
      </label>
      <select id={id} className="w-full rounded border px-2 py-1.5 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        {nodes.map((node) => (
          <option key={node.id} value={node.id}>
            {node.label} ({floorLabel(node.floorId)})
          </option>
        ))}
      </select>
    </div>
  );
}
