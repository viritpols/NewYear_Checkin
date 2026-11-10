#!/usr/bin/env bash
# Deploy NewYear Check-in บนเครื่องเซิร์ฟเวอร์ — pull image จาก local registry (ไม่ build บนเครื่อง)
# (กระบวนการเดียวกับ wms-frontend)
#
#   bash deploy/deploy.sh
#
# ต้องมีในโฟลเดอร์เดียวกัน:
#   docker-compose.prod.yml  (scp จาก repo)
#   .env                     ต้องมี DB_HOST DB_USER DB_PASSWORD DB_NAME QR_SECRET
#                            option: DB_PORT / APP_PORT / NEWYEAR_CHECKIN_IMAGE (pin :<sha> ได้)
#
# setup ครั้งเดียวของเครื่อง: /etc/docker/daemon.json
#   { "insecure-registries": ["192.168.20.52:5000"] }  แล้ว sudo systemctl restart docker

set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n\033[36m==> %s\033[0m\n' "$1"; }
fail() { printf '\033[31m[FAIL] %s\033[0m\n' "$1"; exit 1; }

[ -f docker-compose.prod.yml ] || fail "docker-compose.prod.yml ไม่พบ — scp จาก repo มาวางข้างโฟลเดอร์นี้ก่อน"
[ -f .env ] || fail ".env ไม่พบ (ต้องมี DB_HOST DB_USER DB_PASSWORD DB_NAME QR_SECRET)"

env_get() { grep -E "^[[:space:]]*$1[[:space:]]*=" .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '[:space:]' || true; }

# ค่า runtime ที่จำเป็น — ไม่มีแล้ว compose จะ fail อยู่ดี (บังคับด้วย :?) เช็คก่อนให้ error อ่านง่าย
for k in DB_HOST DB_USER DB_PASSWORD DB_NAME QR_SECRET; do
  [ -n "$(env_get "$k")" ] || fail "$k ไม่มีใน .env"
done
case "$(env_get QR_SECRET)" in
  *change*|*your-secret*) printf '\033[33m[WARN] QR_SECRET ยังเป็นค่าตัวอย่าง — ควรเปลี่ยนเป็น random string\033[0m\n' ;;
esac

# ลำดับ image: env ที่ส่งตอนรัน > .env > default :main
# ย้อนเวอร์ชันก่อนหน้าแบบ one-shot (ไม่ต้องแก้ .env):
#   NEWYEAR_CHECKIN_IMAGE=192.168.20.52:5000/newyear-checkin:rollback bash deploy/deploy.sh
# กลับเวอร์ชันล่าสุด: รัน bash deploy/deploy.sh ปกติ
IMAGE="$(env_get NEWYEAR_CHECKIN_IMAGE)"
export NEWYEAR_CHECKIN_IMAGE="${NEWYEAR_CHECKIN_IMAGE:-${IMAGE:-192.168.20.52:5000/newyear-checkin:main}}"
APP_PORT="$(env_get APP_PORT)"
APP_PORT="${APP_PORT:-4101}"

COMPOSE=(docker compose --env-file .env -f docker-compose.prod.yml)

step "Pull image ($NEWYEAR_CHECKIN_IMAGE)"
pull_ok=""
for attempt in 1 2 3; do
  if "${COMPOSE[@]}" pull; then pull_ok=1; break; fi
  echo "    pull ไม่สำเร็จ — ลองใหม่ครั้งที่ $attempt/3 ..."; sleep 3
done
[ -n "$pull_ok" ] || fail "pull ไม่สำเร็จ — เช็ค insecure-registries ของเครื่องนี้ + registry 192.168.20.52:5000 เปิดอยู่ไหม"

step "Up -d (pull image, ไม่ build)"
"${COMPOSE[@]}" up -d --no-build --force-recreate --remove-orphans

# /api/health ตอบ 200 เฉพาะเมื่อแอปขึ้น "และ" ต่อ DB ได้ (503 = DB ไม่ติด)
step "Health check http://localhost:$APP_PORT/api/health"
ok=""
for i in $(seq 1 20); do
  sleep 2
  if curl -fsS "http://localhost:$APP_PORT/api/health" >/dev/null 2>&1; then ok=1; break; fi
  echo "    waiting app... ($i/20)"
done
if [ -z "$ok" ]; then
  curl -sS "http://localhost:$APP_PORT/api/health" || true; echo
  "${COMPOSE[@]}" logs --tail 30 app || true
  fail "health check ไม่ผ่าน (ถ้า database: disconnected → เช็ค DB_* ใน .env) — ดู: ${COMPOSE[*]} logs"
fi

# image ที่รันมาจาก commit ไหน (label ใส่มาจาก build-push-local.sh)
REV="$(docker inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$NEWYEAR_CHECKIN_IMAGE" 2>/dev/null || echo '-')"
printf '\n\033[32m[OK] NewYear Check-in deployed — http://localhost:%s  (image commit %.7s)\033[0m\n' "$APP_PORT" "$REV"
printf 'เทียบกับ main ล่าสุด: git rev-parse origin/main (บนเครื่องที่มี repo)\n'
