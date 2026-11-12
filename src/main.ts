import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/app.css';

import { detectLocale, fmt, getLocale, LOCALES, onLocaleChange, setLocale, t } from './i18n';
import { initRipple } from './components/ripple';
import { initTooltips } from './components/tooltip';
import { openMenu } from './components/menu';
import { openDialog, parseNumber, setFieldError, textField } from './components/dialog';
import { toast } from './components/snackbar';
import { morph } from './morph';
import { ImageLoadError, loadImage, sampleImage, type LoadedImage } from './image';
import { initTheme, toggleTheme, currentTheme } from './theme';
import { allSizes, createStore, findSize, TARGET_PRESETS } from './store';
import { CATEGORIES, fromUnit, recommendedPpi, toUnit, type Category, type PrintSize } from './sizes';
import { view } from './view';

const locale = detectLocale();
setLocale(locale.code, false);
const store = createStore(locale.defaultUnit);
const app = document.getElementById('app')!;
const fileInput = document.getElementById('file-input') as HTMLInputElement;

// ---------- render ----------

const prevCounts = new Map<string, number>();
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function render() {
  const s = store.get();
  document.title = t('meta.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'));
  document.documentElement.dataset.themeMode = currentTheme();
  morph(app, view(s));
  afterRender();
}

function afterRender() {
  // Count-up animation for the big PPI number.
  app.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
    const to = Number(el.dataset.count);
    const from = prevCounts.get('ppi') ?? 0;
    prevCounts.set('ppi', to);
    if (from === to || reduceMotion.matches) return;
    const start = performance.now();
    const dur = 650;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(Math.round(from + (to - from) * eased));
      if (p < 1 && el.isConnected && el.dataset.count === String(to)) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  if (!app.querySelector('[data-count]')) prevCounts.delete('ppi');

  // Sliding tab indicator.
  const tabs = app.querySelector<HTMLElement>('.tabs');
  const activeTab = tabs?.querySelector<HTMLElement>('[aria-selected="true"]');
  if (tabs && activeTab) {
    let ind = tabs.querySelector<HTMLElement>('.tabs__indicator');
    if (!ind) {
      ind = document.createElement('span');
      ind.className = 'tabs__indicator';
      ind.dataset.transient = '';
      tabs.appendChild(ind);
    }
    const label = activeTab.querySelector('span')!;
    const w = label.getBoundingClientRect().width + 16;
    ind.style.width = `${w}px`;
    ind.style.transform = `translateX(${activeTab.offsetLeft + (activeTab.offsetWidth - w) / 2}px)`;
  }
}

store.subscribe(render);
onLocaleChange(render);
initTheme(render);
initRipple();
initTooltips();
window.addEventListener('resize', () => afterRender());
const onScroll = () => document.documentElement.classList.toggle('is-scrolled', window.scrollY > 4);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---------- image handling ----------

let removed: LoadedImage | null = null;

async function handleFile(file: File, source: 'pick' | 'paste' | 'drop' | 'sample' = 'pick') {
  store.set({ loading: true });
  try {
    const img = await loadImage(file);
    const old = store.get().image;
    if (old) URL.revokeObjectURL(old.url);
    if (removed) {
      URL.revokeObjectURL(removed.url);
      removed = null;
    }
    store.set({ image: img, loading: false });
    toast(source === 'paste' ? t('toast.pasted') : t('toast.loaded', { name: img.name }), {
      closeLabel: t('actions.dismiss'),
    });
  } catch (err) {
    store.set({ loading: false });
    const code = err instanceof ImageLoadError ? err.code : 'decode';
    toast(t(`errors.${code}`), { kind: 'error', closeLabel: t('actions.dismiss') });
  }
}

function filesFrom(list: FileList | DataTransferItemList | null | undefined): File[] {
  if (!list) return [];
  const out: File[] = [];
  for (const item of Array.from(list as ArrayLike<File | DataTransferItem>)) {
    const f = item instanceof File ? item : item.kind === 'file' ? item.getAsFile() : null;
    if (f) out.push(f);
  }
  return out;
}

function takeFirst(files: File[], source: 'pick' | 'paste' | 'drop') {
  if (!files.length) return;
  const images = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
  handleFile(images[0] ?? files[0], source);
  if (files.length > 1) setTimeout(() => toast(t('errors.tooMany'), { closeLabel: t('actions.dismiss') }), 3400);
}

fileInput.addEventListener('change', () => {
  takeFirst(filesFrom(fileInput.files), 'pick');
  fileInput.value = '';
});

document.addEventListener('paste', (e) => {
  if ((e.target as HTMLElement).closest('input, textarea')) return;
  const files = filesFrom(e.clipboardData?.items).filter((f) => f.type.startsWith('image/'));
  if (files.length) {
    e.preventDefault();
    takeFirst(files, 'paste');
  }
});

