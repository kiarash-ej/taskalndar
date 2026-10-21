import type { Metadata } from "next";
import { ImportShared } from "@/components/import-shared";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { loadSleepSettings } from "@/lib/data";

export const metadata: Metadata = { title: "دریافت از کد" };

// Where share links land (/import#TSK1...), and where codes or lines from
// other apps are pasted. Nothing is added before the user says yes.
export default async function ImportPage() {
  const user = await requireUser();
  const sleep = await loadSleepSettings(user.id);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="دریافت از کد"
        subtitle="تمپلیت یا برنامه‌ای که کسی برایتان فرستاده، یا خط‌هایی از یک برنامهٔ دیگر را وارد کنید."
      />
      <Card>
        <ImportShared hasSleepSchedule={(sleep?.plans.length ?? 0) > 0} />
      </Card>
    </div>
  );
}
