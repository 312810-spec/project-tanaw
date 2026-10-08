"""Conservative source-audit fingerprint. Never emits learner cells or cached values.

This is development tooling, not a runtime XLSX parser or an import approval.
Shared formula serialization is retained: resaved equivalents can fail closed.
"""
import hashlib
import json
import posixpath
import zipfile
from xml.etree import ElementTree as ET

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
DOC_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
MAX_BYTES = 32 * 1024 * 1024
MAX_EXPANDED = 64 * 1024 * 1024
MAX_MEMBERS = 1024


class EcrAuditError(ValueError):
    """Only static, non-personal audit error codes."""


def fingerprint(path, lookup_ranges):
    """Hash formula definitions, sheet topology, merges and explicit numeric lookups."""
    if path.stat().st_size > MAX_BYTES:
        raise EcrAuditError("file-too-large")
    with zipfile.ZipFile(path) as archive:
        entries = archive.infolist()
        names = [entry.filename for entry in entries]
        if len(entries) > MAX_MEMBERS or len(set(names)) != len(names):
            raise EcrAuditError("invalid-archive-members")
        if sum(entry.file_size for entry in entries) > MAX_EXPANDED:
            raise EcrAuditError("expanded-file-too-large")
        if any(entry.flag_bits & 1 or entry.filename.startswith("/") or ".." in entry.filename.split("/") for entry in entries):
            raise EcrAuditError("unsafe-archive-member")
        if any("vbaproject" in name.lower() or name.startswith("xl/externalLinks/") or name.startswith("xl/embeddings/") or name == "xl/connections.xml" or name.startswith("xl/queryTables/") for name in names):
            raise EcrAuditError("unsupported-active-or-external-content")

        def xml(name):
            data = archive.read(name).decode("utf-8-sig")
            if "<!DOCTYPE" in data.upper() or "<!ENTITY" in data.upper():
                raise EcrAuditError("unsafe-xml")
            return ET.fromstring(data)

        # Reject external relationships anywhere, without exposing their targets.
        for name in names:
            if name.endswith(".rels"):
                if any(rel.get("TargetMode") == "External" for rel in xml(name)):
                    raise EcrAuditError("unsupported-external-relationship")
        workbook = xml("xl/workbook.xml")
        relations = {rel.get("Id"): rel for rel in xml("xl/_rels/workbook.xml.rels")}
        sheets = []
        seen = set()
        for sheet in workbook.findall("s:sheets/s:sheet", NS):
            name = sheet.get("name")
            if not name or name in seen:
                raise EcrAuditError("invalid-sheet-names")
            seen.add(name)
            relation = relations.get(sheet.get("{" + DOC_REL + "}id"))
            if relation is None or not relation.get("Type", "").endswith("/worksheet"):
                raise EcrAuditError("unsupported-sheet-type")
            target = relation.get("Target", "")
            source = posixpath.normpath(target.lstrip("/") if target.startswith("/") else "xl/" + target)
            if not source.startswith("xl/worksheets/"):
                raise EcrAuditError("unsafe-sheet-target")
            root = xml(source)
            cells = {cell.get("r"): cell for cell in root.findall("s:sheetData/s:row/s:c", NS)}
            if len(cells) != len(root.findall("s:sheetData/s:row/s:c", NS)):
                raise EcrAuditError("duplicate-cell")
            formulas = []
            for address, cell in sorted(cells.items()):
                formula = cell.find("s:f", NS)
                if formula is not None:
                    formulas.append([address, sorted(formula.attrib.items()), formula.text or ""])
            lookup = []
            for address in lookup_ranges.get(name, []):
                cell = cells.get(address)
                if cell is None or cell.get("t", "n") != "n" or cell.find("s:f", NS) is not None:
                    raise EcrAuditError("missing-or-invalid-lookup-cell")
                value = cell.find("s:v", NS)
                if value is None or value.text is None:
                    raise EcrAuditError("missing-lookup-value")
                # Decimal lexical normalization is intentionally conservative.
                lookup.append([address, value.text])
            sheets.append({"name": name, "state": sheet.get("state", "visible"), "formulas": formulas,
                           "merges": sorted(item.get("ref") for item in root.findall("s:mergeCells/s:mergeCell", NS)), "lookup": lookup})
        if any(name not in seen for name in lookup_ranges):
            raise EcrAuditError("missing-lookup-sheet")
        defined_names = [[sorted(item.attrib.items()), item.text or ""] for item in workbook.findall("s:definedNames/s:definedName", NS)]
        calc = workbook.find("s:calcPr", NS)
        structure = {"algorithm": "tanaw-ooxml-source-v1", "sheets": sheets,
                     "defined_names": defined_names, "calculation_properties": sorted(calc.attrib.items()) if calc is not None else []}
        encoded = json.dumps(structure, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()
        return {"algorithm": structure["algorithm"], "fingerprint": hashlib.sha256(encoded).hexdigest(),
                "formula_cells": sum(len(sheet["formulas"]) for sheet in sheets),
                "sheet_names": [sheet["name"] for sheet in sheets]}
