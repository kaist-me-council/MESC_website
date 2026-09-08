#!/usr/bin/env bash
# 사이트 전반 보강 end-to-end 점검. 사용: bash scripts/site-api.test.sh http://localhost:3132
# 전제: 서버가 ANON_SALT 를 갖고 실행 중, .env.local 에 ADMIN_USERNAME/ADMIN_PASSWORD, 로컬 dev.db.
set -euo pipefail
# ⚠ 이 스크립트는 마지막 블록에서 실제 관리자 계정을 10분간 잠근다.
#   같은 서버에서 다른 스위트(campaign-api.test.sh 등)를 이어서 돌리려면 그 스위트를 먼저 실행하거나
#   서버를 재시작해 rate-limit 버킷을 비울 것. 프로덕션 대상 실행 금지.
B=${1:?BASE URL}
py() { python3 -c "import sys,json;d=json.load(sys.stdin);$1"; }
fail() { echo "FAIL: $*"; exit 1; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
# 전역 미들웨어가 비-GET 을 IP 당 60회/분으로 제한한다. 구간마다 가짜 IP 를 달리해 버킷을 나눈다.
RIP() { echo "10.$1.$((RANDOM % 200 + 10)).$((RANDOM % 200 + 10))"; }
curl -s --retry 20 --retry-connrefused --retry-delay 1 -o /dev/null "$B/api/campaigns"

# ─────────────────────────────────────────────────────────────
# [A 구간] 과비 확인 POST 전환 · 관리자 로그인 rate limit
# ─────────────────────────────────────────────────────────────
U=$(grep '^ADMIN_USERNAME=' .env.local | cut -d= -f2- | tr -d '"')
P=$(grep '^ADMIN_PASSWORD=' .env.local | cut -d= -f2- | tr -d '"')

echo "## 과비: 구 GET 경로는 410"
RC=$(code -H "X-Forwarded-For: $(RIP 41)" "$B/api/check-fee?id=20250001")
[ "$RC" = 410 ] || fail "GET 이 410 이 아님 ($RC)"
echo "  GET 410 ok"

echo "## 과비: POST 로 조회 (학번은 본문으로만)"
FIP=$(RIP 42)
FEE=(-H "X-Forwarded-For: $FIP" -H 'Content-Type: application/json' -X POST "$B/api/check-fee")
RC=$(code "${FEE[@]}" -d '{"id":"20250001"}')
case "$RC" in
  200) curl -s "${FEE[@]}" -d '{"id":"20250001"}' \
         | py "assert set(d)<={'found','count'}, '예상 밖 필드: '+str(d); print('  POST 200 (found=%s) ok' % d['found'])" ;;
  500) echo "  POST 500 — 시트 조회 실패(CSV 미설정/네트워크). 경로 자체는 동작" ;;
  *)   fail "POST 예상 밖 응답 ($RC)" ;;
esac

echo "## 과비: 입력 검증"
RC=$(code -H "X-Forwarded-For: $(RIP 43)" -H 'Content-Type: application/json' -X POST "$B/api/check-fee" -d '{"id":"abc"}')
[ "$RC" = 400 ] || fail "형식 검증 실패 ($RC)"
RC=$(code -H "X-Forwarded-For: $(RIP 43)" -H 'Content-Type: application/json' -X POST "$B/api/check-fee" -d '{}')
[ "$RC" = 400 ] || fail "빈 학번 거부 실패 ($RC)"
echo "  400 ok"

echo "## 과비: 같은 IP 6회째 429 (분당 5회)"
LFIP=$(RIP 44)
for _ in 1 2 3 4 5; do
  code -H "X-Forwarded-For: $LFIP" -H 'Content-Type: application/json' -X POST "$B/api/check-fee" -d '{"id":"20250001"}' >/dev/null
done
RC=$(code -H "X-Forwarded-For: $LFIP" -H 'Content-Type: application/json' -X POST "$B/api/check-fee" -d '{"id":"20250001"}')
[ "$RC" = 429 ] || fail "과비 rate limit 미작동 ($RC)"
echo "  429 ok"

LOGIN() { # $1=jar $2=ip $3=user $4=pass
  local CSRF
  CSRF=$(curl -s -c "$1" -b "$1" -H "X-Forwarded-For: $2" "$B/api/auth/csrf" | py "print(d['csrfToken'])")
  code -c "$1" -b "$1" -H "X-Forwarded-For: $2" -X POST "$B/api/auth/callback/credentials" \
    --data-urlencode "csrfToken=$CSRF" --data-urlencode "username=$3" --data-urlencode "password=$4" --data-urlencode "json=true"
}
LOGGED_IN() { [ "$(code -b "$1" "$B/api/admin/campaigns")" = 200 ]; }

echo "## 로그인: 정상 계정"
JA=$(mktemp)
LOGIN "$JA" "$(RIP 45)" "$U" "$P" >/dev/null
LOGGED_IN "$JA" || fail "정상 로그인 실패"
echo "  ok"

echo "## 로그인: 틀린 비밀번호는 세션을 주지 않는다"
JB=$(mktemp)
LOGIN "$JB" "$(RIP 46)" "$U" "wrong-password-xyz" >/dev/null
LOGGED_IN "$JB" && fail "틀린 비밀번호로 로그인됨"
echo "  ok"

