import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ToastItem {
  id: string;
  title: string;
  desc?: string;
  icon?: 'check' | 'alert' | 'info' | 'warn' | 'dang' | 'bell' | 'refresh' | 'shield' | 'lock';
  type?: 'success' | 'alert' | 'info' | 'warn';
  duration?: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

let toastList: ToastItem[] = [];
const listeners = new Set<ToastListener>();

function notify() {
  listeners.forEach((listener) => listener([...toastList]));
}

export function showToast(
  titleOrOptions: string | Omit<ToastItem, 'id'>,
  descOrIcon?: string,
  iconKey?: ToastItem['icon']
) {
  let title = '';
  let desc = '';
  let icon: ToastItem['icon'] = 'check';
  let duration = 3500;

  if (typeof titleOrOptions === 'object' && titleOrOptions !== null) {
    title = titleOrOptions.title || '';
    desc = titleOrOptions.desc || '';
    icon = titleOrOptions.icon || (titleOrOptions.type === 'alert' ? 'alert' : 'check');
    if (titleOrOptions.duration) duration = titleOrOptions.duration;
  } else {
    title = String(titleOrOptions || '');
    if (descOrIcon && ['check', 'alert', 'info', 'warn', 'dang', 'bell', 'refresh', 'shield', 'lock'].includes(descOrIcon)) {
      icon = descOrIcon as ToastItem['icon'];
      desc = '';
    } else {
      desc = descOrIcon || '';
      icon = iconKey || 'check';
    }
  }

  // Deduplicate exact same message if already showing
  const existingIdx = toastList.findIndex((t) => t.title === title && t.desc === desc);
  if (existingIdx !== -1) {
    return;
  }

  const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newItem: ToastItem = { id, title, desc, icon, duration };

  // Keep max 3 toasts visible
  if (toastList.length >= 3) {
    toastList = toastList.slice(toastList.length - 2);
  }

  toastList = [...toastList, newItem];
  notify();

  setTimeout(() => {
    toastList = toastList.filter((t) => t.id !== id);
    notify();
  }, duration);
}

// Global browser window fallback
if (typeof window !== 'undefined') {
  (window as any).showToast = showToast;
  (window as any).toast = showToast;
}

export const GlobalToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleUpdate = (updated: ToastItem[]) => setToasts(updated);
    listeners.add(handleUpdate);
    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  if (toasts.length === 0) return null;

  const content = (
    <div id="toasts" aria-live="polite" aria-atomic="true">
      {toasts.map((t) => {
        const isAlert = t.icon === 'alert' || t.icon === 'dang';
        const isWarn = t.icon === 'warn';
        const isInfo = t.icon === 'info' || t.icon === 'refresh' || t.icon === 'bell';
        const isShield = t.icon === 'shield' || t.icon === 'lock';

        const iconClass = isAlert
          ? 'fa-solid fa-circle-exclamation'
          : isWarn
          ? 'fa-solid fa-triangle-exclamation'
          : isInfo
          ? 'fa-solid fa-circle-info'
          : isShield
          ? 'fa-solid fa-shield-halved'
          : 'fa-solid fa-check';

        const toneClass = isAlert ? 'dang' : isWarn ? 'warn' : isInfo ? 'info' : isShield ? 'purple' : 'ok';

        return (
          <div
            key={t.id}
            className="toast"
            onClick={() => {
              toastList = toastList.filter((item) => item.id !== t.id);
              notify();
            }}
          >
            <div className={`toast-ic ${toneClass}`}>
              <i className={iconClass} />
            </div>
            <div className="toast-body">
              <div className="toast-title">{t.title}</div>
              {t.desc && <div className="toast-desc">{t.desc}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};
