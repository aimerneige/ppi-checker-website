import { fmt, getLocale, t, tDynamic } from './i18n';
import { icon } from './icons';
import { escapeHtml as esc } from './components/menu';
import { allSizes, findSize, TARGET_PRESETS, type State } from './store';
import {
  aspectLabel,
  CATEGORIES,
  evaluate,
  largestFitting,
  maxPrintSize,
  recommendedPpi,
  toUnit,
  type Evaluation,
  type PrintSize,
  type Status,
  type Unit,
} from './sizes';

export const REPO_URL = 'https://github.com/aimerneige/ppi-checker-website';

// ---------- formatting helpers ----------

const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const isTouch = window.matchMedia('(pointer: coarse)').matches;

function num(v: number, unit: Unit | 'mm') {
  const digits = unit === 'mm' ? 0 : unit === 'cm' ? 1 : 2;
  return fmt(v, digits);
}

/** "10.2 × 15.2 cm" — mm-native sizes stay in mm when the user picked metric (A4 = 210 × 297 mm). */
export function dims(wmm: number, hmm: number, unit: Unit, native?: PrintSize['native']) {
  const u: Unit | 'mm' = unit === 'cm' && native === 'mm' ? 'mm' : unit;
  return `${num(toUnit(wmm, u), u)} × ${num(toUnit(hmm, u), u)} ${u}`;
}

function nativeDims(s: PrintSize) {
  const u = s.native;
  return `${num(toUnit(s.w, u), u)} × ${num(toUnit(s.h, u), u)} ${u}`;
}

export function sizeName(s: PrintSize) {
  if (s.category === 'custom') return s.customName?.trim() || nativeDims(s);
  return s.named ? tDynamic(`presets.${s.id}`) : nativeDims(s);
}

function sizeSub(s: PrintSize, unit: Unit, w = s.w, h = s.h) {
  const d = dims(w, h, unit, s.native);
  return d === sizeName(s) ? aspectLabel(w, h) : d;
}

export const targetFor = (state: State, size: PrintSize) =>
  state.target === 'auto' ? recommendedPpi(size) : state.target;

export function evalFor(state: State, size: PrintSize): Evaluation | null {
  if (!state.image) return null;
  return evaluate(state.image.width, state.image.height, size, state.mode, state.autoRotate, targetFor(state, size));
}

const statusIcon = (s: Status) => icon(s === 'pass' ? 'checkCircle' : s === 'warn' ? 'warning' : 'error');

