/**
 * CoachIntent — was der Athlet will, als geschlossener Vertrag.
 *
 * DIE GRUNDIDEE. Ein Sprachmodell versteht Sprache. Es entscheidet nichts.
 * Alles, was ein Athlet sagt oder antippt, wird zu einem Intent aus dieser
 * Liste — und was die App daraufhin tut, entscheidet deterministischer Code.
 * Charter §4.2: "Numbers come from the engine. Language comes from the model.
 * The model may never produce a figure."
 *
 * WARUM DER VERTRAG ZUERST KOMMT. Die Quick Replies in der App erzeugen
 * exakt dieselben Intents wie später das Modell. Das ist kein Zufall,
 * sondern der ganze Zweck: das Modell wird dadurch austauschbar und
 * abschaltbar, und auf Geräten ohne Apple Intelligence fehlt nur der
 * Freitext, nicht die Funktion.
 *
 * DIE GRENZE. `validate()` unten verwirft alles, was nicht exakt in diese
 * Liste passt. Ein unbekannter Intent wird NIE ausgeführt — er wird
 * abgelehnt. Dieselbe Disziplin wie beim Feed-Vertrag.
 *
 * ────────────────────────────────────────────────────────────────────────
 * VORLAGE FÜR DIE SWIFT-SEITE (Mac-Tag, Foundation Models framework)
 *
 * Aus diesem Typ wird die @Generable-Struktur wörtlich abgeleitet. Durch
 * "constrained decoding" kann das Modell dann strukturell nichts Ungültiges
 * erzeugen — es KANN keinen Intent erfinden, der nicht im enum steht:
 *
 *   import FoundationModels
 *
 *   @Generable
 *   enum IntentKind {
 *     case reportWellbeing, reportSession, changeAvailability
 *     case moveWorkout, reportPain, note, unclear
 *   }
 *
 *   @Generable
 *   struct CoachIntent {
 *     @Guide(description: "Was der Athlet will. 'unclear', wenn nicht eindeutig.")
 *     let kind: IntentKind
 *
 *     @Guide(description: "Wochentage, an denen der Athlet NICHT kann.")
 *     let unavailableDays: [String]
 *
 *     @Guide(description: "Anstrengung 1-10 — NUR wenn der Athlet eine Zahl NENNT. Sonst weglassen.",
 *            .range(1...10))
 *     let rpe: Int?
 *   }
 *
 * Die Zahlenregel gehört in den @Guide-Text, nicht in einen Kommentar:
 * das Modell darf eine genannte Zahl HERAUSZIEHEN, nie eine ableiten.
 * ────────────────────────────────────────────────────────────────────────
 */

// ------------------------------------------------------------------ kinds

export const INTENT_KINDS = [
  /** Wie es mir heute geht. Schlaf, Muskelkater, Stress, Motivation. */
  'report_wellbeing',
  /** Wie sich eine Einheit angefühlt hat. Roadmap F1. */
  'report_session',
  /** An diesen Tagen kann ich nicht. */
  'change_availability',
  /** Bitte verschieb diese Einheit. */
  'move_workout',
  /** Mir tut etwas weh. Führt NIE in die Trainingslogik — siehe unten. */
  'report_pain',
  /** Freitext ohne Struktur. */
  'note',
  /** Nicht eindeutig. Ein vollwertiges Ergebnis, keine Fehlerbehandlung. */
  'unclear',
] as const;

export type IntentKind = (typeof INTENT_KINDS)[number];

export const INTENT_LABEL: Record<IntentKind, string> = {
  report_wellbeing: 'Befinden',
  report_session: 'Einheit',
  change_availability: 'Verfügbarkeit',
  move_workout: 'Verschieben',
  report_pain: 'Beschwerden',
  note: 'Notiz',
  unclear: 'Unklar',
};

export const WEEKDAYS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  monday: 'Mo', tuesday: 'Di', wednesday: 'Mi', thursday: 'Do',
  friday: 'Fr', saturday: 'Sa', sunday: 'So',
};

// --------------------------------------------------------------- payloads

type Base = {
  /** Woher der Intent kam. Wichtig fürs Vertrauen: getippt ist nicht gedeutet. */
  source: 'quick_reply' | 'model' | 'free_text';
  /** Nur bei `source: 'model'` gesetzt. 0..1, null wenn unbekannt. */
  confidence?: number | null;
  /**
   * Der Originaltext. **WÖRTLICH heißt: die vollständige Nachricht des
   * Athleten, unverändert, ohne Kürzung.**
   *
   * Die Festlegung war nötig: In fünf unabhängigen Modelldurchläufen kamen
   * für „Freitag habe ich eine Klausur" drei verschiedene Ausschnitte heraus
   * ("habe eine Klausur" / "habe ich eine Klausur" / "eine Klausur"). Ohne
   * eine feste Regel ist kein Feldvergleich und kein Golden-Test stabil.
   */
  said?: string;
};

