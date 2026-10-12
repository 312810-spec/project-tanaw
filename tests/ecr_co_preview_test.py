"""Synthetic normalization and private diagnostic contract; no original workbook."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from lib.ecr_co_normalize import cells, normalize_rows, number, text  # noqa: E402

NAMESPACE = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"


def cell(address="F18", value="0", kind="n", formula=None):
    element = ET.Element(f"{{{NAMESPACE}}}c", {"r": address, "t": kind})
    if formula is not None:
        ET.SubElement(element, f"{{{NAMESPACE}}}f").text = formula
    if value is not None:
        ET.SubElement(element, f"{{{NAMESPACE}}}v").text = value
    return element


class CoPreviewTests(unittest.TestCase):
    def test_fixed_roster_locators_cover_both_blocks_and_preserve_zero(self):
        scores = {"F18": cell(), "F15": cell("F15", "10"), "AC18": cell("AC18", "", "str", "IFERROR")}
        names = {"K11": cell("K11", "0", "s"), "N60": cell("N60", "1", "s")}
        rows = normalize_rows(scores, names, ["Synthetic first", "Synthetic last"])
        self.assertEqual(len(rows), 100)
        self.assertEqual((rows[0]["rowNumber"], rows[49]["rowNumber"], rows[50]["rowNumber"], rows[-1]["rowNumber"]), (18, 67, 69, 118))
        self.assertEqual(rows[0]["inputs"]["written"], [0, None, None, None, None])
        self.assertEqual(rows[-1]["identityLocator"], "INPUT DATA!N60")
        self.assertEqual(rows[-1]["learnerName"], "Synthetic last")
        self.assertIsNone(rows[0]["learnerKey"])
        self.assertIsNone(rows[0]["referenceGrade"])

    def test_raw_formulas_strings_booleans_errors_and_nonfinite_rejected(self):
        for value in [cell(formula="SUM(A1)"), cell(value="0", kind="s"), cell(value="1", kind="b"),
                      cell(value="#DIV/0!", kind="e"), cell(value="NaN"), cell(value="inf"), cell(value="-1")]:
            with self.assertRaises(ValueError): number(value)
        self.assertEqual(number(cell(value="0", formula="SYNTHETIC"), cache=True), 0)
        self.assertIsNone(number(None))

    def test_identity_shared_inline_rich_text_and_invalid_indices(self):
        self.assertEqual(text(cell(value="0", kind="s"), ["  Synthetic  "]), "Synthetic")
        inline = ET.fromstring(f'<c xmlns="{NAMESPACE}" r="K11" t="inlineStr"><is><r><t>Syn</t></r><r><t>thetic</t></r></is></c>')
        self.assertEqual(text(inline, []), "Synthetic")
        for value in [cell(value="-1", kind="s"), cell(value="2", kind="s"), cell(value="1"), cell(value="0", kind="s", formula="A1")]:
            with self.assertRaises(ValueError): text(value, ["Synthetic"])

    def test_duplicate_cells_rejected(self):
        root = ET.fromstring(f'<worksheet xmlns="{NAMESPACE}"><sheetData><row><c r="F18"/><c r="F18"/></row></sheetData></worksheet>')
        with self.assertRaises(ValueError): cells(root)

    def test_diagnostic_never_releases_batch_or_logs_identity(self):
        rows = normalize_rows({"F18": cell(), "F15": cell("F15", "10")},
                              {"K11": cell("K11", "0", "s")}, ["PRIVATE_SYNTHETIC_MARKER"])
        data = {"schema": "tanaw-co-diagnostic-v1", "family": "co-core", "term": "TERM 1", "runtimeImportEnabled": False,
                "templateFingerprint": "synthetic", "rows": rows}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "preview.json"
            path.write_text(json.dumps(data))
            result = subprocess.run(["node", "--experimental-strip-types", str(ROOT / "scripts/inspect_ecr_co_preview.mjs"), str(path)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        summary = json.loads(result.stdout)
        self.assertFalse(summary["canImport"])
        self.assertEqual(summary["learnerCount"], 1)
        self.assertEqual(summary["excludedBlankRows"], 99)
        self.assertIn("unverified-computation", [item["code"] for item in summary["errors"]])
        self.assertIn("source-policy-conflict", [item["code"] for item in summary["errors"]])
        self.assertIn("incomplete-learner-identity", [item["code"] for item in summary["errors"]])
        self.assertNotIn("PRIVATE_SYNTHETIC_MARKER", result.stdout + result.stderr)
        self.assertNotIn("acceptedRows", summary)

    def test_malformed_diagnostic_cannot_inject_private_text_into_logs(self):
        rows = normalize_rows({}, {}, [])
        for field in ["term", "rowNumber"]:
            data = {"schema": "tanaw-co-diagnostic-v1", "family": "co-core", "term": "TERM 1", "runtimeImportEnabled": False,
                    "templateFingerprint": "synthetic", "rows": rows}
            if field == "term": data["term"] = "PRIVATE_MARKER"
            else: data["rows"][0]["rowNumber"] = "PRIVATE_MARKER"
            with tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / "preview.json"
                path.write_text(json.dumps(data))
                result = subprocess.run(["node", "--experimental-strip-types", str(ROOT / "scripts/inspect_ecr_co_preview.mjs"), str(path)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 1)
            self.assertNotIn("PRIVATE_MARKER", result.stdout + result.stderr)

    def test_private_output_cannot_be_written_into_repository(self):
        result = subprocess.run([sys.executable, str(ROOT / "scripts/prepare_ecr_co_preview.py"),
                                 "nonexistent-private.xlsx", str(ROOT / "forbidden-private.json"), "--term", "TERM 1"], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertNotIn("nonexistent-private", result.stdout + result.stderr)
        self.assertFalse((ROOT / "forbidden-private.json").exists())


if __name__ == "__main__":
    unittest.main()
