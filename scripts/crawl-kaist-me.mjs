// KAIST 기계공학과 공식 사이트(https://me.kaist.ac.kr) 크롤러
//   - 교수진: /team/team_010100.html?page=1,2 에서 uid 추출 → /pop/team.html?uid=N&LANGUAGE_TYPE=kor|eng
//   - 교과목: /education/education_010100.html 1회
//
// 결과: data/kaist-me-professors.json, data/kaist-me-courses.json
//
// 사용:
//   node scripts/crawl-kaist-me.mjs
//
// 재실행 가능(멱등). 요청 간 250ms 딜레이, 실패 시 1회 재시도.

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE = "https://me.kaist.ac.kr";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) KAIST-MESC-website-crawler/1.0 (+kaist.mesc@gmail.com)";
const DELAY_MS = 300;
const RESEARCH_AREA_MAX = 200;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "data");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── HTTP ──────────────────────────────────────────────────
async function fetchText(url, { retries = 1 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "text/html" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(600);
    }
  }
}

// ── HTML helpers ─────────────────────────────────────────
function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&middot;/g, "·");
}

function clean(s) {
  if (s == null) return null;
  const out = decodeEntities(s).replace(/\s+/g, " ").trim();
  return out.length ? out : null;
}

function stripTags(s) {
  if (s == null) return null;
  return clean(s.replace(/<[^>]*>/g, " "));
}

