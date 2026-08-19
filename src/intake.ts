/**
 * Day-one intake — a faithful mirror of what the engine actually creates.
 *
 * SOURCE OF TRUTH: `tools/new_athlete.py` in the engine repo. That tool is
 * "the single source of the day-one athlete config" and writes every
 * ATHLETE-scoped key the schema requires. Every field, default, unit and
 * allowed value below was read off its `render()` function, not invented.
 *
 * Two rules from the engine that the UI must not soften:
 *
 *  1. A MEASUREMENT is never defaulted. All thirteen thresholds start
 *     UNKNOWN and stay UNKNOWN until somebody measures them. The onboarding
 *     therefore does not ask for them at all — offering a plausible
 *     pre-filled number is exactly the failure the engine's own comment
 *     calls out: "a template value that looks measured".
 *
 *  2. A SETTING gets the most conservative defensible default, and each one
 *     is explicitly a starting point rather than a fact.
 *
 * The engine's config format carries `value / unit / comment / source` per
 * key. `source` is why a value is believed. Anything the athlete types here
 * gets `athlete intake <date>`; anything left at its default keeps the
 * template source, so the two can never be confused later.
 */

export const DISCIPLINES = ['swim', 'bike', 'run', 'strength'] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  swim: 'Schwimmen',
  bike: 'Rad',
  run: 'Laufen',
  strength: 'Kraft',
};

/** `intake.experience_level` — the engine's exact allowed values. */
export const EXPERIENCE = ['new', 'developing', 'experienced', 'elite'] as const;
export type Experience = (typeof EXPERIENCE)[number];

export const EXPERIENCE_LABEL: Record<Experience, string> = {
  new: 'Neu',
  developing: 'Im Aufbau',
  experienced: 'Erfahren',
  elite: 'Elite',
};

/** `season.phase` — UNKNOWN selects the general default. */
export const SEASON_PHASE = ['base', 'build', 'peak'] as const;
export type SeasonPhase = (typeof SEASON_PHASE)[number];

export const SEASON_LABEL: Record<SeasonPhase, string> = {
  base: 'Grundlage',
  build: 'Aufbau',
  peak: 'Formaufbau',
};

/**
 * The thirteen threshold keys, all UNKNOWN on day one. Listed so the app can
 * SHOW what is missing and which test unlocks it — never so it can ask the
 * athlete to type one in.
 */
export const THRESHOLD_KEYS = [
  'ftp_watts',
  'threshold_run_pace_sec_per_km',
  'css_sec_per_100m',
  'max_hr',
  'lthr_bike',
  'lthr_run',
  'lthr_swim',
  'lt1_hr_bike',
  'lt1_hr_run',
  'lt1_hr_swim',
  'last_ftp_test_date',
  'last_run_threshold_test_date',
  'last_css_test_date',
] as const;

/**
 * What the athlete can actually do about each missing threshold, in the
 * engine's own priority order from `docs/athlete_homework.md`. Items 1 and 3
 * there "unblock more than everything else combined".
 */
export const HOMEWORK: {
  key: string;
  what: string;
  effort: string;
  unlocks: string;
}[] = [
  {
    key: 'lt1_hr_bike',
    what: 'LT1-Test auf dem Rad',
    effort: '60 min, eine Einheit',
    unlocks: 'Die Z1/Z2-Trennung, Erkennung zu harter Grundlageneinheiten, das ganze Verteilungsziel',
  },
  {
    key: 'lt1_hr_run',
    what: 'LT1-Test beim Laufen',
    effort: '45 min, eine Einheit',
    unlocks: 'Dasselbe für die Disziplin, die dein Tempolimit setzt',
  },
  {
    key: 'session_names',
    what: 'Einheiten benennen',
    effort: '10 Sekunden pro Einheit, dauerhaft',
    unlocks: 'Verteilung nach Absicht — und die zweite Hälfte der Easy-Erkennung',
  },
  {
    key: 'css_sec_per_100m',
    what: 'CSS-Test im Becken',
    effort: '30 min',
    unlocks: 'Schwimmzonen (geringster Nutzen, siehe Vorbehalt in der Engine)',
  },
  {
    key: 'ftp_watts',
    what: 'FTP-Test',
    effort: '60 min',
    unlocks: 'Genauigkeit der Vorgaben — bewusst zuletzt',
  },
];

