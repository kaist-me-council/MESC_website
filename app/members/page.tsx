import { prisma } from "@/lib/prisma";
import { MembersClient } from "./members-client";

export const dynamic = "force-dynamic";

async function getMembers() {
  return prisma.member.findMany({ orderBy: [{ order: "asc" }] });
}

export default async function MembersPage() {
  const members = await getMembers();
  return <MembersClient members={members} />;
}
