/**
 * 아이콘 생성기 — SVG 하나에서 파비콘·앱 아이콘·OG 이미지를 전부 만든다.
 *   node scripts/make-icons.mjs
 *
 * 디자인: DESIGN_SYSTEM.md 의 Rich Navy(#062e6e) 배경 + Steel Blue(#00c3d1) 기어.
 * 32px 파비콘에서도 뭉개지지 않도록 톱니는 8개·두껍게, 링도 두껍게 잡았다.
 * 글자("ME")는 앱 아이콘(180px+)에만 넣는다 — 32px 파비콘에서는 뭉개지므로 기어만 남긴다.
 */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NAVY_DEEP = "#041c46";
const NAVY = "#062e6e";
const CYAN = "#00c3d1";
const CYAN_SOFT = "#5ce1e6";

/** 기어 바깥 외곽선 path (톱니 포함). 각 톱니는 사다리꼴. */
function gearPath(cx, cy, rOuter, rRoot, teeth, toothWidthRatio = 0.52) {
  const step = (Math.PI * 2) / teeth;
  const half = (step * toothWidthRatio) / 2;
  const flank = step * 0.1; // 톱니 옆면 기울기
  const pt = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const d = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    const p1 = pt(rRoot, a - half - flank);
    const p2 = pt(rOuter, a - half);
    const p3 = pt(rOuter, a + half);
    const p4 = pt(rRoot, a + half + flank);
    d.push(i === 0 ? `M ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}` : `L ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`);
    d.push(`L ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`);
    d.push(`L ${p3[0].toFixed(2)} ${p3[1].toFixed(2)}`);
    d.push(`L ${p4[0].toFixed(2)} ${p4[1].toFixed(2)}`);
    // 다음 톱니 뿌리까지 호를 그려 이어 붙인다
    const next = pt(rRoot, (i + 1) * step - Math.PI / 2 - half - flank);
    d.push(`A ${rRoot} ${rRoot} 0 0 1 ${next[0].toFixed(2)} ${next[1].toFixed(2)}`);
  }
  d.push("Z");
  return d.join(" ");
}

/**
 * @param {object} o
 * @param {number} o.size 정사각 크기
 * @param {number} o.pad  안전 영역 여백 비율 (maskable 은 0.14 권장)
 * @param {boolean} o.bg  배경(라운드 사각형) 포함 여부
 * @param {boolean} o.withText 가운데 "ME" 표기 — 앱 아이콘(180px+)에만.
 *   32px 파비콘에서는 글자가 뭉개지므로 기어만 남긴다.
 */
function markSvg({ size = 512, pad = 0, bg = true, withText = false } = {}) {
  const S = 512;
  const inset = S * pad;
  const box = S - inset * 2;
  const cx = S / 2;
  const cy = S / 2;
  // 기어 치수 — 배경 대비 충분히 크게
  const rOuter = box * 0.40;
  const rRoot = rOuter * 0.80;
  // 글자를 넣을 때는 안쪽 구멍을 키워 "ME" 가 들어갈 자리를 만든다
  const rHole = rOuter * (withText ? 0.56 : 0.36);
  const radius = S * 0.22; // 배경 라운드
  const text = withText
    ? `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
      font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="${(rHole * 1.15).toFixed(0)}"
      font-weight="700" letter-spacing="-2" fill="${CYAN_SOFT}">ME</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${NAVY}"/>
      <stop offset="1" stop-color="${NAVY_DEEP}"/>
    </linearGradient>
    <linearGradient id="gear" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="${CYAN_SOFT}"/>
      <stop offset="1" stop-color="${CYAN}"/>
    </linearGradient>
    <mask id="cut">
      <rect width="${S}" height="${S}" fill="black"/>
      <path d="${gearPath(cx, cy, rOuter, rRoot, 8)}" fill="white"/>
      <circle cx="${cx}" cy="${cy}" r="${rHole}" fill="black"/>
    </mask>
  </defs>
  ${bg ? `<rect width="${S}" height="${S}" rx="${radius}" ry="${radius}" fill="url(#bg)"/>` : ""}
  <rect width="${S}" height="${S}" fill="url(#gear)" mask="url(#cut)"/>
  ${text}
</svg>`;
}

