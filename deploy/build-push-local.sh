#!/usr/bin/env bash
# build-push-local.sh — build image "บนเครื่องในออฟฟิศ" แล้ว push เข้า local registry (LAN)
# (กระบวนการเดียวกับ wms-frontend)
#
# ── กระบวนการ ──
#   1. ทีมแก้โค้ด → PR → CI ตรวจใน GitHub → merge main
#   2. เครื่อง build:  git pull  แล้ว  bash deploy/build-push-local.sh   ← ไฟล์นี้
#   3. server:        bash deploy/deploy.sh  (pull จาก LAN + up + health check)
#
# ── setup ครั้งเดียว ──
# 1) เครื่อง registry (192.168.20.52) — มี registry:2 รันอยู่แล้ว (ตัวเดียวกับ WMS)
# 2) "ทุกเครื่อง" ที่ push/pull registry นี้ (เครื่อง build + server ทุกตัว):
#      /etc/docker/daemon.json  →  { "insecure-registries": ["192.168.20.52:5000"] }
#      sudo systemctl restart docker
#    (Docker Desktop: Settings → Docker Engine → เพิ่ม insecure-registries แล้ว Apply)
# 3) ไม่มีค่าที่ต้อง bake — DB_* / QR_SECRET อ่านจาก .env ของ server ตอนรัน
#    image จึงเป็นกลาง ใช้ได้ทุกที่
#
# ── ใช้งาน ──
#   bash deploy/build-push-local.sh                    # build โค้ดปัจจุบัน (ต้องตรง origin/main)
#   SKIP_GIT_CHECK=1 bash deploy/build-push-local.sh   # ตั้งใจ build เวอร์ชันที่ checkout อยู่
#   LOCAL_REGISTRY=192.168.20.52:5000 IMAGE_NAME=newyear-checkin ...   # override ได้

set -euo pipefail
cd "$(dirname "$0")/.."

LOCAL_REGISTRY="${LOCAL_REGISTRY:-192.168.20.52:5000}"
IMAGE_NAME="${IMAGE_NAME:-newyear-checkin}"
BRANCH="${BRANCH:-main}"

step() { printf '\n\033[36m==> %s\033[0m\n' "$1"; }
fail() { printf '\033[31m[FAIL] %s\033[0m\n' "$1"; exit 1; }

# ── [1] กัน build โค้ดเก่า: HEAD ต้องตรง origin/main ──
step "เช็คว่าโค้ดตรง origin/${BRANCH} (กัน build โค้ดเก่า)"
git fetch origin "$BRANCH" --quiet 2>/dev/null || echo "    (fetch ไม่ได้ — ใช้ข้อมูล local)"
HEAD_SHA="$(git rev-parse HEAD)"
SHORT_SHA="$(git rev-parse --short HEAD)"
BRANCH_SHA="$(git rev-parse "origin/${BRANCH}" 2>/dev/null || echo '')"
if [ "${SKIP_GIT_CHECK:-}" != "1" ] && [ -n "$BRANCH_SHA" ] && [ "$HEAD_SHA" != "$BRANCH_SHA" ]; then
  fail "HEAD (${HEAD_SHA:0:7}) ไม่ตรง origin/${BRANCH} (${BRANCH_SHA:0:7}) — รัน git pull ก่อน หรือใส่ SKIP_GIT_CHECK=1 ถ้าตั้งใจ build เวอร์ชันนี้"
fi
if [ "${SKIP_GIT_CHECK:-}" != "1" ] && [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  fail "มีไฟล์ที่แก้แต่ยังไม่ commit — image จะไม่ตรงกับ commit ${SHORT_SHA} (commit/stash ก่อน หรือใส่ SKIP_GIT_CHECK=1)"
fi
echo "    build จาก commit ${SHORT_SHA}"

IMG="${LOCAL_REGISTRY}/${IMAGE_NAME}"

# ── [2] เก็บ :main ปัจจุบันใน registry เป็น :rollback (เผื่อย้อนเวอร์ชัน) ──
# ทำ "ก่อน" push ตัวใหม่ทุกครั้ง → :rollback = เวอร์ชันที่ใช้งานอยู่ก่อนหน้าเสมอ
# ย้อนบน server:  NEWYEAR_CHECKIN_IMAGE=${IMG}:rollback bash deploy/deploy.sh
step "เก็บเวอร์ชันก่อนหน้าเป็น :rollback"
if docker pull "${IMG}:${BRANCH}" >/dev/null 2>&1; then
  PREV_REV="$(docker inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "${IMG}:${BRANCH}" 2>/dev/null || echo '')"
  docker tag "${IMG}:${BRANCH}" "${IMG}:rollback"
  docker push "${IMG}:rollback"
  echo "    :rollback = ${BRANCH} เดิม (commit ${PREV_REV:0:7})"
else
  echo "    (registry ยังไม่มี :${BRANCH} — ข้าม เช่น push ครั้งแรก)"
fi

# ── [3] build (layer cache อยู่บนเครื่องนี้ → รอบถัดไป build เร็ว) ──
step "Build ${IMG}:${BRANCH} + :${SHORT_SHA}"
DOCKER_BUILDKIT=1 docker build \
  --label "org.opencontainers.image.revision=${HEAD_SHA}" \
  --label "org.opencontainers.image.version=${BRANCH}" \
  -t "${IMG}:${BRANCH}" \
  -t "${IMG}:${SHORT_SHA}" \
  .

# ── [4] push เข้า registry LAN ──
step "Push เข้า ${LOCAL_REGISTRY}"
docker push "${IMG}:${BRANCH}"
docker push "${IMG}:${SHORT_SHA}"

printf '\n\033[32m[OK] image พร้อมใช้บน LAN\033[0m\n'
printf '  %s:%s   (commit %s)\n' "$IMG" "$BRANCH" "$SHORT_SHA"
printf '  %s:%s   (pin เวอร์ชัน)\n\n' "$IMG" "$SHORT_SHA"
printf 'บน server:\n'
printf '  bash deploy/deploy.sh\n\n'
printf 'ตรวจ image ↔ commit บน server:\n'
printf "  docker inspect --format '{{index .Config.Labels \"org.opencontainers.image.revision\"}}' %s:%s\n\n" "$IMG" "$BRANCH"
printf 'ย้อนเวอร์ชันก่อนหน้า (ถ้าตัวใหม่มีปัญหา):\n'
printf '  NEWYEAR_CHECKIN_IMAGE=%s:rollback bash deploy/deploy.sh\n' "$IMG"
