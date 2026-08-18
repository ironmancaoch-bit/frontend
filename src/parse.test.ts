/**
 * Prüft den Freitext-Erkenner gegen echte Sätze.
 *
 *     node --experimental-strip-types src/parse.test.ts
 *
 * Absichtlich ohne Test-Framework: keine weitere Abhängigkeit, und die
 * Ausgabe ist eine Liste von Sätzen, die man ohne Programmierkenntnisse
 * lesen kann — Charter §5, "Tests als Sätze".
 *
 * Wenn später das Modell dazukommt, läuft dieselbe Liste gegen dessen
 * Ausgabe. Dann ist vergleichbar, ob es wirklich besser ist.
 */
import { summarise } from './intents';
import { needsNumbers, parse } from './parse';

type Case = {
  text: string;
  /** Welche Intents mindestens erkannt werden müssen. */
  expect: string[];
  /** Was NICHT herauskommen darf. */
  forbid?: string[];
  note?: string;
};

const CASES: Case[] = [
  // --- der Fall aus dem Konzeptpapier -----------------------------------
  {
    text: 'Hab schlecht geschlafen und Mittwoch bin ich beruflich unterwegs. Können wir die Intervalle verschieben?',
    expect: ['change_availability', 'move_workout', 'report_wellbeing'],
    note: 'drei Signale in einem Satz',
  },

  // --- Verfügbarkeit ----------------------------------------------------
  {
    text: 'Montag muss ich arbeiten',
    expect: ['change_availability'],
  },
  {
    text: 'Am Dienstag und Donnerstag habe ich keine Zeit',
    expect: ['change_availability'],
  },
  {
    text: 'Freitag habe ich eine Klausur',
    expect: ['change_availability'],
    note: 'Prüfungen sind der wichtigste Sperrgrund im Projekt',
  },

  // --- Befinden ---------------------------------------------------------
  {
    text: 'Bin heute ziemlich platt',
    expect: ['report_wellbeing'],
    note: 'muss nach einer Zahl fragen, nicht raten',
  },
  { text: 'Schlecht geschlafen', expect: ['report_wellbeing'] },
  { text: 'Fühle mich fit und motiviert', expect: ['report_wellbeing'] },
  { text: 'Habe Muskelkater', expect: ['report_wellbeing'] },

  // --- Einheiten --------------------------------------------------------
  {
    text: 'Der lange Lauf war RPE 8',
    expect: ['report_session'],
    note: 'genannte Zahl darf übernommen werden',
  },
  { text: 'Das Training war 7 von 10', expect: ['report_session'] },

  // --- Verschieben ------------------------------------------------------
  { text: 'Kannst du die Intervalle verschieben?', expect: ['move_workout'] },

  // --- Beschwerden schlagen alles ---------------------------------------
  {
    text: 'Mein Knie tut weh seit gestern',
    expect: ['report_pain'],
    forbid: ['report_wellbeing', 'report_session', 'move_workout'],
    note: 'Beschwerden dürfen nie nebenbei den Plan ändern',
  },
  {
    text: 'Achillessehne zwickt, Montag kann ich nicht',
    expect: ['report_pain'],
    forbid: ['change_availability'],
    note: 'auch wenn ein Sperrtag drinsteht: Schmerz gewinnt',
  },

  // --- ehrliches Nichtverstehen ----------------------------------------
  {
    text: 'Hallo',
    expect: ['unclear'],
    note: 'lieber nachfragen als raten',
  },
  { text: 'Was meinst du damit?', expect: ['unclear'] },
];

let failed = 0;
let passed = 0;

for (const c of CASES) {
  const { intents } = parse(c.text);
  const kinds = intents.map((i) => i.kind);

  const missing = c.expect.filter((e) => !kinds.includes(e as never));
  const wrong = (c.forbid ?? []).filter((f) => kinds.includes(f as never));
  const ok = missing.length === 0 && wrong.length === 0;

  if (ok) passed++;
  else failed++;

  console.log(`${ok ? 'OK  ' : 'FAIL'}  "${c.text}"`);
  console.log(`        erkannt: ${kinds.join(', ') || '(nichts)'}`);
  for (const i of intents) {
    const num = needsNumbers(i) ? '  [fragt nach einer Zahl]' : '';
    console.log(`        → ${summarise(i)}${num}`);
  }
  if (missing.length) console.log(`        FEHLT: ${missing.join(', ')}`);
  if (wrong.length) console.log(`        DARF NICHT: ${wrong.join(', ')}`);
  if (c.note) console.log(`        (${c.note})`);
  console.log();
}

// Die eine Regel, die nie brechen darf: aus vagen Wörtern entsteht keine Zahl.
const vague = parse('Bin total platt und ausgelaugt').intents;
const invented = vague.some(
  (i) =>
    i.kind === 'report_wellbeing' &&
    (i.sleepQuality !== null || i.soreness !== null || i.stress !== null || i.motivation !== null),
);
if (invented) {
  console.log('FAIL  Aus einem vagen Wort wurde eine Zahl erfunden.');
  failed++;
} else {
  console.log('OK    Aus vagen Wörtern entsteht keine Zahl.');
  passed++;
}

console.log(`\n${passed} bestanden, ${failed} gescheitert.`);
process.exitCode = failed ? 1 : 0;
