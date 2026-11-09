#!/bin/bash
# Prove install.sh on Linux, in Docker, before a release: the exact script, the built dist/taska.pyz.
#
#   python3 tools/release.py --skip-web      (makes dist/taska.pyz and dist/taska.pyz.sha256)
#   bash tools/test_install_linux.sh [log folder]
#
# A busybox web server on a private Docker network serves dist/ and install.sh; each Linux container (as an
# ordinary user, no root) runs `curl .../install.sh | TASKA_BASE_URL=... sh` and checks the page, /api/projects and
# an item made through the agent API on 127.0.0.1:7340 inside the container. Nothing is mapped to a host port.
# Cases: Ubuntu 24.04 (install, then update), Debian 12 (TASKA_NO_START, then a start), Alpine 3.20 (wget and
# busybox sh), no Python (the clear message), a wrong checksum (nothing changed), and a systemd user service.
unset GEMINI_API_KEY GOOGLE_API_KEY GOOGLE_GENERATIVE_AI_API_KEY  # no key goes near a container
cd "$(dirname "$0")/.." || exit 1
LOGS="${1:-$(mktemp -d)}"
mkdir -p "$LOGS"
NET=taska-install-test
FILES=taska-install-files
URL="http://$FILES:8000"
FAILED=0
CONTAINERS=()

[ -f dist/taska.pyz ] && [ -f dist/taska.pyz.sha256 ] || { echo "run tools/release.py first"; exit 1; }

cleanup() { docker rm -f "${CONTAINERS[@]}" "$FILES" >/dev/null 2>&1; docker network rm "$NET" >/dev/null 2>&1; }
trap cleanup EXIT
cleanup
docker network create "$NET" >/dev/null || exit 1
docker run -d --name "$FILES" --network "$NET" busybox:1.37 sh -c 'mkdir -p /srv/bad && httpd -f -p 8000 -h /srv' >/dev/null
docker cp dist/taska.pyz "$FILES:/srv/taska.pyz" && docker cp dist/taska.pyz.sha256 "$FILES:/srv/" \
    && docker cp install.sh "$FILES:/srv/install.sh" && docker cp dist/taska.pyz "$FILES:/srv/bad/taska.pyz" || exit 1
docker exec "$FILES" sh -c 'echo "0000000000000000000000000000000000000000000000000000000000000000  taska.pyz" > /srv/bad/taska.pyz.sha256'

result() {  # name, status (0 = passed)
    if [ "$2" -eq 0 ]; then echo "PASS  $1"; else echo "FAIL  $1  (log: $LOGS/$1.log)"; FAILED=1; fi
}

start() {  # name image [docker run options...]: a running container with an ordinary user, "tester"
    local name=$1 image=$2; shift 2
    CONTAINERS+=("$name")
    docker run -d --name "$name" --network "$NET" "$@" "$image" "${CMD[@]}" >/dev/null
}

as_tester() {  # name command...: run in the container as tester, in its home
    local name=$1; shift
    docker exec -u tester -w /home/tester -e HOME=/home/tester "${ENVS[@]}" "$name" sh -c "$*"
}

# Inside the container, with its Python: the server answers, the page is the built page, /api/projects lists the
# default project, and an item made through the agent API is listed. Prints the item lines.
CHECK='
import json, sys, urllib.request
base = "http://127.0.0.1:7340"
def get(p, data=None):
    with urllib.request.urlopen(urllib.request.Request(base + p, data=data), timeout=10) as r:
        return r.read().decode()
assert get("/health")
html = get("/")
assert "<div id=\"root\"" in html, "no page"
projects = json.loads(get("/api/projects"))
assert "default" in json.dumps(projects), projects
title = sys.argv[1]
print(get("/p/default/do?by=linux-test", ("new task P2 " + title + "\n").encode()).strip())
items = get("/p/default/items")
assert title in items, items
print("ok:", sys.version.split()[0], "| page", len(html), "bytes | projects", json.dumps(projects)[:80])
'
INSTALL="curl -fsSL $URL/install.sh | TASKA_BASE_URL=$URL sh"
WGET_INSTALL="wget -qO- $URL/install.sh | TASKA_BASE_URL=$URL sh"
CMD=(sleep infinity)
ENVS=()

# -- Ubuntu 24.04: install, check, update (a second run), the item kept --------------------------------------
{
    start ubu ubuntu:24.04
    docker exec ubu sh -c 'apt-get update -qq && apt-get install -y -qq python3 curl ca-certificates >/dev/null && useradd -m tester' \
        && as_tester ubu "$INSTALL" && as_tester ubu "python3 - 'Hello from Ubuntu' <<'EOF'
$CHECK
EOF" && first=$(as_tester ubu 'cat ~/.local/share/taska/taska.pid') \
        && as_tester ubu "$INSTALL" && second=$(as_tester ubu 'cat ~/.local/share/taska/taska.pid') \
        && [ "$first" != "$second" ] && echo "update: pid $first -> $second" \
        && as_tester ubu "python3 -c 'import urllib.request as u; t=u.urlopen(\"http://127.0.0.1:7340/p/default/items\").read().decode(); assert \"Hello from Ubuntu\" in t; print(t)'" \
        && as_tester ubu 'test -x ~/.local/bin/taska && ~/.local/bin/taska --help | head -3'
} > "$LOGS/ubuntu-24.04.log" 2>&1
result ubuntu-24.04 $?

