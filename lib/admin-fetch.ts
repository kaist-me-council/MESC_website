/**
 * 관리자 화면의 저장·삭제 요청. 실패(401·500·검증 오류)를 조용히 넘기지 않고 서버 문구로 알린다.
 * 응답은 그대로 돌려주므로 호출부는 필요하면 res.ok 로 후속 처리를 멈출 수 있다.
 */
export async function adminFetch(input: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    alert("네트워크 오류로 저장하지 못했습니다. 연결을 확인하고 다시 시도하세요.");
    return new Response(null, { status: 599 });
  }
  if (!res.ok) {
    const data = await res.clone().json().catch(() => ({}));
    const msg = res.status === 401 ? "로그인이 만료됐습니다. 다시 로그인한 뒤 시도하세요." : data.error ?? `처리하지 못했습니다. (오류 ${res.status})`;
    alert(msg);
  }
  return res;
}
