export function Legend() {
  return (
    <div className="rounded-xl border border-slate-300 p-3 text-xs dark:border-slate-700" role="note" aria-label="Map legend">
      <h3 className="mb-2 font-semibold">Legend</h3>
      <ul className="grid grid-cols-2 gap-1">
        <li><span className="mr-2 inline-block h-3 w-3 border border-green-800 bg-green-200" />Store</li>
        <li><span className="mr-2 inline-block h-3 w-3 rounded-full bg-amber-500" />Section</li>
        <li><span className="mr-2 inline-block h-3 w-3 bg-orange-500" />Facility</li>
        <li><span className="mr-2 inline-block h-0.5 w-4 bg-slate-400 align-middle" />Walkway</li>
        <li><span className="mr-2 inline-block h-1 w-4 bg-sky-500 align-middle" />Walking route</li>
        <li><span className="mr-2 inline-block h-1 w-4 bg-violet-500 align-middle" />MST edge</li>
        <li><span className="mr-2 inline-block h-3 w-3 rounded-full bg-green-600" />Route start</li>
        <li><span className="mr-2 inline-block h-3 w-3 rounded-full bg-red-600" />Destination</li>
        <li><span className="mr-2 inline-block h-3 w-3 rounded-full bg-blue-600 ring-2 ring-blue-300" />You (guide)</li>
        <li><span className="mr-2 inline-block h-0.5 w-4 border-t border-dashed border-slate-500 align-middle" />Stairs only</li>
        <li><span className="mr-2 inline-block h-3 w-3 rounded-full bg-indigo-600" />Trip stop</li>
        <li><span className="mr-2 inline-block h-1 w-4 bg-indigo-500 align-middle" />Trip tree link</li>
      </ul>
    </div>
  );
}
