/**
 * 매뉴얼 마크다운 → 인쇄용 PDF.
 *
 * 실행: node scripts/make-manual-pdf.mjs
 * 출력: docs/manual/pdf/*.pdf
 *
 * 헤드리스 크롬으로 찍는다. 별도 프로필(--user-data-dir)을 주지 않으면
 * 사용자가 켜 둔 크롬과 충돌해 응답 없이 멈춘다.
 * 쪽 번호가 있는 머리말·꼬리말은 CLI 로는 못 넣어서 DevTools 프로토콜로 붙인다
 * (Node 22 의 내장 WebSocket 사용 — 의존성 없음).
 */
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "docs/manual");
const OUT = path.join(SRC, "pdf");
const TMP = path.join(OUT, ".build");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// 표지·머리말에 쓰는 색. 화면용 형광 시안(#5ce1e6)은 흰 종이에서 안 보여 진한 청록을 쓴다.
const NAVY = "#062e6e";
const INK = "#0f172a";
const ACCENT = "#0e7490";

/** 만들 문서: 본문 1개 + 뒤에 붙일 부록들 */
const BOOKS = [
  {
    file: "학생용-사용법.pdf",
    title: "학생회 사이트 사용 설명서",
    subtitle: "학생용",
    parts: ["학생용-사용법.md"],
  },
  {
    file: "관리자-운영매뉴얼.pdf",
    title: "학생회 사이트 운영 매뉴얼",
    subtitle: "관리자용 · 부록 포함",
    parts: ["관리자-운영매뉴얼.md", "부록A-규칙과-한도.md", "부록B-오류-문구-사전.md"],
  },
];

// ────────────────────────────── 마크다운 → HTML

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** GitHub 방식 앵커: 소문자화, 낱말·공백·하이픈만 남기고 공백을 하이픈으로 */
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[^\p{L}\p{N} -]/gu, "")
    .trim()
    .replace(/\s+/g, "-");

function inline(s, imgBase) {
  const code = [];
  let t = esc(s).replace(/`([^`]+)`/g, (_, c) => `\u0000${code.push(c) - 1}\u0000`);
  // 이미지 먼저 (링크와 문법이 겹친다)
  t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    const abs = /^https?:/.test(src) ? src : "file://" + path.join(imgBase, src);
    return `<img src="${abs}" alt="${alt}">`;
  });
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, txt, href) => `<a href="${href}">${txt}</a>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${code[Number(i)]}</code>`);
}

/** 표 한 줄을 칸으로 (양끝 파이프 제거) */
const cells = (line) =>
  line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());

function mdToHtml(md, { imgBase, headingOffset = 0 }) {
  const lines = md.split("\n");
  const out = [];
  let i = 0;

  const closeList = (stack) => { while (stack.length) out.push(stack.pop() === "ol" ? "</ol>" : "</ul>"); };
  const listStack = [];

  while (i < lines.length) {
    const line = lines[i];

    // 코드 블록
    if (/^```/.test(line)) {
      closeList(listStack);
      const body = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(body.join("\n"))}</code></pre>`);
      continue;
    }

    // 표 — 헤더 다음 줄이 구분선일 때만
    if (/^\s*\|/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? "")) {
      closeList(listStack);
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c, imgBase)}</th>`).join("")}</tr></thead><tbody>` +
          rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c, imgBase)}</td>`).join("")}</tr>`).join("") +
          `</tbody></table>`,
      );
      continue;
    }

    // 인용 — 연속된 > 를 한 덩이로. ⚠️ 가 들어 있으면 경고 상자로.
    if (/^>\s?/.test(line)) {
      closeList(listStack);
      const body = [];
      while (i < lines.length && /^>/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ""));
      const text = body.join("\n");
      const paras = text.split(/\n\s*\n/).map((p) => `<p>${inline(p.trim().replace(/\n/g, "<br>"), imgBase)}</p>`);
      const warn = /⚠️|절대|반드시|되돌릴 수 없/.test(text);
      out.push(`<blockquote class="${warn ? "warn" : ""}">${paras.join("")}</blockquote>`);
      continue;
    }

    // 제목
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      closeList(listStack);
      const level = Math.min(6, h[1].length + headingOffset);
      out.push(`<h${level} id="${slug(h[2])}">${inline(h[2], imgBase)}</h${level}>`);
      i++;
      continue;
    }

    // 구분선
    if (/^\s*---+\s*$/.test(line)) {
      closeList(listStack);
      out.push('<hr>');
      i++;
      continue;
    }

    // 목록 (들여쓰기 1단계까지)
    const li = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (li) {
      const depth = Math.floor(li[1].length / 3);
      const kind = /^\d/.test(li[2]) ? "ol" : "ul";
      while (listStack.length > depth + 1) out.push(listStack.pop() === "ol" ? "</ol>" : "</ul>");
      if (listStack.length === depth + 1 && listStack[depth] !== kind) {
        out.push(listStack.pop() === "ol" ? "</ol>" : "</ul>");
      }
      while (listStack.length < depth + 1) { out.push(`<${kind}>`); listStack.push(kind); }
      const done = li[3].replace(/^\[([ x])\]\s*/, (_, c) => (c === "x" ? "☑ " : "☐ "));
      out.push(`<li>${inline(done, imgBase)}</li>`);
      i++;
      continue;
    }

    // 빈 줄
    if (!line.trim()) { closeList(listStack); i++; continue; }

    // 문단 (이미지 한 장만 있으면 figure 로)
    closeList(listStack);
    const only = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (only) {
      const abs = "file://" + path.join(imgBase, only[2]);
      out.push(`<figure><img src="${abs}" alt="${only[1]}"><figcaption>${esc(only[1])}</figcaption></figure>`);
      i++;
      continue;
    }
    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>|\s*[-*]\s|\s*\d+\.\s|\s*\||```|\s*---+\s*$)/.test(lines[i])) {
      para.push(lines[i++]);
    }
    out.push(`<p>${inline(para.join(" "), imgBase)}</p>`);
  }
  closeList(listStack);
  return out.join("\n");
}

