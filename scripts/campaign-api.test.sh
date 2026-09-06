#!/usr/bin/env bash
# 캠페인 API end-to-end 점검. 사용: bash scripts/campaign-api.test.sh http://localhost:3123
# 전제: 서버가 ANON_SALT 를 갖고 실행 중, .env.local 에 ADMIN_USERNAME/ADMIN_PASSWORD.
set -euo pipefail
B=${1:?BASE URL}
J=$(mktemp); trap 'rm -f "$J"' EXIT
U=$(grep '^ADMIN_USERNAME=' .env.local | cut -d= -f2- | tr -d '"'); P=$(grep '^ADMIN_PASSWORD=' .env.local | cut -d= -f2- | tr -d '"')
py() { python3 -c "import sys,json;d=json.load(sys.stdin);$1"; }
fail() { echo "FAIL: $*"; exit 1; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }   # bash 3.2: 중첩 따옴표 회피용

curl -s --retry 20 --retry-connrefused --retry-delay 1 -o /dev/null "$B/api/campaigns"
CSRF=$(curl -s -c "$J" -b "$J" "$B/api/auth/csrf" | py "print(d['csrfToken'])")
curl -s -o /dev/null -c "$J" -b "$J" -X POST "$B/api/auth/callback/credentials" --data-urlencode "csrfToken=$CSRF" --data-urlencode "username=$U" --data-urlencode "password=$P" --data-urlencode "json=true"
A=(-b "$J" -H 'Content-Type: application/json')

echo "## unauth admin -> 401"
RC=$(code "$B/api/admin/campaigns"); [ "$RC" = 401 ] || fail "admin not protected ($RC)"

echo "## create campaign"
SLUG="apitest-$RANDOM"
CID=$(curl -s "${A[@]}" -X POST "$B/api/admin/campaigns" -d "{\"slug\":\"$SLUG\",\"title\":\"API 테스트\",\"enabled\":true,\"bankInfo\":\"국민 000-00 홍길동\",\"afterNote\":\"수령은 종강 직전\",\"priceAdjust\":{\"대학원생\":1000},\"options\":[{\"group\":\"흰색\",\"name\":\"L\",\"price\":8000,\"stock\":2},{\"group\":\"검정\",\"name\":\"XL\",\"price\":8000,\"stock\":null}]}" | py "print(d['campaign']['id'])")
echo "campaign id $CID"

echo "## public list contains slug"
curl -s "$B/api/campaigns" | py "assert any(c['slug']=='$SLUG' and c['open'] for c in d['campaigns']); print('ok')"