echo "## 로그인: 같은 IP 에서 반복 실패하면 IP 버킷(20회/10분)이 차단한다"
# 라우트 레벨 429 제한은 제거됨(성공까지 세고 초기화가 없어 관리자가 스스로 잠기던 버그).
# 이제 authorize 안에서 계정·IP 버킷으로 막고, 차단은 세션 미발급으로 나타난다.
SIP=$(RIP 47); JS=$(mktemp)
for i in $(seq 1 21); do LOGIN "$JS" "$SIP" "wrong-user-$i" "wrong-$i" >/dev/null; done
JS2=$(mktemp)
LOGIN "$JS2" "$SIP" "$U" "$P" >/dev/null
LOGGED_IN "$JS2" && fail "IP 시도 제한이 걸리지 않음"
rm -f "$JS" "$JS2"; echo "  IP 제한 ok"

echo "## 로그인: 정상 로그인은 버킷을 초기화한다 (스스로 잠기지 않음)"
RIP_OK=$(RIP 60)
for i in 1 2 3 4 5 6 7; do JR=$(mktemp); LOGIN "$JR" "$RIP_OK" "$U" "$P" >/dev/null; LOGGED_IN "$JR" || fail "정상 로그인 $i 회째가 막힘 (자기 잠금 회귀)"; rm -f "$JR"; done
echo "  연속 정상 로그인 7회 ok"

echo "## 로그인: 없는 계정은 별도 버킷 (다른 계정에 영향 없음)"
JE=$(mktemp)
LOGIN "$JE" "$(RIP 49)" "no-such-user-$RANDOM" "whatever" >/dev/null
LOGGED_IN "$JE" && fail "없는 계정으로 로그인됨"
echo "  ok"
rm -f "$JA" "$JB" "$JE"


# ─────────────────────────────────────────────────────────────
# [B 구간] 조회수 · 좋아요
# ─────────────────────────────────────────────────────────────
sqlite3 dev.db "DELETE FROM Post WHERE title LIKE 'sitetest-%'" 2>/dev/null || true
sqlite3 dev.db "INSERT INTO Post (category,title,content,authorTag,hidden,reportCount,commentCount,viewCount,likeCount,createdAt) VALUES ('자유','sitetest-open','x','익명#0000',0,0,0,0,0,datetime('now')), ('자유','sitetest-open2','x','익명#0000',0,0,0,0,0,datetime('now')), ('자유','sitetest-open3','x','익명#0000',0,0,0,0,0,datetime('now')), ('자유','sitetest-hidden','x','익명#0000',1,0,0,0,0,datetime('now'))"
P1=$(sqlite3 dev.db "SELECT id FROM Post WHERE title='sitetest-open'")
P2=$(sqlite3 dev.db "SELECT id FROM Post WHERE title='sitetest-open2'")
P3=$(sqlite3 dev.db "SELECT id FROM Post WHERE title='sitetest-open3'")
PH=$(sqlite3 dev.db "SELECT id FROM Post WHERE title='sitetest-hidden'")
VIP=$(RIP 51)
JAR=$(mktemp); trap 'rm -f "$JAR"' EXIT
V=(-c "$JAR" -b "$JAR" -H 'Content-Type: application/json' -H "X-Forwarded-For: $VIP")
# 방문자 쿠키는 /api/visitor 에서만 발급된다. 조회·좋아요는 그 뒤에 보낸다.
INIT() { curl -s -c "$1" -b "$1" -H "X-Forwarded-For: $2" -X POST "$B/api/visitor" >/dev/null; }
VIEW() { curl -s "${V[@]}" -X POST "$B/api/views" -d "{\"kind\":\"post\",\"id\":$1}"; }
COUNT() { sqlite3 dev.db "SELECT viewCount FROM Post WHERE id=$1"; }

echo "## 방문자: 조회·좋아요는 토큰을 발급하지 않는다 (병렬 최초 요청 경합 제거)"
NJ=$(mktemp); NIP=$(RIP 59)
curl -s -c "$NJ" -b "$NJ" -H 'Content-Type: application/json' -H "X-Forwarded-For: $NIP" \
  -X POST "$B/api/views" -d "{\"kind\":\"post\",\"id\":$P1}" | py "assert d.get('needsInit') is True and d['counted'] is False, d; print('  쿠키 없는 조회 needsInit ok')"
RC=$(code -c "$NJ" -b "$NJ" -H 'Content-Type: application/json' -H "X-Forwarded-For: $NIP" -X PUT "$B/api/posts/$P1/like" -d '{"liked":true}')
[ "$RC" = 409 ] || fail "쿠키 없는 좋아요가 409 가 아님 ($RC)"
grep -q mesc_vid "$NJ" && fail "조회·좋아요가 방문자 쿠키를 발급했다 (단일 발급 지점 위반)"
echo "  쿠키 없는 좋아요 409 ok · 쿠키 미발급 확인"

echo "## 방문자: 새 브라우저가 조회+좋아요를 동시에 보내도 신원은 하나"
CJ2=$(mktemp); CIP2=$(RIP 60)
INIT "$CJ2" "$CIP2"
grep -q mesc_vid "$CJ2" || fail "init 후에도 방문자 쿠키가 없다"
VID_BEFORE=$(grep mesc_vid "$CJ2" | awk '{print $NF}')
curl -s -b "$CJ2" -c "$CJ2" -H 'Content-Type: application/json' -H "X-Forwarded-For: $CIP2" \
  -X POST "$B/api/views" -d "{\"kind\":\"post\",\"id\":$P3}" >/dev/null &
