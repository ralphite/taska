#!/usr/bin/env python3
"""Token use and time of one Claude Code session over a time window.

The manager session (I447) uses it to record what each delegated item cost.

  python3 tools/session_usage.py <session.jsonl> [--since ISO] [--until ISO]

Times are ISO 8601 (UTC "Z" or with an offset). Prints one line:
turns, wall time, active time (gaps over 5 minutes don't count), and tokens.
"""
import argparse
import json
from datetime import datetime


def ts(s):
    return datetime.fromisoformat(s.replace('Z', '+00:00')) if s else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('jsonl')
    ap.add_argument('--since')
    ap.add_argument('--until')
    a = ap.parse_args()
    since, until = ts(a.since), ts(a.until)
    seen, times = set(), []
    tot = dict(input=0, cache_write=0, cache_read=0, output=0)
    with open(a.jsonl, errors='replace') as f:
        for line in f:
            if '"timestamp"' not in line:
                continue
            try:
                d = json.loads(line)
            except ValueError:
                continue
            t = ts(d.get('timestamp'))
            if not t or (since and t < since) or (until and t > until):
                continue
            times.append(t)
            m = d.get('message')
            if d.get('type') != 'assistant' or not isinstance(m, dict):
                continue
            u, mid = m.get('usage'), m.get('id')
            if not u or mid in seen:  # one API reply is split over several lines
                continue
            seen.add(mid)
            tot['input'] += u.get('input_tokens', 0)
            tot['cache_write'] += u.get('cache_creation_input_tokens', 0)
            tot['cache_read'] += u.get('cache_read_input_tokens', 0)
            tot['output'] += u.get('output_tokens', 0)
    times.sort()
    wall = (times[-1] - times[0]).total_seconds() if times else 0
    active = sum(min(g, 300) for g in
                 ((b - a_).total_seconds() for a_, b in zip(times, times[1:])))
    fresh = tot['input'] + tot['cache_write'] + tot['output']
    print(f"turns={len(seen)} wall={wall / 60:.0f}m active={active / 60:.0f}m "
          f"fresh={fresh:,} (in={tot['input']:,} cache_write={tot['cache_write']:,} "
          f"out={tot['output']:,}) cache_read={tot['cache_read']:,}")


if __name__ == '__main__':
    main()
