/**
 * 빌드·렌더 중 DB 조회 실패를 "빌드 실패" 가 아니라 "빈 화면" 으로 처리한다.
 *
 * 왜 필요한가: 서버 컴포넌트가 프리렌더 도중 던지면 빌드 전체가 중단된다.
 * 프리뷰 환경처럼 DB 가 연결되지 않은 곳, 또는 프로덕션 빌드 중 DB 가 잠깐
 * 흔들린 순간에 배포가 통째로 막히는 것을 막는다. ISR 이므로 다음 갱신에서
 * 정상 데이터로 다시 채워진다.
 */
export async function safeQuery<T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (e) {
    console.error(`[${label}] 데이터 조회 실패 — 빈 값으로 렌더합니다.`, e instanceof Error ? e.message : e);
    return fallback;
  }
}
