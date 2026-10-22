import type { Metadata } from "next";
import "@fontsource-variable/vazirmatn";
import { themeAttribute } from "@/lib/theme";
import { CUSTOM_STYLE_ID } from "@/lib/appearance";
import { loadAppearance, loadTheme } from "@/lib/theme-server";
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
  const [theme, look] = await Promise.all([loadTheme(), loadAppearance()]);
  return (
    <html
      lang="fa"
      dir="rtl"
      data-theme={themeAttribute(theme)}
      data-skin={look.skin}
      data-scene={look.scene}
      data-intensity={look.intensity}
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col font-sans">
        {/* a personal theme's colours; built only from checked hex values (custom-theme.ts) */}
        <style id={CUSTOM_STYLE_ID}>{look.css ?? ""}</style>
        {children}
      </body>
    </html>
  );
}
