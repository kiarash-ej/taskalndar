import type { Metadata } from "next";
import Link from "next/link";
import { NewTemplateForm, TemplateCard } from "@/components/template-editor";
import { buttonClass, Card, CardHeader, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { loadTemplates, loadUserTags } from "@/lib/data";

export const metadata: Metadata = { title: "تمپلیت‌های روز" };

export default async function TemplatesPage() {
  const user = await requireUser();
  const [templates, suggestions] = await Promise.all([loadTemplates(user.id), loadUserTags()]);

  return (
    <div>
      <PageHeader
        title="تمپلیت‌های روز"
        subtitle="چینش‌های آمادهٔ جعبه‌های زمانی که با یک کلیک روی هر روز اعمال می‌شوند."
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-4">
          {templates.length === 0 && (
            <Card className="py-10 text-center">
              <p className="font-semibold">هنوز تمپلیتی نساخته‌اید.</p>
              <p className="mt-1 text-sm text-muted">
                یک تمپلیت بسازید و جعبه‌هایش را اضافه کنید، یا در{" "}
                <Link href="/planner" className="font-semibold text-accent hover:underline">
                  برنامهٔ روزانه
                </Link>{" "}
                جعبه‌های یک روز را به‌عنوان تمپلیت ذخیره کنید.
              </p>
            </Card>
          )}
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} suggestions={suggestions} />
          ))}
        </div>
        <div className="space-y-4 lg:sticky lg:top-32">
          <Card>
            <CardHeader title="تمپلیت جدید" />
            <NewTemplateForm />
          </Card>
          <Card>
            <CardHeader
              title="دریافت از کد"
              subtitle="تمپلیتی که کسی برایتان فرستاده، یا خط‌هایی از یک برنامهٔ دیگر را وارد کنید."
            />
            <Link href="/import" className={`${buttonClass.secondary} w-full`}>
              وارد کردن کد یا متن
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
