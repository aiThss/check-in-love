#!/usr/bin/env bash
set -euo pipefail

# Chay script nay tren VPS (co Docker container mongo hoac mongosh) de xuat toan bo MongoDB ra mongo-backup.json
CONTAINER_NAME="${MONGO_CONTAINER:-$(docker ps --format '{{.Names}}' | grep -i mongo | head -n 1)}"
DB_NAME="${MONGO_DB_NAME:-checkinlove}"
OUT_FILE="${1:-mongo-backup.json}"

if [ -z "$CONTAINER_NAME" ]; then
  echo "Khong tim thay container MongoDB dang chay. Hay truyen MONGO_CONTAINER=<ten_container>."
  exit 1
fi

docker exec "$CONTAINER_NAME" mongosh "$DB_NAME" --quiet --eval '
const data = {
  couples: db.couples.find().toArray(),
  users: db.users.find().toArray(),
  couplejourneys: db.couplejourneys.find().toArray(),
  checkins: db.checkins.find().toArray(),
  chatmessages: db.chatmessages.find().toArray(),
  pushsubscriptions: db.pushsubscriptions.find().toArray(),
  randomevents: db.randomevents.find().toArray(),
};
print(EJSON.stringify(data));
' > "$OUT_FILE"

echo "Da xuat xong: $OUT_FILE ($(wc -c < "$OUT_FILE") bytes)"
