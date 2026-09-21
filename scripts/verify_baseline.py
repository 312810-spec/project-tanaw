#!/usr/bin/env python3
"""Project TANAW - baseline verification gate (READ-ONLY).

The checks a wave must pass before its commit:

  1. operating-rules audit   docs/operating-rules.md structure + literals
  2. secret scan             privileged values across every commit-candidate
  3. hook syntax             .claude/hooks/*.mjs parse cleanly
  4. typecheck               build readiness; --noEmit writes no artifacts
  5. git hygiene             .env.local ignored, .env.example tracked, no leftovers
  6. local stack reachability the two-part section 11 bring-up check, or SKIP

Read-only: writes no files and mutates no repository state, so it is safe to
run at any point in a wave (see docs/wave-workflow.md, step D).

Exit 0 = every check green, 1 = at least one failure.
"""

import glob
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir)
)
AUDIT = os.path.join(ROOT, "scripts", "audit_operating_rules.py")

# Leftover artifacts that must never reach a commit.
LEFTOVERS = (".tmp", ".orig", ".rej", ".swp", ".DS_Store")

# Credential VALUE patterns, mirroring .claude/hooks/secrets-guard.mjs so a
# write the hook blocks is also impossible to commit.
RE_SB_VALUE = re.compile(r"sb_secret_[A-Za-z0-9_-]{8,}")
RE_JWT = re.compile(r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}")
RE_DB_URL = re.compile(r"postgres(?:ql)?://[^\s\"']+:[^\s\"'@]+@")

FAILURES = []


def record(name, ok, detail):
    print("%s  %s: %s" % ("PASS" if ok else "FAIL", name, detail))
    if not ok:
        FAILURES.append(name)


def git(*args):
    proc = subprocess.run(
        ["git", *args], cwd=ROOT, capture_output=True, text=True
    )
    return proc.returncode, proc.stdout.strip()


def list_files(*args):
    _, out = git("ls-files", *args)
    return [f for f in out.split("\n") if f]


def read(rel):
    path = os.path.join(ROOT, *rel.split("/"))
    try:
        with open(path, encoding="utf-8", errors="replace") as handle:
            return handle.read()
    except OSError:
        return None


def check_audit():
    """The rules audit is a subprocess: its own exit code is the verdict."""
    proc = subprocess.run(
        [sys.executable, AUDIT], cwd=ROOT, capture_output=True, text=True
    )
    lines = (proc.stdout or proc.stderr).strip().splitlines()
    detail = lines[-1] if lines else "exit %s with no output" % proc.returncode
    return proc.returncode == 0, detail


def check_secrets(candidates):
    """Scan every file a commit would include for privileged credential values."""
    hits = []
    for rel in candidates:
        text = read(rel)
        if text is None:
            continue
        # Strip the literal policy pattern name so the guidance term
        # `sb_secret_*` is allowed while a real credential value is rejected.
        scan = text.replace("sb_secret_*", "")
        if RE_SB_VALUE.search(scan):
            hits.append("%s: sb_secret_ credential value" % rel)
        if RE_JWT.search(text):
            hits.append("%s: JWT-shaped value" % rel)
        if RE_DB_URL.search(text):
            hits.append("%s: database URL with embedded password" % rel)
    if hits:
        return False, "; ".join(hits)
    return True, "no privileged values in %d commit-candidate files" % len(candidates)


def check_hooks():
    if not shutil.which("node"):
        return False, "node not found on PATH; hook syntax cannot be verified"
    hooks = sorted(glob.glob(os.path.join(ROOT, ".claude", "hooks", "*.mjs")))
    if not hooks:
        return False, "no .claude/hooks/*.mjs found"
    bad = []
    for hook in hooks:
        proc = subprocess.run(
            ["node", "--check", hook], capture_output=True, text=True
        )
        if proc.returncode != 0:
            bad.append(os.path.basename(hook))
    if bad:
        return False, "syntax error in %s" % ", ".join(bad)
    return True, "%d hooks parse cleanly" % len(hooks)


