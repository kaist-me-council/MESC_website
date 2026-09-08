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

# 전역 미들웨어가 비-GET 을 IP 당 60회/분으로 제한한다. 실행마다·구간마다 가짜 IP 를 달리해 버킷을 나눈다.
TIP="10.42.$((RANDOM % 200 + 10)).$((RANDOM % 200 + 10))"
curl -s --retry 20 --retry-connrefused --retry-delay 1 -o /dev/null "$B/api/campaigns"
CSRF=$(curl -s -c "$J" -b "$J" -H "X-Forwarded-For: $TIP" "$B/api/auth/csrf" | py "print(d['csrfToken'])")
curl -s -o /dev/null -c "$J" -b "$J" -H "X-Forwarded-For: $TIP" -X POST "$B/api/auth/callback/credentials" --data-urlencode "csrfToken=$CSRF" --data-urlencode "username=$U" --data-urlencode "password=$P" --data-urlencode "json=true"
A=(-b "$J" -H 'Content-Type: application/json' -H "X-Forwarded-For: $TIP")

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

# ===================== v2 =====================
curl -s "${A[@]}" -X PUT "$B/api/admin/campaigns/$CID" -d "{\"slug\":\"$SLUG\",\"title\":\"API 테스트\",\"enabled\":true}" >/dev/null
echo "## v2: self-cancel — new order pending -> cancel ok; paid -> 409"
ORD2=$(curl -s -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/orders" -d "{\"affiliation\":\"학부생\",\"name\":\"취소 테스트\",\"studentId\":\"20990003\",\"email\":\"c@kaist.ac.kr\",\"items\":[{\"optionId\":$O2,\"qty\":1}]}")
NO2=$(echo "$ORD2" | py "o=d['order']; assert o['canCancel'] and o['status']=='pending'; print(o['orderNo'])")
MC2=$(echo "$ORD2" | py "print(d['order']['manageCode'])")
curl -s -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/orders/cancel" -d "{\"orderNo\":\"$NO2\",\"manageCode\":\"$MC2\"}" | py "assert d['order']['status']=='cancelled' and not d['order']['canCancel']; print('cancel ok')"
ORD3=$(curl -s -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/orders" -d "{\"affiliation\":\"학부생\",\"name\":\"입금 테스트\",\"studentId\":\"20990004\",\"email\":\"p@kaist.ac.kr\",\"items\":[{\"optionId\":$O2,\"qty\":1}]}")
NO3=$(echo "$ORD3" | py "print(d['order']['orderNo'])")
MC3=$(echo "$ORD3" | py "print(d['order']['manageCode'])")
OID3=$(curl -s "${A[@]}" "$B/api/admin/campaigns/$CID/orders" | py "print([o['id'] for o in d['orders'] if o['orderNo']=='$NO3'][0])")
curl -s "${A[@]}" -X PUT "$B/api/admin/campaigns/$CID/orders" -d "{\"orderId\":$OID3,\"status\":\"paid\"}" >/dev/null
RC=$(code -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/orders/cancel" -d "{\"orderNo\":\"$NO3\",\"manageCode\":\"$MC3\"}"); [ "$RC" = 409 ] || fail "paid order cancellable ($RC)"
RC=$(code -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/orders/cancel" -d "{\"orderNo\":\"$NO3\",\"manageCode\":\"ZZZZZZZZ\"}"); [ "$RC" = 404 ] || fail "wrong manage code cancel ($RC)"
echo "paid cancel blocked ok"

echo "## v2: bulk status + 입금 취소(paid->pending)"
curl -s "${A[@]}" -X PUT "$B/api/admin/campaigns/$CID/orders" -d "{\"orderIds\":[$OID,$OID3],\"status\":\"delivered\"}" | py "assert d['updated']==2; print('bulk ok')"
curl -s "${A[@]}" -X PUT "$B/api/admin/campaigns/$CID/orders" -d "{\"orderId\":$OID3,\"status\":\"pending\"}" | py "assert d['ok']; print('입금 취소 ok')"
curl -s -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/lookup" -d '{"name":"입금테스트","studentId":"20990004"}' | py "assert d['orders'][0]['status']=='pending' and d['orders'][0]['canCancel']; print('ok')"

echo "## v2: preset tshirt campaign (create, dup -> 409)"
PRE=$(curl -s "${A[@]}" -X POST "$B/api/admin/campaigns" -d '{"preset":"tshirt-2026-spring"}')
PID=$(echo "$PRE" | py "c=d['campaign']; assert c['slug']=='2026-spring-tshirt' and c['kind']=='goods' and c['confirmEnabled'] and len(c['options'])==14; print(c['id'])")
RC=$(code "${A[@]}" -X POST "$B/api/admin/campaigns" -d '{"preset":"tshirt-2026-spring"}'); [ "$RC" = 409 ] || fail "preset dup ($RC)"
curl -s "$B/api/campaigns/2026-spring-tshirt" | py "c=d['campaign']; assert c['confirmOpen'] and not c['open'] and c['kind']=='goods'; print('public ok: confirmOpen, closed for orders')"
RC=$(code -H 'Content-Type: application/json' -X POST "$B/api/campaigns/2026-spring-tshirt/orders" -d "{\"affiliation\":\"학부생\",\"name\":\"x\",\"studentId\":\"20990001\",\"email\":\"x@kaist.ac.kr\",\"items\":[]}"); [ "$RC" = 403 ] || fail "closed campaign accepted order ($RC)"

echo "## v2: tshirt-mode import dryRun -> run (no new options), generic import creates option"
CSV=$(printf '%s\n' '구분,이름,학번,전화번호,이메일,흰색,검정,배부자,픽업 유무,,메일' '학부생,수령 확인일,20990011,01000000001,i1@kaist.ac.kr,XL 1개,L 2개,신예승,TRUE,,"a@x, b@y"' '교수님,확인교수,,01000000002,i2@kaist.ac.kr,,M 1개,,FALSE,,' '대학원생,확인삼,20990013,,i3@kaist.ac.kr,2XL 1개 --> XL 1개로 수정,이상함,,FALSE,,')
J1=$(python3 -c "import json,sys;print(json.dumps({'csv':sys.argv[1],'mode':'tshirt','dryRun':True}))" "$CSV")
curl -s "${A[@]}" -X POST "$B/api/admin/campaigns/$PID/orders/import" -d "$J1" | py "assert d['count']==3 and d['newOptions']==[] and len(d['problems'])==1 and 'studentIdHash' not in json.dumps(d); print('dryRun ok', d['problems'])"
# 실제 적재는 문제 행이 없어야 통과한다 (v4 게이트). 위 dryRun 용 CSV 의 깨진 칸만 고친 것.
CLEANCSV=$(printf '%s\n' '구분,이름,학번,전화번호,이메일,흰색,검정,배부자,픽업 유무,,메일' '학부생,수령 확인일,20990011,01000000001,i1@kaist.ac.kr,XL 1개,L 2개,신예승,TRUE,,"a@x, b@y"' '교수님,확인교수,,01000000002,i2@kaist.ac.kr,,M 1개,,FALSE,,' '대학원생,확인삼,20990013,,i3@kaist.ac.kr,2XL 1개 --> XL 1개로 수정,M 1개,,FALSE,,')
JBAD=$(python3 -c "import json,sys;print(json.dumps({'csv':sys.argv[1],'mode':'tshirt'}))" "$CSV")
RC=$(code "${A[@]}" -X POST "$B/api/admin/campaigns/$PID/orders/import" -d "$JBAD"); [ "$RC" = 400 ] || fail "문제 행 CSV 적재가 통과됨 ($RC)"
J2=$(python3 -c "import json,sys;print(json.dumps({'csv':sys.argv[1],'mode':'tshirt','replace':True}))" "$CLEANCSV")
curl -s "${A[@]}" -X POST "$B/api/admin/campaigns/$PID/orders/import" -d "$J2" | py "assert d['imported']==3 and d['createdOptions']==[]; print('import ok')"
curl -s "${A[@]}" "$B/api/admin/campaigns/$PID/orders" | py "st={o['name']:(o['status'],o['source']) for o in d['orders']}; assert st['수령 확인일']==('delivered','import') and st['확인교수']==('paid','import'); print('statuses ok')"
curl -s "${A[@]}" -X POST "$B/api/admin/campaigns/$PID/orders/import" -d "$J2" | py "assert d['imported']==3; print('replace ok')"
curl -s "${A[@]}" "$B/api/admin/campaigns/$PID/orders" | py "assert len(d['orders'])==3; print('replace kept 3')"
GEN=$(printf '%s\n' '구분,이름,학번,전화,이메일,항목,상태' '학부생,일반 적재,20990021,,g@kaist.ac.kr,흰색 XL×1; 후드 L x2,입금')
J3=$(python3 -c "import json,sys;print(json.dumps({'csv':sys.argv[1],'mode':'generic','dryRun':True}))" "$GEN")
curl -s "${A[@]}" -X POST "$B/api/admin/campaigns/$PID/orders/import" -d "$J3" | py "assert d['newOptions']==[{'group':'후드','name':'L'}], d; print('generic dryRun ok')"
J4=$(python3 -c "import json,sys;print(json.dumps({'csv':sys.argv[1],'mode':'generic'}))" "$GEN")
curl -s "${A[@]}" -X POST "$B/api/admin/campaigns/$PID/orders/import" -d "$J4" | py "assert d['imported']==1 and d['createdOptions']==[{'group':'후드','name':'L'}]; print('generic import ok')"

echo "## v2: confirm — received / not_received with exchange / wrong exchange group ignored"
IMPNO=$(curl -s -H 'Content-Type: application/json' -X POST "$B/api/campaigns/2026-spring-tshirt/lookup" -d '{"name":"수령확인일","studentId":"20990011"}' | py "o=d['orders'][0]; assert o['source']=='import' and o['confirmation'] is None and o['campaign']['confirmOpen']; print(o['orderNo'])")
curl -s -H 'Content-Type: application/json' -X PUT "$B/api/campaigns/2026-spring-tshirt/confirm" -d "{\"orderNo\":\"$IMPNO\",\"name\":\"수령 확인일\",\"studentId\":\"20990011\",\"confirmation\":\"received\"}" | py "o=d['order']; assert o['confirmation']=='received' and o['resolution'] is None and o['confirmedAt']; print('received ok')"
OPTS=$(curl -s -H 'Content-Type: application/json' -X POST "$B/api/campaigns/2026-spring-tshirt/lookup" -d '{"name":"수령확인일","studentId":"20990011"}' | py "o=d['orders'][0]; print(' '.join(str(i['optionId']) for i in o['items']))")
W=${OPTS% *}; K=${OPTS#* }
curl -s -H 'Content-Type: application/json' -X PUT "$B/api/campaigns/2026-spring-tshirt/confirm" -d "{\"orderNo\":\"$IMPNO\",\"name\":\"수령 확인일\",\"studentId\":\"20990011\",\"confirmation\":\"not_received\",\"resolution\":[{\"optionId\":$K,\"choice\":\"exchange\",\"exchangeName\":\"XL\"},{\"optionId\":$W,\"choice\":\"refund\"}],\"note\":\"검정만 못 받음\"}" \
  | py "o=d['order']; r={x['optionId']:x for x in o['resolution']}; assert r[$W]['choice']=='refund' and r[$K]['choice']=='exchange' and r[$K]['exchangeName']=='XL' and o['confirmNote']=='검정만 못 받음'; print('not_received ok')"
curl -s -H 'Content-Type: application/json' -X PUT "$B/api/campaigns/2026-spring-tshirt/confirm" -d "{\"orderNo\":\"$IMPNO\",\"name\":\"수령 확인일\",\"studentId\":\"20990011\",\"confirmation\":\"not_received\",\"resolution\":[{\"optionId\":$K,\"choice\":\"exchange\",\"exchangeName\":\"없는사이즈\"}]}" \
  | py "r={x['optionId']:x for x in d['order']['resolution']}; assert r[$K]['choice']=='exchange' and 'exchangeName' not in r[$K] or r[$K].get('exchangeName') is None; assert r[$W]['choice']=='pickup'; print('bad exchange ignored, default pickup ok')"
RC=$(code -H 'Content-Type: application/json' -X PUT "$B/api/campaigns/2026-spring-tshirt/confirm" -d "{\"orderNo\":\"$IMPNO\",\"name\":\"엉뚱\",\"studentId\":\"20990011\",\"confirmation\":\"received\"}"); [ "$RC" = 404 ] || fail "confirm wrong name ($RC)"
RC=$(code -H 'Content-Type: application/json' -X PUT "$B/api/campaigns/$SLUG/confirm" -d "{\"orderNo\":\"$NO3\",\"name\":\"입금 테스트\",\"studentId\":\"20990004\",\"confirmation\":\"received\"}"); [ "$RC" = 404 ] || fail "confirm on campaign without confirmEnabled ($RC)"
curl -s "${A[@]}" "$B/api/admin/campaigns/$PID/orders?format=csv" | head -1 | grep -q "수령확인" || fail "csv missing confirm columns"
curl -s "${A[@]}" "$B/api/admin/campaigns" | py "c=[c for c in d['campaigns'] if c['id']==$PID][0]; assert c['confirmedCount']==1; print('confirmedCount ok')"
echo "## v2: confirm deadline passed -> 403"
curl -s "${A[@]}" -X PUT "$B/api/admin/campaigns/$PID" -d '{"slug":"2026-spring-tshirt","title":"t","enabled":true,"kind":"goods","confirmEnabled":true,"confirmDeadline":"2020-01-01T00:00:00Z"}' | py "assert d['campaign']['confirmEnabled']; print('deadline set')"
RC=$(code -H 'Content-Type: application/json' -X PUT "$B/api/campaigns/2026-spring-tshirt/confirm" -d "{\"orderNo\":\"$IMPNO\",\"name\":\"수령 확인일\",\"studentId\":\"20990011\",\"confirmation\":\"received\"}")
if [ "$RC" = 429 ]; then echo "rate-limited (20/min) — waiting 61s"; sleep 61; RC=$(code -H 'Content-Type: application/json' -X PUT "$B/api/campaigns/2026-spring-tshirt/confirm" -d "{\"orderNo\":\"$IMPNO\",\"name\":\"수령 확인일\",\"studentId\":\"20990011\",\"confirmation\":\"received\"}"); fi
[ "$RC" = 403 ] || fail "confirm after deadline ($RC)"
echo "## v3: depositorName 저장·조회, orderNo 단독 lookup/cancel/confirm, 항목 수정, 잘못된 optionId 400"
curl -s "${A[@]}" -X PUT "$B/api/admin/campaigns/$CID" -d "{\"slug\":\"$SLUG\",\"title\":\"API 테스트\",\"enabled\":true}" >/dev/null
ORD4=$(curl -s -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/orders" -d "{\"affiliation\":\"학부생\",\"name\":\"입금자 테스트\",\"studentId\":\"20990031\",\"email\":\"d@kaist.ac.kr\",\"depositorName\":\"홍부모\",\"items\":[{\"optionId\":$O2,\"qty\":1}]}")
NO4=$(echo "$ORD4" | py "o=d['order']; assert o['depositorName']=='홍부모', o; print(o['orderNo'])")
MC4=$(echo "$ORD4" | py "print(d['order']['manageCode'])")
curl -s -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/lookup" -d "{\"orderNo\":\"$NO4\"}" | py "assert len(d['orders'])==1 and d['orders'][0]['depositorName']=='홍부모'; print('orderNo lookup ok')"
curl -s -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/lookup" -d "{\"orderNo\":\"$(echo "$NO4" | tr A-Z a-z)\"}" | py "assert len(d['orders'])==1; print('orderNo lowercase ok')"
curl -s -H 'Content-Type: application/json' -X POST "$B/api/campaigns/2026-spring-tshirt/lookup" -d "{\"orderNo\":\"$NO4\"}" | py "assert d['orders']==[]; print('orderNo other campaign -> empty ok')"
RC=$(code -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/lookup" -d '{"orderNo":"bad"}'); [ "$RC" = 400 ] || fail "bad orderNo format ($RC)"
OID4=$(curl -s "${A[@]}" "$B/api/admin/campaigns/$CID/orders" | py "print([o['id'] for o in d['orders'] if o['orderNo']=='$NO4'][0])")
curl -s "${A[@]}" "$B/api/admin/campaigns/$CID/orders?format=csv" | head -1 | grep -q '"이름","입금자명","이메일"' || fail "csv 입금자명 column"
curl -s "${A[@]}" -X PUT "$B/api/admin/campaigns/$CID/orders" -d "{\"orderId\":$OID4,\"items\":[{\"optionId\":$O2,\"qty\":3}],\"depositorName\":\"홍부모2\"}" | py "assert 'order' in d, d; o=d['order']; assert o['total']==sum(i['qty']*i['unitPrice'] for i in o['items']) and o['items'][0]['qty']==3 and o['depositorName']=='홍부모2', o; print('items edit ok total', o['total'])"
RC=$(code "${A[@]}" -X PUT "$B/api/admin/campaigns/$CID/orders" -d "{\"orderId\":$OID4,\"items\":[{\"optionId\":999999,\"qty\":1}]}"); [ "$RC" = 400 ] || fail "foreign optionId accepted ($RC)"
RC=$(code "${A[@]}" -X PUT "$B/api/admin/campaigns/$CID/orders" -d "{\"orderId\":$OID4,\"items\":[{\"optionId\":$O2,\"qty\":0}]}"); [ "$RC" = 400 ] || fail "qty 0 accepted ($RC)"
curl -s -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/orders/cancel" -d "{\"orderNo\":\"$NO4\",\"manageCode\":\"$MC4\"}" | py "assert d['order']['status']=='cancelled'; print('manage-code cancel ok')"
RC=$(code -H 'Content-Type: application/json' -X PUT "$B/api/campaigns/2026-spring-tshirt/confirm" -d "{\"orderNo\":\"$IMPNO\",\"confirmation\":\"received\"}"); [ "$RC" = 400 ] || fail "orderNo-only confirm must be rejected ($RC)"
echo "v3 ok"

# ===================== v4 (데이터 보호·동시성·관리 코드) =====================
# 공개 API 는 IP 당 60회/분 제한이 있다. 테스트마다 다른 X-Forwarded-For 로 버킷을 분리한다.
PUB() { # $1=method $2=path $3=body(선택) $4=fake-ip(선택) — 본문 출력
  local m=$1 path=$2 body=${3:-} ip=${4:-10.9.0.1}
  local args=(-s -H 'Content-Type: application/json' -H "X-Forwarded-For: $ip" -X "$m" "$B$path")
  [ -n "$body" ] && args+=(-d "$body")
  curl "${args[@]}"
}
PCODE() { # 같은 인자, 상태코드만 출력
  local m=$1 path=$2 body=${3:-} ip=${4:-10.9.0.1}
  local args=(-s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -H "X-Forwarded-For: $ip" -X "$m" "$B$path")
  [ -n "$body" ] && args+=(-d "$body")
  curl "${args[@]}"
}
ORDERS_OF() { curl -s "${A[@]}" "$B/api/admin/campaigns/$1/orders" | py "print(len(d['orders']))"; }

A=(-b "$J" -H 'Content-Type: application/json' -H "X-Forwarded-For: 10.43.$((RANDOM % 200 + 10)).$((RANDOM % 200 + 10))")  # v4 구간 전용 버킷

echo "## v4: 캠페인 준비 (한정 재고 1 · 무제한, 1인 한도 3)"
S4="apitest4-$RANDOM"
C4=$(curl -s "${A[@]}" -X POST "$B/api/admin/campaigns" -d "{\"slug\":\"$S4\",\"title\":\"v4 하드닝\",\"enabled\":true,\"maxPerPerson\":3,\"options\":[{\"name\":\"한정\",\"price\":1000,\"stock\":1},{\"name\":\"무제한\",\"price\":1000,\"stock\":null}]}" | py "print(d['campaign']['id'])")
OP4=$(PUB GET "/api/campaigns/$S4" | py "o=d['campaign']['options']; assert o[0]['remaining']==1 and o[1]['remaining'] is None; print(o[0]['id'], o[1]['id'])")
LIM=${OP4% *}; FREE=${OP4#* }

echo "## v4: 재고 1 옵션에 동시 2건 -> 1건만 201"
RA=$(mktemp); RB=$(mktemp)
BODY_A="{\"affiliation\":\"학부생\",\"name\":\"동시 하나\",\"studentId\":\"20991101\",\"email\":\"r1@kaist.ac.kr\",\"items\":[{\"optionId\":$LIM,\"qty\":1}]}"
BODY_B="{\"affiliation\":\"학부생\",\"name\":\"동시 둘\",\"studentId\":\"20991102\",\"email\":\"r2@kaist.ac.kr\",\"items\":[{\"optionId\":$LIM,\"qty\":1}]}"
PCODE POST "/api/campaigns/$S4/orders" "$BODY_A" 10.9.1.1 > "$RA" &
PCODE POST "/api/campaigns/$S4/orders" "$BODY_B" 10.9.1.2 > "$RB" &
wait
CA=$(cat "$RA"); CB=$(cat "$RB"); rm -f "$RA" "$RB"
echo "  동시 응답: $CA / $CB"
OK201=0; [ "$CA" = 201 ] && OK201=$((OK201+1)); [ "$CB" = 201 ] && OK201=$((OK201+1))
[ "$OK201" = 1 ] || fail "동시 신청 재고 초과: $CA / $CB (201 이 $OK201 건)"
case "$CA$CB" in *409*) : ;; *) fail "진 쪽이 409 가 아님: $CA / $CB";; esac
PUB GET "/api/campaigns/$S4" '' 10.9.1.3 | py "o=[x for x in d['campaign']['options'] if x['id']==$LIM][0]; assert o['remaining']==0, o; print('  남은 수량 0 ok')"
RC=$(PCODE POST "/api/campaigns/$S4/orders" "$BODY_A" 10.9.1.4); [ "$RC" = 409 ] || fail "품절 후 신청 허용 ($RC)"

echo "## v4: 관리 코드 — 발급 1회, 조회에는 없음"
KEY="idem-$RANDOM-$RANDOM-ab"
BODY4="{\"affiliation\":\"학부생\",\"name\":\"코드 테스트\",\"studentId\":\"20991201\",\"email\":\"v4a@kaist.ac.kr\",\"idempotencyKey\":\"$KEY\",\"items\":[{\"optionId\":$FREE,\"qty\":1}]}"
R1=$(PUB POST "/api/campaigns/$S4/orders" "$BODY4" 10.9.2.1)
MCA=$(echo "$R1" | py "o=d['order']; assert len(o['manageCode'])==8 and o['hasManageCode']; print(o['manageCode'])")
NOA=$(echo "$R1" | py "print(d['order']['orderNo'])")
PUB POST "/api/campaigns/$S4/lookup" "{\"orderNo\":\"$NOA\"}" 10.9.2.2 | py "assert 'manageCode' not in json.dumps(d) and d['orders'][0]['hasManageCode']; print('  조회에 코드 없음 ok')"

echo "## v4: idempotency 재전송 -> 새 주문 없음"
R2=$(PUB POST "/api/campaigns/$S4/orders" "$BODY4" 10.9.2.3)
echo "$R2" | py "assert d.get('replayed') and d['order']['orderNo']=='$NOA' and 'manageCode' not in d['order']; print('  재전송 ok')"

echo "## v4: 취소는 관리 코드 필수 (없음 400 · 틀림 404 · 맞으면 성공)"
RC=$(PCODE POST "/api/campaigns/$S4/orders/cancel" "{\"orderNo\":\"$NOA\"}" 10.9.2.4); [ "$RC" = 400 ] || fail "코드 없이 취소 허용 ($RC)"
RC=$(PCODE POST "/api/campaigns/$S4/orders/cancel" "{\"orderNo\":\"$NOA\",\"name\":\"코드 테스트\",\"studentId\":\"20991201\"}" 10.9.2.5); [ "$RC" = 400 ] || fail "이름+학번으로 취소 허용 ($RC)"
RC=$(PCODE POST "/api/campaigns/$S4/orders/cancel" "{\"orderNo\":\"$NOA\",\"manageCode\":\"ZZZZZZZZ\"}" 10.9.2.6); [ "$RC" = 404 ] || fail "틀린 코드 취소 허용 ($RC)"
PUB POST "/api/campaigns/$S4/orders/cancel" "{\"orderNo\":\"$NOA\",\"manageCode\":\"$MCA\"}" 10.9.2.7 | py "assert d['order']['status']=='cancelled'; print('  코드 취소 ok')"

echo "## v4: 취소 경합 — 관리자 입금 확인 뒤 취소 -> 409"
R3=$(PUB POST "/api/campaigns/$S4/orders" "{\"affiliation\":\"학부생\",\"name\":\"경합 테스트\",\"studentId\":\"20991301\",\"email\":\"v4b@kaist.ac.kr\",\"items\":[{\"optionId\":$FREE,\"qty\":1}]}" 10.9.3.1)
NOB=$(echo "$R3" | py "print(d['order']['orderNo'])"); MCB=$(echo "$R3" | py "print(d['order']['manageCode'])")
OIDB=$(curl -s "${A[@]}" "$B/api/admin/campaigns/$C4/orders" | py "print([o['id'] for o in d['orders'] if o['orderNo']=='$NOB'][0])")
curl -s "${A[@]}" -X PUT "$B/api/admin/campaigns/$C4/orders" -d "{\"orderId\":$OIDB,\"status\":\"paid\"}" >/dev/null
RC=$(PCODE POST "/api/campaigns/$S4/orders/cancel" "{\"orderNo\":\"$NOB\",\"manageCode\":\"$MCB\"}" 10.9.3.2); [ "$RC" = 409 ] || fail "입금 확인된 주문 취소됨 ($RC)"
curl -s "${A[@]}" "$B/api/admin/campaigns/$C4/orders" | py "assert [o for o in d['orders'] if o['orderNo']=='$NOB'][0]['status']=='paid'; print('  paid 유지 ok')"

echo "## v4: maxPerPerson 누적 (한도 3 — 2개 뒤 2개 거부, 1개는 허용)"
Q="{\"affiliation\":\"학부생\",\"name\":\"한도 테스트\",\"studentId\":\"20991401\",\"email\":\"v4c@kaist.ac.kr\",\"items\":[{\"optionId\":$FREE,\"qty\":2}]}"
PUB POST "/api/campaigns/$S4/orders" "$Q" 10.9.4.1 | py "assert d['order']['total']==2000; print('  1차 2개 ok')"
RC=$(PCODE POST "/api/campaigns/$S4/orders" "$Q" 10.9.4.2); [ "$RC" = 409 ] || fail "1인 한도 누적 미적용 ($RC)"
PUB POST "/api/campaigns/$S4/orders" "{\"affiliation\":\"학부생\",\"name\":\"한도 테스트\",\"studentId\":\"20991401\",\"email\":\"v4c@kaist.ac.kr\",\"items\":[{\"optionId\":$FREE,\"qty\":1}]}" 10.9.4.3 | py "assert d['order']['total']==1000; print('  잔여 1개 ok')"
RC=$(PCODE POST "/api/campaigns/$S4/orders" "{\"affiliation\":\"학부생\",\"name\":\"한도 테스트\",\"studentId\":\"20991401\",\"email\":\"v4c@kaist.ac.kr\",\"items\":[{\"optionId\":$FREE,\"qty\":1}]}" 10.9.4.4); [ "$RC" = 409 ] || fail "한도 초과 허용 ($RC)"

echo "## v4: 잘못된 CSV 로 replace -> 400, 기존 주문 건수 불변"
BEFORE=$(ORDERS_OF "$PID")
BADCSV=$(printf '%s\n' '구분,이름,학번,전화번호,이메일,흰색,검정,배부자,픽업 유무' '대학원생,깨진 행,20990013,,x@kaist.ac.kr,이상함,더이상함,,FALSE')
JB=$(python3 -c "import json,sys;print(json.dumps({'csv':sys.argv[1],'mode':'tshirt','replace':True}))" "$BADCSV")
RC=$(code "${A[@]}" -X POST "$B/api/admin/campaigns/$PID/orders/import" -d "$JB"); [ "$RC" = 400 ] || fail "문제 행 CSV 적재 허용 ($RC)"
AFTER=$(ORDERS_OF "$PID"); [ "$BEFORE" = "$AFTER" ] || fail "실패한 replace 가 주문을 지움 ($BEFORE -> $AFTER)"
echo "  기존 $BEFORE 건 보존 ok"
EMPTYCSV='구분,이름,학번,전화번호,이메일,흰색,검정,배부자,픽업 유무'
JE=$(python3 -c "import json,sys;print(json.dumps({'csv':sys.argv[1],'mode':'tshirt','replace':True}))" "$EMPTYCSV")
RC=$(code "${A[@]}" -X POST "$B/api/admin/campaigns/$PID/orders/import" -d "$JE"); [ "$RC" = 400 ] || fail "0건 CSV 적재 허용 ($RC)"
[ "$(ORDERS_OF "$PID")" = "$BEFORE" ] || fail "0건 replace 가 주문을 지움"
echo "  0건 거부 ok"

echo "## v4: dryRun 은 옵션을 만들지 않는다"
NEWOPT=$(printf '%s\n' '구분,이름,학번,전화,이메일,항목,상태' '학부생,드라이런,20991501,,dry@kaist.ac.kr,신규그룹 XS×1,입금')
JD=$(python3 -c "import json,sys;print(json.dumps({'csv':sys.argv[1],'mode':'generic','dryRun':True}))" "$NEWOPT")
curl -s "${A[@]}" -X POST "$B/api/admin/campaigns/$C4/orders/import" -d "$JD" | py "assert d['newOptions']==[{'group':'신규그룹','name':'XS'}]; print('  미리보기 새 옵션 예고 ok')"
curl -s "${A[@]}" "$B/api/admin/campaigns/$C4" | py "assert not any(o['name']=='XS' for o in d['campaign']['options']); print('  dryRun 후 옵션 미생성 ok')"

echo "## v4: CSV 수식 주입 중화"
curl -s "${A[@]}" -X PUT "$B/api/admin/campaigns/$C4/orders" -d "{\"orderId\":$OIDB,\"adminMemo\":\"=1+1\"}" >/dev/null
curl -s "${A[@]}" "$B/api/admin/campaigns/$C4/orders?format=csv" | grep -q "\"'=1+1\"" || fail "CSV 수식 중화 안 됨"
echo "  =1+1 중화 ok"

echo "## v4b: 환불 완료 토글"
curl -s "${A[@]}" -X PUT "$B/api/admin/campaigns/$C4/orders" -d "{\"orderId\":$OIDB,\"refunded\":true}" >/dev/null
curl -s "${A[@]}" "$B/api/admin/campaigns/$C4/orders" | py "o=[x for x in d['orders'] if x['id']==$OIDB][0]; assert o['refundedAt'], '환불 완료 저장 안 됨'; print('  환불 완료 저장 ok')"
curl -s "${A[@]}" "$B/api/admin/campaigns/$C4/orders?format=csv" | head -1 | grep -q "환불완료" || fail "CSV 환불완료 열 없음"
curl -s "${A[@]}" -X PUT "$B/api/admin/campaigns/$C4/orders" -d "{\"orderId\":$OIDB,\"refunded\":false}" >/dev/null
curl -s "${A[@]}" "$B/api/admin/campaigns/$C4/orders" | py "o=[x for x in d['orders'] if x['id']==$OIDB][0]; assert not o['refundedAt'], '환불 완료 해제 안 됨'; print('  환불 완료 해제 ok')"

echo "## v5: 비공개 캠페인 미리보기 (관리자만)"
PV="apitest-preview-$RANDOM"
PVID=$(curl -s "${A[@]}" -X POST "$B/api/admin/campaigns" -d "{\"title\":\"미리보기 테스트\",\"slug\":\"$PV\",\"kind\":\"goods\",\"enabled\":false,\"options\":[{\"name\":\"L\",\"group\":\"흰색\",\"price\":8000}]}" | py "print(d.get('campaign',d)['id'])")
RC=$(curl -s -o /dev/null -w '%{http_code}' "$B/api/campaigns/$PV"); [ "$RC" = 404 ] || fail "비공개 캠페인이 비로그인에게 열림 ($RC)"
echo "  비로그인 404 ok"
curl -s "${A[@]}" "$B/api/campaigns/$PV" | py "assert d['campaign']['preview'] is True, d; print('  관리자 preview:true ok')"
curl -s "$B/api/campaigns" | py "assert not any(c['slug']=='$PV' for c in d['campaigns']), '비공개가 공개 목록에 노출됨'; print('  공개 목록 제외 ok')"
curl -s "${A[@]}" "$B/api/campaigns" | py "assert any(c['slug']=='$PV' and c['preview'] for c in d['campaigns']), '관리자 목록에 미리보기 없음'; print('  관리자 목록 포함 ok')"
RC=$(code -X POST "$B/api/campaigns/$PV/orders" -d '{"affiliation":"학부생","name":"홍길동","studentId":"20990777","email":"pv@kaist.ac.kr","items":[{"optionId":1,"qty":1}]}'); [ "$RC" = 403 ] || [ "$RC" = 404 ] || fail "비공개 캠페인에 신청이 통과함 ($RC)"
echo "  비공개 신청 차단 ok ($RC)"
curl -s "${A[@]}" -X DELETE "$B/api/admin/campaigns/$PVID" >/dev/null

echo "## v2: /shop/check redirects"
RC=$(curl -s -o /dev/null -w '%{http_code}' "$B/shop/check"); case "$RC" in 200|307|308) echo "redirect ok ($RC)";; *) fail "/shop/check $RC";; esac
case "$B" in *localhost*) [ -f dev.db ] && sqlite3 dev.db "DELETE FROM Campaign WHERE slug='2026-spring-tshirt'" && echo "preset test campaign removed";; esac
case "$B" in *localhost*) [ -f dev.db ] && sqlite3 dev.db "DELETE FROM Campaign WHERE slug LIKE 'apitest-%' OR slug LIKE 'apitest4-%'" && echo "local dev.db test rows removed";; esac
echo "ALL PASSED"
