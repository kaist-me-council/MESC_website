import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { timingSafeEqual } from "node:crypto";

/** 길이 누출 없이 상수 시간으로 두 문자열을 비교한다. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "아이디", type: "text" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
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

        // 어떤 필드가 틀렸는지 타이밍으로 노출되지 않도록 둘 다 평가
        const userOk = safeEqual(username, adminUser);
        const passOk = safeEqual(password, adminPass);
        if (userOk && passOk) {
          return { id: "1", name: "관리자", email: "admin@me-council.kr" };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/admin/login",
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
});
