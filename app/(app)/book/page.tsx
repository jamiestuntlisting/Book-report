import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDb, tables } from "@/lib/db";
import { assembleBook } from "@/lib/book";
import { saveBookSettings } from "./actions";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { BookView } from "@/components/book/book-view";
import { BookActions } from "@/components/book/book-actions";
import type { BookSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  const user = await requireUser();
  const db = getDb();

  const [settingsRaw] = await db
    .select()
    .from(tables.book_settings)
    .where(eq(tables.book_settings.user_id, user.id))
    .limit(1);
  const settings = (settingsRaw as BookSettings | undefined) ?? null;

  const book = await assembleBook(db, user.id);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold text-ink">Your book</h1>
        <BookActions chapterCount={book.chapters.length} />
      </div>

      <details className="rounded-xl border border-black/10 bg-white p-5">
        <summary className="cursor-pointer font-serif text-lg text-ink">
          Book details & front matter
        </summary>
        <form action={saveBookSettings} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={settings?.title ?? "My Stunt Stories"} />
          </div>
          <div>
            <Label htmlFor="subtitle">Subtitle</Label>
            <Input id="subtitle" name="subtitle" defaultValue={settings?.subtitle ?? ""} />
          </div>
          <div>
            <Label htmlFor="author_name">Author name</Label>
            <Input id="author_name" name="author_name" defaultValue={settings?.author_name ?? ""} />
          </div>
          <div>
            <Label htmlFor="trim_size">Trim size</Label>
            <select
              id="trim_size"
              name="trim_size"
              defaultValue={settings?.trim_size ?? "6x9"}
              className="h-10 w-full rounded-lg border border-black/15 bg-white px-3 text-sm"
            >
              <option value="6x9">6&quot; × 9&quot; (KDP standard)</option>
              <option value="5x8">5&quot; × 8&quot;</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="dedication">Dedication</Label>
            <Textarea id="dedication" name="dedication" rows={2} defaultValue={settings?.dedication ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="foreword">Foreword</Label>
            <Textarea id="foreword" name="foreword" rows={4} defaultValue={settings?.foreword ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Save book details</Button>
          </div>
        </form>
      </details>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Preview
        </h2>
        <BookView book={book} />
      </div>
    </div>
  );
}
