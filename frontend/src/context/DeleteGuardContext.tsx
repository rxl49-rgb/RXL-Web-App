import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

interface DeleteGuardContextValue {
  // Kept for backwards compatibility with any page still reading this — the
  // "type DELETE to confirm" step below is now always shown, unconditionally,
  // on every delete action app-wide, so this no longer gates anything.
  requirePasswordOnDelete: boolean;
  setRequirePasswordOnDelete: (v: boolean) => void;
  // Drop-in replacement for window.confirm() before a delete action. Always
  // shows a confirmation modal and only resolves true once the admin has
  // typed the word "delete" (case-insensitive) into the confirmation field.
  confirmDelete: (message: string) => Promise<boolean>;
}

const DeleteGuardContext = createContext<DeleteGuardContextValue | null>(null);

const CONFIRM_WORD = 'delete';

export function DeleteGuardProvider({ children }: { children: ReactNode }) {
  const [requirePasswordOnDelete, setRequirePasswordOnDelete] = useState(true);
  const [modalMessage, setModalMessage] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const finish = useCallback((result: boolean) => {
    setModalMessage(null);
    setConfirmText('');
    setError('');
    resolveRef.current?.(result);
    resolveRef.current = null;
  }, []);

  const confirmDelete = useCallback((message: string) => {
    return new Promise<boolean>(resolve => {
      resolveRef.current = resolve;
      setError('');
      setConfirmText('');
      setModalMessage(message);
    });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText.trim().toLowerCase() !== CONFIRM_WORD) {
      setError('Type "delete" to confirm');
      return;
    }
    finish(true);
  };

  return (
    <DeleteGuardContext.Provider value={{ requirePasswordOnDelete, setRequirePasswordOnDelete, confirmDelete }}>
      {children}
      {modalMessage && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl p-6 w-full max-w-sm shadow-lg">
            <h3 className="font-bold text-gray-900 dark:text-white mb-1">Confirm deletion</h3>
            <p className="text-sm text-gray-500 dark:text-white/50 mb-4">{modalMessage}</p>
            <form onSubmit={handleSubmit}>
              <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1">Type <span className="font-semibold text-gray-700 dark:text-white/80">delete</span> to confirm</label>
              <input
                type="text"
                autoFocus
                autoComplete="off"
                value={confirmText}
                onChange={e => { setConfirmText(e.target.value); setError(''); }}
                placeholder="delete"
                className="w-full border rounded-lg px-3 py-2 text-sm mb-1 bg-white dark:bg-white/5 dark:border-white/10 dark:text-white"
              />
              {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
              <div className="flex gap-2 mt-4">
                <button type="button" onClick={() => finish(false)} className="flex-1 border rounded-xl py-2.5 text-sm font-semibold text-gray-600 dark:text-white/60 dark:border-white/10 transition-colors">Cancel</button>
                <button type="submit" disabled={confirmText.trim().toLowerCase() !== CONFIRM_WORD} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50 transition-colors">
                  Delete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DeleteGuardContext.Provider>
  );
}

export function useDeleteGuard() {
  const ctx = useContext(DeleteGuardContext);
  if (!ctx) throw new Error('useDeleteGuard must be used within DeleteGuardProvider');
  return ctx;
}
