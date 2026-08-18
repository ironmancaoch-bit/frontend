/**
 * Dashboard — every field the engine can deliver, rendered.
 *
 * Several blocks below will look empty against today's fixtures: no recovery
 * flag fires, sleep never synced, the discipline split is empty. They are
 * built anyway and on purpose — the point is that when the two halves are
 * joined, nothing the engine sends falls on the floor. Each empty block says
 * which input is missing rather than disappearing, so an absent section can
 * never be mistaken for a healthy one.
 *
 * Product promises that are load-bearing here, marked PROMISE:
 *   1. null means UNKNOWN — never 0, and styled so it cannot be misread.
 *   2. warnings outrank everything; an ALARM outranks the warnings.
 *   3. a "general" figure is visibly labelled as a general estimate.
 */
import { useCallback, useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { fetchBriefing } from '../src/athlete';
import { CompareBar, FormBand, LoadBars, Ring, Sparkline, TierBar } from '../src/charts';
import type { Feed, RecoveryFlag } from '../src/feed';
import { DISCIPLINE_LABEL } from '../src/intake';
import { useSession } from '../src/session';
import {
  archiveFeed,
  archiveSeries,
  clearIntake,
  loadArchive,
  type Archive,
} from '../src/storage';
import { c, t } from '../src/theme';

/** PROMISE 1 */
function num(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined ? 'unbekannt' : value.toFixed(digits);
}

function hours(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** How old the numbers are. Silent while fresh, loud once it matters. */
function staleness(generatedAtUtc: string): { text: string; stale: boolean } | null {
  const then = Date.parse(generatedAtUtc);
  if (Number.isNaN(then)) return null;
  const h = Math.floor((Date.now() - then) / 3_600_000);
  if (h < 26) return null;
  const d = Math.floor(h / 24);
  return {
    text:
      d >= 2
        ? `Diese Zahlen sind ${d} Tage alt — seitdem hat nichts sie erneuert.`
        : `Diese Zahlen sind ${h} Stunden alt.`,
    stale: true,
  };
}

function flagWording(f: RecoveryFlag): string {
  if (f.metric === 'hrv') {
    return f.sd_below != null
      ? `HRV liegt ${f.sd_below.toFixed(1)} Standardabweichungen unter deinem Normalbereich.`
      : 'HRV liegt unter deinem Normalbereich.';
  }
  if (f.metric === 'rhr') {
    return f.above_usual_bpm != null
      ? `Ruhepuls ${f.above_usual_bpm.toFixed(0)} bpm über deinem Üblichen.`
      : 'Ruhepuls über deinem Üblichen.';
  }
  if (f.metric === 'load') {
    return f.ratio != null
      ? `Belastungssprung — Verhältnis ${f.ratio.toFixed(2)} zur eigenen Basis.`
      : 'Belastungssprung gegenüber deiner Basis.';
  }
  return `Auffälligkeit bei ${String(f.metric)}.`;
}

function Stat({ label, value }: { label: string; value: string }) {
  const unknown = value === 'unbekannt';
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, unknown && s.statUnknown]}>{value}</Text>
    </View>
  );
}

function Section({ title, hint }: { title: string; hint?: string }) {
  return (
    <>
      <Text style={t.section}>{title}</Text>
      {hint ? <Text style={[t.hint, { marginTop: -6, marginBottom: 8 }]}>{hint}</Text> : null}
    </>
  );
}

