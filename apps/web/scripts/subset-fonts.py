"""Cuts the two site fonts down to the characters of `latin` in src/styles/fonts.ts, into src/fonts/.

Needs fonttools and brotli: python3 -m pip install fonttools brotli
"""

import pathlib
import re
import shutil
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parent.parent
unicodes = re.search(r'const latin =\s*"([^"]+)"', (root / "src/styles/fonts.ts").read_text()).group(1).replace(" ", "")
fonts = [
    ("@fontsource/bricolage-grotesque", "bricolage-grotesque-latin-800-normal.woff2", root / "src/fonts/bricolage-grotesque.woff2"),
    ("@fontsource-variable/figtree", "figtree-latin-wght-normal.woff2", root / "src/fonts/figtree.woff2"),
]
for package, source, output in fonts:
    # The OFL travels with the fonts: the source files do not carry it. The site serves its copies from public/licenses.
    shutil.copy(root / "node_modules" / package / "LICENSE", root / "public/licenses" / f"{output.stem}.txt")
    subprocess.run(
        [
            sys.executable, "-m", "fontTools.subset", str(root / "node_modules" / package / "files" / source),
            f"--unicodes={unicodes}", "--flavor=woff2", "--layout-features=kern,liga,calt", "--name-IDs=*",
            f"--output-file={output}",
        ],
        check=True,
    )
