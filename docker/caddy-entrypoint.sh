#!/bin/sh
# Merge optional PocketBase admin virtual host into the Caddy config, then run Caddy.
# Set POCKETBASE_ADMIN_HOST (e.g. admin-careers.example.com) for HTTPS admin UI via Caddy.
# Leave unset to serve only the careers site (PocketBase admin via SSH tunnel to 127.0.0.1:8090 if published).

set -e
final=/tmp/Caddyfile.merged
cp /etc/caddy/Caddyfile "$final"

if [ -n "${POCKETBASE_ADMIN_HOST:-}" ]; then
  cat <<EOF >>"$final"

${POCKETBASE_ADMIN_HOST} {
	encode zstd gzip
	reverse_proxy pocketbase:8090 {
		header_up X-Forwarded-Proto {scheme}
		header_up X-Forwarded-Host {http.request.host}
	}
}
EOF
fi

exec caddy run --config "$final" --adapter caddyfile
