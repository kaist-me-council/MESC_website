"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Search, MapPin, Mail, Phone, ExternalLink, User } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { FloorplanViewer } from "@/components/floorplan/floorplan-viewer";

interface Professor {
  id: number;
  name: string;
  nameEn: string | null;
  title: string;
  buildingId: number | null;
  building: { id: number; code: string; name: string } | null;
  floorId: number | null;
  floor: { id: number; level: number } | null;
  roomNumber: string | null;
  email: string | null;
  phone: string | null;
  researchArea: string | null;
  websiteUrl: string | null;
  imageUrl: string | null;
}

interface RoomInList {
  id: number;
  code: string;
  wing: number | null;
  name: string | null;
  professors: Array<{ id: number; name: string; title?: string | null; email?: string | null; researchArea?: string | null; websiteUrl?: string | null }>;
}

interface FloorWithProfs {
  id: number;
  level: number;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  svgContent: string | null;
  regionsJson: string | null;
  graphJson: string | null;
  description: string | null;
  width: number | null;
  height: number | null;
  rooms: RoomInList[];
  professors: Array<{
    id: number;
    name: string;
    nameEn?: string | null;
    title?: string | null;
    roomNumber: string | null;
    email?: string | null;
    phone?: string | null;
    researchArea?: string | null;
    websiteUrl?: string | null;
    posX?: number | null;
    posY?: number | null;
  }>;
}

interface BuildingWithFloors {
  id: number;
  code: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  floors: FloorWithProfs[];
}

interface Props {
  buildings: BuildingWithFloors[];
  professors: Professor[];
}

