import { NextResponse } from "next/server";

// 푸시 공개키를 런타임에 알려 준다.
// NEXT_PUBLIC_ 변수는 빌드 시점에 코드로 박히므로, 키를 나중에 추가하면 재빌드 전까지 반영되지 않는다.
// 이 라우트를 두면 환경변수만 넣어도 즉시 동작한다. (공개키라 노출되어도 안전)
export async function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY ?? "";
  return NextResponse.json({ key, configured: !!key }, { headers: { "Cache-Control": "public, max-age=300" } });
}
