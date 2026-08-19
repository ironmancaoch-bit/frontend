# Was die Engine können muss

**Für die Engine-Seite geschrieben, aus der App-Seite gemessen.**
Stand 2026-08-15 · App auf Expo SDK 54 · Feed-Vertrag `feed-v1`

Die App ist so gebaut, dass sie **alles** anzeigt, was die Engine liefern
könnte. Mehrere Bereiche bleiben heute leer, weil die Daten fehlen — nicht,
weil die Anzeige fehlt. Diese Datei listet genau diese Lücken, damit beim
Zusammenführen nichts erst dann auffällt.

Jeder Punkt wurde am Quelltext oder an erzeugten Feed-Dateien geprüft. Wo ich
mir nicht sicher bin, steht es dabei.

> **Reihenfolge nach Wirkung:** §1 und §2 schalten zusammen mehr frei als
> alles andere in diesem Dokument.

---

## 0. Was schon funktioniert — bitte nicht brechen

Der Vertrag `feed-v1` aus `docs/feed_schema.md` wird von der App vollständig
gelesen. **Alle 61 Blattfelder werden gerendert**, inklusive der Fälle, die in
den erzeugten Testdaten nie vorkommen (`recovery.flags`, `sleep.secs`,
`week.by_discipline`, `today.sessions`).

Was die App dabei voraussetzt:

- `schema_version` wird **vor** dem Parsen geprüft. Eine Änderung an der
  Bedeutung eines Feldes braucht eine neue Version, sonst zeigt die App still
  Falsches an.
- `null` heißt unbekannt und wird als solches dargestellt. **Bitte niemals `0`
  senden, wo nichts gemessen wurde.**
- Prosa-Felder (`recovery.summary`, `sleep.text`, `watch.items[].text`,
  `yesterday.read`, `next_unlock`) werden **wörtlich** angezeigt, nie
  umformuliert. Die App erzeugt keinen einzigen Satz Coaching-Text.

---

## 1. Verlauf im Feed — `history`

**Status: fehlt. Wirkung: die größte.**

Der Feed enthält genau einen Tag. Es gibt keinen `history`-Schlüssel, keine
Serie, keine Vorwerte — geprüft an allen sechs erzeugten Athleten. Damit ist
jede Verlaufsdarstellung unmöglich, und das ist die auffälligste Lücke
gegenüber allem, was Athleten von Garmin oder TrainingPeaks kennen.

**Die Daten existieren bereits.** `pmc.py` berechnet die vollständige
CTL/ATL/Form-Serie auf einem lückenlosen Kalendertag-Rückgrat bei jedem Lauf.
Sie wird nur nicht ausgespielt.

Vorschlag für das Feld:

```json
"history": {
  "from": "2026-05-18",
  "to":   "2026-08-14",
  "days": [
    { "date": "2026-08-14", "ctl": 77.0, "atl": 41.8, "form": 35.2, "load": 0.0, "imputed": false }
  ]
}
```

Wichtig dabei:

- `imputed` muss mit. Die Serie füllt fehlende Tage mit Null-Last auf, und ein
  aufgefüllter Tag darf in einer Kurve nicht wie ein gemessener aussehen.
- Der letzte Eintrag ist der letzte **vollständige** Tag, nicht heute — heute
  ist rechtsseitig zensiert (D4).
- 90 Tage reichen. Alles darüber ist Daten ohne Anzeigewert.

**Zwischenlösung, die schon läuft:** Die App archiviert jedes abgerufene
Briefing lokal (`src/storage.ts`, `archiveFeed`) und zeichnet die Kurve aus
dem, was sie gesammelt hat. Das funktioniert ab dem zweiten Tag, füllt aber
nur vorwärts. `history` ersetzt das rückwirkend.

---

## 2. Empfänger für Rückmeldungen — Roadmap F1

**Status: NOT BUILT. Blockiert: jeden Belastungswert für Einheiten, die die
Uhr nicht bewerten kann.**

Die Roadmap schreibt wörtlich: das System druckt jeden Morgen den Vorbehalt
und hat keinen Briefkasten für die Antwort. Die App hat jetzt den Briefkasten
auf ihrer Seite — Eingabe für Anstrengung, Gefühl und Befinden — und sie
speichert lokal, weil sie nichts absenden kann.

**Die App erzeugt diese Datensätze.** Sie liegen in einer Ausgangswarteschlange
und warten:

```json
{
  "kind": "session",
  "id": "m3k2p1-8x7q",
  "createdAt": "2026-08-15T18:22:04.000Z",
  "date": "2026-08-15",
  "session": "Langer Lauf",
  "rpe": 7,
  "feel": 4,
  "note": "Letzte 20 Minuten zäh.",
  "synced": false
}
```

