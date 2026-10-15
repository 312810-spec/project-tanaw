"""Byte-snapshot boundary regressions; synthetic files only, no official records."""
import hashlib
import io
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from lib.ecr_co_extract import extract_co_diagnostic  # noqa: E402
from lib.ecr_fingerprint import EcrAuditError, fingerprint, fingerprint_bytes  # noqa: E402
from ecr_mapping_pipeline_test import synthetic_archive  # noqa: E402

GOLDEN = "f6ebf269b8119ddffaee65aa9950783b0a446ca865aa35c18a13541e4e70088d"


def rewrite(data, transform):
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        files = {name: archive.read(name) for name in archive.namelist()}
    transform(files)
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        for name, value in files.items():
            archive.writestr(name, value)
    return output.getvalue()


class ByteBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "synthetic.xlsx"
        synthetic_archive(self.path)
        self.data = self.path.read_bytes()
        self.source = {"family": "co-core", "structural_fingerprint": GOLDEN, "protected_numeric_cells": {}}

    def test_v1_fingerprint_matches_pre_refactor_golden_for_path_and_bytes(self):
        # Golden obtained from base-main v1 implementation, not the new wrapper.
        self.assertEqual(fingerprint(self.path, {})["fingerprint"], GOLDEN)
        self.assertEqual(fingerprint_bytes(self.data, {})["fingerprint"], GOLDEN)

    def test_all_terms_return_private_rows_hash_and_disabled_import(self):
        for term in ["TERM 1", "TERM 2", "TERM 3"]:
            result = extract_co_diagnostic(self.data, term, self.source)
            self.assertEqual(result["sourceHash"], hashlib.sha256(self.data).hexdigest())
            self.assertEqual(result["templateFingerprint"], GOLDEN)
            self.assertEqual(len(result["rows"]), 100)
            self.assertFalse(result["runtimeImportEnabled"])
            self.assertEqual(result["rows"][-1]["inputs"]["written"][0], 0)
            self.assertIsNone(result["rows"][-1]["referenceGrade"])

    def test_captured_bytes_do_not_reopen_source_path_or_create_temp_snapshot(self):
        self.path.write_bytes(b"PRIVATE_REPLACEMENT_NOT_A_WORKBOOK")
        with patch("tempfile.TemporaryDirectory", side_effect=AssertionError("unexpected disk staging")):
            result = extract_co_diagnostic(self.data, "TERM 1", self.source)
        self.assertEqual(result["sourceHash"], hashlib.sha256(self.data).hexdigest())

    def test_mutable_or_oversized_buffers_and_archive_expansion_fail_before_parsing(self):
        with self.assertRaisesRegex(EcrAuditError, "^invalid-workbook-bytes$"):
            extract_co_diagnostic(bytearray(self.data), "TERM 1", self.source)
        for field, error in [("MAX_BYTES", "file-too-large"), ("MAX_EXPANDED", "expanded-file-too-large"), ("MAX_MEMBERS", "invalid-archive-members")]:
            with patch("lib.ecr_fingerprint." + field, 1):
                with self.assertRaisesRegex(EcrAuditError, "^" + error + "$"):
                    extract_co_diagnostic(self.data, "TERM 1", self.source)

    def test_invalid_terms_source_contracts_and_changed_formulas_fail_closed(self):
        with self.assertRaisesRegex(EcrAuditError, "^invalid-term$"):
            extract_co_diagnostic(self.data, "PRIVATE_TERM", self.source)
        for source in [None, [], {}, {**self.source, "family": "division-core"}, {**self.source, "structural_fingerprint": "PRIVATE_HASH"},
                       {**self.source, "protected_numeric_cells": {"HELPER": "PRIVATE_RANGE"}}, {**self.source, "protected_numeric_cells": {"HELPER": [None]}}]:
            with self.assertRaisesRegex(EcrAuditError, "^invalid-source-contract$"):
                extract_co_diagnostic(self.data, "TERM 1", source)
        changed = rewrite(self.data, lambda files: files.update({"xl/worksheets/sheet2.xml": files["xl/worksheets/sheet2.xml"].replace(b"SYNTHETIC_NOT_EXECUTED", b"ALTERED_FORMULA")}))
        with self.assertRaisesRegex(EcrAuditError, "^unrecognized-template$"):
            extract_co_diagnostic(changed, "TERM 1", self.source)

    def test_external_active_content_dtd_and_duplicate_members_are_not_bypassed(self):
        for name, content, code in [("xl/vbaProject.bin", b"PRIVATE_MACRO", "unsupported-active-or-external-content"),
                                    ("xl/externalLinks/externalLink1.xml", b"PRIVATE_LINK", "unsupported-active-or-external-content"),
                                    ("../PRIVATE_PATH.xml", b"PRIVATE", "unsafe-archive-member"),
                                    ("xl/worksheets/_rels/sheet2.xml.rels", b'<Relationships><Relationship TargetMode="External" Target="PRIVATE_TARGET"/></Relationships>', "unsupported-external-relationship")]:
            changed = rewrite(self.data, lambda files: files.update({name: content}))
            with self.assertRaisesRegex(EcrAuditError, "^" + code + "$"):
                extract_co_diagnostic(changed, "TERM 1", self.source)
        dtd = rewrite(self.data, lambda files: files.update({"xl/workbook.xml": b'<!DOCTYPE workbook [<!ENTITY secret "PRIVATE_ENTITY">]>' + files["xl/workbook.xml"]}))
        with self.assertRaisesRegex(EcrAuditError, "^unsafe-xml$"):
            extract_co_diagnostic(dtd, "TERM 1", self.source)
        output = io.BytesIO(self.data)
        with zipfile.ZipFile(output, "a") as archive:
            archive.writestr("xl/workbook.xml", b"PRIVATE_DUPLICATE")
        with self.assertRaisesRegex(EcrAuditError, "^invalid-archive-members$"):
            extract_co_diagnostic(output.getvalue(), "TERM 1", self.source)

    def test_bad_zip_or_xml_never_escapes_with_private_error_details(self):
        malformed_xml = rewrite(self.data, lambda files: files.update({"xl/workbook.xml": b"<PRIVATE_XML"}))
        for data in [b"PRIVATE_NOT_A_ZIP", malformed_xml]:
            with self.assertRaisesRegex(EcrAuditError, "^invalid-workbook-serialization$"):
                extract_co_diagnostic(data, "TERM 1", self.source)

    def test_missing_co_sheet_rejected_even_if_audit_matches_supplied_contract(self):
        data = rewrite(self.data, lambda files: files.update({"xl/workbook.xml": files["xl/workbook.xml"].replace(b'<sheet name="TERM 3" sheetId="4" r:id="rId4"/>', b"")}))
        source = {**self.source, "structural_fingerprint": fingerprint_bytes(data, {})["fingerprint"]}
        with self.assertRaisesRegex(EcrAuditError, "^missing-co-sheet$"):
            extract_co_diagnostic(data, "TERM 1", source)


if __name__ == "__main__":
    unittest.main()
