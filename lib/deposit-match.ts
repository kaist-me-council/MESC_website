/**
 * 은행 거래내역 붙여넣기 → 신청 건 대조 (순수 함수, 서버·브라우저 공용).
 *
 * 지금까지는 통장 내역을 눈으로 훑으며 입금 확인을 손으로 눌렀다. 이름·금액이 맞는 건만
 * 자동으로 골라 주고, 애매한 건(동명이인·금액 불일치·미매칭)은 사람이 보게 남긴다.
 * 자동으로 상태를 바꾸지는 않는다 — 화면에서 확인한 뒤 누른다.
 */

export interface DepositLine {
  /** 입금자명 (공백 제거 전 원문) */
  name: string;
  amount: number;
  /** 원본 줄 — 화면에서 사람이 대조할 때 보여 준다 */
  raw: string;
}

export interface MatchTarget {
  id: number;
  name: string;
  depositorName?: string | null;
  total: number;
}

export interface MatchResult {
  /** 이름·금액이 모두 맞고 후보가 하나뿐 — 바로 입금 처리해도 되는 건 */
  matched: { line: DepositLine; orderId: number }[];
  /** 이름·금액은 맞는데 후보가 여럿 (동명이인) */
  ambiguous: { line: DepositLine; orderIds: number[] }[];
  /** 이름은 맞는데 금액이 다름 */
  amountMismatch: { line: DepositLine; orderId: number; expected: number }[];
  /** 신청 명단에 없는 입금 */
  unmatched: DepositLine[];
}

const normName = (s: string) => s.replace(/\s+/g, "").toLowerCase();

// 은행 화면에서 같이 딸려오는 말들 — 입금자명으로 오인하지 않게 걸러낸다.
const NOISE = /^(입금|출금|이체|잔액|거래일시|거래일자|날짜|내용|적요|구분|메모|기재내용|보낸분|받는분|은행|원)$/;
const DATEish = /^\d{2,4}[-./]\d{1,2}([-./]\d{1,2})?/;
const NUMERIC = /^-?[\d,]+(\.\d+)?$/;
const HAS_LETTER = /[가-힣a-zA-Z]/;

/**
 * 붙여넣은 내역에서 (입금자명, 금액) 을 뽑는다. 탭·쉼표·2칸 이상 공백을 칸 구분으로 본다.
 *
 * ponytail: 은행마다 칸 순서가 달라 완벽히 맞출 수 없다. 숫자가 여러 개면 마지막 것을
 * 잔액으로 보고 버리는 휴리스틱을 쓴다. 그래서 화면에 파싱 결과를 먼저 보여 주고
 * 사람이 확인한 뒤 처리하게 한다. 안 맞는 은행이 나오면 "이름,금액" 두 칸으로 붙여넣으면 된다.
 */
export function parseDeposits(text: string): DepositLine[] {
  const out: DepositLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // 따옴표를 벗기고 천 단위 쉼표를 먼저 없앤다 — 안 그러면 "1,234,567" 이 세 칸으로 쪼개진다.
    // (쉼표로만 구분된 내역에서 "5000,900" 처럼 잔액이 딱 세 자리면 천 단위로 오해할 수 있다.
    //  그래서 화면에 파싱 결과를 먼저 보여 준다.)
    const cells = line.replace(/"/g, "").replace(/(\d),(?=\d{3}(\D|$))/g, "$1").split(/\t|,|\s{2,}/).map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;

    const nums = cells.filter((c) => NUMERIC.test(c) && !DATEish.test(c));
    // 숫자가 2개 이상이면 마지막(잔액)을 버린다. 하나뿐이면 그게 금액.
    const amountCell = nums.length > 1 ? nums[nums.length - 2] : nums[0];
    const amount = amountCell ? Math.abs(Number(amountCell.replace(/,/g, ""))) : NaN;
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const name = cells.find((c) => HAS_LETTER.test(c) && !NOISE.test(c) && !DATEish.test(c) && !NUMERIC.test(c) && c.length <= 20);
    if (!name) continue;

    out.push({ name, amount, raw: line });
  }
  return out;
}

/**
 * 입금 줄을 신청 건에 맞춘다. 대조 대상(보통 입금 대기 건)은 호출부가 골라서 넘긴다.
 * 이름은 입금자명이 있으면 그것과, 없으면 신청자 이름과 맞춘다(둘 다 허용).
 */
export function matchDeposits(lines: DepositLine[], targets: MatchTarget[]): MatchResult {
  const byName = new Map<string, MatchTarget[]>();
  for (const t of targets) {
    for (const key of new Set([normName(t.depositorName || t.name), normName(t.name)])) {
      if (!key) continue;
      const list = byName.get(key) ?? [];
      list.push(t);
      byName.set(key, list);
    }
  }

  const result: MatchResult = { matched: [], ambiguous: [], amountMismatch: [], unmatched: [] };
  const taken = new Set<number>(); // 한 신청 건이 두 입금 줄에 걸리지 않게

  for (const line of lines) {
    const cands = (byName.get(normName(line.name)) ?? []).filter((t) => !taken.has(t.id));
    if (!cands.length) { result.unmatched.push(line); continue; }

    const exact = cands.filter((t) => t.total === line.amount);
    if (exact.length === 1) {
      taken.add(exact[0].id);
      result.matched.push({ line, orderId: exact[0].id });
    } else if (exact.length > 1) {
      result.ambiguous.push({ line, orderIds: exact.map((t) => t.id) });
    } else {
      result.amountMismatch.push({ line, orderId: cands[0].id, expected: cands[0].total });
    }
  }
  return result;
}
