import Link from "next/link";
import { MainNav } from "@/components/main-nav";
import { buttonClass } from "@/components/ui";
import { signOut } from "@/lib/actions/auth";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto max-w-5xl space-y-2 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="text-lg font-extrabold tracking-tight text-accent">
              تسکلندر
            </Link>
            <div className="flex min-w-0 items-center gap-2">
              <span dir="ltr" className="hidden truncate text-sm text-muted sm:inline">
                {user.email}
              </span>
              <form action={signOut}>
                <button type="submit" className={`${buttonClass.ghost} px-3 py-1.5`}>
                  خروج
                </button>
              </form>
            </div>
          </div>
          <MainNav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">{children}</main>
    </>
  );
}
