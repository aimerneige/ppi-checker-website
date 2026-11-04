/**
 * MD3 plain / rich tooltips rendered in a floating layer (so they're never clipped by cards).
 * Elements opt in with `data-tooltip="text"`; add `data-tooltip-rich` for multi-line help text,
 * which can also be toggled by tap on touch devices.
 */
let tipEl: HTMLDivElement | null = null;
let owner: HTMLElement | null = null;
let showTimer = 0;
let hideTimer = 0;

function show(target: HTMLElement) {
  clearTimeout(hideTimer);
  const text = target.dataset.tooltip;
  if (!text) return;
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tipEl);
  }
  owner = target;
  tipEl.className = `tooltip${target.hasAttribute('data-tooltip-rich') ? ' tooltip--rich' : ''}`;
  tipEl.textContent = text;
  const a = target.getBoundingClientRect();
  const t = tipEl.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  let top = a.bottom + 6;
  let below = true;
  if (top + t.height > window.innerHeight - 8) {
    top = a.top - 6 - t.height;
    below = false;
  }
  const left = Math.max(8, Math.min(a.left + a.width / 2 - t.width / 2, vw - t.width - 8));
  tipEl.style.top = `${top}px`;
  tipEl.style.left = `${left}px`;
  tipEl.style.transformOrigin = below ? 'top center' : 'bottom center';
  requestAnimationFrame(() => tipEl?.classList.add('is-open'));
}

function hide() {
  clearTimeout(showTimer);
  owner = null;
  tipEl?.classList.remove('is-open');
}

export function initTooltips() {
  const find = (e: Event) => (e.target as Element).closest?.<HTMLElement>('[data-tooltip]') ?? null;
  document.addEventListener('pointerover', (e) => {
    if ((e as PointerEvent).pointerType !== 'mouse') return;
    const el = find(e);
    if (!el || el === owner) return;
    clearTimeout(showTimer);
    showTimer = window.setTimeout(() => show(el), tipEl?.classList.contains('is-open') ? 0 : 450);
  });
  document.addEventListener('pointerout', (e) => {
    const el = find(e);
    if (el && !el.contains((e as PointerEvent).relatedTarget as Node)) {
      clearTimeout(showTimer);
      hideTimer = window.setTimeout(hide, 80);
    }
  });
  document.addEventListener('focusin', (e) => {
    const el = find(e);
    if (el && el.matches(':focus-visible')) show(el);
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('pointerdown', (e) => {
    const el = find(e);
    if (el?.hasAttribute('data-tooltip-rich') && (e as PointerEvent).pointerType !== 'mouse') {
      if (owner === el) hide();
      else {
        show(el);
        clearTimeout(hideTimer);
        hideTimer = window.setTimeout(hide, 5000);
      }
      return;
    }
    hide();
  });
  window.addEventListener('scroll', hide, { passive: true, capture: true });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && hide());
}
