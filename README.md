# Taskalndar

وبسایت چندکاربره برای برنامه‌ریزی روزانه و تعیین هدف، با تقویم شمسی (جلالی) در سراسر رابط
کاربری. هر کاربر کارهای روزانهٔ خودش و هدف‌های عددی خودش را ثبت می‌کند و می‌بیند هر هفته چقدر
پیشرفت داشته و پیشرفت هر ماه نسبت به ماه شمسی قبل چند درصد تغییر کرده.

## مستندات پروژه

- [docs/spec.md](docs/spec.md) — مشخصات کامل محصول: مدل داده، فرمول محاسبهٔ پیشرفت، صفحات، فناوری
- [docs/task-split-plan.md](docs/task-split-plan.md) — تقسیم تسک‌ها بین دو نفر (بک‌اند/فرانت‌اند) و ترتیب کار
- [docs/automation-ideas.md](docs/automation-ideas.md) — ایده‌های بعدی برای خودکار کردن زمان‌بندی کارها

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
- [x] برنامهٔ خواب: ساعت خواب و بیداری هر شب، پرسش «ثبت شود؟» در برنامهٔ روزانه (بله / ساعت دیگر / نه)، و لینک گوشی که موقع تنظیم زنگ ساعت پیشنهاد می‌فرستد ([قرارداد](docs/planner-v2-contract.md#مرحلهٔ-۶--برنامهٔ-خواب-پیادهسازیشده)). مایگریشن `sleep_schedule` هنوز روی Supabase اعمال نشده
- [x] یادآوری (تا کاربر روشنش نکند خاموش است): پیام بله/تلگرام چند دقیقه قبل از هر جعبهٔ زمانی، با زمان پیش‌فرض دلخواه و زمان جدا برای هر جعبه. مایگریشن `reminders` هنوز روی Supabase اعمال نشده و cron باید به `cron-tick.mjs` تغییر کند
- [x] پیشنهاد چیدن کارها: زمان پیشنهادی برای کارهای روز در وقت خالی، با ساعت و مورد دلخواه کاربر، که فقط با تأیید ذخیره می‌شود. قاعدهٔ کلی: هیچ چیز بدون پرسیدن از کاربر ثبت نمی‌شود
- [x] حالت روشن و تیره (و «مثل دستگاه») از دکمهٔ بالای صفحه یا تنظیمات
- [x] اشتراک‌گذاری پروفایل یا تمپلیت با لینک یا کد، و دریافت در `/import` (کد، لینک، یا خط‌هایی از برنامه‌های دیگر) با پیش‌نمایش و تأیید
- [ ] تنظیم Site URL / Redirect URL در Supabase Auth برای دامنهٔ Railway، و تست دپلوی پس از merge به `main`

جزئیات کامل در [task-split-plan.md](docs/task-split-plan.md).

## Supabase

- Project ref: `herhqlqicakwqoicgbtw`
- URL: `https://herhqlqicakwqoicgbtw.supabase.co`
- مایگریشن‌ها در [`supabase/migrations`](supabase/migrations) نگهداری می‌شوند و با
  `mcp__Supabase__apply_migration` یا `supabase db push` روی پروژه اعمال می‌شوند.

همهٔ مایگریشن‌های این پوشه روی پروژهٔ زنده اعمال شده‌اند (۱۶ اکتبر ۲۰۲۶) و نسخهٔ ثبت‌شدهٔ هرکدام
در `supabase_migrations.schema_migrations` با نسخهٔ نام فایلش یکی است. `apply_migration` نسخه را از
زمان اجرا می‌سازد؛ برای مایگریشن تازه نام فایل را به همان نسخه تغییر دهید، و بعد از هر مایگریشن
`src/lib/database.types.ts` را دوباره تولید کنید. قرارداد دادهٔ پلنر نسخهٔ ۲ در
[docs/planner-v2-contract.md](docs/planner-v2-contract.md) است.

## خلاصهٔ روزانه و یادآوری در بله/تلگرام

اختیاری است؛ بدون این متغیرها اپ عادی کار می‌کند. روی سرویس اپ در Railway تنظیم کنید:

| متغیر | مقدار |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | کلید service role پروژهٔ Supabase (فقط سمت سرور) |
| `BALE_BOT_TOKEN`، `TELEGRAM_BOT_TOKEN` | توکن بات هر پیام‌رسانی که می‌خواهید |
| `BALE_BOT_USERNAME`، `TELEGRAM_BOT_USERNAME` | نام کاربری بات (بدون @)؛ در صفحهٔ تنظیمات نمایش داده می‌شود و پیوند تلگرام با آن ساخته می‌شود |
| `BOT_WEBHOOK_SECRET`، `CRON_SECRET` | دو رشتهٔ تصادفی طولانی |

1. webhook هر بات را ثبت کنید: `setWebhook` با آدرس
   `https://<دامنهٔ اپ>/api/bot/bale?secret=<BOT_WEBHOOK_SECRET>` (برای تلگرام `.../api/bot/telegram`).
2. در Railway یک سرویس cron از همین ریپو بسازید با زمان‌بندی `*/5 * * * *`، دستور شروع
   `node scripts/cron-tick.mjs`، و متغیرهای `APP_URL` و `CRON_SECRET`. هر اجرا خلاصه‌های موعدرسیده را
   می‌فرستد و تا ۵ دقیقه، هر دقیقه یادآوری‌های جعبه‌های زمانی را بررسی می‌کند (کوتاه‌ترین زمان‌بندی
   Railway پنج دقیقه است). سرویسی که هنوز `trigger-daily-summary.mjs` هر ۱۵ دقیقه را اجرا می‌کند فقط
   خلاصه می‌فرستد.

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
