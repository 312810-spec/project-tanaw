"""Collect cached independent-engine results from the synthetic CO fixture only."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

from lib.ecr_fingerprint import NS, DOC_REL
from lib.ecr_co_normalize import cells, number, xml


def collect(metadata, workbook):
    if metadata["schema"] != "tanaw-co-engine-cases-v1" or len(metadata["terms"]) != 3:
        raise ValueError("invalid-case-contract")
    with zipfile.ZipFile(workbook) as archive:
        book = xml(archive, "xl/workbook.xml")
        relationships = {item.get("Id"): item.get("Target") for item in xml(archive, "xl/_rels/workbook.xml.rels")}
        sheets = {}
        for sheet in book.findall("s:sheets/s:sheet", NS):
            target = relationships[sheet.get("{" + DOC_REL + "}id")]
            path = target.lstrip("/") if target.startswith("/") else "xl/" + target
            sheets[sheet.get("name")] = cells(xml(archive, path))
        terms = []
        for term in metadata["terms"]:
            sheet = sheets[term["term"]]
            lookups, components = [], []
            for case in term["cases"]:
                row = case["row"]
                grade_cell = sheet.get(f"AC{row}")
                if grade_cell is None or grade_cell.find("s:f", NS) is None:
                    raise ValueError("missing-calculation-cell")
                grade = number(grade_cell, cache=True)
                candidate_grade = number(sheet.get(f"AD{row}"), cache=True)
                if case["kind"] == "lookup":
                    lookups.append([case["id"], case["initialGrade"], grade, candidate_grade])
                else:
                    expected = {key: number(sheet.get(f"{column}{row}"), cache=True) for key, column in
                                [("writtenPercent", "L"), ("performancePercent", "R"), ("examinationPercent", "Z"), ("initialGrade", "AB")]}
                    expected["grade"] = grade
                    components.append({"id": case["id"], "inputs": case["inputs"], "expected": expected, "candidateGrade": candidate_grade})
            if len(lookups) != 124 or len(components) != 11 or next(item for item in components if item["id"] == "full-marks")["expected"]["grade"] != 100:
                raise ValueError("incomplete-engine-results")
            terms.append({"term": term["term"], "candidateFormula": term["candidateFormula"], "lookupCases": lookups, "componentCases": components})
    return {"schema": "tanaw-co-engine-receipt-v1", "sourceHash": metadata["sourceHash"],
            "structuralFingerprint": metadata["structuralFingerprint"], "terms": terms}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cases", type=Path)
    parser.add_argument("recalculated_workbook", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--engine", required=True)
    args = parser.parse_args()
    result = collect(json.loads(args.cases.read_text()), args.recalculated_workbook)
    result.update({"engine": args.engine, "engineWorkbookSha256": hashlib.sha256(args.recalculated_workbook.read_bytes()).hexdigest(),
                   "fixtureScope": "Source expressions at row 18; exact and +/-0.01 thresholds; synthetic component profiles; all three terms",
                   "runtimeImportApproved": False})
    args.output.write_text(json.dumps(result, separators=(",", ":"), allow_nan=False) + "\n")
    print(json.dumps({"terms": 3, "engineCases": 405, "runtimeImportApproved": False}))


if __name__ == "__main__":
    main()
