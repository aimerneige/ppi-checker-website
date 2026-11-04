import { icon } from '../icons';
import { escapeHtml } from './menu';

interface ToastOptions {
  action?: { label: string; onClick: () => void };
  kind?: 'info' | 'error';
  duration?: number;
  closeLabel?: string;
}

let current: { el: HTMLElement; timer: number } | null = null;

function dismiss(el: HTMLElement) {
  el.classList.remove('is-open');
  el.classList.add('is-closing');
  setTimeout(() => el.remove(), 220);
}

export function toast(message: string, opts: ToastOptions = {}) {
  if (current) {
    clearTimeout(current.timer);
    dismiss(current.el);
  }
  const el = document.createElement('div');
  el.className = `snackbar${opts.kind === 'error' ? ' snackbar--error' : ''}`;
  el.setAttribute('role', opts.kind === 'error' ? 'alert' : 'status');
  el.innerHTML = `
    ${opts.kind === 'error' ? `<span class="snackbar__icon">${icon('error')}</span>` : ''}
    <span class="snackbar__text">${escapeHtml(message)}</span>
    ${opts.action ? `<button type="button" class="btn btn--text snackbar__action ripple">${escapeHtml(opts.action.label)}</button>` : ''}
    <button type="button" class="icon-btn icon-btn--sm snackbar__close ripple" aria-label="${escapeHtml(opts.closeLabel ?? 'Close')}">${icon('close')}</button>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-open'));

  const close = () => {
    if (current?.el === el) {
      clearTimeout(current.timer);
      current = null;
    }
    dismiss(el);
  };
  el.querySelector('.snackbar__action')?.addEventListener('click', () => {
    opts.action!.onClick();
    close();
  });
  el.querySelector('.snackbar__close')!.addEventListener('click', close);

  const duration = opts.duration ?? (opts.kind === 'error' || opts.action ? 6000 : 3200);
  const start = () => window.setTimeout(close, duration);
  current = { el, timer: start() };
  // Pause auto-dismiss while hovered so users can read / reach the action.
  el.addEventListener('pointerenter', () => current?.el === el && clearTimeout(current.timer));
  el.addEventListener('pointerleave', () => {
    if (current?.el === el) current.timer = start();
  });
}
