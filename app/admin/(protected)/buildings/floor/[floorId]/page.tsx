import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import FloorMapEditor from "@/components/admin/FloorMapEditor";

export default async function FloorMapEditorPage({
  params,
}: {
  params: Promise<{ floorId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const { floorId: floorIdStr } = await params;
  const floorId = parseInt(floorIdStr);
  if (isNaN(floorId)) notFound();

  const floor = await prisma.buildingFloor.findUnique({
    where: { id: floorId },
    include: {
      building: true,
      professors: { select: { id: true, name: true, roomNumber: true } },
    },
  });
  if (!floor) notFound();

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* 상단 헤더 */}
      <div className="h-14 border-b border-border flex items-center px-4 gap-4 bg-muted/20 shrink-0">
        <Link
          href="/admin/buildings"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          건물 관리
        </Link>
        <div className="h-4 w-px bg-border" />
        <h1 className="font-bold text-sm">
          {floor.building.code} {floor.building.name} — {floor.level}층 지도 편집
        </h1>
      </div>

      {/* 에디터 (전체 남은 높이 사용) */}
      <div className="flex-1 overflow-hidden">
        <FloorMapEditor
          floorId={floorId}
          floorMeta={{
            level: floor.level,
            building: { code: floor.building.code, name: floor.building.name },
          }}
          initialImageUrl={floor.imageUrl}
          initialImageWidth={floor.imageWidth}
          initialImageHeight={floor.imageHeight}
          initialSvgContent={floor.svgContent}
          initialRegionsJson={floor.regionsJson}
          initialGraphJson={floor.graphJson}
          professors={floor.professors}
        />
      </div>
    </div>
  );
}
