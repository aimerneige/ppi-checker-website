import { icon, type IconName } from '../icons';
import { escapeHtml } from './menu';

export interface DialogAction {
  label: string;
  kind?: 'text' | 'filled';
  /** Return false to keep the dialog open (e.g. validation failed). */
  onClick?: (root: HTMLElement) => boolean | void;
  primary?: boolean;
}

export interface DialogOptions {
  title: string;
  icon?: IconName;
  body: string;
  actions: DialogAction[];
  onOpen?: (root: HTMLElement) => void;
}

export function openDialog(opts: DialogOptions) {
  const prevFocus = document.activeElement as HTMLElement | null;
  const wrap = document.createElement('div');
  wrap.className = 'dialog-layer';
  const titleId = `dlg-${Math.random().toString(36).slice(2, 8)}`;
  wrap.innerHTML = `
    <div class="scrim" data-close></div>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      ${opts.icon ? `<div class="dialog__icon">${icon(opts.icon)}</div>` : ''}
      <h2 class="dialog__title${opts.icon ? ' is-centered' : ''}" id="${titleId}">${escapeHtml(opts.title)}</h2>
      <div class="dialog__body">${opts.body}</div>
      <div class="dialog__actions">
        ${opts.actions
          .map(
            (a, i) =>
              `<button type="button" class="btn ripple ${a.kind === 'filled' ? 'btn--filled' : 'btn--text'}" data-i="${i}">${escapeHtml(a.label)}</button>`,
          )
          .join('')}
      </div>
    </div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('has-modal');
  const dialog = wrap.querySelector<HTMLElement>('.dialog')!;
  requestAnimationFrame(() => wrap.classList.add('is-open'));

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.classList.remove('is-open');
    wrap.classList.add('is-closing');
    document.removeEventListener('keydown', onKey, true);
    setTimeout(() => {
      wrap.remove();
      if (!document.querySelector('.dialog-layer')) document.body.classList.remove('has-modal');
    }, 200);
    prevFocus?.focus?.({ preventScroll: true });
  };

  const run = (a: DialogAction) => {
    if (a.onClick?.(dialog) === false) return;
    close();
  };

  wrap.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    if (el.hasAttribute('data-close')) return close();
    const btn = el.closest<HTMLButtonElement>('.dialog__actions .btn');
    if (btn) run(opts.actions[Number(btn.dataset.i)]);
  });

  const focusables = () =>
    Array.from(
      dialog.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])'),
    ).filter((el) => !el.hasAttribute('disabled'));

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
      const primary = opts.actions.find((a) => a.primary);
      if (primary) {
        e.preventDefault();
        run(primary);
      }
    } else if (e.key === 'Tab') {
      const f = focusables();
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener('keydown', onKey, true);

  opts.onOpen?.(dialog);
  const firstInput = dialog.querySelector<HTMLInputElement>('input');
  (firstInput ?? focusables()[0])?.focus();
  firstInput?.select();
  return { close, root: dialog };
}

// ---- Outlined text field (MD3) ----

export function textField(o: {
  id: string;
  label: string;
  value?: string;
  suffix?: string;
  helper?: string;
  numeric?: boolean;
}) {
  return `<div class="text-field" data-field="${o.id}">
    <input class="text-field__input" id="${o.id}" placeholder=" " autocomplete="off" spellcheck="false"
      ${o.numeric ? 'inputmode="decimal"' : ''} value="${escapeHtml(o.value ?? '')}" aria-describedby="${o.id}-help">
    <label class="text-field__label" for="${o.id}">${escapeHtml(o.label)}</label>
    ${o.suffix ? `<span class="text-field__suffix">${escapeHtml(o.suffix)}</span>` : ''}
    <span class="text-field__outline"></span>
    <span class="text-field__helper" id="${o.id}-help" data-default="${escapeHtml(o.helper ?? '')}">${escapeHtml(o.helper ?? '')}</span>
  </div>`;
}

export function setFieldError(root: HTMLElement, id: string, message: string | null) {
  const field = root.querySelector<HTMLElement>(`[data-field="${id}"]`);
  if (!field) return;
  const helper = field.querySelector<HTMLElement>('.text-field__helper')!;
  field.classList.toggle('is-error', !!message);
  helper.textContent = message ?? helper.dataset.default ?? '';
  const input = field.querySelector('input')!;
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (message) {
    field.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-6px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(-3px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 320, easing: 'ease-out' },
    );
  }
}

/** Parse a user-typed number, accepting both "," and "." as decimal separators and full-width digits. */
export function parseNumber(raw: string): number {
  const s = raw
    .trim()
    .replace(/[０-９．，]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(',', '.');
  if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return NaN;
  return parseFloat(s);
}
