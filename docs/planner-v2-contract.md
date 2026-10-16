# قرارداد دادهٔ پلنر نسخهٔ ۲ (مرحلهٔ ۰)

قرارداد بین نفر A (دیتابیس و منطق) و نفر B (رابط کاربری) برای قابلیت‌های جدید پلنر.
تقسیم کار و ترتیب مراحل در [planner-tasks-split.md](planner-tasks-split.md) آمده است.
بخش‌های «پیاده‌سازی‌شده» در ریپو مایگریشن و تست دارند؛ بخش‌های «پیشنهادی» تا شروع همان
مرحله قابل تغییرند.

قواعد مشترک همهٔ جدول‌ها: RLS با `(select auth.uid()) = user_id`، تاریخ روز به‌صورت
`date` (روز تقویمی کاربر به وقت تهران، که اپ انتخاب می‌کند)، و شمارهٔ روز هفته از
**۰ = شنبه تا ۶ = جمعه** (`jalaaliWeekday` در `packages/core` و `public.jalali_weekday` در
دیتابیس).

## مرحلهٔ ۱ — پس‌زمینه و یادداشت (پیاده‌سازی‌شده)

مایگریشن‌ها: `20261015090000_profiles_and_daily_notes.sql`، `20261015090100_backgrounds_storage.sql`

### `daily_notes`

| ستون | نوع | توضیح |
| --- | --- | --- |
| `user_id` | `uuid` | مالک |
| `day` | `date` | روز یادداشت؛ `unique (user_id, day)` |
| `body` | `text` | حداکثر ۱۰۰۰۰ نویسه |
| `updated_at` | `timestamptz` | با trigger خودکار به‌روز می‌شود |

ذخیره با upsert: `onConflict: "user_id,day"`.

### `profiles`

یک ردیف برای هر کاربر با `id = auth.uid()`. ردیف وجود ندارد تا اولین ذخیره؛ نبودنش یعنی پیش‌فرض (`none`).

| `background_kind` | `background_value` |
| --- | --- |
| `none` | `null` |
| `color` | رنگ `#rrggbb` |
| `gradient` | کلید یکی از گرادیان‌های آمادهٔ اپ (`a-z`، `0-9`، `-`، حداکثر ۴۰ نویسه) |
| `image` | مسیر فایل در باکت `backgrounds` که با `<user id>/` شروع شود |

### باکت `backgrounds`

خصوصی، حداکثر ۵ مگابایت، فقط `image/jpeg`، `image/png`، `image/webp`. هر کاربر فقط در پوشهٔ
`<user id>/` می‌خواند و می‌نویسد. اپ تصویر را از مسیر خودش `/background-image?v=<path>` با نشست همان کاربر
نمایش می‌دهد (نه signed URL، که با هر رندر عوض می‌شد و تصویر را دوباره دانلود می‌کرد).

## مرحلهٔ ۲ — تکرار هفتگی (پیاده‌سازی‌شده)

مایگریشن: `20261015090200_weekly_schedules.sql`

### `tasks.weekdays` (`smallint[]`)

| `is_recurring` | `weekdays` | معنی |
| --- | --- | --- |
| `false` | `null` | یک‌بار، فقط روز `date` |
| `true` | `null` | هر روز از `date` به بعد |
| `true` | مثلاً `[0, 2, 4]` | از `date` به بعد، فقط شنبه، دوشنبه و چهارشنبه |

شکل ذخیره یکتاست: ۱ تا ۶ روز، مرتب و بدون تکرار. هفت روز یعنی `null`. ردیف غیراستاندارد
با check constraint رد می‌شود. پس در `insert` مستقیم، آرایه را مرتب بفرستید یا از RPC زیر استفاده کنید
که خودش مرتب می‌کند.

### `update_task_schedule(p_task_id, p_title, p_is_recurring, p_effective_date, p_weekdays?)`