# -- Debian 12: TASKA_NO_START installs without starting; then a normal run starts it --------------------------
{
    start deb debian:12
    docker exec deb sh -c 'apt-get update -qq && apt-get install -y -qq python3 curl ca-certificates >/dev/null && useradd -m tester' \
        && as_tester deb "curl -fsSL $URL/install.sh | TASKA_NO_START=1 TASKA_BASE_URL=$URL sh" \
        && as_tester deb 'test -x ~/.local/bin/taska && test -f ~/.local/share/taska/taska.pyz' \
        && ! as_tester deb 'curl -fsS -o /dev/null http://127.0.0.1:7340/health' && echo "not started: right" \
        && as_tester deb "$INSTALL" && as_tester deb "python3 - 'Hello from Debian' <<'EOF'
$CHECK
EOF"
} > "$LOGS/debian-12.log" 2>&1
result debian-12 $?

# -- Alpine 3.20: busybox sh and wget, no curl ----------------------------------------------------------------
{
    start alp alpine:3.20
    docker exec alp sh -c 'apk add -q python3 && adduser -D tester' \
        && as_tester alp "$WGET_INSTALL" && as_tester alp "python3 - 'Hello from Alpine' <<'EOF'
$CHECK
EOF"
} > "$LOGS/alpine-3.20.log" 2>&1
result alpine-3.20 $?

# -- No Python: Debian with curl only, Alpine with nothing added: the message names the install command --------
{
    start nopy-deb debian:12
    start nopy-alp alpine:3.20
    docker exec nopy-deb sh -c 'apt-get update -qq && apt-get install -y -qq curl ca-certificates >/dev/null && useradd -m tester' \
        && docker exec nopy-alp adduser -D tester || exit 1
    out=$(as_tester nopy-deb "$INSTALL" 2>&1); code=$?; echo "$out"; echo "exit $code"
    [ $code -ne 0 ] && echo "$out" | grep -q "sudo apt-get update && sudo apt-get install -y python3" || exit 1
    out=$(as_tester nopy-alp "$WGET_INSTALL" 2>&1); code=$?; echo "$out"; echo "exit $code"
    [ $code -ne 0 ] && echo "$out" | grep -q "sudo apk add python3" || exit 1
    ! as_tester nopy-deb 'test -e ~/.local/bin/taska'
} > "$LOGS/no-python.log" 2>&1
result no-python $?

# -- A wrong checksum: refused, nothing installed or started (in the Ubuntu container, after a fresh user) -----
{
    docker exec ubu sh -c 'useradd -m tester2' || exit 1
    out=$(docker exec -u tester2 -w /home/tester2 -e HOME=/home/tester2 ubu \
        sh -c "curl -fsSL $URL/install.sh | TASKA_PORT=7341 TASKA_BASE_URL=$URL/bad sh" 2>&1); code=$?
    echo "$out"; echo "exit $code"
    [ $code -ne 0 ] && echo "$out" | grep -q "does not match" \
        && docker exec ubu sh -c '! test -e /home/tester2/.local/share/taska/taska.pyz && ! test -e /home/tester2/.local/bin/taska'
} > "$LOGS/bad-checksum.log" 2>&1
result bad-checksum $?

# -- systemd: a user service under a real systemd (jrei/systemd-ubuntu), with linger turned on by root ----------
{
    CMD=()
    start sysd jrei/systemd-ubuntu:24.04 --privileged --cgroupns=host -v /sys/fs/cgroup:/sys/fs/cgroup:rw --tmpfs /run --tmpfs /run/lock
    for _ in $(seq 30); do docker exec sysd systemctl is-system-running 2>/dev/null | grep -qE 'running|degraded' && break; sleep 1; done
    docker exec sysd sh -c 'apt-get update -qq && apt-get install -y -qq python3 curl ca-certificates >/dev/null && useradd -m tester && loginctl enable-linger tester' || exit 1
    uid=$(docker exec sysd id -u tester)
    for _ in $(seq 30); do docker exec sysd test -S "/run/user/$uid/bus" && break; sleep 1; done
    ENVS=(-e "XDG_RUNTIME_DIR=/run/user/$uid" -e "DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$uid/bus")
    as_tester sysd "$INSTALL" && as_tester sysd 'systemctl --user is-enabled taska && systemctl --user is-active taska' \
        && as_tester sysd "python3 - 'Hello from systemd' <<'EOF'
$CHECK
EOF" && before=$(as_tester sysd 'systemctl --user show -p MainPID --value taska') \
        && as_tester sysd 'curl -fsS -X POST http://127.0.0.1:7340/api/restart' && sleep 5 \
        && after=$(as_tester sysd 'systemctl --user show -p MainPID --value taska') \
        && [ "$before" != "$after" ] && echo "restart from the page: pid $before -> $after, back by systemd" \
        && as_tester sysd "for i in $(seq 30); do curl -fsS http://127.0.0.1:7340/health && exit 0; sleep 1; done; exit 1" \
        && as_tester sysd "$INSTALL" && as_tester sysd 'systemctl --user is-active taska'
} > "$LOGS/systemd-ubuntu-24.04.log" 2>&1
result systemd-ubuntu-24.04 $?
ENVS=()

echo "logs: $LOGS"
exit $FAILED
