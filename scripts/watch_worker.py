#!/usr/bin/env python3
"""Watch a worker session's transcript for the manager session (I447), as a Monitor stream.

  python3 scripts/watch_worker.py <session.jsonl> [stale_minutes=10]

Prints one line when the worker goes idle (its turn ended), and one when it has been
silent for stale_minutes in the middle of a turn (stuck on a prompt or a hung command).
Each state is told once until the worker moves again.
"""
import json
import os
import sys
import time


def last_entry(path):
    with open(path, 'rb') as f:
        f.seek(0, 2)
        f.seek(max(0, f.tell() - 200000))
        lines = f.read().decode('utf-8', 'replace').splitlines()[1:]
    for line in reversed(lines):
        try:
            d = json.loads(line)
        except ValueError:
            continue
        m = d.get('message')
        if d.get('type') in ('assistant', 'user') and isinstance(m, dict):
            return d
    return {}


def main():
    path, stale = sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else 10
    told, seen_mtime = None, None
    while True:
        mtime = os.path.getmtime(path)
        if mtime != seen_mtime:
            seen_mtime, told = mtime, None
        d = last_entry(path)
        c = (d.get('message') or {}).get('content')
        kinds = [x.get('type') for x in c] if isinstance(c, list) else ['text']
        ended = d.get('type') == 'assistant' and 'tool_use' not in kinds
        quiet = (time.time() - mtime) / 60
        state = 'IDLE' if ended and quiet > 0.5 else ('STALE' if quiet > stale else None)
        if state and state != told:
            told = state
            what = 'turn ended' if state == 'IDLE' else f'silent {quiet:.0f}m mid-turn'
            print(f'WORKER {state}: {what} (last {d.get("timestamp")})', flush=True)
        time.sleep(30)


if __name__ == '__main__':
    main()
