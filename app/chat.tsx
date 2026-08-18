/**
 * Coach — the morning briefing you pull in, and what you send back.
 *
 * THE COMPOSER PRODUCES CoachIntents (src/intents.ts), not ad-hoc records.
 * Every control below builds the same validated shape the on-device model
 * will produce later. That is the whole design: the model becomes a second
 * way to fill one contract, never a second path through the app. On a phone
 * without Apple Intelligence, only free-text understanding is missing — not
 * the function.
 *
 * EVERY COACH LINE IS THE ENGINE'S OWN SENTENCE, VERBATIM. Nothing here
 * writes, rewords or summarises coaching text, and no language model is
 * involved today. Charter §4.2: numbers come from the engine, language from
 * the model, and the model may never produce a figure.
 *
 * NOTHING YOU SEND LEAVES THIS DEVICE. Roadmap F1 is NOT BUILT: the engine
 * prints the caveat every morning and has no inbox for the answer. So
 * intents queue in an outbox that says plainly how many are waiting, and no
 * control here is labelled "send".
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { fetchBriefing } from '../src/athlete';
import type { Feed } from '../src/feed';
import {
  INTENT_LABEL,
  REFERRAL_TEXT,
  WEEKDAYS,
  WEEKDAY_LABEL,
  isClinical,
  needsConfirmation,
  summarise,
  validate,
  type IntentKind,
  type Weekday,
} from '../src/intents';
import {
  cancelMorningReminder,
  isReminderScheduled,
  onBriefingTapped,
  requestPermission,
  scheduleMorningReminder,
} from '../src/notify';
import { needsNumbers, parse } from '../src/parse';
import {
  addIntent,
  archiveFeed,
  loadBriefingState,
  loadOutbox,
  pendingCount,
  saveBriefingState,
  type BriefingState,
  type OutboxItem,
} from '../src/storage';
import { c, t } from '../src/theme';

/**
 * 'free' is not an intent kind — it is the free-text lane, where a parser
 * turns one message into possibly SEVERAL intents. The other modes are quick
 * replies that build exactly one. `unclear` only ever comes from parsing.
 */
type Mode = IntentKind | 'free';

const MODES: Mode[] = [
  'free',
  'report_wellbeing',
  'report_session',
  'change_availability',
  'move_workout',
  'report_pain',
  'note',
];

const MODE_LABEL = (m: Mode) => (m === 'free' ? 'Schreiben' : INTENT_LABEL[m]);

const today = () => new Date().toISOString().slice(0, 10);

/** A 1–n scale that can also mean "did not say". Never defaults to a middle. */
function Scale({
  max,
  value,
  onChange,
  low,
  high,
}: {
  max: number;
  value: number | null;
  onChange: (n: number | null) => void;
  low: string;
  high: string;
}) {
  return (
    <View style={{ gap: 5 }}>
      <View style={s.scale}>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <Pressable
            key={n}
            onPress={() => onChange(value === n ? null : n)}
            style={[s.pip, value === n && s.pipOn]}
          >
            <Text style={[s.pipText, value === n && s.pipTextOn]}>{n}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.scaleEnds}>
        <Text style={t.hint}>{low}</Text>
        <Text style={t.hint}>{value === null ? 'keine Angabe' : ''}</Text>
        <Text style={t.hint}>{high}</Text>
      </View>
    </View>
  );
}

