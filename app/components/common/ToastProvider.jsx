'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCircleExclamation, faCircleInfo, faXmark } from '@fortawesome/free-solid-svg-icons';

const ToastContext = createContext(null);

const getToastMeta = (type) => {
  switch (type) {
    case 'error':
      return {
        tone: 'border-red-500/50 bg-[#0b1220]',
        text: 'text-white',
        icon: faCircleExclamation,
        title: 'Not saved',
      };
    case 'info':
      return {
        tone: 'border-sky-500/50 bg-[#0b1220]',
        text: 'text-white',
        icon: faCircleInfo,
        title: 'Update',
      };
    case 'warning':
      return {
        tone: 'border-amber-500/50 bg-[#0b1220]',
        text: 'text-white',
        icon: faCircleExclamation,
        title: 'Check',
      };
    default:
      return {
        tone: 'border-emerald-400/50 bg-[#0b1220]',
        text: 'text-white',
        icon: faCheck,
        title: 'Saved',
      };
  }
};

const ToastViewport = ({ toasts, onDismiss }) => (
  <div className="pointer-events-none fixed top-5 right-4 z-[9999] flex w-[92vw] max-w-sm flex-col gap-3 sm:right-6">
    {toasts.map((toast) => {
      const meta = getToastMeta(toast.type);
      return (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className={`pointer-events-auto overflow-hidden rounded-2xl border px-4 py-3 shadow-[0_20px_50px_rgba(15,23,42,0.45)] backdrop-blur ${meta.tone} ${meta.text} animate-[aa-toast-in_0.18s_ease-out]`}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
              <FontAwesomeIcon icon={meta.icon} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">
                {toast.title || meta.title}
              </p>
              {toast.message && (
                <p className="mt-1 text-xs text-white/80">{toast.message}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition hover:bg-white/15 hover:text-white"
              aria-label="Dismiss notification"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        </div>
      );
    })}
    <style jsx global>{`
      @keyframes aa-toast-in {
        from {
          opacity: 0;
          transform: translate3d(0, -6px, 0) scale(0.98);
        }
        to {
          opacity: 1;
          transform: translate3d(0, 0, 0) scale(1);
        }
      }
    `}</style>
  </div>
);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const pushToast = useCallback(
    ({ type = 'success', title = '', message = '', duration = 3800 } = {}) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      if (duration > 0) {
        const timer = setTimeout(() => dismissToast(id), duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismissToast]
  );

  useEffect(() => {
    const handler = (event) => {
      if (!event?.detail) return;
      pushToast(event.detail);
    };
    window.addEventListener('aa-toast', handler);
    return () => window.removeEventListener('aa-toast', handler);
  }, [pushToast]);

  const value = useMemo(() => ({ pushToast, dismissToast }), [pushToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    return { pushToast: () => {}, dismissToast: () => {} };
  }
  return context;
};

export const emitToast = ({ type = 'success', title = '', message = '', duration } = {}) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('aa-toast', {
      detail: { type, title, message, duration },
    })
  );
};
