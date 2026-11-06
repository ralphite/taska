"""Write the page's sample of what the server sends (T582 #6): a demo project on a fresh, empty Taska (never real
data), its view (GET /p/<project>/api/view) written into web/src/model/viewSample.ts as `... satisfies ViewAnswer`, so
the type check says when the page's types and the server's view no longer agree. Run it again after changing either.
    python3 tools/view_sample.py
"""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "web", "src", "model", "viewSample.ts")
SEED = """new bug P1 now Export ignores the active filter
  The export should keep the filter I set.
new task P2 later parent=$ Read the filter from the address
B1 doing
B1 progress Reproduced it: the export reads the list before the filter
B1 ask Which format should the export use?
  - ( ) CSV
  - ( ) Excel
B1 doc Plan
  # Plan
  First read the filter, then write the rows.
rules propose Keep the filter in every export
  add ## Exports
    - Keep the filter in every export.
"""


def main() -> None:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    base = f"http://127.0.0.1:{port}"
    root = tempfile.mkdtemp(prefix="taska-sample-")
    env = {k: v for k, v in os.environ.items() if "KEY" not in k}
    proc = subprocess.Popen([sys.executable, "-m", "taska", "serve", "--host", "127.0.0.1", "--port", str(port), "--root",
                             os.path.join(root, "data"), "--organizer", "off", "--log-db", ""], cwd=os.path.join(ROOT, "server"),
                            env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(150):
            try:
                urllib.request.urlopen(base + "/health", timeout=2)
                break
            except OSError:
                time.sleep(0.1)
        req = urllib.request.Request(base + "/api/projects", data=b'{"title": "Shop"}', headers={"Content-Type": "application/json"})
        p = base + "/p/" + json.loads(urllib.request.urlopen(req, timeout=10).read())["name"]
        urllib.request.urlopen(urllib.request.Request(p + "/do?by=claude-code", data=SEED.encode()), timeout=10).read()
        body = json.dumps({"id": "sample-input", "commands": [{"op": "input", "text": "And the sort, please.", "scope": "B1"},
                                                               {"op": "rules", "md": "## Commits\n\n- In English.", "why": "Commits"}]}).encode()
        urllib.request.urlopen(urllib.request.Request(p + "/api/commands", data=body, headers={"Content-Type": "application/json"}), timeout=10).read()
        view = json.loads(urllib.request.urlopen(p + "/api/view", timeout=10).read())
    finally:
        proc.terminate()
        proc.wait(10)
    text = json.dumps(view, ensure_ascii=True, indent=1).replace(root, "/tmp/taska-sample").replace(str(port), "7340")
    with open(OUT, "w") as f:
        f.write("// What the server sends for a project's view, from a demo project on a fresh Taska (tools/view_sample.py writes\n"
                "// it). `satisfies ViewAnswer`: the type check fails when the page's types and the server's view differ.\n\n"
                "import type { ViewAnswer } from './types'\n\n"
                f"export const VIEW_SAMPLE = {text} satisfies ViewAnswer\n")
    print("wrote", os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    main()