پارامتر پنجم اختیاری است: بدون آن، کار تکراری «هر روز» است. فرم ویرایش کار باید برای
کارهای هفتگی `p_weekdays` را بفرستد، وگرنه ویرایش عنوانِ یک کار هفتگی آن را روزانه می‌کند.
تغییر برنامه مثل قبل یک نسخهٔ جدید از روز اعمال می‌سازد و ثبت‌های انجامِ روزهایی که برنامهٔ
جدید پوشش می‌دهد به نسخهٔ جدید منتقل می‌شوند.

### `goals.period`

`'monthly'` یا `'weekly'`. هدف هفتگی برای یک هفتهٔ شمسی (شنبه تا جمعه) است. در محاسبه هر روز
`target / 7` سهم دارد (`goalDailyTarget` در [scoring.ts](../src/lib/scoring.ts)).

### توابع منطق

| تابع | جا | کار |
| --- | --- | --- |
| `jalaaliWeekday(date: Date): number` | `packages/core` | شمارهٔ روز هفته، ۰ = شنبه |
| `isTaskActiveOn(task, day)` | `src/lib/scoring.ts` | حالا `weekdays` را هم در نظر می‌گیرد |
| `goalDailyTarget(goal, day)` | `src/lib/scoring.ts` | سهم یک روز از هدف هفتگی یا ماهانه |

`TaskRow` حالا `weekdays` و `GoalRow` حالا `period` دارد. `loadProgressData` هر دو را می‌خواند.

## مرحلهٔ ۳ — جعبه‌های زمانی (پیاده‌سازی‌شده)

مایگریشن: `20261015100000_time_blocks_and_templates.sql`

### `time_blocks`

| ستون | نوع | توضیح |
| --- | --- | --- |
| `day` | `date` | روز تهرانی جعبه |
| `start_at`، `end_at` | `timestamptz` | باید داخل همان روز باشند؛ `end_at` حداکثر نیمه‌شب بعد |
| `title` | `text` | ۱ تا ۲۰۰ نویسه |
| `description` | `text` | جزئیات آزاد، حداکثر ۱۰۰۰۰ نویسه، پیش‌فرض خالی |
| `tags` | `text[]` | حداکثر ۱۰ برچسب یکتا، هرکدام ۱ تا ۴۰ نویسه، بدون فاصلهٔ اضافه |
| `amount`، `unit` | `numeric`، `text` | اختیاری؛ `unit` فقط همراه `amount` |
| `cost` | `numeric` | اختیاری، تومان، نامنفی |
| `done` | `boolean` | پیش‌فرض `false` |
| `source` | `text` | `manual` (پیش‌فرض) یا `timer` |

- برچسب‌ها را پیش از ذخیره با `normalizeTags` در [tags.ts](../src/lib/tags.ts) یکدست کنید. این تابع «ي/ك» عربی را به «ی/ک» تبدیل می‌کند، فاصله و `#` را مرتب می‌کند و تکراری‌ها را حذف می‌کند. ورودی را به‌صورت آرایه یا متن جداشده با ویرگول می‌گیرد.
- پیشنهاد برچسب: `rpc("user_tags")`، که برچسب‌های خود کاربر را به ترتیب پرکاربردترین برمی‌گرداند.
- بازه‌ای که از نیمه‌شب رد می‌شود (مثلاً تایمر): `splitAtMidnights(start, end, "Asia/Tehran")` در `packages/core` آن را به یک تکه برای هر روز می‌شکند.

### `day_templates` و `day_template_blocks`

تمپلیت یک `name` دارد. جعبه‌های تمپلیت `start_time` و `end_time` از نوع `time` دارند، به وقت تهران؛ `end_time` می‌تواند `24:00` باشد. جعبه‌ها `title` و `tags` هم دارند.

