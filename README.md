# EvenSign

A small **Even Hub** page for **Even G2** glasses: you type or dictate a phrase, it turns into a **stack of PNG slides** (280×120) plus a status line, shipped through the official SDK. Navigation is charmingly retro—**Prev**, **Next**, **Close**—because your nose is not a trackpad.

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

**Production**

```bash
npm run build
```

Deploy **`dist/`** to whatever URL your Even hub configuration uses.

---

## How it works (short version)

1. Phrases are tokenised and matched against a glossary in **`src/signSlides.ts`**.
2. By default, each glossary hit becomes **one slide per letter**, using art under **`public/signs/alphabet/`** and **`public/signs/numbers/`**.
3. Enable **Compact glossary** in the UI for **one slide per word**, using strips in **`public/signs/words/`** when present.
4. Unknown words are spelled out (A–Z / 0–9). Missing images fall back to a canvas slide—ugly but honest.
5. Raster art is **green-channel–biased** for the display pipeline; regenerate with the scripts below if you swap the source SVG.

---

## Regenerating sign images

Download the Gallaudet alphabet SVG (see **`public/signs/ATTRIBUTIONS.md`**, CC0), save as **`scripts/tmp-alphabet.svg`** (gitignored), then:

```bash
npm run build:signs      # alphabet + numbers PNGs
npm run build:words      # word strips from those PNGs
# or
npm run build:signs:all
```

---

## Project map

| Path | Role |
| --- | --- |
| `src/main.ts` | Bridge wait, boot |
| `src/evenSignPage.ts` | Input, speech, preview, toggles |
| `src/evenSignBridge.ts` | SDK layout, list events, image queue |
| `src/signSlides.ts` | Phrase → slide list |
| `src/signRender.ts` | PNG bytes per slide |
| `scripts/build-sign-assets.mjs` | SVG → glyphs |
| `scripts/build-word-signs.mjs` | Glossary composites |
| `scripts/sign-green.mjs` | Green pass for device constraints |

---

## License

**MIT** — see `LICENSE`.

Sign artwork is derived from material credited in **`public/signs/ATTRIBUTIONS.md`** (CC0).
