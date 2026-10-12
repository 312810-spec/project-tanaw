"""Extract only registered CO formulas/constants for synthetic engine verification."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import tempfile
import zipfile

from lib.ecr_fingerprint import EcrAuditError, MAX_BYTES, fingerprint, NS, DOC_REL
from lib.ecr_co_normalize import cells, number, xml

FORMULA_COLUMNS = ["K", "L", "M", "Q", "R", "S", "W", "X", "Y", "Z", "AA", "AB", "AC"]


def extract(data, source):
    if len(data) > MAX_BYTES:
        raise EcrAuditError("file-too-large")
    with tempfile.TemporaryDirectory() as directory:
        snapshot = Path(directory) / "source.xlsx"
        snapshot.write_bytes(data)
        audit = fingerprint(snapshot, source["protected_numeric_cells"])
    if audit["fingerprint"] != source["structural_fingerprint"]:
        raise EcrAuditError("unrecognized-template")
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        book = xml(archive, "xl/workbook.xml")
        rels = {item.get("Id"): item.get("Target") for item in xml(archive, "xl/_rels/workbook.xml.rels")}
        sheets = {}
        for sheet in book.findall("s:sheets/s:sheet", NS):
            target = rels[sheet.get("{" + DOC_REL + "}id")]
            path = target.lstrip("/") if target.startswith("/") else "xl/" + target
            sheets[sheet.get("name")] = cells(xml(archive, path))
        helper = sheets["HELPER"]
        terms = []
        for term in ["TERM 1", "TERM 2", "TERM 3"]:
            formulas = {}
            for column in FORMULA_COLUMNS:
                formula = sheets[term][f"{column}18"].find("s:f", NS)
                if formula is None or not formula.text:
                    raise EcrAuditError("missing-source-formula-anchor")
                formulas[column] = "=" + formula.text
            constants = {column: number(sheets[term][f"{column}15"]) for column in ["L", "M", "R", "S", "W", "X", "Y", "Z", "AA"]}
            terms.append({"term": term, "formulas": formulas, "constants": constants})
        return {"schema": "tanaw-co-engine-source-v1", "sourceHash": hashlib.sha256(data).hexdigest(),
                "structuralFingerprint": audit["fingerprint"], "terms": terms,
                "helper": [[number(helper[f"{column}{row}"]) for column in "BCD"] for row in range(8, 49)]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    try:
        if args.output.resolve().is_relative_to(root) or args.workbook.stat().st_size > MAX_BYTES:
            raise EcrAuditError("invalid-private-path-or-size")
        source = next(item for item in json.loads((root / "docs/ecr/source-registry.json").read_text())["sources"] if item["family"] == "co-core")
        result = extract(args.workbook.read_bytes(), source)
        fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as output:
            json.dump(result, output, allow_nan=False)
        print(json.dumps({"status": "source-formulas-extracted", "terms": 3, "learnerCellsIncluded": False}))
        return 0
    except Exception:
        print(json.dumps({"error": "source-extraction-failed"}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
