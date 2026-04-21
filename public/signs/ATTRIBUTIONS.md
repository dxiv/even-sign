# Sign assets

PNG crops: size comes from **`src/signDimensions.json`** (same as G2 slide PNGs), transparent outside the hand, green frame. **R/B zero**, **G** = luminance (Even G2). The **hub page** recomposites each slide with a **learning bar** and applies the same green flattening as **`scripts/sign-green.mjs`** so previews match glasses.

## Default letters + numbers (chart crop)

- **[Asl alphabet gallaudet.svg](https://commons.wikimedia.org/wiki/File:Asl_alphabet_gallaudet.svg)** (CC0). Save as **`scripts/tmp-alphabet.svg`**, then **`npm run build:signs`**.
- Direct: https://upload.wikimedia.org/wikipedia/commons/c/c8/Asl_alphabet_gallaudet.svg
- The number row is denser than letters: **`build-sign-assets.mjs`** uses **`CROP_NUMBER_UW`** / **`CROP_NUMBER_UH`** (narrower than letter crops). If a digit looks clipped or still shows neighbours, nudge those constants for your SVG revision.

## Sharper open alternatives (manual swap)

- **[Asl alphabet gallaudet ann.svg](https://commons.wikimedia.org/wiki/File:Asl_alphabet_gallaudet_ann.svg)** (CC0) — full chart variant; same pipeline, replace `tmp-alphabet.svg`.
- **[Category:ASL letters](https://commons.wikimedia.org/wiki/Category:ASL_letters)** — individual letter SVGs (often PD); good if you build a **per-letter** raster step into `alphabet/*.png`.
- **Datasets** (classification photos, not curated signs for every English word): [Kaggle ASL alphabet CC0](https://www.kaggle.com/datasets/debashishsau/aslamerican-sign-language-aplhabet-dataset), [Roboflow ASL letters](https://public.roboflow.com/object-detection/american-sign-language-letters).

## Word strips (`words/*.png`)

Built from glyph PNGs: **`npm run build:words`**. Slugs come from **`const WORDS`** in **`src/signSlides.ts`**.

Full **ASL lexicon** imagery is usually **not** freely redistributable; for production word art, plan on **licensed** or **original** 280×120 assets.