curl -s -b "$CJ2" -c "$CJ2" -H 'Content-Type: application/json' -H "X-Forwarded-For: $CIP2" \
  -X PUT "$B/api/posts/$P3/like" -d '{"liked":true}' >/dev/null &
wait
VID_AFTER=$(grep mesc_vid "$CJ2" | awk '{print $NF}')
[ "$VID_BEFORE" = "$VID_AFTER" ] || fail "동시 요청이 방문자 토큰을 바꿨다"
curl -s -b "$CJ2" -H "X-Forwarded-For: $CIP2" "$B/api/posts/$P3" | py "assert d['liked'] is True, d; print('  동시 요청 후에도 좋아요가 같은 신원에 남음 ok')"
[ "$(sqlite3 dev.db "SELECT COUNT(*) FROM PostLike WHERE postId=$P3")" = 1 ] || fail "동시 요청으로 좋아요 행이 갈렸다"
# 정리
curl -s -b "$CJ2" -H 'Content-Type: application/json' -H "X-Forwarded-For: $CIP2" -X PUT "$B/api/posts/$P3/like" -d '{"liked":false}' >/dev/null
rm -f "$NJ" "$CJ2"

INIT "$JAR" "$VIP"
echo "## 조회수: 같은 방문자가 같은 글을 두 번 열면 1회만"
VIEW "$P1" | py "assert d['counted'] is True, d; print('  1회차 counted ok')"
[ "$(COUNT "$P1")" = 1 ] || fail "1회차 후 viewCount != 1 ($(COUNT "$P1"))"
VIEW "$P1" | py "assert d['counted'] is False, d; print('  2회차 중복 제거 ok')"
[ "$(COUNT "$P1")" = 1 ] || fail "2회차에 viewCount 가 늘었다 ($(COUNT "$P1"))"
grep -q mesc_vid "$JAR" || fail "방문자 쿠키가 발급되지 않음"

echo "## 조회수: 다른 글은 따로 집계"
VIEW "$P2" | py "assert d['counted'] is True, d; print('  다른 글 counted ok')"
[ "$(COUNT "$P2")" = 1 ] || fail "다른 글 집계 실패 ($(COUNT "$P2"))"
[ "$(COUNT "$P1")" = 1 ] || fail "다른 글 조회가 원래 글 카운트에 섞였다"

echo "## 조회수: 24시간 지나면 다시 센다"
sqlite3 dev.db "UPDATE ContentView SET createdAt=datetime('now','-25 hours') WHERE kind='post' AND contentId=$P1"
VIEW "$P1" | py "assert d['counted'] is True, d; print('  25시간 후 재집계 ok')"
[ "$(COUNT "$P1")" = 2 ] || fail "24시간 규칙 후 viewCount != 2 ($(COUNT "$P1"))"

echo "## 조회수: 숨김 글은 세지 않고 존재 여부도 알리지 않는다"
curl -s "${V[@]}" -X POST "$B/api/views" -d "{\"kind\":\"post\",\"id\":$PH}" | py "assert d=={'counted':False}, d; print('  숨김 글 counted:false ok')"
curl -s "${V[@]}" -X POST "$B/api/views" -d '{"kind":"post","id":99999999}' | py "assert d=={'counted':False}, d; print('  없는 글도 같은 응답 ok')"
[ "$(sqlite3 dev.db "SELECT viewCount FROM Post WHERE id=$PH")" = 0 ] || fail "숨김 글 조회수가 올랐다"

echo "## 조회수: 봇 user-agent 는 세지 않는다"
BEFORE_B=$(COUNT "$P2")
BJ=$(mktemp); BIP=$(RIP 53); INIT "$BJ" "$BIP"
curl -s -b "$BJ" -H 'Content-Type: application/json' -H "X-Forwarded-For: $BIP" -A "Mozilla/5.0 (compatible; Googlebot/2.1)" \
  -X POST "$B/api/views" -d "{\"kind\":\"post\",\"id\":$P2}" | py "assert d['counted'] is False, d; print('  봇 제외 ok')"
rm -f "$BJ"
[ "$(COUNT "$P2")" = "$BEFORE_B" ] || fail "봇 요청이 조회수를 올렸다"

echo "## 조회수: 관리자 세션은 세지 않는다"
UA=$(grep '^ADMIN_USERNAME=' .env.local | cut -d= -f2- | tr -d '"')
PA=$(grep '^ADMIN_PASSWORD=' .env.local | cut -d= -f2- | tr -d '"')
AJ=$(mktemp); AIP=$(RIP 54)
ACSRF=$(curl -s -c "$AJ" -b "$AJ" -H "X-Forwarded-For: $AIP" "$B/api/auth/csrf" | py "print(d['csrfToken'])")
curl -s -o /dev/null -c "$AJ" -b "$AJ" -H "X-Forwarded-For: $AIP" -X POST "$B/api/auth/callback/credentials" \
  --data-urlencode "csrfToken=$ACSRF" --data-urlencode "username=$UA" --data-urlencode "password=$PA" --data-urlencode "json=true"
