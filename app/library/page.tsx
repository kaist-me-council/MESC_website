import { prisma } from "@/lib/prisma";
import LibraryClient, { type LibraryBook } from "./library-client";

export default async function LibraryPage() {
  let books: LibraryBook[] = [];

  try {
    books = await prisma.book.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        titleEn: true,
        author: true,
        publisher: true,
        coverImage: true,
        isbn: true,
        quantity: true,
        available: true,
        category: true,
        course: {
          select: {
            id: true,
            code: true,
          },
        },
      },
    });
  } catch {
    books = [];
  }

  return <LibraryClient books={books} />;
}
