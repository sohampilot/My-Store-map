export function Legend() {
  return (
    <div className="rounded-xl border border-slate-300 p-3 text-xs dark:border-slate-700">
      <h3 className="mb-2 font-semibold">Legend</h3>
      <ul className="space-y-1">
        <li><span className="mr-2 inline-block h-3 w-3 bg-green-200" />Store</li>
        <li><span className="mr-2 inline-block h-3 w-3 rounded-full bg-amber-500" />Section Marker</li>
        <li><span className="mr-2 inline-block h-3 w-3 bg-orange-500" />Facility</li>
        <li><span className="mr-2 inline-block h-1 w-4 bg-sky-500" />Walking Route</li>
        <li><span className="mr-2 inline-block h-1 w-4 bg-violet-500" />MST Edge</li>
      </ul>
    </div>
  );
}
