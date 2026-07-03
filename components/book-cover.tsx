"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface BookCoverProps {
  title: string;
  coverImage?: string | null;
  className?: string;
}

export function BookCover({ title, coverImage, className }: BookCoverProps) {
  const [failed, setFailed] = useState(false);
  const showImage = coverImage && !failed;

  return (
    <div
      className={cn(
        "relative aspect-[3/4] overflow-hidden rounded-lg bg-muted ring-1 ring-black/10 dark:ring-white/10",
        className
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverImage}
          alt={`${title} cover`}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col justify-between bg-linear-to-br from-primary/20 via-muted to-muted p-4">
          <div className="flex items-center justify-between">
            <span className="h-7 w-1.5 rounded-full bg-primary/70" />
            <BookOpen className="h-5 w-5 text-primary/70" />
          </div>
          <div>
            <p className="line-clamp-5 text-balance text-sm font-black leading-tight text-foreground">
              {title}
            </p>
            <p className="mt-3 h-1 w-10 rounded-full bg-primary/50" />
          </div>
        </div>
      )}
    </div>
  );
}
