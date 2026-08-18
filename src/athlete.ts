/**
 * THE seam between the app and the engine.
 *
 * Everything reads the briefing from here, so when the two halves are joined
 * only this file changes and no screen has to be touched.
 *
 * Today `fetchBriefing` returns a fixture that ships inside the app bundle.
 * That is the honest state: the engine runs on another machine and nothing
 * on this phone can reach it. The function is already shaped like the real
 * thing — async, can fail, returns one day's feed — so the swap is a body
 * change, not a signature change.
 *
 * Regenerate the fixtures in the engine repo with
 *     py tools/demo_data.py
 * then copy reports/athletes/<id>/feed_<date>.json into ./fixtures/ and run
 * `npx tsc --noEmit`. The generators are seeded, so a diff means the ENGINE
 * changed — which is exactly what the checked assignments below will catch.
 */
import type { Feed } from './feed';
import veteranJson from './fixtures/feed_veteran.json';
import beginnerJson from './fixtures/feed_beginner.json';
import sparseJson from './fixtures/feed_sparse.json';

// Checked assignments, not `as Feed` casts: a cast would compile no matter
// how wrong ./feed.ts was, and `npx tsc --noEmit` is our only guard that the
// types still describe what the engine emits.
const veteran: Feed = veteranJson;
const beginner: Feed = beginnerJson;
const sparse: Feed = sparseJson;

/**
 * The synthetic archetypes. `beginner` has ZERO activities and
 * `new_athlete: true` — it is how the first-run flow gets exercised without
 * wiping the store.
 */
export const testAthletes = { veteran, beginner, sparse } as const;
export type TestAthlete = keyof typeof testAthletes;

/** Which fixture stands in for the real athlete until the engine is reachable. */
export const DEFAULT_ATHLETE: TestAthlete = 'veteran';

export type FetchResult =
  | { ok: true; feed: Feed; source: 'fixture' | 'engine' }
  | { ok: false; error: string };

/**
 * Fetch one morning's briefing.
 *
 * WHEN THE ENGINE IS REACHABLE, this becomes an HTTP call for
 * `reports/athletes/<id>/feed_<date>.json` (or whatever the server exposes),
 * and everything downstream — the archive, the coach thread, the dashboard —
 * keeps working unchanged. Three things the real version must do that the
 * stub cannot: check `schema_version` before trusting the shape, keep the
 * last good feed when the network fails, and never invent a value for a
 * field the response omitted.
 */
export async function fetchBriefing(
  which: TestAthlete = DEFAULT_ATHLETE,
): Promise<FetchResult> {
  try {
    const feed = testAthletes[which];
    if (feed.schema_version !== 'feed-v1') {
      return {
        ok: false,
        error: `Unbekannte Schema-Version ${feed.schema_version} — die App kennt feed-v1.`,
      };
    }
    return { ok: true, feed, source: 'fixture' };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Synchronous access for screens that render before the first fetch lands. */
export const currentFeed: Feed = veteran;
