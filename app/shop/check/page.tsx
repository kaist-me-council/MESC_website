import { redirect } from "next/navigation";

// 옛 주소 유지 (9/8 안내 메일 링크). 수령 확인은 캠페인 기능으로 통합됨.
export default function ShopCheckRedirect() {
  redirect("/apply/2026-spring-tshirt/confirm");
}
