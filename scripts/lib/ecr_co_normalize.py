"""Private, read-only CO preview extraction. Never evaluates workbook formulas.

Caller must verify the registered structural fingerprint before using these
fixed source locators. This module is not a production import adapter.
"""
import math
import posixpath
from xml.etree import ElementTree as ET

from lib.ecr_fingerprint import EcrAuditError, NS, DOC_REL


def xml(archive, name):
    data = archive.read(name).decode("utf-8-sig")
    if "<!DOCTYPE" in data.upper() or "<!ENTITY" in data.upper():
        raise EcrAuditError("unsafe-xml")
    return ET.fromstring(data)


def cells(root):
    result = {}
    for cell in root.findall("s:sheetData/s:row/s:c", NS):
        address = cell.get("r")
        if not address or address in result:
            raise EcrAuditError("invalid-or-duplicate-cell")
        result[address] = cell
    return result


def number(cell, *, cache=False):
    if cell is None:
        return None
    if not cache and cell.find("s:f", NS) is not None:
        raise EcrAuditError("formula-in-raw-input")
    value = cell.find("s:v", NS)
    kind = cell.get("t", "n")
    if cache and kind == "str" and (value is None or not value.text):
        return None  # Excel formula returning the empty string.
    if kind != "n":
        raise EcrAuditError("non-numeric-cell")
    if value is None or value.text is None:
        return None
    try:
        result = float(value.text)
    except ValueError:
        raise EcrAuditError("invalid-number") from None
    if not math.isfinite(result) or result < 0:
        raise EcrAuditError("invalid-number")
    return result


def text(cell, strings):
    if cell is None:
        return None
    if cell.find("s:f", NS) is not None:
        raise EcrAuditError("formula-in-identity")
    kind = cell.get("t", "n")
    value = cell.find("s:v", NS)
    if kind == "inlineStr":
        result = "".join(item.text or "" for item in cell.findall("s:is//s:t", NS))
    elif kind == "s":
        try:
            index = int(value.text) if value is not None else -1
            if index < 0 or index >= len(strings):
                raise ValueError()
            result = strings[index]
        except (ValueError, TypeError):
            raise EcrAuditError("invalid-shared-string") from None
    elif value is None or value.text is None:
        return None
    else:
        raise EcrAuditError("non-text-identity")
    result = result.strip()
    if len(result) > 500:
        raise EcrAuditError("identity-too-long")
    return result or None


def normalize_rows(term_cells, identity_cells, strings):
    rows = []
    groups = ["FGHIJ", "NOP", "TUV"]
    maxima = [[number(term_cells.get(f"{column}15")) for column in group] for group in groups]
    for first, identity_column in [(18, "K"), (69, "N")]:
        for offset in range(50):
            row = first + offset
            source = f"{identity_column}{11 + offset}"
            scores = [[number(term_cells.get(f"{column}{row}")) for column in group] for group in groups]
            rows.append({"rowNumber": row, "identityLocator": f"INPUT DATA!{source}",
                         "learnerKey": None, "learnerName": text(identity_cells.get(source), strings),
                         "inputs": {"written": scores[0], "performance": scores[1], "examination": scores[2],
                                    "writtenMaxima": maxima[0], "performanceMaxima": maxima[1], "examinationMaxima": maxima[2],
                                    "weights": [0.2, 0.5, 0.3]},
                         "referenceGrade": number(term_cells.get(f"AC{row}"), cache=True)})
    return rows


def normalize_archive(archive, term):
    if term not in ["TERM 1", "TERM 2", "TERM 3"]:
        raise EcrAuditError("invalid-term")
    workbook = xml(archive, "xl/workbook.xml")
    relationships = {item.get("Id"): item for item in xml(archive, "xl/_rels/workbook.xml.rels")}
    sheets = {}
    for item in workbook.findall("s:sheets/s:sheet", NS):
        relation = relationships[item.get("{" + DOC_REL + "}id")]
        target = relation.get("Target", "")
        sheets[item.get("name")] = posixpath.normpath(target.lstrip("/") if target.startswith("/") else "xl/" + target)
    strings = []
    if "xl/sharedStrings.xml" in archive.namelist():
        strings = ["".join(item.text or "" for item in entry.findall(".//s:t", NS))
                   for entry in xml(archive, "xl/sharedStrings.xml").findall("s:si", NS)]
    return normalize_rows(cells(xml(archive, sheets[term])), cells(xml(archive, sheets["INPUT DATA"])), strings)