BEFORE_A=$(COUNT "$P2")
INIT "$AJ" "$AIP"
curl -s -b "$AJ" -H 'Content-Type: application/json' -H "X-Forwarded-For: $AIP" \
  -X POST "$B/api/views" -d "{\"kind\":\"post\",\"id\":$P2}" | py "assert d['counted'] is False, d; print('  관리자 제외 ok')"
[ "$(COUNT "$P2")" = "$BEFORE_A" ] || fail "관리자 조회가 조회수를 올렸다"
rm -f "$AJ"

echo "## 조회수: 쿠키 없이도 본문은 열린다"
RC=$(code "$B/api/posts/$P1"); [ "$RC" = 200 ] || fail "쿠키 없는 본문 조회 실패 ($RC)"

echo "## 좋아요: 목표 상태 지정, 켜고 끄면 원상복구"
LIP=$(RIP 52)
LJ=$(mktemp)
L=(-c "$LJ" -b "$LJ" -H 'Content-Type: application/json' -H "X-Forwarded-For: $LIP")
INIT "$LJ" "$LIP"
LIKE() { curl -s "${L[@]}" -X PUT "$B/api/posts/$P1/like" -d "{\"liked\":$1}"; }
LIKE true | py "assert d['liked'] is True and d['likeCount']==1, d; print('  좋아요 ok')"
curl -s "${L[@]}" "$B/api/posts/$P1" | py "assert d['liked'] is True and d['likeCount']==1, d; print('  GET liked 반영 ok')"

echo "## 좋아요: 같은 목표 상태를 반복해도 집계가 변하지 않는다 (응답 유실 후 재시도)"
LIKE true | py "assert d['liked'] is True and d['likeCount']==1, d; print('  true 반복 ok')"
LIKE true | py "assert d['liked'] is True and d['likeCount']==1, d; print('  true 3회째도 동일 ok')"
[ "$(sqlite3 dev.db "SELECT COUNT(*) FROM PostLike WHERE postId=$P1")" = 1 ] || fail "true 반복으로 행이 늘었다"

echo "## 좋아요: 같은 목표 상태를 병렬로 보내도 결과가 같다"
LIKE true >/dev/null & LIKE true >/dev/null & wait
[ "$(sqlite3 dev.db "SELECT likeCount FROM Post WHERE id=$P1")" = 1 ] || fail "병렬 동일 목표로 집계가 흔들렸다 ($(sqlite3 dev.db "SELECT likeCount FROM Post WHERE id=$P1"))"
[ "$(sqlite3 dev.db "SELECT COUNT(*) FROM PostLike WHERE postId=$P1")" = 1 ] || fail "병렬 동일 목표로 행이 늘었다"
echo "  병렬 동일 목표 ok"

echo "## 좋아요: 반대 목표 상태로 취소, 반복해도 음수가 되지 않는다"
LIKE false | py "assert d['liked'] is False and d['likeCount']==0, d; print('  취소 ok')"
LIKE false | py "assert d['liked'] is False and d['likeCount']==0, d; print('  false 반복 ok')"
[ "$(sqlite3 dev.db "SELECT COUNT(*) FROM PostLike WHERE postId=$P1")" = 0 ] || fail "취소 후 PostLike 행이 남았다"
[ "$(sqlite3 dev.db "SELECT likeCount FROM Post WHERE id=$P1")" = 0 ] || fail "취소 후 likeCount != 0"

echo "## 좋아요: 입력 검증과 구 토글 POST"
RC=$(code "${L[@]}" -X PUT "$B/api/posts/$P1/like" -d '{}'); [ "$RC" = 400 ] || fail "liked 누락이 400 이 아님 ($RC)"
RC=$(code "${L[@]}" -X POST "$B/api/posts/$P1/like"); [ "$RC" = 409 ] || fail "구 POST 가 409(새로고침 안내) 가 아님 ($RC)"
echo "  liked 누락 400 · 구 POST 409 ok"

echo "## 좋아요: 숨김 글은 404"
RC=$(code "${L[@]}" -X PUT "$B/api/posts/$PH/like" -d '{"liked":true}'); [ "$RC" = 404 ] || fail "숨김 글 좋아요가 404 가 아님 ($RC)"

rm -f "$LJ"
sqlite3 dev.db "DELETE FROM Post WHERE title LIKE 'sitetest-%'"
# ─────────────────────────────────────────────────────────────
# [D 구간] 푸시 구독 (실제 발송은 푸시 서비스가 필요해 검증하지 않는다)
# ─────────────────────────────────────────────────────────────
PIP=$(RIP 52)
PS=(-H "X-Forwarded-For: $PIP" -H 'Content-Type: application/json')
EP="https://fcm.googleapis.com/fcm/send/sitetest-$RANDOM"

echo "## 푸시: 형식이 틀린 구독은 거부"
RC=$(code "${PS[@]}" -X POST "$B/api/push/subscribe" -d '{"endpoint":"http://insecure.example/x","keys":{"p256dh":"a","auth":"b"}}')
[ "$RC" = 400 ] || fail "http endpoint 를 받아들임 ($RC)"
RC=$(code "${PS[@]}" -X POST "$B/api/push/subscribe" -d "{\"endpoint\":\"$EP\"}")
[ "$RC" = 400 ] || fail "keys 없는 구독을 받아들임 ($RC)"
echo "  400 ok"

