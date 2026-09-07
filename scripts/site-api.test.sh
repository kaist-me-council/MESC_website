#!/usr/bin/env bash
# 사이트 전반 보강 end-to-end 점검. 사용: bash scripts/site-api.test.sh http://localhost:3132
# 전제: 서버가 ANON_SALT 를 갖고 실행 중, .env.local 에 ADMIN_USERNAME/ADMIN_PASSWORD, 로컬 dev.db.
set -euo pipefail
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
sqlite3 dev.db "INSERT INTO Post (category,title,content,authorTag,hidden,reportCount,commentCount,viewCount,likeCount,createdAt) VALUES ('자유','sitetest-open','x','익명#0000',0,0,0,0,0,datetime('now')), ('자유','sitetest-open2','x','익명#0000',0,0,0,0,0,datetime('now')), ('자유','sitetest-hidden','x','익명#0000',1,0,0,0,0,datetime('now'))"
P1=$(sqlite3 dev.db "SELECT id FROM Post WHERE title='sitetest-open'")
P2=$(sqlite3 dev.db "SELECT id FROM Post WHERE title='sitetest-open2'")
PH=$(sqlite3 dev.db "SELECT id FROM Post WHERE title='sitetest-hidden'")
VIP=$(RIP 51)
JAR=$(mktemp); trap 'rm -f "$JAR"' EXIT
V=(-c "$JAR" -b "$JAR" -H 'Content-Type: application/json' -H "X-Forwarded-For: $VIP")
VIEW() { curl -s "${V[@]}" -X POST "$B/api/views" -d "{\"kind\":\"post\",\"id\":$1}"; }
COUNT() { sqlite3 dev.db "SELECT viewCount FROM Post WHERE id=$1"; }

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
curl -s -H 'Content-Type: application/json' -H "X-Forwarded-For: $(RIP 53)" -A "Mozilla/5.0 (compatible; Googlebot/2.1)" \
  -X POST "$B/api/views" -d "{\"kind\":\"post\",\"id\":$P2}" | py "assert d['counted'] is False, d; print('  봇 제외 ok')"
[ "$(COUNT "$P2")" = "$BEFORE_B" ] || fail "봇 요청이 조회수를 올렸다"

echo "## 조회수: 관리자 세션은 세지 않는다"
UA=$(grep '^ADMIN_USERNAME=' .env.local | cut -d= -f2- | tr -d '"')
PA=$(grep '^ADMIN_PASSWORD=' .env.local | cut -d= -f2- | tr -d '"')
AJ=$(mktemp); AIP=$(RIP 54)
ACSRF=$(curl -s -c "$AJ" -b "$AJ" -H "X-Forwarded-For: $AIP" "$B/api/auth/csrf" | py "print(d['csrfToken'])")
curl -s -o /dev/null -c "$AJ" -b "$AJ" -H "X-Forwarded-For: $AIP" -X POST "$B/api/auth/callback/credentials" \
  --data-urlencode "csrfToken=$ACSRF" --data-urlencode "username=$UA" --data-urlencode "password=$PA" --data-urlencode "json=true"
BEFORE_A=$(COUNT "$P2")
curl -s -b "$AJ" -H 'Content-Type: application/json' -H "X-Forwarded-For: $AIP" \
  -X POST "$B/api/views" -d "{\"kind\":\"post\",\"id\":$P2}" | py "assert d['counted'] is False, d; print('  관리자 제외 ok')"
[ "$(COUNT "$P2")" = "$BEFORE_A" ] || fail "관리자 조회가 조회수를 올렸다"
rm -f "$AJ"

echo "## 조회수: 쿠키 없이도 본문은 열린다"
RC=$(code "$B/api/posts/$P1"); [ "$RC" = 200 ] || fail "쿠키 없는 본문 조회 실패 ($RC)"

echo "## 좋아요: 토글 두 번이면 원상복구, 고아 행 없음"
LIP=$(RIP 52)
LJ=$(mktemp)
L=(-c "$LJ" -b "$LJ" -H "X-Forwarded-For: $LIP")
curl -s "${L[@]}" -X POST "$B/api/posts/$P1/like" | py "assert d['liked'] is True and d['likeCount']==1, d; print('  좋아요 ok')"
curl -s "${L[@]}" "$B/api/posts/$P1" | py "assert d['liked'] is True and d['likeCount']==1, d; print('  GET liked 반영 ok')"
curl -s "${L[@]}" -X POST "$B/api/posts/$P1/like" | py "assert d['liked'] is False and d['likeCount']==0, d; print('  취소 ok')"
[ "$(sqlite3 dev.db "SELECT COUNT(*) FROM PostLike WHERE postId=$P1")" = 0 ] || fail "취소 후 PostLike 행이 남았다"
[ "$(sqlite3 dev.db "SELECT likeCount FROM Post WHERE id=$P1")" = 0 ] || fail "취소 후 likeCount != 0"

echo "## 좋아요: 숨김 글은 404"
RC=$(code -X POST -H "X-Forwarded-For: $LIP" "$B/api/posts/$PH/like"); [ "$RC" = 404 ] || fail "숨김 글 좋아요가 404 가 아님 ($RC)"

rm -f "$LJ"
sqlite3 dev.db "DELETE FROM Post WHERE title LIKE 'sitetest-%'"
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
