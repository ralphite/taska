"""Retired entry point retained so old launchd jobs fail without polling or models.

Notifications must originate from committed new-work events. This program does
not read queues, scan sessions, launch agents, retry or wait.
"""

import sys


def main() -> int:
    print("Taska's polling waker is retired. Keep com.taska.waker disabled. "
          "Use a verified event-driven message adapter; no agent was started.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
