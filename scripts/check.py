#!/usr/bin/env python3
"""Dependency-free checks for build drift, authored syntax, links, and obvious secrets."""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


def check_manifest(manifest, errors):
    """The manifest is a navigation contract, not another source of game values."""
    def fail(message):
        errors.append(f"Invalid project manifest: {message}")

    def path_exists(label, value):
        if not isinstance(value, str) or not value.strip():
            fail(f"{label} must be a nonempty repository-relative path")
            return
        path = Path(value)
        target = (ROOT / path).resolve()
        if path.is_absolute() or not target.is_relative_to(ROOT):
            fail(f"{label} must stay inside the repository")
        elif not target.exists():
            fail(f"{label} points to missing path {value}")

    if not isinstance(manifest, dict):
        fail("top level must be an object")
        return
    core = (ROOT / "src/core.js").read_text(encoding="utf-8")
    version = re.search(r'\bversion:\s*"(\d+\.\d+\.\d+)"', core)
    project = manifest.get("project")
    if not isinstance(project, dict) or not version or project.get("version") != version.group(1):
        fail("project.version must match the runtime debug version in src/core.js")
    for group in ("entryPoints", "documentation"):
        rows = manifest.get(group)
        if not isinstance(rows, dict) or not rows:
            fail(f"{group} must be a nonempty object")
            continue
        for name, value in rows.items():
            path_exists(f"{group}.{name}", value)
    paths = manifest.get("importantPaths")
    if not isinstance(paths, list) or not paths:
        fail("importantPaths must be a nonempty array")
    else:
        for index, value in enumerate(paths):
            path_exists(f"importantPaths[{index}]", value)
    systems = manifest.get("systems")
    if not isinstance(systems, dict) or not systems:
        fail("systems must be a nonempty object")
        return
    for name, system in systems.items():
        if not isinstance(system, dict):
            fail(f"systems.{name} must be an object")
            continue
        if system.get("status") not in ("IMPLEMENTED", "PLANNED", "OPTIONAL"):
            fail(f"systems.{name}.status must be IMPLEMENTED, PLANNED, or OPTIONAL")
        if "source" not in system:
            fail(f"systems.{name}.source is required; use null for an unimplemented system")
        elif system["source"] is not None:
            path_exists(f"systems.{name}.source", system["source"])
        elif system.get("status") == "IMPLEMENTED":
            fail(f"systems.{name} claims IMPLEMENTED but has no source")
        path_exists(f"systems.{name}.documentation", system.get("documentation"))


def main():
    errors = []
    node = shutil.which("node")
    if not node:
        print("Node.js 22+ is required for JavaScript syntax checks.", file=sys.stderr)
        return 1
    build = subprocess.run([sys.executable, str(ROOT / "scripts/build.py"), "--check"], cwd=ROOT)
    if build.returncode:
        errors.append("index.html does not match its sources; run python3 scripts/build.py.")
    scripts = sorted((ROOT / "src").rglob("*.js")) + sorted((ROOT / "tests").rglob("*.cjs")) + sorted((ROOT / "tests/cases").glob("*.js"))
    for source in scripts:
        result = subprocess.run([node, "--check", str(source)], capture_output=True, text=True)
        if result.returncode:
            errors.append(result.stderr)
    # Compile in memory: validation must not dirty the repository with __pycache__.
    for source in sorted((ROOT / "scripts").glob("*.py")) + sorted((ROOT / "tests").glob("*.py")):
        try:
            compile(source.read_text(encoding="utf-8"), str(source), "exec")
        except SyntaxError as error:
            errors.append(str(error))
    markdown = sorted(ROOT.glob("*.md")) + sorted((ROOT / "docs").rglob("*.md"))
    link_count = 0
    for document in markdown:
        # Fenced examples may intentionally describe not-yet-created paths.
        text = re.sub(r"^```[^\n]*\n.*?^```[^\n]*$", "", document.read_text(encoding="utf-8"), flags=re.M | re.S)
        for match in re.finditer(r"\[[^\]\n]*\]\(<?([^\s)>]+)>?(?:\s+\"[^\"]*\")?\)", text):
            url = urlsplit(match.group(1))
            if url.scheme or url.netloc or not url.path:
                continue
            path = unquote(url.path)
            target = (ROOT / path.lstrip("/")) if path.startswith("/") else (document.parent / path)
            link_count += 1
            if not target.exists():
                errors.append(f"Broken local link in {document.relative_to(ROOT)}: {match.group(1)}")
    manifest = ROOT / "docs/project-manifest.json"
    if manifest.exists():
        try:
            check_manifest(json.loads(manifest.read_text(encoding="utf-8")), errors)
        except (ValueError, OSError) as error:
            errors.append(f"Invalid project manifest: {error}")
    else:
        errors.append("Missing docs/project-manifest.json")
    # Narrow warning guard, not a secret scanner or history audit. Never print a match.
    secret = re.compile(r"(?:github_pat_[A-Za-z0-9_]{40,}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)")
    files = [ROOT / "index.html", *markdown, *scripts, *sorted((ROOT / "scripts").glob("*.py"))]
    for source in files:
        if source.exists() and secret.search(source.read_text(encoding="utf-8")):
            errors.append(f"Possible credential in {source.relative_to(ROOT)}; remove it without copying it into logs.")
    diff = subprocess.run(["git", "diff", "--check"], cwd=ROOT, capture_output=True, text=True)
    if diff.returncode:
        errors.append(diff.stdout + diff.stderr)
    print(f"Checked {len(scripts)} JavaScript files and {link_count} local documentation links.")
    for error in errors:
        print(error, file=sys.stderr)
    print("Checks passed." if not errors else f"Checks failed ({len(errors)}).")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
