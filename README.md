# Gloss

A small **Hub** page for **G2** glasses: you type or dictate a phrase, it turns into a **stack of PNG slides** (see **`src/signDimensions.json`**, currently **288×144** to use the SDK image cap) plus a status line, shipped through the official SDK. On-glasses controls live in a **narrow vertical list on the left** (swipe to move selection, tap to act) so the **sign image** uses the wide area beside it. **Phrases** swaps the list to **topic categories** (A–Z), then **words inside each topic** (A–Z), matching the hub **Insert** chips in **`src/phraseSnippets.ts`** (100+ snippets). **Double-tap** the list or ring/temple steps back (words → categories → main nav); there are no separate “Back” / “Up” rows so simulator **Up** is not confused with navigation. A **compact** status strip sits under the slide when a real deck is shown. Each **Send** replaces the deck on glasses and returns the bar to **nav**.

This is a **hub integration**, not a replacement for a skilled interpreter. It does glossary words and fingerspelling-style slides; it will not win a prize for ASL grammar. It *will* put green-ish pixels where the hardware expects them.

---

## Requirements

- **Node.js 18+**
- The Even host app loading this page, **or** a normal browser with **`?pc=1`** if you just want the UI and preview (no bridge, no guilt).

---

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints. For keyboard cred: **Ctrl+Enter** sends from the textarea.

### Hub tooling

- **`npm run dev`** — local Vite server (default `http://localhost:5173`).
- **`npm run sim`** — after `npm run dev`, runs **`evenhub-simulator`** against the dev URL (see **`package.json`**). Use this for a quick **hub-store-style smoke** of layout + bridge without real glasses.
- **`npm run hub:qr`** — prints a QR for sideloading the same URL via the Even hub CLI. Replace `localhost` with your machine’s LAN IP or hostname when loading on a **real device** on the network; `localhost` on the phone refers to the phone, not your PC.
- **`app.json`** — Hub manifest at the repo root (`package_id`, edition, entrypoint, SDK floor, optional **`description`** for the store listing, ≤2000 characters). Keep `version` in sync with `package.json` when you release. The same text lives in **`store-description.txt`** for easy copy-edit.
- **`npm run pack:hub`** — runs a production build, then **`evenhub pack app.json dist -o gloss.ehpk`**. The **`gloss.ehpk`** file appears at the repo root (gitignored). In the **Hub** developer flow, create or import a project from that package to install on glasses for device testing.

**Production**

```bash
npm run build
```

Deploy **`dist/`** to whatever URL your Even hub configuration uses.

### Release hygiene

- **`package.json`** and **`app.json`** versions should match (currently **1.0.0**). Hub **`evenhub pack`** requires **`app.json`** `version` in **`x.y.z`** form (no prerelease suffix). `app.json` uses `package_id` **`com.dxiv.gloss`**.
- **`npm run test`** — Vitest unit tests under `src/**/*.test.ts`. **`npm run build`** runs tests, then Typecheck + Vite.
- **CI** — `.github/workflows/ci.yml` runs `npm ci` and `npm run build` on push/PR to `main` or `master`.
- **Fonts** — JetBrains Mono is loaded from Google Fonts in `index.html` (network + third party). Self-host for stricter offline policies.
- **Speech** — the Speak button uses the Web Speech API; recognition may be handled by the browser/OS (sometimes cloud). See the in-app status line when listening.

---

## How it works (short version)