export function DepartmentInfoClient({ buildings, professors }: Props) {
  const { lang } = useLanguage();
  const [tab, setTab] = useState<"map" | "professors">("map");
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(buildings[0]?.id ?? null);
  const [selectedFloorId, setSelectedFloorId] = useState<number | null>(buildings[0]?.floors[0]?.id ?? null);
  const [search, setSearch] = useState("");

  const selectedBuilding = useMemo(
    () => buildings.find((b) => b.id === selectedBuildingId) ?? null,
    [buildings, selectedBuildingId]
  );
  const selectedFloor = useMemo(
    () => selectedBuilding?.floors.find((f) => f.id === selectedFloorId) ?? selectedBuilding?.floors[0] ?? null,
    [selectedBuilding, selectedFloorId]
  );

  const filteredProfessors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return professors;
    return professors.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.nameEn?.toLowerCase().includes(q) ?? false) ||
      (p.researchArea?.toLowerCase().includes(q) ?? false) ||
      (p.roomNumber?.toLowerCase().includes(q) ?? false)
    );
  }, [professors, search]);

  function jumpToFloorOf(prof: Professor) {
    if (!prof.buildingId) return;
    setSelectedBuildingId(prof.buildingId);
    if (prof.floorId) setSelectedFloorId(prof.floorId);
    setTab("map");
    setTimeout(() => window.scrollTo({ top: 200, behavior: "smooth" }), 100);
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight mb-2">
          {lang === "ko" ? "학과 안내" : "Department Info"}
        </h1>
        <p className="text-muted-foreground">
          {lang === "ko"
            ? "기계공학과 건물 지도와 교수님 오피스 정보를 확인하세요."
            : "View building maps and professor office information for the ME department."}
        </p>
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-2 mb-8 border-b border-border">
        <button
          onClick={() => setTab("map")}
          className={`px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors ${
            tab === "map" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="inline h-4 w-4 mr-2" />
          {lang === "ko" ? "건물 지도" : "Building Map"}
        </button>
        <button
          onClick={() => setTab("professors")}
          className={`px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors ${
            tab === "professors" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="inline h-4 w-4 mr-2" />
          {lang === "ko" ? "교수님 찾기" : "Find Professor"}
        </button>
      </div>

      {/* 탭 1: 건물 지도 */}
      {tab === "map" && (
        <div>
          {buildings.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                {lang === "ko" ? "등록된 건물이 없습니다." : "No buildings registered."}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* 건물 선택 */}
              <div className="flex flex-wrap gap-2 mb-4">
                {buildings.map((b) => (
                  <Button
                    key={b.id}
                    variant={b.id === selectedBuildingId ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedBuildingId(b.id);
                      setSelectedFloorId(b.floors[0]?.id ?? null);
                    }}
                  >
                    {b.code} {b.name}
                  </Button>
                ))}
              </div>

              {/* 층 선택 */}
              {selectedBuilding && selectedBuilding.floors.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {selectedBuilding.floors.map((f) => (
                    <Button
                      key={f.id}
                      variant={f.id === selectedFloor?.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedFloorId(f.id)}
                    >
                      {f.level}F
                    </Button>
                  ))}
                </div>
              )}

              {/* 평면도 */}
              {selectedFloor ? (
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <FloorplanViewer floor={selectedFloor} professors={selectedFloor.professors} />

                    {selectedFloor.description && (
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
                        🛤️ {selectedFloor.description}
                      </div>
                    )}

                    {/* Wing 별 호실 목록 */}
                    {selectedFloor.rooms && selectedFloor.rooms.length > 0 && (() => {
                      const byWing = new Map<number | null, RoomInList[]>();
                      for (const r of selectedFloor.rooms) {
                        const w = r.wing;
                        if (!byWing.has(w)) byWing.set(w, []);
                        byWing.get(w)!.push(r);
                      }
                      const sortedWings = Array.from(byWing.keys()).sort((a, b) => {
                        if (a === null) return 1;
                        if (b === null) return -1;
                        return a - b;
                      });
                      return (
                        <div className="space-y-4">
                          {sortedWings.map((w) => {
                            const rooms = byWing.get(w)!;
                            const label = w === null
                              ? (lang === "ko" ? "지하·기타" : "Other")
                              : (lang === "ko" ? `${w}동 (${w}${"00"}번대)` : `Wing ${w} (${w}00s)`);
                            return (
                              <div key={String(w)}>
                                <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
                                  🏢 {label}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {rooms.map((r) => (
                                    <div key={r.id} className="group relative">
                                      <Badge variant="outline" className="gap-1 cursor-default whitespace-normal break-words h-auto max-w-full text-left">
                                        <span className="font-mono">{r.code}</span>
                                        {r.name && <span className="text-muted-foreground">— {r.name}</span>}
                                        {r.professors.length > 0 && (
                                          <span className="text-primary font-semibold">· {r.professors.map(p => p.name).join(", ")}</span>
                                        )}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-12 text-center text-muted-foreground">
                    {lang === "ko" ? "이 건물에 등록된 층이 없습니다." : "No floors registered for this building."}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* 탭 2: 교수님 찾기 */}
      {tab === "professors" && (
        <div>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={lang === "ko" ? "이름 / 호실 / 연구분야 검색" : "Search by name, room, or field"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {filteredProfessors.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                {search
                  ? (lang === "ko" ? "검색 결과가 없습니다." : "No results found.")
                  : (lang === "ko" ? "등록된 교수님이 없습니다." : "No professors registered.")}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProfessors.map((p) => {
                const displayName = lang === "en" && p.nameEn ? p.nameEn : p.name;
                return (
                  <Card key={p.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        {p.imageUrl ? (
                          <Image
                            src={p.imageUrl}
                            alt={p.name}
                            width={56}
                            height={56}
                            className="rounded-full object-cover shrink-0 border border-border"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <User className="h-6 w-6 text-muted-foreground/50" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold truncate">{displayName} {p.title}</p>
                          {p.building && (
                            <p className="text-xs text-muted-foreground truncate">
                              {p.building.code} · {p.floor && `${p.floor.level}F · `}{p.roomNumber ?? "-"}
                            </p>
                          )}
                        </div>
                      </div>

                      {p.researchArea && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{p.researchArea}</p>
                      )}

                      <div className="flex flex-col gap-1 text-xs">
                        {p.email && (
                          <a href={`mailto:${p.email}`} className="text-muted-foreground hover:text-primary flex items-center gap-1.5 truncate">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate min-w-0">{p.email}</span>
                          </a>
                        )}
                        {p.phone && (
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <Phone className="h-3 w-3 shrink-0" />
                            {p.phone}
                          </span>
                        )}
                        {p.websiteUrl && (
                          <a href={p.websiteUrl} target="_blank" rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary flex items-center gap-1.5 truncate">
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            {lang === "ko" ? "웹사이트" : "Website"}
                          </a>
                        )}
                      </div>

                      {p.buildingId && (
                        <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => jumpToFloorOf(p)}>
                          <MapPin className="h-3 w-3" />
                          {lang === "ko" ? "지도에서 보기" : "View on map"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
