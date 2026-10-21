import type { Section, Store } from '../models/types';

interface AccessibleLocationListProps {
  stores: Store[];
  sections: Section[];
  onSelectStore: (storeId: string) => void;
  onSelectSection: (sectionId: string) => void;
}

export function AccessibleLocationList({ stores, sections, onSelectStore, onSelectSection }: AccessibleLocationListProps) {
  return (
    <div className="rounded-xl border border-slate-300 p-3 dark:border-slate-700">
      <h3 className="mb-2 font-semibold">Accessible location list</h3>
      <ul className="max-h-48 space-y-2 overflow-auto text-sm">
        {stores.map((store) => (
          <li key={store.id}>
            <button className="font-medium underline" onClick={() => onSelectStore(store.id)}>
              {store.name}
            </button>
            <ul className="ml-4 mt-1 list-disc">
              {sections
                .filter((section) => section.storeId === store.id)
                .map((section) => (
                  <li key={section.id}>
                    <button className="underline" onClick={() => onSelectSection(section.id)}>
                      {section.name}
                    </button>
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
