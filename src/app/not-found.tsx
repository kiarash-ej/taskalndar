import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-5xl font-extrabold text-accent">۴۰۴</p>
      <p className="text-muted">صفحه‌ای که دنبالش بودید پیدا نشد.</p>
      <Link href="/" className={buttonClass.secondary}>
        بازگشت به داشبورد
      </Link>
    </main>
  );
}
