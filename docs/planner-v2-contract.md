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
`<user id>/` می‌خواند و می‌نویسد. نمایش با signed URL (`createSignedUrl`).

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

## مرحلهٔ ۳ — جعبه‌های زمانی (پیشنهادی)

| جدول | ستون‌ها |
| --- | --- |
| `time_blocks` | `user_id`، `day date`، `start_at`/`end_at timestamptz`، `title`، `description`، `tags text[]`، `amount numeric?`، `unit text?`، `cost numeric?` (تومان)، `done boolean`، `source` (`manual` یا `timer`) |
| `day_templates` | `user_id`، `name` |
| `day_template_blocks` | `template_id`، `start_time`/`end_time time`، `title`، `tags text[]` |

- `apply_day_template(p_template_id uuid, p_day date) returns setof time_blocks`
- `splitAtMidnight(block) → block[]` در `packages/core`، برای جعبه‌ای که از نیمه‌شب رد می‌شود

## مرحلهٔ ۴ — گزارش ماهانه (پیشنهادی)

`packages/core` یا `src/lib/report.ts`:

- `filterBlocks(blocks, { month, weekdays?, from?: "HH:MM", to?: "HH:MM", tags?, text? })`
- `summarizeBlocks(blocks) → { totalMinutes /* هم‌پوشانی یک بار */, minutesByTag, amountByUnit, totalCost }`
