"""Synthetic OOXML -> existing extraction -> explicit mapping diagnostic.

These small archives are not registered templates or independent engine receipts.
No workbook formulas are executed and no actual learner data is used.
"""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from lib.ecr_co_extract import extract_co_diagnostic  # noqa: E402
from lib.ecr_fingerprint import fingerprint  # noqa: E402

NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PRIVATE = "PRIVATE_SYNTHETIC_PIPELINE_NAME"


def synthetic_archive(path, *, inline=False):
    names = ["INPUT DATA", "TERM 1", "TERM 2", "TERM 3"]
    files = {
        "xl/workbook.xml": f'<workbook xmlns="{NS}" xmlns:r="{REL}"><sheets>' + "".join(
            f'<sheet name="{name}" sheetId="{index}" r:id="rId{index}"/>' for index, name in enumerate(names, 1)) + '</sheets></workbook>',
        "xl/_rels/workbook.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + "".join(
            f'<Relationship Id="rId{index}" Type="{REL}/worksheet" Target="worksheets/sheet{index}.xml"/>' for index in range(1, 5)) + '</Relationships>',
    }
    if inline:
        identity = lambda address: f'<c r="{address}" t="inlineStr"><is><r><t>PRIVATE_SYNTHETIC_</t></r><r><t>PIPELINE_NAME</t></r></is></c>'
    else:
        files["xl/sharedStrings.xml"] = f'<sst xmlns="{NS}"><si><t>{PRIVATE}</t></si></sst>'
        identity = lambda address: f'<c r="{address}" t="s"><v>0</v></c>'
    files["xl/worksheets/sheet1.xml"] = f'<worksheet xmlns="{NS}"><sheetData><row r="11">{identity("K11")}</row><row r="60">{identity("N60")}</row></sheetData></worksheet>'
    columns = "FGHIJNOP TUV".replace(" ", "")
    for index in range(2, 5):
        maxima = "".join(f'<c r="{column}15"><v>10</v></c>' for column in columns)
        scores = "".join(f'<c r="{column}18"><v>10</v></c>' for column in columns)
        files[f"xl/worksheets/sheet{index}.xml"] = f'<worksheet xmlns="{NS}"><sheetData><row r="15">{maxima}</row><row r="18">{scores}<c r="AC18"><f>SYNTHETIC_NOT_EXECUTED</f><v>100</v></c></row><row r="118"><c r="F118"><v>0</v></c><c r="AC118" t="str"><f>SYNTHETIC_NOT_EXECUTED</f><v></v></c></row></sheetData></worksheet>'
    with zipfile.ZipFile(path, "w") as archive:
        for name, data in files.items():
            archive.writestr(name, data)


def review(data):
    context = {"schoolId": "synthetic-school", "classId": "synthetic-class", "subjectId": "synthetic-subject", "schoolYear": "synthetic-year", "term": data["term"]}
    return {"context": context,
            "roster": {"schema": "tanaw-roster-snapshot-v1", "context": context.copy(), "revision": "roster-1", "learnerKeys": ["PRIVATE_SYNTHETIC_KEY_A", "PRIVATE_SYNTHETIC_KEY_B"]},
            "mapping": {"schema": "tanaw-co-identity-map-v1", "context": context.copy(), "revision": "map-1", "rosterRevision": "roster-1",
                        "sourceHash": data["sourceHash"], "templateFingerprint": data["templateFingerprint"],
                        "entries": [{"rowNumber": 18, "identityLocator": "INPUT DATA!K11", "learnerKey": "PRIVATE_SYNTHETIC_KEY_A"},
                                    {"rowNumber": 118, "identityLocator": "INPUT DATA!N60", "learnerKey": "PRIVATE_SYNTHETIC_KEY_B"}]}}


class MappingPipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)

    def extract(self, term="TERM 1", *, inline=False):
        path = self.directory / "synthetic.xlsx"
        synthetic_archive(path, inline=inline)
        audit = fingerprint(path, {})
        source = {"family": "co-core", "structural_fingerprint": audit["fingerprint"], "protected_numeric_cells": {}}
        return extract_co_diagnostic(path.read_bytes(), term, source)

    def run_review(self, data, mapping):
        preview_path, map_path = self.directory / "preview.json", self.directory / "mapping.json"
        preview_path.write_text(json.dumps(data))
        map_path.write_text(json.dumps(mapping))
        result = subprocess.run(["node", "--experimental-strip-types", str(ROOT / "scripts/inspect_ecr_co_preview.mjs"),
                                 str(preview_path), "--mapping-review", str(map_path)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn(PRIVATE, result.stdout + result.stderr)
        self.assertNotIn("PRIVATE_SYNTHETIC_KEY", result.stdout + result.stderr)
        summary = json.loads(result.stdout)
        self.assertFalse(summary["canImport"])
        self.assertFalse(summary["runtimeImportEnabled"])
        self.assertNotIn("bindings", summary)
        self.assertNotIn("acceptedRows", summary)
        return summary

    def test_shared_and_inline_serialization_extract_and_map_both_blocks_for_all_terms(self):
        for inline in [False, True]:
            for term in ["TERM 1", "TERM 2", "TERM 3"]:
                with self.subTest(term=term, inline=inline):
                    data = self.extract(term, inline=inline)
                    self.assertEqual(data["rows"][-1]["inputs"]["written"][0], 0)
                    self.assertIsNone(data["rows"][-1]["referenceGrade"])
                    summary = self.run_review(data, review(data))
                    self.assertEqual(summary["identityMapping"], {"status": "consistent-diagnostic-only", "occupiedRows": 2, "boundRows": 2})
                    self.assertEqual(summary["excludedBlankRows"], 98)
                    codes = [error["code"] for error in summary["errors"]]
                    self.assertNotIn("incomplete-learner-identity", codes)
                    self.assertIn("source-policy-conflict", codes)
                    self.assertIn("unverified-computation", codes)

    def test_stale_mapping_blocks_every_binding_and_retains_private_log_boundary(self):
        data = self.extract()
        mapping = review(data)
        mapping["mapping"]["sourceHash"] = "a" * 64
        summary = self.run_review(data, mapping)
        self.assertEqual(summary["identityMapping"]["boundRows"], 0)
        self.assertIn("mapping-source-mismatch", [error["code"] for error in summary["errors"]])
        self.assertIn("incomplete-learner-identity", [error["code"] for error in summary["errors"]])

    def test_mapping_cannot_hide_one_missing_slot_by_releasing_the_other(self):
        data = self.extract()
        mapping = review(data)
        mapping["mapping"]["entries"].pop()
        summary = self.run_review(data, mapping)
        self.assertEqual(summary["identityMapping"]["status"], "blocked")
        self.assertEqual(summary["identityMapping"]["boundRows"], 0)
        self.assertIn({"rowNumber": 118, "code": "unmapped-occupied-slot"}, summary["errors"])

    def test_malformed_review_is_reported_without_echoing_its_contents(self):
        data = self.extract()
        summary = self.run_review(data, {"context": PRIVATE})
        self.assertEqual(summary["identityMapping"]["status"], "blocked")
        self.assertIn("invalid-mapping-bundle", [error["code"] for error in summary["errors"]])


if __name__ == "__main__":
    unittest.main()
