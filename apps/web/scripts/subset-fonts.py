"""Cuts the two site fonts down to the characters of `latin` in src/styles/fonts.ts, into src/fonts/, and the title
font into the Mac app, which loads TTF.

Needs fonttools and brotli: python3 -m pip install fonttools brotli
"""

import pathlib
import re
import shutil
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parent.parent
mac = root.parent / "mac/PDFToolbox/Fonts"
unicodes = re.search(r'const latin =\s*"([^"]+)"', (root / "src/styles/fonts.ts").read_text()).group(1).replace(" ", "")
fonts = [
    ("@fontsource/bricolage-grotesque", "bricolage-grotesque-latin-800-normal.woff2", root / "src/fonts/bricolage-grotesque.woff2"),
    ("@fontsource-variable/figtree", "figtree-latin-wght-normal.woff2", root / "src/fonts/figtree.woff2"),
    ("@fontsource/bricolage-grotesque", "bricolage-grotesque-latin-800-normal.woff2", mac / "BricolageGrotesque-ExtraBold.ttf"),
]
mac.mkdir(parents=True, exist_ok=True)
for package, source, output in fonts:
    # The OFL travels with the fonts: the source files do not carry it. The site serves its copies from public/licenses.
    licence = root / "public/licenses" / f"{output.stem}.txt" if output.suffix == ".woff2" else output.parent / f"LICENSE-{package.split('/')[-1]}.txt"
    shutil.copy(root / "node_modules" / package / "LICENSE", licence)
    # Without --flavor, fontTools keeps the source's WOFF2 compression, whatever the output's extension.
    flavor = "woff2" if output.suffix == ".woff2" else "none"
    subprocess.run(
        [
            sys.executable, "-m", "fontTools.subset", str(root / "node_modules" / package / "files" / source),
            f"--unicodes={unicodes}", f"--flavor={flavor}", "--layout-features=kern,liga,calt", "--name-IDs=*",
            f"--output-file={output}",
        ],
        check=True,
    )
