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

- [x] پروژهٔ Supabase + جداول (`tasks`، `task_completions`، `goals`، `goal_logs`) + Row Level Security
- [x] احراز هویت ایمیل/رمز عبور (پیش‌فرض Supabase، تأیید شد)
- [x] منطق تقویم جلالی و محاسبهٔ پیشرفت در [`packages/core`](packages/core) با ۱۷ تست واحد
- [x] سرویس Railway ساخته و به ریپو وصل شد؛ متغیرهای Supabase تنظیم شدند
- [x] اپ Next.js (نفر دوم): ورود/ثبت‌نام، داشبورد، برنامهٔ روزانه با تقویم شمسی، هدف‌ها، آمار با نمودار
- [x] مسیرهای محافظت‌شده در [`src/proxy.ts`](src/proxy.ts)
- [x] مایگریشن [`add_task_date`](supabase/migrations/20261001124442_add_task_date.sql) (ستون `tasks.date`) روی Supabase اعمال شد
- [ ] تنظیم Site URL / Redirect URL در Supabase Auth برای دامنهٔ Railway، و تست دپلوی پس از merge به `main`

جزئیات کامل در [task-split-plan.md](docs/task-split-plan.md).

## Supabase

- Project ref: `herhqlqicakwqoicgbtw`
- URL: `https://herhqlqicakwqoicgbtw.supabase.co`
- مایگریشن‌ها در [`supabase/migrations`](supabase/migrations) نگهداری می‌شوند و با
  `mcp__Supabase__apply_migration` یا `supabase db push` روی پروژه اعمال می‌شوند.

مایگریشن‌های جدید `20261001131846_enforce_parent_ownership` و
`20261001131853_preserve_task_and_goal_history` هنوز روی پروژهٔ زنده اعمال نشده‌اند؛
پیش از اجرای نسخهٔ جدید اپ باید اعمال شوند. اولی مالکیت کار/هدف مرجع را تضمین می‌کند؛
دومی سابقهٔ تغییر نوع کار و تاریخ شروع هدف را نگه می‌دارد.

## منطق مشترک (`packages/core`)

تبدیل تقویم جلالی، مرز هفته/ماه شمسی، و فرمول‌های پیشرفت طبق `docs/spec.md`:

```bash
cd packages/core
npm install
npm test
```

## توسعه

اپ Next.js در ریشهٔ ریپوست و `packages/core` یک npm workspace است (Node.js 20.9 یا بالاتر):

```bash
npm install
cp .env.example .env.local   # آدرس و کلید عمومی Supabase
npm run dev                  # http://localhost:3000
```

| دستور | کار |
| --- | --- |
| `npm test` | تست‌های اپ (`src/**/*.test.ts`) و `packages/core` |
| `npm run typecheck` | بررسی TypeScript |
| `npm run lint` | ESLint |
| `npm run build` / `npm start` | build و اجرای production (همان چیزی که Railway اجرا می‌کند) |

ساختار کد فرانت‌اند و تصمیم‌های محاسبهٔ پیشرفت در [task-split-plan.md](docs/task-split-plan.md#وضعیت-فرانتاند-نفر-دوم) آمده است.