echo "## public detail: options + remaining, no bankInfo"
OPT=$(curl -s "$B/api/campaigns/$SLUG" | py "c=d['campaign']; assert 'bankInfo' not in c; o=c['options']; assert o[0]['remaining']==2 and o[1]['remaining'] is None; print(o[0]['id'], o[1]['id'])")
O1=${OPT% *}; O2=${OPT#* }

echo "## order: 대학원생, 흰 L x2 + 검 XL x1 -> total (8000+1000)*3"
ORD=$(curl -s -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/orders" -d "{\"affiliation\":\"대학원생\",\"name\":\"테스트 신청\",\"studentId\":\"20990001\",\"email\":\"T@kaist.ac.kr\",\"phone\":\"010\",\"items\":[{\"optionId\":$O1,\"qty\":2},{\"optionId\":$O2,\"qty\":1}]}")
echo "$ORD" | py "o=d['order']; assert o['total']==27000, o; assert o['campaign']['bankInfo']; assert 'studentIdHash' not in json.dumps(d); print(o['orderNo'], o['status'])"
NO=$(echo "$ORD" | py "print(d['order']['orderNo'])")

echo "## stock exceeded -> 409"
BODY="{\"affiliation\":\"학부생\",\"name\":\"둘\",\"studentId\":\"20990002\",\"email\":\"u@kaist.ac.kr\",\"items\":[{\"optionId\":$O1,\"qty\":1}]}"
RC=$(code -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/orders" -d "$BODY"); [ "$RC" = 409 ] || fail "stock not enforced ($RC)"

echo "## missing studentId -> 400"
BODY="{\"affiliation\":\"학부생\",\"name\":\"셋\",\"email\":\"u@kaist.ac.kr\",\"items\":[{\"optionId\":$O2,\"qty\":1}]}"
RC=$(code -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/orders" -d "$BODY"); [ "$RC" = 400 ] || fail "studentId not required ($RC)"

echo "## lookup by name+studentId / wrong name"
curl -s -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/lookup" -d '{"name":"테스트신청","studentId":"20990001"}' | py "assert len(d['orders'])==1 and d['orders'][0]['orderNo']=='$NO'; print('ok')"
curl -s -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/lookup" -d '{"name":"엉뚱","studentId":"20990001"}' | py "assert d['orders']==[]; print('ok')"
curl -s -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/lookup" -d '{"name":"테스트 신청","email":"t@kaist.ac.kr"}' | py "assert len(d['orders'])==1; print('ok email')"

echo "## admin orders list + status paid + memo"
OID=$(curl -s "${A[@]}" "$B/api/admin/campaigns/$CID/orders" | py "o=d['orders'][0]; assert o['hasStudentId'] and 'studentIdHash' not in o and o['phone']=='010'; print(o['id'])")
curl -s "${A[@]}" -X PUT "$B/api/admin/campaigns/$CID/orders" -d "{\"orderId\":$OID,\"status\":\"paid\",\"adminMemo\":\"확인\"}" | py "assert d['ok']; print('ok')"
curl -s "${A[@]}" -X PUT "$B/api/admin/campaigns/$CID/orders" -d "{\"orderId\":$OID,\"status\":\"bogus\"}" -o /dev/null -w '%{http_code}\n' | grep -q 400 || fail "bad status accepted"

echo "## admin list counts"
curl -s "${A[@]}" "$B/api/admin/campaigns" | py "c=[c for c in d['campaigns'] if c['id']==$CID][0]; assert c['orderCount']==1 and c['paidCount']==1 and c['optionCount']==2; print('ok')"

echo "## csv"
curl -s "${A[@]}" "$B/api/admin/campaigns/$CID/orders?format=csv" | head -2

echo "## PUT campaign: rename option, drop used option -> disabled, add new"
curl -s "${A[@]}" -X PUT "$B/api/admin/campaigns/$CID" -d "{\"slug\":\"$SLUG\",\"title\":\"API 테스트2\",\"enabled\":true,\"options\":[{\"id\":$O2,\"group\":\"검정\",\"name\":\"XXL\",\"price\":9000},{\"group\":\"새\",\"name\":\"옵션\",\"price\":0}]}" | py "o=d['campaign']['options']; names={x['name']:x['enabled'] for x in o}; assert names=={'L':False,'XXL':True,'옵션':True}, names; print('ok')"

echo "## cancel -> stock frees"
curl -s "${A[@]}" -X PUT "$B/api/admin/campaigns/$CID/orders" -d "{\"orderId\":$OID,\"status\":\"cancelled\"}" >/dev/null
curl -s "$B/api/campaigns/$SLUG" | py "o=[x for x in d['campaign']['options'] if x['name']=='XXL'][0]; print('remaining', o['remaining'])"

echo "## delete with orders -> 409, then cleanup via prisma-free path (cascade after manual order delete not exposed) "
RC=$(code "${A[@]}" -X DELETE "$B/api/admin/campaigns/$CID"); [ "$RC" = 409 ] || fail "delete allowed with orders ($RC)"
echo "cleanup: campaign $CID ($SLUG) left disabled"
curl -s "${A[@]}" -X PUT "$B/api/admin/campaigns/$CID" -d "{\"slug\":\"$SLUG\",\"title\":\"API 테스트(종료)\",\"enabled\":false}" >/dev/null
echo "## delete empty campaign -> ok"
C2=$(curl -s "${A[@]}" -X POST "$B/api/admin/campaigns" -d "{\"slug\":\"$SLUG-empty\",\"title\":\"빈 캠페인\"}" | py "print(d['campaign']['id'])")
curl -s "${A[@]}" -X DELETE "$B/api/admin/campaigns/$C2" | py "assert d['ok']; print('ok')"
case "$B" in *localhost*) [ -f dev.db ] && sqlite3 dev.db "DELETE FROM Campaign WHERE slug LIKE 'apitest-%'" && echo "local dev.db test rows removed";; esac
echo "ALL PASSED"
