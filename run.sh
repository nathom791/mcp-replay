#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="${ROOT_DIR}/.runtime"
PID_FILE="${RUNTIME_DIR}/tauri.pid"
MODE_FILE="${RUNTIME_DIR}/tauri.mode"
LOG_FILE="${RUNTIME_DIR}/tauri.log"

mkdir -p "${RUNTIME_DIR}"

if [[ -f "${PID_FILE}" ]]; then
  EXISTING_PID="$(cat "${PID_FILE}")"
  if kill -0 "${EXISTING_PID}" 2>/dev/null; then
    echo "OpenCode Replay already running (PID ${EXISTING_PID})."
    exit 0
  fi
  rm -f "${PID_FILE}"
fi

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    cat <<'EOF' > "${RUNTIME_DIR}/pnpm"
#!/usr/bin/env bash
exec corepack pnpm "$@"
EOF
    chmod +x "${RUNTIME_DIR}/pnpm"
    export PATH="${RUNTIME_DIR}:${PATH}"
  fi
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required but was not found. Install pnpm or ensure corepack is available." >&2
  exit 1
fi

if ! command -v cargo >/dev/null 2>&1; then
  echo "cargo is required but was not found. Install Rust and re-run." >&2
  exit 1
fi

if ! cargo tauri --version >/dev/null 2>&1; then
  echo "tauri-cli is required but was not found. Install with: cargo install tauri-cli" >&2
  exit 1
fi

if ! command -v pkg-config >/dev/null 2>&1; then
  echo "pkg-config is required for Tauri on Linux. Install it and re-run." >&2
  exit 1
fi

missing_libs=()
for lib in glib-2.0 gobject-2.0 gio-2.0 gtk+-3.0 webkit2gtk-4.1; do
  if ! pkg-config --exists "${lib}"; then
    missing_libs+=("${lib}")
  fi
done

if [[ ${#missing_libs[@]} -gt 0 ]]; then
  echo "Missing system libraries for Tauri: ${missing_libs[*]}" >&2
  echo "On Ubuntu/Debian, install: sudo apt install -y libglib2.0-dev libgtk-3-dev libwebkit2gtk-4.1-dev" >&2
  exit 1
fi

if [[ ! -d "${ROOT_DIR}/node_modules" ]]; then
  echo "Installing dependencies with pnpm..."
  pnpm install
fi

MODE="group"
if ! command -v setsid >/dev/null 2>&1; then
  MODE="pid"
fi

echo "Starting OpenCode Replay..."
cd "${ROOT_DIR}/apps/gui/src-tauri"
if [[ "${MODE}" == "group" ]]; then
  setsid cargo tauri dev > "${LOG_FILE}" 2>&1 &
else
  cargo tauri dev > "${LOG_FILE}" 2>&1 &
fi
PID=$!
echo "${PID}" > "${PID_FILE}"
echo "${MODE}" > "${MODE_FILE}"

echo "OpenCode Replay started (PID ${PID})."
echo "Logs: ${LOG_FILE}"