/**
 * Die Athleten-Id dieses Geräts.
 *
 * WARUM SIE ERZEUGT WIRD UND NICHT WEGGELASSEN. Ohne ausdrückliche Id fällt
 * die Engine still auf `default` zurück — `paths.for_athlete(None)` und
 * `json_store.for_athlete(None)` tun genau das. Auf einem Gerät mit einem
 * Athleten fällt das nie auf. Beim Wiederherstellen eines Backups auf ein
 * zweites Gerät schreiben dann zwei Personen in dieselbe Partition.
 *
 * Zusätzlich hängt die Benennung der Zugangsdaten daran: `config/settings.py`
 * vergibt den unsuffigierten `INTERVALS_API_KEY` nur an `default`, alle
 * anderen bekommen `INTERVALS_API_KEY_<ID>`. Eine eigene Id kostet heute
 * genau diesen Suffix — und sie überlebt die geplante Abschaffung von
 * `default` (Roadmap A5), die diese Benennungsregel ohnehin ändern wird.
 *
 * Format nach `paths.validate_athlete_id`: nur Buchstaben, Ziffern,
 * Bindestrich, Unterstrich. Die Id wird ein Verzeichnisname.
 */
export function newAthleteId(): string {
  const stamp = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 1e8).toString(36);
  return `a-${stamp}-${rand}`;
}

/** Dieselbe Prüfung wie `paths.validate_athlete_id`, vor dem Speichern. */
export function isValidAthleteId(id: string): boolean {
  if (typeof id !== 'string' || id.trim() === '' || id !== id.trim()) return false;
  if (id === 'default') return false; // der Rückfall, den wir vermeiden
  return /^[A-Za-z0-9_-]+$/.test(id);
}

/** Everything the onboarding collects. Mirrors the config sections 1:1. */
export type Intake = {
  /** Diese Installation. Erzeugt beim ersten Start, danach unveränderlich. */
  athleteId: string;
  /** `athlete.timezone` — sets every day boundary. */
  timezone: string;
  /** `history.anchor_date` — when logging becomes trustworthy (D1). */
  anchorDate: string;

  /** `intake.age`. null ⇒ UNKNOWN ⇒ no general zone estimate is offered (D16). */
  age: number | null;
  /** `intake.experience_level`. null ⇒ UNKNOWN. */
  experience: Experience | null;
  /** `intake.primary_discipline` — exempt from the D11 ordering rule (D17). */
  primaryDiscipline: Discipline | null;
  /** `season.phase`. null ⇒ UNKNOWN ⇒ shown against all three targets. */
  seasonPhase: SeasonPhase | null;

  /** `expected_days_per_week.*` */
  expectedDays: Record<Discipline, number>;
  /** `tracking.*` — false = trained but NOT recorded. See D3. */
  tracking: Record<Discipline, boolean>;
  /** `training_start.*` — when this tissue started being loaded. */
  trainingStart: Record<Discipline, string>;

  /** `maturity.min_rest_days_per_week` */
  minRestDays: number;
  /** `adherence.tolerance_days` */
  toleranceDays: number;
  /** `load_ratio.chronic_load_floor` */
  chronicLoadFloor: number;

  /** The planner reads the hours/week line out of `profile.md`. */
  hoursPerWeekLow: number | null;
  hoursPerWeekHigh: number | null;

  /**
   * Die drei Prosa-Abschnitte aus `config/profile.template.md`, die seit D66
   * dorthin gehören und die das Onboarding bisher nicht erhoben hat.
   *
   * Sie wurden aus dem SYSTEM-weiten `coach.md` herausgelöst — dort galt die
   * Antwort eines Athleten für alle. Leer gelassen bekommt jeder App-Athlet
   * einen leeren Präferenz- und Limiter-Abschnitt, und die allgemeinen
   * Grundsätze gelten ungefiltert.
   *
   * Freitext, absichtlich. Keine Auswahlliste kann „das Examen gewinnt immer"
   * abbilden, und das ist genau die Sorte Regel, um die es geht.
   */
  ownRules: string;
  coachingStyle: string;
  personalPrinciples: string;

  /** Consent is REQUIRED and not on record until given (D62). */
  consentGiven: boolean;
  consentAt: string | null;

  /** When this intake was completed, for the `source` line. */
  completedAt: string | null;
};

