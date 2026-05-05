import { prisma } from "@/lib/prisma";
import { DepartmentInfoClient } from "./department-info-client";

export const dynamic = "force-dynamic";

export default async function DepartmentInfoPage() {
  const buildings = await prisma.building.findMany({
    orderBy: { order: "asc" },
    include: {
      floors: {
        orderBy: { level: "asc" },
        include: {
          professors: { orderBy: { roomNumber: "asc" } },
        },
      },
    },
  });

  const professors = await prisma.professor.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: {
      building: { select: { id: true, code: true, name: true } },
      floor: { select: { id: true, level: true } },
    },
  });

  return <DepartmentInfoClient buildings={buildings} professors={professors} />;
}
