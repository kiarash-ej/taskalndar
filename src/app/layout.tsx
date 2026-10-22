import type { Metadata } from "next";
import "@fontsource-variable/vazirmatn";
import { themeAttribute } from "@/lib/theme";
import { loadSkin, loadTheme } from "@/lib/theme-server";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "تسکلندر",
    template: "%s · تسکلندر",
  },
  description: "برنامه‌ریزی روزانه و پیگیری هدف‌ها با تقویم شمسی",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // the user's light/dark choice and skin, so the page arrives in the right colours
  const [theme, skin] = await Promise.all([loadTheme(), loadSkin()]);
  return (
    <html
      lang="fa"
      dir="rtl"
      data-theme={themeAttribute(theme)}
      data-skin={skin ?? undefined}
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
