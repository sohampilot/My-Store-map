import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  side?: 'right' | 'center';
  widthClass?: string;
}

/** Accessible slide-over / modal dialog. Closes on Escape or backdrop click. */
export function Drawer({ open, title, onClose, children, side = 'right', widthClass = 'w-full max-w-sm' }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Focus the dialog once when it opens and restore focus when it closes.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className={`fixed inset-0 z-50 flex ${side === 'right' ? 'justify-end' : 'items-center justify-center p-4'}`}>
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative flex flex-col bg-white shadow-xl outline-none dark:bg-slate-900 ${widthClass} ${
          side === 'right' ? 'h-full' : 'max-h-[90vh] rounded-xl'
        }`}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="rounded px-2 py-1 text-xl leading-none hover:bg-slate-100 dark:hover:bg-slate-800" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">{children}</div>
      </div>
    </div>
  );
}