export default function Chat() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [state, setState] = useState<BriefingState | null>(null);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);
  const [referral, setReferral] = useState(false);

  const [reminderOn, setReminderOn] = useState(false);
  const [notifyNote, setNotifyNote] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>('free');
  const [text, setText] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [rpe, setRpe] = useState<number | null>(null);
  const [feel, setFeel] = useState<number | null>(null);
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [soreness, setSoreness] = useState<number | null>(null);
  const [stress, setStress] = useState<number | null>(null);
  const [motivation, setMotivation] = useState<number | null>(null);
  const [days, setDays] = useState<Weekday[]>([]);
  const [workout, setWorkout] = useState('');

  const pull = useCallback(async () => {
    setBusy(true);
    const result = await fetchBriefing();
    if (result.ok) {
      setFeed(result.feed);
      await archiveFeed(result.feed);
      const next: BriefingState = {
        fetchedAt: new Date().toISOString(),
        forDate: result.feed.date,
        opened: true,
      };
      setState(next);
      await saveBriefingState(next);
      setError(null);
    } else {
      setError(result.error);
    }
    setBusy(false);
  }, []);

  useEffect(() => {
    loadOutbox().then(setOutbox);
    loadBriefingState().then(setState);
    isReminderScheduled().then(setReminderOn);
    // A tapped notification pulls the briefing — the same path a real
    // server push will take once a development build exists.
    return onBriefingTapped(() => { pull(); });
  }, [pull]);

  async function toggleReminder(on: boolean) {
    if (!on) {
      await cancelMorningReminder();
      setReminderOn(false);
      setNotifyNote(null);
      return;
    }
    const status = await requestPermission();
    setNotifyNote(status.limitation);
    if (!status.granted) return;
    setReminderOn(await scheduleMorningReminder());
  }

  /** Build the raw shape, exactly as the model will hand it over. */
  function draft(): Record<string, unknown> {
    const said = text.trim();
    const base = { source: 'quick_reply' as const, said: said || undefined };
    switch (mode) {
      case 'report_wellbeing':
        return { ...base, kind: mode, date: today(), sleepQuality, soreness, stress, motivation };
      case 'report_session':
        return { ...base, kind: mode, date: today(), session: sessionName.trim(), rpe, feel, note: said };
      case 'change_availability':
        return { ...base, kind: mode, unavailableDays: days, reason: said };
      case 'move_workout':
        return { ...base, kind: mode, workout: workout.trim(), fromDate: null, toDate: null };
      case 'report_pain':
        return { ...base, kind: mode, date: today(), described: said };
      default:
        return { ...base, kind: 'note', text: said };
    }
  }

  /** Free-text lane: one message, possibly several intents. */
  const parsed = mode === 'free' ? parse(text) : null;
  const ready = parsed ? parsed.intents.filter((i) => i.kind !== 'unclear' && !needsNumbers(i)) : [];
  const incomplete = parsed ? parsed.intents.filter((i) => needsNumbers(i)) : [];

  const preview = mode === 'free' ? null : validate(draft());
  const empty =
    mode === 'free'
      ? ready.length === 0
      : mode === 'report_wellbeing'
        ? sleepQuality === null && soreness === null && stress === null && motivation === null && !text.trim()
        : mode === 'report_session'
          ? !sessionName.trim() && rpe === null && feel === null && !text.trim()
          : mode === 'change_availability'
            ? days.length === 0
            : mode === 'move_workout'
              ? !workout.trim()
              : !text.trim();

  function clearForm() {
    setText('');
    setSessionName('');
    setWorkout('');
    setRpe(null);
    setFeel(null);
    setSleepQuality(null);
    setSoreness(null);
    setStress(null);
    setMotivation(null);
    setDays([]);
  }

  async function save() {
    // Free text: store every recognised intent that is already complete.
    if (mode === 'free') {
      let list = outbox;
      let clinical = false;
      for (const intent of ready) {
        // Re-validated even though the parser built it — the contract is the
        // gate, and a parser bug must not get past it.
        const checked = validate(intent as unknown);
        if (!checked.ok) {
          setRejected(checked.error);
          return;
        }
        list = await addIntent(checked.intent);
        if (isClinical(checked.intent.kind)) clinical = true;
      }
      setRejected(null);
      setOutbox(list);
      setReferral(clinical);
      clearForm();
      return;
    }

    const result = validate(draft());
    if (!result.ok) {
      // Anything that does not fit the contract is REFUSED, never coerced.
      setRejected(result.error);
      return;
    }
    setRejected(null);
    setOutbox(await addIntent(result.intent));
    setReferral(isClinical(result.intent.kind));
    clearForm();
  }

  const waiting = pendingCount(outbox);

  return (
    <KeyboardAvoidingView
      style={t.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView contentContainerStyle={t.content}>
        {/* ---- the morning signal ---- */}
        <View style={s.head}>
          <View style={s.headRow}>
            <View style={{ flex: 1 }}>
              <Text style={t.cardTitle}>Morgens erinnern</Text>
              <Text style={t.hint}>Lokale Erinnerung um 06:00 auf diesem Gerät.</Text>
            </View>
            <Switch
              value={reminderOn}
              onValueChange={toggleReminder}
              trackColor={{ false: c.surfaceHi, true: c.accent }}
            />
          </View>
          {notifyNote ? <Text style={t.hint}>{notifyNote}</Text> : null}
          <View style={s.divider} />
          {state?.fetchedAt && state.forDate ? (
            <Text style={t.hint}>
              Briefing für {state.forDate} · abgerufen{' '}
              {new Date(state.fetchedAt).toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          ) : (
            <Text style={t.hint}>Noch kein Briefing abgerufen.</Text>
          )}
          <Pressable onPress={pull} style={s.pull} disabled={busy}>
            {busy ? (
              <ActivityIndicator color={c.text} size="small" />
            ) : (
              <Text style={s.pullText}>{feed ? 'Neu abrufen' : 'Briefing abrufen'}</Text>
            )}
          </Pressable>
          {error ? <Text style={[t.hint, { color: c.warn }]}>{error}</Text> : null}
        </View>

        {/* ---- the briefing ---- */}
        {!feed ? (
          <Text style={[t.hint, { marginTop: 20 }]}>
            Tippe oben auf „Briefing abrufen“, oder warte auf die Morgenerinnerung.
          </Text>
        ) : (
          <>
            {feed.warnings.map((w, i) => (
              <View key={`w${i}`} style={[s.bubble, s.coach, s.coachWarn]}>
                <Text style={s.warnText}>{w.text}</Text>
              </View>
            ))}
            <View style={[s.bubble, s.coach]}>
              <Text style={t.body}>{feed.recovery.summary}</Text>
            </View>
            <View style={[s.bubble, s.coach]}>
              <Text style={t.body}>{feed.sleep.text}</Text>
            </View>
            {feed.yesterday?.read ? (
              <View style={[s.bubble, s.coach]}>
                <Text style={t.body}>{feed.yesterday.read}</Text>
              </View>
            ) : feed.yesterday && !feed.yesterday.synced ? (
              <View style={[s.bubble, s.coach]}>
                <Text style={t.body}>
                  Für {feed.yesterday.date} ist noch nichts synchronisiert — das
                  heißt nicht, dass du pausiert hast.
                </Text>
              </View>
            ) : null}
            {feed.watch.items.map((item) => (
              <View key={item.name} style={[s.bubble, s.coach]}>
                <Text style={t.cardTitle}>{item.label}</Text>
                <Text style={s.meta}>
                  {item.note || item.confidence}
                  {item.degraded ? ' · Teilwert' : ''}
                </Text>
                <Text style={t.body}>{item.text}</Text>
              </View>
            ))}
            {feed.next_unlock ? (
              <View style={[s.bubble, s.coach, s.coachUnlock]}>
                <Text style={s.unlockLabel}>Das bringt am meisten</Text>
                <Text style={t.body}>{feed.next_unlock}</Text>
              </View>
            ) : null}
          </>
        )}

        {/* ---- the clinical exit, shown once after a pain report ---- */}
        {referral ? (
          <View style={[s.bubble, s.coach, s.coachReferral]}>
            <Text style={s.referralLabel}>Wichtig</Text>
            <Text style={t.body}>{REFERRAL_TEXT}</Text>
          </View>
        ) : null}

        {/* ---- what you have said ---- */}
        {outbox.length > 0 ? (
          <>
            <Text style={[t.hint, { marginTop: 22 }]}>
              Deine Antworten · {waiting} wartet{waiting === 1 ? '' : 'en'} auf die Engine
            </Text>
            {outbox.map((item) => (
              <View key={item.id} style={[s.bubble, s.mine]}>
                <Text style={s.mineHead}>{INTENT_LABEL[item.intent.kind]}</Text>
                <Text style={s.mineText}>{summarise(item.intent)}</Text>
                {item.intent.said && item.intent.kind !== 'note' ? (
                  <Text style={s.mineQuote}>„{item.intent.said}“</Text>
                ) : null}
                <Text style={s.pending}>
                  nur auf diesem Gerät
                  {needsConfirmation(item.intent.kind)
                    ? ' · keine Engine, die den Plan ändern könnte'
                    : ''}
                </Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>

      {/* ---- composer: quick replies that build one CoachIntent ---- */}
      <View style={s.composer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={s.modes}>
            {MODES.map((m) => (
              <Pressable
                key={m}
                onPress={() => { setMode(m); setRejected(null); setReferral(false); }}
                style={[s.modeBtn, mode === m && s.modeOn, m === 'report_pain' && mode === m && s.modePain]}
              >
                <Text style={[s.modeText, mode === m && s.modeTextOn]}>{MODE_LABEL(m)}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* ---- free text: one message, possibly several intents ---- */}
        {mode === 'free' ? (
          <View style={s.form}>
            {!text.trim() ? (
              <Text style={t.hint}>
                Schreib einfach, wie es dir geht oder was sich ändern muss. Zum
                Beispiel: „Schlecht geschlafen, und Montag muss ich arbeiten.“
              </Text>
            ) : null}

            {parsed?.intents.map((intent, i) => {
              const needs = needsNumbers(intent);
              const unclear = intent.kind === 'unclear';
              return (
                <Pressable
                  key={i}
                  disabled={!needs}
                  onPress={() => needs && setMode(intent.kind)}
                  style={[s.hit, unclear && s.hitUnclear, needs && s.hitNeeds]}
                >
                  <View style={s.hitHead}>
                    <Text style={s.hitLabel}>{INTENT_LABEL[intent.kind]}</Text>
                    {typeof intent.confidence === 'number' && !unclear ? (
                      <Text style={t.hint}>
                        {intent.confidence >= 0.6 ? 'ziemlich sicher' : 'unsicher'}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={t.body}>
                    {unclear
                      ? 'Nicht eindeutig verstanden. Nimm einen Reiter oben, dann ist es unmissverständlich.'
                      : summarise(intent)}
                  </Text>
                  {needs ? (
                    // A vague word is not a number. Charter §4.1: never
                    // fabricate a measurement — so the athlete taps it.
                    <Text style={s.hitAction}>
                      Zahl fehlt — antippen und einordnen
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}

            {incomplete.length > 0 ? (
              <Text style={t.hint}>
                Aus Wörtern wie „platt“ wird hier bewusst keine Zahl gemacht —
                das wäre eine erfundene Messung.
              </Text>
            ) : null}
          </View>
        ) : null}

        {mode === 'report_wellbeing' ? (
          <View style={s.form}>
            <Text style={t.hint}>Schlafqualität</Text>
            <Scale max={5} value={sleepQuality} onChange={setSleepQuality} low="schlecht" high="gut" />
            <Text style={t.hint}>Muskelkater</Text>
            <Scale max={5} value={soreness} onChange={setSoreness} low="keiner" high="stark" />
            <Text style={t.hint}>Stress</Text>
            <Scale max={5} value={stress} onChange={setStress} low="wenig" high="viel" />
            <Text style={t.hint}>Motivation</Text>
            <Scale max={5} value={motivation} onChange={setMotivation} low="niedrig" high="hoch" />
          </View>
        ) : null}

        {mode === 'report_session' ? (
          <View style={s.form}>
            <TextInput
              style={s.input}
              value={sessionName}
              onChangeText={setSessionName}
              placeholder="Welche Einheit? z. B. Langer Lauf"
              placeholderTextColor={c.dim}
            />
            <Text style={t.hint}>Wie anstrengend war es wirklich?</Text>
            <Scale max={10} value={rpe} onChange={setRpe} low="sehr leicht" high="maximal" />
            <Text style={t.hint}>Wie hat es sich angefühlt?</Text>
            <Scale max={5} value={feel} onChange={setFeel} low="mies" high="stark" />
          </View>
        ) : null}

        {mode === 'change_availability' ? (
          <View style={s.form}>
            <Text style={t.hint}>An welchen Tagen kannst du nicht?</Text>
            <View style={s.dayRow}>
              {WEEKDAYS.map((d) => (
                <Pressable
                  key={d}
                  onPress={() =>
                    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))
                  }
                  style={[s.day, days.includes(d) && s.dayOn]}
                >
                  <Text style={[s.dayText, days.includes(d) && s.dayTextOn]}>
                    {WEEKDAY_LABEL[d]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {mode === 'move_workout' ? (
          <View style={s.form}>
            <TextInput
              style={s.input}
              value={workout}
              onChangeText={setWorkout}
              placeholder="Welche Einheit soll weg? z. B. Intervalle"
              placeholderTextColor={c.dim}
            />
            <Text style={t.hint}>
              Einen Zieltag kannst du noch nicht wählen — dafür bräuchte es eine
              Planungslogik, die Alternativen prüft. Die gibt es noch nicht (F2).
            </Text>
          </View>
        ) : null}

        {mode === 'report_pain' ? (
          <View style={[s.form, s.formPain]}>
            <Text style={t.hint}>
              Beschreib es in deinen Worten. Dieses System bewertet Beschwerden
              nicht und leitet daraus keine Trainingsänderung ab.
            </Text>
          </View>
        ) : null}

        {/* What was understood — the same line a model's output would produce. */}
        {preview && !empty && preview.ok ? (
          <View style={s.preview}>
            <Text style={s.previewLabel}>Verstanden als</Text>
            <Text style={s.previewText}>{summarise(preview.intent)}</Text>
          </View>
        ) : null}
        {rejected ? <Text style={s.rejected}>Abgelehnt: {rejected}</Text> : null}

        <View style={s.notice}>
          <Text style={s.noticeText}>
            Bleibt auf dem Gerät. Die Engine hat dafür noch keinen Empfänger
            (F1) — nichts davon fließt in deine Zahlen ein. Freitext wird
            gespeichert wie getippt; ihn automatisch zu verstehen kommt mit dem
            Modell auf dem Gerät.
          </Text>
        </View>

        <View style={s.inputRow}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            value={text}
            onChangeText={setText}
            placeholder={
              mode === 'free'
                ? 'Wie geht es dir? Was muss sich ändern?'
                : mode === 'report_pain'
                  ? 'Was tut weh, seit wann?'
                  : mode === 'note'
                    ? 'Notiz an dich selbst'
                    : 'Noch etwas dazu?'
            }
            placeholderTextColor={c.dim}
            multiline
          />
          <Pressable onPress={save} style={[s.save, empty && s.saveOff]} disabled={empty}>
            <Text style={[s.saveText, empty && s.saveTextOff]}>
              {mode === 'free' && ready.length > 1 ? `${ready.length}× sichern` : 'Sichern'}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  head: { backgroundColor: c.surface, borderRadius: 10, padding: 14, gap: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { height: 1, backgroundColor: c.line },
  pull: { backgroundColor: c.accent, borderRadius: 8, paddingVertical: 11, alignItems: 'center' },
  pullText: { color: c.text, fontSize: 14, fontWeight: '700' },

  bubble: { borderRadius: 12, padding: 12, marginTop: 10, maxWidth: '92%', gap: 4 },
  coach: { backgroundColor: c.surface, alignSelf: 'flex-start' },
  coachWarn: { backgroundColor: c.warnBg, borderLeftWidth: 3, borderLeftColor: c.warn },
  coachUnlock: { backgroundColor: c.accentDim },
  coachReferral: { backgroundColor: '#3d1f1f', borderLeftWidth: 3, borderLeftColor: '#d95d5d' },
  referralLabel: { color: '#ff9b9b', fontSize: 11, fontWeight: '700' },
  unlockLabel: { color: c.accentText, fontSize: 11, fontWeight: '700' },
  warnText: { color: c.warnText, fontSize: 13, lineHeight: 19 },
  meta: { color: c.dim, fontSize: 11 },

  mine: { backgroundColor: c.accentDim, alignSelf: 'flex-end' },
  mineHead: { color: c.accentText, fontSize: 11, fontWeight: '700' },
  mineText: { color: c.text, fontSize: 14, lineHeight: 20 },
  mineQuote: { color: c.body, fontSize: 12, fontStyle: 'italic' },
  pending: { color: c.dim, fontSize: 10, marginTop: 2 },

  composer: {
    borderTopWidth: 1,
    borderTopColor: c.line,
    backgroundColor: c.bg,
    padding: 10,
    gap: 8,
  },
  modes: { flexDirection: 'row', gap: 6, paddingRight: 10 },
  modeBtn: { paddingVertical: 6, paddingHorizontal: 13, borderRadius: 14, backgroundColor: c.surface },
  modeOn: { backgroundColor: c.accent },
  modePain: { backgroundColor: '#8a3a3a' },
  modeText: { color: c.dim, fontSize: 12 },
  modeTextOn: { color: c.text, fontWeight: '700' },

  form: { gap: 7, backgroundColor: c.surface, borderRadius: 8, padding: 10 },
  formPain: { borderLeftWidth: 3, borderLeftColor: '#d95d5d' },

  scale: { flexDirection: 'row', gap: 4 },
  pip: { flex: 1, paddingVertical: 7, borderRadius: 6, backgroundColor: c.surfaceHi, alignItems: 'center' },
  pipOn: { backgroundColor: c.accent },
  pipText: { color: c.dim, fontSize: 12 },
  pipTextOn: { color: c.text, fontWeight: '700' },
  scaleEnds: { flexDirection: 'row', justifyContent: 'space-between' },

  dayRow: { flexDirection: 'row', gap: 5 },
  day: { flex: 1, paddingVertical: 9, borderRadius: 6, backgroundColor: c.surfaceHi, alignItems: 'center' },
  dayOn: { backgroundColor: c.warn },
  dayText: { color: c.dim, fontSize: 12 },
  dayTextOn: { color: '#1a1208', fontWeight: '700' },

  hit: {
    backgroundColor: c.surfaceHi,
    borderRadius: 6,
    padding: 9,
    gap: 3,
    borderLeftWidth: 3,
    borderLeftColor: c.personal,
  },
  hitNeeds: { borderLeftColor: c.general },
  hitUnclear: { borderLeftColor: c.off },
  hitHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hitLabel: { color: c.text, fontSize: 12, fontWeight: '700' },
  hitAction: { color: c.general, fontSize: 11, fontWeight: '600' },

  preview: {
    backgroundColor: c.accentDim,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  previewLabel: { color: c.accentText, fontSize: 10, fontWeight: '700' },
  previewText: { color: c.text, fontSize: 13 },
  rejected: { color: c.warn, fontSize: 12 },

  notice: { backgroundColor: c.surface, borderRadius: 6, padding: 8 },
  noticeText: { color: c.dim, fontSize: 11, lineHeight: 16 },

  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  input: {
    minHeight: 40,
    maxHeight: 110,
    backgroundColor: c.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: c.text,
    fontSize: 14,
  },
  save: { backgroundColor: c.accent, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 },
  saveOff: { backgroundColor: c.surfaceHi },
  saveText: { color: c.text, fontSize: 13, fontWeight: '600' },
  saveTextOff: { color: c.dim },
});
