import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isValidString } from "@/lib/validation";

interface Candidate {
  url: string;
  title: string;
  authors: string;
  year: string;
  source: "google" | "openlibrary";
}

const FETCH_TIMEOUT = 8000;
const MAX_CANDIDATES = 10;

// http→https 정규화 + Google Books 표지 URL 정리
function normalizeCoverUrl(raw: string): string {
  if (!raw) return "";
  let url = raw.startsWith("//") ? "https:" + raw : raw.replace(/^http:\/\//i, "https://");
  // Google Books 썸네일의 곱슬 모서리 효과 제거
  url = url.replace(/&edge=curl/gi, "");
  return url;
}

async function fetchGoogleBooks(title: string, author: string): Promise<Candidate[]> {
  let q = `intitle:${title}`;
  if (author) q += `+inauthor:${author}`;
  const endpoint = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=8`;
  const res = await fetch(endpoint, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!res.ok) throw new Error(`Google Books ${res.status}`);
  const data = (await res.json()) as {
    items?: Array<{
      volumeInfo?: {
        title?: string;
        authors?: string[];
        publishedDate?: string;
        imageLinks?: { thumbnail?: string; smallThumbnail?: string };
      };
    }>;
  };
  const out: Candidate[] = [];
  for (const item of data.items ?? []) {
    const info = item.volumeInfo ?? {};
    const thumb = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail;
    if (!thumb) continue;
    out.push({
      url: normalizeCoverUrl(thumb),
      title: info.title ?? "",
      authors: (info.authors ?? []).join(", "),
      year: info.publishedDate ? info.publishedDate.slice(0, 4) : "",
      source: "google",
    });
  }
  return out;
}

async function fetchOpenLibrary(title: string, author: string): Promise<Candidate[]> {
  let endpoint = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=5`;
  if (author) endpoint += `&author=${encodeURIComponent(author)}`;
  const res = await fetch(endpoint, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!res.ok) throw new Error(`Open Library ${res.status}`);
  const data = (await res.json()) as {
    docs?: Array<{
      title?: string;
      author_name?: string[];
      first_publish_year?: number;
      cover_i?: number;
    }>;
  };
  const out: Candidate[] = [];
  for (const doc of data.docs ?? []) {
    if (!doc.cover_i) continue;
    out.push({
      url: `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`,
      title: doc.title ?? "",
      authors: (doc.author_name ?? []).join(", "),
      year: doc.first_publish_year ? String(doc.first_publish_year) : "",
      source: "openlibrary",
    });
  }
  return out;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") ?? "").trim();
  const author = (searchParams.get("author") ?? "").trim();

  if (!isValidString(title, 150)) {
    return NextResponse.json({ error: "검색할 책 제목을 입력해주세요. (최대 150자)" }, { status: 400 });
  }
  if (author && author.length > 150) {
    return NextResponse.json({ error: "저자는 최대 150자까지 입력할 수 있습니다." }, { status: 400 });
  }

  const results = await Promise.allSettled([
    fetchGoogleBooks(title, author),
    fetchOpenLibrary(title, author),
  ]);

  const allFailed = results.every((r) => r.status === "rejected");
  if (allFailed) {
    console.error("cover-search: all sources failed", results);
    return NextResponse.json({ error: "표지 검색 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 502 });
  }

  const merged: Candidate[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") merged.push(...r.value);
  }

  // 중복 URL 제거 + 최대 개수 제한
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const c of merged) {
    if (!c.url || seen.has(c.url)) continue;
    seen.add(c.url);
    candidates.push(c);
    if (candidates.length >= MAX_CANDIDATES) break;
  }

  return NextResponse.json({ candidates });
}
