"""Synthetic source extraction privacy and structural acceptance checks."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from prepare_ecr_engine_fixture import extract, FORMULA_COLUMNS  # noqa: E402
from lib.ecr_fingerprint import fingerprint  # noqa: E402

NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


class EngineSourceTests(unittest.TestCase):
    def fixture(self, directory):
        path = Path(directory) / "synthetic.xlsx"
        sheets = ["HELPER", "TERM 1", "TERM 2", "TERM 3", "INPUT DATA"]
        files = {"xl/workbook.xml": f'<workbook xmlns="{NS}" xmlns:r="{REL}"><sheets>' +
                 "".join(f'<sheet name="{name}" sheetId="{i}" r:id="r{i}"/>' for i, name in enumerate(sheets, 1)) + '</sheets></workbook>',
                 "xl/_rels/workbook.xml.rels": '<Relationships>' +
                 "".join(f'<Relationship Id="r{i}" Type="{REL}/worksheet" Target="worksheets/sheet{i}.xml"/>' for i in range(1, 6)) + '</Relationships>'}
        helper = "".join(f'<row r="{r}">' + "".join(f'<c r="{c}{r}"><v>{100-r}</v></c>' for c in "BCD") + '</row>' for r in range(8, 49))
        files["xl/worksheets/sheet1.xml"] = f'<worksheet xmlns="{NS}"><sheetData>{helper}</sheetData></worksheet>'
        for i in range(2, 5):
            constants = "".join(f'<c r="{c}15"><v>1</v></c>' for c in ["L", "M", "R", "S", "W", "X", "Y", "Z", "AA"])
            formulas = "".join(f'<c r="{c}18"><f>1+1</f><v>2</v></c>' for c in FORMULA_COLUMNS)
            files[f"xl/worksheets/sheet{i}.xml"] = f'<worksheet xmlns="{NS}"><sheetData><row r="15">{constants}</row><row r="18">{formulas}<c r="F18"><v>123456789</v></c></row></sheetData></worksheet>'
        files["xl/worksheets/sheet5.xml"] = f'<worksheet xmlns="{NS}"><sheetData><row r="11"><c r="K11" t="inlineStr"><is><t>PRIVATE_SYNTHETIC_IDENTITY</t></is></c></row></sheetData></worksheet>'
        with zipfile.ZipFile(path, "w") as archive:
            for name, value in files.items(): archive.writestr(name, value)
        protected = {"HELPER": [f"{c}{r}" for r in range(8, 49) for c in "BCD"]}
        source = {"protected_numeric_cells": protected, "structural_fingerprint": fingerprint(path, protected)["fingerprint"]}
        return path.read_bytes(), source

    def test_registered_extraction_never_emits_identity_or_raw_score(self):
        with tempfile.TemporaryDirectory() as directory:
            data, source = self.fixture(directory)
            result = extract(data, source)
        encoded = json.dumps(result)
        self.assertNotIn("PRIVATE_SYNTHETIC_IDENTITY", encoded)
        self.assertNotIn("123456789", encoded)
        self.assertEqual(len(result["terms"]), 3)
        self.assertEqual(len(result["helper"]), 41)
        self.assertEqual(set(result["terms"][0]["formulas"]), set(FORMULA_COLUMNS))

    def test_unregistered_structure_rejected_before_extraction(self):
        with tempfile.TemporaryDirectory() as directory:
            data, source = self.fixture(directory)
            source["structural_fingerprint"] = "unregistered"
            with self.assertRaisesRegex(ValueError, "unrecognized-template"):
                extract(data, source)


if __name__ == "__main__":
    unittest.main()
