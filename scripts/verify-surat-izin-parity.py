"""Validate synthetic browser QA artifacts; never connects to a database."""
import base64
import json
import logging
import re
import subprocess
import sys
import warnings
import hashlib
from pathlib import Path

from PIL import Image, ImageChops, ImageStat
from pypdf import PdfReader
from fontTools.ttLib import TTFont

folder = Path(sys.argv[1]).resolve()
cases = json.loads((folder / 'qa-bundle.json').read_text(encoding='utf-8'))
font_path = Path(__file__).resolve().parents[1] / 'public/assets/fonts/plus-jakarta-sans/PlusJakartaSans-Variable.ttf'
font = TTFont(font_path)
assert 'Plus Jakarta Sans' in [name.toUnicode() for name in font['name'].names if name.nameID == 1]
glyphs = font.getBestCmap()
missing_glyphs = {ord(char) for case in cases for page in case['pages'] for char in page['text']
                  if not char.isspace() and ord(char) not in glyphs}
assert not missing_glyphs, ('font fallback required', sorted(missing_glyphs))
labels = {'unit': 'UNIT', 'kelas': 'KELAS', 'walikelas': 'WALI KELAS', 'kamar': 'KAMAR',
          'asrama': 'ASRAMA', 'murobbi': 'MUROBBI', 'intensif': 'INTENSIF',
          'madin': 'MADIN', 'jobdesc': 'CATATAN KHUSUS'}
notes = []


class Capture(logging.Handler):
    def emit(self, record):
        notes.append(record.getMessage())


logger = logging.getLogger('pypdf')
logger.handlers = [Capture()]
logger.propagate = False
logger.setLevel(logging.WARNING)
reports = []
normalize = lambda value: ' '.join(value.split())

for case in cases:
    output = folder / case['id']
    output.mkdir(exist_ok=True)
    pdf = output / 'download.pdf'
    pdf.write_bytes(base64.b64decode(case['pdf']))
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter('always')
        reader = PdfReader(pdf, strict=True)
        assert len(reader.pages) == len(case['pages'])
        texts = [page.extract_text() for page in reader.pages]
        all_text = normalize('\n'.join(texts))
        assert normalize(case['subject']) in all_text
        for row in case['rows']:
            assert normalize(row['nama']) in all_text, (case['id'], 'missing name')
            for column in case['cols']:
                value = row.get(column) or '—'
                assert normalize(str(value)) in all_text, (case['id'], 'missing column', column)
        counts = []
        for index, page in enumerate(reader.pages):
            assert abs(float(page.mediabox.width) - 595.28) < .01
            assert abs(float(page.mediabox.height) - 841.89) < .01
            assert case['number'] in texts[index]
            columns = ['NO', 'NAMA SANTRI'] + [labels[key] for key in case['cols']]
            header_line = next(line for line in texts[index].splitlines() if line.startswith('NO\tNAMA SANTRI'))
            header = [normalize(cell) for cell in header_line.split('\t')]
            assert header == columns, (case['id'], 'column order', header)
            counts.append(len(re.findall(r'Santri Uji \d{3}', texts[index])))
            assert counts[-1] <= (20 if index == 0 else 22)
            assert ('Dokumen ini diterbitkan secara sah' in texts[index]) == (index == len(texts) - 1)
        assert sum(counts) == case['count']
        if not case['id'].startswith('custom-long'):
            expected = [min(20, case['count'])]
            rest = case['count'] - expected[0]
            while rest:
                take = min(22, rest)
                expected.append(take)
                rest -= take
            assert counts == expected, (case['id'], counts, expected)
        assert ('Dikeluarkan oleh:' in all_text) == case['issuer']
        for generic in ['Yang bertanda tangan', 'Demikian surat ini', 'Personil Terlibat', 'Koordinator / Pembawa']:
            assert generic not in all_text
        assert not caught and not notes, (case['id'], 'parser warning/recovery', notes)
    render = subprocess.run(['pdftoppm', '-scale-to-x', '794', '-scale-to-y', '1122', '-png',
                             str(pdf), str(output / 'pdf')], capture_output=True, check=True)
    images = sorted(output.glob('pdf-*.png'))
    subprocess.run(['pdftoppm', '-f', str(len(texts)), '-l', str(len(texts)), '-singlefile',
                    '-scale-to-x', '2382', '-scale-to-y', '3366', '-png', str(pdf),
                    str(output / 'qr')], capture_output=True, check=True)
    qr_image = Image.open(output / 'qr.png').convert('RGBA')
    raw = output / 'qr-rgba.bin'
    raw.write_bytes(qr_image.tobytes())
    qr_result = subprocess.run(['node', '--input-type=module', '-e',
        "import fs from 'node:fs';import jsQR from 'jsqr';const d=jsQR(new Uint8ClampedArray(fs.readFileSync(process.argv[1])),2382,3366);if(!d)process.exit(1);process.stdout.write(d.data)",
        str(raw)], capture_output=True, text=True, check=True)
    raw.unlink()
    assert qr_result.stdout.endswith('/014%2FSI-PTV%2FX%2F2026'), qr_result.stdout
    comparisons = []
    for index, image in enumerate(images):
        if case.get('previewPng'):
            capture = output / f'capture-{index + 1}.png'
            capture.write_bytes(base64.b64decode(case['previewPng'][index].split(',', 1)[1]))
        native = folder / f"native-{case['id']}-{index + 1}.png"
        if native.exists():
            a = Image.open(native).convert('RGB')
            b = Image.open(image).convert('RGB')
            assert a.size == b.size == (794, 1122)
            mean = sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3
            comparisons.append({'page': index + 1, 'native_vs_pdf_mean_absolute_pixel_error': round(mean, 3)})
    reports.append({'case': case['id'], 'pages': len(texts), 'rows_per_page': counts,
                    'columns': 2 + len(case['cols']), 'strict_parser': True, 'qr_decoded': True,
                    'native_comparisons': comparisons})

report = {'cases': len(reports), 'pages': sum(item['pages'] for item in reports),
          'warnings': 0, 'recovery': False, 'results': reports,
          'font': {'family': 'Plus Jakarta Sans', 'sha256': hashlib.sha256(font_path.read_bytes()).hexdigest(),
                   'missing_glyphs': [], 'appearance': 'rendered lossless 3x; font program not embedded'}}
(folder / 'verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
