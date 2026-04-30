# G2 Gloss lens — hardware QA checklist

Smoke the lens in software: run `npm run dev`, then `npm run sim` (Hub simulator; default URL is `http://localhost:5173` — pass your Vite URL if another process already uses that port).

On **real G2**, verify after a hub change that touches the glasses UI:

1. **Nav list (Prev Next Replay Clear Phrases Exit)**  
   Swipe highlights each row; tap runs the expected action (prev/next slide, replay from start + autoplay when applicable, clear to idle, phrases list, exit).

2. **List readability & scroll**  
   Labels are short English on a narrow column. **Swipe** through every row (nav + a long Phrases screen); selection must move past the first item (`itemWidth: 0` auto-fill). Confirm labels do not truncate oddly on your firmware build.

3. **Phrases (two steps)**  
   **Phrases** opens **category titles** (A–Z); pick one → **words** in that topic (A–Z). **Up** returns to categories; **Back** (on the category screen) returns to main nav. A word row sends that snippet to the slide deck.

4. **Captions on** (hub / default: captions on slide)  
   Status strip shows compact tokens (`n/total · W` / `· L` / `· #` / spell progress) without repeating long English from the learning bar.

5. **Captions off**  
   Status strip carries more English (word title, spell string) since the PNG has no caption bar.

6. **Compact glossary** (if exposed on hub)  
   Tokenization still matches slides; glasses status stays readable.

7. **Animate + phrase from glasses**
   Choose a multi-slide phrase from a category row; deck auto-advances like replay path; **Prev**/**Next** pause until next Send/Replay as before.

8. **Optional `lensInsetFrame`**  
   If enabled via `SlideToPngOptions`, check for banding or noise on the physical panel (default remains off).
