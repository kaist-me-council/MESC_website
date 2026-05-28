import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { FLOOR_ROOMS, SPECIAL_ROOMS, EXTERNAL_BUILDINGS, wingFromCode } from "@/lib/room-seed-data";

/**
 * 관리자 전용 — N7 호실 데이터 + 외부 건물을 production DB 에 자동 시드.
 * 멱등 (같은 code 의 호실은 skip).
 */
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // N7 upsert
  const n7 = await prisma.building.upsert({
    where: { code: "N7" },
    create: {
      code: "N7",
      name: "기계공학동",
      nameEn: "Mechanical Engineering Bldg.",
      description: "기계공학과 본관",
      order: 0,
    },
    update: { isExternal: false },
  });

  // 외부 건물 4개
  const externals: { code: string; name: string }[] = [];
  for (const e of EXTERNAL_BUILDINGS) {
    const b = await prisma.building.upsert({
      where: { code: e.code },
      create: { code: e.code, name: e.name, isExternal: true, order: e.order },
      update: { isExternal: true },
    });
    externals.push({ code: b.code, name: b.name });
  }

  let added = 0;
  let kept = 0;
  const perFloor: { level: number; added: number; kept: number }[] = [];

  for (const [levelStr, codes] of Object.entries(FLOOR_ROOMS)) {
    const level = Number(levelStr);
    const floor = await prisma.buildingFloor.upsert({
      where: { buildingId_level: { buildingId: n7.id, level } },
      create: { buildingId: n7.id, level, description: `${level}층` },
      update: {},
    });
    let fAdded = 0;
    let fKept = 0;
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      const exists = await prisma.room.findUnique({
        where: { floorId_code: { floorId: floor.id, code } },
      });
      if (exists) { kept++; fKept++; continue; }
      await prisma.room.create({
        data: {
          floorId: floor.id,
          code,
          wing: wingFromCode(code),
          name: SPECIAL_ROOMS[code] ?? null,
          order: i,
        },
      });
      added++; fAdded++;
    }
    perFloor.push({ level, added: fAdded, kept: fKept });
  }

  return NextResponse.json({
    ok: true,
    n7Id: n7.id,
    externals,
    totals: { added, kept },
    perFloor,
  });
}
