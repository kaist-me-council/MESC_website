/**
 * 좋아요 목표 상태 → 실제로 해야 할 일.
 * 이미 목표 상태면 "none" 이라 집계를 건드리지 않는다 (같은 요청을 몇 번 재시도해도 결과가 같다).
 */
export type LikeAction = "create" | "delete" | "none";

export function likeAction(hasRow: boolean, target: boolean): LikeAction {
  if (target && !hasRow) return "create";
  if (!target && hasRow) return "delete";
  return "none";
}
