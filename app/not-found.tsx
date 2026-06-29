import Link from "next/link";
import { Compass, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative min-h-[70vh] flex items-center justify-center overflow-hidden bg-background px-4">
      <div className="absolute inset-0 tech-mesh opacity-20 -z-10" />
      <div className="max-w-lg w-full text-center space-y-8">
        <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-primary/10 border border-primary/20 text-primary mx-auto">
          <Compass className="h-9 w-9" />
        </div>
        <div className="space-y-3">
          <p className="text-6xl md:text-7xl font-black tracking-tight text-primary">404</p>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            페이지를 찾을 수 없습니다
          </h1>
          <p className="text-muted-foreground leading-relaxed max-w-md mx-auto">
            요청하신 페이지가 삭제되었거나 주소가 변경되었을 수 있습니다.
            <br className="hidden sm:block" />
            <span className="text-muted-foreground/70 text-sm">
              The page you are looking for doesn&apos;t exist.
            </span>
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-bold transition duration-150 hover:bg-primary/80 active:translate-y-px active:scale-[0.96]"
        >
          <Home className="h-4 w-4" />
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
