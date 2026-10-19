import type { Metadata } from "next";
import { BackgroundForm } from "@/components/background-form";
import { ChannelPanel, type ChannelView } from "@/components/channel-settings";
import { ReminderSettingsForm } from "@/components/reminder-settings";
import { SleepPhoneLink, SleepScheduleForm } from "@/components/sleep-settings";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { channelState } from "@/lib/channels";
import { loadChannels, loadReminderSettings, loadSleepSettings } from "@/lib/data";
import { BOT_KINDS } from "@/lib/messaging/bots";
import { botTokens, botUsernames } from "@/lib/messaging/config";
import { loadBackground } from "@/lib/profile";

export const metadata: Metadata = { title: "تنظیمات" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [{ background }, channels, sleep, reminders] = await Promise.all([
    loadBackground(user.id),
    loadChannels(user.id),
    loadSleepSettings(user.id),
    loadReminderSettings(user.id),
  ]);

  // Only messengers whose bot is configured on this server are offered.
  const tokens = botTokens();
  const usernames = botUsernames();
  const now = new Date();
  const views: ChannelView[] = BOT_KINDS.filter((kind) => tokens[kind]).map((kind) => {
    const channel = channels?.find((c) => c.kind === kind) ?? null;
    const expires = channel?.link_code_expires_at ? Date.parse(channel.link_code_expires_at) : now.getTime();
    return {
      kind,
      username: usernames[kind],
      channel,
      state: channel ? channelState(channel, now) : null,
      minutesLeft: Math.max(1, Math.ceil((expires - now.getTime()) / 60_000)),
    };
  });

  return (
    <div className="space-y-4">
      <PageHeader title="تنظیمات" subtitle="ظاهر برنامه، یادآوری‌ها، برنامهٔ خواب و خلاصهٔ روزانه را به سلیقهٔ خودتان تنظیم کنید." />
      <Card>
        <CardHeader title="پس‌زمینه" subtitle="یک رنگ، گرادیان یا تصویر شخصی انتخاب کنید." />
        <BackgroundForm current={background} />
      </Card>

      <Card id="reminders">
        <CardHeader
          title="یادآوری کارها"
          subtitle="چند دقیقه قبل از شروع هر جعبهٔ زمانی، در بله یا تلگرام یادآوری بگیرید."
        />
        {reminders === null ? (
          <p role="alert" className="rounded-xl bg-down-soft px-3 py-2 text-sm text-down">
            تنظیمات یادآوری بارگذاری نشد. صفحه را دوباره باز کنید.
          </p>
        ) : (
          <ReminderSettingsForm current={reminders} hasChat={reminders.hasChat} />
        )}
      </Card>

      <Card id="sleep">
        <CardHeader
          title="برنامهٔ خواب"
          subtitle="ساعت خواب و بیداری هر شب را یک بار تنظیم کنید؛ در برنامهٔ روزانه خودکار چیده می‌شود."
        />
        {sleep === null ? (
          <p role="alert" className="rounded-xl bg-down-soft px-3 py-2 text-sm text-down">
            برنامهٔ خواب بارگذاری نشد. صفحه را دوباره باز کنید.
          </p>
        ) : (
          <SleepScheduleForm plans={sleep.plans} />
        )}
      </Card>

      <Card>
        <CardHeader
          title="ثبت خودکار خواب از گوشی"
          subtitle="وقتی زنگ ساعت گوشی را تنظیم می‌کنید یا می‌خوابید، ساعت خواب و بیداری خودش ثبت شود."
        />
        <SleepPhoneLink
          hasLink={sleep?.hasPhoneLink ?? false}
          available={!!process.env.SUPABASE_SERVICE_ROLE_KEY}
        />
      </Card>

      <Card>
        <CardHeader
          title="خلاصهٔ روزانه در پیام‌رسان"
          subtitle="هر روز در ساعتی که انتخاب می‌کنید، کارها، جعبه‌های زمانی و یادداشت آن روز برایتان فرستاده می‌شود."
        />
        {channels === null ? (
          <p role="alert" className="rounded-xl bg-down-soft px-3 py-2 text-sm text-down">
            تنظیمات پیام‌رسان بارگذاری نشد. صفحه را دوباره باز کنید.
          </p>
        ) : views.length === 0 ? (
          <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">
            ارسال پیام هنوز روی این سرور راه‌اندازی نشده است.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {views.map((view) => (
              <ChannelPanel key={view.kind} view={view} />
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          پیامک فعلاً پشتیبانی نمی‌شود. برای قطع همهٔ ارسال‌ها از داخل پیام‌رسان، به بات
          <span dir="ltr"> /stop </span>
          بفرستید.
        </p>
      </Card>
    </div>
  );
}
