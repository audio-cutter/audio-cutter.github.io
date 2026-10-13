<div align="center">

# ✂️ AudioCutter

### Zero-Server Minimalist Audio Trimmer & Studio Fade Editor

[![Live Demo](https://img.shields.io/badge/Live_App-audio--cutter.github.io-790D16?style=for-the-badge&logo=github)](https://audio-cutter.github.io/)
[![Astro](https://img.shields.io/badge/Astro_5-FF5D01?style=for-the-badge&logo=astro&logoColor=white)](https://astro.build/)
[![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![FFmpeg.wasm](https://img.shields.io/badge/FFmpeg.wasm-007808?style=for-the-badge&logo=ffmpeg&logoColor=white)](https://ffmpegwasm.netlify.app/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Support Developer](https://img.shields.io/badge/Buy_Me_A_Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/kisharadilz)

**Visually slice, fine-tune, and apply smooth fade transitions to MP3, WAV, FLAC, OGG, and M4A files directly in your browser's memory.**  
*100% Client-Side WebAssembly Processing • Zero Server Uploads • Complete User Privacy*

[**Launch Web App →**](https://audio-cutter.github.io/) · [**Report Bug**](https://github.com/audio-cutter/audio-cutter.github.io/issues) · [**Support the Developer ☕**](https://buymeacoffee.com/kisharadilz)

</div>

---

## ✨ Overview

**AudioCutter** ([`audio-cutter.github.io`](https://audio-cutter.github.io/)) is an ultra-minimal, privacy-first web application engineered with **Astro Islands Architecture** and **React**. Unlike traditional online audio cutters that upload your private voice recordings or music tracks to remote cloud servers, AudioCutter executes all audio decoding, waveform rendering, region slicing, fade ramping, and `.mp3` / `.wav` encoding **100% locally inside your browser sandbox** using **Wavesurfer.js** and **FFmpeg.wasm**.

---

## 🚀 Key Features

- **🔒 100% Client-Side Privacy:** Audio files are ingested via the HTML5 `File` API directly into browser RAM. Nothing ever leaves your device.
- **🌊 Full-Width Interactive Waveform:** Powered by **Wavesurfer.js v7** and the **Regions Plugin**, featuring a high-contrast Warm Amber–Emerald selection zone, dimmed unselected regions, and bold `10px` Deep Burgundy (`#790D16`) drag handles.
- **⏱️ Millisecond Precision Controls:** Drag waveform handles visually, zoom up to `150x`, snap boundaries to the active playhead cursor, or fine-tune **Cut From (Start)** and **To (End)** timestamps with `±0.1s` nudge controls.
- **🎚️ Studio Fade-In & Fade-Out Curves:** Toggle smooth `1.5s` audio fade ramps with real-time playback preview and FFmpeg `afade` filter encoding.
- **⚡ Dual-Engine Export (`FFmpeg.wasm` + Web Audio Fallback):**
  - **Primary Engine:** Single-threaded WebAssembly FFmpeg core (`@ffmpeg/core`) slices and encodes `.mp3` (`libmp3lame`) or `.wav` (`pcm_s16le`) directly in-memory without requiring complex server headers.
  - **Automatic Fallback:** High-precision Web Audio API `AudioContext` PCM slicer and 16-bit WAV encoder guarantees exports succeed even when offline.
- **🎹 Built-in Studio Demo Synthesizer:** One-click in-memory stereo chord & pluck synthesizer (`generateDemoAudioFile`) lets users test waveform trimming and exporting immediately without searching for a local file.
- **🌍 7-Language Subpath i18n:** Static localized builds for English, Spanish, Portuguese, German, French, Japanese, and Simplified Chinese.
- **🌗 Adaptive Minimalist Theme:** Clean Light Theme (`#F5EFE1` / `#E5D3AF`) by default with an instant, zero-FOUC Dark Mode (`#121316` / `#1C1E24`) toggle.

---

## 🏗️ Architectural Pattern

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Static Framework** | **Astro 5 (SSG)** | Zero-JS static shell generation, subpath i18n routing, and 100/100 technical SEO output. |
| **Interactive Island** | **React 19 (`client:load`)** | Manages complex waveform state, bidirectional region synchronization, and Wasm execution in `src/components/AudioEditor.tsx`. |
| **Waveform Engine** | **Wavesurfer.js v7 + Regions** | Hardware-accelerated canvas waveform rendering and touch-friendly region handles. |
| **Media Processing** | **FFmpeg.wasm + Web Audio API** | Client-side audio trimming, `afade` filtering, and MP3/WAV Blob generation in `src/utils/AudioProcessor.ts`. |
| **Styling System** | **Tailwind CSS v3** | Custom minimalist design tokens with class-based Light/Dark mode and icon-only mobile navigation collapse. |

---

## 🎨 Design System & Color Palette

AudioCutter follows a strict, high-contrast minimalist aesthetic designed for effortless visual clarity:

| Token Name | Hex Code | Usage |
| :--- | :--- | :--- |
| **Deep Burgundy** | `#790D16` | Primary CTAs (`Export Audio`, `Preview Selection`), bold region selection handles, active badges. |
| **Tan Beige** | `#E5D3AF` | Subtle surface cards, control dock containers, and border accents in Light Mode. |
| **Cream White** | `#F5EFE1` | Primary application background and waveform canvas surface in Light Mode. |
| **Slate Blue** | `#AEC4D4` | Audio waveform bars and dark-mode secondary accents. |
| **Deep Charcoal** | `#121316` / `#1C1E24` | Inverted dark-mode background and elevated surface cards. |

---

## 🌐 Internationalization (i18n) Routes

All UI copy, instructions, FAQs, and SEO metadata are driven by localized JSON dictionaries in `src/i18n/locales/*.json` and statically generated at build time:

| Locale Code | Badge | Language | Static Route | Production URL |
| :---: | :---: | :--- | :--- | :--- |
| `en` *(Default)* | `US` | English | `/` | `https://audio-cutter.github.io/` |
| `es` | `ES` | Español | `/es/` | `https://audio-cutter.github.io/es/` |
| `pt` | `BR` | Português | `/pt/` | `https://audio-cutter.github.io/pt/` |
| `de` | `DE` | Deutsch | `/de/` | `https://audio-cutter.github.io/de/` |
| `fr` | `FR` | Français | `/fr/` | `https://audio-cutter.github.io/fr/` |
| `ja` | `JP` | 日本語 | `/ja/` | `https://audio-cutter.github.io/ja/` |
| `zh` | `CN` | 简体中文 | `/zh/` | `https://audio-cutter.github.io/zh/` |

---

## 🔍 Technical SEO & Accessibility (100/100 Verified)

- **Unified JSON-LD `@graph` Structured Data:** Every page embeds linked Schema.org entities for `Organization`, `WebSite`, `WebPage`, `BreadcrumbList`, `WebApplication`, `HowTo` (`HowToStep`), and `FAQPage`.
- **Reciprocal `hreflang` Cluster & Canonical URLs:** Self-referencing canonical tags and full bidirectional `hreflang` links (`x-default`, ISO language codes, and regional locale codes) in both `<head>` and `sitemap-0.xml`.
- **Open Graph & Twitter Cards:** High-resolution `1200×630` raster `og-image.png` with explicit `og:image:width`, `og:image:height`, `og:image:alt`, and `og:locale:alternate` tags.
- **WCAG Accessibility & Semantic Landmarks:** Keyboard skip-link (`Skip to main content`), microdata-annotated `<nav aria-label="Breadcrumb">`, explicit `aria-label` and `aria-live` status regions across all controls, and keyboard shortcuts (`Space` to Play/Pause, `Escape` to close menus).

---

## 📂 Project Structure

```text
audio-cutter.github.io/
├── .github/
│   └── workflows/
│       └── deploy.yml            # Automated GitHub Pages CI/CD workflow
├── public/
│   ├── .nojekyll                 # Bypasses Jekyll processing on GitHub Pages
│   ├── apple-touch-icon.png      # 180x180 iOS/macOS Web Clip icon
│   ├── favicon.svg               # Minimalist Burgundy & Cream SVG icon
│   ├── og-image.png              # 1200x630 Open Graph social preview card
│   ├── og-image.svg              # Vector source for social preview card
│   ├── robots.txt                # Crawler directives & Sitemap pointer
│   └── site.webmanifest          # Web App Manifest
├── src/
│   ├── components/
│   │   ├── AudioEditor.tsx       # React Island: Wavesurfer + Regions + Controls
│   │   ├── Footer.astro          # Semantic footer with SEO language links
│   │   ├── MainPageContent.astro # Shared page template (Hero, Workspace, HowTo, FAQ)
│   │   └── Navbar.astro          # Sticky navbar (collapses to pure icons on mobile)
│   ├── i18n/
│   │   ├── locales/              # 7 JSON translation dictionaries (en, es, pt, de, fr, ja, zh)
│   │   └── translations.ts       # Type-safe i18n loader and route helpers
│   ├── layouts/
│   │   └── Layout.astro          # Document shell, gtag.js, OpenGraph, JSON-LD @graph
│   ├── pages/
│   │   ├── [lang]/
│   │   │   └── index.astro       # Localized subpath routes (/es/, /pt/, /de/, /fr/, /ja/, /zh/)
│   │   └── index.astro           # Root default route (/)
│   ├── styles/
│   │   └── global.css            # Tailwind base, theme variables, Shadow DOM ::part rules
│   └── utils/
│       └── AudioProcessor.ts     # FFmpeg.wasm loader, slicer, Web Audio fallback & demo synth
├── astro.config.mjs              # Astro SSG, React, Tailwind, Sitemap & i18n configuration
├── tailwind.config.mjs           # Custom color palette & dark mode configuration
├── tsconfig.json                 # Strict TypeScript configuration
└── package.json                  # Dependencies & build scripts
```

---

## 🛠️ Local Development & Build

### Prerequisites
- **Node.js** `>= 20.x`
- **npm** `>= 10.x`

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Open `http://localhost:4321` in your browser to preview hot-reloading changes.

### 3. Build Production Static Site
```bash
npm run build
```
Generates the optimized static production output in `./dist/` (including all 7 localized HTML routes, bundled assets, `sitemap-index.xml`, and `sitemap-0.xml`).

### 4. Preview Production Build Locally
```bash
npm run preview
```

---

## 🚢 Deployment (GitHub Pages)

This repository includes a pre-configured GitHub Actions workflow ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)):
1. Push your code to the `main` (or `master`) branch on GitHub.
2. In your GitHub repository, navigate to **Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. Every push automatically builds the Astro static bundle and deploys it to `https://audio-cutter.github.io/`.

---

## ☕ Support the Developer

If **AudioCutter** saves you time or helps with your projects, consider supporting ongoing development:

[![Buy Me A Coffee](https://img.shields.io/badge/Support_on-Buy_Me_a_Coffee-790D16?style=for-the-badge&logo=buy-me-a-coffee&logoColor=F5EFE1)](https://buymeacoffee.com/kisharadilz)

- **Support Link:** [https://buymeacoffee.com/kisharadilz](https://buymeacoffee.com/kisharadilz)

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for full details.
