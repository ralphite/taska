"""Put every project's log under a data root in today's format, as Taska does once when it starts
(server/taska/services/migrate.py; each file is copied beside itself first). For a copy of the data
(tools/copy_data.py); the live Taska does this itself.

    python3 tools/migrate_data.py <data root>
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server"))

from taska.services.migrate import migrate_all  # noqa: E402


def main() -> int:
    if len(sys.argv) != 2 or not os.path.isdir(sys.argv[1]):
        print(__doc__.strip(), file=sys.stderr)
        return 2
    lines = migrate_all(os.path.abspath(sys.argv[1]))
    for line in lines:
        print(line)
    print(f"migrate: {len(lines)} projects not in today's format before")
    return int(any(": left " in line for line in lines))


if __name__ == "__main__":
    sys.exit(main())
