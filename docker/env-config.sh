#!/bin/sh
# Runs at container start (nginx image's /docker-entrypoint.d hook).
# Writes the runtime config the app reads, from Cloud Run env vars.
set -eu
# Accept either name, so the container works whichever one is set on Cloud Run
API_URL="${API_URL:-${VITE_API_URL:-}}"
if [ -z "${API_URL:-}" ]; then
  echo "env-config: WARNING API_URL is not set; the app will not reach the backend" >&2
fi
# Escape characters that would break the JS string
api_url=$(printf '%s' "${API_URL:-}" | sed 's/\\/\\\\/g; s/"/\\"/g')
printf 'window.__ENV__ = { API_URL: "%s" };\n' "$api_url" > /usr/share/nginx/html/env-config.js
echo "env-config: API_URL=${API_URL:-<unset>}"
