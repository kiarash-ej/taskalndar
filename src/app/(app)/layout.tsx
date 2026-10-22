import Link from "next/link";
import { AppBackground } from "@/components/app-background";
import { MainNav } from "@/components/main-nav";
import { SkinScene } from "@/components/skin-scene";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonClass } from "@/components/ui";
import { signOut } from "@/lib/actions/auth";
import { requireUser } from "@/lib/auth";
import { loadBackground } from "@/lib/profile";
import { loadSkin, loadTheme } from "@/lib/theme-server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const [{ background, imageUrl }, theme, skin] = await Promise.all([
    loadBackground(user.id),
    loadTheme(),
    loadSkin(),
  ]);
  return (
    <>
      <AppBackground background={background} imageUrl={imageUrl} />
      <SkinScene initial={skin} />
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
              <ThemeToggle initial={theme} />
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