```json
{
  "kind": "wellbeing",
  "date": "2026-08-15",
  "sleepQuality": 2, "soreness": 4, "stress": 3, "motivation": 2,
  "note": "",
  "synced": false
}
```

Was die Engine dafür braucht:

- **Eine Ablage pro Athlet**, die diese Sätze annimmt. `rpe` und `feel` sind
  bewusst die Namen aus den intervals.icu-Aktivitätsdaten (`icu_rpe`, `feel`),
  wo sie heute in **0 von 63** Einheiten gefüllt sind.
- **`null` muss erlaubt bleiben.** „Nicht angegeben" ist eine gültige Antwort
  und darf nicht als Mittelwert ankommen. Die App bietet für jede Skala
  ausdrücklich keine Vorbelegung an.
- **Ein Belastungswert für Krafttraining** aus `rpe` × Dauer wäre der erste
  echte Nutzen. Heute liefert die Uhr dafür nichts, und die Einheit fällt
  komplett aus CTL/ATL heraus.
- **Befinden hat noch gar kein Feld in der Engine.** Die Wellness-Datensätze
  tragen `restingHR`, `hrv`, `sleepSecs`, `weight` — nichts Subjektives. Das
  ist ein neues Modell, keine Erweiterung. *(Hinweis: F4 nennt einen
  Einwilligungs-Slot für sensible Gesundheitskategorien — sollte hier
  mitgedacht werden.)*

---

## 3. Übergabe der Erst-Erfassung

**Status: die App erhebt, die Engine nimmt nichts entgegen.**

Die Erst-Erfassung in der App (`app/onboarding.tsx`) bildet
`tools/new_athlete.py` nach: dieselben Schlüssel, dieselben Einheiten,
dieselben konservativen Vorgaben. Sie fragt **keinen einzigen Schwellenwert**
ab, weil ein getippter Wert später wie ein gemessener aussieht.

Sie erzeugt `toConfigPayload()` aus `src/intake.ts`:

```json
{
  "schema": "intake-v2",
  "athlete_id": "a-mfk3p2x-1q8w",
  "completed_at": "2026-08-19T06:00:00.000Z",
  "consent": { "given": true, "at": "2026-08-19T06:00:00.000Z" },
  "profile": {
    "hours_per_week_low": 8,
    "hours_per_week_high": 10,
    "own_rules": "Die Prüfung gewinnt immer. Ein voller Ruhetag pro Woche.",
    "coaching_style": "Direkt. Ungefragt melden, wenn etwas auffällt.",
    "personal_principles": "Schwimmen halte ich nur. Zeit limitiert, nicht die Ausdauer."
  },
  "config": [
    { "key": "athlete.timezone", "value": "Europe/Berlin",
      "unit": "IANA timezone name", "source": "athlete intake 2026-08-19" },
    { "key": "intake.age", "value": "UNKNOWN",
      "unit": "years", "source": "new-athlete template — replace when a real value exists" }
  ]
}
```

Was die Engine dafür braucht:

- **`athlete_id` als Partitionsnamen übernehmen.** Neu in v2. Die App erzeugt
  eine eigene Kennung (`a-<zeit>-<zufall>`, gültig nach
  `paths.validate_athlete_id`) und **niemals `default`**. Grund:
  `paths.for_athlete(None)` und `json_store.for_athlete(None)` fallen sonst
  still auf `default` zurück — unauffällig bei einem Athleten, ein Datenmischer
  beim Wiederherstellen auf ein zweites Gerät. Folge für die Zugangsdaten: der
  Schlüssel heißt `INTERVALS_API_KEY_<ID>`, nicht bar.
- Einen Weg, dieses Dokument in ein `athlete_config.toml` zu schreiben. Die
  Schlüssel passen bereits 1:1; `source` unterscheidet eine echte Antwort von
  einer stehengelassenen Vorgabe, und das darf nicht verlorengehen.
- **Die drei Prosa-Abschnitte in `profile.md` schreiben.** Ebenfalls neu in v2:
  `own_rules` → „The rules you have agreed with yourself", `coaching_style` →
  „How you want to be coached", `personal_principles` → „Principles specific to
  you". Sie wurden mit D66 aus dem SYSTEM-weiten `coach.md` herausgelöst, das
  `block_builder.py` für **jeden** Athleten liest — ohne sie gilt für alle
  dasselbe.
