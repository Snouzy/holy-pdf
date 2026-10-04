# Prototype Python

Implémentation de référence du scanner, écrite le 29/09/2026 avec OpenCV pendant la mise au point. Elle n'est pas utilisée par l'appli : elle sert à comparer et à porter l'algorithme (voir `wiki/development/algorithm.md`).

Le script attend, à côté de lui : `src/<nom>.jpg` (photos déjà tournées à l'endroit), `quads.txt` (coins Vision), `overrides.json` (coins corrigés à la main) et `pages.json` (réglages par page). Les fichiers du lot réel sont dans `fixtures-private/prototype/`, hors du dépôt. Ces entrées et les sorties du script (`out/`, `check/`) sont privées : `.gitignore` les exclut, avec `.venv/`.

    uv venv .venv && uv pip install --python .venv/bin/python opencv-python-headless numpy
    .venv/bin/python scan.py
