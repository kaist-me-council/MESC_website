#!/usr/bin/env python3
"""
기계공학동(N7) 1~7층 CAD PDF -> 스타일화된 실내지도 PNG + 호실/교수 핀 좌표.

파이프라인 (재실행 가능):
  1. pdftotext -bbox 로 방번호 라벨(<level>NNN[A-Z]?) 추출·코드별 중복 병합
  2. 라벨 클러스터를 seed 로, 렌더 래스터에서 건물 외벽까지 성장(공백 gap·거리 cap 제한)
     -> 치수선/타이틀블록/원경 상세도는 잘리고 방번호·벽만 남는 타이트 크롭
  3. 크롭을 그레이스케일 -> 어두운 정도를 알파로, 선색은 단일 slate 톤으로 통일
     -> 투명 배경 + 단색 라인워크 PNG (CAD 느낌 제거, 웹 배경 자유·라이트/다크 대응)
  4. 크롭 기준 정규화(0~1, 좌상단 원점) 좌표를 dev.db 에 반영:
       - Professor.posX/posY  (roomNumber 정확 매칭, 같은 방 다중 교수는 posX 소량 오프셋)
       - Room.posX/posY       (Room.code 정확 매칭, 같은 층만; 라벨 없는 방은 NULL 유지)
       - BuildingFloor.imageUrl/width/height (최종 PNG 픽셀 크기)

사용: python3 scripts/build-floorplans.py [--dry]
  --dry : DB 미반영, 추출/매칭 리포트만 출력 (PNG 는 항상 생성)
"""
import subprocess, re, sqlite3, os, sys, math
from collections import defaultdict
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = "/Users/an-yeonsu/Downloads/기계공학동 도면 (1)"
OUT_DIR = os.path.join(ROOT, "public", "floorplans")
DB = os.path.join(ROOT, "dev.db")

DPI = 200                 # 렌더 해상도 (크롭·성장 분석 공용)
MAX_LONG_SIDE = 2200      # 최종 PNG 긴 변 상한 px (초과 시 LANCZOS 축소)
BUILDING_ID = 1           # 기계공학동
ROOM_OFFSET = 0.008       # 같은 방 다중 교수 posX 간격(정규화)

# --- 크롭 성장 파라미터 (pt 단위) ---
INK_THR = 160             # gray < INK_THR = 선(ink)
HEXP_MOD = 0.7            # 라벨 유니온 수평 여유 = HEXP_MOD * 방모듈
GROW_CAP_MOD = 2.1        # 라벨 밴드에서 벽까지 성장 상한 = CAP * 방모듈
GROW_GAP_PT = 7           # 이만큼 연속 공백이면 벽 바깥으로 판단, 성장 정지
EMPTY_FRAC = 0.004        # 한 행/열 ink 비율이 이 미만이면 공백

# --- 스타일화 ---
LINE_COLOR = (100, 116, 139)  # slate-500. 라이트/다크 배경 모두 판독됨
ALPHA_LO = 25             # 이 미만 어둠(옅은 잡선)은 알파 0 으로
ALPHA_GAIN = 1.6          # 알파 대비 (벽=진한 선 또렷하게)
ALPHA_LEVELS = 64         # 알파 양자화 단계(P+tRNS 저장, 파일 축소)

DRY = "--dry" in sys.argv


def words(pdf):
    xml = subprocess.run(["pdftotext", "-bbox", pdf, "-"],
                         capture_output=True, text=True).stdout
    return re.findall(
        r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>',
        xml)


def label_boxes(pdf, level):
    """{code: (xMin,yMin,xMax,yMax,cx,cy)} in pt, 코드별 인스턴스 평균."""
    inst = defaultdict(list)
    for a, b, c, d, txt in words(pdf):
        m = re.match(rf'^({level}\d{{3}}[A-Za-z]?)$', txt.strip())
        if not m:
            continue
        inst[m.group(1)].append(tuple(map(float, (a, b, c, d))))
    out = {}
    for code, bs in inst.items():
        cx = sum((x[0] + x[2]) / 2 for x in bs) / len(bs)
        cy = sum((x[1] + x[3]) / 2 for x in bs) / len(bs)
        w = sum(x[2] - x[0] for x in bs) / len(bs)
        h = sum(x[3] - x[1] for x in bs) / len(bs)
        out[code] = (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, cx, cy)
    return out


