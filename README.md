# AudioCutter | Zero-Server Minimalist Audio Trimmer

**Live Target:** [https://audio-cutter.github.io](https://audio-cutter.github.io)

An ultra-minimal, 100% client-side web application built with **Astro** and **React**. Allows users to load an audio file, visually trim it using an interactive waveform, apply smooth fade-in/fade-out transitions, and export the clipped file directly in the browser. Powered by **Wavesurfer.js** for interactive visualization and **FFmpeg.wasm** for local processing—ensuring zero server uploads and total user privacy.

---

## Architectural Pattern

- **Framework:** Astro (Static Site Generation for instant load times, subpath i18n routing, and peak technical SEO).
- **UI Components:** React Islands (`src/components/AudioEditor.tsx`) for managing waveform state, region selection, and FFmpeg execution.
- **Audio Engine:** Wavesurfer.js (with Regions plugin) for interactive visualization + FFmpeg.wasm (`src/utils/AudioProcessor.ts`) for client-side trimming, fading, and encoding (with an automatic Web Audio API PCM fallback).
- **Styling:** Tailwind CSS configured with the minimalist Light/Dark color palette:
  - Deep Burgundy: `#790D16`
  - Tan Beige: `#E5D3AF`
  - Cream White: `#F5EFE1`
  - Slate Blue: `#AEC4D4`

## Internationalization (i18n)

Localized JSON translation dictionaries (`src/i18n/locales/*.json`) with Astro static subpath routing:
- `/` — English (`US`)
- `/es/` — Español (`ES`)
- `/pt/` — Português (`BR`)
- `/de/` — Deutsch (`DE`)
- `/fr/` — Français (`FR`)
- `/ja/` — 日本語 (`JP`)
- `/zh/` — 简体中文 (`CN`)

## Development & Build

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build static production bundle into dist/
npm run build
```

## Support the Developer

☕ [Buy Me a Coffee — kisharadilz](https://buymeacoffee.com/kisharadilz)
