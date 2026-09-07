import { handlers } from "@/lib/auth";

// 로그인 시도 제한은 lib/auth.ts 의 authorize 안에서 처리한다.
// (계정별 + IP별, 성공 시 초기화 — 여기서 하던 IP 5회/5분 제한은 성공까지 세고 초기화가 없어
//  관리자가 정상 로그인만 반복해도 스스로 잠기는 문제가 있었다. 전역 남용 방어는 middleware.ts 의 비-GET 60/분.)
export const { GET, POST } = handlers;
