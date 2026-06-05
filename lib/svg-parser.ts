/**
 * SVG 파싱 유틸리티
 * - 호실번호 자동 감지 (도면 PDF/DWG에서 변환된 SVG의 <text> 요소 추출)
 * - XSS 방어 (script/이벤트 핸들러 제거)
 * - viewBox 추출
 */

export interface DetectedRoom {
  id: string;        // 호실번호 (예: "3301", "3301-A")
  x: number;         // 텍스트 중심 x (SVG viewBox 좌표)
  y: number;         // 텍스트 중심 y
  bbox: { w: number; h: number };  // 텍스트 바운딩 박스 (대략 추정)
}

export interface DetectedFacility {
  type: "toilet_m" | "toilet_f" | "stairs_up" | "stairs_dn" | "elevator" | "open" | "storage" | "shower_m" | "shower_f" | "other";
  label: string;
  x: number;
  y: number;
}

export interface SvgInfo {
  viewBox: { x: number; y: number; w: number; h: number };
  rooms: DetectedRoom[];
  facilities: DetectedFacility[];
}

/* ─────────── XSS 정화 ─────────── */

/**
 * SVG에서 위험한 요소/속성 제거.
 * admin 전용 업로드라 신뢰도는 높지만 defense-in-depth.
 */
export function sanitizeSvg(svgContent: string): string {
  return svgContent
    // <script> 태그 제거
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // <foreignObject> 제거 (HTML 임베드 가능)
    .replace(/<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi, "")
    // 이벤트 핸들러 속성 제거 (onClick, onLoad 등)
    .replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, "")
    // javascript: URL 제거
    .replace(/(href|xlink:href)\s*=\s*"javascript:[^"]*"/gi, '$1=""')
    .replace(/(href|xlink:href)\s*=\s*'javascript:[^']*'/gi, "$1=''");
}

/* ─────────── viewBox 추출 ─────────── */

