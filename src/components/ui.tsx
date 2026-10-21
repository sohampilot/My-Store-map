import type { ReactNode } from 'react';

export const buttonClass =
  'rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800';
export const primaryButtonClass =
  'rounded border border-sky-600 bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40';
export const cardClass = 'rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900';

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export interface TabDefinition<T extends string> {
  id: T;
  label: string;
  badge?: string | number;
  disabled?: boolean;
}

export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: TabDefinition<T>[]; active: T; onChange: (id: T) => void }) {
  return (
    <div role="tablist" aria-label="Panels" className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          id={`tab-${tab.id}`}
          aria-selected={active === tab.id}
          aria-controls={`panel-${tab.id}`}
          disabled={tab.disabled}
          onClick={() => onChange(tab.id)}
          className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
            active === tab.id ? 'bg-white text-sky-700 shadow-sm dark:bg-slate-950 dark:text-sky-300' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
          }`}
        >
          {tab.label}
          {tab.badge !== undefined && (
            <span className="rounded-full bg-sky-600 px-1.5 text-[10px] font-semibold leading-4 text-white">{tab.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function GearIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