let dragDepth = 0;
const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
window.addEventListener('dragenter', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  if (dragDepth++ === 0) store.set({ dragging: true });
});
window.addEventListener('dragover', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'copy';
});
window.addEventListener('dragleave', (e) => {
  if (!hasFiles(e)) return;
  if (--dragDepth <= 0) {
    dragDepth = 0;
    store.set({ dragging: false });
  }
});
window.addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  store.set({ dragging: false });
  takeFirst(filesFrom(e.dataTransfer!.files), 'drop');
});

// ---------- menus & dialogs ----------

function languageMenu(anchor: HTMLElement) {
  openMenu(
    anchor,
    LOCALES.map((l) => ({ value: l.code, label: l.name, selected: l.code === getLocale().code })),
    (code) => setLocale(code),
    { align: 'end' },
  );
}

function targetMenu(anchor: HTMLElement) {
  const s = store.get();
  const custom = typeof s.target === 'number' && !(TARGET_PRESETS as readonly number[]).includes(s.target);
  openMenu(
    anchor,
    [
      {
        value: 'auto',
        label: t('target.auto'),
        supporting: t('target.autoHint', { ppi: fmt(recommendedPpi(findSize(s))) }),
        icon: 'sparkle',
        selected: s.target === 'auto',
      },
      ...TARGET_PRESETS.map((p) => ({
        value: String(p),
        label: `${fmt(p)} ppi`,
        supporting: t(`target.t${p}`),
        selected: s.target === p,
      })),
      {
        value: 'custom',
        label: t('target.custom'),
        supporting: custom ? `${fmt(s.target as number)} ppi` : undefined,
        icon: 'edit',
        selected: custom,
      },
    ],
    (v) => {
      if (v === 'auto') store.set({ target: 'auto' });
      else if (v === 'custom') customTargetDialog();
      else store.set({ target: Number(v) });
    },
    { matchWidth: true },
  );
}

function customTargetDialog() {
  const s = store.get();
  customPpiDialog(t('target.customTitle'), typeof s.target === 'number' ? s.target : 300, (v) => store.set({ target: v }));
}

function customPpiDialog(title: string, current: number, apply: (ppi: number) => void) {
  openDialog({
    title,
    icon: 'print',
    body: textField({
      id: 'f-ppi',
      label: t('target.customLabel'),
      value: String(current),
      suffix: 'ppi',
      helper: t('target.customHelper'),
      numeric: true,
    }),
    actions: [
      { label: t('actions.cancel') },
      {
        label: t('actions.apply'),
        kind: 'filled',
        primary: true,
        onClick: (root) => {
          const v = parseNumber(root.querySelector<HTMLInputElement>('#f-ppi')!.value);
          if (!(v >= 50 && v <= 1200)) {
            setFieldError(root, 'f-ppi', t('target.customHelper'));
            return false;
          }
          apply(Math.round(v));
        },
      },
    ],
  });
}

function customSizeDialog(existing?: PrintSize) {
  const s = store.get();
  const unit = s.unit;
  const max = unit === 'cm' ? 500 : 200;
  const show = (mm: number) => {
    const v = toUnit(mm, unit);
    return String(Math.round(v * 100) / 100);
  };
  openDialog({
    title: existing ? t('custom.editTitle') : t('custom.title'),
    icon: 'ruler',
    body: `<div class="form-grid">
        ${textField({ id: 'f-w', label: t('custom.width'), value: existing ? show(existing.w) : '', suffix: unit, numeric: true })}
        <span class="form-grid__x" aria-hidden="true">×</span>
        ${textField({ id: 'f-h', label: t('custom.height'), value: existing ? show(existing.h) : '', suffix: unit, numeric: true })}
      </div>
      ${textField({ id: 'f-name', label: t('custom.name'), value: existing?.customName ?? '' })}`,
    actions: [
      { label: t('actions.cancel') },
      {
        label: existing ? t('actions.save') : t('custom.add'),
        kind: 'filled',
        primary: true,
        onClick: (root) => {
          const val = (id: string) => root.querySelector<HTMLInputElement>(`#${id}`)!.value;
          let ok = true;
          const check = (id: string) => {
            const v = parseNumber(val(id));
            let err: string | null = null;
            if (!(v > 0)) err = t('custom.invalid');
            else if (v > max) err = t('custom.tooLarge', { max: `${max} ${unit}` });
            setFieldError(root, id, err);
            if (err) ok = false;
            return v;
          };
          const w = check('f-w');
          const h = check('f-h');
          if (!ok) return false;
          const nativeUnit = unit === 'in' ? 'in' : 'cm';
          const size: PrintSize = {
            id: existing?.id ?? `custom-${Date.now().toString(36)}`,
            category: 'custom',
            w: fromUnit(Math.min(w, h), unit),
            h: fromUnit(Math.max(w, h), unit),
            native: nativeUnit,
            named: false,
            customName: val('f-name').trim().slice(0, 40) || undefined,
          };
          const list = existing
            ? s.customSizes.map((c) => (c.id === existing.id ? size : c))
            : [...s.customSizes, size].slice(-20);
          store.set({ customSizes: list, sizeId: size.id, category: 'custom' });
          if (!existing) toast(t('custom.added'), { closeLabel: t('actions.dismiss') });
        },
      },
    ],
  });
}

