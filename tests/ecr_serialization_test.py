"""Reject ambiguous supported OOXML nodes; synthetic archives, no official data."""
import io
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from lib.ecr_co_extract import extract_co_diagnostic  # noqa: E402
from lib.ecr_fingerprint import EcrAuditError, fingerprint_bytes  # noqa: E402
from lib.ecr_co_normalize import number, text  # noqa: E402
from ecr_mapping_pipeline_test import synthetic_archive  # noqa: E402

PRIVATE = b"PRIVATE_AMBIGUOUS_SERIALIZATION"


def rewrite(data, path, before, after):
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        files = {name: archive.read(name) for name in archive.namelist()}
    assert before in files[path]
    files[path] = files[path].replace(before, after, 1)
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return output.getvalue()


class SerializationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        path = Path(self.temp.name) / "synthetic.xlsx"
        synthetic_archive(path)
        self.data = path.read_bytes()
        self.source = {"family": "co-core", "structural_fingerprint": fingerprint_bytes(self.data, {})["fingerprint"], "protected_numeric_cells": {}}

    def rejected(self, data, code):
        with self.assertRaisesRegex(EcrAuditError, "^" + code + "$"):
            fingerprint_bytes(data, {})
        for term in ["TERM 1", "TERM 2", "TERM 3"]:
            with self.assertRaisesRegex(EcrAuditError, "^" + code + "$"):
                extract_co_diagnostic(data, term, self.source)

    def test_duplicate_score_maximum_and_cached_values_are_not_first_value_wins(self):
        for address in [b"F15", b"F18", b"AC18"]:
            before = b'<c r="' + address + b'">'
            changed = rewrite(self.data, "xl/worksheets/sheet2.xml", before, before + b'<v>0</v>')
            self.rejected(changed, "ambiguous-cell-serialization")

    def test_additional_formula_is_rejected_before_fingerprint_matching(self):
        changed = rewrite(self.data, "xl/worksheets/sheet2.xml", b'</f>', b'</f><f>' + PRIVATE + b'</f>')
        self.rejected(changed, "ambiguous-cell-serialization")

    def test_inline_strings_cannot_have_multiple_containers_or_competing_values(self):
        for addition in [b'<is><t>' + PRIVATE + b'</t></is>', b'<v>0</v>', b'<f>SYNTHETIC</f>']:
            changed = rewrite(self.data, "xl/worksheets/sheet1.xml", b'<c r="K11" t="s"><v>0</v></c>', b'<c r="K11" t="inlineStr"><is><t>Synthetic</t></is>' + addition + b'</c>')
            self.rejected(changed, "ambiguous-cell-serialization")
        for kind in [b'n', b's', b'str']:
            changed = rewrite(self.data, "xl/worksheets/sheet1.xml", b'<c r="K11" t="s"><v>0</v></c>', b'<c r="K11" t="' + kind + b'"><is><t>Synthetic</t></is></c>')
            self.rejected(changed, "ambiguous-cell-serialization")

    def test_duplicate_relationship_ids_cannot_overwrite_earlier_entries(self):
        for path in ['xl/_rels/workbook.xml.rels', 'xl/worksheets/_rels/sheet2.xml.rels']:
            if path.endswith('workbook.xml.rels'):
                changed = rewrite(self.data, path, b'<Relationship Id="rId1"', b'<Relationship Id="rId1" Type="worksheet" Target="' + PRIVATE + b'"/><Relationship Id="rId1"')
            else:
                with zipfile.ZipFile(io.BytesIO(self.data)) as archive:
                    files = {name: archive.read(name) for name in archive.namelist()}
                files[path] = b'<Relationships><Relationship Id="rId1"/><Relationship Id="rId1" Target="' + PRIVATE + b'"/></Relationships>'
                output = io.BytesIO()
                with zipfile.ZipFile(output, 'w') as archive:
                    for name, content in files.items(): archive.writestr(name, content)
                changed = output.getvalue()
            self.rejected(changed, "invalid-relationship-ids")

    def test_missing_relationship_ids_are_rejected_without_private_targets(self):
        changed = rewrite(self.data, 'xl/_rels/workbook.xml.rels', b'Id="rId1"', b'Other="' + PRIVATE + b'"')
        self.rejected(changed, "invalid-relationship-ids")

    def test_duplicate_singleton_sections_are_rejected(self):
        for path, before, after in [
            ('xl/workbook.xml', b'</workbook>', b'<calcPr/><calcPr/></workbook>'),
            ('xl/workbook.xml', b'</workbook>', b'<definedNames/><definedNames/></workbook>'),
            ('xl/workbook.xml', b'</workbook>', b'<sheets/></workbook>'),
            ('xl/worksheets/sheet2.xml', b'</worksheet>', b'<sheetData/></worksheet>'),
            ('xl/worksheets/sheet2.xml', b'</worksheet>', b'<mergeCells/><mergeCells/></worksheet>'),
        ]:
            self.rejected(rewrite(self.data, path, before, after), "ambiguous-ooxml-structure")

    def test_valid_score_and_cache_changes_retain_golden_fingerprint_and_zero(self):
        changed = rewrite(self.data, 'xl/worksheets/sheet2.xml', b'<c r="F18"><v>10</v>', b'<c r="F18"><v>0</v>')
        changed = rewrite(changed, 'xl/worksheets/sheet2.xml', b'<f>SYNTHETIC_NOT_EXECUTED</f><v>100</v>', b'<f>SYNTHETIC_NOT_EXECUTED</f><v>0</v>')
        self.assertEqual(fingerprint_bytes(changed, {})['fingerprint'], self.source['structural_fingerprint'])
        result = extract_co_diagnostic(changed, 'TERM 1', self.source)
        self.assertEqual(result['rows'][0]['inputs']['written'][0], 0)
        self.assertEqual(result['rows'][0]['referenceGrade'], 0)
        self.assertFalse(result['runtimeImportEnabled'])

    def test_private_scalar_helpers_also_reject_competing_values(self):
        ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
        for body in ['<v>0</v><v>10</v>', '<f>ONE</f><f>TWO</f><v>0</v>']:
            element = ET.fromstring(f'<c xmlns="{ns}" r="F18">{body}</c>')
            with self.assertRaisesRegex(EcrAuditError, "^ambiguous-cell-serialization$"):
                number(element, cache=True)
        identity = ET.fromstring(f'<c xmlns="{ns}" r="K11" t="s"><v>0</v><v>1</v></c>')
        with self.assertRaisesRegex(EcrAuditError, "^ambiguous-cell-serialization$"):
            text(identity, ["Synthetic A", "Synthetic B"])

    def test_relationship_id_scope_is_per_part_not_global(self):
        with zipfile.ZipFile(io.BytesIO(self.data)) as archive:
            files = {name: archive.read(name) for name in archive.namelist()}
        files['xl/worksheets/_rels/sheet2.xml.rels'] = b'<Relationships><Relationship Id="rId1" Type="fixture" Target="fixture.xml"/></Relationships>'
        output = io.BytesIO()
        with zipfile.ZipFile(output, 'w') as archive:
            for name, content in files.items(): archive.writestr(name, content)
        self.assertEqual(fingerprint_bytes(output.getvalue(), {})['fingerprint'], self.source['structural_fingerprint'])

    def test_worker_rejection_never_logs_ambiguous_private_content(self):
        changed = rewrite(self.data, 'xl/worksheets/sheet2.xml', b'</f>', b'</f><f>' + PRIVATE + b'</f>')
        result = subprocess.run([sys.executable, '-I', str(ROOT / 'scripts/ecr_co_worker.py'), 'TERM 1'], input=changed, capture_output=True)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout.strip(), b'{"ok": false, "code": "workbook-rejected"}')
        self.assertEqual(result.stderr, b'')
        self.assertNotIn(PRIVATE, result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