- Die `profile.hours_per_week_*`-Werte in die `hours/week`-Zeile von
  `profile.md`, weil der Planer genau diese Zeile liest und ohne sie nicht
  plant. **Diese Funktion existiert nicht** — `new_athlete.py` kopiert nur die
  Vorlage. Bis dahin bekommt jeder App-Athlet stillschweigend die 18–22 Stunden
  aus der Vorlage, was Standing Rule 3 verletzt.
- **Leerer String heißt „nicht beantwortet"** und darf nicht durch den
  Vorlagentext ersetzt werden. Alle drei Felder sind freiwillig.
- **Die Einwilligung muss tatsächlich greifen.** Heute führt `roster` ein
  Feld dafür, `roster.active()` filtert aber nur nach Status und Art, und
  `run_daily.py` gibt Probleme auf stderr aus und verarbeitet dann trotzdem
  alle. Solange das so ist, ist die Einwilligung in der App eine
  Willenserklärung und keine Sperre — und die App sagt das dem Athleten auch.

---

## 4. Mehrtagesplan für den Kalender

**Status: die Daten existieren strukturiert und erreichen den Feed nicht.**

`get_sessions_for_date()` nimmt genau ein Datum. Der Vier-Wochen-Block liegt
in `block_draft.json` mit `weeks[].days[].sessions[]` — also genau in der
Form, die ein Kalender braucht.

Gewünscht: ein `upcoming`-Feld mit denselben Feldern wie `today.sessions`,
plus `date` pro Eintrag, für ungefähr 14 Tage vorwärts. Die Herkunft
(`calendar` / `draft` / `starter`) muss pro Tag mitkommen, nicht global — ein
hochgeladener Block und ein lokaler Entwurf können nebeneinander bestehen.

---

## 5. Die zurückgehaltenen Meldungen

**Status: nur die Anzahl kommt an.**

`watch.held_back` liefert eine Zahl, die Inhalte nirgends. Das Tagesbudget von
zwei Meldungen ist richtig, aber der Athlet kann nicht nachsehen, was
zurückgehalten wurde.

Das ist **M1**, Status PARTIAL — und die Roadmap stellt ausdrücklich klar, dass
der versprochene Sonntagsbericht nicht existiert. Eine Liste im Feed wäre
billiger als ein Bericht und würde denselben Zweck erfüllen.

---

## 6. CTL pro Disziplin

**Status: REACHED_NOT_REPORTED.**

`discipline_pmc()` wird täglich berechnet und nie ausgegeben — nachzulesen in
`metric_versions.md`. Für einen Triathleten ist das eine der wertvollsten
Anzeigen überhaupt: Rad-Fitness und Lauf-Fitness bewegen sich getrennt, und
eine gemeinsame Zahl verdeckt genau das.

Die App hat dafür schon den Platz (die Wochenkarte teilt bereits nach
Sportart auf, sobald `by_discipline` gefüllt ist).

---

## 7. Drei Widersprüche im heutigen Feed

Gefunden beim Abgleich der erzeugten Dateien mit `docs/feed_schema.md`. Die
App umgeht alle drei — das ist dokumentiert in `src/feed.ts`, sollte aber an
der Quelle behoben werden.

| | Was | Belegt an |
|---|---|---|
| **1** | `today.source` liefert `"unplanned"`. Das Schema kennt nur `calendar`, `draft`, `starter`, `none`. | 5 von 6 erzeugten Athleten |
| **2** | `today.source_meaning` ist falsch, sobald `sessions` leer ist. `syn_beginner` hat `source: "starter"` und `rest_day: true`, aber die Bedeutung lautet „no plan exists for this day". Das Schema verlangt ausdrücklich das Gegenteil. | `feed.py:87` schlägt bei leerer Liste immer `"none"` nach |
| **3** | `week.expected_per_week` ist `0.0` statt `null`. Das Schema sagt wörtlich *„never rendered as 0"*. | `syn_beginner` |

Zu **2** noch: Die App leitet die Formulierung aus `source` + `rest_day` ab und
ignoriert `source_meaning`. Wenn das an der Quelle repariert wird, kann die
App zurück auf das Feld wechseln.

---

## 8. Der Weg der Daten aufs Telefon

**Status: existiert nicht. Bis dahin ist alles oben Theorie.**

Die App liest heute eine Testdatei, die im Bundle mitgeliefert wird. Es gibt
keinen Server, keinen Abruf, keine Authentifizierung.

Der Umschaltpunkt in der App ist **eine Funktion**: `fetchBriefing()` in
`src/athlete.ts`. Sie ist bereits richtig geformt — asynchron, kann scheitern,
liefert einen Tag. Wenn sie echte Daten holt, funktioniert alles Übrige
unverändert.

