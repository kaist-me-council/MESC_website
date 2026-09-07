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

# ===================== v2 =====================
curl -s "${A[@]}" -X PUT "$B/api/admin/campaigns/$CID" -d "{\"slug\":\"$SLUG\",\"title\":\"API 테스트\",\"enabled\":true}" >/dev/null
echo "## v2: self-cancel — new order pending -> cancel ok; paid -> 409"
ORD2=$(curl -s -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/orders" -d "{\"affiliation\":\"학부생\",\"name\":\"취소 테스트\",\"studentId\":\"20990003\",\"email\":\"c@kaist.ac.kr\",\"items\":[{\"optionId\":$O2,\"qty\":1}]}")
NO2=$(echo "$ORD2" | py "o=d['order']; assert o['canCancel'] and o['status']=='pending'; print(o['orderNo'])")
curl -s -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/orders/cancel" -d "{\"orderNo\":\"$NO2\",\"name\":\"취소테스트\",\"studentId\":\"20990003\"}" | py "assert d['order']['status']=='cancelled' and not d['order']['canCancel']; print('cancel ok')"
ORD3=$(curl -s -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/orders" -d "{\"affiliation\":\"학부생\",\"name\":\"입금 테스트\",\"studentId\":\"20990004\",\"email\":\"p@kaist.ac.kr\",\"items\":[{\"optionId\":$O2,\"qty\":1}]}")
NO3=$(echo "$ORD3" | py "print(d['order']['orderNo'])")
OID3=$(curl -s "${A[@]}" "$B/api/admin/campaigns/$CID/orders" | py "print([o['id'] for o in d['orders'] if o['orderNo']=='$NO3'][0])")
curl -s "${A[@]}" -X PUT "$B/api/admin/campaigns/$CID/orders" -d "{\"orderId\":$OID3,\"status\":\"paid\"}" >/dev/null
RC=$(code -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/orders/cancel" -d "{\"orderNo\":\"$NO3\",\"name\":\"입금 테스트\",\"studentId\":\"20990004\"}"); [ "$RC" = 409 ] || fail "paid order cancellable ($RC)"
RC=$(code -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/orders/cancel" -d "{\"orderNo\":\"$NO3\",\"name\":\"입금 테스트\",\"studentId\":\"20990009\"}"); [ "$RC" = 404 ] || fail "wrong cred cancel ($RC)"
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
J2=$(python3 -c "import json,sys;print(json.dumps({'csv':sys.argv[1],'mode':'tshirt','replace':True}))" "$CSV")
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
curl -s -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/lookup" -d "{\"orderNo\":\"$NO4\"}" | py "assert len(d['orders'])==1 and d['orders'][0]['depositorName']=='홍부모'; print('orderNo lookup ok')"
curl -s -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/lookup" -d "{\"orderNo\":\"$(echo "$NO4" | tr A-Z a-z)\"}" | py "assert len(d['orders'])==1; print('orderNo lowercase ok')"
curl -s -H 'Content-Type: application/json' -X POST "$B/api/campaigns/2026-spring-tshirt/lookup" -d "{\"orderNo\":\"$NO4\"}" | py "assert d['orders']==[]; print('orderNo other campaign -> empty ok')"
RC=$(code -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/lookup" -d '{"orderNo":"bad"}'); [ "$RC" = 400 ] || fail "bad orderNo format ($RC)"
OID4=$(curl -s "${A[@]}" "$B/api/admin/campaigns/$CID/orders" | py "print([o['id'] for o in d['orders'] if o['orderNo']=='$NO4'][0])")
curl -s "${A[@]}" "$B/api/admin/campaigns/$CID/orders?format=csv" | head -1 | grep -q '"이름","입금자명","이메일"' || fail "csv 입금자명 column"
curl -s "${A[@]}" -X PUT "$B/api/admin/campaigns/$CID/orders" -d "{\"orderId\":$OID4,\"items\":[{\"optionId\":$O2,\"qty\":3}],\"depositorName\":\"홍부모2\"}" | py "assert 'order' in d, d; o=d['order']; assert o['total']==sum(i['qty']*i['unitPrice'] for i in o['items']) and o['items'][0]['qty']==3 and o['depositorName']=='홍부모2', o; print('items edit ok total', o['total'])"
RC=$(code "${A[@]}" -X PUT "$B/api/admin/campaigns/$CID/orders" -d "{\"orderId\":$OID4,\"items\":[{\"optionId\":999999,\"qty\":1}]}"); [ "$RC" = 400 ] || fail "foreign optionId accepted ($RC)"
RC=$(code "${A[@]}" -X PUT "$B/api/admin/campaigns/$CID/orders" -d "{\"orderId\":$OID4,\"items\":[{\"optionId\":$O2,\"qty\":0}]}"); [ "$RC" = 400 ] || fail "qty 0 accepted ($RC)"
curl -s -H 'Content-Type: application/json' -X POST "$B/api/campaigns/$SLUG/orders/cancel" -d "{\"orderNo\":\"$NO4\"}" | py "assert d['order']['status']=='cancelled'; print('orderNo-only cancel ok')"
RC=$(code -H 'Content-Type: application/json' -X PUT "$B/api/campaigns/2026-spring-tshirt/confirm" -d "{\"orderNo\":\"$IMPNO\",\"confirmation\":\"received\"}"); [ "$RC" = 403 ] || fail "orderNo-only confirm should hit deadline 403 (cred accepted) ($RC)"
echo "v3 ok"

echo "## v2: /shop/check redirects"
RC=$(curl -s -o /dev/null -w '%{http_code}' "$B/shop/check"); case "$RC" in 200|307|308) echo "redirect ok ($RC)";; *) fail "/shop/check $RC";; esac
case "$B" in *localhost*) [ -f dev.db ] && sqlite3 dev.db "DELETE FROM Campaign WHERE slug='2026-spring-tshirt'" && echo "preset test campaign removed";; esac
case "$B" in *localhost*) [ -f dev.db ] && sqlite3 dev.db "DELETE FROM Campaign WHERE slug LIKE 'apitest-%'" && echo "local dev.db test rows removed";; esac
echo "ALL PASSED"
