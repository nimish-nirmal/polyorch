#!/usr/bin/env bash
set -euo pipefail

# PolyOrch Entrypoint — Security-hardened
# - Validates environment variables
# - Sets restrictive umask
# - Creates secure temp directories
# - Forwards signals to supervisord

# Set restrictive umask
umask 077

# Validate required environment variables
: "${POLYORCH_PORT:?POLYORCH_PORT is required}"
: "${POLYORCH_DB_PATH:?POLYORCH_DB_PATH is required}"
: "${POLYORCH_NATS_URL:?POLYORCH_NATS_URL is required}"
: "${POLYORCH_RUNS_TMP_DIR:=/tmp/runs}"

# Validate port range
if ! [[ "$POLYORCH_PORT" =~ ^[0-9]+$ ]] || [ "$POLYORCH_PORT" -lt 1 ] || [ "$POLYORCH_PORT" -gt 65535 ]; then
    echo "ERROR: Invalid POLYORCH_PORT: $POLYORCH_PORT (must be 1-65535)"
    exit 1
fi

# Create secure temp directory
mkdir -p "$POLYORCH_RUNS_TMP_DIR"
chmod 700 "$POLYORCH_RUNS_TMP_DIR"

# Initialize SQLite database if it doesn't exist
if [ ! -f "$POLYORCH_DB_PATH" ]; then
    touch "$POLYORCH_DB_PATH"
    chmod 600 "$POLYORCH_DB_PATH"
fi

# Verify database permissions
if [ -f "$POLYORCH_DB_PATH" ]; then
    DB_PERMS=$(stat -c "%a" "$POLYORCH_DB_PATH" 2>/dev/null || stat -f "%Lp" "$POLYORCH_DB_PATH" 2>/dev/null || echo "000")
    if [ "$DB_PERMS" != "600" ] && [ "$DB_PERMS" != "660" ]; then
        echo "WARNING: Database file has insecure permissions ($DB_PERMS). Setting to 600."
        chmod 600 "$POLYORCH_DB_PATH"
    fi
fi

# Validate API key format if provided
if [ -n "${POLYORCH_API_KEY:-}" ]; then
    KEY_LEN=${#POLYORCH_API_KEY}
    if [ "$KEY_LEN" -lt 16 ]; then
        echo "WARNING: POLYORCH_API_KEY is too short ($KEY_LEN chars). Recommended: 32+ chars."
    fi
fi

# Signal handling for graceful shutdown
_term() {
    echo "Caught SIGTERM/SIGINT, forwarding to supervisord..."
    if [ -f /var/run/supervisord.pid ]; then
        kill -TERM "$(cat /var/run/supervisord.pid)" 2>/dev/null || true
    fi
    # Give processes time to shut down
    sleep 2
    exit 0
}

trap _term SIGTERM SIGINT

# Start supervisord
echo "Starting PolyOrch..."
echo "  Port: $POLYORCH_PORT"
echo "  Database: $POLYORCH_DB_PATH"
echo "  NATS: $POLYORCH_NATS_URL"
echo "  Temp Dir: $POLYORCH_RUNS_TMP_DIR"
echo "  API Key: $([ -n "${POLYORCH_API_KEY:-}" ] && echo '[SET]' || echo '[DISABLED]')"

exec supervisord -c /etc/supervisord.conf
