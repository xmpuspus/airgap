"""Extract the two archived government PDFs; retain unedited OCR and exact input hashes."""
import hashlib
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCES = [
    ('boc-ocom-memo-01-2024', 'https://customs.gov.ph/wp-content/uploads/2024/01/2024-01-OCOM-MEMO.pdf',
     'Customs memo with full Proclamation 368 attached on PDF pages 2–4', 4),
    ('bir-rmc-102-2024', 'https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%20102-2024.pdf',
     'BIR Revenue Memorandum Circular 102-2024 reporting Proclamation 665; no attachment in this one-page PDF', 1),
]
for name, url, source_class, count in SOURCES:
    source = ROOT / 'evidence/public-service/sources' / f'{name}.pdf'
    raw = ROOT / 'tmp/public-showcase/source-ocr' / name
    raw.mkdir(parents=True, exist_ok=True)
    subprocess.run(['pdftoppm', '-r', '160', '-png', str(source), str(raw / 'page')], check=True)
    pages = sorted(raw.glob('page-*.png'))
    if len(pages) != count:
        raise ValueError(f'Expected {count} pages in {name}')
    outputs = [subprocess.check_output(['tesseract', str(page), 'stdout'], text=True) for page in pages]
    result = {'url': url, 'sourceClass': source_class, 'originBytes': False, 'sourceIsOriginalPdf': True,
              'sourcePath': str(source.relative_to(ROOT)),
              'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
              'transport': 'Downloaded official PDF supplied by task owner; unedited local OCR text extraction',
              'extractedAt': __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
              'ocrVersion': subprocess.check_output(['tesseract', '--version'], text=True).splitlines()[0],
              'pages': [{'page': i + 1, 'text': text} for i, text in enumerate(outputs)],
              'text': '\n\f\n'.join(outputs)}
    source.with_suffix('.ocr.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
