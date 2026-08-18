/**
 * Freitext → CoachIntents, ohne KI.
 *
 * WOFÜR DAS DA IST. Zwei Dinge gleichzeitig:
 *   1. Es funktioniert HEUTE, auf jedem Gerät, ohne Mac und ohne Modell.
 *   2. Es ist der Fallback, den das Konzept für Telefone ohne Apple
 *      Intelligence verlangt — und der bleibt auch dann nötig, wenn das
 *      Modell später dazukommt.
 *
 * Wenn das Modell kommt, ersetzt es genau diese eine Funktion. Alles
 * dahinter — Prüfung, Bestätigung, Speicherung — bleibt unverändert, weil
 * beide dieselben CoachIntents erzeugen.
 *
 * ────────────────────────────────────────────────────────────────────────
 * DIE REGEL, DIE HIER ALLES BESTIMMT
 *
 * Herausziehen ja, quantifizieren nein.
 *
 * "Montag" steht wörtlich im Text — das darf extrahiert werden. "Bin platt"
 * ist KEINE Zahl, und daraus `motivation: 2` zu machen wäre eine erfundene
 * Messung. Charter §4.1: niemals eine Messung fabrizieren.
 *
 * Also: Der Erkenner merkt, DASS es um das Befinden geht, lässt die Skalen
 * aber auf null und lässt den Athleten die Zahl antippen. Eine Zahl wird
 * nur übernommen, wenn sie im Text steht ("RPE 7", "7 von 10").
 *
 * Dieselbe Regel steht später im @Guide-Text der Swift-Struktur.
 * ────────────────────────────────────────────────────────────────────────
 *
 * WAS ER NICHT KANN. Er versteht keine Grammatik. "Montag kann ich" und
 * "Montag kann ich nicht" unterscheidet er nur an einem Stichwort. Deshalb
 * meldet er niedrige Sicherheit, und deshalb bestätigt der Athlet jeden
 * Treffer, bevor irgendetwas gespeichert wird.
 */
import type { CoachIntent, Weekday } from './intents';

const today = () => new Date().toISOString().slice(0, 10);

// --------------------------------------------------------------- Stichwörter

const WEEKDAY_WORDS: [RegExp, Weekday][] = [
  [/\bmontags?\b|\bmo\b/i, 'monday'],
  [/\bdienstags?\b|\bdi\b/i, 'tuesday'],
  [/\bmittwochs?\b|\bmi\b/i, 'wednesday'],
  [/\bdonnerstags?\b|\bdo\b/i, 'thursday'],
  [/\bfreitags?\b|\bfr\b/i, 'friday'],
  [/\bsamstags?\b|\bsonnabends?\b|\bsa\b/i, 'saturday'],
  [/\bsonntags?\b|\bso\b/i, 'sunday'],
];

/** Hinweise darauf, dass an einem Tag NICHT trainiert werden kann. */
const BLOCKED =
  /\bkann ich nicht\b|\bkann nicht\b|\bgeht nicht\b|\bschaffe ich nicht\b|\barbeite\w*\b|\bberuflich\b|\bunterwegs\b|\bkeine zeit\b|\bverhindert\b|\btermin\w*\b|\bdienstreise\b|\bmeeting\b|\bpr[üu]fung\w*\b|\bklausur\w*\b|\buni\b|\bschule\b/i;

const MOVE =
  /\bverschieb\w*\b|\bverleg\w*\b|\bumleg\w*\b|\btausch\w*\b|\bschieb\w*\b|\banders legen\b|\bwoanders hin\b/i;

/**
 * Beschwerden. Bewusst großzügig: lieber einmal zu oft den Verweis zeigen
 * als einmal zu wenig. Charter §2 — melden und verweisen, nie beraten.
 *
 * DIE GRENZE ZUM BEFINDEN, festgelegt statt dem Zufall überlassen:
 * Muskelkater, Steifheit und Verspannung sind **Befinden**. `report_pain`
 * gilt für Schmerz, Stechen oder Ziehen an einer benannten Struktur.
 *
 * Nötig wurde die Festlegung, weil fünf Modelldurchläufe „Habe Muskelkater"
 * einstimmig als Befinden und „Rücken ist etwas steif" einstimmig als
 * Schmerz einsortiert haben — beides Beschwerden, die Grenze war Glückssache.
 */
const PAIN =
  /\bweh\b|\bwehtut\b|\btut weh\b|\bschmerz\w*\b|\bzieht\b|\bziept\b|\bzwickt\b|\bsticht\b|\bstechen\b|\bverletz\w*\b|\bzerrung\b|\bentz[üu]nd\w*\b|\bsehne\w*\b|\bachilles\w*\b|\bknie\w*\b|\bwade\w*\b|\bschulter\b|\bh[üu]fte\b|\bsprunggelenk\b|\bschienbein\b/i;

/**
 * Themenwörter fürs Befinden. Sie lösen die Skalen aus, füllen sie nie.
 * Steifheit und Verspannung stehen hier, siehe die Grenze bei PAIN.
 */
const WELLBEING =
  /\bgeschlafen\b|\bschlaf\w*\b|\bm[üu]de\b|\bplatt\b|\bkaputt\b|\bersch[öo]pft\b|\bfertig\b|\bausgelaugt\b|\bfit\b|\bfrisch\b|\bmotiviert\b|\blustlos\b|\bkeine lust\b|\bstress\w*\b|\bgestresst\b|\bmuskelkater\b|\bwund\b|\bsteif\w*\b|\bverspann\w*\b|\bschwer in den beinen\b/i;

