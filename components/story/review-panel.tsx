"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  HelpCircle,
  AlertTriangle,
  Wrench,
  HeartHandshake,
  BookUser,
  Users,
  X,
  Check,
  ExternalLink,
} from "lucide-react";
import { Button, Badge, Input } from "@/components/ui";
import {
  setFindingStatus,
  applyTextFix,
  applyNameReplacement,
} from "@/app/(app)/stories/[storyId]/actions";
import { formatDate } from "@/lib/utils";
import type {
  NameFinding,
  ReviewFindings,
  StoryReview,
} from "@/lib/types";

export function ReviewPanel({
  storyId,
  review,
  hasChapter,
}: {
  storyId: string;
  review: StoryReview | null;
  hasChapter: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function runReview() {
    setRunning(true);
    setError("");
    try {
      const res = await fetch("/api/stories/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "review failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "review failed");
    } finally {
      setRunning(false);
    }
  }

  const findings = review?.findings;
  const openCount = findings
    ? (Object.values(findings) as Array<Array<{ status: string }>>).reduce(
        (n, list) => n + list.filter((f) => f.status === "open").length,
        0,
      )
    : 0;

  return (
    <div className="rounded-xl border border-black/10 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-serif text-lg text-ink">
            <ClipboardCheck size={18} /> Story check
          </h3>
          <p className="text-sm text-ink-soft">
            An editor&apos;s pass: missing story points, unclear bits, garbled
            stunt terms, tone, perspective, and the people you name.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={runReview}
          disabled={running || !hasChapter}
        >
          {running ? "Reviewing…" : review ? "Re-run review" : "Review story"}
        </Button>
      </div>

      {!hasChapter && (
        <p className="mt-3 text-sm text-ink-soft">
          Generate your chapter first, then run a review.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {review && findings && (
        <div className="mt-4 space-y-5">
          <p className="text-xs text-ink-soft">
            Reviewed {formatDate(review.created_at)} ·{" "}
            {openCount === 0 ? "nothing open — looking good" : `${openCount} open`}
          </p>

          <Section
            icon={<HelpCircle size={16} />}
            title="Missing story points"
            items={findings.missing_details}
            render={(f) => (
              <>
                <p className="font-medium text-ink">{f.question}</p>
                <p className="text-sm text-ink-soft">{f.why}</p>
                <p className="mt-1 text-xs text-ink-soft">
                  Record another memo above, then use <em>Merge in new memos</em>.
                </p>
              </>
            )}
            storyId={storyId}
            category="missing_details"
          />

          <Section
            icon={<AlertTriangle size={16} />}
            title="Needs clarification"
            items={findings.unclear}
            render={(f) => (
              <>
                <Quote text={f.quote} />
                <p className="text-sm text-ink-soft">{f.issue}</p>
                <p className="mt-1 text-sm text-ink">
                  <span className="font-medium">Try:</span> {f.suggestion}
                </p>
              </>
            )}
            storyId={storyId}
            category="unclear"
          />

          <Section
            icon={<Wrench size={16} />}
            title="Stunt-term fixes"
            items={findings.jargon}
            render={(f) => (
              <p className="text-ink">
                &ldquo;{f.found}&rdquo; →{" "}
                <span className="font-medium">&ldquo;{f.suggested}&rdquo;</span>{" "}
                <Badge tone={f.confidence === "high" ? "green" : "amber"}>
                  {f.confidence}
                </Badge>
              </p>
            )}
            storyId={storyId}
            category="jargon"
            apply={(f) => ({ find: f.found, replace: f.suggested })}
          />

          <Section
            icon={<HeartHandshake size={16} />}
            title="Tone check"
            items={findings.tone}
            render={(f) => (
              <>
                <Quote text={f.quote} />
                <p className="text-sm text-ink-soft">{f.why}</p>
                <p className="mt-1 text-sm text-ink">
                  <span className="font-medium">Softer:</span> {f.rewrite}
                </p>
              </>
            )}
            storyId={storyId}
            category="tone"
            apply={(f) => ({ find: f.quote, replace: f.rewrite })}
          />

          <Section
            icon={<BookUser size={16} />}
            title="Journal voice"
            items={findings.perspective}
            render={(f) => (
              <>
                <Quote text={f.quote} />
                <p className="mt-1 text-sm text-ink">
                  <span className="font-medium">First-person:</span> {f.fix}
                </p>
              </>
            )}
            storyId={storyId}
            category="perspective"
            apply={(f) => ({ find: f.quote, replace: f.fix })}
          />

          <NamesSection storyId={storyId} items={findings.names} />
        </div>
      )}
    </div>
  );
}

function Quote({ text }: { text: string }) {
  return (
    <p className="border-l-2 border-black/20 pl-2 font-serif italic text-ink">
      “{text}”
    </p>
  );
}

// Generic finding section with dismiss + optional one-click "Apply fix".
function Section<
  T extends { id: string; status: string },
>({
  icon,
  title,
  items,
  render,
  storyId,
  category,
  apply,
}: {
  icon: React.ReactNode;
  title: string;
  items: T[];
  render: (f: T) => React.ReactNode;
  storyId: string;
  category: keyof ReviewFindings;
  apply?: (f: T) => { find: string; replace: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const open = items.filter((f) => f.status === "open");
  if (items.length === 0) return null;

  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-widest text-ink-soft">
        {icon} {title}
        {open.length > 0 && <Badge tone="amber">{open.length}</Badge>}
      </h4>
      <ul className="space-y-2">
        {items.map((f) => (
          <li
            key={f.id}
            className={`rounded-lg border border-black/[0.08] p-3 ${
              f.status !== "open" ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">{render(f)}</div>
              <div className="flex shrink-0 items-center gap-1">
                {f.status === "open" && apply && (
                  <button
                    disabled={pending}
                    onClick={() => {
                      const { find, replace } = apply(f);
                      startTransition(async () => {
                        const res = await applyTextFix(storyId, category, f.id, find, replace);
                        if (res.error) {
                          setErrors((e) => ({ ...e, [f.id]: res.error! }));
                        } else {
                          router.refresh();
                        }
                      });
                    }}
                    className="flex items-center gap-1 rounded-md bg-accent/10 px-2 py-1 text-xs font-medium text-accent hover:bg-accent/20"
                  >
                    <Check size={12} /> Apply fix
                  </button>
                )}
                {f.status === "open" ? (
                  <button
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await setFindingStatus(storyId, category, f.id, "dismissed");
                        router.refresh();
                      })
                    }
                    className="rounded-md p-1 text-black/30 hover:text-black/60"
                    aria-label="Dismiss"
                  >
                    <X size={14} />
                  </button>
                ) : (
                  <Badge tone={f.status === "applied" ? "green" : "gray"}>{f.status}</Badge>
                )}
              </div>
            </div>
            {errors[f.id] && (
              <p className="mt-2 text-xs text-red-600">{errors[f.id]}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// People section: TMDB candidates + correct / change / redact actions.
function NamesSection({ storyId, items }: { storyId: string; items: NameFinding[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [custom, setCustom] = useState<Record<string, string>>({});
  if (items.length === 0) return null;
  const open = items.filter((f) => f.status === "open");

  function replaceName(f: NameFinding, newName: string) {
    if (!newName.trim() || newName === f.name) return;
    startTransition(async () => {
      await applyNameReplacement(storyId, f.id, f.name, newName.trim());
      router.refresh();
    });
  }

  function redact(f: NameFinding) {
    const initials = f.name
      .split(/\s+/)
      .map((p) => (p[0] ? `${p[0].toUpperCase()}.` : ""))
      .join("");
    replaceName(f, initials || "[redacted]");
  }

  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-widest text-ink-soft">
        <Users size={16} /> People named
        {open.length > 0 && <Badge tone="blue">{open.length}</Badge>}
      </h4>
      <ul className="space-y-2">
        {items.map((f) => (
          <li
            key={f.id}
            className={`rounded-lg border border-black/[0.08] p-3 ${
              f.status !== "open" ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-ink">
                {f.name}{" "}
                <span className="font-normal text-ink-soft">— {f.context}</span>
              </p>
              {f.status !== "open" && (
                <Badge tone={f.status === "applied" ? "green" : "gray"}>{f.status}</Badge>
              )}
            </div>

            {f.candidates.length > 0 && (
              <div className="mt-2 space-y-1">
                {f.candidates.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className={c.name === f.name ? "text-green-700" : "text-ink"}>
                      {c.name === f.name ? "✓ Spelling matches" : c.name}
                    </span>
                    {c.known_for && (
                      <span className="truncate text-ink-soft">({c.known_for})</span>
                    )}
                    {c.is_stunts && <Badge tone="blue">stunts</Badge>}
                    {c.imdb_url && (
                      <a
                        href={c.imdb_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:underline"
                        aria-label={`IMDb page for ${c.name}`}
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                    {f.status === "open" && c.name !== f.name && (
                      <button
                        disabled={pending}
                        onClick={() => replaceName(f, c.name)}
                        className="rounded bg-accent/10 px-1.5 py-0.5 text-xs font-medium text-accent hover:bg-accent/20"
                      >
                        Use this spelling
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {f.status === "open" && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Change name to…"
                  value={custom[f.id] ?? ""}
                  onChange={(e) => setCustom((c) => ({ ...c, [f.id]: e.target.value }))}
                  className="h-8 max-w-[12rem] text-xs"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending || !(custom[f.id] ?? "").trim()}
                  onClick={() => replaceName(f, custom[f.id] ?? "")}
                >
                  Change
                </Button>
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => redact(f)}>
                  Redact to initials
                </Button>
                <button
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await setFindingStatus(storyId, "names", f.id, "dismissed");
                      router.refresh();
                    })
                  }
                  className="text-xs text-ink-soft hover:text-black"
                >
                  Keep as is
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
