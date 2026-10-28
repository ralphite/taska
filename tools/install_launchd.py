"""Render selected launchd service definitions for this checkout; never load or restart a service.

    python3 tools/install_launchd.py --label com.taska.app
    python3 tools/install_launchd.py --label com.taska.storybook-app --destination /tmp/task-services

Run launchctl separately only when installing or updating a service is intended. Existing labels are stable;
writing a plist does not change the state of the loaded job.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import plistlib
import sys

ROOT = Path(__file__).resolve().parent.parent
TEMPLATES = ROOT / "tools" / "launchd"


def main() -> None:
    labels = sorted(p.stem for p in TEMPLATES.glob("*.plist"))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--label", action="append", choices=labels, required=True)
    parser.add_argument("--destination", type=Path, default=Path.home() / "Library" / "LaunchAgents")
    args = parser.parse_args()
    destination = args.destination.expanduser().resolve()
    destination.mkdir(parents=True, exist_ok=True)
    (ROOT / ".logs").mkdir(exist_ok=True)
    for label in dict.fromkeys(args.label):
        text = (TEMPLATES / f"{label}.plist").read_text()
        for marker, value in {"__PROJECT_ROOT__": str(ROOT), "__HOME__": str(Path.home()),
                              "__PYTHON__": sys.executable}.items():
            # Paths become XML text before the plist is parsed and serialized.
            text = text.replace(marker, value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
        data = plistlib.loads(text.encode())
        target = destination / f"{label}.plist"
        temp = target.with_suffix(".tmp")
        temp.write_bytes(plistlib.dumps(data))
        os.chmod(temp, 0o644)
        temp.replace(target)
        print(target)


if __name__ == "__main__":
    main()