const SESSION =
  /\beinheit\b|\btraining\b|\blauf\b|\bgelaufen\b|\brad\b|\bgefahren\b|\bgeschwommen\b|\bintervall\w*\b|\btempolauf\b|\blangen lauf\b|\blanger lauf\b|\bkraft\w*\b/i;

/** Namen von Einheiten, wörtlich, für move_workout. */
const WORKOUT_WORDS = [
  'intervalle', 'intervall', 'tempolauf', 'langer lauf', 'longrun', 'long run',
  'schwimmen', 'radfahren', 'radeinheit', 'lauf', 'krafttraining', 'kraft',
  'einheit', 'training',
];

// ------------------------------------------------------------------ Zahlen

/** NUR Zahlen, die wirklich im Text stehen. Nie abgeleitet. */
function extractRpe(text: string): number | null {
  const patterns = [
    /\brpe\s*[:=]?\s*(\d{1,2})\b/i,
    /\b(\d{1,2})\s*(?:von|\/)\s*10\b/i,
    /\banstrengung\s*[:=]?\s*(\d{1,2})\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const n = Number.parseInt(m[1], 10);
      if (n >= 1 && n <= 10) return n;
    }
  }
  return null;
}

function findWeekdays(text: string): Weekday[] {
  const found: Weekday[] = [];
  for (const [re, day] of WEEKDAY_WORDS) {
    if (re.test(text) && !found.includes(day)) found.push(day);
  }
  return found;
}

function findWorkout(text: string): string {
  const lower = text.toLowerCase();
  // Längste Übereinstimmung zuerst, damit "langer lauf" nicht als "lauf" endet.
  for (const w of [...WORKOUT_WORDS].sort((a, b) => b.length - a.length)) {
    if (lower.includes(w)) return w;
  }
  return '';
}

// ------------------------------------------------------------------ parse

export type ParseResult = {
  intents: CoachIntent[];
  /** Was der Erkenner NICHT zuordnen konnte. Leer, wenn alles passte. */
  leftover: string;
};

/**
 * Eine Nachricht kann mehrere Signale tragen — "schlecht geschlafen und
 * Montag muss ich arbeiten" sind zwei. Deshalb eine Liste, keine Einzelantwort.
 *
 * Wird nichts erkannt, kommt genau ein `unclear` zurück. Das ist ein
 * vollwertiges Ergebnis und keine Fehlerbehandlung: raten wäre schlechter.
 */
export function parse(rawText: string): ParseResult {
  const text = rawText.trim();
  if (!text) return { intents: [], leftover: '' };

  const base = { source: 'free_text' as const, said: text };
  const intents: CoachIntent[] = [];
  const matched: string[] = [];

  // Beschwerden zuerst und exklusiv: Wenn jemand von Schmerzen schreibt,
  // ist das die wichtigste Information in der Nachricht, und daraus darf
  // nebenbei keine Trainingsänderung abgeleitet werden.
  if (PAIN.test(text)) {
    return {
      intents: [
        {
          ...base,
          kind: 'report_pain',
          date: today(),
          // "seit gestern" zuverlässig in ein Datum zu wandeln, kann dieser
          // Erkenner nicht — also null statt geraten.
          onsetDate: null,
          described: text,
          confidence: 0.5,
        },
      ],
      leftover: '',
    };
  }

  const days = findWeekdays(text);
  if (days.length > 0 && BLOCKED.test(text)) {
    intents.push({
      ...base,
      kind: 'change_availability',
      unavailableDays: days,
      reason: text,
      confidence: 0.6,
    });
    matched.push('Verfügbarkeit');
  }

  if (MOVE.test(text)) {
    intents.push({
      ...base,
      kind: 'move_workout',
      workout: findWorkout(text),
      fromDate: null,
      toDate: null,
      confidence: 0.6,
    });
    matched.push('Verschieben');
  }

  const rpe = extractRpe(text);
  if (rpe !== null || (SESSION.test(text) && !MOVE.test(text) && days.length === 0)) {
    intents.push({
      ...base,
      kind: 'report_session',
      // Kein Tag genannt heißt null. Heute einzusetzen wäre dasselbe
      // Erfinden wie eine Zahl zu raten — drei von fünf Modelldurchläufen
      // sind genau daran auseinandergelaufen.
      date: null,
      session: findWorkout(text),
      // Nur eine im Text genannte Zahl. Sonst null — der Athlet tippt sie an.
      rpe,
      feel: null,
      note: text,
      confidence: rpe !== null ? 0.7 : 0.4,
    });
    matched.push('Einheit');
  }

  if (WELLBEING.test(text)) {
    intents.push({
      ...base,
      kind: 'report_wellbeing',
      date: today(),
      // ALLE null, absichtlich. Aus "platt" eine 2 zu machen wäre eine
      // erfundene Messung — die App fragt stattdessen nach.
      sleepQuality: null,
      soreness: null,
      stress: null,
      motivation: null,
      confidence: 0.5,
    });
    matched.push('Befinden');
  }

  if (intents.length === 0) {
    return {
      intents: [{ ...base, kind: 'unclear', said: text, confidence: 0 }],
      leftover: text,
    };
  }

  return { intents, leftover: '' };
}

/** Braucht dieser Treffer noch eine Zahl vom Athleten? */
export function needsNumbers(intent: CoachIntent): boolean {
  if (intent.kind === 'report_wellbeing') {
    return (
      intent.sleepQuality === null &&
      intent.soreness === null &&
      intent.stress === null &&
      intent.motivation === null
    );
  }
  if (intent.kind === 'report_session') return intent.rpe === null;
  return false;
}