echo "## 푸시: 구독 등록"
curl -s "${PS[@]}" -X POST "$B/api/push/subscribe" -d "{\"endpoint\":\"$EP\",\"keys\":{\"p256dh\":\"test-p256dh\",\"auth\":\"test-auth\"}}" | py "assert d['ok'] is True, d; print('  등록 ok')"
[ "$(sqlite3 dev.db "SELECT COUNT(*) FROM PushSubscription WHERE endpoint='$EP'")" = 1 ] || fail "구독 행이 생기지 않음"

echo "## 푸시: 같은 endpoint 재등록은 행을 늘리지 않는다"
curl -s "${PS[@]}" -X POST "$B/api/push/subscribe" -d "{\"endpoint\":\"$EP\",\"keys\":{\"p256dh\":\"test-p256dh-2\",\"auth\":\"test-auth-2\"}}" >/dev/null
[ "$(sqlite3 dev.db "SELECT COUNT(*) FROM PushSubscription WHERE endpoint='$EP'")" = 1 ] || fail "재등록이 중복 행을 만듦"
[ "$(sqlite3 dev.db "SELECT p256dh FROM PushSubscription WHERE endpoint='$EP'")" = "test-p256dh-2" ] || fail "재등록이 키를 갱신하지 않음"
echo "  멱등 ok"

echo "## 푸시: 구독 해제"
curl -s "${PS[@]}" -X DELETE "$B/api/push/subscribe" -d "{\"endpoint\":\"$EP\"}" | py "assert d['removed']==1, d; print('  해제 ok')"
[ "$(sqlite3 dev.db "SELECT COUNT(*) FROM PushSubscription WHERE endpoint='$EP'")" = 0 ] || fail "해제 후에도 행이 남음"

echo "## 푸시: 테스트 발송은 로그인 필요"
RC=$(code -X POST -H "X-Forwarded-For: $PIP" "$B/api/admin/push/test")
[ "$RC" = 401 ] || fail "비로그인 테스트 발송이 401 이 아님 ($RC)"
echo "  401 ok"

echo "## 푸시: 발송 결과가 미설정·구독자없음·부분실패를 구분한다 (P2)"
# 로그인 세션 (푸시 결과 확인용, 다른 구간과 겹치지 않는 IP 버킷)
PJ=$(mktemp); PIP2=$(RIP 53)
PCSRF=$(curl -s -c "$PJ" -b "$PJ" -H "X-Forwarded-For: $PIP2" "$B/api/auth/csrf" | py "print(d['csrfToken'])")
curl -s -o /dev/null -c "$PJ" -b "$PJ" -H "X-Forwarded-For: $PIP2" -X POST "$B/api/auth/callback/credentials" \
  --data-urlencode "csrfToken=$PCSRF" --data-urlencode "username=$U" --data-urlencode "password=$P" --data-urlencode "json=true"
PA=(-b "$PJ" -H "X-Forwarded-For: $PIP2")

# 구독이 하나도 없을 때: 정상 0건 → no_subscribers (예전에는 실패와 구분되지 않았다)
sqlite3 dev.db "DELETE FROM PushSubscription WHERE endpoint LIKE '%sitetest-%'"
BEFORE_SUBS=$(sqlite3 dev.db "SELECT COUNT(*) FROM PushSubscription")
if [ "$BEFORE_SUBS" = 0 ]; then
  curl -s "${PA[@]}" -X POST "$B/api/admin/push/test" \
    | py "assert d.get('status') in ('no_subscribers','not_configured'), d; assert d.get('sent')==0, d; print('  구독자 없음/미설정 구분 ok (' + d['status'] + ')')"
else
  echo "  건너뜀 (다른 구독 $BEFORE_SUBS 건 존재)"
fi

# 없는 공지에 알림 → 404 (발송 결과와 섞이지 않는다)
RC=$(code "${PA[@]}" -X POST "$B/api/notices/99999999/notify")
[ "$RC" = 404 ] || fail "없는 공지 알림이 404 가 아님 ($RC)"
echo "  없는 공지 404 ok"

echo "## 푸시: 알림 실패가 공지 저장을 실패로 만들지 않는다 (P2)"
NID=$(curl -s "${PA[@]}" -H 'Content-Type: application/json' -X POST "$B/api/notices" \
  -d '{"title":"sitetest-notify","content":"sitetest","category":"공지","notify":true}' \
  | py "assert d.get('id'), d; assert 'notified' in d, '저장·발송 결과가 분리되지 않음: ' + str(d); print(d['id'])")
[ "$(sqlite3 dev.db "SELECT COUNT(*) FROM Notice WHERE title='sitetest-notify'")" = 1 ] || fail "알림 발송 후 공지가 1건이 아님"
echo "  공지 1건 저장 + notified 필드 분리 ok"

# 재시도는 공지를 다시 만들지 않고 알림만 다시 보낸다
curl -s -o /dev/null "${PA[@]}" -X POST "$B/api/notices/$NID/notify"
[ "$(sqlite3 dev.db "SELECT COUNT(*) FROM Notice WHERE title='sitetest-notify'")" = 1 ] || fail "알림 재시도가 공지를 새로 만듦"
echo "  알림 재시도가 공지를 복제하지 않음 ok"
sqlite3 dev.db "DELETE FROM Notice WHERE title='sitetest-notify'"
rm -f "$PJ"

sqlite3 dev.db "DELETE FROM PushSubscription WHERE endpoint LIKE '%sitetest-%'"

