"""Start a release archive in isolation and verify the page and its bundled assets.

    python3 tools/check_package.py dist/taska.pyz

Run with the oldest supported Python to check the archive's runtime compatibility.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import re
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request


def check(package: Path) -> None:
    if not package.is_file():
        raise SystemExit(f"no release archive: {package}")
    with socket.socket() as port:
        port.bind(("127.0.0.1", 0))
        number = port.getsockname()[1]
    base = f"http://127.0.0.1:{number}"
    with tempfile.TemporaryDirectory(prefix="taska-package-") as folder:
        with open(Path(folder) / "server.log", "w+") as output:
            process = subprocess.Popen([sys.executable, str(package), "--port", str(number), "--root",
                                        str(Path(folder) / "data"), "--organizer", "off"],
                                       cwd=folder, stdout=output, stderr=subprocess.STDOUT)
            try:
                for _ in range(100):
                    if process.poll() is not None:
                        output.seek(0)
                        raise RuntimeError("release stopped: " + output.read())
                    try:
                        with urllib.request.urlopen(base + "/health", timeout=2) as response:
                            assert response.status == 200
                        break
                    except OSError:
                        time.sleep(0.1)
                else:
                    raise RuntimeError("release did not become healthy")
                with urllib.request.urlopen(base + "/", timeout=5) as response:
                    html = response.read().decode()
                assert '<div id="root"' in html, "page shell missing"
                assets = set(re.findall(r'(?:src|href)="(/assets/[^\"]+)"', html))
                assert assets, "page has no built assets"
                for asset in sorted(assets | {"/sw.js", "/manifest.webmanifest", "/icon-192.png"}):
                    with urllib.request.urlopen(base + asset, timeout=5) as response:
                        assert response.status == 200 and response.read(), f"missing asset: {asset}"
                print(f"package: Python {sys.version.split()[0]}, health, page and {len(assets) + 3} assets passed")
            finally:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=10)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package", type=Path)
    check(parser.parse_args().package.resolve())


if __name__ == "__main__":
    main()