function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${fmt(n / 1024, 0)} KB`;
  return `${fmt(n / 1024 ** 2, 1)} MB`;
}

function px(w: number, h: number) {
  return `${fmt(w)} × ${fmt(h)} px`;
}

function tip(text: string, rich = false) {
  return `data-tooltip="${esc(text)}"${rich ? ' data-tooltip-rich' : ''}`;
}

// ---------- sections ----------

function topBar() {
  const loc = getLocale();
  return `<header class="top-bar">
    <a class="brand" href="./" aria-label="${esc(t('app.title'))}">
      <span class="brand__mark">${icon('print')}</span>
      <span class="brand__text">
        <span class="brand__title">${esc(t('app.title'))}</span>
        <span class="brand__tagline">${esc(t('app.tagline'))}</span>
      </span>
    </a>
    <div class="top-bar__actions">
      <button type="button" id="btn-lang" class="btn btn--tonal btn--compact ripple" data-action="lang"
        aria-haspopup="menu" aria-expanded="false" aria-label="${esc(t('actions.language'))}">
        ${icon('translate')}<span class="hide-xs">${esc(loc.name)}</span>${icon('expand', 'btn__trail')}
      </button>
      <button type="button" class="icon-btn ripple" data-action="theme" ${tip(t('actions.theme'))} aria-label="${esc(t('actions.theme'))}">
        <span class="theme-icon">${icon('light', 'theme-icon__sun')}${icon('dark', 'theme-icon__moon')}</span>
      </button>
      <a class="icon-btn ripple" href="${REPO_URL}" target="_blank" rel="noopener noreferrer"
        ${tip('GitHub')} aria-label="${esc(t('actions.github'))}">${icon('github')}</a>
    </div>
  </header>`;
}

function imageCard(s: State) {
  if (!s.image) {
    return `<section class="card card--upload" data-key="upload">
      <div class="dropzone ripple${s.loading ? ' is-loading' : ''}" data-action="pick">
        <div class="dropzone__art">${s.loading ? '<span class="spinner" aria-hidden="true"></span>' : icon('upload')}</div>
        <h2 class="dropzone__title">${esc(s.loading ? t('upload.loading') : t(isTouch ? 'upload.titleTouch' : 'upload.title'))}</h2>
        <p class="dropzone__hint">${esc(isTouch ? t('upload.hintTouch') : t('upload.hint', { shortcut: isMac ? '⌘V' : 'Ctrl+V' }))}</p>
        <div class="dropzone__actions">
          <button type="button" class="btn btn--filled ripple" data-action="pick">${icon('image')}<span>${esc(t('actions.choose'))}</span></button>
          <button type="button" class="btn btn--text ripple" data-action="sample">${icon('sparkle')}<span>${esc(t('actions.sample'))}</span></button>
        </div>
        <p class="dropzone__formats">${esc(t('upload.formats'))}</p>
      </div>
      <p class="privacy">${icon('lock')}<span>${esc(t('upload.privacy'))}</span></p>
    </section>`;
  }
  const img = s.image;
  return `<section class="card card--image" data-key="image">
    <div class="image-preview"><img src="${img.url}" alt="${esc(img.name)}" decoding="async"></div>
    <div class="image-meta">
      <div class="image-meta__head">
        <h2 class="image-meta__name">${esc(img.name)}</h2>
        <div class="image-meta__actions">
          <button type="button" class="btn btn--tonal btn--compact ripple" data-action="pick">${icon('upload')}<span>${esc(t('actions.replace'))}</span></button>
          <button type="button" class="icon-btn ripple" data-action="remove" ${tip(t('actions.remove'))} aria-label="${esc(t('actions.remove'))}">${icon('delete')}</button>
        </div>
      </div>
      <dl class="facts">
        <div class="fact fact--wide"><dt>${esc(t('image.pixels'))}</dt><dd>${px(img.width, img.height)}</dd></div>
        <div class="fact"><dt>${esc(t('image.megapixels'))}</dt><dd>${fmt((img.width * img.height) / 1e6, 1)} MP</dd></div>
        <div class="fact"><dt>${esc(t('image.aspect'))}</dt><dd>${aspectLabel(img.width, img.height)}</dd></div>
        <div class="fact"><dt>${esc(t('image.fileSize'))}</dt><dd>${bytes(img.bytes)}</dd></div>
        <div class="fact"><dt>${esc(t('image.embeddedDpi'))}
          <button type="button" class="info-btn" ${tip(t('image.embeddedHint'), true)} aria-label="${esc(t('image.embeddedHint'))}">${icon('info')}</button></dt>
          <dd>${img.embeddedDpi ? `${fmt(img.embeddedDpi)} dpi` : esc(t('image.embeddedNone'))}</dd></div>
      </dl>
    </div>
  </section>`;
}

function maxPrintCard(s: State) {
  const img = s.image!;
  const ppi = s.maxPpi;
  const { w, h } = maxPrintSize(img.width, img.height, ppi);
  const other: Unit = s.unit === 'cm' ? 'in' : 'cm';
  const best = largestFitting(allSizes(s), img.width, img.height, ppi, s.mode, s.autoRotate);
  const isPreset = (TARGET_PRESETS as readonly number[]).includes(ppi);
  const chip = (value: string, label: string, selected: boolean, ic: 'check' | 'edit' = 'check') =>
    `<button type="button" class="filter-chip ripple" data-action="max-ppi" data-value="${value}" aria-pressed="${selected}">
      ${selected || ic === 'edit' ? icon(selected ? 'check' : ic) : ''}<span>${esc(label)}</span></button>`;
  const chips = [
    ...TARGET_PRESETS.map((p) => chip(String(p), fmt(p), p === ppi)),
    chip('custom', isPreset ? t('maxPrint.custom') : `${fmt(ppi)} ppi`, !isPreset, 'edit'),
  ].join('');
  const fit = best
    ? `<button type="button" class="maxprint__fit ripple" data-action="size" data-value="${best.id}" ${tip(t('maxPrint.select'))}>
        <span class="maxprint__fit-text">
          <span class="maxprint__fit-label">${esc(t('maxPrint.bestFit'))}</span>
          <span class="maxprint__fit-name">${esc(sizeName(best))}</span>
          <span class="maxprint__fit-dims">${esc(dims(best.w, best.h, s.unit, best.native))}</span>
        </span>
        ${icon('expand', 'maxprint__fit-arrow')}
      </button>`
    : `<div class="maxprint__fit is-none">
        <span class="maxprint__fit-text">
          <span class="maxprint__fit-label">${esc(t('maxPrint.bestFit'))}</span>
          <span class="maxprint__fit-name">${esc(t('maxPrint.bestFitNone'))}</span>
        </span>
      </div>`;
  return `<section class="card card--maxprint" data-key="maxprint">
    <div class="card__head">
      <h2 class="card__title">${esc(t('maxPrint.title'))}</h2>
      <p class="card__subtitle">${esc(t('maxPrint.subtitle'))}</p>
    </div>
    <div class="filter-chips" role="group" aria-label="${esc(t('maxPrint.ppiLabel'))}">
      <span class="filter-chips__label">${esc(t('maxPrint.ppiLabel'))}</span>${chips}
    </div>
    <div class="maxprint__main">
      <div class="maxprint__result">
        <div class="result__label">${esc(t('maxPrint.result', { ppi: fmt(ppi) }))}</div>
        <div class="maxprint__value">${num(toUnit(w, s.unit), s.unit)} × ${num(toUnit(h, s.unit), s.unit)}<small>${s.unit}</small></div>
        <div class="maxprint__alt">${esc(dims(w, h, other))} · ${esc(t('maxPrint.diagonal', { d: `${fmt(toUnit(Math.hypot(w, h), s.unit), s.unit === 'cm' ? 1 : 2)} ${s.unit}` }))}</div>
      </div>
      ${fit}
    </div>
    <p class="setting__hint">${esc(t('maxPrint.hint'))}</p>
  </section>`;
}

function preview(s: State, ev: Evaluation) {
  // Draw the union of paper and printed image; shade what gets cropped / leave blank paper visible.
  const uw = Math.max(ev.paperW, ev.printW);
  const uh = Math.max(ev.paperH, ev.printH);
  const box = (w: number, h: number) =>
    `left:${((uw - w) / 2 / uw) * 100}%;top:${((uh - h) / 2 / uh) * 100}%;width:${(w / uw) * 100}%;height:${(h / uh) * 100}%`;
  const ratio = uw / uh;
  return `<figure class="preview preview--${s.mode}" aria-label="${esc(t('result.preview'))}">
    <div class="preview__stage" style="--ratio:${ratio.toFixed(4)}">
      <div class="preview__paper" style="${box(ev.paperW, ev.paperH)}"></div>
      <img class="preview__img" src="${s.image!.url}" alt="" style="${box(ev.printW, ev.printH)}">
      <div class="preview__frame" style="${box(ev.paperW, ev.paperH)}"></div>
    </div>
    <figcaption>${esc(dims(ev.paperW, ev.paperH, s.unit, findSize(s).native))}</figcaption>
  </figure>`;
}

function meter(ev: Evaluation) {
  const max = ev.target * 1.6;
  const pct = (v: number) => Math.min(100, (v / max) * 100);
  return `<div class="meter" role="meter" aria-valuemin="0" aria-valuemax="${Math.round(max)}" aria-valuenow="${Math.round(ev.ppi)}"
      aria-label="${esc(t('result.ppi'))}" style="--warn:${pct(ev.target * 0.8)}%;--pass:${pct(ev.target)}%">
    <div class="meter__track">
      <div class="meter__fill" style="width:${Math.max(2, pct(ev.ppi))}%"></div>
    </div>
    <div class="meter__mark" style="left:${pct(ev.target)}%"><span>${esc(t('result.target', { ppi: fmt(ev.target) }))}</span></div>
  </div>`;
}

function resultCard(s: State) {
  const size = findSize(s);
  const target = targetFor(s, size);
  const ev = evalFor(s, size);
  const head = (paperW: number, paperH: number, rotated: boolean) => `<div class="result__head">
      <div class="overline">${esc(t('sizes.selected'))}</div>
      <h2 class="result__size">${esc(sizeName(size))}</h2>
      <div class="result__dims">${esc(dims(paperW, paperH, s.unit, size.native))}
        ${rotated ? `<span class="chip chip--assist" ${tip(t('result.rotated'))}>${icon('swap')}<span class="sr-only">${esc(t('result.rotated'))}</span></span>` : ''}</div>
    </div>`;

  if (!ev) {
    const needW = Math.ceil(toUnit(size.w, 'in') * target);
    const needH = Math.ceil(toUnit(size.h, 'in') * target);
    return `<section class="card card--result is-empty" data-key="result-empty">
      ${head(size.w, size.h, false)}
      <div class="empty-result">
        <div class="empty-result__art">${icon('image')}</div>
        <div class="empty-result__text">
          <p class="empty-result__title">${esc(t('result.empty'))}</p>
          <p class="empty-result__hint">${esc(t('result.emptyHint'))}</p>
        </div>
      </div>
      <dl class="stats">
        <div class="stat"><dt>${esc(t('result.need'))} · ${fmt(target)} ppi</dt><dd>${px(needW, needH)}</dd></div>
      </dl>
    </section>`;
  }

  const img = s.image!;
  const upscale = ev.target / ev.ppi;
  const statusText = t(`result.${ev.status}` as 'result.pass');
  const tipText =
    ev.status === 'pass' ? t('result.passTip', { size: sizeName(size) }) : t(`result.${ev.status}Tip` as 'result.warnTip');
  return `<section class="card card--result status-${ev.status}" data-key="result">
    ${head(ev.paperW, ev.paperH, ev.rotated)}
    <div class="result__main">
      <div class="result__score">
        <div class="result__label">${esc(t('result.ppi'))}</div>
        <div class="result__ppi"><span data-count="${Math.round(ev.ppi)}">${fmt(Math.round(ev.ppi))}</span><small>ppi</small></div>
        <span class="status-pill">${statusIcon(ev.status)}<span>${esc(statusText)}</span></span>
      </div>
      ${preview(s, ev)}
    </div>
    ${meter(ev)}
    <p class="result__tip">${esc(tipText)}</p>
    <dl class="stats">
      <div class="stat"><dt>${esc(t('result.need'))}</dt><dd>${px(ev.needW, ev.needH)}</dd></div>
      <div class="stat"><dt>${esc(t('result.maxSize'))} · ${fmt(ev.target)} ppi</dt><dd>${esc(dims((img.width / ev.target) * 25.4, (img.height / ev.target) * 25.4, s.unit))}</dd></div>
      <div class="stat"><dt>${esc(t(s.mode === 'fill' ? 'result.cropped' : 'result.border'))}</dt><dd>${ev.waste < 0.005 ? esc(t('result.none')) : `${fmt(ev.waste * 100, 0)}%`}</dd></div>
      <div class="stat"><dt>${esc(t('result.upscale'))}</dt><dd>${upscale <= 1.0001 ? esc(t('result.none')) : `×${fmt(upscale, 2, 2)}`}</dd></div>
    </dl>
  </section>`;
}

export function targetLabel(s: State) {
  if (s.target === 'auto') return `${t('target.auto')} · ${fmt(recommendedPpi(findSize(s)))} ppi`;
  const key = `target.t${s.target}`;
  const preset = [350, 300, 240, 200, 150, 100].includes(s.target);
  return `${fmt(s.target)} ppi · ${preset ? tDynamic(key) : t('target.customValue')}`;
}

function segmented(action: string, value: string, options: { value: string; label: string }[], label: string) {
  return `<div class="segmented" role="radiogroup" aria-label="${esc(label)}">
    ${options
      .map(
        (o) => `<button type="button" role="radio" class="segmented__btn ripple" data-action="${action}" data-value="${o.value}"
          aria-checked="${o.value === value}"><span class="segmented__check">${icon('check')}</span><span>${esc(o.label)}</span></button>`,
      )
      .join('')}
  </div>`;
}

function settingsCard(s: State) {
  return `<section class="card card--settings">
    <h2 class="card__title">${esc(t('settings.title'))}</h2>
    <div class="setting">
      <div class="select-field">
        <button type="button" id="btn-target" class="select ripple" data-action="target" aria-haspopup="menu" aria-expanded="false"
          aria-label="${esc(t('settings.target'))}: ${esc(targetLabel(s))}">
          <span class="select__value">${esc(targetLabel(s))}</span>
          ${icon('expand', 'select__arrow')}
        </button>
        <span class="select__label" aria-hidden="true">${esc(t('settings.target'))}</span>
      </div>
      ${s.target === 'auto' ? `<p class="setting__hint">${esc(t('target.autoHint', { ppi: fmt(recommendedPpi(findSize(s))) }))}</p>` : ''}
    </div>
    <div class="setting setting--split">
      <div class="setting__col">
        <div class="setting__label">${esc(t('settings.mode'))}</div>
        ${segmented('mode', s.mode, [
          { value: 'fill', label: t('settings.fill') },
          { value: 'fit', label: t('settings.fit') },
        ], t('settings.mode'))}
      </div>
      <div class="setting__col setting__col--narrow">
        <div class="setting__label">${esc(t('settings.unit'))}</div>
        ${segmented('unit', s.unit, [
          { value: 'cm', label: 'cm' },
          { value: 'in', label: 'in' },
        ], t('settings.unit'))}
      </div>
    </div>
    <p class="setting__hint setting__hint--tight">${esc(t(s.mode === 'fill' ? 'settings.fillHint' : 'settings.fitHint'))}</p>
    <div class="switch-row" data-action="rotate">
      <div class="switch-row__text">
        <div class="switch-row__title" id="lbl-rotate">${esc(t('settings.autoRotate'))}</div>
        <div class="switch-row__hint">${esc(t('settings.autoRotateHint'))}</div>
      </div>
      <button type="button" class="switch" role="switch" aria-checked="${s.autoRotate}" aria-labelledby="lbl-rotate" data-action="rotate">
        <span class="switch__handle">${icon('check', 'switch__icon')}</span>
      </button>
    </div>
  </section>`;
}

function sizeRow(s: State, size: PrintSize) {
  const ev = evalFor(s, size);
  const selected = size.id === s.sizeId;
  const w = ev?.paperW ?? size.w;
  const h = ev?.paperH ?? size.h;
  const ar = w / h;
  const shape = ar >= 1 ? `width:100%;height:${100 / ar}%` : `height:100%;width:${ar * 100}%`;
  const target = targetFor(s, size);
  const trail = ev
    ? `<span class="ppi-badge status-${ev.status}">${statusIcon(ev.status)}<b>${fmt(Math.round(ev.ppi))}</b><small>ppi</small></span>`
    : `<span class="size-row__need">${px(Math.ceil(toUnit(size.w, 'in') * target), Math.ceil(toUnit(size.h, 'in') * target))}</span>`;
  const custom = size.category === 'custom';
  return `<li class="size-row${selected ? ' is-selected' : ''}" data-key="${size.id}">
    <button type="button" class="size-row__main ripple" data-action="size" data-value="${size.id}" aria-pressed="${selected}">
      <span class="size-row__shape"><span style="${shape}"></span></span>
      <span class="size-row__text">
        <span class="size-row__title">${esc(sizeName(size))}</span>
        <span class="size-row__sub">${esc(sizeSub(size, s.unit, w, h))}</span>
      </span>
      <span class="size-row__trail">${trail}</span>
    </button>
    ${
      custom
        ? `<div class="size-row__tools">
        <button type="button" class="icon-btn icon-btn--sm ripple" data-action="edit-custom" data-value="${size.id}" ${tip(t('custom.edit'))} aria-label="${esc(t('custom.edit'))}">${icon('edit')}</button>
        <button type="button" class="icon-btn icon-btn--sm ripple" data-action="delete-custom" data-value="${size.id}" ${tip(t('actions.delete'))} aria-label="${esc(t('actions.delete'))}">${icon('delete')}</button>
      </div>`
        : ''
    }
  </li>`;
}

function sizesCard(s: State) {
  const sizes = allSizes(s);
  const inCat = sizes.filter((p) => p.category === s.category);
  let summary = `<p class="card__subtitle">${esc(t('sizes.noImageHint'))}</p>`;
  if (s.image) {
    const pass = sizes.filter((p) => evalFor(s, p)!.status === 'pass').length;
    summary = `<p class="card__subtitle">${esc(t('sizes.passCount', { n: fmt(pass), total: fmt(sizes.length) }))}</p>`;
  }
  const tabs = CATEGORIES.map((c) => {
    const count = s.image ? sizes.filter((p) => p.category === c && evalFor(s, p)!.status === 'pass').length : 0;
    return `<button type="button" role="tab" class="tab ripple" data-action="cat" data-value="${c}" data-tab="${c}"
      aria-selected="${c === s.category}" tabindex="${c === s.category ? 0 : -1}">
      <span>${esc(t(`categories.${c}`))}</span>${count ? `<span class="tab__badge">${fmt(count)}</span>` : ''}
    </button>`;
  }).join('');
  const list =
    s.category === 'custom' && !inCat.length
      ? `<div class="custom-empty">${icon('ruler')}<p>${esc(t('custom.empty'))}</p></div>`
      : `<ul class="size-list" role="list">${inCat.map((p) => sizeRow(s, p)).join('')}</ul>`;
  return `<section class="card card--sizes">
    <div class="card__head">
      <h2 class="card__title">${esc(t('sizes.title'))}</h2>
      ${summary}
    </div>
    <div class="tabs" role="tablist" aria-label="${esc(t('sizes.title'))}">${tabs}</div>
    <div class="tab-panel" role="tabpanel" data-key="panel-${s.category}">
      ${list}
      ${s.category === 'custom' ? `<button type="button" class="btn btn--outlined ripple add-custom" data-action="add-custom">${icon('add')}<span>${esc(t('custom.add'))}</span></button>` : ''}
    </div>
  </section>`;
}

function footer() {
  return `<footer class="footer">
    <div class="footer__how">
      <h2>${esc(t('footer.howTitle'))}</h2>
      <p>${esc(t('footer.how'))}</p>
    </div>
    <div class="footer__meta">
      <span>${esc(t('footer.madeWith'))}</span>
      <a class="footer__link" href="${REPO_URL}" target="_blank" rel="noopener noreferrer">${icon('github')}<span>GitHub</span></a>
    </div>
  </footer>`;
}

export function view(s: State) {
  return `${topBar()}
  <main class="layout">
    <div class="layout__primary">
      ${imageCard(s)}
      ${s.image ? maxPrintCard(s) : ''}
      ${resultCard(s)}
    </div>
    <div class="layout__secondary">
      ${settingsCard(s)}
      ${sizesCard(s)}
    </div>
  </main>
  ${footer()}
  <div class="drop-overlay${s.dragging ? ' is-active' : ''}" aria-hidden="true">
    <div class="drop-overlay__inner">${icon('upload')}<span>${esc(t('upload.overlay'))}</span></div>
  </div>`;
}
