import { useState } from 'react';
import type { ReactNode } from 'react';
import type { SearchResult } from '../models/types';
import { resultKey } from '../utils/resultKey';

interface SearchBoxProps {
  search: (query: string) => SearchResult[];
  placeholder?: string;
  /** Called on Enter with the first result. */
  onSubmit?: (result: SearchResult) => void;
  isActive?: (result: SearchResult) => boolean;
  renderActions: (result: SearchResult) => ReactNode;
  onResultClick?: (result: SearchResult) => void;
  maxHeightClass?: string;
}

export function SearchBox({ search, placeholder, onSubmit, isActive, renderActions, onResultClick, maxHeightClass = 'max-h-56' }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const results = search(query);

  return (
    <div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && results.length > 0) onSubmit?.(results[0]);
          if (event.key === 'Escape') setQuery('');
        }}
        type="search"
        aria-label="Search items"
        className="w-full rounded border px-3 py-2 text-sm"
        placeholder={placeholder ?? 'Search items, categories or stores'}
      />
      {query.trim().length === 0 ? null : results.length === 0 ? (
        <p className="mt-2 text-xs text-amber-600">No results found. Try broader keywords.</p>
      ) : (
        <ul className={`mt-2 ${maxHeightClass} space-y-1 overflow-auto text-sm`}>
          {results.map((result) => (
            <li
              key={resultKey(result)}
              className={`flex items-center gap-2 rounded border p-2 ${isActive?.(result) ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/30' : ''}`}
            >
              <button className="min-w-0 flex-1 text-left" onClick={() => onResultClick?.(result)}>
                <div className="truncate font-medium">{result.item.name}</div>
                <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {result.floor.label} · {result.store.name} · {result.section.name} · {result.location.aisleLabel}
                </div>
              </button>
              <div className="flex flex-none gap-1">{renderActions(result)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
