// Print size presets. All dimensions are stored in millimetres, portrait (w <= h).
// `native` is the unit the size is defined in, so we can show "4 × 6 in" rather than "101.6 × 152.4 mm".

export type Unit = 'cm' | 'in';
export type Category = 'photo' | 'paper' | 'poster' | 'id' | 'custom';

export interface PrintSize {
  id: string;
  category: Category;
  w: number; // mm
  h: number; // mm
  native: 'mm' | 'cm' | 'in';
  /** When true the size has a translated name in `presets.<id>`; otherwise its native dimensions are its name. */
  named: boolean;
  /** User-provided name for custom sizes. */
  customName?: string;
}

export const MM_PER_INCH = 25.4;
const inch = (v: number) => v * MM_PER_INCH;

const p = (
  id: string,
  category: Category,
  w: number,
  h: number,
  native: PrintSize['native'],
  named = true,
): PrintSize => ({ id, category, w, h, native, named });

export const PRESETS: PrintSize[] = [
  // Photo prints – the sizes photo labs actually sell.
  p('photo-3r', 'photo', inch(3.5), inch(5), 'in'),
  p('photo-4r', 'photo', inch(4), inch(6), 'in'),
  p('photo-5r', 'photo', inch(5), inch(7), 'in'),
  p('photo-6r', 'photo', inch(6), inch(8), 'in'),
  p('photo-8r', 'photo', inch(8), inch(10), 'in'),
  p('photo-10r', 'photo', inch(10), inch(12), 'in'),
  p('photo-12r', 'photo', inch(12), inch(15), 'in'),
  p('photo-square', 'photo', 200, 200, 'cm'),

  // Office / home printer paper.
  p('paper-a6', 'paper', 105, 148, 'mm'),
  p('paper-a5', 'paper', 148, 210, 'mm'),
  p('paper-b5', 'paper', 182, 257, 'mm'),
  p('paper-a4', 'paper', 210, 297, 'mm'),
  p('paper-letter', 'paper', inch(8.5), inch(11), 'in'),
  p('paper-legal', 'paper', inch(8.5), inch(14), 'in'),
  p('paper-a3', 'paper', 297, 420, 'mm'),
  p('paper-tabloid', 'paper', inch(11), inch(17), 'in'),
  p('paper-a2', 'paper', 420, 594, 'mm'),
  p('paper-a1', 'paper', 594, 841, 'mm'),

  // Posters & frames.
  p('poster-11x14', 'poster', inch(11), inch(14), 'in', false),
  p('poster-30x40', 'poster', 300, 400, 'cm', false),
  p('poster-40x50', 'poster', 400, 500, 'cm', false),
  p('poster-18x24', 'poster', inch(18), inch(24), 'in', false),
  p('poster-50x70', 'poster', 500, 700, 'cm', false),
  p('poster-60x90', 'poster', 600, 900, 'cm', false),
  p('poster-24x36', 'poster', inch(24), inch(36), 'in', false),

  // ID photos, cards, postcards.
  p('id-cn-1inch', 'id', 25, 35, 'mm'),
  p('id-cn-2inch', 'id', 35, 49, 'mm'),
  p('id-passport', 'id', 35, 45, 'mm'),
  p('id-jp-resume', 'id', 30, 40, 'mm'),
  p('id-us-passport', 'id', inch(2), inch(2), 'in'),
  p('card-cn', 'id', 54, 90, 'mm'),
  p('card-jp', 'id', 55, 91, 'mm'),
  p('card-us', 'id', inch(2), inch(3.5), 'in'),
  p('postcard', 'id', 100, 148, 'mm'),
];

export const CATEGORIES: Category[] = ['photo', 'paper', 'poster', 'id', 'custom'];
export const DEFAULT_SIZE_ID = 'photo-4r';

export const toUnit = (mm: number, unit: Unit | 'mm') =>
  unit === 'in' ? mm / MM_PER_INCH : unit === 'cm' ? mm / 10 : mm;
