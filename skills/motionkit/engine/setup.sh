#!/bin/sh
# Check (and with --install, install) what the motionkit engine needs.
#   sh setup.sh            list what is present and what is missing; changes nothing
#   sh setup.sh --install  install the missing tools, then the engine's one package
# Tools: bun, ffmpeg (with ffprobe), python3, uv, and Chrome, Chromium or Edge.
E="$(cd "$(dirname "$0")" && pwd)"
export PATH="$HOME/.bun/bin:$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
INSTALL=0; [ "$1" = "--install" ] && INSTALL=1
OS="$(uname -s)"; MISSING=""
have() { command -v "$1" >/dev/null 2>&1; }
chrome() {
  [ -n "$CHROME_PATH" ] && [ -x "$CHROME_PATH" ] && return 0
  for p in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" "/Applications/Chromium.app/Contents/MacOS/Chromium" "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" /usr/bin/google-chrome /usr/bin/google-chrome-stable /usr/bin/chromium /usr/bin/chromium-browser /snap/bin/chromium; do [ -x "$p" ] && return 0; done
  return 1
}
pkgcmd() { # the real command that installs one system package here
  if [ "$OS" = "Darwin" ]; then if have brew; then echo "brew install $1"; else echo "install Homebrew from https://brew.sh first, then: brew install $1"; fi
  elif have apt-get; then echo "sudo apt-get install -y $1"
  elif have dnf; then echo "sudo dnf install -y $1"
  elif have pacman; then echo "sudo pacman -S --noconfirm $1"
  else echo "install $1 with your system's package manager"; fi
}
need() { # name, command that installs it, test that it is there
  if eval "$3"; then echo "ok       $1"; return; fi
  MISSING="$MISSING $1"
  case "$2" in
    sudo*|install*) echo "MISSING  $1    run this yourself (it needs your password or a manual step): $2" ;;
    *) if [ $INSTALL = 1 ]; then echo "install  $1: $2"; eval "$2"; if eval "$3"; then echo "ok       $1"; MISSING="${MISSING% $1}"; else echo "MISSING  $1 (install failed): $2"; fi
       else echo "MISSING  $1    to install: $2"; fi ;;
  esac
}
need bun     "curl -fsSL https://bun.sh/install | bash" "have bun"
need ffmpeg  "$(pkgcmd ffmpeg)" "have ffmpeg && have ffprobe"
need python3 "$(pkgcmd python3)" "have python3"
need uv      "curl -LsSf https://astral.sh/uv/install.sh | sh" "have uv"
if [ "$OS" = "Darwin" ]; then if have brew; then need browser "brew install --cask google-chrome" "chrome"; else need browser "install Google Chrome from https://www.google.com/chrome" "chrome"; fi
else need browser "$(pkgcmd chromium)" "chrome"; fi
if have bun; then
  if [ -d "$E/node_modules/puppeteer-core" ]; then echo "ok       engine package"
  elif [ $INSTALL = 1 ]; then (cd "$E" && bun install --silent) && echo "ok       engine package" || MISSING="$MISSING engine-package"
  else echo "MISSING  engine package    to install: (cd \"$E\" && bun install)"; MISSING="$MISSING engine-package"; fi
fi
if [ -n "$MISSING" ]; then echo; echo "Missing:$MISSING"; [ $INSTALL = 0 ] && echo "Run: sh \"$E/setup.sh\" --install"; exit 1; fi
echo; echo "Ready. Try: bun \"$E/build.ts\" hello"
