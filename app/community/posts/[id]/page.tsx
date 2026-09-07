import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PostCommentForm } from "./comments-form";
import { ReportButton } from "./report-button";
import { ChevronLeft, MessageCircle, Eye } from "lucide-react";
import { ViewTracker } from "@/components/view-tracker";
import { LikeButton } from "./like-button";
import { readVisitorToken, visitorHash } from "@/lib/visitor";

export const revalidate = 0;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PostDetailPage({ params }: Props) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id || isNaN(id)) notFound();

  const post = await prisma.post.findFirst({
    where: { id, hidden: false },
    select: {
      id: true,
      category: true,
      title: true,
      content: true,
      authorTag: true,
      commentCount: true,
      viewCount: true,
      likeCount: true,
      createdAt: true,
      comments: {
        where: { hidden: false },
        orderBy: { createdAt: "asc" },
        select: { id: true, content: true, authorTag: true, createdAt: true },
      },
    },
  });

  if (!post) notFound();

  const token = await readVisitorToken();
  const liked = token
    ? !!(await prisma.postLike.findUnique({
        where: { postId_voterHash: { postId: post.id, voterHash: visitorHash(token, "like") } },
        select: { id: true },
      }))
    : false;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <ViewTracker kind="post" id={post.id} />
      <Link href="/community" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
        <ChevronLeft className="h-4 w-4" />
        커뮤니티
      </Link>

      <Card className="mb-6 border-border/60 rounded-2xl">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{post.category}</Badge>
            <span className="text-xs text-muted-foreground">{post.authorTag}</span>
            <span className="text-xs text-muted-foreground">
              · {new Date(post.createdAt).toLocaleString("ko-KR")}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="tabular-nums">{post.viewCount}</span>
              <span className="sr-only">조회수</span>
            </span>
            <div className="ml-auto">
              <ReportButton targetType="post" targetId={post.id} />
            </div>
          </div>
          <h1 className="text-2xl font-bold">{post.title}</h1>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>
          <LikeButton postId={post.id} initialCount={post.likeCount} initialLiked={liked} />
        </CardContent>
      </Card>

      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <MessageCircle className="h-4 w-4" />
        댓글 {post.comments.length}
      </h2>

      <div className="space-y-2 mb-6">
        {post.comments.map((c) => (
          <Card key={c.id} className="border-border/60 rounded-xl">
            <CardContent className="p-3 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">{c.authorTag}</span>
                <span className="text-xs text-muted-foreground">
                  · {new Date(c.createdAt).toLocaleString("ko-KR")}
                </span>
                <div className="ml-auto">
                  <ReportButton targetType="comment" targetId={c.id} />
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap">{c.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <PostCommentForm postId={post.id} />
    </div>
  );
}
