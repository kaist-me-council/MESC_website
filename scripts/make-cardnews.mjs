/**
 * 인스타그램 카드뉴스(1:1, 1080×1080) — 학생용 사용법 요약.
 *
 * 실행: node scripts/make-cardnews.mjs
 * 출력: docs/manual/cardnews/card-01.png … (기존 파일 덮어씀)
 *
 * SVG 를 sharp 로 렌더한다. 브라우저가 필요 없고 결과가 항상 같다.
 * 내용은 docs/manual/학생용-사용법.md 를 따른다 — 매뉴얼을 고치면 여기도 맞출 것.
 *
 * 주의 두 가지
 *   - SVG 는 자동 줄바꿈이 없다. 아래 데이터에서 줄을 직접 나눈다(본문 한 줄 22자 안쪽).
 *   - 이모지는 렌더되지 않는다. 문구에 넣지 말 것.
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const W = 1080;
const OUT = "docs/manual/cardnews";
const PAD = 88;

// 사이트 팔레트(globals.css --primary/--accent)
const NAVY_TOP = "#0d4396";
const NAVY_BOT = "#03163b";
const CYAN = "#5ce1e6";
const WHITE = "#ffffff";
const FONT = "Apple SD Gothic Neo, Pretendard, Noto Sans KR, sans-serif";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const text = (x, y, s, { size = 38, weight = 400, fill = WHITE, opacity = 1, anchor = "start", spacing = 0 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}"
     fill-opacity="${opacity}" text-anchor="${anchor}" letter-spacing="${spacing}">${esc(s)}</text>`;

/** 12톱니 기어 — 우하단 워터마크 */
function gear(cx, cy, r, opacity) {
  const teeth = Array.from({ length: 12 }, (_, i) =>
    `<rect x="${-r * 0.085}" y="${-r * 1.3}" width="${r * 0.17}" height="${r * 0.34}" rx="${r * 0.045}" transform="rotate(${i * 30})"/>`,
  ).join("");
  return `<g transform="translate(${cx} ${cy})" fill="${CYAN}" opacity="${opacity}">
    <circle r="${r}"/>${teeth}<circle r="${r * 0.44}" fill="${NAVY_BOT}"/></g>`;
}

/** 본문을 담는 반투명 패널 */
const panel = (y, h) =>
  `<rect x="${PAD - 26}" y="${y}" width="${W - (PAD - 26) * 2}" height="${h}" rx="30"
     fill="#ffffff" fill-opacity="0.055" stroke="#ffffff" stroke-opacity="0.11" stroke-width="1.5"/>`;

/** 번호 배지 + 분류 라벨 */
function header(n, kicker) {
  return `<rect x="${PAD}" y="126" width="76" height="76" rx="24" fill="${CYAN}" fill-opacity="0.16"
      stroke="${CYAN}" stroke-opacity="0.45" stroke-width="1.5"/>
    ${text(PAD + 38, 179, n, { size: 36, weight: 800, fill: CYAN, anchor: "middle" })}
    ${text(PAD + 100, 165, kicker, { size: 27, weight: 700, fill: CYAN, spacing: 2 })}
    <rect x="${PAD + 100}" y="184" width="56" height="4" rx="2" fill="${CYAN}" fill-opacity="0.6"/>`;
}

/** 번호가 붙은 단계 목록 */
function steps(list, top, gapY) {
  return list
    .map((s, i) => {
      const y = top + i * gapY;
      return `<circle cx="${PAD + 22}" cy="${y - 12}" r="23" fill="${CYAN}" fill-opacity="0.18"
          stroke="${CYAN}" stroke-opacity="0.5" stroke-width="1.5"/>
        ${text(PAD + 22, y - 2, String(i + 1), { size: 25, weight: 800, fill: CYAN, anchor: "middle" })}
        ${text(PAD + 66, y, s, { size: 36, opacity: 0.95 })}`;
    })
    .join("");
}

/** 점 목록 */
function bullets(list, top, gapY) {
  return list
    .map((s, i) => {
      const y = top + i * gapY;
      return `<circle cx="${PAD + 10}" cy="${y - 12}" r="7" fill="${CYAN}"/>
        ${text(PAD + 42, y, s, { size: 36, opacity: 0.95 })}`;
    })
    .join("");
}

