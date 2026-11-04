/**
 * MD3 ripple: a wave expands from the pointer while pressed and fades out on release.
 * Any element with the `ripple` class gets it (delegated, so re-rendered nodes work too).
 */
const HOST = '.ripple';
/** MD3 pressed state-layer opacity, slightly boosted so the wave reads clearly. */
const PRESS = 0.16;

function spawn(host: HTMLElement, x: number, y: number, released = false) {
  const r = host.getBoundingClientRect();
  const size = Math.hypot(Math.max(x - r.left, r.right - x), Math.max(y - r.top, r.bottom - y)) * 2;
  const wave = document.createElement('span');
  wave.className = 'ripple-wave';
  wave.dataset.transient = '';
  wave.style.cssText = `width:${size}px;height:${size}px;left:${x - r.left - size / 2}px;top:${y - r.top - size / 2}px`;
  host.appendChild(wave);
  const grow = wave.animate(
    [
      { transform: 'scale(0.1)', opacity: 0.08 },
      { transform: 'scale(1)', opacity: PRESS },
    ],
    { duration: Math.min(600, 280 + size * 0.6), easing: 'cubic-bezier(.2,0,0,1)', fill: 'forwards' },
  );
  let done = false;
  const release = () => {
    if (done) return;
    done = true;
    const fade = () =>
      wave
        .animate([{ opacity: PRESS }, { opacity: 0 }], { duration: 260, easing: 'linear', fill: 'forwards' })
        .finished.then(() => wave.remove());
    // Let the wave finish at least most of its growth so quick taps still look complete.
    const t = grow.currentTime as number | null;
    if (t != null && t < 200) setTimeout(fade, 200 - t);
    else fade();
  };
  if (released) release();
  else {
    window.addEventListener('pointerup', release, { once: true });
    window.addEventListener('pointercancel', release, { once: true });
    host.addEventListener('pointerleave', release, { once: true });
  }
}

export function initRipple() {
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0) return;
      const host = (e.target as Element).closest<HTMLElement>(HOST);
      if (!host || host.matches(':disabled,[aria-disabled="true"]')) return;
      spawn(host, e.clientX, e.clientY);
    },
    { passive: true },
  );
  document.addEventListener('keydown', (e) => {
    if (e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return;
    const host = (e.target as Element).closest?.<HTMLElement>(HOST);
    if (!host || host !== e.target) return;
    const r = host.getBoundingClientRect();
    spawn(host, r.left + r.width / 2, r.top + r.height / 2, true);
  });
}
