import { ThemeToggle } from "@/components/theme-toggle";
import { loadTheme } from "@/lib/theme-server";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const theme = await loadTheme();
  return (
    <main className="relative flex flex-1 items-center justify-center px-4 py-12">
      <div className="absolute end-4 top-4">
        <ThemeToggle initial={theme} />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-3xl font-extrabold tracking-tight text-accent">تسکلندر</p>
          <p className="mt-2 text-sm text-muted">برنامه‌ریزی روزانه و پیگیری هدف‌ها با تقویم شمسی</p>
        </div>
        {children}
      </div>
    </main>
  );
}
