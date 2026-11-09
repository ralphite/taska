#!/bin/sh
# Install or update Taska for this user, and start it. No root needed.
#
#   curl -fsSL https://github.com/ralphite/taska/releases/latest/download/install.sh | sh
#
# What it does:
#   1. finds Python 3.9 or later (Taska needs nothing else);
#   2. downloads taska.pyz from the release and checks it against taska.pyz.sha256;
#   3. puts it in ~/.local/share/taska/ with a launcher, ~/.local/bin/taska;
#   4. starts it: a systemd user service (taska.service) where there is one, otherwise in the background;
#   5. waits for http://127.0.0.1:7340/ to answer.
# Running it again updates Taska in place and restarts it. Your data stays in ~/.taska.
#
# Settings (environment variables):
#   TASKA_VERSION=v3.0.0   install that release instead of the latest
#   TASKA_NO_START=1       install or update only; do not start or restart
#   TASKA_PORT=7340        the port Taska listens on (on 127.0.0.1)
#   TASKA_LINGER=1         also run `loginctl enable-linger` so the service runs without a login session
#   TASKA_BASE_URL=...     download from here instead of GitHub (for testing a release)
#
# Optional environment for the server (GEMINI_API_KEY, TASKA_PUBLIC, ...) goes in ~/.config/taska/env,
# one NAME=value per line; the launcher reads it.

set -eu

REPO="ralphite/taska"
VERSION="${TASKA_VERSION:-}"
PORT="${TASKA_PORT:-7340}"
APP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/taska"
BIN_DIR="$HOME/.local/bin"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/taska"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
LAUNCHER="$BIN_DIR/taska"
URL="http://127.0.0.1:$PORT/"

if [ -n "${TASKA_BASE_URL:-}" ]; then
    BASE="${TASKA_BASE_URL%/}"
elif [ -n "$VERSION" ]; then
    BASE="https://github.com/$REPO/releases/download/$VERSION"
else
    BASE="https://github.com/$REPO/releases/latest/download"
fi

say() { printf '%s\n' "$*"; }
fail() { printf 'taska install: %s\n' "$*" >&2; exit 1; }

# -- what this machine has ------------------------------------------------------------

package_hint() {  # the command that installs $1 (a package name per family) on this system
    id=""
    if [ -r /etc/os-release ]; then
        # shellcheck disable=SC1091
        id=$(. /etc/os-release && printf '%s %s' "${ID:-}" "${ID_LIKE:-}")
    fi
    case "$id" in
        *debian*|*ubuntu*) say "sudo apt-get update && sudo apt-get install -y $1" ;;
        *fedora*|*rhel*|*centos*) say "sudo dnf install -y $1" ;;
        *alpine*) say "sudo apk add $1" ;;
        *arch*) say "sudo pacman -S $2" ;;
        *suse*) say "sudo zypper install -y $1" ;;
        *) if [ "$(uname -s)" = Darwin ]; then say "brew install $2"; else say "install $1 with your package manager"; fi ;;
    esac
}

find_python() {  # the first Python 3.9+ with sqlite3 and zlib (Taska's database and its one-file archive)
    for p in python3 python3.14 python3.13 python3.12 python3.11 python3.10 python3.9; do
        cmd=$(command -v "$p" 2>/dev/null) || continue
        if "$cmd" -c 'import sys, sqlite3, zlib; sys.exit(sys.version_info < (3, 9))' 2>/dev/null; then
            printf '%s' "$cmd"
            return 0
        fi
    done
    return 1
}

PY=$(find_python) || {
    found=$(command -v python3 2>/dev/null || true)
    if [ -n "$found" ]; then
        have=$("$found" -c 'import sys; print(sys.version.split()[0])' 2>/dev/null || echo "unknown")
        say "Taska needs Python 3.9 or later with sqlite3; $found is Python $have or lacks sqlite3." >&2
    else
        say "Taska needs Python 3.9 or later, and python3 is not installed." >&2
    fi
    say "Install it with:" >&2
    say "    $(package_hint python3 python)" >&2
    say "then run this installer again." >&2
    exit 1
}

if command -v curl >/dev/null 2>&1; then
    fetch() { curl -fsSL --retry 2 -o "$2" "$1"; }
    probe() { curl -fsS -o /dev/null --max-time 2 "$1" 2>/dev/null; }
elif command -v wget >/dev/null 2>&1; then
    fetch() { wget -q -O "$2" "$1"; }
    probe() { wget -q -O /dev/null -T 2 "$1" 2>/dev/null; }
else
    fail "curl or wget is needed to download Taska. Install one: $(package_hint curl curl)"
fi

# -- download and check ---------------------------------------------------------------

mkdir -p "$APP_DIR" "$BIN_DIR"
TMP=$(mktemp -d "$APP_DIR/.download.XXXXXX")
trap 'rm -rf "$TMP"' EXIT INT TERM

say "Downloading Taska from $BASE ..."
fetch "$BASE/taska.pyz" "$TMP/taska.pyz" || fail "could not download $BASE/taska.pyz"
fetch "$BASE/taska.pyz.sha256" "$TMP/taska.pyz.sha256" || fail "could not download $BASE/taska.pyz.sha256"
want=$(cut -d ' ' -f 1 < "$TMP/taska.pyz.sha256")
got=$("$PY" -c 'import hashlib, sys; print(hashlib.sha256(open(sys.argv[1], "rb").read()).hexdigest())' "$TMP/taska.pyz")
[ -n "$want" ] && [ "$want" = "$got" ] || fail "taska.pyz does not match taska.pyz.sha256 (expected $want, got $got); nothing was changed"
"$PY" "$TMP/taska.pyz" --help >/dev/null 2>&1 || fail "the downloaded taska.pyz does not run with $PY; nothing was changed"

