"use client";

import { useEffect } from "react";
import { buttonClass, Card } from "@/components/ui";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto max-w-md text-center">
      <h2 className="text-lg font-bold">بارگذاری این صفحه ممکن نشد</h2>
      <p className="mt-2 text-sm text-muted">
        ممکن است اتصال اینترنت قطع شده باشد. چند لحظه بعد دوباره تلاش کنید.
      </p>
      <button type="button" onClick={() => retry()} className={`${buttonClass.primary} mt-5`}>
        تلاش دوباره
      </button>
    </Card>
  );
}