function deleteCustom(id: string) {
  const s = store.get();
  const idx = s.customSizes.findIndex((c) => c.id === id);
  if (idx < 0) return;
  const item = s.customSizes[idx];
  const wasSelected = s.sizeId === id;
  const rest = s.customSizes.filter((c) => c.id !== id);
  store.set({
    customSizes: rest,
    sizeId: wasSelected ? (rest[0]?.id ?? 'photo-4r') : s.sizeId,
  });
  toast(t('custom.deleted'), {
    closeLabel: t('actions.dismiss'),
    action: {
      label: t('actions.undo'),
      onClick: () => {
        const cur = store.get();
        const list = [...cur.customSizes];
        list.splice(idx, 0, item);
        store.set({ customSizes: list, sizeId: wasSelected ? id : cur.sizeId });
      },
    },
  });
}

// ---------- event delegation ----------

app.addEventListener('click', async (e) => {
  const el = (e.target as Element).closest<HTMLElement>('[data-action]');
  if (!el) return;
  const s = store.get();
  const value = el.dataset.value ?? '';
  switch (el.dataset.action) {
    case 'pick':
      if (!s.loading) fileInput.click();
      break;
    case 'sample':
      e.stopPropagation();
      if (!s.loading) {
        store.set({ loading: true });
        handleFile(await sampleImage(), 'sample');
      }
      break;
    case 'remove': {
      const img = s.image;
      if (!img) break;
      if (removed) URL.revokeObjectURL(removed.url);
      removed = img;
      store.set({ image: null });
      toast(t('toast.removed'), {
        closeLabel: t('actions.dismiss'),
        action: {
          label: t('actions.undo'),
          onClick: () => {
            if (removed === img && !store.get().image) {
              removed = null;
              store.set({ image: img });
            }
          },
        },
      });
      break;
    }
    case 'lang':
      languageMenu(el);
      break;
    case 'theme': {
      const r = el.getBoundingClientRect();
      toggleTheme({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, render);
      break;
    }
    case 'target':
      targetMenu(el);
      break;
    case 'mode':
      store.set({ mode: value as 'fill' | 'fit' });
      break;
    case 'unit':
      store.set({ unit: value as 'cm' | 'in' });
      break;
    case 'rotate':
      store.set({ autoRotate: !s.autoRotate });
      break;
    case 'cat':
      store.set({ category: value as Category });
      break;
    case 'size': {
      const size = allSizes(s).find((p) => p.id === value);
      if (size) store.set({ sizeId: size.id, category: size.category });
      break;
    }
    case 'max-ppi':
      if (value === 'custom') customPpiDialog(t('maxPrint.customTitle'), s.maxPpi, (v) => store.set({ maxPpi: v }));
      else store.set({ maxPpi: Number(value) });
      break;
    case 'add-custom':
      customSizeDialog();
      break;
    case 'edit-custom':
      customSizeDialog(s.customSizes.find((c) => c.id === value));
      break;
    case 'delete-custom':
      deleteCustom(value);
      break;
  }
});

// Keyboard support for tabs (roving focus, MD3 / WAI-ARIA pattern) and segmented buttons.
app.addEventListener('keydown', (e) => {
  const tab = (e.target as Element).closest<HTMLElement>('[role="tab"]');
  const radio = (e.target as Element).closest<HTMLElement>('.segmented [role="radio"]');
  const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
  if (tab && (dir || e.key === 'Home' || e.key === 'End')) {
    e.preventDefault();
    const cur = CATEGORIES.indexOf(tab.dataset.value as Category);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? CATEGORIES.length - 1 : (cur + dir + CATEGORIES.length) % CATEGORIES.length;
    store.set({ category: CATEGORIES[next] });
    app.querySelector<HTMLElement>(`[data-tab="${CATEGORIES[next]}"]`)?.focus();
  } else if (radio && dir) {
    e.preventDefault();
    const group = Array.from(radio.parentElement!.querySelectorAll<HTMLElement>('[role="radio"]'));
    const next = group[(group.indexOf(radio) + dir + group.length) % group.length];
    next.click();
    next.focus();
  }
});

render();
document.documentElement.classList.add('is-ready');