/** OG 이미지 — 기어 + 워드마크 (가로가 넓어 글자를 넣을 공간이 있다) */
function ogSvg(w = 1200, h = 630) {
  const cx = 250;
  const cy = h / 2;
  const rOuter = 150;
  const rRoot = rOuter * 0.8;
  const rHole = rOuter * 0.36;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${NAVY}"/>
      <stop offset="1" stop-color="${NAVY_DEEP}"/>
    </linearGradient>
    <linearGradient id="gear" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="${CYAN_SOFT}"/>
      <stop offset="1" stop-color="${CYAN}"/>
    </linearGradient>
    <mask id="cut">
      <rect width="${w}" height="${h}" fill="black"/>
      <path d="${gearPath(cx, cy, rOuter, rRoot, 8)}" fill="white"/>
      <circle cx="${cx}" cy="${cy}" r="${rHole}" fill="black"/>
    </mask>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#gear)" mask="url(#cut)"/>
  <text x="470" y="${cy - 30}" font-family="Helvetica, Arial, sans-serif" font-size="72" font-weight="700" fill="#ffffff">KAIST 기계공학과</text>
  <text x="470" y="${cy + 60}" font-family="Helvetica, Arial, sans-serif" font-size="72" font-weight="700" fill="${CYAN}">학생회</text>
  <rect x="470" y="${cy + 100}" width="120" height="8" rx="4" fill="${CYAN}"/>
</svg>`;
}

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

/** PNG 를 품은 최소 ICO 컨테이너. (Vista+ 는 ICO 안의 PNG 를 그대로 읽는다) */
function buildIco(pngs) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); // reserved
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(pngs.length, 4);
  let offset = 6 + pngs.length * 16;
  const dir = [];
  for (const { size, buf } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // 팔레트 없음
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    dir.push(e);
  }
  return Buffer.concat([head, ...dir, ...pngs.map((p) => p.buf)]);
}
const out = (rel, buf) => {
  const p = join(ROOT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, buf);
  console.log("  ", rel, `${(buf.length / 1024).toFixed(1)}KB`);
};

console.log("아이콘 생성:");
// Next.js App Router 자동 인식 파비콘
out("app/icon.svg", Buffer.from(markSvg({ size: 512 })));
// 구형 브라우저·사파리용 favicon.ico (16·32px 임베드 PNG)
out(
  "app/favicon.ico",
  buildIco([
    { size: 16, buf: await png(markSvg({ size: 512 }), 16) },
    { size: 32, buf: await png(markSvg({ size: 512 }), 32) },
  ]),
);
out("app/apple-icon.png", await png(markSvg({ size: 512, withText: true }), 180));
// PWA 아이콘 — 홈 화면에서 크게 보이므로 워드마크 포함
out("public/icons/icon-192.png", await png(markSvg({ size: 512, withText: true }), 192));
out("public/icons/icon-512.png", await png(markSvg({ size: 512, withText: true }), 512));
// maskable — 안전 영역(안쪽 72%)에 마크가 들어가도록 여백을 준다
out("public/icons/icon-512-maskable.png", await png(markSvg({ size: 512, pad: 0.14, withText: true }), 512));
// OG
out(
  "app/opengraph-image.png",
  await sharp(Buffer.from(ogSvg())).png({ compressionLevel: 9 }).toBuffer(),
);
// 육안 검수용 (ICON_PREVIEW=1 일 때만. tmp/ 는 커밋하지 않는다)
if (process.env.ICON_PREVIEW) {
  out("tmp/icon-preview-32.png", await png(markSvg({ size: 512 }), 32));
  out("tmp/icon-preview-192.png", await png(markSvg({ size: 512, withText: true }), 192));
}
console.log("완료");
