"""Local-container-only synthetic PostgreSQL concurrency checks; no runtime import."""
from pathlib import Path
import queue
import subprocess
import threading
import time
import uuid

CONTAINER = "supabase_db_project-tanaw"
ROOT = Path(__file__).resolve().parents[1]
PAYLOAD = "'[{\"key\":\"synthetic-a\",\"value\":0},{\"key\":\"synthetic-b\",\"value\":null}]'::jsonb"


def main():
    # Fixed local container, no host/URL/credential argument or environment fallback.
    schema = "tanaw_import_test_" + uuid.uuid4().hex
    sessions = []
    prefix = f"set search_path to {schema},pg_catalog; set statement_timeout='25s'; set lock_timeout='20s';\n"

    def command(name):
        return ["docker", "exec", "-i", "-e", f"PGAPPNAME={name}", CONTAINER,
                "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose",
                "-U", "postgres", "-d", "postgres"]

    def sql(statement):
        result = subprocess.run(command(schema + "_control"), input=prefix + statement,
                                text=True, capture_output=True, timeout=30)
        if result.returncode:
            raise RuntimeError("Synthetic control query failed: " + result.stderr)
        return result.stdout.strip()

    def start(name, statement, hold=False):
        process = subprocess.Popen(command(name), stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=subprocess.STDOUT, text=True, bufsize=1)
        sessions.append(process)
        lines = queue.Queue()

        def read():
            for line in process.stdout:
                lines.put(line.rstrip())
            lines.put(None)

        threading.Thread(target=read, daemon=True).start()
        process.stdin.write(prefix + "begin;\n" + statement + "\n")
        if hold:
            process.stdin.write("\\echo HOLDER_READY\n")
            process.stdin.flush()
            deadline = time.monotonic() + 30
            while True:
                line = lines.get(timeout=max(0.01, deadline - time.monotonic()))
                if line == "HOLDER_READY":
                    break
                if line is None:
                    raise RuntimeError("Holder exited before acquiring its lock")
        else:
            process.stdin.write("commit;\n")
            process.stdin.close()
        return process, lines

    def blocked(name):
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if sql(f"select count(*) from pg_stat_activity where application_name='{name}' and wait_event_type='Lock';") == "1":
                return
            time.sleep(0.1)
        raise AssertionError("Competing session never demonstrably waited for the row lock")

    def finish(session, expected_code=None):
        process, lines = session
        process.wait(timeout=30)
        output = []
        while True:
            line = lines.get(timeout=5)
            if line is None:
                break
            output.append(line)
        text = "\n".join(output)
        if expected_code:
            if process.returncode == 0 or expected_code not in text:
                raise AssertionError(f"Expected SQLSTATE {expected_code}: {text}")
        elif process.returncode:
            raise AssertionError("Synthetic session failed: " + text)
        return text

    def release(session, commit=True):
        process, _ = session
        process.stdin.write("commit;\n" if commit else "rollback;\n")
        process.stdin.close()
        finish(session)

    def snapshot(expected):
        actual = sql("select current_version,(select count(*) from import_history),"
                     "(select count(*) from import_receipts) from import_targets where id=1;")
        if actual != expected:
            raise AssertionError(f"Unexpected version/history/receipt state: {actual}")

    def reset():
        sql("delete from import_receipts; delete from import_history; "
            "update import_targets set current_version=0,active=true;")

    def call(request, stage):
        return f"select {schema}.simulate_import(1,101,{request},{stage},0,{PAYLOAD});"

    try:
        # Reuse the exact sequential fixture function, adapting only object lifetime
        # and namespace so independent backend sessions can share synthetic rows.
        fixture = (ROOT / "tests/ecr-import-transaction-local.sql").read_text()
        setup = fixture.split("create function pg_temp.import_must_deny", 1)[0]
        setup = setup.replace("begin;\n", "", 1).replace("create temp table", "create table")
        setup = setup.replace(" on commit drop", "").replace("pg_temp.", schema + ".")
        sql(f"create schema {schema};\n" + setup)

        # Two different requests at expected version 0: only the first can commit.
        holder = start(schema + "_holder", call(1, 1), hold=True)
        contender = start(schema + "_contender", call(2, 2))
        blocked(schema + "_contender")
        release(holder)
        finish(contender, "40001")
        snapshot("1|1|1")
        print("PASS competing stale writer waits then rejects without duplicate history")

        reset()
        holder = start(schema + "_holder", call(1, 1), hold=True)
        contender = start(schema + "_contender", call(1, 1))
        blocked(schema + "_contender")
        release(holder)
        if finish(contender).strip() != "1":
            raise AssertionError("Concurrent exact retry did not recover version 1")
        snapshot("1|1|1")
        print("PASS concurrent exact retry recovers one receipt")

        reset()
        holder = start(schema + "_holder", call(1, 1), hold=True)
        contender = start(schema + "_contender", call(2, 2))
        blocked(schema + "_contender")
        # EOF exits psql with an open transaction: PostgreSQL must roll it back.
        holder[0].stdin.close()
        finish(holder)
        if finish(contender).strip() != "1":
            raise AssertionError("Writer could not proceed after holder disconnect")
        snapshot("1|1|1")
        if sql("select request_id from import_history;") != "2":
            raise AssertionError("Disconnected writer left committed history")
        print("PASS client disconnect rolls back and releases the waiting writer")

        reset()
        holder = start(schema + "_holder", "update import_targets set active=false where id=1;", hold=True)
        contender = start(schema + "_contender", call(1, 1))
        blocked(schema + "_contender")
        release(holder)
        finish(contender, "42501")
        snapshot("0|0|0")
        print("PASS access revocation while waiting is rechecked before any write")
    finally:
        # Close client input so docker exec/psql can exit and release DB locks.
        try:
            for process in sessions:
                if process.stdin and not process.stdin.closed:
                    process.stdin.close()
                if process.poll() is None:
                    process.wait(timeout=30)
        finally:
            # Only backends with this run's random, exact fixture names qualify.
            sql("select pg_terminate_backend(pid) from pg_stat_activity where "
                f"application_name in ('{schema}_holder','{schema}_contender');")
            sql(f"drop schema if exists {schema} cascade;")
            if sql(f"select to_regnamespace('{schema}') is null;") != "t":
                raise AssertionError("Synthetic schema survived cleanup")
    print("PASS isolated synthetic schema removed; runtime imports unchanged")


if __name__ == "__main__":
    main()
