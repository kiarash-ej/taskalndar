"use server";

import { getCurrentUser } from "../auth";
import { isIsoDate } from "../dates";
import { GENERIC_ERROR } from "../form-state";
import { createClient } from "../supabase/server";

// Autosave target: one row per user and day. Deliberately doesn't refresh()
// the page, which would re-render under the cursor on every save.
export async function saveDailyNote(date: string, body: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "ابتدا وارد حساب خود شوید." };
  if (!isIsoDate(date)) return { error: GENERIC_ERROR };
  if (body.length > MAX_NOTE_LENGTH) return { error: "یادداشت بیش از حد طولانی است." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("daily_notes")
    .upsert(
      { user_id: user.id, date, body, updated_at: new Date().toISOString() },
      { onConflict: "user_id,date" },
    );
  return error ? { error: GENERIC_ERROR } : {};
}

const MAX_NOTE_LENGTH = 20000;
