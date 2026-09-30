# Taskalndar

وبسایت چندکاربره برای برنامه‌ریزی روزانه و تعیین هدف، با تقویم شمسی (جلالی) در سراسر رابط
کاربری. هر کاربر کارهای روزانهٔ خودش و هدف‌های عددی خودش را ثبت می‌کند و می‌بیند هر هفته چقدر
پیشرفت داشته و پیشرفت هر ماه نسبت به ماه شمسی قبل چند درصد تغییر کرده.

## مستندات پروژه

- [docs/spec.md](docs/spec.md) — مشخصات کامل محصول: مدل داده، فرمول محاسبهٔ پیشرفت، صفحات، فناوری
- [docs/task-split-plan.md](docs/task-split-plan.md) — تقسیم تسک‌ها بین دو نفر (بک‌اند/فرانت‌اند) و ترتیب کار

## فناوری

- **فرانت‌اند:** Next.js (App Router) + React + Tailwind CSS
- **بک‌اند/دیتابیس/احراز هویت:** Supabase (Postgres + Auth + Row Level Security)
- **تبدیل تقویم:** `jalaali-js`
- **نمودارها:** Recharts
- **هاستینگ:** Railway

## وضعیت پروژه

- [x] پروژهٔ Supabase ساخته شد و جداول `tasks`، `task_completions`، `goals`، `goal_logs` طبق
      [docs/spec.md](docs/spec.md) ایجاد شدند (مایگریشن در [`supabase/migrations`](supabase/migrations))
- [ ] Row Level Security هنوز فعال نیست (تسک بعدی نفر اول)
- [ ] کد فرانت‌اند و بک‌اند هنوز نوشته نشده

مراحل کار طبق [task-split-plan.md](docs/task-split-plan.md) پیش می‌رود.

## Supabase

- Project ref: `herhqlqicakwqoicgbtw`
- URL: `https://herhqlqicakwqoicgbtw.supabase.co`
- مایگریشن‌ها در [`supabase/migrations`](supabase/migrations) نگهداری می‌شوند و با
  `mcp__Supabase__apply_migration` یا `supabase db push` روی پروژه اعمال می‌شوند.

## توسعه (پس از اسکلت‌بندی اولیه)

دستورات زیر پس از اضافه‌شدن `package.json` پروژه تکمیل می‌شود:

```bash
npm install
npm run dev
```

متغیرهای محیطی موردنیاز، نمونه در [`.env.example`](.env.example).