def module_pt(boxes):
    """방 모듈(pt) = 라벨 중심들의 최근접거리 중앙값."""
    cs = [(v[4], v[5]) for v in boxes.values()]
    ds = []
    for i, (x, y) in enumerate(cs):
        ds.append(min((math.hypot(x - x2, y - y2)
                       for j, (x2, y2) in enumerate(cs) if j != i), default=30.0))
    ds.sort()
    return ds[len(ds) // 2] if ds else 30.0


def _grow(prof, start, step, thr, cap, gap):
    """prof(px별 ink 평균)에서 start 부터 step 방향으로 이동. 마지막 ink 위치를 edge 로.
    gap 연속 공백 또는 cap px 이동 시 정지."""
    i = start
    empties = 0
    edge = start
    traveled = 0
    N = len(prof)
    while 0 <= i + step < N:
        i += step
        traveled += 1
        if traveled > cap:
            break
        if prof[i] <= thr:
            empties += 1
            if empties >= gap:
                break
        else:
            empties = 0
            edge = i
    return edge


def crop_box_px(binimg, boxes, mod, f):
    """라벨 유니온 + 벽까지 성장으로 크롭박스(px) 계산."""
    W, H = binimg.size
    lL = min(v[0] for v in boxes.values()) * f
    lT = min(v[1] for v in boxes.values()) * f
    lR = max(v[2] for v in boxes.values()) * f
    lB = max(v[3] for v in boxes.values()) * f
    thr = EMPTY_FRAC * 255
    cap = int(GROW_CAP_MOD * mod * f)
    gap = int(GROW_GAP_PT * f)
    # 세로 성장 (라벨 x-범위 안에서)
    vstrip = binimg.crop((int(lL), 0, int(lR), H)).resize((1, H), Image.BOX)
    rp = [vstrip.getpixel((0, y)) for y in range(H)]
    top = _grow(rp, int(lT), -1, thr, cap, gap)
    bot = _grow(rp, int(lB), +1, thr, cap, gap)
    # 가로 성장 (성장된 y-범위 안에서)
    hstrip = binimg.crop((0, top, W, bot)).resize((W, 1), Image.BOX)
    cp = [hstrip.getpixel((x, 0)) for x in range(W)]
    left = _grow(cp, int(lL), -1, thr, cap, gap)
    right = _grow(cp, int(lR), +1, thr, cap, gap)
    # 라벨 유니온+여유 와 성장 결과 결합
    hexp = HEXP_MOD * mod * f
    L = min(lL - hexp, left)
    R = max(lR + hexp, right)
    T = min(lT, top)
    B = max(lB, bot)
    padx = 0.02 * (R - L)
    pady = 0.03 * (B - T)
    return (max(0, L - padx), max(0, T - pady),
            min(W, R + padx), min(H, B + pady))


def stylize(gray):
    """그레이스케일 크롭 -> 투명배경 단색 라인워크 RGBA."""
    a = gray.point(lambda p: max(0, min(255, int((255 - p - ALPHA_LO) * ALPHA_GAIN))))
    out = Image.new("RGBA", gray.size, LINE_COLOR + (0,))
    out.putalpha(a)
    return out


def save_linework(styl, path):
    """단색 알파 라인워크를 P+tRNS PNG 로 저장(용량 최소)."""
    K = ALPHA_LEVELS
    idx = styl.getchannel("A").point(lambda v: min(K - 1, v * K // 256)).convert("P")
    idx.putpalette(list(LINE_COLOR) * K + [0, 0, 0] * (256 - K))
    trns = bytes(min(255, round((i + 0.5) * 256 / K)) for i in range(K)) + bytes(256 - K)
    idx.save(path, optimize=True, transparency=trns)


def render(pdf, level):
    """렌더 -> 크롭 -> 스타일화 -> 저장. 반환: (png_wh, crop_box_px, f, full_size)."""
    f = DPI / 72.0
    tmp = f"/tmp/fp_full_{level}.png"
    subprocess.run(["pdftoppm", "-r", str(DPI), "-png", "-singlefile", pdf, tmp[:-4]], check=True)
    gray = Image.open(tmp).convert("L")
    W, H = gray.size
    binimg = gray.point(lambda p: 255 if p < INK_THR else 0)
    boxes = label_boxes(pdf, level)
    mod = module_pt(boxes)
    box = crop_box_px(binimg, boxes, mod, f)
    crop = gray.crop(tuple(int(v) for v in box))
    styl = stylize(crop)
    # 긴 변 상한 축소
    cw, ch = styl.size
    scale = min(1.0, MAX_LONG_SIDE / max(cw, ch))
    if scale < 1.0:
        styl = styl.resize((round(cw * scale), round(ch * scale)), Image.LANCZOS)
    out = os.path.join(OUT_DIR, f"n7-{level}.png")
    save_linework(styl, out)
    os.remove(tmp)
    return styl.size, box, f


def norm(cx_pt, cy_pt, box, f):
    """라벨 중심(pt) -> 크롭 기준 정규화(0~1)."""
    L, T, R, B = box
    x = (cx_pt * f - L) / (R - L)
    y = (cy_pt * f - T) / (B - T)
    return round(min(1.0, max(0.0, x)), 5), round(min(1.0, max(0.0, y)), 5)


def main():
    con = sqlite3.connect(DB)
    # 층별 교수
    profs = defaultdict(list)  # level -> [(id, name, room, floorId)]
    for pid, name, level, room, fid in con.execute(
        "SELECT p.id,p.name,f.level,p.roomNumber,p.floorId "
        "FROM Professor p JOIN BuildingFloor f ON p.floorId=f.id "
        "WHERE p.buildingId=?", (BUILDING_ID,)):
        profs[level].append((pid, name, room, fid))
    floor_id = {lvl: fid for fid, lvl in
                con.execute("SELECT id,level FROM BuildingFloor WHERE buildingId=?", (BUILDING_ID,))}
    # 층별 Room (id, code)
    rooms_db = defaultdict(list)  # level -> [(id, code)]
    for rid, code, level in con.execute(
        "SELECT r.id,r.code,f.level FROM Room r JOIN BuildingFloor f ON r.floorId=f.id "
        "WHERE f.buildingId=?", (BUILDING_ID,)):
        rooms_db[level].append((rid, code))

    prof_updates = []   # (posX, posY, id)
    room_updates = []   # (posX, posY, id)
    floor_updates = []  # (imageUrl, width, height, id)
    report = []

    for level in range(1, 8):
        pdf = os.path.join(PDF_DIR, f"기계공학동 {level}층.pdf")
        (pw, ph), box, f = render(pdf, level)
        boxes = label_boxes(pdf, level)
        room_pos = {c: (v[4], v[5]) for c, v in boxes.items()}  # code -> (cx,cy) pt
        fid = floor_id[level]
        floor_updates.append((f"/floorplans/n7-{level}.png", pw, ph, fid))

        # Room 좌표
        rlabeled = 0
        for rid, code in rooms_db[level]:
            if code in room_pos:
                x, y = norm(*room_pos[code], box, f)
                room_updates.append((x, y, rid))
                rlabeled += 1

        # 교수 좌표 (같은 방 다중 교수 오프셋)
        by_room = defaultdict(list)
        for p in profs.get(level, []):
            by_room[p[2]].append(p)
        matched = 0
        fails = []
        for room, group in by_room.items():
            if room not in room_pos:
                for p in group:
                    fails.append((p[1], room))
                continue
            px, py = norm(*room_pos[room], box, f)
            n = len(group)
            for i, p in enumerate(sorted(group, key=lambda x: x[0])):
                ox = (i - (n - 1) / 2) * ROOM_OFFSET if n > 1 else 0.0
                prof_updates.append((round(min(1.0, max(0.0, px + ox)), 5), py, p[0]))
                matched += 1

        report.append((level, len(room_pos), len(rooms_db[level]), rlabeled,
                       len(profs.get(level, [])), matched, fails, (pw, ph)))

    if not DRY:
        cur = con.cursor()
        for url, w, h, fid in floor_updates:
            cur.execute("UPDATE BuildingFloor SET imageUrl=?, width=?, height=? WHERE id=?",
                        (url, w, h, fid))
        for x, y, pid in prof_updates:
            cur.execute("UPDATE Professor SET posX=?, posY=? WHERE id=?", (x, y, pid))
        for x, y, rid in room_updates:
            cur.execute("UPDATE Room SET posX=?, posY=? WHERE id=?", (x, y, rid))
        con.commit()
    con.close()

    print(f"\n{'DRY-RUN' if DRY else 'APPLIED'}  (DPI={DPI}, color={LINE_COLOR})")
    print(f"{'층':>3} {'라벨':>4} {'Room':>5} {'채움':>5} {'교수':>4} {'매칭':>4}  {'PNG(px)':>11}")
    trm = trt = tpm = tpt = 0
    all_fails = []
    for level, nlab, nroom, rfill, nprof, pmatch, fails, px in report:
        trm += rfill; trt += nroom; tpm += pmatch; tpt += nprof
        print(f"{level:>3} {nlab:>4} {nroom:>5} {rfill:>5} {nprof:>4} {pmatch:>4}  {px[0]}x{px[1]:>6}")
        for name, room in fails:
            all_fails.append((level, name, room))
    print(f"\nRoom 좌표 {trm}/{trt} 채움 · 교수 배치 {tpm}/{tpt}")
    if all_fails:
        print("교수 매칭 실패(도면에 방번호 없음, NULL 유지):")
        for lv, name, room in all_fails:
            print(f"  N{lv} {name}({room})")


if __name__ == "__main__":
    main()
