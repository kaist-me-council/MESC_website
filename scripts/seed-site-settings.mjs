// 현재 하드코딩된 사이트 콘텐츠를 DB에 시드한다 (멱등).
// SiteSettings: id=1 upsert. SiteLink/Club: 비어있을 때만 시드.
// 사용: node scripts/seed-site-settings.mjs
//
// 주의: 이 앱은 .env.local / .env 의 DATABASE_URL="file:./dev.db" (루트)를 사용한다.
//   plain node 는 .env 를 자동 로드하지 않으므로 dotenv 로 명시 로드하고,
//   기본값도 루트 ./dev.db 로 둬서 Next 앱이 읽는 동일 DB 에 시드되게 한다.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || "file:./dev.db",
  ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
});
const prisma = new PrismaClient({ adapter });

const HOURS = {
  days: [
    { day: 0, closed: false, open: "09:00", close: "18:00" },
    { day: 1, closed: false, open: "09:00", close: "18:00" },
    { day: 2, closed: false, open: "09:00", close: "18:00" },
    { day: 3, closed: false, open: "09:00", close: "18:00" },
    { day: 4, closed: false, open: "09:00", close: "18:00" },
    { day: 5, closed: true, open: "09:00", close: "18:00" },
    { day: 6, closed: true, open: "09:00", close: "18:00" },
  ],
  lunch: { open: "12:00", close: "13:00" },
};

const LINKS = [
  { category: "important", label: "기계공학과 홈페이지", labelEn: "ME Department Website", url: "https://me.kaist.ac.kr/", description: "학과 공식 홈페이지", descriptionEn: "Official department website", icon: "🏫", order: 0 },
  { category: "important", label: "KAIST 포털", labelEn: "KAIST Portal", url: "https://portal.kaist.ac.kr/", description: "수강신청, 성적 확인 등", descriptionEn: "Course registration, grades, etc.", icon: "🎓", order: 1 },
  { category: "important", label: "기계공학과 회칙", labelEn: "ME Council Bylaws", url: "https://drive.google.com/file/d/1uwPFQuggxrbsZsOVY-mAhFY0KKGyWawk/view?usp=sharing", description: "기계공학과 학생회 회칙 문서", descriptionEn: "ME Student Council bylaws document", icon: "📜", order: 2 },
  { category: "community", label: "카카오톡 채널", labelEn: "KakaoTalk Channel", url: "http://pf.kakao.com/_fHXxkn/chat", description: "학생회 공지 채널", descriptionEn: "Student council announcement channel", icon: "💬", order: 0 },
  { category: "community", label: "네이버 카페 (학습자료)", labelEn: "Naver Cafe (Resources)", url: "https://cafe.naver.com/kaistme", description: "강의자료, 시험족보 등", descriptionEn: "Lecture materials, past exams, etc.", icon: "📚", order: 1 },
  { category: "community", label: "인스타그램 (학생회)", labelEn: "Instagram (Council)", url: "https://www.instagram.com/i_love_mesc/", description: "학생회 활동 소식", descriptionEn: "Student council activities", icon: "📸", order: 2 },
  { category: "community", label: "인스타그램 (학과)", labelEn: "Instagram (Department)", url: "https://www.instagram.com/kaist_me/", description: "기계공학과 공식 인스타그램", descriptionEn: "Official ME department Instagram", icon: "🔬", order: 3 },
];

const CLUBS = [
  {
    name: "MR", nameEn: "MR (Microrobot Research)", tagKo: "로봇 연구", tagEn: "Robotics Research",
    descKo: "KAIST 유일의 로봇 동아리로, 다양한 종류의 로봇을 직접 설계하고 제작하며 연구합니다. 전공과 관계없이 로봇에 관심 있는 누구나 참여할 수 있으며, 3D 프린터·각종 공구 등 풍부한 장비를 갖춘 동아리방에서 활동합니다. 제작한 로봇으로 대회 참가와 방송 출연 등 활발한 대외 활동을 이어가고 있습니다.",
    descEn: "MR (Microrobot Research) is KAIST's only robot club, where members design, build, and research all kinds of robots. Open to all students regardless of major, the club provides foundational robotics education and access to 3D printers and various tools. Members actively participate in robot competitions and media appearances.",
    activitiesKo: ["로봇 설계 및 제작 프로젝트", "신입부원 기초 교육 (아두이노, 회로설계)", "대회 참가 및 방송 출연", "자체 학생 로봇 대회 운영"].join("\n"),
    activitiesEn: ["Robot design & fabrication projects", "Foundational education (Arduino, circuit design)", "Competition participation & media appearances", "Student robotics competition hosting"].join("\n"),
    url: "https://mr.kaist.ac.kr/", urlLabel: "site", emoji: "🤖", colorPreset: "blue", order: 0,
  },
  {
    name: "질주", nameEn: "ZILZU", tagKo: "자작자동차", tagEn: "Built-Car Racing",
    descKo: "1998년 창설된 KAIST 기계공학과 자작자동차 동아리입니다. 엔진·타이어 등 완제품을 제외한 설계, 용접, 프레임, 전기 배선까지 오프로드 경주용 자동차를 처음부터 끝까지 직접 제작합니다. 매년 KSAE 대학생 자작자동차 대회(C-Baja / E-Baja)에 참가하며 실전 엔지니어링 경험을 쌓습니다.",
    descEn: "ZILZU is KAIST's student-built automobile club under the Department of Mechanical Engineering, founded in 1998. Members independently design and fabricate off-road racing vehicles from scratch — handling everything from frame welding and suspension to electrical wiring. The team competes annually in the KSAE Student Built-Car Competition in both C-Baja and E-Baja categories.",
    activitiesKo: ["오프로드 경주용 자동차 설계·제작 (CAD, 정적/유동해석)", "KSAE 대학생 자작자동차 대회 참가", "C-Baja (내연기관) · E-Baja (전기차) 부문 출전", "설계부터 용접·전기 배선까지 전 과정 직접 수행"].join("\n"),
    activitiesEn: ["Off-road vehicle design & fabrication (CAD, FEA)", "KSAE Student Built-Car Competition", "C-Baja (combustion) & E-Baja (electric) categories", "Full in-house production: welding, wiring & more"].join("\n"),
    url: "https://www.instagram.com/kaist_zilzu/?hl=ko", urlLabel: "insta", emoji: "🏎️", colorPreset: "orange", order: 1,
  },
];

async function main() {
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      locationKo: "N7동 학생회실",
      locationEn: "Student Council Room, N7",
      email: "kaist.mesc@gmail.com",
      phone: null,
      hoursJson: JSON.stringify(HOURS),
    },
  });
  console.log("[seed] SiteSettings upsert 완료");

  const linkCount = await prisma.siteLink.count();
  if (linkCount === 0) {
    await prisma.siteLink.createMany({ data: LINKS });
    console.log(`[seed] SiteLink ${LINKS.length}개 생성`);
  } else {
    console.log(`[seed] SiteLink 이미 ${linkCount}개 존재 — 스킵`);
  }

  const clubCount = await prisma.club.count();
  if (clubCount === 0) {
    await prisma.club.createMany({ data: CLUBS });
    console.log(`[seed] Club ${CLUBS.length}개 생성`);
  } else {
    console.log(`[seed] Club 이미 ${clubCount}개 존재 — 스킵`);
  }

  console.log("[seed] 완료");
}

main().finally(() => prisma.$disconnect());
