"""Read-only approved-source audit; reports only non-personal hashes/counts/status."""
import argparse
import hashlib
import json
import zipfile
from xml.etree import ElementTree as ET
from pathlib import Path
from lib.ecr_fingerprint import EcrAuditError, fingerprint


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("family", choices=["co-core", "division-core"])
    parser.add_argument("workbook", type=Path)
    args = parser.parse_args()
    registry = json.loads((Path(__file__).resolve().parents[1] / "docs/ecr/source-registry.json").read_text())
    source = next(item for item in registry["sources"] if item["family"] == args.family)
    lookup = source["protected_numeric_cells"]
    try:
        result = fingerprint(args.workbook, lookup)
        raw_hash = hashlib.sha256(args.workbook.read_bytes()).hexdigest()
        result.update({"family": args.family, "original_file_match": raw_hash == source["original_sha256"],
                       "structural_match": result["fingerprint"] == source["structural_fingerprint"],
                       "runtime_import_enabled": False})
        print(json.dumps(result, indent=2))
        return 0 if result["structural_match"] else 1
    except (ValueError, KeyError, OSError, zipfile.BadZipFile, ET.ParseError) as error:
        # Do not log exception strings that may contain XML/cell/file contents.
        print(json.dumps({"family": args.family, "error": str(error) if isinstance(error, EcrAuditError) else "invalid-workbook", "runtime_import_enabled": False}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
