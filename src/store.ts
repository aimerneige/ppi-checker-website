import type { LoadedImage } from './image';
import { CATEGORIES, DEFAULT_SIZE_ID, PRESETS, type Category, type FitMode, type PrintSize, type Unit } from './sizes';

export const TARGET_PRESETS = [350, 300, 240, 200, 150, 100] as const;

export interface Settings {
  sizeId: string;
  category: Category;
  /** A ppi number, or 'auto' to use the viewing-distance recommendation. */
  target: number | 'auto';
  /** PPI used by the "largest print size" calculator. */
  maxPpi: number;
  mode: FitMode;
  unit: Unit;
  autoRotate: boolean;
  customSizes: PrintSize[];
}

export interface State extends Settings {
  image: LoadedImage | null;
  loading: boolean;
  dragging: boolean;
}

const KEY = 'ppi.settings';

function loadSettings(defaultUnit: Unit): Settings {
  const defaults: Settings = {
    sizeId: DEFAULT_SIZE_ID,
    category: 'photo',
    target: 300,
    maxPpi: 300,
    mode: 'fill',
    unit: defaultUnit,
    autoRotate: true,
    customSizes: [],
  };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Settings> | null;
    if (!raw) return defaults;
    const s: Settings = { ...defaults, ...raw };
    // Sanitise anything that might be stale or hand-edited.
    s.customSizes = Array.isArray(s.customSizes)
      ? s.customSizes.filter((c) => c && c.w > 0 && c.h > 0 && typeof c.id === 'string')
      : [];
    if (!CATEGORIES.includes(s.category)) s.category = 'photo';
    if (s.unit !== 'cm' && s.unit !== 'in') s.unit = defaultUnit;
    if (s.mode !== 'fill' && s.mode !== 'fit') s.mode = 'fill';
    if (s.target !== 'auto' && !(typeof s.target === 'number' && s.target >= 50 && s.target <= 1200)) s.target = 300;
    if (!(typeof s.maxPpi === 'number' && s.maxPpi >= 50 && s.maxPpi <= 1200)) s.maxPpi = 300;
    if (![...PRESETS, ...s.customSizes].some((p) => p.id === s.sizeId)) s.sizeId = DEFAULT_SIZE_ID;
    return s;
  } catch {
    return defaults;
  }
}

type Listener = (s: State) => void;

export function createStore(defaultUnit: Unit) {
  let state: State = { ...loadSettings(defaultUnit), image: null, loading: false, dragging: false };
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set(patch: Partial<State>) {
      state = { ...state, ...patch };
      const { image: _i, loading: _l, dragging: _d, ...settings } = state;
      localStorage.setItem(KEY, JSON.stringify(settings));
      listeners.forEach((l) => l(state));
    },
    subscribe: (l: Listener) => listeners.add(l),
  };
}

export type Store = ReturnType<typeof createStore>;

export const allSizes = (s: Settings) => [...PRESETS, ...s.customSizes];
export const findSize = (s: Settings) => allSizes(s).find((p) => p.id === s.sizeId) ?? PRESETS[1];