// ────────────────────────────── 조판

function styles() {
  return `
  @page { size: A4; margin: 20mm 16mm 18mm; }
  @page :first { margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; color: ${INK}; font-size: 10.5pt; line-height: 1.75;
         font-family: "Apple SD Gothic Neo", Pretendard, "Noto Sans KR", sans-serif;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* 표지 */
  .cover { position: relative; height: 297mm; width: 210mm; overflow: hidden;
           background: linear-gradient(150deg, #0a3a86 0%, ${NAVY} 55%, #041c46 100%);
           color: #fff; page-break-after: always; }
  .cover .gear { position: absolute; right: -40mm; bottom: -45mm; opacity: .1; }
  .cover .inner { position: absolute; left: 24mm; right: 24mm; top: 92mm; }
  .cover .kicker { font-size: 12pt; font-weight: 700; letter-spacing: .06em; color: #5ce1e6; margin: 0 0 10mm; }
  .cover h1 { font-size: 34pt; font-weight: 800; line-height: 1.25; margin: 0 0 6mm; letter-spacing: -.02em;
              color: #fff; border: 0; padding: 0; page-break-before: avoid; }
  .cover .sub { font-size: 14pt; opacity: .85; margin: 0; }
  .cover .foot { position: absolute; left: 24mm; bottom: 24mm; font-size: 10pt; opacity: .8; }
  .cover .foot strong { color: #5ce1e6; font-weight: 700; }

  /* 목차 */
  .toc { page-break-after: always; }
  .toc h2 { border: 0; padding: 0; margin: 0 0 8mm; font-size: 20pt; page-break-before: avoid; }
  .toc ol { list-style: none; margin: 0; padding: 0; counter-reset: toc; }
  .toc li { display: flex; align-items: baseline; gap: 3mm; padding: 2.6mm 0;
            border-bottom: 1px dotted #cbd5e1; font-size: 11pt; }
  .toc li a { color: ${INK}; text-decoration: none; font-weight: 600; }
  .toc li .no { color: ${ACCENT}; font-weight: 800; font-variant-numeric: tabular-nums; min-width: 9mm; }
  .toc li.ap { margin-top: 1mm; }
  .toc li.ap a { color: ${NAVY}; }

  /* 본문 */
  /* h1 = 문서·부록 표제, h2 = 장(쪽을 새로 시작), h3 = 절, h4 = 항 */
  h1 { font-size: 24pt; font-weight: 800; color: ${NAVY}; letter-spacing: -.02em;
       margin: 0 0 7mm; padding-bottom: 3.5mm; border-bottom: 3px solid ${NAVY}; page-break-before: always; }
  h2 { font-size: 17pt; font-weight: 800; color: ${NAVY}; letter-spacing: -.015em;
       margin: 0 0 5mm; padding-bottom: 2.5mm; border-bottom: 1.5px solid #c7d2e4;
       page-break-before: always; page-break-after: avoid; }
  h3 { font-size: 12pt; font-weight: 800; color: #16324f; margin: 8mm 0 2.8mm;
       padding-left: 3mm; border-left: 3px solid ${ACCENT}; page-break-after: avoid; }
  h4 { font-size: 10.5pt; font-weight: 700; color: #334155; margin: 6mm 0 2mm; page-break-after: avoid; }
  h1 + p, h2 + p, h3 + p { margin-top: 0; }
  /* 표제 바로 뒤에 오는 장은 쪽을 새로 시작하지 않는다 (빈 쪽 방지) */
  h1 + h2, h2.nobreak { page-break-before: avoid; }
  p { margin: 0 0 3.2mm; }
  ul, ol { margin: 0 0 3.5mm; padding-left: 6mm; }
  li { margin: 1.2mm 0; }
  li > ul, li > ol { margin: 1.2mm 0 0; }
  a { color: ${ACCENT}; text-decoration: none; }
  hr { border: 0; border-top: 1px solid #e2e8f0; margin: 7mm 0; }
  strong { font-weight: 700; color: #0b1324; }
  code { font-family: "SF Mono", Menlo, monospace; font-size: 9pt;
         background: #eef2f7; border: 1px solid #dde5ee; border-radius: 3px; padding: .4mm 1.2mm; }
  pre { background: #f6f8fb; border: 1px solid #e2e8f0; border-left: 3px solid ${ACCENT};
        border-radius: 4px; padding: 4mm; overflow: hidden; page-break-inside: avoid; margin: 0 0 4mm; }
  pre code { background: none; border: 0; padding: 0; font-size: 8.6pt; line-height: 1.6; }

  table { width: 100%; border-collapse: collapse; margin: 0 0 5mm; font-size: 9.6pt;
          page-break-inside: avoid; }
  th { background: ${NAVY}; color: #fff; font-weight: 700; text-align: left;
       padding: 2.4mm 2.6mm; border: 1px solid ${NAVY}; }
  td { padding: 2.2mm 2.6mm; border: 1px solid #dbe3ec; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #f7f9fc; }
  td code { font-size: 8.4pt; }

  blockquote { margin: 0 0 4.5mm; padding: 3.2mm 4mm; background: #f1f5f9;
               border-left: 4px solid #94a3b8; border-radius: 0 4px 4px 0; page-break-inside: avoid; }
  blockquote.warn { background: #fff7ed; border-left-color: #ea8a1f; }
  blockquote p:last-child { margin-bottom: 0; }

  figure { margin: 0 0 5mm; page-break-inside: avoid; text-align: center; }
  figure img { max-width: 100%; border: 1px solid #dbe3ec; border-radius: 5px; }
  figcaption { font-size: 8.6pt; color: #64748b; margin-top: 1.6mm; }
  p img { max-width: 100%; border: 1px solid #dbe3ec; border-radius: 5px; }
  `;
}

