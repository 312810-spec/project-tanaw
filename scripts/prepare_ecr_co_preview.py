"""Extract a registered CO workbook to a private diagnostic file; import stays closed."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import tempfile
import zipfile
from xml.etree import ElementTree as ET

from lib.ecr_fingerprint import EcrAuditError, MAX_BYTES, fingerprint
from lib.ecr_co_normalize import normalize_archive


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("output", type=Path, help="New private JSON path outside the repository")
    parser.add_argument("--term", required=True, choices=["TERM 1", "TERM 2", "TERM 3"])
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    try:
        if args.output.resolve().is_relative_to(root):
            raise EcrAuditError("private-output-inside-repository")
        if args.workbook.stat().st_size > MAX_BYTES:
            raise EcrAuditError("file-too-large")
        data = args.workbook.read_bytes()
        if len(data) > MAX_BYTES:
            raise EcrAuditError("file-too-large")
        registry = json.loads((root / "docs/ecr/source-registry.json").read_text())
        source = next(item for item in registry["sources"] if item["family"] == "co-core")
        # Audit exactly the bytes we later parse, avoiding a path replacement race.
        with tempfile.TemporaryDirectory() as directory:
            snapshot = Path(directory) / "source.xlsx"
            snapshot.write_bytes(data)
            audit = fingerprint(snapshot, source["protected_numeric_cells"])
        if audit["fingerprint"] != source["structural_fingerprint"]:
            raise EcrAuditError("unrecognized-template")
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            rows = normalize_archive(archive, args.term)
        result = {"schema": "tanaw-co-diagnostic-v1", "family": "co-core", "term": args.term,
                  "sourceHash": hashlib.sha256(data).hexdigest(), "templateFingerprint": audit["fingerprint"],
                  "runtimeImportEnabled": False, "rows": rows}
        # Exclusive creation, restrictive permissions; never overwrite an existing file.
        fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as output:
            json.dump(result, output, allow_nan=False)
        print(json.dumps({"status": "private-preview-prepared", "term": args.term, "rowSlots": len(rows), "runtimeImportEnabled": False}))
        return 0
    except (ValueError, KeyError, OSError, zipfile.BadZipFile, ET.ParseError, StopIteration):
        # Static errors only: identities, values and private paths stay out of logs.
        print(json.dumps({"error": "preview-preparation-failed", "runtimeImportEnabled": False}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
