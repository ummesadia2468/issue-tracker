import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

const Ctx = createContext(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const remove = (id) => setItems((l) => l.filter((t) => t.id !== id));
  const toast = useCallback((message, type = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l.slice(-2), { id, message, type }]);
    setTimeout(() => remove(id), 4500);
  }, []);

  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role="status" className="pointer-events-auto flex max-w-md animate-rise items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm font-medium shadow-pop">
            {t.type === 'ok' ? <CheckCircle2 className="h-5 w-5 shrink-0 text-accent" /> : <AlertCircle className="h-5 w-5 shrink-0 text-danger" />}
            <span>{t.message}</span>
            <button onClick={() => remove(t.id)} className="text-muted hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