/**
 * `date` bedeutet überall dasselbe: **der Tag, auf den sich die Aussage
 * bezieht** — nicht der Tag der Eingabe.
 *
 * Nennt der Athlet keinen Tag, ist es `null`. **Niemals das heutige Datum
 * einsetzen.** Regel 1 verbietet erfundene Zahlen; ein stillschweigend
 * gesetztes Datum ist derselbe Fehler in anderer Form, und drei von fünf
 * Durchläufen sind darüber auseinandergelaufen.
 *
 * Ausnahme mit Grund: `report_wellbeing` aus den Quick Replies fragt
 * ausdrücklich „wie geht es dir HEUTE" — dort ist das Datum durch die
 * Fragestellung gesetzt, nicht geraten.
 */

/**
 * Jede Skala ist 1–5 oder null. NULL HEISST "nicht gesagt" und wird nie
 * durch einen Mittelwert ersetzt — dieselbe Regel wie UNKNOWN in der Engine.
 */
export type WellbeingIntent = Base & {
  kind: 'report_wellbeing';
  date: string;
  sleepQuality: number | null;
  soreness: number | null;
  stress: number | null;
  motivation: number | null;
};

/** `icu_rpe` und `feel` sind die Feldnamen der Engine, heute 0 von 63 gefüllt. */
export type SessionIntent = Base & {
  kind: 'report_session';
  /** null, wenn kein Tag genannt wurde. Nie stillschweigend heute. */
  date: string | null;
  session: string;
  /** 1–10. Nur wenn der Athlet eine Zahl NENNT. */
  rpe: number | null;
  /** 1–5. */
  feel: number | null;
  note: string;
};

export type AvailabilityIntent = Base & {
  kind: 'change_availability';
  /** Tage, an denen NICHT trainiert werden kann. */
  unavailableDays: Weekday[];
  /** Optionaler Grund, wörtlich. Die App bewertet ihn nicht. */
  reason: string;
};

export type MoveWorkoutIntent = Base & {
  kind: 'move_workout';
  /** Welche Einheit, in den Worten des Athleten. */
  workout: string;
  fromDate: string | null;
  /** Wunschtag, oder null für "such du etwas". */
  toDate: string | null;
};

/**
 * Beschwerden. Charter §2: dieses System stellt keine Diagnose und behandelt
 * nichts. Unterversorgung, RED-S, Eisenstatus und gestörtes Essverhalten
 * werden gemeldet und an eine Ärztin verwiesen, nie beraten.
 *
 * Deshalb hat dieser Intent absichtlich KEINE Felder, aus denen die
 * Trainingslogik etwas ableiten könnte — keine Schweregrad-Zahl, keine
 * Körperregion als Aufzählung. Er trägt, was gesagt wurde, und führt zum
 * Verweistext.
 */
export type PainIntent = Base & {
  kind: 'report_pain';
  /** Der Tag der Meldung. */
  date: string;
  /**
   * Seit wann, falls genannt — sonst null. Eigenes Feld, weil drei von fünf
   * Durchläufen bei „seit gestern" den Meldetag und zwei den Beginn in
   * `date` geschrieben haben. Zwei Bedeutungen in einem Feld sind ein Bug.
   */
  onsetDate: string | null;
  /** Die vollständige Nachricht, wörtlich. Nie interpretiert, nie gekürzt. */
  described: string;
};

/**
 * NUR für Text OHNE Trainingsbezug — Begrüßung, Small Talk, eine Notiz an
 * sich selbst. Alles mit Trainingsbezug, das kein anderer kind abbildet,
 * gehört nach `unclear`, damit die App nachfragen kann statt es abzulegen.
 */
export type NoteIntent = Base & { kind: 'note'; text: string };

/**
 * Kein Fehler. Das ehrliche Ergebnis, wenn nichts Eindeutiges erkennbar war
 * — oder wenn die Absicht klar ist, das Schema sie aber nicht abbilden kann.
 *
 * Zwei bekannte Fälle dieser zweiten Sorte: „Ich kann nur abends trainieren"
 * (das Schema kennt keine Tageszeit) und „Montag geht doch wieder" (es gibt
 * keinen Weg, eine Sperre zurückzunehmen). Beides ist ein Schema-Mangel, kein
 * Parser-Fehler — und `unclear` ist dort die einzige ehrliche Ausgabe.
 */