/** The engine's own day-one defaults, value for value. */
export function defaultIntake(today: string): Intake {
  return {
    athleteId: newAthleteId(),
    timezone: 'Europe/Berlin',
    anchorDate: today,

    age: null,
    experience: null,
    primaryDiscipline: null,
    seasonPhase: null,

    // "Below the D11 ordering floor on purpose: a new athlete's week is the
    // least settled thing about them."
    expectedDays: { swim: 2, bike: 2, run: 2, strength: 2 },
    // "Assumed logged to intervals.icu. Set false for anything trained but
    // not recorded — an untracked sport read as absence is D3's trap."
    tracking: { swim: true, bike: true, run: true, strength: true },
    trainingStart: { swim: today, bike: today, run: today, strength: today },

    minRestDays: 2,
    toleranceDays: 3,
    chronicLoadFloor: 40,

    hoursPerWeekLow: null,
    hoursPerWeekHigh: null,

    ownRules: '',
    coachingStyle: '',
    personalPrinciples: '',

    consentGiven: false,
    consentAt: null,

    completedAt: null,
  };
}

/**
 * The intake as the engine's config shape, ready to hand over when the two
 * halves are joined. Keys, units and comments match `new_athlete.py` so the
 * receiving side can write the TOML without re-deriving anything.
 *
 * Untouched settings keep the template source; anything the athlete supplied
 * is marked as theirs, so a later reader can tell a real answer from a
 * default. Thresholds are deliberately absent — the engine writes those as
 * UNKNOWN itself and nothing here may claim a measurement.
 */
export function toConfigPayload(intake: Intake) {
  const said = intake.completedAt
    ? `athlete intake ${intake.completedAt.slice(0, 10)}`
    : 'athlete intake';
  const template = 'new-athlete template — replace when a real value exists';

  const e = (
    key: string,
    value: string | number | boolean | null,
    unit: string,
    fromAthlete: boolean,
  ) => ({
    key,
    value: value === null ? 'UNKNOWN' : value,
    unit,
    source: fromAthlete ? said : template,
  });

  const rows = [
    e('athlete.timezone', intake.timezone, 'IANA timezone name', true),
    e('history.anchor_date', intake.anchorDate, 'date (YYYY-MM-DD)', true),
    e('data_trust.interpretation_start_date', intake.anchorDate, 'date (YYYY-MM-DD)', true),
    e('power.expected_from', intake.anchorDate, 'date (YYYY-MM-DD)', true),

    e('intake.age', intake.age, 'years', intake.age !== null),
    e('intake.experience_level', intake.experience,
      'one of: new / developing / experienced / elite', intake.experience !== null),
    e('intake.primary_discipline', intake.primaryDiscipline,
      'one of: swim / bike / run / strength, or UNKNOWN',
      intake.primaryDiscipline !== null),
    e('season.phase', intake.seasonPhase,
      'season phase name (base / build / peak)', intake.seasonPhase !== null),

    e('maturity.min_rest_days_per_week', intake.minRestDays, 'days per week', true),
    e('adherence.tolerance_days', intake.toleranceDays, 'days per recent window', false),
    e('load_ratio.chronic_load_floor', intake.chronicLoadFloor,
      'load units per week (TSS-equivalent)', false),
  ];

  for (const d of DISCIPLINES) {
    rows.push(e(`expected_days_per_week.${d}`, intake.expectedDays[d], 'days per week', true));
    rows.push(e(`tracking.${d}`, intake.tracking[d], 'boolean', true));
    rows.push(e(`training_start.${d}`, intake.trainingStart[d], 'date (YYYY-MM-DD)', true));
  }

  return {
    schema: 'intake-v2',
    /** Der Verzeichnisname der Partition. Nie `default`. */
    athlete_id: intake.athleteId,
    completed_at: intake.completedAt,
    consent: { given: intake.consentGiven, at: intake.consentAt },
    /**
     * Die Abschnitte von `profile.md`. Die Engine schreibt bisher nur die
     * Vorlage (`new_athlete.py` kopiert sie), es gibt keine Funktion, die
     * diese Antworten einträgt — siehe ENGINE_REQUIREMENTS.md §3.
     *
     * Leerer String heißt "nicht beantwortet" und darf NICHT durch einen
     * Vorgabetext ersetzt werden. Die Vorlage liefert sonst stillschweigend
     * 18–22 Stunden pro Woche für jeden.
     */
    profile: {
      hours_per_week_low: intake.hoursPerWeekLow,
      hours_per_week_high: intake.hoursPerWeekHigh,
      own_rules: intake.ownRules,
      coaching_style: intake.coachingStyle,
      personal_principles: intake.personalPrinciples,
    },
    config: rows,
  };
}
