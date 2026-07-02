import { createClient, getUser } from "@/lib/supabase/server";
import { saveProfile } from "./actions";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { VoiceProfileCard } from "@/components/settings/voice-profile-card";
import type { Profile, VoiceStyleProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getUser();
  const supabase = await createClient();

  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .maybeSingle();
  const profile = (profileRaw as Profile) ?? null;

  const { data: voiceRaw } = await supabase
    .from("voice_style_profiles")
    .select("*")
    .eq("user_id", user!.id)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const voice = (voiceRaw as VoiceStyleProfile) ?? null;

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
          <p className="text-sm text-ink-soft">Signed in as {user!.email}</p>
          <Button type="submit">Save profile</Button>
        </div>
      </form>

      <VoiceProfileCard voice={voice} />
    </div>
  );
}
