# Python prototype

Reference implementation of the scanner, written on 29 September 2026 with OpenCV during the tuning work. The app does not use it: it serves to compare and port the algorithm (see `wiki/development/algorithm.md`).

The script expects, next to it: `src/<nom>.jpg` (photos already rotated upright), `quads.txt` (Vision corners), `overrides.json` (corners corrected by hand) and `pages.json` (per-page settings). The files of the real batch are in `fixtures-private/prototype/`, outside the repository. These inputs and the script outputs (`out/`, `check/`) are private: `.gitignore` excludes them, along with `.venv/`.

    uv venv .venv && uv pip install --python .venv/bin/python opencv-python-headless numpy
    .venv/bin/python scan.py
