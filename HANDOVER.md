# Übergabe — Stand 19.08.2026

**Für den nächsten Chat.** Dieser Verlauf liegt nur lokal
(`.claude/projects/…jsonl`) und ist von einem anderen Rechner aus nicht
lesbar. Alles Wichtige steht deshalb hier und in den Dateien daneben.

---

## Der Einstiegssatz für den neuen Chat

Kopier das hier hinein:

> Ich baue eine iOS-App für IronmanCoach. Frontend liegt in
> `C:\Users\benle\ironmancoach-app` (GitHub: `ironmancaoch-bit/frontend`),
> die Engine-Arbeitskopie in `C:\Users\benle\IronmanCoach_work`.
> Lies zuerst `HANDOVER.md`, `MAC_DAY_PLAN.md` und `ENGINE_REQUIREMENTS.md`
> im App-Repo. Ich habe morgen einen Mac und will die Engine eingebettet in
> die App bringen. Ändere nichts am Live-Repo der Engine.

---

## Wo was liegt

| Ordner | Rolle | Push |
|---|---|---|
| `C:\Users\benle\ironmancoach-app` | Frontend, Expo SDK 54 | erlaubt → `ironmancaoch-bit/frontend` |
| `C:\Users\benle\IronmanCoach_work` | Engine-**Arbeitskopie**, hier wird geändert | **gesperrt** |
| `C:\Users\benle\IronmanCoach_ClaudeSessions` | Engine-**Spiegel**, nur lesen | **gesperrt** |

Die Sperre ist echt: Die Push-Adresse ist absichtlich Unsinn, ein Push bricht
mit `does not appear to be a git repository` ab. Das Live-Repo des Kollegen
(`ironmancaoch-bit/ironmancoach`) kann von hier aus nicht beschrieben werden.

Beide Engine-Ordner haben eine **eigene** Python-Umgebung. Das ist Absicht:
eine gemeinsame editierbare Installation würde Code aus dem falschen Baum
ziehen — die Falle steht so in `CLAUDE.md`.

---

## Stand des Frontends

Committet und hochgeladen bis `9207448`. Drei Bildschirme (Heute, Coach,
Kalender), Erst-Erfassung in sieben Schritten, Intent-Vertrag, Freitext-
Erkenner mit 16 Tests. `npx tsc --noEmit` grün, iOS-Bundle baut.

Starten:

```bash
cd C:\Users\benle\ironmancoach-app; & "C:\Program Files\nodejs\npx.cmd" expo start
```

`npx` fehlt manchmal im PATH — dann den langen Pfad nutzen wie oben.

---

## Stand der Engine-Arbeitskopie

Basis `f71ebb5` (Session 024), darauf **ein lokaler Commit `db0aaad`** mit
E1–E6. Suite: **1062 bestanden, 19 abgewählt**.

```bash
cd C:\Users\benle\IronmanCoach_work
./.venv/Scripts/python.exe -m pytest -q -m "not live_athlete"
./.venv/Scripts/python.exe tools/ios_rehearsal.py
```

Der zweite Befehl ist das Wichtigste, was gestern entstanden ist: Er stellt
die iOS-Umgebung auf Windows nach — Wheel statt editierbarer Installation,
frisches Venv, umgebogene Ablage, keine Konsole, kein Arbeitsverzeichnis,
keine `.env`. **14 Prüfungen, alle grün.**

### Was E1–E6 gelöst haben

- **E1** `src.delivery` fehlte in der Paketliste — also `feed.py`, also
  `build_feed`, also genau die Funktion, die ein Host importiert. Jetzt
  Paketerkennung statt Handliste.
- **E2** `tzdata` steht in den Wheel-Metadaten. Ohne sie wirft `ZoneInfo`
  bei jedem `tenant.resolve`.
- **E3** `paths.configure_roots(root, …)` biegt alle vier Wurzeln gemeinsam
  um. Einzeln geht es schief.
- **E4** `feed.feed_for_athlete(athlete_id)` — eine Id rein, ein dict raus,
  kein Schreibzugriff, Datum athletenlokal.
- **E5** `tenant.AthleteNotFoundError` — aus 14 irreführenden Zeilen wurde
  eine richtige.
