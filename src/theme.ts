export type ThemeMode = 'light' | 'dark';
const KEY = 'ppi.theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

/** Explicit user choice, or null when following the OS. */
const saved = () => localStorage.getItem(KEY) as ThemeMode | null;
export const currentTheme = (): ThemeMode => saved() ?? (media.matches ? 'dark' : 'light');

function apply(mode: ThemeMode) {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
  const bg = getComputedStyle(root).getPropertyValue('--md-surface').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || (mode === 'dark' ? '#141218' : '#fef7ff'));
}

export function initTheme(onChange: () => void) {
  apply(currentTheme());
  media.addEventListener('change', () => {
    if (!saved()) {
      apply(currentTheme());
      onChange();
    }
  });
}

/** Toggle light/dark with a circular reveal from the clicked point (View Transitions API when available). */
export function toggleTheme(origin: { x: number; y: number } | null, onChange: () => void) {
  const next: ThemeMode = currentTheme() === 'dark' ? 'light' : 'dark';
  localStorage.setItem(KEY, next);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
  if (!doc.startViewTransition || reduce || !origin) {
    apply(next);
    onChange();
    return;
  }
  const { x, y } = origin;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const vt = doc.startViewTransition(() => {
    apply(next);
    onChange();
  });
  vt.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 520, easing: 'cubic-bezier(.2,0,0,1)', pseudoElement: '::view-transition-new(root)' },
    );
  });
}
