"""Reusable private CO byte extraction; never grants runtime import authority.

The source contract must come from the trusted registry, not an uploaded file.
Returned rows contain private identities/scores; callers must not log them.
"""
import hashlib
import io
import re
import zipfile
from xml.etree import ElementTree as ET

from lib.ecr_co_normalize import normalize_archive
from lib.ecr_fingerprint import EcrAuditError, fingerprint_bytes


def extract_co_diagnostic(data, term, source):
    """Audit and normalize exactly the same immutable bytes, without temp files."""
    if term not in ("TERM 1", "TERM 2", "TERM 3"):
        raise EcrAuditError("invalid-term")
    if (not isinstance(source, dict) or source.get("family") != "co-core"
            or not isinstance(source.get("structural_fingerprint"), str)
            or re.fullmatch(r"[a-f0-9]{64}", source["structural_fingerprint"]) is None
            or not isinstance(source.get("protected_numeric_cells"), dict)):
        raise EcrAuditError("invalid-source-contract")
    lookups = source["protected_numeric_cells"]
    if any(not isinstance(name, str) or not isinstance(addresses, list)
           or any(not isinstance(address, str) for address in addresses)
           for name, addresses in lookups.items()):
        raise EcrAuditError("invalid-source-contract")
    try:
        audit = fingerprint_bytes(data, lookups)
        if audit["fingerprint"] != source["structural_fingerprint"]:
            raise EcrAuditError("unrecognized-template")
        if not all(name in audit["sheet_names"] for name in ("INPUT DATA", "TERM 1", "TERM 2", "TERM 3")):
            raise EcrAuditError("missing-co-sheet")
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            rows = normalize_archive(archive, term)
    except EcrAuditError:
        raise
    except (ValueError, KeyError, TypeError, OSError, RuntimeError, NotImplementedError,
            zipfile.BadZipFile, ET.ParseError):
        # Never propagate archive filenames, XML content or learner values.
        raise EcrAuditError("invalid-workbook-serialization") from None
    return {"schema": "tanaw-co-diagnostic-v1", "family": "co-core", "term": term,
            "sourceHash": hashlib.sha256(data).hexdigest(), "templateFingerprint": audit["fingerprint"],
            "runtimeImportEnabled": False, "rows": rows}
