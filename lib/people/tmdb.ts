import type { TmdbCandidate } from "@/lib/types";

// Name verification via TMDB (The Movie Database) — free API covering cast AND
// crew, including stunt performers and coordinators. TMDB results carry IMDb
// ids, so candidates link out to IMDb pages for the storyteller to confirm.
// Degrades to no-candidates when TMDB_API_KEY is unset.

const TMDB_BASE = "https://api.themoviedb.org/3";

export function isTmdbConfigured(): boolean {
  return Boolean(process.env.TMDB_API_KEY);
}

interface TmdbPerson {
  id: number;
  name: string;
  known_for_department: string | null;
  profile_path: string | null;
  known_for?: Array<{ title?: string; name?: string }>;
}

/** Search TMDB for a person; returns up to `limit` candidates with IMDb links. */
export async function searchPerson(
  name: string,
  limit = 3,
): Promise<TmdbCandidate[]> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey || !name.trim()) return [];

  try {
    const searchRes = await fetch(
      `${TMDB_BASE}/search/person?query=${encodeURIComponent(name)}&include_adult=false&page=1&api_key=${apiKey}`,
      { headers: { accept: "application/json" } },
    );
    if (!searchRes.ok) return [];
    const search = (await searchRes.json()) as { results?: TmdbPerson[] };
    const people = (search.results ?? []).slice(0, limit);

    return await Promise.all(
      people.map(async (p) => {
        // external_ids gives the IMDb id (nm…) for a canonical IMDb link.
        let imdbUrl: string | null = null;
        try {
          const extRes = await fetch(
            `${TMDB_BASE}/person/${p.id}/external_ids?api_key=${apiKey}`,
            { headers: { accept: "application/json" } },
          );
          if (extRes.ok) {
            const ext = (await extRes.json()) as { imdb_id?: string | null };
            if (ext.imdb_id) imdbUrl = `https://www.imdb.com/name/${ext.imdb_id}/`;
          }
        } catch {
          // IMDb link is best-effort.
        }

        const knownFor = (p.known_for ?? [])
          .map((k) => k.title ?? k.name)
          .filter(Boolean)
          .slice(0, 3)
          .join(", ");

        return {
          name: p.name,
          known_for: knownFor,
          department: p.known_for_department,
          is_stunts:
            (p.known_for_department ?? "").toLowerCase().includes("stunt") ||
            (p.known_for_department ?? "") === "Crew",
          profile_url: p.profile_path
            ? `https://image.tmdb.org/t/p/w185${p.profile_path}`
            : null,
          imdb_url: imdbUrl,
        };
      }),
    );
  } catch {
    return [];
  }
}
