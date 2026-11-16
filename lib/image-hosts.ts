/**
 * next/image 가 허용하는 이미지 호스트 — next.config.ts 의 remotePatterns 와 저장 API 검증이 함께 쓰는 단일 원천.
 * 허용 안 된 호스트를 <Image> 에 넘기면 페이지 전체가 런타임 오류로 죽는다. 그래서 저장 시점에 막는다.
 * 호스트를 추가할 땐 여기만 고치면 된다.
 */
export const IMAGE_HOSTS = [
  "*.public.blob.vercel-storage.com",
  "lh3.googleusercontent.com",
  "drive.google.com",
  "me.kaist.ac.kr",
];

export function isAllowedImageUrl(url: string): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== "https:") return false;
  return IMAGE_HOSTS.some((h) => (h.startsWith("*.") ? u.hostname.endsWith(h.slice(1)) : u.hostname === h));
}

export const IMAGE_HOST_ERROR = `이미지 주소는 직접 업로드하거나 허용된 곳(${IMAGE_HOSTS.join(", ")})의 https 주소여야 합니다.`;
