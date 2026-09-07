import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/anon";
import { enforce, getClientIp, reset } from "@/lib/rate-limit";

/** 길이 누출 없이 상수 시간으로 두 문자열을 비교한다. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// 로그인 시도 제한 (10분 창). 계정 잠금 DoS 를 피하려고 계정 버킷은 IP 버킷보다 느슨하다.
// ponytail: 메모리 맵이라 Vercel 인스턴스마다 별도 카운터 — 분산 차단이 필요하면 KV 로 교체.
const LOGIN_WINDOW = 10 * 60 * 1000;
const LOGIN_MAX_PER_USER = 10;
const LOGIN_MAX_PER_IP = 20;

/** 실패 응답을 늦춰 무차별 대입 속도를 떨어뜨린다. */
const slowFail = () => new Promise((r) => setTimeout(r, 200 + Math.floor(Math.random() * 200)));

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "아이디", type: "text" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials, request) {
        // 관리자 자격증명이 환경변수에 설정돼 있어야만 로그인 허용.
        // (미설정 시 undefined === undefined 로 우회되던 문제 차단)
        const adminUser = process.env.ADMIN_USERNAME;
        const adminPass = process.env.ADMIN_PASSWORD;
        if (!adminUser || !adminPass) return null;

        const { username, password } = (credentials ?? {}) as {
          username?: string;
          password?: string;
        };
        if (!username || !password) return null;

        // 시도 횟수 제한. 초과해도 계정 존재 여부를 드러내지 않도록 그냥 null.
        const ip = getClientIp(request as Request);
        const userKey = username.slice(0, 100).toLowerCase();
        const ipOk = enforce(ip, "login-ip", LOGIN_MAX_PER_IP, LOGIN_WINDOW).ok;
        const userOkToTry = enforce(userKey, "login-user", LOGIN_MAX_PER_USER, LOGIN_WINDOW).ok;
        if (!ipOk || !userOkToTry) {
          await slowFail();
          return null;
        }

        const succeed = (user: { id: string; name: string; email: string }) => {
          reset(ip, "login-ip");
          reset(userKey, "login-user");
          return user;
        };

        // 어떤 필드가 틀렸는지 타이밍으로 노출되지 않도록 둘 다 평가
        const userOk = safeEqual(username, adminUser);
        const passOk = safeEqual(password, adminPass);
        if (userOk && passOk) {
          return succeed({ id: "1", name: "관리자", email: "admin@me-council.kr" });
        }

        // DB 계정 (학과 교직원 등 추가 관리자)
        const account = await prisma.adminAccount.findUnique({ where: { username } });
        if (account && verifyPassword(password, account.passwordHash)) {
          return succeed({ id: `db-${account.id}`, name: account.name, email: "admin@me-council.kr" });
        }
        await slowFail();
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/admin/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 관리자 세션 7일 (기본 30일)
  },
  trustHost: true,
});
