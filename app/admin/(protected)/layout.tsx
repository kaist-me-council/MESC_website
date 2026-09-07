import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { AdminShell } from "./admin-shell";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/admin/login");
  }

  return (
    <AdminShell
      userName={session.user?.name ?? "관리자"}
      signOutSlot={
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <Button variant="outline" size="sm" type="submit" className="gap-1.5">
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">로그아웃</span>
          </Button>
        </form>
      }
    >
      {children}
    </AdminShell>
  );
}
