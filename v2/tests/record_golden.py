"""Record the old app's answers to every scenario as golden files.

    python3 v2/tests/record_golden.py /path/to/old/taska.py [scenario ...]

The old app runs on an empty temporary data root; ~/.taska is never read or written."""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from harness import run_scenario  # noqa: E402
from scenarios import ALL  # noqa: E402

GOLDEN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "golden")


def main() -> None:
    old = os.path.abspath(sys.argv[1])
    names = sys.argv[2:] or list(ALL)
    os.makedirs(GOLDEN, exist_ok=True)
    for name in names:
        out = run_scenario(old, ALL[name])
        with open(os.path.join(GOLDEN, name + ".json"), "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=True, indent=1)
            f.write("\n")
        print(f"{name}: {len(out)} answers")


if __name__ == "__main__":
    main()
