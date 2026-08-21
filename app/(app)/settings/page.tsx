import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDb, tables } from "@/lib/db";
import { getActiveVoiceProfile } from "@/lib/generation";
import { saveProfile, saveReminderPrefs } from "./actions";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { VoiceProfileCard } from "@/components/settings/voice-profile-card";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const db = getDb();

  const [profileRaw] = await db
    .select()
    .from(tables.profiles)
    .where(eq(tables.profiles.id, user.id))
    .limit(1);
  const profile = (profileRaw as Profile | undefined) ?? null;

  const voice = await getActiveVoiceProfile(db, user.id);

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="font-serif text-3xl font-bold text-ink">Settings</h1>

      <form action={saveProfile} className="rounded-xl border border-black/10 bg-white p-5">
        <h2 className="mb-4 font-serif text-lg text-ink">Profile</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="display_name">Display name</Label>
            <Input id="display_name" name="display_name" defaultValue={profile?.display_name ?? ""} />
          </div>
          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" name="bio" rows={3} defaultValue={profile?.bio ?? ""} />
          </div>
          <p className="text-sm text-ink-soft">
            Signed in as {user.email ?? user.phone}
          </p>
          <Button type="submit">Save profile</Button>
        </div>
      </form>

      <form action={saveReminderPrefs} className="rounded-xl border border-black/10 bg-white p-5">
        <h2 className="mb-1 font-serif text-lg text-ink">Weekly reminders</h2>
        <p className="mb-4 text-sm text-ink-soft">
          Once a week we&apos;ll send you a story prompt and a sign-in link, so
          adding a story takes one tap.
        </p>
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="reminder_opt_in"
              defaultChecked={profile?.reminder_opt_in ?? false}
            />
            Remind me weekly to add a story
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="phone">Phone number (for texts)</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+1 555 555 5555"
                defaultValue={profile?.phone ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="reminder_channel">Send reminders by</Label>
              <select
                id="reminder_channel"
                name="reminder_channel"
                defaultValue={profile?.reminder_channel ?? "sms"}
                className="h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm"
              >
                <option value="sms">Text message</option>
                <option value="email">Email</option>
              </select>
            </div>
          </div>
          <Button type="submit">Save reminder settings</Button>
        </div>
      </form>

      <VoiceProfileCard voice={voice} />
    </div>
  );
}