/** 하단 강조 띠 */
function keyStrip(lines, top) {
  const h = 30 + lines.length * 44;
  return `<rect x="${PAD - 26}" y="${top}" width="${W - (PAD - 26) * 2}" height="${h}" rx="20"
      fill="${CYAN}" fill-opacity="0.1"/>
    <rect x="${PAD - 26}" y="${top}" width="7" height="${h}" rx="3.5" fill="${CYAN}"/>
    ${lines.map((l, i) => text(PAD + 4, top + 52 + i * 44, l, { size: 30, weight: i === 0 ? 700 : 400, opacity: 0.92 })).join("")}`;
}

function frame(inner, n, total, { footer = true } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="${NAVY_TOP}"/><stop offset="1" stop-color="${NAVY_BOT}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.82" cy="0.08" r="0.62">
      <stop offset="0" stop-color="${CYAN}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${CYAN}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${W}" fill="url(#bg)"/>
  <rect width="${W}" height="${W}" fill="url(#glow)"/>
  ${gear(1020, 1030, 235, 0.07)}
  ${text(W - PAD, 84, `${n} / ${total}`, { size: 25, anchor: "end", opacity: 0.45, spacing: 3 })}
  ${inner}
  ${footer ? text(PAD, 1024, "mesc-website.vercel.app", { size: 24, weight: 700, fill: CYAN, opacity: 0.75 }) : ""}
</svg>`;
}

// ────────────────────────────── 카드 내용 (학생용 사용법 기준)

const cards = [
  {
    kind: "cover",
    kicker: "KAIST 기계공학과 학생회",
    title: ["학생회 사이트,", "이렇게 씁니다"],
    sub: ["공지 알림 · 단체복 신청 · 과비 확인", "로그인 없이 바로 쓸 수 있어요"],
  },
  {
    kind: "bullets", tag: "01", kicker: "무엇이 있나",
    title: ["한 곳에서", "다 됩니다"],
    items: [
      "공지사항 — 새 공지 휴대폰 알림",
      "학생회 이벤트 — 단체복·행사 신청",
      "과비 확인 — 학번만 넣으면 끝",
      "캘린더 — 학과 일정 구독",
      "커뮤니티 — 건의함·익명 게시판",
    ],
    key: ["오른쪽 위에서 English 로 바꿀 수 있어요"],
  },
  {
    kind: "steps", tag: "02", kicker: "공지 알림",
    title: ["새 공지를", "놓치지 마세요"],
    items: ["공지사항 페이지로 갑니다", "오른쪽 위 '공지 알림 받기'", "브라우저가 물으면 '허용'"],
    key: ["중요한 공지에만 알림이 갑니다", "모든 공지마다 울리지 않아요"],
  },
  {
    kind: "steps", tag: "03", kicker: "아이폰 사용자",
    title: ["아이폰은", "한 단계 더"],
    items: ["사파리로 사이트를 엽니다", "아래 공유 버튼을 누릅니다", "'홈 화면에 추가'를 누릅니다", "그 아이콘으로 열어서 알림 켜기"],
    key: ["사파리 탭에서는 알림이 오지 않아요", "애플 정책이라 다른 방법이 없습니다"],
  },
  {
    kind: "steps", tag: "04", kicker: "단체복·행사",
    title: ["신청은", "이렇게"],
    items: ["학과 도우미 → 학생회 이벤트", "색상·사이즈·수량 고르기", "이름·구분·학번·이메일 입력", "금액 확인하고 신청"],
    key: ["품절인 사이즈는 회색으로 표시돼요"],
  },
  {
    kind: "bullets", tag: "05", kicker: "신청 직후",
    title: ["이 화면은", "꼭 캡처하세요"],
    items: ["주문번호", "금액과 입금 계좌", "관리 코드 (8자리)"],
    key: ["관리 코드는 딱 한 번만 보여 줍니다", "학생회도 다시 알려 드릴 수 없어요"],
  },
  {
    kind: "bullets", tag: "06", kicker: "내 신청 확인",
    title: ["세 가지로", "조회됩니다"],
    items: ["이름 + 학번", "이름 + 이메일", "주문번호"],
    extra: { lines: ["대기  →  입금 확인  →  수령 완료"] },
    key: ["입금 확인 전이라면 직접 취소할 수 있어요", "주문번호와 관리 코드가 필요합니다"],
  },
  {
    kind: "bullets", tag: "07", kicker: "수령 확인",
    title: ["받았는지", "알려주세요"],
    items: ["이름과 학번으로 조회", "받았어요 / 못 받았어요 선택", "못 받았다면 항목마다 처리 선택"],
    extra: { lines: ["학생회실 수령 · 환불 · 사이즈 교환"] },
    key: ["환불 계좌는 학생회가 개별로 연락드립니다"],
  },
  {
    kind: "steps", tag: "08", kicker: "과비 확인",
    title: ["학번만", "넣으면 끝"],
    items: ["일정·재정 → 과비 확인", "학번을 숫자만 입력", "납부 횟수가 바로 나옵니다"],
    key: ["입력한 학번은 저장되지 않습니다", "주소창에도 남지 않아요"],
  },
  {
    kind: "bullets", tag: "09", kicker: "그 밖에",
    title: ["이런 것도", "있어요"],
    items: [
      "학과 일정을 내 캘린더에 넣기",
      "강의자료 · 족보 · 전공서적",
      "교수님 연구실 위치 찾기",
      "건의함 · 자유게시판 (익명)",
      "먹고 싶은 간식 신청",
    ],
    key: ["건의함은 이름을 적지 않아도 됩니다"],
  },
  {
    kind: "outro",
    title: ["지금", "들어가 보세요"],
    lines: ["mesc-website.vercel.app"],
    contact: ["문의  kaist.mesc@gmail.com", "학생회실  N7동 2105호"],
  },
];

// ────────────────────────────── 그리기

function cover(c, n, total) {
  let s = text(PAD, 372, c.kicker, { size: 30, weight: 700, fill: CYAN, spacing: 1.5 });
  s += `<rect x="${PAD}" y="398" width="72" height="5" rx="2.5" fill="${CYAN}"/>`;
  c.title.forEach((l, i) => { s += text(PAD, 512 + i * 104, l, { size: 86, weight: 800 }); });
  c.sub.forEach((l, i) => { s += text(PAD, 706 + i * 54, l, { size: 34, opacity: 0.82 }); });
  s += text(PAD, 1024, "mesc-website.vercel.app", { size: 26, weight: 700, fill: CYAN, opacity: 0.85 });
  return frame(s, n, total, { footer: false });
}

function body(c, n, total) {
  let s = header(c.tag, c.kicker);
  c.title.forEach((l, i) => { s += text(PAD, 300 + i * 82, l, { size: 68, weight: 800 }); });

  const top = 300 + c.title.length * 82;
  const gap = c.kind === "steps" ? 92 : 74;
  const panelH = c.items.length * gap + 30;
  s += panel(top - 4, panelH);
  s += c.kind === "steps" ? steps(c.items, top + 62, gap) : bullets(c.items, top + 58, gap);

  // 강조 띠는 패널 아래에 붙인다 — 좌표를 손으로 적으면 목록과 겹친다.
  if (c.extra) {
    const y = top - 4 + panelH + 26;
    s += `<rect x="${PAD - 26}" y="${y}" width="${W - (PAD - 26) * 2}" height="76" rx="20"
        fill="${CYAN}" fill-opacity="0.14"/>`;
    c.extra.lines.forEach((l, i) => { s += text(W / 2, y + 50 + i * 42, l, { size: 33, weight: 700, anchor: "middle" }); });
  }
  if (c.key) s += keyStrip(c.key, 990 - (30 + c.key.length * 44));
  return frame(s, n, total);
}

function outro(c, n, total) {
  let s = "";
  c.title.forEach((l, i) => { s += text(PAD, 400 + i * 96, l, { size: 78, weight: 800 }); });
  s += `<rect x="${PAD}" y="548" width="72" height="5" rx="2.5" fill="${CYAN}"/>`;
  c.lines.forEach((l, i) => { s += text(PAD, 646 + i * 56, l, { size: 40, weight: 700, fill: CYAN }); });
  c.contact.forEach((l, i) => { s += text(PAD, 764 + i * 52, l, { size: 32, opacity: 0.85 }); });
  return frame(s, n, total, { footer: false });
}

await mkdir(OUT, { recursive: true });
const total = cards.length;
for (const [i, c] of cards.entries()) {
  const n = i + 1;
  const svg = c.kind === "cover" ? cover(c, n, total) : c.kind === "outro" ? outro(c, n, total) : body(c, n, total);
  const file = `${OUT}/card-${String(n).padStart(2, "0")}.png`;
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file);
  console.log("생성:", file);
}
console.log(`\n${total}장 완료 — ${OUT}/ (1080×1080)`);
