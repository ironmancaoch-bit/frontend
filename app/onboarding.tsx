/**
 * First run — the day-one intake, exactly as the engine defines it.
 *
 * Mirrors `tools/new_athlete.py`. Two rules from that tool govern every
 * screen below and are the reason this is not a generic signup form:
 *
 *  1. NO MEASUREMENT IS ASKED FOR. All thirteen thresholds start UNKNOWN and
 *     step 5 only explains which test unlocks what. A field with a plausible
 *     pre-filled number would produce a value that looks measured, which the
 *     engine's own comment calls the failure it exists to prevent.
 *
 *  2. EVERY OPTIONAL ANSWER HAS AN EXPLICIT "weiß ich nicht". It writes null,
 *     which becomes UNKNOWN. Silence and a default must never look the same.
 *
 * The result is stored on the device and handed over as `toConfigPayload()`
 * when the two halves are joined. Nothing here writes a threshold, and
 * nothing here handles a credential.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
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

import {
  DISCIPLINES,
  DISCIPLINE_LABEL,
  EXPERIENCE,
  EXPERIENCE_LABEL,
  HOMEWORK,
  SEASON_LABEL,
  SEASON_PHASE,
  defaultIntake,
  type Discipline,
  type Experience,
  type Intake,
  type SeasonPhase,
} from '../src/intake';
import { useSession } from '../src/session';
import { saveIntake } from '../src/storage';
import { c, t } from '../src/theme';

const TOTAL = 6;
const today = () => new Date().toISOString().slice(0, 10);

// ------------------------------------------------------------- controls

function Choice<T extends string>({
  options,
  value,
  onChange,
  labels,
  unknownLabel = 'weiß ich nicht',
}: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T | null) => void;
  labels: Record<T, string>;
  unknownLabel?: string;
}) {
  return (
    <View style={s.chips}>
      {options.map((o) => (
        <Pressable
          key={o}
          onPress={() => onChange(o)}
          style={[s.chip, value === o && s.chipOn]}
        >
          <Text style={[s.chipText, value === o && s.chipTextOn]}>{labels[o]}</Text>
        </Pressable>
      ))}
      {/* Rule 2: never a silent default. */}
      <Pressable
        onPress={() => onChange(null)}
        style={[s.chip, s.chipUnknown, value === null && s.chipUnknownOn]}
      >
        <Text style={[s.chipText, value === null && s.chipTextOn]}>{unknownLabel}</Text>
      </Pressable>
    </View>
  );
}

