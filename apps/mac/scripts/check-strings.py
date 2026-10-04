#!/usr/bin/env python3
"""Lists the interface strings that have no French translation, the French texts with a plain space where French
typography wants a no-break one (U+00A0): before : ; ? ! and », or after «, and the French texts that say « tu » instead
of « vous ». Exit status 1 if there is one."""
import pathlib
import re
import subprocess
import sys
import tempfile

project = pathlib.Path(__file__).resolve().parent.parent / "PDFToolbox.xcodeproj"
with tempfile.TemporaryDirectory() as folder:
    subprocess.run(["xcodebuild", "-exportLocalizations", "-project", str(project), "-localizationPath", folder,
                    "-exportLanguage", "fr"], check=True, capture_output=True)
    xliff = next(pathlib.Path(folder).rglob("fr.xliff")).read_text(encoding="utf-8")

# The bundle name comes from Info.plist, not from the catalog.
units = re.findall(r'<trans-unit id="(.*?)".*?</trans-unit>', xliff, re.S)
blocks = re.findall(r'<trans-unit id=".*?".*?</trans-unit>', xliff, re.S)
missing = [unit for unit, block in zip(units, blocks)
           if "<target" not in block and unit not in ("CFBundleDisplayName", "CFBundleName")]
targets = [re.search(r"<target[^>]*>(.*?)</target>", block, re.S) for block in blocks]
spacing = [unit for unit, target in zip(units, targets) if target and re.search(r" [:;?!»]|« ", target.group(1))]
# Holy PDF says « vous ». A verb in the « tu » form (« Glisse ») has no telltale word: review catches those.
informal = [unit for unit, target in zip(units, targets) if target and re.search(r"(?i)\b(?:tu|te|toi|ton|ta|tes)\b", target.group(1))]
for unit in missing:
    print(f"no French text: {unit}")
for unit in spacing:
    print(f"plain space in French punctuation: {unit}")
for unit in informal:
    print(f"informal French: {unit}")
print(f"{len(units)} strings, {len(missing)} without French, {len(spacing)} spacing errors, {len(informal)} informal")
sys.exit(1 if missing or spacing or informal else 0)
