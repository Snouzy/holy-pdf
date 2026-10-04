# Signature handwriting

`caveat-latin-400.woff2` is Caveat Regular, version 2.000, by The Caveat Project Authors.
It is redistributed under SIL OFL 1.1; see `OFL-Caveat.txt`.

Source: Google Fonts' official static font distribution, retrieved 2 October 2026:

- CSS: https://fonts.googleapis.com/css2?family=Caveat:wght@400&display=swap
- Original TTF: https://fonts.gstatic.com/s/caveat/v23/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9SII.ttf
- License: https://github.com/google/fonts/blob/main/ofl/caveat/OFL.txt

The font is a static 400 weight, reduced to Latin-1, French Œ/œ/Ÿ, punctuation and the euro sign.
Kerning and standard ligatures are retained. Contextual alternates are omitted to reduce the file to 24,904 bytes.
SHA-256: `e78187d6e55f08c3c2ad8e2b8599ad35eb897b3a921e2f54e9a522778d8868fa`.
No external font service is contacted at runtime. The Text tab loads this file locally on its first use.

Reproduce with fonttools and brotli installed:

```sh
python -m fontTools.subset Caveat-Regular.ttf \
  --unicodes=U+0020-007E,U+00A0-00FF,U+0152-0153,U+0178,U+2010-205F,U+20AC \
  --flavor=woff2 --layout-features=kern,liga --name-IDs='*' \
  --output-file=caveat-latin-400.woff2
```