updating=""
[ -f "$APP_DIR/taska.pyz" ] && updating=1
mv -f "$TMP/taska.pyz" "$APP_DIR/taska.pyz"
mv -f "$TMP/taska.pyz.sha256" "$APP_DIR/taska.pyz.sha256"

# The launcher: the server's settings come from ~/.config/taska/env; the public address (a proxy in front of
# Taska) from $TASKA_PUBLIC or the first line of ~/.taska/public-url, as on the macOS service.
cat > "$LAUNCHER.tmp" <<EOF
#!/bin/sh
# Taska's launcher, written by install.sh. \`taska --help\` lists the options.
[ -f "$CONFIG_DIR/env" ] && { set -a; . "$CONFIG_DIR/env"; set +a; }
PUBLIC="\${TASKA_PUBLIC:-\$(head -n 1 "\$HOME/.taska/public-url" 2>/dev/null || true)}"
if [ -n "\$PUBLIC" ]; then
    exec "$PY" "$APP_DIR/taska.pyz" --port "$PORT" --public "\$PUBLIC" "\$@"
fi
exec "$PY" "$APP_DIR/taska.pyz" --port "$PORT" "\$@"
EOF
chmod 755 "$LAUNCHER.tmp"
mv -f "$LAUNCHER.tmp" "$LAUNCHER"

if [ -n "$updating" ]; then say "Updated $APP_DIR/taska.pyz"; else say "Installed $APP_DIR/taska.pyz"; fi
say "Launcher: $LAUNCHER"
case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *) say "Note: $BIN_DIR is not on your PATH. Add it, e.g.:  echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.profile" ;;
esac

# -- start ---------------------------------------------------------------------------

has_systemd_user() {
    command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1
}

PIDFILE="$APP_DIR/taska.pid"
LOG="$APP_DIR/taska.log"

stop_background() {  # the copy this installer started earlier in the background, if it still runs
    [ -f "$PIDFILE" ] || return 0
    pid=$(cat "$PIDFILE" 2>/dev/null || true)
    rm -f "$PIDFILE"
    case "$pid" in ''|*[!0-9]*) return 0 ;; esac
    kill -0 "$pid" 2>/dev/null || return 0
    if [ -r "/proc/$pid/cmdline" ] && ! tr '\0' ' ' < "/proc/$pid/cmdline" | grep -q 'taska.pyz'; then
        return 0  # the number now belongs to another program
    fi
    say "Stopping the running Taska (pid $pid) ..."
    kill "$pid" 2>/dev/null || return 0
    i=0
    while kill -0 "$pid" 2>/dev/null && [ $i -lt 15 ]; do sleep 1; i=$((i + 1)); done
}

wait_up() {
    i=0
    while [ $i -lt 30 ]; do
        probe "${URL}health" && return 0
        sleep 1
        i=$((i + 1))
    done
    return 1
}

if [ -n "${TASKA_NO_START:-}" ]; then
    say ""
    say "Not started (TASKA_NO_START). Start it with:  $LAUNCHER"
    exit 0
fi

if has_systemd_user; then
    MODE=systemd
    mkdir -p "$UNIT_DIR"
    cat > "$UNIT_DIR/taska.service" <<EOF
[Unit]
Description=Taska, one task list for you and your coding agents
After=network-online.target

[Service]
ExecStart=$LAUNCHER serve
Restart=always
RestartSec=2

[Install]
WantedBy=default.target
EOF
    stop_background
    systemctl --user daemon-reload
    systemctl --user enable --quiet taska.service
    systemctl --user restart taska.service
    if [ -n "${TASKA_LINGER:-}" ]; then
        loginctl enable-linger "$(id -un)" && say "Linger is on: Taska runs without a login session and after a reboot."
    fi
else
    MODE=background
    stop_background
    if probe "${URL}health"; then
        fail "something already answers on $URL (another Taska?). Stop it, or install with TASKA_PORT=<other port>."
    fi
    nohup "$LAUNCHER" serve >> "$LOG" 2>&1 < /dev/null &
    echo $! > "$PIDFILE"
fi

if ! wait_up; then
    if [ "$MODE" = systemd ]; then
        say "Taska did not answer on $URL. See:  journalctl --user -u taska -n 50" >&2
    else
        say "Taska did not answer on $URL. Its log, $LOG, ends with:" >&2
        tail -n 20 "$LOG" >&2 || true
    fi
    exit 1
fi

say ""
say "Taska is running: $URL"
say ""
if [ "$MODE" = systemd ]; then
    say "It runs as the systemd user service taska.service and starts when you log in."
    [ -n "${TASKA_LINGER:-}" ] || say "To keep it running after you log out and start it at boot:  loginctl enable-linger $(id -un)"
    say "  status     systemctl --user status taska      (log: journalctl --user -u taska)"
    say "  stop       systemctl --user stop taska"
    say "  uninstall  systemctl --user disable --now taska; rm -f $UNIT_DIR/taska.service"
    say "             rm -rf $APP_DIR $LAUNCHER"
else
    say "It runs in the background (no systemd user session here); it does not start again after a reboot."
    say "  log        $LOG"
    say "  stop       kill \"\$(cat $PIDFILE)\""
    say "  start      nohup $LAUNCHER serve >> $LOG 2>&1 & echo \$! > $PIDFILE"
    say "  uninstall  stop it, then: rm -rf $APP_DIR $LAUNCHER"
fi
say "  update     run the same install command again"
say "Your data is in ~/.taska (uninstalling leaves it). Settings such as GEMINI_API_KEY go in $CONFIG_DIR/env."
say "From another machine: ssh -L $PORT:127.0.0.1:$PORT <this host>, then open $URL there."
