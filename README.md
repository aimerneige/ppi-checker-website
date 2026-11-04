# PPI Checker

A static web page that checks whether an image has enough resolution (PPI) for common print sizes.
Images are read locally in the browser and never uploaded.

- Upload by click, drag & drop, or paste (Ctrl/⌘+V); there is also a built-in sample image
- 34 preset sizes (photo 3R–12R, A/B/US paper, posters, ID photos, business cards) plus custom sizes
- Fill (crop) and fit (border) modes, auto orientation, cm/in, a target PPI selector (with an "auto" option based on viewing distance)
- Material Design 3: light/dark themes, ripple and spring press animations, custom menus, dialogs and snackbars (no native UI)
- i18n: 简体中文 / 日本語 / English

## Develop

```sh
npm install
npm run dev      # dev server
npm run build    # static output in dist/
```

`dist/` uses relative paths, so it can be hosted anywhere (GitHub Pages, any static host, or a sub-folder).

## Adding a language

Create `src/i18n/locales/<code>.ts`:

```ts
import type { LocaleDef } from '../index';
export default { code: 'ko', name: '한국어', defaultUnit: 'cm', messages: { /* same keys as en.ts */ } } satisfies LocaleDef;
```

The file is picked up automatically, and TypeScript makes sure no key is missing. `en.ts` is the source of truth.
