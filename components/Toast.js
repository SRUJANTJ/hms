import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

/*
  Lightweight toast notification system - no external dependency
  required. Wrap the app once in <ToastProvider> (see pages/_app.js)
  and then call useToast() from any component:

    const toast = useToast();
    toast.success('Student saved');
    toast.error('Something went wrong');
    toast.info('Heads up...');
    toast.warning('Careful with that');

  Toasts stack top-right, auto-dismiss after `duration` ms (default
  3500ms) and can be dismissed early by clicking the close icon.
*/

const ToastContext = createContext(null);

const VARIANTS = {
  success: {
    icon: CheckCircle2,
    classes: 'bg-white border-emerald-200 text-gray-800',
    iconClasses: 'text-emerald-500',
    bar: 'bg-emerald-500',
  },
  error: {
    icon: XCircle,
    classes: 'bg-white border-red-200 text-gray-800',
    iconClasses: 'text-red-500',
    bar: 'bg-red-500',
  },
  info: {
    icon: Info,
    classes: 'bg-white border-primary-200 text-gray-800',
    iconClasses: 'text-primary-500',
    bar: 'bg-primary-500',
  },
  warning: {
    icon: AlertTriangle,
    classes: 'bg-white border-amber-200 text-gray-800',
    iconClasses: 'text-amber-500',
    bar: 'bg-amber-500',
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback(
    (message, variant = 'info', duration = 3500) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((current) => [...current, { id, message, variant }]);

      if (duration > 0) {
        timers.current[id] = setTimeout(() => dismiss(id), duration);
      }

      return id;
    },
    [dismiss]
  );

  const api = {
    show: push,
    success: (message, duration) => push(message, 'success', duration),
    error: (message, duration) => push(message, 'error', duration),
    info: (message, duration) => push(message, 'info', duration),
    warning: (message, duration) => push(message, 'warning', duration),
    dismiss,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Toast stack */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[9999] flex flex-col items-end gap-2 p-4 sm:top-4 sm:right-4 sm:left-auto">
        {toasts.map((t) => {
          const variant = VARIANTS[t.variant] || VARIANTS.info;
          const Icon = variant.icon;

          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-lg border shadow-lg animate-slide-down ${variant.classes}`}
            >
              <span className={`absolute inset-y-0 left-0 w-1 ${variant.bar}`} />
              <div className="flex flex-1 items-start gap-2.5 py-3 pl-4 pr-2">
                <Icon size={18} className={`mt-0.5 shrink-0 ${variant.iconClasses}`} />
                <p className="text-sm font-medium leading-snug">{t.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="mr-2 mt-2.5 shrink-0 rounded p-0.5 text-gray-300 transition hover:bg-gray-100 hover:text-gray-500"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);

  if (!ctx) {
    // Fail soft rather than crashing the page if a component using
    // toasts ever renders outside the provider (shouldn't happen
    // since it's mounted once in _app.js).
    return {
      show: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
      warning: () => {},
      dismiss: () => {},
    };
  }

  return ctx;
}