def check_typecheck():
    # --no-emit, so this asserts build readiness without generating artifacts.
    proc = subprocess.run(
        "npx --no-install tsc --noEmit",
        cwd=ROOT,
        shell=True,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        first = (proc.stdout + proc.stderr).strip().splitlines()
        return False, first[0] if first else "tsc exited %s" % proc.returncode
    return True, "tsc --noEmit clean"


STACK = os.path.join(ROOT, "scripts", "verify_local_stack.py")


def check_stack():
    """operating-rules.md 11: runtime bindings AND an independent probe.

    The Phase 0.3 bring-up reported healthy containers with a clean CLI exit
    while no host port was served. Container health is not host-port
    reachability, so this check demands both halves and fails on either.

    Exit 2 means "no project containers to verify" -- a stopped stack, not a
    broken one. That is a SKIP, not a failure, so this gate stays safe to run
    on a checkout where the stack was never started.
    """
    if not shutil.which("docker"):
        return None, "docker not on PATH; skipped (no stack to verify)"
    proc = subprocess.run(
        [sys.executable, STACK], cwd=ROOT, capture_output=True, text=True
    )
    detail = (proc.stdout or proc.stderr).strip().splitlines()
    summary = [ln for ln in detail if ln.startswith(("TOTAL:", "SKIP", "FAIL"))]
    text = summary[-1] if summary else (
        detail[-1] if detail else "exit %s with no output" % proc.returncode
    )
    if proc.returncode == 2:
        return None, "skipped - %s" % text.split("  ", 1)[-1][:120]
    return proc.returncode == 0, text


def check_hygiene(untracked):
    """Policies stated in operating-rules sections 3 and 7, mechanically checked."""
    problems = []

    # operating-rules.md 7: ".env.local must remain gitignored"
    rc, _ = git("check-ignore", ".env.local")
    if rc != 0:
        problems.append(".env.local is NOT gitignored")

    # operating-rules.md 3/7: the template is a committed, client-safe file
    rc, _ = git("ls-files", "--error-unmatch", ".env.example")
    if rc != 0:
        problems.append(".env.example is NOT tracked")

    # working-tree leftovers must never ride along into a commit
    leftovers = sorted(f for f in untracked if f.endswith(LEFTOVERS))
    if leftovers:
        problems.append("leftover artifacts: %s" % ", ".join(leftovers))

    if problems:
        return False, "; ".join(problems)
    return True, ".env.local ignored, .env.example tracked, no leftover artifacts"


def main():
    print("Project TANAW - baseline verification\n")

    # Commit-candidates: tracked files plus untracked files git would not ignore.
    candidates = sorted(set(list_files()) | set(list_files("--others", "--exclude-standard")))
    untracked = list_files("--others", "--exclude-standard")

    checks = [
        ("operating-rules audit", lambda: check_audit()),
        ("secret scan", lambda: check_secrets(candidates)),
        ("hook syntax", check_hooks),
        ("typescript typecheck", check_typecheck),
        ("git hygiene", lambda: check_hygiene(untracked)),
        ("local stack reachability", check_stack),
    ]

    skipped = []
    for name, fn in checks:
        try:
            ok, detail = fn()
        except Exception as exc:  # a crashed check is a failure, never a skip
            ok, detail = False, "check raised %s: %s" % (type(exc).__name__, exc)
        if ok is None:  # an explicit SKIP: nothing to verify, not a pass
            skipped.append(name)
            print("SKIP  %s: %s" % (name, detail))
            continue
        record(name, ok, detail)

    print("\n%d untracked non-ignored file(s) in the working tree" % len(untracked))
    passed = len(checks) - len(skipped) - len(FAILURES)
    print("TOTAL: %d PASS / %d FAIL / %d SKIP"
          % (passed, len(FAILURES), len(skipped)))
    if skipped:
        print("SKIPPED (nothing to verify, not a pass): %s"
              % ", ".join(skipped))
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
