#!/usr/bin/env python3
"""
기계공학동(N7) 1~7층 CAD PDF -> 웹 평면도 PNG + 교수 핀 좌표(posX/posY) 자동 반영.

파이프라인 (재실행 가능):
  1. gs -sDEVICE=bbox 로 실제 그려진 영역(HiResBoundingBox, 좌하단 원점) 계산
  2. pdftoppm 로 페이지 렌더 후 bbox(+패딩) 대로 크롭 -> public/floorplans/n7-<level>.png
  3. pdftotext -bbox 로 방번호 단어 추출, 크롭 기준 정규화(0~1, 좌상단 원점) 좌표 계산
  4. dev.db 기계공학동 교수의 roomNumber 와 매칭, 같은 방 다중 교수는 posX 소량 오프셋
  5. BuildingFloor.imageUrl / Professor.posX,posY 를 dev.db 에 반영 (매칭 실패는 NULL 유지)

사용: python3 scripts/build-floorplans.py [--dry]
  --dry : DB 미반영, 추출/매칭 리포트만 출력
"""
import subprocess, re, sqlite3, os, sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = "/Users/an-yeonsu/Downloads/기계공학동 도면 (1)"
OUT_DIR = os.path.join(ROOT, "public", "floorplans")
DB = os.path.join(ROOT, "dev.db")
DPI = 150
PAGE_H = 1080.0            # 모든 PDF 페이지 높이(pt)
PAD_FRAC = 0.02            # 크롭 여백 2%
BUILDING_ID = 1           # 기계공학동
ROOM_OFFSET = 0.008       # 같은 방 다중 교수 posX 간격(정규화, 층당 총폭)

DRY = "--dry" in sys.argv


def gs_bbox(pdf):
    """HiResBoundingBox(좌하단 원점) -> (left, top, right, bottom) 좌상단 원점 pt."""
    out = subprocess.run(
        ["gs", "-q", "-dNOPAUSE", "-dBATCH", "-sDEVICE=bbox", pdf],
        capture_output=True, text=True).stderr
    m = re.search(r"HiResBoundingBox: ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)", out)
    x0, y0b, x1, y1b = map(float, m.groups())
    return x0, PAGE_H - y1b, x1, PAGE_H - y0b


def words(pdf):
    xml = subprocess.run(["pdftotext", "-bbox", pdf, "-"],
                         capture_output=True, text=True).stdout
    return re.findall(
        r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>',
        xml)


def render_crop(pdf, level, box):
    """페이지를 DPI 로 렌더 후 box(pt, 좌상단 원점)대로 크롭 저장. 반환: (w,h) px."""
    from PIL import Image
    f = DPI / 72.0
    tmp = f"/tmp/fp_full_{level}"
    subprocess.run(["pdftoppm", "-r", str(DPI), "-png", "-singlefile", pdf, tmp], check=True)
    im = Image.open(tmp + ".png")
    l, t, r, b = box
    crop = im.crop((round(l * f), round(t * f), round(r * f), round(b * f)))
    out = os.path.join(OUT_DIR, f"n7-{level}.png")
    crop.save(out, optimize=True)
    os.remove(tmp + ".png")
    return crop.size