const gearSvg = () => {
  const r = 260;
  const teeth = Array.from({ length: 8 }, (_, i) =>
    `<rect x="${-r * 0.11}" y="${-r * 1.34}" width="${r * 0.22}" height="${r * 0.38}" rx="${r * 0.06}" transform="rotate(${i * 45})"/>`,
  ).join("");
  return `<svg class="gear" width="620" height="620" viewBox="-310 -310 620 620">
    <g fill="#5ce1e6"><circle r="${r}"/>${teeth}<circle r="${r * 0.42}" fill="#041c46"/></g></svg>`;
};

function cover(book, dateText) {
  return `<section class="cover">${gearSvg()}
    <div class="inner">
      <p class="kicker">KAIST 기계공학과 학생회</p>
      <h1>${esc(book.title)}</h1>
      <p class="sub">${esc(book.subtitle)}</p>
    </div>
    <div class="foot"><strong>mesc-website.vercel.app</strong><br>${dateText} 기준</div>
  </section>`;
}

function toc(entries) {
  const rows = entries
    .map((e, n) => `<li class="${e.appendix ? "ap" : ""}"><span class="no">${e.appendix ? "·" : String(n + 1).padStart(2, "0")}</span><a href="#${e.id}">${esc(e.text)}</a></li>`)
    .join("");
  return `<section class="toc"><h2>목차</h2><ol>${rows}</ol></section>`;
}

// ────────────────────────────── 크롬 (DevTools 프로토콜)