function Stepper({
  value,
  onChange,
  min = 0,
  max = 7,
  suffix = '',
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <View style={s.stepper}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        style={s.stepBtn}
        disabled={value <= min}
      >
        <Text style={[s.stepSign, value <= min && s.stepOff]}>−</Text>
      </Pressable>
      <Text style={s.stepValue}>
        {value}
        {suffix}
      </Text>
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        style={s.stepBtn}
        disabled={value >= max}
      >
        <Text style={[s.stepSign, value >= max && s.stepOff]}>+</Text>
      </Pressable>
    </View>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {hint ? <Text style={t.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

// --------------------------------------------------------------- screen

export default function Onboarding() {
  const router = useRouter();
  const { refresh } = useSession();
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [intake, setIntake] = useState<Intake>(() => defaultIntake(today()));
  const [ageText, setAgeText] = useState('');
  const [hoursLow, setHoursLow] = useState('');
  const [hoursHigh, setHoursHigh] = useState('');

  const set = <K extends keyof Intake>(key: K, value: Intake[K]) =>
    setIntake((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    const n = Number.parseInt(ageText, 10);
    set('age', ageText.trim() === '' || Number.isNaN(n) ? null : n);
  }, [ageText]);

  useEffect(() => {
    const lo = Number.parseFloat(hoursLow.replace(',', '.'));
    const hi = Number.parseFloat(hoursHigh.replace(',', '.'));
    setIntake((prev) => ({
      ...prev,
      hoursPerWeekLow: Number.isNaN(lo) ? null : lo,
      hoursPerWeekHigh: Number.isNaN(hi) ? null : hi,
    }));
  }, [hoursLow, hoursHigh]);

  async function finish() {
    if (saving) return;
    setSaving(true);
    const now = new Date().toISOString();
    const complete: Intake = {
      ...intake,
      completedAt: now,
      consentAt: intake.consentGiven ? now : null,
    };
    await saveIntake(complete);
    // Refresh BEFORE navigating: the dashboard reads the shared state on its
    // first frame, so it must already be true by the time we get there.
    await refresh();
    router.replace('/');
  }

  const untracked = DISCIPLINES.filter((d) => !intake.tracking[d]);

  return (
    <KeyboardAvoidingView
      style={t.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.progress}>
        {Array.from({ length: TOTAL }, (_, i) => (
          <View key={i} style={[s.pip, i <= step && s.pipOn]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={t.content}>
        {step === 0 ? (
          <>
            <Text style={s.h}>Bevor wir anfangen</Text>
            <Text style={t.body}>
              Dieses System schätzt nichts. Wo keine echte Messung vorliegt,
              steht <Text style={s.em}>unbekannt</Text> — und daneben, welche
              Messung fehlt.
            </Text>
            <Text style={[t.body, { marginTop: 12 }]}>
              Deshalb fragt diese Erfassung nach keinem einzigen Schwellenwert.
              Keine FTP, keine Schwellenherzfrequenz, keine Zonen. Die kommen
              aus Tests, nicht aus einem Formular.
            </Text>
            <View style={s.note}>
              <Text style={t.hint}>
                Jede Frage hier darf mit „weiß ich nicht“ beantwortet werden.
                Das ist eine gültige Antwort und wird als solche gespeichert —
                nicht als Null und nicht als Mittelwert.
              </Text>
            </View>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={s.h}>Über dich</Text>

            <Field
              label="Zeitzone"
              hint="Legt fest, wann für dich ein Tag beginnt und endet."
            >
              <TextInput
                style={s.input}
                value={intake.timezone}
                onChangeText={(v) => set('timezone', v)}
                autoCapitalize="none"
                placeholder="Europe/Berlin"
                placeholderTextColor={c.dim}
              />
            </Field>

            <Field
              label="Ab wann sind deine Aufzeichnungen verlässlich?"
              hint="Der Anker. Alles davor bleibt erhalten, fließt aber nicht in Fitness und Ermüdung ein — lückenhafte Frühdaten würden sie verfälschen."
            >
              <TextInput
                style={s.input}
                value={intake.anchorDate}
                onChangeText={(v) => set('anchorDate', v)}
                autoCapitalize="none"
                placeholder="JJJJ-MM-TT"
                placeholderTextColor={c.dim}
              />
            </Field>

            <Field
              label="Alter"
              hint="Wird nur für die allgemeine Zonenschätzung gebraucht. Ohne Angabe wird keine Schätzung angeboten."
            >
              <TextInput
                style={s.input}
                value={ageText}
                onChangeText={setAgeText}
                keyboardType="number-pad"
                placeholder="leer lassen = unbekannt"
                placeholderTextColor={c.dim}
              />
            </Field>

            <Field label="Ausdauererfahrung">
              <Choice
                options={EXPERIENCE}
                value={intake.experience}
                onChange={(v) => set('experience', v as Experience | null)}
                labels={EXPERIENCE_LABEL}
              />
            </Field>

            <Field
              label="Stärkste Sportart"
              hint="Sie ist von der Regel ausgenommen, dass die schwächste Disziplin am häufigsten trainiert werden sollte."
            >
              <Choice
                options={DISCIPLINES}
                value={intake.primaryDiscipline}
                onChange={(v) => set('primaryDiscipline', v as Discipline | null)}
                labels={DISCIPLINE_LABEL}
              />
            </Field>

            <Field
              label="Saisonphase"
              hint="Ohne Angabe wird deine Intensitätsverteilung gegen alle drei Ziele gezeigt statt gegen eines."
            >
              <Choice
                options={SEASON_PHASE}
                value={intake.seasonPhase}
                onChange={(v) => set('seasonPhase', v as SeasonPhase | null)}
                labels={SEASON_LABEL}
              />
            </Field>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={s.h}>Dein Training</Text>
            <Text style={t.hint}>
              Pro Sportart: wie oft du sie planst, und ob sie überhaupt in
              intervals.icu landet.
            </Text>

            {DISCIPLINES.map((d) => (
              <View key={d} style={s.discCard}>
                <Text style={s.discName}>{DISCIPLINE_LABEL[d]}</Text>

                <View style={s.discRow}>
                  <Text style={t.body}>Tage pro Woche</Text>
                  <Stepper
                    value={intake.expectedDays[d]}
                    onChange={(n) =>
                      set('expectedDays', { ...intake.expectedDays, [d]: n })
                    }
                  />
                </View>

                <View style={s.discRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={t.body}>Wird aufgezeichnet</Text>
                    <Text style={t.hint}>
                      Aus, wenn du es trainierst, es aber nicht in intervals.icu
                      erscheint.
                    </Text>
                  </View>
                  <Switch
                    value={intake.tracking[d]}
                    onValueChange={(v) =>
                      set('tracking', { ...intake.tracking, [d]: v })
                    }
                    trackColor={{ false: c.surfaceHi, true: c.accent }}
                  />
                </View>

                <View style={s.discRow}>
                  <Text style={t.body}>Trainiert seit</Text>
                  <TextInput
                    style={[s.input, { flex: 0, width: 130 }]}
                    value={intake.trainingStart[d]}
                    onChangeText={(v) =>
                      set('trainingStart', { ...intake.trainingStart, [d]: v })
                    }
                    autoCapitalize="none"
                    placeholder="JJJJ-MM-TT"
                    placeholderTextColor={c.dim}
                  />
                </View>
              </View>
            ))}

            {untracked.length > 0 ? (
              <View style={s.noteWarn}>
                <Text style={s.noteTitle}>Wichtig für deine Zahlen</Text>
                <Text style={t.hint}>
                  {untracked.map((d) => DISCIPLINE_LABEL[d]).join(', ')} wird
                  trainiert, aber nicht aufgezeichnet. Deine Fitness- und
                  Ermüdungswerte sind damit eine <Text style={s.em}>Untergrenze</Text>,
                  kein vollständiges Bild — und wenig Aktivität in diesen
                  Sportarten bedeutet fehlende Daten, nicht Formverlust. Das
                  System weiß das und schreibt es dazu.
                </Text>
              </View>
            ) : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={s.h}>Wie viel Zeit hast du?</Text>

            <Field
              label="Stunden pro Woche"
              hint="Diese Zeile liest der Planer, wenn er einen Trainingsblock baut. Ohne sie kann er nicht planen."
            >
              <View style={s.hoursRow}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={hoursLow}
                  onChangeText={setHoursLow}
                  keyboardType="decimal-pad"
                  placeholder="von"
                  placeholderTextColor={c.dim}
                />
                <Text style={t.body}>bis</Text>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={hoursHigh}
                  onChangeText={setHoursHigh}
                  keyboardType="decimal-pad"
                  placeholder="bis"
                  placeholderTextColor={c.dim}
                />
              </View>
            </Field>

            <Field
              label="Ruhetage pro Woche, mindestens"
              hint="Konservativ angesetzt. Senke das nur bewusst."
            >
              <Stepper
                value={intake.minRestDays}
                onChange={(n) => set('minRestDays', n)}
                max={5}
              />
            </Field>

            <Field
              label="Nachsicht bei verpassten Einheiten"
              hint="So viele Tage darf dein Rhythmus abweichen, bevor es angemerkt wird."
            >
              <Stepper
                value={intake.toleranceDays}
                onChange={(n) => set('toleranceDays', n)}
                max={7}
                suffix=" Tage"
              />
            </Field>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <Text style={s.h}>Was noch fehlt</Text>
            <Text style={t.body}>
              Dreizehn Messwerte stehen auf unbekannt, und das bleibt so, bis
              du sie misst. Das ist kein Mangel der Einrichtung — es ist der
              Unterschied zwischen einer Messung und einer Annahme.
            </Text>
            <Text style={[t.hint, { marginTop: 10 }]}>
              In dieser Reihenfolge lohnt es sich. Die ersten beiden zusammen
              schalten mehr frei als alles andere zusammen.
            </Text>

            {HOMEWORK.map((h, i) => (
              <View key={h.key} style={s.hwCard}>
                <View style={s.hwHead}>
                  <Text style={s.hwNum}>{i + 1}</Text>
                  <Text style={[t.cardTitle, { flex: 1 }]}>{h.what}</Text>
                  <Text style={t.hint}>{h.effort}</Text>
                </View>
                <Text style={t.hint}>Schaltet frei: {h.unlocks}</Text>
              </View>
            ))}

            <View style={s.note}>
              <Text style={t.hint}>
                Hier wird bewusst kein Eingabefeld angeboten. Ein getippter
                Schwellenwert sieht später aus wie ein gemessener, und dann ist
                nicht mehr unterscheidbar, worauf sich eine Empfehlung stützt.
              </Text>
            </View>
          </>
        ) : null}

        {step === 5 ? (
          <>
            <Text style={s.h}>Einwilligung</Text>
            <Text style={t.body}>
              Deine Trainings- und Gesundheitsdaten werden verarbeitet, um dir
              die tägliche Einschätzung zu erstellen. Ohne deine Einwilligung
              darf das nicht passieren.
            </Text>

            <Pressable
              onPress={() => set('consentGiven', !intake.consentGiven)}
              style={[s.consent, intake.consentGiven && s.consentOn]}
            >
              <View style={[s.box, intake.consentGiven && s.boxOn]}>
                {intake.consentGiven ? <Text style={s.tick}>✓</Text> : null}
              </View>
              <Text style={[t.body, { flex: 1 }]}>
                Ich willige in die Verarbeitung meiner Trainings- und
                Gesundheitsdaten für diesen Zweck ein.
              </Text>
            </Pressable>

            <View style={s.noteWarn}>
              <Text style={s.noteTitle}>Ehrlich gesagt</Text>
              <Text style={t.hint}>
                Diese Einwilligung wird auf dem Gerät gespeichert. Die Engine
                führt zwar ein Feld dafür, fragt es aber nirgends ab — der
                tägliche Lauf verarbeitet jeden auf der Liste. Bis das behoben
                ist, ist die Einwilligung eine Willenserklärung, keine Sperre.
              </Text>
            </View>

            <View style={s.note}>
              <Text style={s.noteTitle}>Verbindung zu intervals.icu</Text>
              <Text style={t.hint}>
                Wird hier nicht abgefragt. Dein API-Schlüssel gehört in die
                Konfiguration auf dem Rechner, auf dem die Engine läuft — diese
                App fasst keine Zugangsdaten an.
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={s.navWrap}>
        {/* A disabled button that does not say why is indistinguishable from
            a broken one — which is exactly how it was first reported. */}
        {step === TOTAL - 1 && !intake.consentGiven ? (
          <Text style={s.blocked}>
            Setze oben das Häkchen, dann geht es weiter.
          </Text>
        ) : null}
        <View style={s.nav}>
          {step > 0 ? (
            <Pressable onPress={() => setStep(step - 1)} style={s.back}>
              <Text style={s.backText}>Zurück</Text>
            </Pressable>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {step < TOTAL - 1 ? (
            <Pressable onPress={() => setStep(step + 1)} style={s.next}>
              <Text style={s.nextText}>Weiter</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={finish}
              style={[s.next, (!intake.consentGiven || saving) && s.nextOff]}
              disabled={!intake.consentGiven || saving}
            >
              <Text style={[s.nextText, !intake.consentGiven && s.nextTextOff]}>
                {saving ? 'Speichert …' : 'Fertig'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 4, padding: 12, paddingBottom: 4 },
  pip: { flex: 1, height: 3, borderRadius: 2, backgroundColor: c.surfaceHi },
  pipOn: { backgroundColor: c.accent },

  h: { color: c.text, fontSize: 24, fontWeight: '700', marginBottom: 12 },
  em: { color: c.text, fontWeight: '600' },

  field: { marginTop: 20, gap: 6 },
  fieldLabel: { color: c.text, fontSize: 14, fontWeight: '600' },
  input: {
    backgroundColor: c.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: c.text,
    fontSize: 15,
    marginTop: 2,
  },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 16,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  chipOn: { backgroundColor: c.accent, borderColor: c.accent },
  chipUnknown: { borderStyle: 'dashed' },
  chipUnknownOn: { backgroundColor: c.surfaceHi, borderColor: c.dim, borderStyle: 'solid' },
  chipText: { color: c.body, fontSize: 13 },
  chipTextOn: { color: c.text, fontWeight: '600' },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: c.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSign: { color: c.text, fontSize: 19, lineHeight: 22 },
  stepOff: { color: c.dim, opacity: 0.4 },
  stepValue: {
    color: c.text,
    fontSize: 15,
    fontWeight: '600',
    minWidth: 58,
    textAlign: 'center',
  },

  discCard: {
    backgroundColor: c.surface,
    borderRadius: 8,
    padding: 14,
    marginTop: 12,
    gap: 12,
  },
  discName: { color: c.text, fontSize: 15, fontWeight: '700' },
  discRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },

  hwCard: { backgroundColor: c.surface, borderRadius: 8, padding: 12, marginTop: 10, gap: 6 },
  hwHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hwNum: {
    color: c.accentText,
    fontSize: 12,
    fontWeight: '700',
    width: 20,
    textAlign: 'center',
  },

  note: {
    backgroundColor: c.surface,
    borderRadius: 8,
    padding: 12,
    marginTop: 18,
    borderLeftWidth: 3,
    borderLeftColor: c.accent,
    gap: 5,
  },
  noteWarn: {
    backgroundColor: c.warnBg,
    borderRadius: 8,
    padding: 12,
    marginTop: 18,
    borderLeftWidth: 3,
    borderLeftColor: c.warn,
    gap: 5,
  },
  noteTitle: { color: c.text, fontSize: 12, fontWeight: '700' },

  consent: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: c.surface,
    borderRadius: 8,
    padding: 14,
    marginTop: 18,
    borderWidth: 1,
    borderColor: c.line,
  },
  consentOn: { borderColor: c.personal },
  box: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: c.dim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: c.personal, borderColor: c.personal },
  tick: { color: '#fff', fontSize: 13, fontWeight: '700' },

  navWrap: { borderTopWidth: 1, borderTopColor: c.line },
  blocked: {
    color: c.warn,
    fontSize: 12,
    textAlign: 'center',
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  nav: { flexDirection: 'row', gap: 10, padding: 12 },
  back: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8, backgroundColor: c.surface },
  backText: { color: c.body, fontSize: 14, fontWeight: '600' },
  next: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: c.accent,
    alignItems: 'center',
  },
  nextOff: { backgroundColor: c.surfaceHi },
  nextText: { color: c.text, fontSize: 14, fontWeight: '700' },
  nextTextOff: { color: c.dim },
});
