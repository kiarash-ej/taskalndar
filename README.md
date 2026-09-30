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

نفر اول (بک‌اند و زیرساخت) کارهای خودش را کامل کرده، به‌جز دو مورد که به اسکلت Next.js نفر دوم وابسته‌اند:

- [x] پروژهٔ Supabase + جداول (`tasks`، `task_completions`، `goals`، `goal_logs`) + Row Level Security
- [x] احراز هویت ایمیل/رمز عبور (پیش‌فرض Supabase، تأیید شد)
- [x] منطق تقویم جلالی و محاسبهٔ پیشرفت در [`packages/core`](packages/core) با ۱۷ تست واحد
- [x] سرویس Railway ساخته و به ریپو وصل شد؛ متغیرهای Supabase تنظیم شدند
- [ ] مسیرهای محافظت‌شده در Next.js — **منتظر** اسکلت Next.js نفر دوم
- [ ] تست دپلوی موفق — **منتظر** وجود اپی برای build (فعلاً دپلوی خطای build می‌دهد چون هنوز کدی نیست)
- [ ] کد فرانت‌اند (نفر دوم) هنوز نوشته نشده

جزئیات کامل در [task-split-plan.md](docs/task-split-plan.md).

## Supabase

- Project ref: `herhqlqicakwqoicgbtw`
- URL: `https://herhqlqicakwqoicgbtw.supabase.co`
- مایگریشن‌ها در [`supabase/migrations`](supabase/migrations) نگهداری می‌شوند و با
  `mcp__Supabase__apply_migration` یا `supabase db push` روی پروژه اعمال می‌شوند.

## منطق مشترک (`packages/core`)

تبدیل تقویم جلالی، مرز هفته/ماه شمسی، و فرمول‌های پیشرفت طبق `docs/spec.md`:

```bash
cd packages/core
npm install
npm test
```

## توسعه (پس از اسکلت‌بندی اولیه)

دستورات زیر پس از اضافه‌شدن `package.json` پروژه تکمیل می‌شود:

```bash
npm install
npm run dev
```

متغیرهای محیطی موردنیاز، نمونه در [`.env.example`](.env.example).
