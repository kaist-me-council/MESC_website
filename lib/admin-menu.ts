/**
 * 관리자 메뉴 정의 — 대시보드와 사이드 내비의 단일 진실 원천.
 * URL 은 절대 바꾸지 않는다(북마크·기존 링크 보존). 표시 이름과 묶음만 여기서 관리한다.
 * 색은 그룹 단위로만 준다(카드마다 다른 강조색을 줄이라는 검토 반영).
 */
import {
  Bell, BookMarked, BookOpen, Building2, Camera, Cookie, GraduationCap,
  Megaphone, MessageSquare, Ticket, UserSquare, Users, Wrench, type LucideIcon,
} from "lucide-react";

export interface AdminMenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  desc: string;
}

export interface AdminMenuGroup {
  title: string;
  /** 그룹 아이콘 색 (Tailwind 클래스). 카드 테두리·배경에는 쓰지 않는다. */
  tint: string;
  items: AdminMenuItem[];
}

export const ADMIN_GROUPS: AdminMenuGroup[] = [
  {
    title: "신청·사업 운영",
    tint: "text-fuchsia-600 dark:text-fuchsia-400",
    items: [
      { href: "/admin/campaigns", label: "이벤트 신청·구매", icon: Ticket, desc: "신청·구매 캠페인, 수령 확인" },
      { href: "/admin/snack-wishes", label: "간식 위시리스트", icon: Cookie, desc: "위시리스트 조회·삭제" },
    ],
  },
  {
    title: "소식·소통",
    tint: "text-blue-600 dark:text-blue-400",
    items: [
      { href: "/admin/notices", label: "공지사항", icon: Bell, desc: "공지 작성·수정·삭제" },
      { href: "/admin/events", label: "행사 사진·갤러리", icon: Camera, desc: "행사 갤러리·사진 업로드" },
      { href: "/admin/community", label: "커뮤니티·건의", icon: MessageSquare, desc: "건의 답변·게시글 신고 처리" },
      { href: "/admin/popup", label: "홈 팝업", icon: Megaphone, desc: "방문자 팝업 ON/OFF + 링크" },
    ],
  },
  {
    title: "학과·학습 정보",
    tint: "text-emerald-600 dark:text-emerald-400",
    items: [
      { href: "/admin/resources", label: "학습자료", icon: BookOpen, desc: "자료 업로드·삭제" },
      { href: "/admin/courses", label: "수업 정보", icon: GraduationCap, desc: "전공 과목·전공서·강의 소개" },
      { href: "/admin/books", label: "전공서적", icon: BookMarked, desc: "보유 전공서·표지·분류" },
      { href: "/admin/professors", label: "교수진", icon: UserSquare, desc: "교수님 정보·오피스" },
      { href: "/admin/buildings", label: "건물·평면도", icon: Building2, desc: "건물·층·평면도 업로드" },
    ],
  },
  {
    title: "학생회·사이트 설정",
    tint: "text-slate-600 dark:text-slate-300",
    items: [
      { href: "/admin/members", label: "학생회 구성원", icon: Users, desc: "임원진 등록·삭제" },
      { href: "/admin/site", label: "사이트 설정", icon: Wrench, desc: "운영시간·연락처·외부링크·동아리" },
    ],
  },
];

/** pathname 으로 현재 메뉴·그룹 찾기. 상세 경로(/admin/campaigns/3)도 목록 메뉴에 매칭된다. */
export function findAdminMenu(pathname: string): { group: AdminMenuGroup; item: AdminMenuItem } | null {
  let best: { group: AdminMenuGroup; item: AdminMenuItem } | null = null;
  for (const group of ADMIN_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(item.href + "/")) {
        if (!best || item.href.length > best.item.href.length) best = { group, item };
      }
    }
  }
  return best;
}
