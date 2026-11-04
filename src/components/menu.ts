import { icon, type IconName } from '../icons';

export interface MenuItem {
  value: string;
  label: string;
  supporting?: string;
  icon?: IconName;
  trailing?: string;
  selected?: boolean;
}

interface MenuOptions {
  /** Make the menu at least as wide as the anchor (exposed dropdown style). */
  matchWidth?: boolean;
  align?: 'start' | 'end';
}

let active: { close: (restoreFocus?: boolean) => void; anchor: HTMLElement } | null = null;

export function isMenuOpenFor(anchor: HTMLElement) {
  return active?.anchor === anchor;
}

export function closeMenu() {
  active?.close(false);
}

export function openMenu(
  anchor: HTMLElement,
  items: MenuItem[],
  onSelect: (value: string) => void,
  opts: MenuOptions = {},
) {
  if (active) {
    const same = active.anchor === anchor;
    active.close(false);
    if (same) return; // second click toggles closed
  }

  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.setAttribute('role', 'menu');
  const labelledBy = anchor.id || '';
  if (labelledBy) menu.setAttribute('aria-labelledby', labelledBy);
  menu.innerHTML = items
    .map(
      (it, i) => `<button type="button" class="menu-item ripple${it.selected ? ' is-selected' : ''}"
        role="menuitemradio" aria-checked="${it.selected ? 'true' : 'false'}" data-value="${escapeAttr(it.value)}"
        tabindex="-1" style="--i:${i}">
        ${it.icon ? `<span class="menu-item__lead">${icon(it.icon)}</span>` : ''}
        <span class="menu-item__text"><span class="menu-item__label">${escapeHtml(it.label)}</span>${
          it.supporting ? `<span class="menu-item__support">${escapeHtml(it.supporting)}</span>` : ''
        }</span>
        ${it.trailing ? `<span class="menu-item__trail">${escapeHtml(it.trailing)}</span>` : ''}
        <span class="menu-item__check">${icon('check')}</span>
      </button>`,
    )
    .join('');
  document.body.appendChild(menu);

  // ---- positioning ----
  const place = () => {
    const a = anchor.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    if (opts.matchWidth) menu.style.minWidth = `${a.width}px`;
    const m = menu.getBoundingClientRect();
    const gap = 4;
    let top = a.bottom + gap;
    let origin = 'top';
    if (top + m.height > vh - 8 && a.top - gap - m.height > 8) {
      top = a.top - gap - m.height;
      origin = 'bottom';
    }
    top = Math.max(8, Math.min(top, vh - m.height - 8));
    let left = opts.align === 'end' ? a.right - m.width : a.left;
    left = Math.max(8, Math.min(left, vw - m.width - 8));
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menu.style.maxHeight = `${vh - 16}px`;
    menu.style.transformOrigin = `${opts.align === 'end' ? 'right' : 'left'} ${origin}`;
  };
  place();
  requestAnimationFrame(() => menu.classList.add('is-open'));

  const buttons = Array.from(menu.querySelectorAll<HTMLButtonElement>('.menu-item'));
  const focusAt = (i: number) => buttons[(i + buttons.length) % buttons.length]?.focus({ preventScroll: true });
  const initial = Math.max(0, items.findIndex((i) => i.selected));
  focusAt(initial);
  anchor.setAttribute('aria-expanded', 'true');

  let closed = false;
  const close = (restoreFocus = true) => {
    if (closed) return;
    closed = true;
    active = null;
    anchor.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutside, true);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', onScroll, true);
    menu.classList.remove('is-open');
    menu.classList.add('is-closing');
    setTimeout(() => menu.remove(), 160);
    if (restoreFocus) anchor.focus({ preventScroll: true });
  };

  const onOutside = (e: PointerEvent) => {
    const t = e.target as Node;
    if (!menu.contains(t) && !anchor.contains(t)) close(false);
  };
  const onResize = () => close(false);
  const onScroll = (e: Event) => {
    if (menu.contains(e.target as Node)) return;
    const a = anchor.getBoundingClientRect();
    if (a.bottom < 0 || a.top > window.innerHeight) close(false);
    else place();
  };
  document.addEventListener('pointerdown', onOutside, true);
  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', onScroll, true);

  menu.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('.menu-item');
    if (!btn) return;
    const value = btn.dataset.value!;
    // Let the ripple play a beat before the menu disappears.
    setTimeout(() => {
      close();
      onSelect(value);
    }, 90);
  });

  menu.addEventListener('keydown', (e) => {
    const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusAt(idx + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusAt(idx - 1);
        break;
      case 'Home':
        e.preventDefault();
        focusAt(0);
        break;
      case 'End':
        e.preventDefault();
        focusAt(buttons.length - 1);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        close(false);
        break;
      default:
        if (e.key.length === 1) {
          const k = e.key.toLowerCase();
          const start = idx + 1;
          for (let n = 0; n < buttons.length; n++) {
            const b = buttons[(start + n) % buttons.length];
            if (b.textContent?.trim().toLowerCase().startsWith(k)) {
              b.focus();
              break;
            }
          }
        }
    }
  });

  active = { close, anchor };
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const escapeAttr = escapeHtml;
