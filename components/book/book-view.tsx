import Image from "next/image";
import { ChapterMarkdown } from "@/components/chapter-markdown";
import type { AssembledBook } from "@/lib/book";

// Renders an assembled book as book-style pages. Shared by the in-app preview,
// the public share view, and the print page that Puppeteer turns into a PDF.
export function BookView({ book, forPrint = false }: { book: AssembledBook; forPrint?: boolean }) {
  const { settings, chapters } = book;

  return (
    <div className={forPrint ? "book-print" : "mx-auto max-w-2xl bg-white p-10 shadow-sm"}>
      {/* Title page */}
      <section className={forPrint ? "book-page title-page" : "mb-16 text-center"}>
        <h1 className="font-serif text-4xl font-bold text-ink">
          {settings?.title ?? "My Stunt Stories"}
        </h1>
        {settings?.subtitle && (
          <p className="mt-3 font-serif text-xl italic text-ink-soft">{settings.subtitle}</p>
        )}
        {settings?.author_name && (
          <p className="mt-8 font-serif text-lg text-ink">{settings.author_name}</p>
        )}
      </section>

      {settings?.dedication && (
        <section className={forPrint ? "book-page" : "mb-16 text-center"}>
          <p className="font-serif text-lg italic text-ink-soft">{settings.dedication}</p>
        </section>
      )}

      {settings?.foreword && (
        <section className={forPrint ? "book-page" : "mb-16"}>
          <h2 className="mb-4 font-serif text-2xl font-bold">Foreword</h2>
          <div className="prose-book">
            {settings.foreword.split("\n\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>
      )}

      {chapters.length === 0 && !forPrint && (
        <p className="text-center text-ink-soft">
          No chapters yet. Generate a chapter for a story and mark it{" "}
          <em>in book</em> to see it here.
        </p>
      )}

      {chapters.map(({ story, chapter, text, photos, links }, idx) => (
        <section key={story.id} className={forPrint ? "book-page chapter" : "mb-16"}>
          <p className="mb-1 text-sm uppercase tracking-widest text-ink-soft">
            Chapter {story.chapter_number ?? idx + 1}
          </p>
          <h2 className="mb-6 font-serif text-3xl font-bold text-ink">
            {chapter?.title || story.title}
          </h2>

          <ChapterMarkdown text={text} />

          {photos.length > 0 && (
            <div className="mt-6 space-y-4">
              {photos.map((p, i) =>
                p.url ? (
                  <figure key={i} className="text-center">
                    <Image
                      src={p.url}
                      alt={p.caption ?? "Photo"}
                      width={640}
                      height={480}
                      className="mx-auto max-h-96 w-auto rounded"
                      unoptimized
                    />
                    {p.caption && (
                      <figcaption className="mt-1 text-sm italic text-ink-soft">
                        {p.caption}
                      </figcaption>
                    )}
                  </figure>
                ) : null,
              )}
            </div>
          )}

          {links.length > 0 && (
            <div className="mt-8 border-t border-black/10 pt-4">
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-ink-soft">
                Scan to watch / read
              </p>
              <div className="flex flex-wrap gap-6">
                {links.map((l, i) => (
                  <figure key={i} className="text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.qr} alt={l.label ?? l.url} width={96} height={96} className="mx-auto" />
                    <figcaption className="mt-1 max-w-[8rem] text-xs text-ink-soft">
                      {l.label ?? l.url}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
