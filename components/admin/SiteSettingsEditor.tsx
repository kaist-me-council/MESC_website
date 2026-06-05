"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import HoursContactTab from "@/components/admin/site/HoursContactTab";
import LinksTab from "@/components/admin/site/LinksTab";
import ClubsTab from "@/components/admin/site/ClubsTab";
import type { OperatingHours } from "@/lib/site-settings";

export interface SiteSettingsData {
  locationKo: string;
  locationEn: string;
  email: string;
  phone: string;
  hours: OperatingHours;
}
export interface SiteLinkRow {
  id: number;
  category: string;
  label: string;
  labelEn: string | null;
  url: string;
  description: string | null;
  descriptionEn: string | null;
  icon: string | null;
  order: number;
  enabled: boolean;
}
export interface ClubRow {
  id: number;
  name: string;
  nameEn: string | null;
  tagKo: string | null;
  tagEn: string | null;
  descKo: string;
  descEn: string | null;
  activitiesKo: string | null;
  activitiesEn: string | null;
  url: string | null;
  urlLabel: string | null;
  emoji: string | null;
  colorPreset: string | null;
  order: number;
  enabled: boolean;
}

export default function SiteSettingsEditor({
  initialSettings,
  initialLinks,
  initialClubs,
}: {
  initialSettings: SiteSettingsData;
  initialLinks: SiteLinkRow[];
  initialClubs: ClubRow[];
}) {
  const [tab, setTab] = useState("hours");
  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="mb-6">
        <TabsTrigger value="hours">운영시간·연락처</TabsTrigger>
        <TabsTrigger value="links">링크</TabsTrigger>
        <TabsTrigger value="clubs">동아리</TabsTrigger>
      </TabsList>
      <TabsContent value="hours">
        <HoursContactTab initial={initialSettings} />
      </TabsContent>
      <TabsContent value="links">
        <LinksTab initial={initialLinks} />
      </TabsContent>
      <TabsContent value="clubs">
        <ClubsTab initial={initialClubs} />
      </TabsContent>
    </Tabs>
  );
}