# ─────────────────────────────────────────────────────────────
# [C 구간] 공지 첨부파일
# ─────────────────────────────────────────────────────────────
CIP=$(RIP 55)
CJ=$(mktemp)
CCSRF=$(curl -s -c "$CJ" -b "$CJ" -H "X-Forwarded-For: $CIP" "$B/api/auth/csrf" | py "print(d['csrfToken'])")
curl -s -o /dev/null -c "$CJ" -b "$CJ" -H "X-Forwarded-For: $CIP" -X POST "$B/api/auth/callback/credentials" \
  --data-urlencode "csrfToken=$CCSRF" --data-urlencode "username=$U" --data-urlencode "password=$P" --data-urlencode "json=true"
CA=(-b "$CJ" -H "X-Forwarded-For: $CIP")
CJSON=("${CA[@]}" -H 'Content-Type: application/json')
TMPD=$(mktemp -d)

# 파일은 브라우저 → 우리 서버 → 구글 드라이브 순서로 3MB 씩 올라간다.
# (브라우저→구글 직접 PUT 은 사전 요청이 막히고, 서버 함수 본문은 4.5MB 로 제한된다)

echo "## 첨부: drive-begin 은 비로그인 거부"
RC=$(code -H "X-Forwarded-For: $(RIP 56)" -H 'Content-Type: application/json' -X POST "$B/api/admin/upload-file/drive-begin" -d '{"name":"a.pdf","size":100}')
[ "$RC" = 401 ] || fail "비로그인 drive-begin 이 401 이 아님 ($RC)"
echo "  begin 비로그인 401 ok"

echo "## 첨부: drive-begin 은 허용되지 않는 확장자를 거부"
RC=$(code "${CJSON[@]}" -X POST "$B/api/admin/upload-file/drive-begin" -d '{"name":"a.exe","size":100}')
[ "$RC" = 400 ] || fail ".exe 가 begin 을 통과함 ($RC)"
echo "  .exe 거부 ok"

echo "## 첨부: drive-begin 은 30MB 초과를 거부"
RC=$(code "${CJSON[@]}" -X POST "$B/api/admin/upload-file/drive-begin" -d '{"name":"a.pdf","size":31457281}')
[ "$RC" = 400 ] || fail "30MB 초과가 begin 을 통과함 ($RC)"
echo "  용량 초과 거부 ok"

echo "## 첨부: drive-begin 은 빈 파일을 거부"
RC=$(code "${CJSON[@]}" -X POST "$B/api/admin/upload-file/drive-begin" -d '{"name":"a.pdf","size":0}')
[ "$RC" = 400 ] || fail "빈 파일이 begin 을 통과함 ($RC)"
echo "  빈 파일 거부 ok"

echo "## 첨부: drive-chunk 는 비로그인 거부"
RC=$(code -H "X-Forwarded-For: $(RIP 59)" -H 'Content-Type: application/octet-stream' \
  -H 'x-upload-id: x.y' -H 'x-chunk-start: 0' -H 'x-total-size: 10' \
  -X POST "$B/api/admin/upload-file/drive-chunk" --data-binary 'hello')
[ "$RC" = 401 ] || fail "비로그인 drive-chunk 가 401 이 아님 ($RC)"
echo "  chunk 비로그인 401 ok"

echo "## 첨부: drive-chunk 는 위조된 uploadId 를 거부"
RC=$(code "${CA[@]}" -H 'Content-Type: application/octet-stream' \
  -H 'x-upload-id: eyJ1IjoiaHR0cHM6Ly9ldmlsLmV4YW1wbGUuY29tLyJ9.forged' -H 'x-chunk-start: 0' -H 'x-total-size: 5' \
  -X POST "$B/api/admin/upload-file/drive-chunk" --data-binary 'hello')
[ "$RC" = 400 ] || fail "위조된 uploadId 가 통과함 ($RC)"
echo "  위조 uploadId 거부 ok"

echo "## 첨부: drive-chunk 는 3MB 초과 청크를 거부"
head -c 3200000 /dev/zero > "$TMPD/big.chunk"
RC=$(code "${CA[@]}" -H 'Content-Type: application/octet-stream' \
  -H 'x-upload-id: eyJ1IjoiaHR0cHM6Ly9ldmlsLmV4YW1wbGUuY29tLyJ9.forged' -H 'x-chunk-start: 0' -H 'x-total-size: 3200000' \
  -X POST "$B/api/admin/upload-file/drive-chunk" --data-binary "@$TMPD/big.chunk")
# 위조 검증이 먼저 걸리므로 400. 크기 상한은 단위 테스트가 함께 지킨다.
[ "$RC" = 400 ] || [ "$RC" = 413 ] || fail "3MB 초과 청크가 통과함 ($RC)"
echo "  대형 청크 거부 ok ($RC)"

echo "## 첨부: 폴백(blob) 은 비로그인 거부"
RC=$(code -H "X-Forwarded-For: $(RIP 60)" -X POST "$B/api/admin/upload-file/blob" -F "file=@$TMPD/big.chunk")
[ "$RC" = 401 ] || fail "비로그인 폴백 업로드가 401 이 아님 ($RC)"
echo "  폴백 비로그인 401 ok"