export const fromUnit = (v: number, unit: Unit | 'mm') =>
  unit === 'in' ? v * MM_PER_INCH : unit === 'cm' ? v * 10 : v;

// ---------- PPI math ----------

export type FitMode = 'fill' | 'fit';
export type Status = 'pass' | 'warn' | 'fail';

export interface Evaluation {
  /** Paper dimensions actually used (possibly rotated to match the image), mm. */
  paperW: number;
  paperH: number;
  rotated: boolean;
  ppi: number;
  /** Fraction of the image cropped away (fill) or of the paper left blank (fit). */
  waste: number;
  /** Printed image size, mm. */
  printW: number;
  printH: number;
  status: Status;
  target: number;
  /** Pixels required at target ppi for this paper. */
  needW: number;
  needH: number;
}

/** Below this fraction of the target the print is considered clearly insufficient. */
export const WARN_RATIO = 0.8;

export function statusFor(ppi: number, target: number): Status {
  if (ppi >= target - 0.5) return 'pass';
  if (ppi >= target * WARN_RATIO) return 'warn';
  return 'fail';
}

export function evaluate(
  imgW: number,
  imgH: number,
  size: Pick<PrintSize, 'w' | 'h'>,
  mode: FitMode,
  autoRotate: boolean,
  target: number,
): Evaluation {
  let pw = size.w;
  let ph = size.h;
  let rotated = false;
  const imgLandscape = imgW > imgH;
  const paperLandscape = pw > ph;
  if (autoRotate && imgW !== imgH && pw !== ph && imgLandscape !== paperLandscape) {
    [pw, ph] = [ph, pw];
    rotated = true;
  }
  const rx = imgW / toUnit(pw, 'in');
  const ry = imgH / toUnit(ph, 'in');
  // Fill: image covers the paper (edges cropped) → limited by the lower density.
  // Fit: whole image fits inside the paper (blank borders) → limited by the higher density.
  const ppi = mode === 'fill' ? Math.min(rx, ry) : Math.max(rx, ry);
  const printW = (imgW / ppi) * MM_PER_INCH;
  const printH = (imgH / ppi) * MM_PER_INCH;
  const waste =
    mode === 'fill' ? 1 - (pw * ph) / (printW * printH) : 1 - (printW * printH) / (pw * ph);
  return {
    paperW: pw,
    paperH: ph,
    rotated,
    ppi,
    waste: Math.max(0, waste),
    printW,
    printH,
    status: statusFor(ppi, target),
    target,
    needW: Math.ceil(toUnit(pw, 'in') * target),
    needH: Math.ceil(toUnit(ph, 'in') * target),
  };
}

/**
 * Suggested ppi based on typical viewing distance (≈1.5× the diagonal, at least 30 cm)
 * and ~1 arc-minute visual acuity with some headroom. Clamped to 100–300.
 */
export function recommendedPpi(size: Pick<PrintSize, 'w' | 'h'>): number {
  const diagIn = toUnit(Math.hypot(size.w, size.h), 'in');
  const distIn = Math.max(12, diagIn * 1.5);
  const ppi = (3438 / distIn) * 1.5;
  return Math.round(Math.min(300, Math.max(100, ppi)) / 10) * 10;
}

/** Reduce w:h to a familiar ratio label (3:2, 4:3, 16:9 …) when close enough. */
export function aspectLabel(w: number, h: number): string {
  const r = Math.max(w, h) / Math.min(w, h);
  const known: [number, number][] = [
    [1, 1], [5, 4], [4, 3], [7, 5], [3, 2], [16, 10], [5, 3], [16, 9], [2, 1], [21, 9], [3, 1],
  ];
  for (const [a, b] of known) {
    if (Math.abs(r - a / b) / (a / b) < 0.012) return w >= h ? `${a}:${b}` : `${b}:${a}`;
  }
  return w >= h ? `${r.toFixed(2)}:1` : `1:${r.toFixed(2)}`;
}
