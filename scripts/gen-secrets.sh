#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p secrets
for n in mysql_root_password mysql_app_password jwt_secret internal_api_key admin_password; do
  [ -f "secrets/$n" ] || openssl rand -base64 32 | tr -d '\n=+/' > "secrets/$n"
done
chmod 644 secrets/*   # non-root containers must be able to read bind-mounted secrets
echo "Generated. Admin password is in secrets/admin_password"