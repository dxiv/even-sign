# Sign assets

PNG crops: **280×120**, transparent outside the hand, green frame. **R/B zero**, **G** = luminance (Even G2).

Source: [Asl alphabet gallaudet.svg](https://commons.wikimedia.org/wiki/File:Asl_alphabet_gallaudet.svg) (CC0).

Save the file as `scripts/tmp-alphabet.svg`, then:

```bash
npm run build:signs
```

Direct link: https://upload.wikimedia.org/wikipedia/commons/c/c8/Asl_alphabet_gallaudet.svg

`words/*.png` strips are built from those glyphs (`npm run build:words`), not separate Commons illustrations. Swap in your own 280×120 PNGs if you want.