export type UnclearIntent = Base & { kind: 'unclear'; said: string };

export type CoachIntent =
  | WellbeingIntent
  | SessionIntent
  | AvailabilityIntent
  | MoveWorkoutIntent
  | PainIntent
  | NoteIntent
  | UnclearIntent;

// ----------------------------------------------------------------- rules

/**
 * Intents, die den Plan verändern würden. Sie werden NIE direkt ausgeführt:
 * Die App zeigt einen Vorschlag, der Athlet bestätigt, erst dann wird
 * geschrieben. Dasselbe Muster wie das Freigabe-Gate in `block_builder`.
 */
export function needsConfirmation(kind: IntentKind): boolean {
  return kind === 'move_workout' || kind === 'change_availability';
}

/** Führt NICHT in die Trainingslogik, sondern zum Verweis. */
export function isClinical(kind: IntentKind): boolean {
  return kind === 'report_pain';
}

/**
 * Der Verweistext. Bewusst hier und nicht im Bildschirm, damit es genau eine
 * Fassung gibt. Keines der verbotenen Wörter aus Charter §2 kommt vor.
 */
export const REFERRAL_TEXT =
  'Notiert. Dieses System kann Beschwerden nicht einschätzen und tut es ' +
  'auch nicht. Wenn etwas anhält, schlimmer wird oder dich beim normalen ' +
  'Gehen stört, sprich bitte mit einer Ärztin oder Physiotherapeutin.';

// ------------------------------------------------------------- validation

export type ValidationResult =
  | { ok: true; intent: CoachIntent }
  | { ok: false; error: string };

const isInt = (v: unknown, lo: number, hi: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;

/** null bleibt null. Ein ungültiger Wert wird `undefined` und damit abgelehnt. */
const scale = (v: unknown, hi: number) =>
  v === null || v === undefined ? null : isInt(v, 1, hi) ? (v as number) : undefined;

const str = (v: unknown) => (typeof v === 'string' ? v : '');

const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * Prüft alles, was von außen kommt — die Swift-Brücke inbegriffen.
 *
 * Constrained decoding verhindert strukturelle Fehler auf der Modellseite,
 * aber Swift und TypeScript sind zwei Fassungen desselben Vertrags und
 * können auseinanderlaufen. Deshalb wird hier trotzdem geprüft, und
 * Unbekanntes wird ABGELEHNT statt durchgereicht.
 */
export function validate(raw: unknown): ValidationResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Kein Objekt.' };
  }
  const o = raw as Record<string, unknown>;

  if (typeof o.kind !== 'string' || !(INTENT_KINDS as readonly string[]).includes(o.kind)) {
    return { ok: false, error: `Unbekannter Intent: ${String(o.kind)}` };
  }

  const source = o.source;
  if (source !== 'quick_reply' && source !== 'model' && source !== 'free_text') {
    return { ok: false, error: `Unbekannte Quelle: ${String(source)}` };
  }
  const base: Base = {
    source,
    confidence: typeof o.confidence === 'number' ? o.confidence : null,
    said: typeof o.said === 'string' ? o.said : undefined,
  };

  // Narrowed into its own binding: inside each case TypeScript then knows the
  // exact literal, which is what lets the object literals type-check.
  const k: IntentKind = o.kind as IntentKind;

  switch (k) {
    case 'report_wellbeing': {
      const v = {
        sleepQuality: scale(o.sleepQuality, 5),
        soreness: scale(o.soreness, 5),
        stress: scale(o.stress, 5),
        motivation: scale(o.motivation, 5),
      };
      if (Object.values(v).some((x) => x === undefined)) {
        return { ok: false, error: 'Befinden: Werte müssen 1–5 oder null sein.' };
      }
      if (!isDate(o.date)) return { ok: false, error: 'Befinden: Datum fehlt.' };
      return {
        ok: true,
        intent: { ...base, kind: k, date: o.date as string, ...v } as WellbeingIntent,
      };
    }

    case 'report_session': {
      const rpe =
        o.rpe === null || o.rpe === undefined ? null : isInt(o.rpe, 1, 10) ? (o.rpe as number) : undefined;
      const feel = scale(o.feel, 5);
      if (rpe === undefined) return { ok: false, error: 'Einheit: Anstrengung muss 1–10 oder null sein.' };
      if (feel === undefined) return { ok: false, error: 'Einheit: Gefühl muss 1–5 oder null sein.' };
      // null ist erlaubt und richtig, wenn kein Tag genannt wurde.
      const date = o.date === null || o.date === undefined ? null : isDate(o.date) ? (o.date as string) : undefined;
      if (date === undefined) return { ok: false, error: 'Einheit: Datum muss JJJJ-MM-TT oder null sein.' };
      return {
        ok: true,
        intent: { ...base, kind: k, date, session: str(o.session), rpe, feel, note: str(o.note) },
      };
    }

    case 'change_availability': {
      const days = Array.isArray(o.unavailableDays) ? o.unavailableDays : [];
      const bad = days.filter((d) => !(WEEKDAYS as readonly unknown[]).includes(d));
      if (bad.length) return { ok: false, error: `Unbekannte Wochentage: ${bad.join(', ')}` };
      // Eine leere Liste ist KEINE gültige Einschränkung. Ein Durchlauf hat
      // für "ich kann nur abends" genau das geliefert — und die App würde es
      // als "keine Sperre" lesen und eine bestehende still überschreiben.
      if (days.length === 0) {
        return { ok: false, error: 'Verfügbarkeit ohne Tage gibt es nicht — dann ist es unclear.' };
      }
      return {
        ok: true,
        intent: { ...base, kind: k, unavailableDays: days as Weekday[], reason: str(o.reason) },
      };
    }

    case 'move_workout': {
      const from =
        o.fromDate === null || o.fromDate === undefined ? null : isDate(o.fromDate) ? (o.fromDate as string) : undefined;
      const to =
        o.toDate === null || o.toDate === undefined ? null : isDate(o.toDate) ? (o.toDate as string) : undefined;
      if (from === undefined || to === undefined) {
        return { ok: false, error: 'Verschieben: Datum muss JJJJ-MM-TT oder null sein.' };
      }
      return {
        ok: true,
        intent: { ...base, kind: k, workout: str(o.workout), fromDate: from, toDate: to },
      };
    }

    case 'report_pain': {
      if (!isDate(o.date)) return { ok: false, error: 'Beschwerden: Datum fehlt.' };
      const onset =
        o.onsetDate === null || o.onsetDate === undefined
          ? null
          : isDate(o.onsetDate)
            ? (o.onsetDate as string)
            : undefined;
      if (onset === undefined) {
        return { ok: false, error: 'Beschwerden: Beginn muss JJJJ-MM-TT oder null sein.' };
      }
      return {
        ok: true,
        intent: { ...base, kind: k, date: o.date as string, onsetDate: onset, described: str(o.described) },
      };
    }

    case 'note':
      return { ok: true, intent: { ...base, kind: k, text: str(o.text) } };

    case 'unclear':
      return { ok: true, intent: { ...base, kind: k, said: str(o.said) } };
  }
}

