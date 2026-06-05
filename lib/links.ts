// [DEPRECATED as live source] 이 상수들은 이제 DB(SiteLink)로 이관되었습니다.
// 남겨둔 이유: 시드 스크립트(scripts/seed-site-settings.mjs)의 출처 기록 및 fallback 참고용.
// 공개 페이지는 /api/site-links 또는 서버 조회 결과를 사용합니다. 이 파일을 수정해도 사이트에 반영되지 않습니다.

export interface SiteLink {
  label: string;
  labelEn: string;
  url: string;
  description?: string;
  descriptionEn?: string;
  icon: string;
}

// 주요 링크 — (DB 이관됨) 실제 수정은 /admin/site 에서. 아래는 시드/fallback 출처.
export const IMPORTANT_LINKS: SiteLink[] = [
  {
    label: "기계공학과 홈페이지",
    labelEn: "ME Department Website",
    url: "https://me.kaist.ac.kr/",
    description: "학과 공식 홈페이지",
    descriptionEn: "Official department website",
    icon: "🏫",
  },
  {
    label: "KAIST 포털",
    labelEn: "KAIST Portal",
    url: "https://portal.kaist.ac.kr/",
    description: "수강신청, 성적 확인 등",
    descriptionEn: "Course registration, grades, etc.",
    icon: "🎓",
  },
  {
    label: "기계공학과 회칙",
    labelEn: "ME Council Bylaws",
    url: "https://drive.google.com/file/d/1uwPFQuggxrbsZsOVY-mAhFY0KKGyWawk/view?usp=sharing",
    description: "기계공학과 학생회 회칙 문서",
    descriptionEn: "ME Student Council bylaws document",
    icon: "📜",
  },
];

// 학생회 SNS/커뮤니티 링크
export const COMMUNITY_LINKS: SiteLink[] = [
  {
    label: "카카오톡 채널",
    labelEn: "KakaoTalk Channel",
    url: "http://pf.kakao.com/_fHXxkn/chat",
    description: "학생회 공지 채널",
    descriptionEn: "Student council announcement channel",
    icon: "💬",
  },
  {
    label: "네이버 카페 (학습자료)",
    labelEn: "Naver Cafe (Resources)",
    url: "https://cafe.naver.com/kaistme",
    description: "강의자료, 시험족보 등",
    descriptionEn: "Lecture materials, past exams, etc.",
    icon: "📚",
  },
  {
    label: "인스타그램 (학생회)",
    labelEn: "Instagram (Council)",
    url: "https://www.instagram.com/i_love_mesc/",
    description: "학생회 활동 소식",
    descriptionEn: "Student council activities",
    icon: "📸",
  },
  {
    label: "인스타그램 (학과)",
    labelEn: "Instagram (Department)",
    url: "https://www.instagram.com/kaist_me/",
    description: "기계공학과 공식 인스타그램",
    descriptionEn: "Official ME department Instagram",
    icon: "🔬",
  },
];
