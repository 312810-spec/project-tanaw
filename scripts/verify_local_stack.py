#!/usr/bin/env python3
"""Project TANAW - local Supabase reachability gate (READ-ONLY).

Implements the verification that operating-rules section 11 requires after a
local bring-up:

  Container health is not host-port reachability. `supabase status` exits 0 and
  every container reports `healthy` while all five port-publishing containers
  carry their binding in `HostConfig.PortBindings` with no active mapping in
  `NetworkSettings.Ports` -- nothing was listening on 55321. The CLI reports
  container state, not whether the host port is actually served.

So this gate does the two things section 11 demands, and both must pass:

  1. runtime binding inspection  `docker inspect ... NetworkSettings.Ports`
  2. independent probe            a real TCP connect (and HTTP where applicable)

Neither alone is sufficient. A container can be `healthy` with a declared
`HostConfig.PortBindings` entry and still publish nothing; conversely a stale
socket on a host port is not proof the container is the one serving it.

Scope limits, stated because section 11 forbids describing a control as doing
more than it really does:

  - Only the five ports Phase 0.3 verified as runtime-published are required:
    55321 API, 55322 DB, 55323 Studio, 55324 SMTP, 55327 Analytics.
  - 55320 (shadow DB) and 55329 (pooler, disabled in config.toml) are NOT
    probed: they are not runtime-published services.
  - This gate detects a HALF-PUBLISHED stack. If no project container exists at
    all the gate SKIPs, it does not fail -- a stopped stack is a different
    condition and is not what this control is for.

Read-only: runs `docker inspect` (read-only), opens TCP sockets, and issues
GET requests that read status codes only. It writes no files and starts,
stops, restarts, or resets nothing.

`supabase status` is deliberately NOT called: it prints SECRET_KEY,
SERVICE_ROLE_KEY and the JWT to stdout, and this gate's output must stay free
of privileged values.

Exit 0 = stack reachable, 2 = skipped (no project containers), 1 = failure.
"""

import json
import os
import socket
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir)
)

PROJECT_ID = "project-tanaw"

# The runtime-published services, from operating-rules section 1 and the
# Phase 0.3 verification record. Each: (port, kind, label)
# kind "http" -> a GET must return any status; "tcp" -> a connect must open.
SERVICES = [
    (55321, "http", "API gateway (Kong)"),
    (55322, "tcp", "Postgres DB"),
    (55323, "http", "Studio"),
    (55324, "http", "SMTP / Inbucket"),
    (55327, "tcp", "Analytics"),
]

HOST = "127.0.0.1"
TIMEOUT = 5.0

FAILURES = []


def record(name, ok, detail):
    print("%s  %s: %s" % ("PASS" if ok else "FAIL", name, detail))
    if not ok:
        FAILURES.append(name)


def docker_json(*args):
    proc = subprocess.run(
        ["docker", *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if proc.returncode != 0:
        return None, (proc.stderr or proc.stdout).strip()
    try:
        return json.loads(proc.stdout), None
    except ValueError as exc:
        return None, "docker returned non-JSON: %s" % exc


def container_names():
    """All running containers whose name carries this project's id.

    Derived from project_id rather than hardcoded, so a renamed service in
    config.toml does not silently make this gate a no-op.
    """
    proc = subprocess.run(
        ["docker", "ps", "--format", "{{.Names}}"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if proc.returncode != 0:
        return None, (proc.stderr or proc.stdout).strip()
    names = [
        n.strip().lstrip("/")
        for n in proc.stdout.splitlines()
        if PROJECT_ID in n
    ]
    return sorted(names), None


def runtime_bindings(names):
    """Active host port bindings, from NetworkSettings.Ports.

    That is the runtime truth. HostConfig.PortBindings is only a declared
    intent, and it is exactly the field that stayed populated while the
    Phase 0.3 stack published nothing -- so it is deliberately not used here.
    """
    bindings = {}  # host port -> container name
    errs = []
    for name in names:
        info, err = docker_json("inspect", "--type", "container", name)
        if err:
            errs.append("%s: %s" % (name, err))
            continue
        try:
            ports = info[0]["NetworkSettings"]["Ports"] or {}
        except (IndexError, KeyError, TypeError):
            errs.append("%s: no NetworkSettings.Ports" % name)
            continue
        for container_port, host_bindings in ports.items():
            if not host_bindings:
                continue  # declared in the image, not published to the host
            for binding in host_bindings:
                host_port = binding.get("HostPort")
                if host_port:
                    bindings.setdefault(int(host_port), name)
    return bindings, errs


def probe_tcp(port):
    try:
        with socket.create_connection((HOST, port), timeout=TIMEOUT):
            return True, "connected"
    except OSError as exc:
        return False, "%s" % exc


def probe_http(port):
    url = "http://%s:%d/" % (HOST, port)
    # A corporate or system HTTP proxy would "answer" for localhost and make a
    # dead port look reachable, so bypass proxies entirely.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(url, timeout=TIMEOUT) as response:
            return True, "HTTP %s" % response.status
    except urllib.error.HTTPError as exc:
        # An error status still proves something is serving. Kong answers 404
        # at its root and Studio 307s to its own path; both are healthy.
        return True, "HTTP %s" % exc.code
    except OSError as exc:
        return False, "%s" % exc


def probe(port, kind):
    if kind == "http":
        ok, detail = probe_http(port)
        label = "GET http://%s:%d/" % (HOST, port)
    else:
        ok, detail = probe_tcp(port)
        label = "TCP connect %s:%d" % (HOST, port)
    return ok, "%s -> %s" % (label, detail if ok else "unreachable (%s)" % detail)


def main():
    print("Project TANAW - local stack reachability (read-only)\n")

    names, err = container_names()
    if err is not None:
        # Docker missing/unreachable is a skip, not a failure: this gate
        # judges a bring-up, and there is no bring-up to judge without Docker.
        print("SKIP  no project containers: docker unavailable (%s)" % err)
        print("\nThis gate detects a half-published stack; a stopped or "
              "absent stack is out of scope.")
        return 2
    if not names:
        print("SKIP  no running '%s-*' containers; nothing to verify."
              % PROJECT_ID)
        print("\nThis gate detects a half-published stack; a stopped or "
              "absent stack is out of scope.")
        return 2

    print("containers: %s\n" % ", ".join(names))

    bindings, errs = runtime_bindings(names)
    for line in errs:
        print("WARN  %s" % line)

    # Both halves of the section 11 requirement, run for every service.
    all_ok = True
    for port, kind, label in SERVICES:
        bound_by = bindings.get(port)
        record("binding %d (%s)" % (port, label), bool(bound_by),
               "published by %s" % bound_by if bound_by
               else "no active NetworkSettings.Ports mapping")
        ok, detail = probe(port, kind)
        record("probe   %d (%s)" % (port, label), ok, detail)
        all_ok = all_ok and bound_by and ok

    print("\n%d/%d services reachable on the 5532x range"
          % (sum(1 for p, _, _ in SERVICES if bindings.get(p)),
             len(SERVICES)))

    if errs and not all_ok:
        print("FAIL  binding inspection incomplete; see warnings above")

    passed = 2 * len(SERVICES) - len(FAILURES)
    print("TOTAL: %d PASS / %d FAIL" % (passed, len(FAILURES)))
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
