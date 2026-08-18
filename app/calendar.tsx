/**
 * Kalender — deliberately incomplete, and says so.
 *
 * THE FEED CARRIES ONE DAY. `today.sessions` is the only session list in it,
 * and `week` is an aggregate (counts and totals), not per-day data. The
 * engine's `get_sessions_for_date()` takes a single date, and the four-week
 * structure that would fill a calendar lives in `block_draft.json`, which is
 * not exposed to the feed at all.
 *
 * So this screen shows what genuinely exists and names what is missing,
 * rather than drawing an empty grid that looks like a rest week.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { currentFeed as feed } from '../src/athlete';
import { c, t } from '../src/theme';

/**
 * Derived from `source` + `rest_day`, NOT from `source_meaning`. The engine
 * always emits the "no plan exists" wording once the session list is empty,
 * even for a genuine starter rest day — see the note in src/feed.ts.
 */
function planLabel(): string {
  const { source, rest_day, sessions } = feed.today;
  if (source === 'calendar') return 'Von deinem intervals.icu-Kalender';
  if (source === 'draft') return 'Lokaler Entwurf, noch nicht hochgeladen';
  if (source === 'starter' && rest_day) return 'Ruhetag im allgemeinen Startplan';
  if (source === 'starter')
    return 'Allgemeiner Startplan — aus deiner angegebenen Häufigkeit, nicht aus deinen Daten';
  if (sessions.length > 0) return `Quelle: ${source}`;
  return 'Kein Plan für heute hinterlegt';
}

const DISCIPLINE_LABEL: Record<string, string> = {
  swim: 'Schwimmen',
  bike: 'Rad',
  run: 'Laufen',
  strength: 'Kraft',
  other: 'Sonstiges',
};

function mins(secs: number): string {
  return `${Math.round(secs / 60)} min`;
}

export default function Calendar() {
  const { today, week } = feed;
  const byDiscipline = Object.entries(week.by_discipline);

  return (
    <ScrollView style={t.screen} contentContainerStyle={t.content}>
      <Text style={t.section}>Heute · {feed.date}</Text>
      <Text style={t.hint}>{planLabel()}</Text>

      {today.sessions.length === 0 ? (
        <View style={[t.card, { marginTop: 10 }]}>
          <Text style={t.body}>
            {today.rest_day ? 'Ruhetag.' : 'Keine Einheit geplant.'}
          </Text>
        </View>
      ) : (
        today.sessions.map((session, i) => (
          <View key={i} style={[t.card, { marginTop: 10 }]}>
            <Text style={t.cardTitle}>{session.name ?? 'Ohne Namen'}</Text>
            <Text style={t.hint}>
              {session.type ?? 'Sportart unbekannt'} ·{' '}
              {/* null means unknown, never 0 min */}
              {session.duration_min === null
                ? 'Dauer unbekannt'
                : `${session.duration_min} min`}
            </Text>
            {session.objective ? (
              <Text style={t.body}>{session.objective}</Text>
            ) : null}
            {session.fuelling ? (
              <Text style={t.hint}>{session.fuelling}</Text>
            ) : null}
          </View>
        ))
      )}

      <Text style={t.section}>Woche ab {week.week_start}</Text>
      {week.is_first_day ? (
        <Text style={t.hint}>Die Woche fängt heute an.</Text>
      ) : null}

      <View style={t.card}>
        <Text style={t.body}>
          {week.sessions} Einheiten · {mins(week.moving_secs)} · Load{' '}
          {week.load.toFixed(0)}
        </Text>
      </View>

      {byDiscipline.length === 0 ? (
        <Text style={t.hint}>
          Keine Aufteilung nach Sportart — in dieser Woche wurde nichts
          protokolliert.
        </Text>
      ) : (
        byDiscipline.map(([key, secs]) => (
          <View key={key} style={s.row}>
            <Text style={[t.body, { flex: 1 }]}>
              {DISCIPLINE_LABEL[key] ?? key}
            </Text>
            <Text style={t.hint}>{mins(secs ?? 0)}</Text>
          </View>
        ))
      )}

      <Text style={t.section}>Was hier noch fehlt</Text>
      <View style={s.gap}>
        <Text style={t.body}>
          Ein echter Kalender braucht mehrere Tage. Der Feed liefert heute nur
          einen: <Text style={s.code}>today.sessions</Text> für das aktuelle
          Datum, dazu Wochensummen ohne Tagesaufteilung.
        </Text>
        <Text style={t.hint}>
          Die Daten existieren in der Engine — ein Vier-Wochen-Block liegt in{' '}
          <Text style={s.code}>block_draft.json</Text> mit Wochen, Tagen und
          Einheiten. Sie erreichen den Feed nur nicht. Dafür braucht es eine
          Änderung an <Text style={s.code}>src/delivery/feed.py</Text>, und die
          gehört in eine Engine-Sitzung, nicht in die App.
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: c.surface,
  },
  gap: {
    backgroundColor: c.surface,
    borderRadius: 8,
    padding: 12,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: c.general,
  },
  code: { color: c.accentText, fontSize: 13 },
});
