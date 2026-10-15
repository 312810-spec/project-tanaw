"""Private stdin-only adapter for an explicitly enabled Node preview service."""
import json
from pathlib import Path
import sys

# -I ignores user Python paths; only the deployed trusted scripts directory is used.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.ecr_co_extract import extract_co_diagnostic  # noqa: E402
from lib.ecr_fingerprint import MAX_BYTES  # noqa: E402


def main():
    try:
        if len(sys.argv) != 2 or sys.argv[1] not in ("TERM 1", "TERM 2", "TERM 3"):
            raise ValueError()
        data = sys.stdin.buffer.read(MAX_BYTES + 1)
        registry = json.loads((Path(__file__).resolve().parents[1] / "docs/ecr/source-registry.json").read_text())
        sources = [source for source in registry["sources"] if source["family"] == "co-core"]
        if len(sources) != 1:
            raise ValueError()
        result = extract_co_diagnostic(data, sys.argv[1], sources[0])
        # Never send identities, scores, raw rows or arbitrary archive errors to stdout.
        occupied = [row for row in result["rows"] if row["learnerName"] or any(
            score is not None for group in ("written", "performance", "examination") for score in row["inputs"][group])]
        print(json.dumps({"ok": True, "term": result["term"], "sourceHash": result["sourceHash"],
                          "rowSlots": len(result["rows"]), "occupiedRows": len(occupied),
                          "excludedBlankRows": len(result["rows"]) - len(occupied)}))
        return 0
    except Exception:
        # This process boundary must never emit private paths/content or a traceback.
        print(json.dumps({"ok": False, "code": "workbook-rejected"}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