export default function Dashboard() {
  // Setup state comes from above the tabs, never from this screen's own
  // mount effect — a background tab would keep a stale copy and bounce the
  // athlete back into the onboarding they just finished.
  const { intake, ready, refresh } = useSession();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [archive, setArchive] = useState<Archive>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showWarnings, setShowWarnings] = useState(false);
  const [showFigures, setShowFigures] = useState(false);

  const load = useCallback(async () => {
    const result = await fetchBriefing();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setFeed(result.feed);
    // Keeping every arriving feed is what builds a local time series — the
    // engine's own feed has no history in it.
    setArchive(await archiveFeed(result.feed));
  }, []);

  useEffect(() => {
    loadArchive().then(setArchive);
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Never route on the setup state before the first read has finished —
  // "not loaded yet" and "no intake" are different answers.
  if (!ready) {
    return (
      <View style={[t.screen, s.center]}>
        <ActivityIndicator color={c.accentText} />
      </View>
    );
  }
  if (intake === null) return <Redirect href="/onboarding" />;

  if (!feed) {
    return (
      <View style={[t.screen, s.center]}>
        {error ? (
          <Text style={[t.body, { textAlign: 'center' }]}>{error}</Text>
        ) : (
          <ActivityIndicator color={c.accentText} />
        )}
      </View>
    );
  }

  const { headline, week, watch, figures, recovery, sleep, yesterday } = feed;
  const stale = staleness(feed.generated_at_utc);
  const tiers = {
    personal: figures.filter((f) => f.tier === 'personal').length,
    general: figures.filter((f) => f.tier === 'general').length,
    unavailable: figures.filter((f) => f.tier === 'unavailable').length,
  };
  const history = archiveSeries(archive).map((f) => ({
    date: f.date,
    value: f.headline.ctl,
  }));
  const byDiscipline = Object.entries(week.by_discipline);

  return (
    <ScrollView
      style={t.screen}
      contentContainerStyle={t.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.dim} />
      }
    >
      {/* PROMISE 2 (strongest form): an ALARM sits above everything. */}
      {recovery.flags.length > 0 ? (
        <View style={s.alarmBox}>
          <Text style={s.alarmTitle}>
            {recovery.flags.some((f) => f.severity === 'alarm')
              ? 'Achtung heute'
              : 'Auffällig heute'}
          </Text>
          {recovery.flags.map((f, i) => (
            <View key={i} style={s.alarmRow}>
              <Text style={[s.sev, f.severity === 'alarm' && s.sevHigh]}>
                {f.severity === 'alarm' ? 'ALARM' : 'FLAG'}
              </Text>
              <Text style={[t.body, { flex: 1 }]}>{flagWording(f)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {feed.new_athlete ? (
        <View style={s.setupBox}>
          <Text style={s.setupTitle}>Noch keine Trainingsdaten</Text>
          <Text style={t.body}>
            Es liegt noch nichts vor, aus dem sich Fitness, Ermüdung oder Form
            berechnen lassen. Die Zahlen unten bleiben deshalb bei null — das
            ist der richtige Wert für jemanden, der noch nicht trainiert hat,
            keine Lücke.
          </Text>
          <Text style={t.hint}>
            Sobald die erste Einheit in intervals.icu ankommt, füllt sich das
            hier von selbst. Für eine belastbare Fitnesszahl braucht es
            ungefähr sechs Wochen.
          </Text>
        </View>
      ) : null}

      {stale ? (
        <View style={s.staleBox}>
          <Text style={s.staleText}>{stale.text}</Text>
        </View>
      ) : null}

      {feed.warnings.length > 0 ? (
        <Pressable onPress={() => setShowWarnings((v) => !v)} style={s.warnBox}>
          <View style={s.warnHead}>
            <Text style={s.warnTitle}>
              {feed.warnings.length} Hinweis{feed.warnings.length === 1 ? '' : 'e'} zur
              Datenlage
            </Text>
            <Text style={s.chevron}>{showWarnings ? '▲' : '▼'}</Text>
          </View>
          {showWarnings ? (
            feed.warnings.map((w, i) => (
              <Text key={i} style={s.warnText}>
                {w.text}
              </Text>
            ))
          ) : (
            <Text style={s.warnPeek} numberOfLines={2}>
              {feed.warnings[0].text}
            </Text>
          )}
        </Pressable>
      ) : null}

      {/* ---- hero ---- */}
      <View style={s.hero}>
        <View style={s.heroTop}>
          <View>
            <Text style={s.heroLabel}>Form</Text>
            <Text style={[s.heroValue, headline.form === null && s.statUnknown]}>
              {num(headline.form)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.caption}>Stand {headline.as_of_date ?? '—'}</Text>
            <Text style={s.caption}>heute läuft noch</Text>
          </View>
        </View>
        <FormBand form={headline.form} />
        <View style={s.divider} />
        <LoadBars ctl={headline.ctl} atl={headline.atl} />
        {headline.reason ? <Text style={s.caption}>{headline.reason}</Text> : null}
      </View>

      {/* ---- the only trend there is: what this device has collected ---- */}
      <View style={[t.card, { marginTop: 10 }]}>
        <Sparkline points={history} label="Fitness, lokal aufgezeichnet" />
        <Text style={s.caption}>
          Der Feed der Engine enthält einen Tag ohne Verlauf. Diese Kurve
          entsteht aus den Briefings, die dieses Gerät gesammelt hat.
        </Text>
      </View>

      <View style={s.statRow}>
        <Stat
          label="Lauf-Alter"
          value={
            headline.run_training_age_weeks === null
              ? 'unbekannt'
              : `${headline.run_training_age_weeks.toFixed(0)} Wo`
          }
        />
        <Stat label="Lauf-ACWR" value={num(headline.run_acwr, 2)} />
        <Stat label="Woche" value={`${week.sessions} Einh.`} />
      </View>

      {/* ---- yesterday ---- */}
      <Section title="Gestern" />
      {yesterday === null ? (
        <Text style={t.hint}>Kein Tag davor — das hier ist dein erster.</Text>
      ) : (
        <View style={t.card}>
          {!yesterday.synced ? (
            // "not synced" is NEVER "you rested" — the schema is explicit.
            <Text style={t.body}>
              Für {yesterday.date} ist noch nichts synchronisiert. Das heißt
              nicht, dass du pausiert hast.
            </Text>
          ) : (
            <>
              {yesterday.read ? <Text style={t.body}>{yesterday.read}</Text> : null}
              <View style={s.ydRow}>
                <Text style={s.caption}>Load {num(yesterday.load, 0)}</Text>
                <Text style={s.caption}>
                  Form{' '}
                  {yesterday.form_change === null
                    ? '—'
                    : `${yesterday.form_change > 0 ? '+' : ''}${yesterday.form_change.toFixed(1)}`}
                </Text>
                <Text style={s.caption}>{yesterday.sessions.length} Einheiten</Text>
              </View>
              {yesterday.sessions.map((sess, i) => (
                <Text key={i} style={s.caption}>
                  {sess.type}
                  {sess.duration_min === null ? ' · Dauer unbekannt' : ` · ${sess.duration_min} min`}
                </Text>
              ))}
            </>
          )}
        </View>
      )}

      {/* ---- week ---- */}
      <Section title={`Woche ab ${week.week_start}`} />
      <View style={[t.card, s.weekCard]}>
        <Ring
          value={week.trained_last_7}
          max={week.expected_per_week || null}
          center={String(week.trained_last_7)}
          caption={
            week.expected_per_week
              ? `von ~${week.expected_per_week.toFixed(1)} üblich`
              : 'übliche Frequenz unbekannt'
          }
        />
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={t.body}>{hours(week.moving_secs)} Bewegungszeit</Text>
          <Text style={t.body}>Load {week.load.toFixed(0)}</Text>
          {week.gap_streak > 0 ? (
            <Text style={s.caption}>{week.gap_streak} Tage Pause am Stück</Text>
          ) : null}
          {week.behind_schedule ? (
            <Text style={[s.caption, { color: c.warn }]}>hinter dem eigenen Rhythmus</Text>
          ) : null}
        </View>
      </View>

      {byDiscipline.length > 0 ? (
        <View style={t.card}>
          {byDiscipline.map(([key, secs]) => (
            <View key={key} style={s.discRow}>
              <Text style={[t.body, { flex: 1 }]}>
                {DISCIPLINE_LABEL[key as keyof typeof DISCIPLINE_LABEL] ?? key}
              </Text>
              <Text style={s.caption}>{hours(secs ?? 0)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={t.hint}>
          Keine Aufteilung nach Sportart — in dieser Woche wurde nichts protokolliert.
        </Text>
      )}

      {/* ---- sleep ---- */}
      <Section title="Schlaf" />
      <View style={t.card}>
        <Text style={t.body}>{sleep.text}</Text>
        <View style={{ marginTop: 8 }}>
          <CompareBar
            value={sleep.secs}
            baseline={sleep.baseline_secs}
            format={(n) => hours(n)}
            valueLabel="letzte Nacht"
            baselineLabel="dein Schnitt:"
            missing="Keine Aufzeichnung von letzter Nacht — die Uhr hat nichts übertragen."
          />
        </View>
        {sleep.score !== null ? (
          <Text style={s.caption}>
            Score der Uhr: {sleep.score} · nur der Trend innerhalb eines Geräts
            bedeutet etwas
          </Text>
        ) : null}
        {sleep.baseline_secs !== null ? (
          <Text style={s.caption}>Schnitt aus {sleep.nights_in_baseline} Nächten</Text>
        ) : null}
      </View>

      {/* ---- recovery, calm tier ---- */}
      <Section title="Erholung" />
      <View style={t.card}>
        <Text style={t.body}>{recovery.summary}</Text>
        {recovery.worth_a_look.map((w, i) => (
          <Text key={i} style={s.caption}>
            {String(w.metric).toUpperCase()}: heute {num(w.today, 0)} · üblich{' '}
            {num(w.usual, 0)}
          </Text>
        ))}
      </View>

      {/* ---- the day's two flags ---- */}
      <Section
        title="Heute im Blick"
        hint={
          watch.held_back > 0
            ? `${watch.held_back} weitere Messwerte wurden berechnet und aus dem Tagesbudget zurückgehalten.`
            : undefined
        }
      />
      {watch.items.length === 0 ? (
        <Text style={t.hint}>Nichts über der Meldeschwelle.</Text>
      ) : null}
      {watch.items.map((item) => (
        <View key={item.name} style={t.card}>
          <View style={s.cardHead}>
            <Text style={[t.cardTitle, { flex: 1 }]}>{item.label}</Text>
            {item.degraded ? <Text style={s.badge}>Teilwert</Text> : null}
          </View>
          <Text style={s.caption}>{item.note || item.confidence}</Text>
          <Text style={t.body}>{item.text}</Text>
        </View>
      ))}

      {/* ---- capability ladder ---- */}
      <Section title="Was das System über dich weiß" />
      <View style={t.card}>
        <TierBar {...tiers} />
        <Pressable onPress={() => setShowFigures((v) => !v)} style={s.toggle}>
          <Text style={s.toggleText}>
            {showFigures ? 'Details ausblenden' : `Alle ${figures.length} anzeigen`}
          </Text>
        </Pressable>
      </View>
      {showFigures
        ? figures.map((f) => (
            <View key={f.key} style={s.figure}>
              <View
                style={[
                  s.tierDot,
                  {
                    backgroundColor:
                      f.tier === 'personal'
                        ? c.personal
                        : f.tier === 'general'
                          ? c.general
                          : c.off,
                  },
                ]}
              />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={t.body}>{f.label}</Text>
                {/* PROMISE 3 */}
                {f.tier === 'general' ? (
                  <Text style={[s.caption, { color: c.general }]}>
                    allgemeine Schätzung, nicht deine Messung
                  </Text>
                ) : null}
                {f.tier === 'unavailable' && f.why_no_general_fallback ? (
                  <Text style={s.caption}>{f.why_no_general_fallback}</Text>
                ) : null}
                {f.degraded && f.degraded_reason ? (
                  <Text style={[s.caption, { color: c.warn }]}>{f.degraded_reason}</Text>
                ) : null}
                {/* The most actionable line in the whole feed. */}
                {f.unlocked_by && !f.unlocked_by.startsWith('nothing') ? (
                  <Text style={[s.caption, { color: c.accentText }]}>
                    Schaltet frei: {f.unlocked_by}
                  </Text>
                ) : null}
                {f.evidence ? (
                  <Text style={s.evidence}>belegt durch {f.evidence}</Text>
                ) : null}
              </View>
            </View>
          ))
        : null}

      {feed.next_unlock ? (
        <View style={s.unlock}>
          <Text style={s.unlockLabel}>Das bringt am meisten</Text>
          <Text style={t.body}>{feed.next_unlock}</Text>
        </View>
      ) : null}

      <Text style={s.footer}>
        {feed.athlete_id} · {feed.date} · {feed.schema_version} · config{' '}
        {feed.config_version}
        {'\n'}erzeugt {feed.generated_at_utc}
      </Text>

      {/* Development aid: without it the first-run flow can only be seen once
          per install. Remove before anyone outside the team gets the app. */}
      <Pressable
        onPress={async () => {
          await clearIntake();
          await refresh();
        }}
        style={s.reset}
      >
        <Text style={s.resetText}>Einrichtung zurücksetzen (nur zum Testen)</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  caption: { color: c.dim, fontSize: 11, lineHeight: 16 },
  evidence: { color: c.dim, fontSize: 10, fontStyle: 'italic' },

  alarmBox: {
    backgroundColor: '#3d1f1f',
    borderLeftWidth: 3,
    borderLeftColor: '#d95d5d',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
    gap: 8,
  },
  alarmTitle: { color: '#ff9b9b', fontSize: 13, fontWeight: '700' },
  alarmRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  sev: {
    color: c.warn,
    fontSize: 9,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: c.warn,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginTop: 2,
  },
  sevHigh: { color: '#ff9b9b', borderColor: '#d95d5d' },

  setupBox: {
    backgroundColor: c.accentDim,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    gap: 7,
  },
  setupTitle: { color: c.accentText, fontSize: 13, fontWeight: '700' },

  staleBox: {
    backgroundColor: c.surfaceHi,
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  staleText: { color: c.warn, fontSize: 12, fontWeight: '600' },

  warnBox: {
    backgroundColor: c.warnBg,
    borderLeftWidth: 3,
    borderLeftColor: c.warn,
    padding: 12,
    borderRadius: 6,
    marginBottom: 14,
    gap: 6,
  },
  warnHead: { flexDirection: 'row', alignItems: 'center' },
  warnTitle: { color: c.warn, fontSize: 12, fontWeight: '700', flex: 1 },
  chevron: { color: c.warn, fontSize: 10 },
  warnPeek: { color: c.warnText, fontSize: 12, lineHeight: 17, opacity: 0.8 },
  warnText: { color: c.warnText, fontSize: 13, lineHeight: 19 },

  hero: { backgroundColor: c.surface, borderRadius: 10, padding: 16, gap: 14 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLabel: { color: c.dim, fontSize: 12 },
  heroValue: { color: c.text, fontSize: 40, fontWeight: '700', lineHeight: 46 },
  divider: { height: 1, backgroundColor: c.line },

  statRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  stat: { flex: 1, backgroundColor: c.surface, borderRadius: 8, padding: 10 },
  statLabel: { color: c.dim, fontSize: 10, marginBottom: 4 },
  statValue: { color: c.text, fontSize: 17, fontWeight: '700' },
  statUnknown: { color: c.dim, fontSize: 13, fontStyle: 'italic', fontWeight: '400' },

  ydRow: { flexDirection: 'row', gap: 14, marginTop: 6 },
  weekCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 14 },
  discRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },

  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    color: c.warn,
    fontSize: 10,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: c.warn,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },

  toggle: { paddingTop: 10 },
  toggleText: { color: c.accentText, fontSize: 12, fontWeight: '600' },

  figure: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: c.surface,
  },
  tierDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },

  unlock: {
    marginTop: 24,
    padding: 14,
    borderRadius: 8,
    backgroundColor: c.accentDim,
    gap: 6,
  },
  unlockLabel: { color: c.accentText, fontSize: 12, fontWeight: '700' },

  footer: { color: '#5a6570', fontSize: 11, marginTop: 28, lineHeight: 17 },
  reset: {
    marginTop: 18,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: c.line,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  resetText: { color: c.dim, fontSize: 11 },
});