async function printPdf(htmlPath, pdfPath, title) {
  const port = 9200 + Math.floor(Math.random() * 400);
  const profile = path.join(TMP, `profile-${port}`);
  const chrome = spawn(CHROME, [
    "--headless", "--disable-gpu", "--no-sandbox", "--no-first-run",
    "--disable-extensions", "--mute-audio",
    `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`,
    "about:blank",
  ], { stdio: "ignore" });

  try {
    // 디버깅 포트가 열릴 때까지 짧게 재시도.
    // 브라우저 수준 소켓에는 Page 도메인이 없다 — 반드시 "page" 대상에 붙어야 한다.
    let ws = null;
    for (let n = 0; n < 60 && !ws; n++) {
      await new Promise((r) => setTimeout(r, 250));
      try {
        const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
        ws = list.find((t) => t.type === "page")?.webSocketDebuggerUrl ?? null;
      } catch { /* 아직 안 떴다 */ }
    }
    if (!ws) throw new Error("크롬 탭에 연결하지 못했습니다.");

    const sock = new WebSocket(ws);
    await new Promise((res, rej) => { sock.onopen = res; sock.onerror = () => rej(new Error("크롬 연결 실패")); });

    let id = 0;
    const pending = new Map();
    const loaded = { done: false, wake: null };
    sock.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const { res, rej } = pending.get(m.id);
        pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      }
      if (m.method === "Page.loadEventFired") { loaded.done = true; loaded.wake?.(); }
    };
    const send = (method, params = {}) =>
      new Promise((res, rej) => { const n = ++id; pending.set(n, { res, rej }); sock.send(JSON.stringify({ id: n, method, params })); });

    await send("Page.enable");
    await send("Page.navigate", { url: "file://" + htmlPath });
    if (!loaded.done) await new Promise((r) => { loaded.wake = r; setTimeout(r, 20000); });
    await new Promise((r) => setTimeout(r, 900)); // 이미지·폰트가 자리 잡을 시간

    const foot = `<div style="width:100%;font-size:7.5pt;color:#94a3b8;
      font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;padding:0 16mm;
      display:flex;justify-content:space-between;">
      <span>${title}</span><span class="pageNumber"></span></div>`;

    const { data } = await send("Page.printToPDF", {
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: foot,
      marginTop: 0.79, marginBottom: 0.71, marginLeft: 0.63, marginRight: 0.63,
    });
    await writeFile(pdfPath, Buffer.from(data, "base64"));
    sock.close();
  } finally {
    chrome.kill("SIGTERM");
  }
}

// ────────────────────────────── 본체

const dateText = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

await rm(TMP, { recursive: true, force: true });
await mkdir(TMP, { recursive: true });

for (const book of BOOKS) {
  // 부록으로 묶는 문서끼리는 파일 링크를 같은 PDF 안의 앵커로 바꾼다
  const anchors = new Map();
  const bodies = [];
  for (const part of book.parts) {
    const md = await readFile(path.join(SRC, part), "utf8");
    const h1 = md.match(/^#\s+(.*)$/m);
    if (h1) anchors.set(part, slug(h1[1]));
    bodies.push(md);
  }

  let html = "";
  const tocEntries = [];
  bodies.forEach((md, n) => {
    let fixed = md;
    for (const [file, id] of anchors) fixed = fixed.split(`(${file})`).join(`(#${id})`);
    // 같은 PDF 에 없는 문서로의 링크는 텍스트만 남긴다
    fixed = fixed.replace(/\[([^\]]+)\]\((?!#|https?:)[^)]*\.md\)/g, "$1");
    fixed = fixed.replace(/\[([^\]]+)\]\(cardnews\/?\)/g, "$1");
    // 문서 안의 "## 목차" 절은 PDF 앞머리 목차와 겹친다 — 다음 구분선까지 들어낸다.
    fixed = fixed.replace(/\n## 목차\n[\s\S]*?\n---\n/, "\n");

    const rendered = mdToHtml(fixed, { imgBase: SRC });
    // 본문 첫 제목은 표지에 이미 있다 — 중복이라 뺀다.
    // 첫 장은 머리말 바로 아래에 붙인다 (앞머리가 거의 빈 쪽으로 남지 않게)
    html += n === 0
      ? rendered.replace(/<h1 [^>]*>.*?<\/h1>\n?/, "").replace("<h2 ", '<h2 class="nobreak" ')
      : rendered;

    // 목차는 본문의 h1(문서 제목)과 h2(장)로 만든다
    const re = /<h([12]) [^>]*id="([^"]+)"[^>]*>(.*?)<\/h[12]>/g;
    let m;
    while ((m = re.exec(rendered))) {
      const level = Number(m[1]);
      const text = m[3].replace(/<[^>]+>/g, "").trim();
      if (n === 0 && level === 1) continue;        // 본문 제목은 표지에 있다
      if (n > 0 && level === 2) continue;          // 부록은 표제만 (하위 절은 생략)
      if (/^목차$/.test(text)) continue;
      tocEntries.push({ id: m[2], text, appendix: n > 0 });
    }
  });

  const page = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
    <title>${esc(book.title)}</title><style>${styles()}</style></head><body>
    ${cover(book, dateText)}${toc(tocEntries)}${html}</body></html>`;

  const htmlPath = path.join(TMP, book.file.replace(/\.pdf$/, ".html"));
  await writeFile(htmlPath, page, "utf8");
  await mkdir(OUT, { recursive: true });
  const pdfPath = path.join(OUT, book.file);
  await printPdf(htmlPath, pdfPath, book.title);
  console.log("생성:", path.relative(ROOT, pdfPath));
}

await rm(TMP, { recursive: true, force: true });
console.log("\n완료 —", path.relative(ROOT, OUT));
