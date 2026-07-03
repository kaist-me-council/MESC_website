"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, Library } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BookCover } from "@/components/book-cover";
import { useLanguage } from "@/lib/language-context";
import { pick } from "@/lib/bilingual";
import { cn } from "@/lib/utils";

export interface LibraryBook {
  id: number;
  title: string;
  titleEn: string | null;
  author: string | null;
  publisher: string | null;
  coverImage: string | null;
  isbn: string | null;
  quantity: number;
  available: boolean;
  category: string | null;
  course: {
    id: number;
    code: string;
  } | null;
}

const ALL_CATEGORY = "__all__";

export default function LibraryClient({ books }: { books: LibraryBook[] }) {
  const { lang, t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY);

  const categories = useMemo(() => {
    return Array.from(new Set(books.map((book) => book.category).filter((category): category is string => Boolean(category)))).sort();
  }, [books]);

  const filteredBooks = activeCategory === ALL_CATEGORY
    ? books
    : books.filter((book) => book.category === activeCategory);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-12">
      <div className="mb-10">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
          <Library className="h-3.5 w-3.5 text-primary" />
          {t("library.badge")}
        </div>
        <h1 className="text-balance text-4xl font-black tracking-tight md:text-5xl">
          {t("library.title")}
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-muted-foreground">
          {t("library.description")}
        </p>
      </div>

      <div className="mb-8 flex flex-wrap gap-2" role="tablist" aria-label={t("library.title")}>
        <button
          onClick={() => setActiveCategory(ALL_CATEGORY)}
          role="tab"
          aria-selected={activeCategory === ALL_CATEGORY}
          className={cn(
            "min-h-10 rounded-xl px-4 py-2 text-sm font-medium transition-[background-color,color,box-shadow,scale] active:scale-[0.96]",
            activeCategory === ALL_CATEGORY
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          )}
        >
          {t("library.all")}
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            role="tab"
            aria-selected={activeCategory === category}
            className={cn(
              "min-h-10 rounded-xl px-4 py-2 text-sm font-medium transition-[background-color,color,box-shadow,scale] active:scale-[0.96]",
              activeCategory === category
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {filteredBooks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center text-muted-foreground">
          <BookOpen className="mx-auto mb-4 h-12 w-12 opacity-30" />
          <p>{t("library.empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredBooks.map((book) => {
            const title = pick(lang, book.title, book.titleEn);
            const cardClass = "group block h-full rounded-lg hover-lift-premium";
            const card = (
              <article className="h-full">
                <BookCover
                  title={title}
                  coverImage={book.coverImage}
                  className="shadow-sm shadow-black/5"
                />
                <div className="pt-3">
                  <h2 className="line-clamp-2 text-pretty text-sm font-bold leading-snug group-hover:text-primary">
                    {title}
                  </h2>
                  {book.author && (
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{book.author}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-xs tabular-nums">
                      {t("library.quantity").replace("{count}", String(book.quantity))}
                    </Badge>
                    {!book.available && (
                      <Badge variant="outline" className="text-xs">
                        {t("library.displayOnly")}
                      </Badge>
                    )}
                    {book.course && (
                      <Badge variant="outline" className="gap-1 text-xs font-mono">
                        {book.course.code}
                        <ChevronRight className="h-3 w-3" />
                      </Badge>
                    )}
                  </div>
                </div>
              </article>
            );

            return book.course ? (
              <Link key={book.id} href={`/courses/${book.course.code}`} className={cardClass}>
                {card}
              </Link>
            ) : (
              <div key={book.id} className={cardClass}>{card}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
