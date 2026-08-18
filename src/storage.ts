/**
 * Everything this app keeps on the device.
 *
 * The architecture the co-leads chose (D66) is local-first: one athlete per
 * phone, the history living here rather than in a central database. This
 * module is that store. It is deliberately the ONLY place that touches
 * AsyncStorage, so swapping to SQLite or an encrypted file later is one
 * file's work — and an encrypted backup is exactly what D66 requires.
 *
 * THE OUTBOX holds CoachIntents — everything the athlete says or taps, in
 * one validated shape (see src/intents.ts). Each carries `synced: false` and
 * stays that way. The engine has no inbox for any of it yet (roadmap F1,
 * NOT BUILT), so the app must not pretend it was delivered. When the
 * receiving end exists, this queue is what gets flushed.
 *
 * THE FEED ARCHIVE keeps every briefing that arrives, keyed by date. The
 * engine's feed carries ONE day and no history, so this archive is where a
 * real time series comes from — built up morning by morning, on the device,
 * with no engine change required.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Feed } from './feed';
import type { CoachIntent } from './intents';
import type { Intake } from './intake';

const K = {
  intake: 'intake-v1',
  /** v2: the ad-hoc feedback shapes were replaced by CoachIntent. Anything
   *  written under the v1 key is left where it is rather than migrated —
   *  it only ever held throwaway test entries, and silently reshaping a
   *  record is worse than leaving it. */
  outbox: 'outbox-v2',
  archive: 'feed-archive-v1',
  briefing: 'briefing-state-v1',
} as const;

// --------------------------------------------------------------- outbox

export type OutboxItem = {
  id: string;
  createdAt: string;
  /** false until an engine inbox exists and accepts it. */
  synced: false;
  intent: CoachIntent;
};

// --------------------------------------------------------------- helpers

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // A corrupt or unreadable store must not take the screen down with it.
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Stable enough for one device, and no dependency for it. */
export function newId(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

// ---------------------------------------------------------------- intake

export const loadIntake = () => readJson<Intake | null>(K.intake, null);
export const saveIntake = (intake: Intake) => writeJson(K.intake, intake);
export const clearIntake = () => AsyncStorage.removeItem(K.intake);

// -------------------------------------------------------------- outbound

export const loadOutbox = () => readJson<OutboxItem[]>(K.outbox, []);

export async function addIntent(intent: CoachIntent): Promise<OutboxItem[]> {
  const existing = await loadOutbox();
  const next: OutboxItem[] = [
    ...existing,
    { id: newId(), createdAt: new Date().toISOString(), synced: false, intent },
  ];
  await writeJson(K.outbox, next);
  return next;
}

export async function removeItem(id: string): Promise<OutboxItem[]> {
  const next = (await loadOutbox()).filter((e) => e.id !== id);
  await writeJson(K.outbox, next);
  return next;
}

/** How much is waiting for an engine that cannot receive it yet. */
export const pendingCount = (items: OutboxItem[]) =>
  items.filter((e) => !e.synced).length;

// --------------------------------------------------------- feed archive

export type Archive = Record<string, Feed>;

export const loadArchive = () => readJson<Archive>(K.archive, {});

/** Keep every briefing. This is the local time series. */
export async function archiveFeed(feed: Feed): Promise<Archive> {
  const archive = await loadArchive();
  const next = { ...archive, [feed.date]: feed };
  await writeJson(K.archive, next);
  return next;
}

/** Oldest first — the shape a chart wants. */
export function archiveSeries(archive: Archive): Feed[] {
  return Object.keys(archive).sort().map((d) => archive[d]);
}

// -------------------------------------------------------- briefing state

export type BriefingState = {
  /** ISO timestamp of the last successful fetch, or null. */
  fetchedAt: string | null;
  /** The date of the briefing currently held. */
  forDate: string | null;
  /** Whether the athlete has opened today's briefing. */
  opened: boolean;
};

export const loadBriefingState = () =>
  readJson<BriefingState>(K.briefing, { fetchedAt: null, forDate: null, opened: false });

export const saveBriefingState = (state: BriefingState) => writeJson(K.briefing, state);
