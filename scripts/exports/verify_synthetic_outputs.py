"""Inspect actual prototype packages. Run with the bundled Python (pypdf)."""
import hashlib
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET
from zipfile import ZipFile
from pypdf import PdfReader

S = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
ERRORS = re.compile(r'#(?:REF!|DIV/0!|VALUE!|N/A|NAME\?|NUM!|SPILL!|CALC!)')


def verify(root):
    root = Path(root)
    model = json.loads((root / 'tanaw-synthetic-model.json').read_text())
    assert model['schema'] == 'tanaw-synthetic-export-v1'
    assert model['status'] == 'readyPrototypeOnly'
    assert model['canPublish'] is False and model['canAcceptDistrict'] is False
    assert [(r['value'], r['numerator'], r['denominator']) for r in model['rows']] == [(5, 1, 20), (0, 0, None)]
    refs = {str(v) for r in model['rows'] for v in r['provenance'].values()}
    with ZipFile(root / 'tanaw-synthetic-results.xlsx') as z:
        xml = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
        cells = {c.attrib['r']: c for c in xml.iter(S+'c')}
        for address, expected in [('C7',1),('D7',20),('E7',5),('C8',0),('E8',0)]:
            assert cells[address].attrib.get('t', 'n') == 'n', address
            assert float(cells[address].findtext(S+'v')) == expected, address
        for address in ['E7','E8']:
            assert cells[address].find(S+'f') is not None, 'editable formula missing'
        assert not list(xml.iter(S+'c')) or all(c.attrib.get('t') != 'e' for c in xml.iter(S+'c'))
        assert not any('externalLink' in n or 'vbaProject' in n for n in z.namelist())
        strings = ' '.join(' '.join(ET.fromstring(z.read(n)).itertext()) for n in z.namelist() if n.endswith('.xml'))
        assert 'Synthetic prototype.' in strings
        assert all(ref in strings for ref in refs)
        assert not ERRORS.search(strings)
        assert 'PRIVATE_SYNTHETIC_SOURCE' not in strings
    with ZipFile(root / 'tanaw-synthetic-results.pptx') as z:
        slides = [ET.fromstring(z.read(f'ppt/slides/slide{i}.xml')) for i in [1,2]]
        assert len([n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml', n)]) == 2
        for slide in slides:
            assert len(list(slide.iter(A+'tbl'))) == 1, 'native editable table missing'
            assert 'Not approved for official reporting.' in ' '.join(slide.itertext())
        table = next(slides[0].iter(A+'tbl'))
        values = [[ ''.join(cell.itertext()) for cell in row.findall(A+'tc')] for row in table.findall(A+'tr')]
        assert values[1] == ['Synthetic participation','1','20','5.00%']
        assert values[2] == ['Synthetic recorded count','0','n.a.','0']
        strings = ' '.join(' '.join(ET.fromstring(z.read(n)).itertext()) for n in z.namelist() if n.endswith('.xml'))
        assert all(ref in strings for ref in refs)
        assert not any(n.startswith('ppt/media/') for n in z.namelist()), 'rasterized data unexpected'
        assert not any(b'TargetMode="External"' in z.read(n) for n in z.namelist() if n.endswith('.rels'))
        assert 'PRIVATE_SYNTHETIC_SOURCE' not in strings
    pdf = PdfReader(root / 'tanaw-synthetic-results.pdf')
    assert len(pdf.pages) == 1
    text = pdf.pages[0].extract_text()
    assert 'Synthetic prototype.' in text and '5.00%' in text and 'Synthetic recorded count' in text
    assert all(ref in text for ref in refs)
    assert 'PRIVATE_SYNTHETIC_SOURCE' not in text
    assert len(pdf.pages[0]['/Resources']['/Font']) >= 2
    for text_source in [json.dumps(model), strings, text]:
        assert not re.search(r'PRIVATE|populationKeys|submission_id|author_id|sourceLocator',text_source)
    files = ['tanaw-synthetic-results.xlsx','tanaw-synthetic-results.pptx','tanaw-synthetic-results.pdf','tanaw-synthetic-model.json']
    receipt = {'schema':'tanaw-synthetic-export-package-check-v1', 'status':'pass', 'xlsxNumericAndFormulaCells':True, 'nativePptxTables':2, 'pdfPages':1, 'aggregateValues':[5,0], 'privateFixtureTextAbsent':True, 'targetApplicationEditSaveReopen':'not run', 'files':{name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in files}}
    print(json.dumps(receipt,indent=2))


if __name__ == '__main__':
    verify(sys.argv[1])
