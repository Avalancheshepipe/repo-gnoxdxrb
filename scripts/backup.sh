#!/usr/bin/env sh
# Daily Postgres backup to Beget S3.
# Usage (cron): 0 3 * * * /path/to/repo/scripts/backup.sh >> /var/log/julow-backup.log 2>&1
#
# Requires: docker compose stack running, and `aws` CLI configured with the
# Beget S3 credentials (or use mc/rclone). Reads .env from the repo root.
set -eu

cd "$(dirname "$0")/.."
set -a
. ./.env
set +a

STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="julow-${STAMP}.sql.gz"
TMP="/tmp/${FILE}"

echo "[backup] dumping database..."
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-julow}" "${POSTGRES_DB:-julow}" | gzip > "${TMP}"

echo "[backup] uploading to s3://${S3_BUCKET}/backups/${FILE}"
aws --endpoint-url "${S3_ENDPOINT}" s3 cp "${TMP}" "s3://${S3_BUCKET}/backups/${FILE}"

rm -f "${TMP}"
echo "[backup] done: ${FILE}"