echo "## 첨부: verify 는 비로그인 거부"
RC=$(code -H "X-Forwarded-For: $(RIP 57)" -H 'Content-Type: application/json' -X POST "$B/api/admin/upload-file/verify" \
  -d '{"url":"https://test.public.blob.vercel-storage.com/notices/a.pdf","name":"a.pdf","size":10}')
[ "$RC" = 401 ] || fail "비로그인 verify 가 401 이 아님 ($RC)"
echo "  verify 비로그인 401 ok"

echo "## 첨부: verify 는 우리 저장소 밖 URL 을 거부"
RC=$(code "${CJSON[@]}" -X POST "$B/api/admin/upload-file/verify" -d '{"url":"https://evil.example.com/x.pdf","name":"x.pdf","size":10}')
[ "$RC" = 400 ] || fail "외부 URL 이 verify 를 통과함 ($RC)"
echo "  외부 URL 거부 ok"

echo "## 첨부: verify 는 30MB 초과를 거부"
RC=$(code "${CJSON[@]}" -X POST "$B/api/admin/upload-file/verify" -d '{"url":"https://test.public.blob.vercel-storage.com/notices/a.pdf","name":"a.pdf","size":31457281}')
[ "$RC" = 400 ] || fail "30MB 초과가 verify 를 통과함 ($RC)"
echo "  용량 초과 거부 ok"

echo "## 첨부: verify 는 허용되지 않는 확장자를 거부"
RC=$(code "${CJSON[@]}" -X POST "$B/api/admin/upload-file/verify" -d '{"url":"https://test.public.blob.vercel-storage.com/notices/a.exe","name":"a.exe","size":10}')
[ "$RC" = 400 ] || fail ".exe 가 verify 를 통과함 ($RC)"
echo "  확장자 거부 ok"

# 드라이브 직접 업로드(브라우저→구글) 케이스는 제거됐다.
# 브라우저의 사전 요청이 통과하지 못해 실사용에서 항상 실패했고, 지금은 서버가 Blob→드라이브로 옮긴다.
echo "## 첨부(드라이브): 이동은 비로그인 거부"
RC=$(code -H "X-Forwarded-For: $(RIP 58)" -H 'Content-Type: application/json' -X POST "$B/api/admin/upload-file/to-drive" -d '{"url":"https://test.public.blob.vercel-storage.com/notices/a.pdf","name":"a.pdf","size":10}')
[ "$RC" = 401 ] || fail "비로그인 드라이브 이동이 401 이 아님 ($RC)"
echo "  이동 비로그인 401 ok"

echo "## 첨부(드라이브): 우리 저장소 밖 URL 은 이동 거부"
RC=$(code "${CJSON[@]}" -X POST "$B/api/admin/upload-file/to-drive" -d '{"url":"https://evil.example.com/x.pdf","name":"x.pdf","size":10}')
[ "$RC" = 400 ] || fail "외부 URL 이 이동을 통과함 ($RC)"
echo "  외부 URL 거부 ok"

echo "## 첨부(드라이브): 연결 안 됐으면 moved:false 로 알린다 (Blob 첨부 유지)"
curl -s "${CJSON[@]}" -X POST "$B/api/admin/upload-file/to-drive" -d '{"url":"https://test.public.blob.vercel-storage.com/notices/a.pdf","name":"a.pdf","size":10}' \
  | py "assert d.get('moved') is False, d; print('  moved:false ok (' + str(d.get('reason')) + ')')"

echo "## 첨부: 없는 첨부 다운로드는 404"
RC=$(code "$B/api/notices/attachments/99999999")
[ "$RC" = 404 ] || fail "없는 첨부가 404 가 아님 ($RC)"
echo "  다운로드 404 ok"

# 이후는 blob 없이도 검증 가능하도록 API 에 메타데이터를 직접 넣는다 (실제 업로드는 위에서 검증).
A1='{"name":"안내문.pdf","url":"https://test.public.blob.vercel-storage.com/notices/a.pdf","size":12345,"mime":"application/pdf"}'
A2='{"name":"신청서.hwp","url":"https://test.public.blob.vercel-storage.com/notices/b.hwp","size":2048,"mime":"application/x-hwp"}'

echo "## 첨부: 외부 URL 은 저장되지 않는다"
EVIL='{"name":"evil","url":"https://evil.example.com/x.pdf","size":1,"mime":"application/pdf"}'
NID=$(curl -s "${CJSON[@]}" -X POST "$B/api/notices" -d "{\"title\":\"attachtest-1\",\"content\":\"본문\",\"attachments\":[$A1,$EVIL]}" | py "print(d['id'])")
curl -s "$B/api/notices/$NID" | py "assert len(d['attachments'])==1, d['attachments']; assert d['attachments'][0]['name']=='안내문.pdf', d; print('  blob 호스트만 저장 ok')"

echo "## 첨부: GET 에 첨부가 포함된다"
curl -s "$B/api/notices" | py "n=[x for x in d if x['id']==$NID][0]; assert len(n['attachments'])==1, n; print('  목록 GET 포함 ok')"

echo "## 첨부(U3): 제목만 수정하면 기존 첨부 id 가 그대로 유지된다"
# id 가 바뀌면 학생이 이미 받은 다운로드 주소(/api/notices/attachments/<id>)가 죽는다.
AID=$(curl -s "$B/api/notices/$NID" | py "print(d['attachments'][0]['id'])")
curl -s -o /dev/null "${CJSON[@]}" -X PUT "$B/api/notices/$NID" -d "{\"title\":\"attachtest-1-수정\",\"content\":\"본문\",\"attachments\":[{\"id\":$AID}]}"
curl -s "$B/api/notices/$NID" | py "assert [a['id'] for a in d['attachments']]==[$AID], d['attachments']; assert d['title']=='attachtest-1-수정', d; print('  id 유지 ok')"

