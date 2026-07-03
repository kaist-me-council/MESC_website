import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import CourseDetailClient from "./course-detail-client";

export default async function CourseDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const course = await prisma.course.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      name: true,
      nameEn: true,
      level: true,
      description: true,
      descriptionEn: true,
      textbook: true,
      textbookAvailable: true,
      youtubeUrl: true,
    },
  });
  if (!course) notFound();

  const resources = await prisma.resource.findMany({
    where: { courseCode: code },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      fileUrl: true,
    },
  });

  return <CourseDetailClient course={course} resources={resources} />;
}