// ── 교수 상세 파싱 ────────────────────────────────────────
// <p class="dist">교수</p><p class="name">강준상</p>
// <dl><dt>연구분야</dt><dd>...</dd></dl> ... <dt>Office</dt><dd>기계동(N7) 6114</dd>
function parseProfessorDetail(html) {
  const dist = stripTags((html.match(/<p class="dist">([\s\S]*?)<\/p>/) || [])[1]);
  const name = stripTags((html.match(/<p class="name">([\s\S]*?)<\/p>/) || [])[1]);

  const img = (html.match(/background-image:url\(([^)]+)\)/) || [])[1] || null;
  let imageUrl = img ? img.trim().replace(/^['"]|['"]$/g, "") : null;
  // http→https 정규화 (https 사이트에서 mixed content 차단 방지)
  if (imageUrl) {
    if (imageUrl.startsWith("//")) imageUrl = "https:" + imageUrl;
    else if (imageUrl.startsWith("/")) imageUrl = BASE + imageUrl;
    else imageUrl = imageUrl.replace(/^http:\/\//i, "https://");
  }

  // dt/dd 페어를 라벨→값 맵으로
  const rows = {};
  const dlRe = /<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g;
  let m;
  while ((m = dlRe.exec(html))) {
    const label = stripTags(m[1]);
    if (label) rows[label] = m[2]; // 값은 원본(HTML) 보존 — 링크 추출용
  }

  const pick = (...labels) => {
    for (const l of labels) if (rows[l] != null) return rows[l];
    return null;
  };

  const researchRaw = stripTags(pick("연구분야", "Research Area"));
  const websiteHtml = pick("연구실 웹사이트", "Laboratory Web-site");
  const websiteUrl = websiteHtml
    ? (websiteHtml.match(/href="([^"]+)"/) || [])[1] || null
    : null;
  const emailHtml = pick("E-mail", "E-Mail", "Email");
  const email = emailHtml
    ? (emailHtml.match(/mailto:([^"?]+)/) || [, stripTags(emailHtml)])[1] || null
    : null;
  const phone = stripTags(pick("Phone", "전화"));
  const officeRaw = stripTags(pick("Office", "오피스"));
  const labName = stripTags(pick("연구실", "Laboratory"));
  const degree = stripTags(pick("최종학위", "Education"));

  return {
    title: dist,
    name,
    imageUrl,
    researchArea: researchRaw,
    websiteUrl,
    email: email ? email.trim() : null,
    phone,
    officeRaw,
    labName,
    degree,
  };
}

// Office 문자열 → { isN7, roomNumber }
//   "기계동(N7) 6114" / "ME Bldg(N7) 6114" → N7, 6114
//   다른 건물이면 isN7=false 이지만 roomNumber 는 최대한 추출
function parseOffice(officeRaw) {
  if (!officeRaw) return { isN7: false, roomNumber: null, buildingHint: null };
  const isN7 = /\bN7\b/i.test(officeRaw) || /기계동|기계공학동/.test(officeRaw);
  // 괄호 뒤 첫 방번호(선택적 앞 알파벳 + 숫자 + 선택적 뒤 알파벳): "6114", "C323"
  let roomNumber = (officeRaw.match(/\)\s*([A-Za-z]?[0-9]{3,4}[A-Za-z]?)/) || [])[1] || null;
  if (!roomNumber) roomNumber = (officeRaw.match(/\b([A-Za-z]?[0-9]{3,4}[A-Za-z]?)\b/) || [])[1] || null;
  const buildingHint = (officeRaw.match(/^([^()]+?)\s*\(/) || [])[1] || null;
  return { isN7, roomNumber, buildingHint: buildingHint ? buildingHint.trim() : null };
}

// 영문 팀 리스트에서 uid → 영문 이름 맵을 만든다.
//   국문 상세 팝업(/pop/team.html)은 LANGUAGE_TYPE 파라미터를 무시하고 이름을 국문으로만 준다.
//   영문 이름은 별도 /eng/ 리스트 페이지의 txt 앵커(style="color:#222")에만 존재.
async function crawlEnglishNames() {
  const map = {};
  for (const page of [1, 2]) {
    const url = `${BASE}/eng/team/team_010100.html?page=${page}`;
    const html = await fetchText(url, { retries: 1 });
    await sleep(DELAY_MS);
    // txt 앵커: uid=N ... style="color:#222"> ... <p class="name"> NAME <span
    const re =
      /uid=(\d+)&LANGUAGE_TYPE=eng"[^>]*style="color:#222"[^>]*>[\s\S]*?<p class="name">\s*([^<]+)/g;
    let m;
    let n = 0;
    while ((m = re.exec(html))) {
      const uid = Number(m[1]);
      const nameEn = clean(m[2]);
      if (nameEn && !map[uid]) {
        map[uid] = nameEn;
        n++;
      }
    }
    console.log(`[crawl] eng team page ${page}: 영문 이름 ${n}개`);
  }
  return map;
}

async function crawlProfessors() {
  // 1) uid 목록 수집 (page 1,2)
  const uids = [];
  const seen = new Set();
  for (const page of [1, 2]) {
    const url = `${BASE}/team/team_010100.html?page=${page}`;
    const html = await fetchText(url, { retries: 1 });
    await sleep(DELAY_MS);
    const re = /pop\/team\.html\?uid=(\d+)/g;
    let m;
    while ((m = re.exec(html))) {
      const uid = Number(m[1]);
      if (!seen.has(uid)) {
        seen.add(uid);
        uids.push(uid);
      }
    }
    console.log(`[crawl] team page ${page}: 누적 uid ${uids.length}개`);
  }

  // 2) 영문 이름 맵
  const engNames = await crawlEnglishNames();

  const professors = [];
  const failures = [];
  for (const uid of uids) {
    try {
      const korUrl = `${BASE}/pop/team.html?uid=${uid}&LANGUAGE_TYPE=kor`;
      const korHtml = await fetchText(korUrl, { retries: 1 });
      await sleep(DELAY_MS);

      const kor = parseProfessorDetail(korHtml);
      const office = parseOffice(kor.officeRaw);

      let researchArea = kor.researchArea || null;
      let researchTruncated = false;
      if (researchArea && researchArea.length > RESEARCH_AREA_MAX) {
        researchArea = researchArea.slice(0, RESEARCH_AREA_MAX);
        researchTruncated = true;
      }

      const prof = {
        uid,
        name: kor.name || null,
        nameEn: engNames[uid] || null,
        title: kor.title || "교수",
        email: kor.email || null,
        phone: kor.phone || null,
        researchArea,
        researchTruncated,
        websiteUrl: kor.websiteUrl || null,
        imageUrl: kor.imageUrl || null,
        labName: kor.labName || null,
        degree: kor.degree || null,
        officeRaw: kor.officeRaw || null,
        office,
      };
      professors.push(prof);
      console.log(
        `  uid=${uid} ✓ ${prof.name} / ${prof.nameEn ?? "?"} (${prof.title}) office=${prof.officeRaw ?? "-"}`
      );
    } catch (err) {
      failures.push({ uid, error: String(err) });
      console.warn(`  uid=${uid} ✗ ${err}`);
    }
  }
  const noEng = professors.filter((p) => !p.nameEn).map((p) => p.name);
  if (noEng.length) console.log(`[crawl] 영문 이름 누락 ${noEng.length}명: ${noEng.join(", ")}`);
  return { professors, failures };
}

// ── 교과목 파싱 ───────────────────────────────────────────
function parseCourses(html) {
  // desc_box 매핑: <div id="ME106"> ... <p class="tit">...</p> <span class="kor">DESC</span><span class="eng">DESCEN</span>
  const descMap = {};
  const descBox = (html.match(/<div class="desc_box hidden">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/) || [])[1] ||
    html.slice(html.indexOf('class="desc_box'));
  const descBlockRe = /<div id="([A-Za-z0-9_]+)">([\s\S]*?)(?=<div id="[A-Za-z0-9_]+">|$)/g;
  let dm;
  while ((dm = descBlockRe.exec(descBox))) {
    const id = dm[1];
    const body = dm[2];
    // <p class="tit"> 이후의 kor/eng span 이 설명
    const afterTit = body.replace(/<p class="tit">[\s\S]*?<\/p>/, "");
    const kor = stripTags((afterTit.match(/<span class="kor">([\s\S]*?)<\/span>/) || [])[1]);
    const eng = stripTags((afterTit.match(/<span class="eng">([\s\S]*?)<\/span>/) || [])[1]);
    descMap[id] = { kor, eng };
  }

  const courses = [];
  const rowRe = /<tr[^>]*class="tooltip"[^>]*data-tooltip-content="#([A-Za-z0-9_]+)"[^>]*>([\s\S]*?)<\/tr>/g;
  let r;
  let order = 0;
  while ((r = rowRe.exec(html))) {
    const tipId = r[1];
    const row = r[2];
    const code = (row.match(/ME\.\d+/) || [])[0] || null;
    if (!code) continue;

    // 과목명 버튼: data-tooltip-content 뒤에 kor/eng span 을 가진 버튼
    const nameM = row.match(
      /data-tooltip-content="#[A-Za-z0-9_]+">\s*<span class="kor">([\s\S]*?)<\/span>\s*<span class="eng">([\s\S]*?)<\/span>/
    );
    const name = nameM ? stripTags(nameM[1]) : null;
    const nameEn = nameM ? stripTags(nameM[2]) : null;

    const creditRaw = stripTags((row.match(/<center>([\s\S]*?)<\/center>/) || [])[1]);
    // 개설학기: <td> 직속 kor/eng span (버튼 아님)
    const semM = row.match(/<td>\s*<span class="kor">([\s\S]*?)<\/span>\s*<span class="eng">([\s\S]*?)<\/span>\s*<\/td>/);
    const semester = semM ? stripTags(semM[1]) : null;
    const semesterEn = semM ? stripTags(semM[2]) : null;

    const yt = (row.match(/href="(https?:\/\/[^"]*(?:youtu\.be|youtube\.com)[^"]*)"/) || [])[1] || null;

    const desc = descMap[tipId] || {};
    courses.push({
      code,
      tipId,
      name,
      nameEn,
      creditRaw,
      semester,
      semesterEn,
      youtubeUrl: yt,
      description: desc.kor || null,
      descriptionEn: desc.eng || null,
      order: order++,
    });
  }
  return courses;
}

async function crawlCourses() {
  const url = `${BASE}/education/education_010100.html`;
  const html = await fetchText(url, { retries: 1 });
  await sleep(DELAY_MS);
  const courses = parseCourses(html);
  console.log(`[crawl] 교과목 ${courses.length}개`);
  const missingDesc = courses.filter((c) => !c.description).length;
  const withYt = courses.filter((c) => c.youtubeUrl).length;
  console.log(`  설명 없는 과목 ${missingDesc}개, 유튜브 링크 ${withYt}개`);
  return courses;
}

// ── main ─────────────────────────────────────────────────
async function main() {
  await mkdir(DATA_DIR, { recursive: true });

  console.log("=== 교수진 크롤 시작 ===");
  const { professors, failures } = await crawlProfessors();
  await writeFile(
    path.join(DATA_DIR, "kaist-me-professors.json"),
    JSON.stringify(professors, null, 2) + "\n",
    "utf8"
  );
  console.log(`[crawl] 교수 ${professors.length}명 저장, 실패 ${failures.length}건`);
  if (failures.length) console.log(JSON.stringify(failures, null, 2));

  console.log("\n=== 교과목 크롤 시작 ===");
  const courses = await crawlCourses();
  await writeFile(
    path.join(DATA_DIR, "kaist-me-courses.json"),
    JSON.stringify(courses, null, 2) + "\n",
    "utf8"
  );
  console.log(`[crawl] 교과목 ${courses.length}개 저장`);

  console.log("\n완료. data/kaist-me-professors.json, data/kaist-me-courses.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