def main():
    con = sqlite3.connect(DB)
    # 층별 교수 (floorId <-> level 교차검증용으로 level 도 조회)
    profs = defaultdict(list)  # level -> [(id, name, room, floorId)]
    for pid, name, level, room, fid in con.execute(
        "SELECT p.id,p.name,f.level,p.roomNumber,p.floorId "
        "FROM Professor p JOIN BuildingFloor f ON p.floorId=f.id "
        "WHERE p.buildingId=?", (BUILDING_ID,)):
        profs[level].append((pid, name, room, fid))
    # level -> floorId 매핑 (BuildingFloor)
    floor_id = {lvl: fid for fid, lvl in
                con.execute("SELECT id,level FROM BuildingFloor WHERE buildingId=?", (BUILDING_ID,))}

    updates = []          # (posX, posY, professor_id)
    floor_updates = []    # (imageUrl, floor_id)
    report = []

    for level in range(1, 8):
        pdf = os.path.join(PDF_DIR, f"기계공학동 {level}층.pdf")
        l, t, r, b = gs_bbox(pdf)
        # 패딩
        pw, ph = r - l, b - t
        l = max(0.0, l - pw * PAD_FRAC); r = min(1920.0, r + pw * PAD_FRAC)
        t = max(0.0, t - ph * PAD_FRAC); b = min(PAGE_H, b + ph * PAD_FRAC)
        cw, ch = r - l, b - t

        px = (0, 0)
        if not DRY:
            px = render_crop(pdf, level, (l, t, r, b))

        # 방번호 추출: '<level>' 로 시작하는 4자리(+선택 영문 1)
        rooms = defaultdict(list)
        for a, yb, c, e, txt in words(pdf):
            m = re.match(rf'^({level}\d{{3}}[A-Za-z]?)', txt)
            if not m:
                continue
            cx = (float(a) + float(c)) / 2
            cy = (float(yb) + float(e)) / 2
            rooms[m.group(1)].append((cx, cy))
        # 각 방코드 대표좌표 = 인스턴스 평균(중복 라벨은 대개 동일 위치)
        room_pos = {}
        for k, v in rooms.items():
            room_pos[k] = (sum(p[0] for p in v) / len(v),
                           sum(p[1] for p in v) / len(v))

        # 매칭
        pr = profs.get(level, [])
        fid = floor_id[level]
        floor_updates.append((f"/floorplans/n7-{level}.png", fid))

        # 같은 방 다중 교수 그룹
        by_room = defaultdict(list)
        for p in pr:
            by_room[p[2]].append(p)

        matched = 0
        fails = []
        for room, group in by_room.items():
            if room not in room_pos:
                for p in group:
                    fails.append((p[1], room, "도면에 방번호 없음"))
                continue
            cx, cy = room_pos[room]
            posX = (cx - l) / cw
            posY = (cy - t) / ch
            n = len(group)
            for i, p in enumerate(sorted(group, key=lambda x: x[0])):
                # floorId 교차검증 (여기선 level 로 join 했으니 항상 일치하지만 방어적으로)
                if p[3] != fid:
                    fails.append((p[1], room, f"floorId 불일치 {p[3]}!={fid}"))
                    continue
                ox = (i - (n - 1) / 2) * ROOM_OFFSET if n > 1 else 0.0
                x = min(1.0, max(0.0, posX + ox))
                updates.append((round(x, 5), round(posY, 5), p[0]))
                matched += 1

        report.append((level, len(room_pos), len(pr), matched, fails, px))

    # DB 반영
    if not DRY:
        cur = con.cursor()
        for url, fid in floor_updates:
            cur.execute("UPDATE BuildingFloor SET imageUrl=? WHERE id=?", (url, fid))
        for x, y, pid in updates:
            cur.execute("UPDATE Professor SET posX=?, posY=? WHERE id=?", (x, y, pid))
        con.commit()
    con.close()

    # 리포트
    print(f"\n{'DRY-RUN' if DRY else 'APPLIED'}  (DPI={DPI}, pad={PAD_FRAC})")
    print(f"{'층':>3} {'방번호':>6} {'교수':>4} {'매칭':>4}  {'PNG(px)':>12}")
    tot_m = tot_p = 0
    all_fails = []
    for level, nrooms, nprofs, matched, fails, px in report:
        tot_m += matched; tot_p += nprofs
        pxs = f"{px[0]}x{px[1]}" if px[0] else "-"
        print(f"{level:>3} {nrooms:>6} {nprofs:>4} {matched:>4}  {pxs:>12}")
        for f in fails:
            all_fails.append((level, *f))
    print(f"\n총 교수 {tot_p}, 매칭 {tot_m}, 실패 {tot_p - tot_m}")
    if all_fails:
        print("실패 목록:")
        for lv, name, room, why in all_fails:
            print(f"  N{lv} {name}({room}): {why}")


if __name__ == "__main__":
    main()
