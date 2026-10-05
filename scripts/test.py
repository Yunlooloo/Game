#!/usr/bin/env python3
"""Run maintained Node contracts; optionally test the built page in Chromium."""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "test-results"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser", action="store_true", help="also run the real Chromium smoke test")
    parser.add_argument("--browser-only", action="store_true", help="run only Chromium smoke")
    args = parser.parse_args()
    OUT.mkdir(exist_ok=True)
    results = []
    if not args.browser_only:
        node = shutil.which("node")
        if not node:
            parser.error("Node.js 22+ is required; no npm install is necessary.")
        version = subprocess.check_output([node, "--version"], text=True).strip()
        if int(version.lstrip("v").split(".")[0]) < 22:
            parser.error("Node.js 22+ is required.")
        suites = sorted((ROOT / "tests").glob("*.test.cjs"))
        if not suites:
            parser.error("No tests/*.test.cjs suites found; refusing to report an empty run as successful.")
        for suite in suites:
            result = subprocess.run([node, str(suite)], cwd=ROOT, capture_output=True, text=True)
            log = OUT / (suite.stem + ".log")
            log.write_text(result.stdout + result.stderr, encoding="utf-8")
            passed = result.returncode == 0
            results.append({"suite": suite.name, "passed": passed, "log": str(log.relative_to(ROOT))})
            print(("PASS " if passed else "FAIL ") + suite.name, flush=True)
            if not passed:
                print(result.stdout + result.stderr, file=sys.stderr)
        (OUT / "unit-summary.json").write_text(json.dumps({"node": version, "suites": results}, indent=2) + "\n")
    if args.browser or args.browser_only:
        print("Running Chromium smoke (HTTP server starts and stops automatically).", flush=True)
        result = subprocess.run([sys.executable, str(ROOT / "tests" / "browser_smoke.py")], cwd=ROOT)
        results.append({"suite": "browser_smoke", "passed": result.returncode == 0})
    passed = sum(row["passed"] for row in results)
    print(f"{passed}/{len(results)} suites passed. Reports: test-results/", flush=True)
    return 0 if results and all(row["passed"] for row in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
