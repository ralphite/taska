#!/usr/bin/env python3
"""Watch a worker session for the manager session (I447), as a Monitor stream.

  python3 scripts/watch_worker.py <session.jsonl> <assigned-file> [stale_minutes=10] [quiet_minutes=20]

Plain code polls every 30 seconds and prints a line only when the manager has to act (I447: checks cost no
tokens, only a real event wakes the manager):
  ITEM     the item named in <assigned-file> (the last one handed out) is finished, or the worker asked or blocked on it
  STALE    silent stale_minutes in the middle of a turn: stuck on a prompt or a hung command
  QUIET    its turn ended quiet_minutes ago and none of its background commands runs: it is out of work or never reported
<assigned-file> holds "<code> <taska base url>", written by the manager when it hands out an item.
Each event is told once until something changes.
"""
import json
import os
import subprocess
import sys
import time
import urllib.request


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
        if d.get('type') in ('assistant', 'user') and isinstance(d.get('message'), dict):
            return d
    return {}


def busy(path):
    """A background command of the worker still runs: its command line names the worker's scratch folder <sid>/."""
    sid = os.path.basename(path).rsplit('.', 1)[0]
    r = subprocess.run(['pgrep', '-f', sid + '/'], capture_output=True, text=True)
    return bool(r.stdout.strip())


def item_row(assigned):
    """The item's line in /items: 'F432 P1 now doing title ?' (status 4th, a trailing ?/! = asked/blocked)."""
    try:
        code, base = open(assigned).read().split()[:2]
    except (OSError, ValueError):
        return None, None
    try:
        with urllib.request.urlopen(f'{base}/items?status=all&q={code}&limit=200', timeout=20) as r:
            rows = r.read().decode()
    except OSError:
        return code, None
    for row in rows.splitlines():
        if row.split(' ', 1)[0] == code:
            return code, row
    return code, None


def main():
    path = sys.argv[1]
    assigned = sys.argv[2]
    stale = float(sys.argv[3]) if len(sys.argv) > 3 else 10
    quiet_limit = float(sys.argv[4]) if len(sys.argv) > 4 else 20
    told = set()
    seen = None
    while True:
        mtime = os.path.getmtime(path)
        code, row = item_row(assigned)
        key = (mtime, code, row)
        if key != seen:
            seen = key
            told = {t for t in told if t.startswith('ITEM')} if row else set()
        d = last_entry(path)
        c = (d.get('message') or {}).get('content')
        kinds = [x.get('type') for x in c] if isinstance(c, list) else ['text']
        ended = d.get('type') == 'assistant' and 'tool_use' not in kinds
        quiet = (time.time() - mtime) / 60
        parts = row.split() if row else []
        doing = len(parts) > 3 and parts[3] == 'doing'
        waits = bool(parts) and parts[-1] in ('?', '!')
        events = []
        if code and row and (parts[3] in ('review', 'done', 'dropped') or waits):
            events.append(f'ITEM {row[:150]}')
        if not ended and quiet > stale:
            events.append(f'STALE silent {quiet:.0f}m mid-turn (last {d.get("timestamp")})')
        if ended and not waits and quiet > quiet_limit and not busy(path):
            events.append(f'QUIET turn ended {quiet:.0f}m ago, nothing running')
        for e in events:
            tag = e.split(' ', 1)[0] + (row or '')
            if tag not in told:
                told.add(tag)
                print(f'WORKER {e}', flush=True)
                if not e.startswith('ITEM'):
                    tell_item(assigned, code, e, d)


def tell_item(assigned, code, event, d):
    """r600: a stopped worker shows on its item at once, written by this script, so Yadong never has to ask."""
    # The words are Yadong's language, written as \u escapes (R066: no Chinese in code)
    stuck = ''
    c = (d.get('message') or {}).get('content')
    for x in c if isinstance(c, list) else []:
        if x.get('type') == 'tool_use':
            stuck = ' \u6700\u540e\u4e00\u6b65\uff1a`' + json.dumps(x.get('input'))[:120].replace('`', "'") + '`'
    mins = next((w for w in event.split() if w.endswith('m') and w[:-1].isdigit()), '?')
    if event.startswith('STALE'):  # "the worker stopped mid-step N, not moving, the manager is checking"
        what = f'\u26a0 worker \u5728\u4e00\u6b65\u4e2d\u95f4\u505c\u4e86 {mins}'
    else:  # "the worker's turn ended N ago, not reported yet"
        what = f'\u26a0 worker \u8fd9\u4e00\u8f6e\u7ed3\u675f\u4e86 {mins}\uff0c\u8fd8\u6ca1\u4ea4\u5dee'
    text = f'{code} progress {what}\uff0cmanager \u5728\u67e5\u3002{stuck}'
    try:
        base = open(assigned).read().split()[1]
        req = urllib.request.Request(f'{base}/do?by=manager-watch', data=text.encode(), method='POST')
        urllib.request.urlopen(req, timeout=20).read()
    except (OSError, IndexError):
        pass
        time.sleep(30)


if __name__ == '__main__':
    main()
