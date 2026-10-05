#!/usr/bin/env python3
"""Assemble the portable source tree into the existing single-file game."""

import argparse
import base64
import hashlib
import json
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
# These labels and this order are part of the existing HTML/debug contract.
MODULES = (
    ("peerjs.js", "vendor/peerjs-1.5.5.js"),
    ("net.js", "src/net.js"),
    ("fsm.js", "src/fsm.js"),
    ("vitals.js", "src/vitals.js"),
    ("authority.js", "src/authority.js"),
    ("audio.js", "src/audio.js"),
    ("ai.js", "src/ai.js"),
    ("render.js", "src/render.js"),
    ("tutorial.js", "src/tutorial.js"),
    ("core.js", "src/core.js"),
)
TRACKS = ("ambient", "battle")
MARKERS = (
    "/* RIFT_TUTORIAL_CSS */",
    "<!-- RIFT_TUTORIAL_LAUNCH -->",
    "<!-- RIFT_TUTORIAL_UI -->",
    "<!-- RIFT_MUSIC_DATA -->",
    "<!-- RIFT_SCRIPTS -->",
)
INPUTS = (
    "src/shell.html",
    "src/tutorial-ui.css",
    "src/tutorial-ui.html",
    *(path for _, path in MODULES),
    *(f"assets/audio/music/{name}.mp3" for name in TRACKS),
)


class BuildError(Exception):
    """An incomplete or ambiguous build must not publish a partial game."""


def read_input(root, relative_path, *, binary=False):
    path = root / relative_path
    try:
        data = path.read_bytes() if binary else path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        raise BuildError(f"Cannot read input {relative_path}: {exc}") from exc
    if not data:
        raise BuildError(f"Empty input: {relative_path}")
    return data


def require_once(text, marker, source):
    count = text.count(marker)
    if count != 1:
        raise BuildError(f"{source}: expected one {marker!r}, found {count}")


def fragment(text, name):
    start, end = f"<!-- {name} START -->", f"<!-- {name} END -->"
    require_once(text, start, "src/tutorial-ui.html")
    require_once(text, end, "src/tutorial-ui.html")
    begin = text.index(start) + len(start)
    finish = text.index(end)
    if finish <= begin or not text[begin:finish].strip():
        raise BuildError(f"Invalid or empty tutorial fragment: {name}")
    return text[begin:finish]


def build(root=ROOT):
    """Return deterministic UTF-8 HTML bytes; do not touch the output file."""
    if len(set(INPUTS)) != len(INPUTS):
        raise BuildError("Duplicate paths in build inputs")
    if len({label for label, _ in MODULES}) != len(MODULES):
        raise BuildError("Duplicate module labels")
    shell = read_input(root, "src/shell.html")
    for marker in MARKERS:
        require_once(shell, marker, "src/shell.html")

    tutorial = read_input(root, "src/tutorial-ui.html")
    replacements = {
        MARKERS[0]: read_input(root, "src/tutorial-ui.css"),
        MARKERS[1]: fragment(tutorial, "LAUNCH"),
        MARKERS[2]: fragment(tutorial, "PANEL"),
    }
    tracks = {
        name: "data:audio/mpeg;base64,"
        + base64.b64encode(
            read_input(root, f"assets/audio/music/{name}.mp3", binary=True)
        ).decode("ascii")
        for name in TRACKS
    }
    replacements[MARKERS[3]] = (
        '<script type="application/json" id="rift-music-data">'
        + json.dumps(tracks, separators=(",", ":"))
        + "</script>"
    )
    scripts = []
    for label, path in MODULES:
        # HTML terminates a raw-text script case-insensitively, even when the
        # closing tag is inside a JavaScript dialogue string or comment.
        source = re.sub(
            r"</script", lambda match: "<\\/" + match.group(0)[2:],
            read_input(root, path), flags=re.IGNORECASE,
        )
        scripts.append(f"<!-- Module: {label} -->\n<script>\n{source}\n</script>")
    replacements[MARKERS[4]] = "\n".join(scripts)
    for marker, replacement in replacements.items():
        shell = shell.replace(marker, replacement)
    if any(marker in shell for marker in MARKERS):
        raise BuildError("Unresolved build marker in generated HTML")
    # Preserve the published artifact's whitespace normalization on every OS.
    return re.sub(r"(?m)^[ \t]+$", "", shell).encode("utf-8")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check", action="store_true", help="Compare output with source; never write."
    )
    parser.add_argument(
        "--output", type=Path, default=ROOT / "index.html",
        help="Output path (relative paths use the current directory). Default: repo index.html.",
    )
    args = parser.parse_args(argv)
    output = args.output.resolve()
    try:
        if output in {(ROOT / path).resolve() for path in INPUTS}:
            raise BuildError("Output must not overwrite a source input")
        data = build()
        digest = hashlib.sha256(data).hexdigest()
        if args.check:
            if not output.is_file():
                raise BuildError(f"Output missing: {output}. Run the build first.")
            if output.read_bytes() != data:
                raise BuildError(f"Output is stale: {output}. Rebuild and commit index.html.")
            action = "Verified"
        else:
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(data)
            action = "Built"
        print(f"{action} {output} ({len(data)} bytes, SHA-256 {digest})")
        return 0
    except (BuildError, OSError) as exc:
        print(f"Build failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