export function extractViewBox(svgContent: string): { x: number; y: number; w: number; h: number } | null {
  const m = svgContent.match(/viewBox\s*=\s*["']\s*([\d.\-]+)[,\s]+([\d.\-]+)[,\s]+([\d.\-]+)[,\s]+([\d.\-]+)\s*["']/i);
  if (!m) return null;
  return {
    x: parseFloat(m[1]),
    y: parseFloat(m[2]),
    w: parseFloat(m[3]),
    h: parseFloat(m[4]),
  };
}

/* ─────────── 호실/시설 자동 감지 ─────────── */

// 호실번호 패턴:
// "3301", "1101", "0101", "201" (별관) 등
// "3301-A", "1307-1", "1307-2" 등 (서브 호실)
// 또한 "3102B" 같은 alphabetic suffix 케이스도
const ROOM_REGEX = /^(\d{3,4})(-\d+|-[A-Z]|[A-Z])?$/;

const FACILITY_PATTERNS: Array<{
  type: DetectedFacility["type"];
  patterns: RegExp[];
}> = [
  { type: "toilet_m", patterns: [/^화장실\s*\(\s*남\s*\)$/, /^남자\s*화장실$/, /^남\s*W\.?C\.?$/i] },
  { type: "toilet_f", patterns: [/^화장실\s*\(\s*여\s*\)$/, /^여자\s*화장실$/, /^여\s*W\.?C\.?$/i] },
  { type: "shower_m", patterns: [/^샤워실\s*\(\s*남\s*\)$/] },
  { type: "shower_f", patterns: [/^샤워실\s*\(\s*여\s*\)$/] },
  { type: "stairs_up", patterns: [/^UP$/i] },
  { type: "stairs_dn", patterns: [/^DN$/i] },
  { type: "elevator", patterns: [/^EV$/i, /^P\.S$/i, /^엘리베이터$/, /^승강기$/] },
  { type: "open", patterns: [/^OPEN$/i] },
  { type: "storage", patterns: [/^창고$/, /^EPS$/i] },
];

/**
 * 브라우저에서 SVG content 파싱 후 호실/시설 자동 감지.
 * Node.js에서 사용 시 DOMParser polyfill 필요 (admin client에서만 사용).
 */
export function detectRoomsAndFacilities(svgContent: string): SvgInfo {
  const sanitized = sanitizeSvg(svgContent);

  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitized, "image/svg+xml");
  const svgEl = doc.querySelector("svg");

  // viewBox
  let viewBox = extractViewBox(sanitized);
  if (!viewBox && svgEl) {
    const w = parseFloat(svgEl.getAttribute("width") ?? "1000");
    const h = parseFloat(svgEl.getAttribute("height") ?? "800");
    viewBox = { x: 0, y: 0, w, h };
  }

  const rooms: DetectedRoom[] = [];
  const facilities: DetectedFacility[] = [];

  if (svgEl) {
    const textNodes = svgEl.querySelectorAll("text");
    for (const t of Array.from(textNodes)) {
      const raw = (t.textContent ?? "").trim();
      if (!raw) continue;

      // 좌표 추출
      const x = parseFloat(t.getAttribute("x") ?? "0");
      const y = parseFloat(t.getAttribute("y") ?? "0");
      if (isNaN(x) || isNaN(y)) continue;

      // transform="translate(...)" 처리 (간단 케이스)
      let tx = 0, ty = 0;
      const transform = t.getAttribute("transform");
      if (transform) {
        const tm = transform.match(/translate\(\s*([\d.\-]+)[,\s]+([\d.\-]+)\s*\)/);
        if (tm) {
          tx = parseFloat(tm[1]) || 0;
          ty = parseFloat(tm[2]) || 0;
        }
      }

      // 폰트 크기로 bbox 추정
      const fontSize = parseFloat(t.getAttribute("font-size") ?? "12") || 12;
      const bboxW = raw.length * fontSize * 0.6;
      const bboxH = fontSize * 1.2;

      // 호실번호 매칭?
      const roomMatch = raw.match(ROOM_REGEX);
      if (roomMatch) {
        rooms.push({
          id: raw,
          x: x + tx,
          y: y + ty,
          bbox: { w: bboxW, h: bboxH },
        });
        continue;
      }

      // 시설 매칭?
      for (const fac of FACILITY_PATTERNS) {
        if (fac.patterns.some((p) => p.test(raw))) {
          facilities.push({
            type: fac.type,
            label: raw,
            x: x + tx,
            y: y + ty,
          });
          break;
        }
      }
    }
  }

  return {
    viewBox: viewBox ?? { x: 0, y: 0, w: 1000, h: 800 },
    rooms,
    facilities,
  };
}

/* ─────────── 자동 regionsJson 생성 ─────────── */

/**
 * 감지된 호실 텍스트 주변에 클릭 영역(직사각형 다각형) 자동 생성.
 * admin은 결과 검토 후 필요시 영역 확장.
 */
export function detectedRoomsToRegions(
  rooms: DetectedRoom[],
  paddingFactor: number = 2.5
): { rooms: Array<{ id: string; polygon: [number, number][]; label: string }> } {
  return {
    rooms: rooms.map((r) => {
      // bbox 기준으로 padding 적용한 직사각형 영역
      const halfW = (r.bbox.w * paddingFactor) / 2;
      const halfH = (r.bbox.h * paddingFactor) / 2;
      return {
        id: r.id,
        polygon: [
          [Math.round(r.x - halfW), Math.round(r.y - halfH)],
          [Math.round(r.x + halfW), Math.round(r.y - halfH)],
          [Math.round(r.x + halfW), Math.round(r.y + halfH)],
          [Math.round(r.x - halfW), Math.round(r.y + halfH)],
        ] as [number, number][],
        label: `${r.id}호`,
      };
    }),
  };
}