Was die andere Seite dafür braucht, unabhängig vom gewählten Weg:

- Eine Adresse, unter der das Briefing eines Athleten abrufbar ist.
- Eine Zuordnung, wer fragt — auch bei einem Athleten pro Gerät.
- **Wenn es eine Push-Nachricht geben soll:** Push kommt immer von einem
  Server, und iOS weckt die App nicht um 05:30, um selbst zu rechnen. Entweder
  das Briefing entsteht anderswo und wird abgeholt, oder es entsteht beim
  Öffnen der App.

*Diese Entscheidung ist noch nicht gefallen und gehört als D66 ins
Entscheidungsregister — sie verändert, was A4, B1, B4 und B5 bedeuten.*

---

## 9. Was die App ausdrücklich **nicht** braucht

Damit auf der Engine-Seite keine Arbeit in Dinge fließt, die hier niemand
liest:

- **Kein HTML.** `brief_render.py` erzeugt eine fertige Seite; die App baut
  ihre Darstellung selbst aus dem Feed.
- **Keine vorformatierten Zahlen.** Rohwerte mit Einheit sind besser — die
  App formatiert nach Gerätesprache.
- **Keine Farben, keine Schwellen für die Darstellung.** Die App entscheidet,
  was rot ist. Die Engine liefert `severity` und `confidence`, das genügt.
- **Keine Mehr-Athleten-Auswahl.** Ein Athlet pro Gerät ist die getroffene
  Entscheidung.

---

## Anhang: wie das hier geprüft wurde

- Feldabdeckung: jedes Blattfeld aus `feed_veteran.json` gegen alle
  `app/`- und `src/`-Quellen gegrept
- Chartbarkeit und Widersprüche: alle sechs erzeugten Athleten gescannt
  (`py tools/demo_data.py`)
- Erst-Erfassung: `tools/new_athlete.py` Funktion `render()` Zeile für Zeile
  nachgebaut
- Status-Angaben zu F1, M1, M2, A2 und REACHED_NOT_REPORTED: aus
  `docs/ROADMAP.md` und `docs/metric_versions.md` übernommen, nicht erinnert

---

## 10. Zwei Tests scheitern acht Stunden am Tag

**Gefunden 2026-08-19 gegen `f71ebb5`. Kein App-Thema — gehört der Engine-Seite,
deshalb hier und nicht als Änderung.**

```
tests/test_pmc_spine.py:19   TZ = ZoneInfo("Europe/Berlin")
tests/test_wiring.py:26      TZ = ZoneInfo("Europe/Berlin")
```

Beide berechnen ihre Erwartung mit diesem festen Berlin:

```python
expected = (today(TZ) - date.fromisoformat(ctx.config["history"]["anchor_date"])).days + 1
```

Der Testathlet `syn_veteran` lebt aber in **`America/Denver`**, und
`compute_ctl_atl_series` baut die Spine in der Zeitzone des **Athleten**.

Zwischen Mitternacht in Berlin und Mitternacht in Denver sind das zwei
verschiedene Tage. Gemessen um 05:57 Berliner Zeit: erwartet 211, geliefert
210. Das Fenster ist jeden Tag rund acht Stunden breit — in CI je nach
Laufzeit mal rot, mal grün.

Der Konfigurationskommentar des Athleten benennt die Absicht selbst:

> *"Deliberately varied across the library — a hardcoded Europe/Berlin would
> pass every test."*

Genau dafür wurde die Zeitzone variiert. Die beiden Tests umgehen es.

**Behebung:** `ZoneInfo(ctx.config["athlete"]["timezone"])` statt der Konstante
— oder `ctx.timezone`, wenn der Kontext sie schon trägt. Nicht den Athleten auf
Berlin umstellen: die Varianz ist der Zweck.

**Nebenbei, beim Herstellen der Umgebung gelernt:** Die Suite braucht den
Bootstrap-Schritt aus `.github/workflows/ci.yml:61`
(`python tools/new_athlete.py default --anchor 2026-01-21`). Ohne ihn scheitern
zusätzlich `test_a_stray_directory_does_not_stop_the_roster` und
`test_an_unreadable_record_does_not_stop_the_roster` — sie setzen einen REAL
enrollten `default` voraus. Für jemanden, der die Suite zum ersten Mal auf einer
neuen Maschine laufen lässt, sieht das nach kaputtem Code aus. Ein Satz in
`CLAUDE.md` unter „Tests" würde es abfangen.
