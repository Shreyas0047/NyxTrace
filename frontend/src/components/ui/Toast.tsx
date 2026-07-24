import { useEffect, useState } from 'react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
}

const toastListeners: Array<(msg: ToastMessage) => void> = [];

function generateId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

export function toast(message: string, variant: ToastVariant = 'info') {
  const id = generateId();
  const msg: ToastMessage = { id, message, variant };
  toastListeners.forEach(fn => fn(msg));
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler = (msg: ToastMessage) => {
      setItems(prev => [...prev, msg]);
      setTimeout(() => {
        setItems(prev => prev.filter(m => m.id !== msg.id));
      }, 4000);
    };
    toastListeners.push(handler);
    return () => {
      const idx = toastListeners.indexOf(handler);
      if (idx >= 0) toastListeners.splice(idx, 1);
    };
  }, []);

  if (items.length === 0) return null;

  const variantStyles: Record<ToastVariant, string> = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    warning: 'bg-yellow-500 text-black',
    info: 'bg-blue-600',
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {items.map(item => (
        <div
          key={item.id}
          className={`px-4 py-2 rounded shadow-lg text-white text-sm transition-all duration-300 ${variantStyles[item.variant]}`}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
