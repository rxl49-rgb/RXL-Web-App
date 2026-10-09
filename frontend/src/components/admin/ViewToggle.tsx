import { useState, useEffect } from 'react';
import { LayoutGrid, List } from 'lucide-react';

export type ViewMode = 'table' | 'card';

// Persists the chosen view (table vs. card) per page under its own localStorage key,
// so switching between Batches/Freight/Customers remembers each page's preference
// independently. Defaults to 'table'.
export function useViewMode(storageKey: string): [ViewMode, (v: ViewMode) => void] {
  const [view, setView] = useState<ViewMode>(() => {
    const stored = localStorage.getItem(storageKey);
    return stored === 'card' || stored === 'table' ? stored : 'table';
  });
  useEffect(() => {
    localStorage.setItem(storageKey, view);
  }, [storageKey, view]);
  return [view, setView];
}

export default function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-white/10 rounded-lg p-0.5">
      <button
        type="button"
        onClick={() => onChange('table')}
        aria-label="Table view"
        title="Table view"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
          view === 'table' ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80'
        }`}
      >
        <List className="w-3.5 h-3.5" /> Table
      </button>
      <button
        type="button"
        onClick={() => onChange('card')}
        aria-label="Card view"
        title="Card view"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
          view === 'card' ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80'
        }`}
      >
        <LayoutGrid className="w-3.5 h-3.5" /> Cards
      </button>
    </div>
  );
}