echo "## 첨부(U3): attachments 키가 없으면 첨부는 변경되지 않는다"
curl -s -o /dev/null "${CJSON[@]}" -X PUT "$B/api/notices/$NID" -d "{\"title\":\"attachtest-1-키없음\",\"content\":\"본문\"}"
curl -s "$B/api/notices/$NID" | py "assert [a['id'] for a in d['attachments']]==[$AID], d['attachments']; print('  키 생략 시 변경 없음 ok')"

echo "## 첨부(U3): 다른 공지의 첨부 id 는 거절한다"
OTHER=$(curl -s "${CJSON[@]}" -X POST "$B/api/notices" -d "{\"title\":\"attachtest-other\",\"content\":\"본문\",\"attachments\":[$A2]}" | py "print(d['id'])")
OAID=$(curl -s "$B/api/notices/$OTHER" | py "print(d['attachments'][0]['id'])")
RC=$(code "${CJSON[@]}" -X PUT "$B/api/notices/$NID" -d "{\"title\":\"attachtest-1\",\"content\":\"본문\",\"attachments\":[{\"id\":$OAID}]}")
[ "$RC" = 400 ] || fail "다른 공지의 첨부 id 가 통과함 ($RC)"
curl -s "$B/api/notices/$OTHER" | py "assert [a['id'] for a in d['attachments']]==[$OAID], d; print('  타 공지 id 거절 ok (원본 무손상)')"
curl -s -o /dev/null "${CA[@]}" -X DELETE "$B/api/notices/$OTHER"

echo "## 첨부(U3): 새 파일 추가는 기존 id 를 유지한 채 늘어난다"
curl -s -o /dev/null "${CJSON[@]}" -X PUT "$B/api/notices/$NID" -d "{\"title\":\"attachtest-1\",\"content\":\"본문\",\"attachments\":[{\"id\":$AID},$A2]}"
curl -s "$B/api/notices/$NID" | py "ids=[a['id'] for a in d['attachments']]; assert $AID in ids and len(ids)==2, d['attachments']; print('  추가 ok')"

echo "## 첨부(U3): 목록에서 빠진 항목만 삭제된다"
curl -s -o /dev/null "${CJSON[@]}" -X PUT "$B/api/notices/$NID" -d "{\"title\":\"attachtest-1\",\"content\":\"본문\",\"attachments\":[{\"id\":$AID}]}"
curl -s "$B/api/notices/$NID" | py "assert [a['id'] for a in d['attachments']]==[$AID], d['attachments']; print('  제거 ok')"

echo "## 첨부: 빈 배열이면 모두 제거"
curl -s -o /dev/null "${CJSON[@]}" -X PUT "$B/api/notices/$NID" -d "{\"title\":\"attachtest-1\",\"content\":\"본문\",\"attachments\":[]}"
[ "$(sqlite3 dev.db "SELECT COUNT(*) FROM NoticeAttachment WHERE noticeId=$NID")" = 0 ] || fail "빈 배열인데 첨부가 남았다"
echo "  전체 제거 ok"

echo "## 첨부: 공지 삭제 시 첨부 행도 삭제"
curl -s -o /dev/null "${CJSON[@]}" -X PUT "$B/api/notices/$NID" -d "{\"title\":\"attachtest-1\",\"content\":\"본문\",\"attachments\":[$A1,$A2]}"
[ "$(sqlite3 dev.db "SELECT COUNT(*) FROM NoticeAttachment WHERE noticeId=$NID")" = 2 ] || fail "삭제 전 첨부 2개가 아님"
curl -s -o /dev/null "${CA[@]}" -X DELETE "$B/api/notices/$NID"
[ "$(sqlite3 dev.db "SELECT COUNT(*) FROM NoticeAttachment WHERE noticeId=$NID")" = 0 ] || fail "공지 삭제 후 첨부 행이 남았다"
echo "  cascade 삭제 ok"

rm -rf "$TMPD"; rm -f "$CJ"
sqlite3 dev.db "DELETE FROM Notice WHERE title LIKE 'attachtest-%'"

# 주의: 아래 블록은 실제 관리자 계정을 10분간 잠근다. 반드시 스크립트 마지막에 둘 것.
echo "## 로그인: IP 를 바꿔 가며 시도해도 계정 단위로 차단 (신규 — IP 로테이션 방어)"
# 기존 라우트 제한은 IP 단위라 IP 만 바꾸면 무제한이었다. 계정 버킷(10회/10분)이 이를 막는다.
JC=$(mktemp)
for i in $(seq 1 11); do LOGIN "$JC" "$(RIP 47)" "$U" "wrong-$i" >/dev/null; done
JD=$(mktemp)
LOGIN "$JD" "$(RIP 48)" "$U" "$P" >/dev/null
LOGGED_IN "$JD" && fail "계정 시도 제한이 걸리지 않음 (IP 로테이션 통과)"
rm -f "$JC" "$JD"
echo "  계정 제한 ok"


echo "ALL PASSED"