// --------------------------------------------------------------- summary

/** Eine Zeile, die zeigt, was verstanden wurde — vor jeder Bestätigung. */
export function summarise(intent: CoachIntent): string {
  switch (intent.kind) {
    case 'report_wellbeing': {
      const parts = (
        [
          ['Schlaf', intent.sleepQuality],
          ['Muskelkater', intent.soreness],
          ['Stress', intent.stress],
          ['Motivation', intent.motivation],
        ] as const
      )
        .filter(([, v]) => v !== null)
        .map(([label, v]) => `${label} ${v}/5`);
      if (parts.length) return parts.join(' · ');
      // Ohne Zahlen bleibt der Satz das Einzige, was da ist — und ohne diese
      // Zeile wären vier von zwanzig Testsätzen ein leerer Datensatz.
      return intent.said ? `Befinden: „${intent.said}“` : 'Befinden ohne Werte';
    }
    case 'report_session':
      return [
        intent.session || 'Einheit',
        intent.rpe !== null ? `Anstrengung ${intent.rpe}/10` : 'Anstrengung nicht angegeben',
        intent.feel !== null ? `Gefühl ${intent.feel}/5` : 'Gefühl nicht angegeben',
      ].join(' · ');
    case 'change_availability':
      return intent.unavailableDays.length
        ? `Nicht verfügbar: ${intent.unavailableDays.map((d) => WEEKDAY_LABEL[d]).join(', ')}`
        : 'Keine Einschränkung angegeben';
    case 'move_workout':
      return `Verschieben: ${intent.workout || 'Einheit'}${intent.toDate ? ` → ${intent.toDate}` : ' (Tag offen)'}`;
    case 'report_pain':
      return intent.described || 'Beschwerden gemeldet';
    case 'note':
      return intent.text;
    case 'unclear':
      return 'Nicht eindeutig verstanden';
  }
}
