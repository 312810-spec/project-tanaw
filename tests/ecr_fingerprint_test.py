"""Synthetic OOXML only: no approved workbook or learner data in fixtures."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("ecr_fingerprint", Path(__file__).resolve().parents[1] / "scripts/lib/ecr_fingerprint.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def workbook(path, *, score="7", cache="14", formula="A1*2", lookup="99.5", merge="B2:C2", extra=None, sheet_prefix=""):
    files = {
        "xl/workbook.xml": '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="HELPER" sheetId="1" r:id="rId1"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        "xl/worksheets/sheet1.xml": sheet_prefix + f'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>{score}</v></c><c r="B1"><f>{formula}</f><v>{cache}</v></c><c r="C1"><v>{lookup}</v></c></row></sheetData><mergeCells><mergeCell ref="{merge}"/></mergeCells></worksheet>',
    }
    files.update(extra or {})
    with zipfile.ZipFile(path, "w") as archive:
        for name, value in files.items():
            archive.writestr(name, value)


class FingerprintTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "synthetic.xlsx"

    def audit(self, **kwargs):
        workbook(self.path, **kwargs)
        return module.fingerprint(self.path, {"HELPER": ["C1"]})

    def test_scores_and_cached_results_do_not_change_structure(self):
        original = self.audit()
        self.assertEqual(original, self.audit(score="0", cache="0"))
        self.assertEqual(original["formula_cells"], 1)

    def test_formula_lookup_and_merge_changes_are_detected(self):
        original = self.audit()["fingerprint"]
        for changes in [{"formula": "A1*3"}, {"lookup": "99.4"}, {"merge": "B2:D2"}]:
            self.assertNotEqual(original, self.audit(**changes)["fingerprint"])

    def test_shared_formula_and_array_attributes_are_fingerprinted(self):
        original = self.audit()["fingerprint"]
        for value in ['<f t="shared" si="0" ref="B1:B2">A1*2</f>', '<f t="array" ref="B1">A1*2</f>']:
            with zipfile.ZipFile(self.path) as archive:
                files = {name: archive.read(name) for name in archive.namelist()}
            files['xl/worksheets/sheet1.xml'] = files['xl/worksheets/sheet1.xml'].replace(b'<f>A1*2</f>', value.encode())
            with zipfile.ZipFile(self.path, 'w') as archive:
                for name, data in files.items(): archive.writestr(name, data)
            self.assertNotEqual(original, module.fingerprint(self.path, {"HELPER": ["C1"]})["fingerprint"])
            self.audit()

    def test_active_content_external_links_and_external_relationships_rejected(self):
        for extra in [{"xl/vbaProject.bin": "synthetic"}, {"xl/externalLinks/externalLink1.xml": "synthetic"}, {"xl/embeddings/object.bin": "synthetic"}, {"xl/connections.xml": "synthetic"}, {"xl/queryTables/queryTable1.xml": "synthetic"}, {"xl/worksheets/_rels/sheet1.xml.rels": '<Relationships><Relationship TargetMode="External" Target="https://fixture.invalid"/></Relationships>'}]:
            with self.assertRaises(ValueError): self.audit(extra=extra)

    def test_defined_names_and_calculation_properties_are_fingerprinted(self):
        original = self.audit()["fingerprint"]
        for addition in ['<calcPr fullPrecision="0"/>', '<definedNames><definedName name="Fixture">HELPER!$C$1</definedName></definedNames>']:
            with zipfile.ZipFile(self.path) as archive:
                files = {name: archive.read(name) for name in archive.namelist()}
            files['xl/workbook.xml'] = files['xl/workbook.xml'].replace(b'</workbook>', addition.encode() + b'</workbook>')
            with zipfile.ZipFile(self.path, 'w') as archive:
                for name, data in files.items(): archive.writestr(name, data)
            self.assertNotEqual(original, module.fingerprint(self.path, {"HELPER": ["C1"]})["fingerprint"])
            self.audit()

    def test_dtd_and_path_traversal_rejected(self):
        with self.assertRaises(ValueError): self.audit(sheet_prefix='<!DOCTYPE worksheet [<!ENTITY fixture "synthetic">]>')
        with self.assertRaises(ValueError): self.audit(extra={"../escape.xml": "synthetic"})

    def test_duplicate_archive_members_rejected(self):
        self.audit()
        with zipfile.ZipFile(self.path, "a") as archive:
            archive.writestr("xl/workbook.xml", "synthetic")
        with self.assertRaises(ValueError): module.fingerprint(self.path, {"HELPER": ["C1"]})

    def test_file_and_expansion_limits_apply_before_parsing(self):
        self.audit()
        for field in ["MAX_BYTES", "MAX_EXPANDED", "MAX_MEMBERS"]:
            old = getattr(module, field)
            try:
                setattr(module, field, 1)
                with self.assertRaises(ValueError): module.fingerprint(self.path, {"HELPER": ["C1"]})
            finally: setattr(module, field, old)

    def test_report_never_includes_raw_cells_or_formula_text(self):
        result = self.audit(score="123456789", formula='"SYNTHETIC_PRIVATE_TEXT"')
        self.assertNotIn("123456789", str(result))
        self.assertNotIn("SYNTHETIC_PRIVATE_TEXT", str(result))


if __name__ == "__main__":
    unittest.main()
