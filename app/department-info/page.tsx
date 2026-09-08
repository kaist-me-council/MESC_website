import { prisma } from "@/lib/prisma";
import { safeQuery } from "@/lib/safe-query";
import { DepartmentInfoClient } from "./department-info-client";

export const revalidate = 300; // 건물·교수 데이터는 거의 불변 — 5분 ISR

export default async function DepartmentInfoPage() {
  const buildings = await safeQuery("department-info/buildings", () => prisma.building.findMany({
    orderBy: { order: "asc" },
    include: {
      floors: {
        orderBy: { level: "asc" },
        include: {
          professors: { orderBy: { roomNumber: "asc" }, omit: { phone: true } },
          rooms: {
            orderBy: [{ wing: "asc" }, { code: "asc" }],
            include: {
              professors: {
                select: { id: true, name: true, title: true, email: true, websiteUrl: true, researchArea: true },
              },
            },
          },
        },
      },
    },
  }), []);

  const professors = await safeQuery("department-info/professors", () => prisma.professor.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    omit: { phone: true }, // 전화번호는 관리자 화면에서만
    include: {
      building: { select: { id: true, code: true, name: true } },
      floor: { select: { id: true, level: true } },
    },
  }), []);

  return <DepartmentInfoClient buildings={buildings} professors={professors} />;
}
