#!/usr/bin/env python3
"""Project TANAW - operating-rules audit (READ-ONLY)."""

import glob
import os
import re
import sys

TARGET = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    os.pardir,
    "docs",
    "operating-rules.md",
)

PORTS = [
    "55320",
    "55321",
    "55322",
    "55323",
    "55324",
    "55327",
    "55329",
]

HOSTED_REF = "qiqwfdmscbanetxfoqvp"
LOCAL_URL = "http://127.0.0.1:55321"
SCOPE = "Do not modify TNHS or LIKHA"

GOVERNANCE = (
    "Teacher → Subject Coordinator → School SMEA Coordinator → "
    "School Head → District MEA Coordinator"
)
AUTHORITY = "Submit → Certify → Finalize → Endorse → Approve → Lock"
EVIDENCE = (
    "Evidence → Subject MEA Packet → School MEA Packet → "
    "District MEA Packet → Division Outputs"
)

# Each recorded lesson is a required literal: once a workaround is folded into
# this document, the audit verifies it stays present, so it cannot be silently
# dropped by a later edit.
PHRASES = [
    "Missing is not zero",
    "Submitted is not approved",
    "Next.js 16",
    "node_modules/next/dist/docs/",
    "fixed non-secret values stay literal",
    "must stay synchronized with the validation it actually performs",
    # Phase 0.3: Windows dynamic port exclusions can swallow the 5532x range.
    "net stop winnat",
    # Phase 0.3: a clean CLI exit is not evidence of a reachable stack.
    "Container health is not host-port reachability",
    # Phase 0.3: CRLF must not turn a valid table into a false failure.
    "The table check is line-ending tolerant",
    # Phase 0.4: the section 11 bring-up check is now executed, not manual.
    "npm run verify:stack",
]

RESULTS = []

def record(name, ok, detail):
    RESULTS.append((name, bool(ok), detail))


def check_exists(doc):
    return os.path.exists(TARGET), "operating-rules.md exists"


def check_sections(doc):
    nums = [int(n) for n in re.findall(r"^## (\d+)\. ", doc, re.M)]
    expected = list(range(1, 15))
    if nums != expected:
        return False, "headings are %s, expected %s" % (nums, expected)
    return True, "sections 1-14 present in sequence"


def check_duplicates(doc):
    headings = re.findall(r"^## .+$", doc, re.M)
    dupes = sorted({h for h in headings if headings.count(h) > 1})
    if dupes:
        return False, "duplicate headings: %s" % dupes
    return True, "no duplicate section headings"


def check_table(doc):
    # Tolerate CRLF: a trailing \r defeats the separator regex below, which
    # would report a malformed table for a file that is otherwise correct.
    lines = [ln.rstrip("\r") for ln in doc.split("\n") if ln.strip().startswith("|")]
    if len(lines) < 3:
        return False, "table has %d rows, expected >= 3" % len(lines)
    width = lines[0].count("|")
    bad = [i for i, ln in enumerate(lines) if ln.count("|") != width]
    if bad:
        return False, "column count differs at rows %s" % bad
    if not re.match(r"^\|[\s:|-]+\|$", lines[1]):
        return False, "separator row malformed: %s" % lines[1]
    return True, "section 1 table valid (%d rows, %d cols)" % (len(lines), width - 1)


def check_temp_files(doc):
    remaining = sorted(glob.glob(os.path.join(os.path.dirname(TARGET), "_section*.tmp")))
    if remaining:
        return False, "temp files remain: %s" % [os.path.basename(p) for p in remaining]
    return True, "no docs/_section*.tmp files remain"


# Credential VALUE patterns. Policy terminology is stripped first so the
# literal pattern name `sb_secret_*` and the term `service_role` are allowed
# while a real credential value is rejected.
RE_SB_VALUE = re.compile(r"sb_secret_[A-Za-z0-9_-]{8,}")
RE_JWT = re.compile(r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}")
RE_DB_URL = re.compile(r"postgres(?:ql)?://[^\s\"\']+:[^\s\"\'@]+@")


def check_content(doc):
    literals = (
        [("port %s" % p, p) for p in PORTS]
        + [("hosted ref", HOSTED_REF), ("local url", LOCAL_URL)]
        + [
            ("governance chain", GOVERNANCE),
            ("authority sequence", AUTHORITY),
            ("evidence flow", EVIDENCE),
        ]
        + [("phrase: %s" % p, p) for p in PHRASES]
        + [("scope protection", SCOPE)]
    )
    missing = [label for label, needle in literals if needle not in doc]
    if missing:
        return False, "missing: %s" % missing
    return True, "all %d required literals present" % len(literals)


def check_secret_values(doc):
    # Remove the literal policy pattern name before scanning for real values.
    scan = doc.replace("sb_secret_*", "")

    hits = []

    if RE_SB_VALUE.search(scan):
        hits.append("sb_secret_ credential value")

    if RE_JWT.search(doc):
        hits.append("JWT-shaped value")

    if RE_DB_URL.search(doc):
        hits.append("database URL with embedded password")

    if hits:
        return False, "privileged value(s) detected: %s" % hits

    return True, "no privileged credential values; policy terminology allowed"


def read_target():
    with open(TARGET, encoding="utf-8", newline="") as fh:
        return fh.read()


def run():
    if not os.path.exists(TARGET):
        print("FAIL  operating-rules.md missing")
        return 1

    doc = read_target()

    checks = [
        ("file exists", check_exists),
        ("sections 1-14", check_sections),
        ("no duplicate headings", check_duplicates),
        ("section 1 table", check_table),
        ("required content", check_content),
        ("no privileged values", check_secret_values),
        ("no temp files", check_temp_files),
    ]

    failures = 0

    for name, fn in checks:
        ok, detail = fn(doc)
        record(name, ok, detail)
        print("%s  %s: %s" % ("PASS" if ok else "FAIL", name, detail))
        if not ok:
            failures += 1

    passed = len(checks) - failures
    print("\nTOTAL: %d PASS / %d FAIL" % (passed, failures))

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(run())
