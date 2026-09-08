/**
 * 인스타그램 카드뉴스(1:1, 1080×1080) 생성기 — 학생용 사용법 요약.
 *
 * 실행: node scripts/make-cardnews.mjs
 * 출력: docs/manual/cardnews/card-01.png … (기존 파일 덮어씀)
 *
 * SVG 를 sharp 로 렌더한다. 브라우저나 헤드리스 크롬이 필요 없고 결과가 항상 같다.
 * 줄바꿈은 자동으로 되지 않으므로 아래 데이터에서 줄을 직접 나눠 둔다.
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const W = 1080;
const OUT = "docs/manual/cardnews";

// 사이트 팔레트(globals.css --primary/--accent 계열)와 맞춘 값
const NAVY_TOP = "#0a3a86";
const NAVY_BOT = "#041c46";
const ACCENT = "#5ce1e6";
const WHITE = "#ffffff";
const FONT = "Apple SD Gothic Neo, Pretendard, Noto Sans KR, sans-serif";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 8톱니 기어 실루엣 — 우하단 워터마크 */
function gear(cx, cy, r, opacity) {
  const teeth = Array.from({ length: 8 }, (_, i) =>
    `<rect x="${-r * 0.11}" y="${-r * 1.34}" width="${r * 0.22}" height="${r * 0.38}" rx="${r * 0.06}" transform="rotate(${i * 45})"/>`,
  ).join("");
  return `<g transform="translate(${cx} ${cy})" fill="${ACCENT}" opacity="${opacity}">
    <circle r="${r}"/>${teeth}<circle r="${r * 0.42}" fill="${NAVY_BOT}"/></g>`;
}

function frame(inner, n, total) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="${NAVY_TOP}"/><stop offset="1" stop-color="${NAVY_BOT}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.8" cy="0.12" r="0.6">
      <stop offset="0" stop-color="${ACCENT}" stop-opacity="0.26"/>
      <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${W}" fill="url(#bg)"/>
  <rect width="${W}" height="${W}" fill="url(#glow)"/>
  ${gear(1010, 1010, 250, 0.08)}
  <text x="${W - 74}" y="82" text-anchor="end" font-family="${FONT}" font-size="26"
        fill="${WHITE}" fill-opacity="0.5" letter-spacing="3">${n} / ${total}</text>
  ${inner}
</svg>`;
}

const t = (x, y, s, { size = 40, weight = 400, fill = WHITE, opacity = 1, anchor = "start", spacing = 0 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}"
     fill="${fill}" fill-opacity="${opacity}" text-anchor="${anchor}" letter-spacing="${spacing}">${esc(s)}</text>`;

const PAD = 92;

function cover(c, n, total) {
  let s = t(PAD, 300, c.kicker, { size: 32, weight: 700, fill: ACCENT, spacing: 1 });
  c.title.forEach((line, i) => { s += t(PAD, 420 + i * 116, line, { size: 100, weight: 800 }); });
  c.sub.forEach((line, i) => { s += t(PAD, 700 + i * 58, line, { size: 38, opacity: 0.86 }); });
  s += t(PAD, 950, c.foot, { size: 34, weight: 700, fill: ACCENT });
  return frame(s, n, total);
}

function body(c, n, total) {
  let s = `<rect x="${PAD}" y="150" width="104" height="104" rx="30" fill="${ACCENT}" fill-opacity="0.16"
      stroke="${ACCENT}" stroke-opacity="0.4" stroke-width="2"/>`;
  s += t(PAD + 52, 220, c.tag, { size: 44, weight: 800, fill: ACCENT, anchor: "middle" });
  c.title.forEach((line, i) => { s += t(PAD, 340 + i * 86, line, { size: 74, weight: 800 }); });
  const top = 340 + c.title.length * 86 + 34;
  c.lines.forEach((line, i) => { s += t(PAD, top + i * 66, line, { size: 42, opacity: 0.94 }); });
  // 하단 강조 문구
  s += `<rect x="${PAD}" y="856" width="6" height="86" rx="3" fill="${ACCENT}"/>`;
  c.note.forEach((line, i) => { s += t(PAD + 28, 890 + i * 44, line, { size: 31, opacity: 0.74 }); });
  return frame(s, n, total);
}

function outro(c, n, total) {
  let s = t(PAD, 260, c.title, { size: 74, weight: 800 });
  c.items.forEach((it, i) => {
    const y = 380 + i * 84;
    s += `<circle cx="${PAD + 8}" cy="${y - 13}" r="9" fill="${ACCENT}"/>`;
    s += t(PAD + 40, y, it, { size: 42, opacity: 0.94 });
  });
  s += t(PAD, 950, c.foot, { size: 34, weight: 700, fill: ACCENT });
  return frame(s, n, total);
}

const cards = [
  { kind: "cover", kicker: "KAIST 기계공학과 학생회",
    title: ["학생회 사이트", "이렇게 쓰세요"],
    sub: ["공지 알림 · 단체복 신청 · 과비 확인", "로그인 없이 바로 쓸 수 있어요"],
    foot: "mesc-website.vercel.app" },

  { kind: "body", tag: "01", title: ["공지를 놓치지", "마세요"],
    lines: ["공지사항 페이지에서 '알림 받기'를 켜면", "새 공지가 올라올 때 휴대폰으로", "바로 알려 드려요."],
    note: ["고정 공지는 항상 맨 위에 있어요"] },

  { kind: "body", tag: "02", title: ["아이폰은", "한 단계 더"],
    lines: ["사파리 탭에서는 알림이 오지 않아요.", "공유 → 홈 화면에 추가 를 누른 뒤,", "그 아이콘으로 열어서 켜 주세요."],
    note: ["안드로이드와 컴퓨터는", "버튼 한 번이면 끝나요"] },

  { kind: "body", tag: "03", title: ["단체복·행사", "신청하기"],
    lines: ["학과 도우미 → 학생회 이벤트", "색상과 사이즈를 고르고 신청하면", "금액과 입금 계좌가 바로 나와요."],
    note: ["품절된 사이즈는 회색으로 보여요"] },

  { kind: "body", tag: "04", title: ["주문번호와", "관리 코드"],
    lines: ["신청이 끝나면 주문번호와 관리 코드가", "화면에 딱 한 번 나와요.", "꼭 캡처해 두세요."],
    note: ["나중에 취소할 때", "이 코드가 필요해요"] },

  { kind: "body", tag: "05", title: ["내 신청", "확인하기"],
    lines: ["이름+학번, 이메일, 주문번호", "셋 중 아무거나로 조회할 수 있어요.", "대기 → 입금 확인 → 수령 완료"],
    note: ["입금 확인 전이라면", "직접 취소할 수 있어요"] },

  { kind: "body", tag: "06", title: ["과비 납부", "확인하기"],
    lines: ["일정·재정 → 과비 확인", "학번만 넣으면 납부 횟수가", "바로 나와요."],
    note: ["입력한 학번은 저장되지 않아요"] },

  { kind: "outro", title: "이런 것도 있어요",
    items: ["학과 일정을 내 캘린더에 넣기", "강의자료 · 족보 · 전공서적", "교수님 연구실 위치 찾기", "건의함 · 익명 게시판 · 간식 신청"],
    foot: "mesc-website.vercel.app" },
];

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
