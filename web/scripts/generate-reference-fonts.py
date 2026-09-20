"""Build small PDF fonts with FontTools; preserve full fonts for arbitrary scenario names.
Run from the repository root using a Python environment with fonttools installed.
"""
from pathlib import Path
import json
from fontTools import subset
from fontTools.ttLib import TTFont

web = Path(__file__).resolve().parents[1]
root = web / 'src/custom/reference'
sources = [web / 'src/custom/authoring/characterPresentation.json', web.parent / 'crates/custom-domain/resources/jinxes.ko.json', root / 'scenarioPdf.ts']
characters = set(''.join(path.read_text() for path in sources))
characters.update(chr(code) for code in range(32, 127))
characters.update('×·')
coverage = None
for weight in ['Regular', 'Bold']:
    font = TTFont(root / f'fonts/NanumGothic-{weight}.ttf')
    options = subset.Options()
    options.name_IDs = ['*']
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes={ord(char) for char in characters})
    subsetter.subset(font)
    # OFL reserves the upstream family name; the derived subset has its own name.
    for record in list(font['name'].names):
        replacement = {1: 'Clocktower Reference Sans', 3: f'ClocktowerReferenceSans-{weight}',
                       4: f'Clocktower Reference Sans {weight}', 6: f'ClocktowerReferenceSans-{weight}',
                       16: 'Clocktower Reference Sans', 18: f'Clocktower Reference Sans {weight}'}.get(record.nameID)
        if replacement:
            font['name'].setName(replacement, record.nameID, record.platformID, record.platEncID, record.langID)
    present = set(font.getBestCmap())
    coverage = present if coverage is None else coverage & present
    output = root / f'fonts/ClocktowerReferenceSans-{weight}.ttf'
    font.save(output)
    print(output.name, output.stat().st_size, 'bytes')
(root / 'fonts/coverage.json').write_text(json.dumps(''.join(chr(code) for code in sorted(coverage)), ensure_ascii=False) + '\n')
