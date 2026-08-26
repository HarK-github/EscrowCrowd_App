import React, { createContext, useContext, useState, ReactNode } from 'react';

type ToastContextType = {
  toast: (message: string, type?: 'success' | 'error' | 'info') => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' | 'info' }[]>([]);

  const toast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-lg shadow-xl border backdrop-blur-md animate-in slide-in-from-bottom-5 fade-in duration-300 text-sm font-medium ${
              t.type === 'success' ? 'bg-green-500/20 border-green-500/30 text-green-100' :
              t.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-100' :
              'bg-white/10 border-white/20 text-white'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