1. Phrases are tokenised and matched against **`const WORDS`** in **`src/signSlides.ts`**.
2. By default the UI has **word signs when available** (same as “compact glossary”): one slide per known phrase when **`public/signs/words/`** has art — better for real chats than spelling every letter.
3. Turn that off to **spell glossary words letter-by-letter** (practice / slow decoding), using **`public/signs/alphabet/`** and **`public/signs/numbers/`**.
4. Unknown words are spelled out (A–Z / 0–9). Each slide gets a **small status bar** (LETTER / NUMBER / WORD, plus spell progress when you are inside a word) and the final bitmap is **flattened to G2 green** (R/B zero, G = luminance) in the browser so previews match glasses.
5. **Preview timing** is a bit faster when the deck is only letters and digits (fingerspelling), slower when it mixes **word** slides.
6. With **Animate** enabled, after **Send** the glasses **auto-advance** through the same deck as the preview, using shared timing in **`src/slideDeckTiming.ts`**. **Replay** on glasses also turns on looping autoplay for the current deck (for use without the phone). **Prev** / **Next** (or hub **Alt+←/→**) pause auto-advance until the next **Send** or **Replay**. **Clear** wipes the glasses to the empty placeholder.
7. The glasses **list is a vertical native widget** in a **left sidebar** (~100px wide): each label is a **row**; **swipe** moves selection, **tap** activates. **`glossBridge`** passes **`itemWidth: 0`** so firmware auto-sizes rows (per G2 list docs — avoids selection issues). **`glassesPanelLayout`** in **`src/signConstants.ts`** defines list geometry.
8. **Exit** opens the **system exit prompt**. **Double-tap** the list: from **Phrases**, first double-tap returns to **main nav + idle**; from a slide deck on nav, first double-tap clears to **idle**; **double-tap again** on that idle home screen calls `shutDownPageContainer(1)` for the system exit confirmation ([page lifecycle](https://hub.evenrealities.com/docs/guides/page-lifecycle#methods)).
9. After **Send**, **Alt+←** / **Alt+→** (when focus is not in a text field) steps slides in the **preview** the same way as glasses **Prev** / **Next**—handy on desktop hub where there is no ring.

### Openly licensed sources for sharper art (you swap files, then rebuild)

These are **not** bundled automatically; verify each file’s license on Commons before shipping.

- **[Category:ASL letters](https://commons.wikimedia.org/wiki/Category:ASL_letters)** — many **per-letter SVGs** (often public domain). You can rasterise them with your own script into `public/signs/alphabet/` (match **`src/signDimensions.json`** and run through **`scripts/sign-green.mjs`** logic or reuse `build-sign-assets` patterns).
- **[Asl alphabet gallaudet ann.svg](https://commons.wikimedia.org/wiki/File:Asl_alphabet_gallaudet_ann.svg)** — **CC0** full chart (sometimes cleaner than the classic Gallaudet file); save as **`scripts/tmp-alphabet.svg`** and run **`npm run build:signs`**.
- **[Asl alphabet gallaudet.svg](https://commons.wikimedia.org/wiki/File:Asl_alphabet_gallaudet.svg)** — the chart this repo’s crop script targets (CC0).
- **ASL alphabet datasets** (ML photos, variable quality): [Kaggle ASL alphabet (CC0)](https://www.kaggle.com/datasets/debashishsau/aslamerican-sign-language-aplhabet-dataset), [Roboflow ASL letters](https://public.roboflow.com/object-detection/american-sign-language-letters) (public domain). Useful if you train a custom exporter—not drop-in art for every word in ASL.

**ASL “real word” illustrations** (not fingerspelling) are rarely CC0 as a complete set. Sites like Lifeprint and Signing Savvy are usually **not** redistributable inside an app; prefer **your own** PNGs under `public/signs/words/` at the same size as **`signDimensions.json`**, or commission / license art.

---

## Regenerating sign images

Download the Gallaudet alphabet SVG (see **`public/signs/ATTRIBUTIONS.md`**, CC0), save as **`scripts/tmp-alphabet.svg`** (gitignored), then:

```bash
npm run build:signs      # alphabet + numbers PNGs from chart
npm run build:words      # word strips from glyphs (see `const WORDS` in `src/signSlides.ts`)
# or
npm run build:signs:all
```

**Glossary** — edit **`const WORDS`** in **`src/signSlides.ts`**, then run **`npm run build:words`** again.

---

## Project map

| Path | Role |
| --- | --- |
| `src/main.ts` | Bridge wait, boot |
| `src/glossPage.ts` | Input, speech, preview, toggles |
| `src/glossBridge.ts` | SDK layout, list events, image queue, optional glasses autoplay |
| `src/slideDeckTiming.ts` | Shared dwell timing for preview animation + glasses auto-advance |
| `src/signSlides.ts` | Phrase → slide list; **`const WORDS`** glossary |
| `src/signRender.ts` | PNG bytes per slide |
| `src/signConstants.ts` | Slide + glasses layout constants; **`assertGlassesLayout()`** |
| `src/signDimensions.json` | Authoritative **SIGN_IMAGE_WIDTH** / **HEIGHT** for app + `npm run build:signs` |
| `scripts/build-sign-assets.mjs` | Gallaudet SVG → `alphabet/` + `numbers/` PNGs |
| `scripts/build-word-signs.mjs` | Glossary composites (multi-row + min glyph height for G2 readability) |
| `scripts/sign-green.mjs` | R/B → 0, G ← luminance for G2 |
| `vitest.config.ts` | Unit test runner config |
| `.github/workflows/ci.yml` | CI build |

---

## License

**MIT** — see `LICENSE`.

Sign artwork is derived from material credited in **`public/signs/ATTRIBUTIONS.md`** (CC0).
