"""Strict parser check for synthetic artifacts emitted by docPdfStructure.test.ts."""
import json
import logging
import sys
import warnings
from pathlib import Path

from pypdf import PdfReader

folder = Path(sys.argv[1]).resolve()
manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf-8'))
messages = []


class Capture(logging.Handler):
    def emit(self, record):
        messages.append(record.getMessage())


logger = logging.getLogger('pypdf')
logger.handlers = [Capture()]
logger.propagate = False
logger.setLevel(logging.WARNING)

for case in manifest:
    path = folder / case['file']
    with warnings.catch_warnings(record=True) as recorded:
        warnings.simplefilter('always')
        reader = PdfReader(path, strict=True)
        assert len(reader.pages) == case['pages'], case['file']
        text = '\n'.join(page.extract_text() for page in reader.pages)
        assert case['subject'] in text, f"Unicode text mismatch: {case['file']}"
        for name in case['names'] + case['itemNames']:
            assert name in text, f"Missing row in {case['file']}"
        for page in reader.pages:
            assert abs(float(page.mediabox.width) - 595.28) < 0.01
            assert abs(float(page.mediabox.height) - 841.89) < 0.01
            content = page.get_contents().get_data()
            assert b'014/ST-PTV/X/2026' in content
            assert b'/ImLogo Do' in content
            assert b'0 0 0 rg' in content  # Vector QR retained on every page.
            image = page['/Resources']['/XObject']['/ImLogo'].get_object()
            assert image['/Width'] == 323 and image['/Height'] == 184
            jpeg = image.get_data()
            assert jpeg.startswith(b'\xff\xd8') and jpeg.endswith(b'\xff\xd9')
        assert not recorded, f"Parser warnings: {case['file']}"
    assert not messages, f"Parser recovery/warnings: {case['file']}: {messages}"

print(json.dumps({'parser': 'pypdf strict=True', 'files': len(manifest),
                  'pages': sum(case['pages'] for case in manifest),
                  'warnings': 0, 'recovery': False, 'all_rows_and_unicode_preserved': True}))