- **E6** `tools/ios_rehearsal.py`.

### Was in der Engine noch offen ist

`MAC_DAY_PLAN.md` Abschnitt 2, Punkte **E7 bis E15**. Die wichtigsten:

- **E8** `build_feed` kann bis zu **18 Minuten** blockieren — `http.py:95-101`
  übernimmt ein `Retry-After` ungedeckelt. Auf dem Telefon ein eingefrorener
  Feed oder ein vom Watchdog getötetes Task. Sofortmaßnahme:
  `min(delay, BACKOFF_MAX_SECONDS)`.
- **E9** Jeder Feed führt mit `🚨 SCHEDULED JOB NOT RUNNING`, weil auf dem
  Telefon kein Cron läuft. Der Feed weiß schon, dass der Athlet neu ist
  (`new_athlete`) — eine Zeile.
- **E12** Ein unausgefülltes Profil liefert stillschweigend **18–22 h/Woche**
  statt UNKNOWN. Verstoß gegen Standing Rule 3, Ein-Zeilen-Fix in
  `config/profile.template.md:10`.
- **E13** Drei Vertragsentscheidungen, brauchen Nummern ab **D68**.

---

## Zwei Befunde für den Kollegen

Stehen in `ENGINE_REQUIREMENTS.md` §10. Nicht selbst geändert, weil die
Engine seine Lane ist:

1. **Zwei Tests scheitern täglich acht Stunden lang.**
   `tests/test_pmc_spine.py:19` und `tests/test_wiring.py:26` verankern fest
   auf `Europe/Berlin`, der Testathlet lebt in `America/Denver`.
2. **Der Testlauf braucht den CI-Bootstrap.** Ohne
   `python tools/new_athlete.py default --anchor 2026-01-21` scheitern zwei
   Roster-Tests, und das sieht nach kaputtem Code aus.

---

## Der Mac-Tag

Ablauf in `MAC_DAY_PLAN.md` Abschnitt 4, zehn Schritte. Die Reihenfolge ist
wichtig — jeder Schritt ist ein Experiment mit einer Antwort:

1. **Hat der iOS-CPython-Build `_ssl`?** Die Weiche des Tages. Wenn nein,
   fällt der ganze `requests`-Pfad weg.
2. Liegt `tzdata/zoneinfo/Europe/Berlin` als **Datei** im Bundle? Ebenso
   `certifi/cacert.pem` und `config/coaching_config.toml`.
3. Zip oder Verzeichnis?
4. Erster Import auf einem Hintergrund-Thread, Zeit stoppen.
5. Was ist `sys.stderr` im eingebetteten Interpreter?
6. `configure_roots` auf Documents zeigen lassen, dann `known_athlete_ids()`.
7. **Erst jetzt** `feed_for_athlete("syn_veteran")` ohne Netz.
8. Dann mit Netz und Schlüssel aus dem Schlüsselbund.

Was **nicht** vorbereitet werden kann, steht in Abschnitt 5 — ehrlich und
ohne Ersatzbeschäftigung.

---

## Zwei offene Entscheidungen

**D66** (`DECISION_local_first.md`, Entwurf): Passwort-Reset **oder**
Wiederherstellungsschlüssel? Beides zusammen geht nicht. Ohne Antwort lässt
sich das verschlüsselte Backup nicht bauen.

**Das Design.** Du hast eines mit Claude Design gebaut, der Link fehlt mir
noch. In diesem Konto liegt keines — `/artifacts` im Terminal oder
claude.ai/code/artifacts zeigt deine. Ohne Link kann ich es nicht ins
Frontend übernehmen.

---

## Die Dateien, die den Rest erklären

| Datei | Inhalt |
|---|---|
| `MAC_DAY_PLAN.md` | 32.000 Zeichen, E1–E15, F1–F7, Mac-Ablauf, was nicht vorbereitbar ist |
| `ENGINE_REQUIREMENTS.md` | Was die Engine liefern muss, mit den JSON-Formen |
| `DECISION_local_first.md` | Entwurf D66 |
| `IOS_PORTING_PLAN.md` | älter, gegen den abgelegten Strang — durch `MAC_DAY_PLAN.md` ersetzt |