- `rpc("apply_day_template", { p_template_id, p_day })`: جعبه‌های تمپلیت را به‌عنوان `time_blocks` همان روز می‌سازد و برمی‌گرداند. اعمال دوباره جعبه‌ها را دوباره می‌سازد، پس UI قبلش تأیید بگیرد.

## مرحلهٔ ۴ — گزارش ماهانه (پیاده‌سازی‌شده)

- `loadTimeBlocks(userId, from, to)` در [data.ts](../src/lib/data.ts)
- `filterBlocks(blocks, { from, to, weekdays?, timeFrom?, timeTo?, tags?, text? })` در [report.ts](../src/lib/report.ts)
  - `timeFrom`/`timeTo` به‌شکل `"HH:MM"` به وقت تهران‌اند؛ `timeTo` می‌تواند `"24:00"` باشد. هر جعبه به این پنجره بریده می‌شود و `minutes` همان بخش داخل پنجره است.
  - با `tags` هر جعبه‌ای که یکی از برچسب‌ها را داشته باشد برمی‌گردد. جستجوی `text` در عنوان، توضیحات و برچسب‌ها انجام می‌شود و به حرف «ي/ی» حساس نیست.
- `summarizeReport(items)` این‌ها را برمی‌گرداند:
  - `totalMinutes`: هم‌پوشانی یک بار شمرده می‌شود.
  - `minutesByTag`
  - `untaggedMinutes`
  - `amountByUnit`: مقدار کل جعبه، نه بریده‌شده.
  - `totalCost`، `blockCount`، `dayCount`

بازهٔ ماه شمسی: `jalaliMonthRange({ jy, jm })` در [dates.ts](../src/lib/dates.ts).

## مرحلهٔ ۵ — ارسال پیام (پیاده‌سازی‌شده؛ بله و تلگرام)

مایگریشن: `20261015110000_notification_channels.sql`

### `notification_channels`

برای هر کاربر و هر پیام‌رسان یک ردیف وجود دارد (`kind`: `bale` یا `telegram`).

| کاربر می‌تواند بنویسد | فقط سرور می‌نویسد |
| --- | --- |
| `kind` (هنگام ساخت)، `enabled`، `send_time` (مضرب ۱۵ دقیقه، وقت تهران، پیش‌فرض ۲۱:۰۰)، `include_tasks`، `include_blocks`، `include_note` | `link_code`، `chat_id`، `linked_at`، `last_sent_on` |

روند اتصال در UI:

1. کاربر ردیف را می‌سازد و `link_code` برمی‌گردد (۳۲ نویسه، ۳۰ دقیقه اعتبار).
2. کاربر در بات دستور `/start <link_code>` را می‌فرستد. برای تلگرام، پیوند `telegramLinkUrl(bot, code)` همین را آماده می‌کند.
3. بعد از اتصال، `chat_id` پر می‌شود و `link_code` خالی می‌شود. UI با خواندن دوبارهٔ ردیف وضعیت را می‌بیند.
4. اتصال دوباره یعنی حذف ردیف و ساختن ردیف تازه.

`/stop` در بات همهٔ اتصال‌های آن گفت‌وگو را حذف می‌کند.

### سرور

| مسیر | کار | محافظت |
| --- | --- | --- |
| `POST /api/bot/bale`، `/api/bot/telegram` | webhook بات: `/start`، `/stop` | `?secret=` یا هدر `X-Telegram-Bot-Api-Secret-Token` برابر `BOT_WEBHOOK_SECRET` |
| `POST /api/cron/daily-summary` | فرستادن خلاصه‌های موعدرسیده، هر ۱۵ دقیقه | `Authorization: Bearer <CRON_SECRET>` |

متن پیام را `buildDailySummary` می‌سازد: کارهای روز، جعبه‌ها و یادداشت، طبق تنظیمات کانال.

پیامک ارسال نمی‌شود: به انتخاب سرویس پیامک ایرانی و تأیید شمارهٔ کاربر نیاز دارد و تصمیمش باز است.
