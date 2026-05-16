# `src/mobile-renderer/` — Mobile App Entry Point

This folder is the entry point for the Android version of Central Command. It serves the same role that `src/renderer/` plays for the desktop app — it bootstraps the React application — but with mobile-specific setup.

## Files

| File | What it does |
|---|---|
| `main.tsx` | Mobile entry point — installs the mobile bridge, then renders the React app |
| `index.html` | HTML shell for the mobile build |
| `env.d.ts` | TypeScript declaration for Vite's `import.meta.env` in the mobile context |

## How this differs from `src/renderer/`

The desktop renderer's `src/renderer/src/main.tsx` can immediately render React because `window.cc` is already set up by the preload script before any JavaScript runs.

The mobile entry point must first call `installMobileBridge()` (from `src/mobile-bridge/`) to set up `window.cc`, because there is no preload script — Capacitor's WebView doesn't have that concept.

```ts
// src/mobile-renderer/main.tsx (simplified)
import { installMobileBridge } from '../mobile-bridge';

installMobileBridge().then(() => {
  // Now window.cc is ready — render the React app
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
});
```

## The `__MOBILE__` build flag

The mobile build is compiled with a Vite define plugin that sets `__MOBILE__ = true`. Components and hooks throughout the app check this flag:

```ts
declare const __MOBILE__: boolean | undefined;
const IS_MOBILE = typeof __MOBILE__ !== 'undefined' && __MOBILE__;
```

When `IS_MOBILE` is true:
- `App.tsx` renders `<MobileNav>` instead of `<Sidebar>`
- `Dashboard.tsx` renders `<MobileLayout>` (vertical stack) instead of the drag grid
- The widget registry skips widgets with `platforms: ['desktop']`

## Build configuration

The mobile build is driven by `vite.mobile.config.ts` at the project root (separate from `electron.vite.config.ts`). It uses:
- `src/mobile-renderer/index.html` as the entry point
- `tsconfig.mobile.json` for TypeScript settings
- The `__MOBILE__: true` define
- Output to `dist/mobile/` (which Capacitor then copies into the Android project)

To build and run on an Android device:
```bash
npm run mobile:sync   # build + sync to the Android project
npm run mobile:run    # deploy to a connected device
```
