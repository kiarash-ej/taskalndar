import type { Metadata } from "next";
import { BackgroundForm } from "@/components/background-form";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { loadBackground } from "@/lib/profile";

export const metadata: Metadata = { title: "تنظیمات" };

export default async function SettingsPage() {
  const user = await requireUser();
  const { background } = await loadBackground(user.id);

  return (
    <div className="space-y-4">
      <PageHeader title="تنظیمات" subtitle="ظاهر برنامه را به سلیقهٔ خودتان دربیاورید." />
      <Card>
        <CardHeader title="پس‌زمینه" subtitle="یک رنگ، گرادیان یا تصویر شخصی انتخاب کنید." />
        <BackgroundForm current={background} />
      </Card>
    </div>
  );
}
