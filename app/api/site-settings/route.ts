import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parseHours, isValidTime, type OperatingHours } from "@/lib/site-settings";

// 공개: 운영시간 + 연락처
export async function GET() {
  const s = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  return NextResponse.json({
    locationKo: s?.locationKo ?? "N7동 학생회실",
    locationEn: s?.locationEn ?? "Student Council Room, N7",
    email: s?.email ?? "kaist.mesc@gmail.com",
    phone: s?.phone ?? null,
    hours: parseHours(s?.hoursJson),
  });
}

// 인증: 수정 (단일 행 upsert)
export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const locationKo = typeof body.locationKo === "string" ? body.locationKo.trim().slice(0, 100) : "";
  const locationEn = typeof body.locationEn === "string" ? body.locationEn.trim().slice(0, 100) || null : null;
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 100) : "";
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 30) || null : null;

  if (!locationKo) return NextResponse.json({ error: "위치(한국어)는 필수입니다." }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "올바른 이메일 형식이 아닙니다." }, { status: 400 });

  // 운영시간 검증
  const hours = body.hours as OperatingHours | undefined;
  if (!hours || !Array.isArray(hours.days) || hours.days.length !== 7)
    return NextResponse.json({ error: "운영시간 형식이 올바르지 않습니다." }, { status: 400 });
  for (const d of hours.days) {
    if (!d.closed && (!isValidTime(d.open) || !isValidTime(d.close)))
      return NextResponse.json({ error: "운영시간(HH:MM) 형식이 올바르지 않습니다." }, { status: 400 });
    if (!d.closed && d.open >= d.close)
      return NextResponse.json({ error: "종료 시간은 시작 시간보다 늦어야 합니다." }, { status: 400 });
  }
  if (hours.lunch && (!isValidTime(hours.lunch.open) || !isValidTime(hours.lunch.close)))
    return NextResponse.json({ error: "점심시간 형식이 올바르지 않습니다." }, { status: 400 });

  const hoursJson = JSON.stringify({
    days: hours.days.map((d, i) => ({
      day: i,
      closed: Boolean(d.closed),
      open: d.open,
      close: d.close,
    })),
    lunch: hours.lunch ?? null,
  });

  const data = { locationKo, locationEn, email: email || "kaist.mesc@gmail.com", phone, hoursJson };
  const saved = await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
  return NextResponse.json({ ...saved, hours: parseHours(saved.hoursJson) });
}
