# Arbeitsliste: Engine eingebettet unter iOS — was VOR dem Mac auf Windows passiert

*Erzeugt 2026-08-16 aus sechs parallelen, rein lesenden Prüfungen des
Engine-Klons, jeder Befund anschließend gegengeprüft mit der Vorgabe, ihn zu
widerlegen. 76 Befunde geprüft, 50 bestätigt, 26 verworfen, **0 echte
Blocker**.*

*Der Engine-Klon wurde dabei nicht verändert. Diese Datei liegt bewusst im
App-Repo: sie ist die Anforderung der App-Seite an die Engine-Seite, wie
[ENGINE_REQUIREMENTS.md](ENGINE_REQUIREMENTS.md) — die Umsetzung gehört nach
`docs/LANES.md` in eine Engine-Sitzung.*

---

## Kurzurteil zuerst

Kein einziger echter BLOCKER. Der Code ist für eine Portierung ungewöhnlich
gut aufgestellt: ein einziger HTTP-Einstiegspunkt (`src/utils/http.py:83`),
keine dynamischen Importe in `src/`, keine cwd-Abhängigkeit, atomare
Schreibvorgänge sandbox-korrekt (`src/utils/io_safe.py:28`).

Aber drei Annahmen, mit denen wir gestartet sind, sind **falsch**:

1. **„Keine C-Extensions"** — falsch. `charset_normalizer` lädt zwei
   kompilierte `.pyd` (über `requests`, via `src/analysis/brief_context.py:25`).
   Pure-Python-Fallbacks existieren, aber nur zufällig, nicht per Entscheidung.
2. **„`build_feed` ist die eine Funktion, die einen Tages-Feed als dict
   zurückgibt"** — stimmt, aber sie ist **keine reine lokale Funktion**. Sie
   kann einen blockierenden Netzwerkaufruf machen (`src/delivery/feed.py:75` →
   `src/analysis/brief_context.py:167`), Worst Case ~167 s. Auf dem
   Main-Thread ist das ein garantierter Watchdog-Kill. `ARCHITECTURE.md:106`
   behauptet das Gegenteil — Doku-Konflikt nach Standing Rule 4.
3. **„Eine Callable reicht"** — heute nicht. `src/delivery` ist **nicht im
   Wheel** (`pyproject.toml:25-34`). Auf dem Entwicklungsrechner funktioniert
   es nur wegen des Editable-Install. Aus einem gebauten Paket heraus gibt es
   `build_feed` nicht.

Das eigentliche Risiko liegt also nicht im Rechencode, sondern im
**Packaging**. Genau dieser Fehlertyp zeigt sich erst am Mac, in Xcode, ohne
Konsole. Deshalb steht Packaging in dieser Liste ganz oben.

---

## A. Auf Windows machbar — jetzt, in dieser Reihenfolge

Sortiert danach, wie viel Mac-Zeit der Punkt spart, nicht nach Aufwand.

### A1. `src.delivery` ins Paket aufnehmen — und einen echten Wheel bauen

`pyproject.toml:25-34` listet Pakete von Hand und lässt `src.delivery` aus.
Bestätigt: `ironmancoach.egg-info/SOURCES.txt` enthält null Treffer für
„delivery". Heute geht es nur, weil der Venv ein Editable-Install ist.

Zu tun:
- `"src.delivery"` ergänzen, besser: Handliste durch
  `[tool.setuptools.packages.find] include = ["src*", "config*"]` ersetzen.
  Die Liste ist schon einmal abgedriftet (`src.bot` gelöscht, `src.ingest`
  und `src.store` gefehlt).
- `tzdata==2025.2` zu `pyproject.toml:10-13` ergänzen. Steht heute nur in
  `requirements.txt:25`. Ohne tzdata schlägt `config/tenant.py:68`
  (`ZoneInfo(...)`) fehl und **jeder** Athlet wird beim Config-Laden abgelehnt.
- Wheel bauen (`pip wheel --no-deps .`), hineinsehen: enthält es
  `src/delivery/feed.py` und `config/coaching_config.toml`?

Ohne diesen Punkt verbrennt man am Mac einen halben Tag mit einem
`ModuleNotFoundError`, dessen Traceback niemand sieht.

### A2. Windows-Probelauf, der die iOS-Umgebung nachstellt

`CLAUDE.md` nennt „Verifizieren in der falschen Umgebung" als bekannte Falle.
Der Probelauf muss die Umgebung reproduzieren, nicht nur den Code ausführen.
Ein Skript (in `tools/`, nicht in `src/`), das:

- die Engine **aus dem gebauten Wheel** in einen frischen Venv installiert,
  nicht editable;
- das Code-Verzeichnis auf schreibgeschützt setzt (Bundle-Simulation) und die
  Daten in ein **getrenntes** Verzeichnis legt (Sandbox-Simulation);
- `sys.stdout = sys.stderr = None` setzt (keine Konsole);
- das Arbeitsverzeichnis auf `C:\` setzt (iOS hat kein sinnvolles cwd);
- keine `.env` bereitstellt, Credentials nur über `os.environ`
  (`config/settings.py:80`);
- `tenant.resolve(id)` + `build_feed(ctx, date)` aufruft und den dict nach
  JSON serialisiert.

Das findet praktisch alles, was sonst erst am Mac auffällt. Vorsicht: es sagt
**nichts** über TLS, Zeitzonendatenbank und Bundler-Verhalten (Abschnitt B).

### A3. Eine unterstützte Funktion zum Umbiegen der Pfade

Heute muss der Host drei Modul-Globals patchen. Der Mechanismus funktioniert
und ist bewiesen — `AthletePaths`-Properties lesen die Globals **spät**, nicht
beim Bauen: `src/utils/paths.py:156`, `:264`, `:290`; genutzt in
`tests/conftest.py:140-142`. Ein bereits erzeugter `TenantContext` folgt einem
späteren Umbiegen.

Zu tun: `paths.configure_roots(data=..., plans=..., reports=..., root=...)`,
die **alle vier** Namen zusammen setzt. Grund: `src/utils/paths.py:72-74`
leitet die drei Bäume **einmalig beim Import** aus `ROOT` ab, während
`SystemPaths` (`paths.py:401-433`) `ROOT` bei jedem Zugriff neu liest. Wer nur
`paths.ROOT` setzt, verschiebt `config/` und `coach.md`, aber **nicht**
`data/`, `plans/`, `reports/` — und merkt es erst an einem stillen
Schreibfehler tief im Ablauf.

Zwei Bindungen folgen einem späteren Patch **nicht** und müssen dokumentiert
werden: `config/settings.py:46` (`ENV_PATH`) und
`src/utils/logging_config.py:48-50` (`LOG_DIR`).

Nebenbei löschen: `src/planning/block_builder.py:52` (`ROOT = paths.ROOT`) ist
tot.

### A4. Eine Funktion `feed_for(athlete_id)`

Heute braucht der Host zwei Schritte und muss das **athletenlokale** Datum
selbst berechnen — nicht das Gerätedatum (`config/tenant.py:60-67`). Die
einzigen id→Ausgabe-Funktionen schreiben Dateien
(`scripts/render_brief.py:40-58`) oder versenden Mail
(`scripts/email_brief.py:44`).

In `src/delivery/feed.py` ergänzen:

```python
def feed_for(athlete_id, report_date=None):
    from config import tenant
    from src.utils.dates import today
    ctx = tenant.resolve(athlete_id)
    return build_feed(ctx, report_date or str(today(ctx.timezone)))
```

Ein Import, ein Aufruf, ein dict. Sonst ändert sich nichts.

### A5. `build_feed` netzwerkfrei machen (Standardfall) — der einzige Absturzkandidat

Kette: `src/delivery/feed.py:213` → `:75` → `src/analysis/brief_context.py:167`
→ `:117` → `src/integrations/intervals_api.py:90`. Auslöser ist allein
`brief_context.py:165` (`block_ledger` existiert) — greift also bei jedem
Athleten, der je einen Block hochgeladen hat. Zeitbudget aus
`config/coaching_config.toml:978-1006`: 4 Versuche × (10 s connect + 30 s read)
+ Backoff ≈ 167 s. `src/utils/http.py:92` (`SLEEP(delay)`) blockiert echt.
**Es gibt keine Gesamt-Deadline**, nur Timeouts pro Versuch.

Zu tun:
- `build_feed(..., allow_network=False)` als Vorgabe, durchgereicht bis
  `get_sessions_for_date`. Das Offline-Verhalten ist bereits definiert
  (`brief_context.py:168-173`) — die Verdrahtung ist klein.
- In `src/utils/http.py` request() eine **Gesamt-Deadline** einbauen, oben in
  jeder Schleifenrunde geprüft. Das Schema erlaubt die Werte schon
  (`config/coaching_config_schema.py:334-338`).
- `ARCHITECTURE.md:106-107` korrigieren („`src/analysis/*` macht keine
  Netzwerkaufrufe" ist falsch). Nach Standing Rule 4 ist das ein zu meldender
  Konflikt, keine stille Korrektur.

### A6. `SystemExit` aus `src/` entfernen

`SystemExit` erbt von `BaseException`. Ein Host mit `except Exception` fängt es
**nicht**; im eingebetteten Interpreter läuft es an der Python-Ebene vorbei und
versucht, den Host-Prozess zu beenden — für den Nutzer verschwindet die App,
für den App Store ist das ein Absturz.

Fundstellen: `src/ingest/pull_service.py:73`;
`src/integrations/intervals_api.py:68`; dreizehn in
`src/planning/block_builder.py` (`:70, :150, :530, :727, :754, :757, :820,
:861, :869, :874, :886, :895, :905`). Mehrere tragen Desktop-Text („run
scripts/pull.py first", `:150`), der in einer App sinnlos ist.

Zu tun: Domain-Exceptions werfen (`DataError` in `src/utils/io_safe.py`,
`ConfigError` existieren), Übersetzung nach `SystemExit` nur im Entry-Point.
Das Muster steht schon in `scripts/analyze.py:45-49`. Bis dahin **muss** der
Host `BaseException` fangen.

**Nicht anfassen:** die `input()`-Zweige in `block_builder.py:751-754` und
`:884-886`. Sie schlagen korrekt **fehl-geschlossen** fehl (nichts wird
genehmigt, nichts hochgeladen) und sind durch D8/D14 und Standing Rule 1
gedeckt. Blockplanung in der App braucht einen **zusätzlichen** Einstiegspunkt,
der die getippte Freigabephrase als Argument nimmt — nicht das Entfernen des
Gates.

### A7. Fünf `date.today()` auf dem Startpfad reparieren

`config/coaching_config_schema.py:711, 736, 746, 762, 780` in
`_check_cross_field_sanity`, aufgerufen aus `validate_raw` (`:943`), das bei
**jedem** `tenant.resolve` läuft und bei Problemen `ConfigError` wirft (`:949`).

Konkreter Ausfall: Athlet mit Zeitzone Pacific/Auckland, Gerät in Berlin. Ein
korrektes `anchor_date` wird als „in der Zukunft" abgelehnt, `tenant.resolve`
kehrt nie zurück, die App kann **gar keinen** Feed bauen. Der Fehler kommt und
geht mit Reisen und reproduziert sich auf keinem Entwicklertisch.

Die Funktion hat die Lösung schon in Reichweite: `timezone_name` bei `:462`,
`ZoneInfo(...)` bereits validiert bei `:470`. Ein Referenzdatum daraus
berechnen, alle fünf Stellen ersetzen.

### A8. Cadence-Banner parametrisierbar machen

Sonst führt **jeder** Feed auf dem Telefon mit einem roten „SCHEDULED JOB NOT
RUNNING". Kette: `src/delivery/feed.py:58-71` → `src/utils/health.py:204`
(`CADENCE_HOURS = dict(CONFIG["cadence"])`) gegen
`config/coaching_config_schema.py:357-362` (`pull, analyze, data_quality,
email_brief`). Ohne Heartbeat: ALARM/NEVER_RAN (`health.py:242-248`). Im
Probelauf bestätigt. `feed._warnings` hat **keine** Neu-Athleten-Ausnahme — die
gibt es nur im Brief-Pfad (`brief_context.py:274-275`).

`health.cadence_banner` nimmt bereits ein `cadence`-Argument (`health.py:291`).
Nur bis `feed._warnings(ctx, cadence=...)` hochreichen. **Nicht** durch
gefälschte Heartbeats lösen — das macht aus einer Strukturlücke eine Lüge, und
D15s Alarm soll etwas bedeuten.

### A9. Heartbeats in die Services verschieben

Drei von vier Heartbeat-Schreibvorgängen stehen in Skripten, nicht in
Services: `scripts/pull.py:64-65`, `scripts/data_quality.py:62-63`,
`scripts/email_brief.py:115`. Nur analyze macht es richtig
(`src/analysis/analyze_service.py:141-142, 252-253`).

Folge: Selbst eine App, die `pull_service.run(ctx)` **direkt** aufruft, bekommt
weiter „pull has NEVER run" in jedem Feed. Verschieben — dann stimmt die
Frische-Meldung für jeden In-Process-Aufrufer von selbst.

### A10. `as_of` durch `build_feed` durchreichen

`src/delivery/feed.py:181` und `:186` reichen kein `as_of` weiter, obwohl beide
Funktionen es annehmen (`brief_context.py:64`, `brief.py:80`) und der
Prosa-Zwilling es tut (`brief.py:585, 595`). Ohne `as_of` endet die Spine an
der Wanduhr (`src/analysis/pmc.py:158-160`).

Folge in der App: Beim Zurückblättern sagt `date` 2026-08-12, während
`headline.as_of_date`, `recovery` und `watch` den heutigen Tag beschreiben.
Innerhalb desselben Dokuments (`feed.py:217-218` respektieren `target`,
`:157-176` nicht). Additive Änderung, bestehende Aufrufer bleiben.

### A11. CA-Bundle explizit + vier Handler erweitern

Fehlt `certifi/cacert.pem` im Bundle, kommt ein roher `OSError` aus
`requests/adapters.py:329-335` — **außerhalb** des try-Blocks, der OSError
sonst in `ConnectionError` übersetzt. Und `RequestException` ist eine
**Unterklasse** von `OSError`, also fängt
`except (requests.RequestException, http.HttpError)` es nicht. Ergebnis: der
Degradationspfad in `brief_context.py:168` (der genau dafür existiert) wird
umgangen, der Athlet bekommt gar keinen Feed statt des lokalen Entwurfs.

Zu tun auf Windows:
- `kwargs.setdefault("verify", CA_BUNDLE_PATH)` neben das vorhandene
  Timeout-setdefault in `src/utils/http.py:78`, Pfad vom Host.
- Die vier Handler um `OSError` erweitern: `src/analysis/brief_context.py:168`,
  `src/planning/block_builder.py:634, 698, 834`.
- Eine Startprüfung, die die Existenz der Datei feststellt, statt bis zum
  ersten HTTPS-Request zu warten.

### A12. Pure-Python-Abhängigkeiten erzwingen und prüfen

`charset_normalizer` lädt zwei `.pyd`. Reine Python-Fallbacks liegen daneben
(`cd.py`, `md.py`), aber das muss eine Entscheidung sein:
`pip install --no-binary charset_normalizer -r requirements.txt`. Danach eine
Build-Prüfung, die fehlschlägt, wenn irgendwo unter dem gebündelten
site-packages eine `.so`/`.pyd` liegt.

### A13. Kleinere Punkte, alle billig

- `src/utils/http.py:68-73`: `_log_retry` **loggt nicht**, es macht nur
  `print(..., file=sys.stderr)`. Ohne Konsole geht die Meldung ersatzlos
  verloren (kein Absturz — `print` mit `file=None` ist ein stiller No-Op). Ein
  `log.warning` daneben. Das ist auf dem Telefon das Signal, das man am
  dringendsten braucht.
- `config/coaching_config_schema.py:790-793` liest die TOML mit
  `open(Path(__file__).parent / ...)`. Auf `importlib.resources` umstellen —
  funktioniert in beiden Layouts und entschärft den Zip-Fall vorsorglich.
  `importlib.resources` ist heute in `src/` und `config/` **komplett abwesend**.
- `src/planning/block_builder.py:446`: einziges naives `datetime.now()` in
  `src/`. Auf UTC umstellen (`src/utils/dates.py:113` existiert dafür). Nicht
  auf dem Feed-Pfad, aber sobald Planung in der App auftaucht, stehen in einem
  Datensatz zwei Uhren ohne Beschriftung.
- `config/coaching_config_schema.py:472`: Meldung so erweitern, dass
  „unbekannter Zeitzonenname" von „keine Zeitzonendatenbank vorhanden"
  unterscheidbar wird. Sonst diagnostiziert die App eine fehlende tzdata als
  Config-Fehler des Athleten.
- Fehlende `athlete_config.toml` meldet sich heute als **dreizehn**
  Fehlerzeilen über die **gemeinsame** Config
  (`coaching_config_schema.py:837-838` → `:949-950`). Für einen App-Entwickler
  die denkbar schlechteste erste Fehlermeldung.
- `coach.md`, `knowledge/`, `training_philosophy.md` liegen im Repo-Root und
  werden **nicht** gepackt (`pyproject.toml:36-37` packt nur `config/*.toml`).
  Nicht auf dem Feed-Pfad, aber jedes spätere Planungsfeature trifft auf
  `src/planning/block_builder.py:140` → `:68-71`, das `SystemExit` wirft.
- `tools/` **nicht** ins iOS-Target aufnehmen:
  `tools/synthetic_athletes.py:51` und `tools/synthetic_configs.py:16`
  enthalten `TODAY = date(2026, 8, 9)`.

---

## B. Braucht wirklich den Mac — aus dem Code nicht beantwortbar

Diese Punkte sind **Experimente**, keine Aufgaben. Sie sollten am Mac-Tag als
Erstes und einzeln beantwortet werden.

1. **Was kopiert der Bundler?** Die gesamte Portierung hängt daran, ob die
   Pipeline Nicht-`.py`-Dateien mitnimmt: `config/coaching_config.toml`,
   `certifi/cacert.pem` (~300 KB), `tzdata/zoneinfo/*` (~600 Binärdateien).
   Alle drei werden über `importlib.resources` bzw. `__file__` geladen, alle
   drei scheitern **zur Laufzeit**, nicht beim Bauen. Prüfen: nicht „importiert
   das Paket?", sondern „existiert `tzdata/zoneinfo/Europe/Berlin` als Datei?".
2. **Zip oder Verzeichnis?** Wenn der Python-Code als Zip/frozen ausgeliefert
   wird, wird `config/coaching_config_schema.py:36` von FRICTION zu BLOCKER —
   `open(Path(__file__).parent / ...)` kann nicht in ein Zip hineinlesen. A13
   entschärft das vorab.
3. **Hat der iOS-CPython-Build `_ssl`?** Aus dem Repo nicht feststellbar. Wenn
   nein, fällt der gesamte requests-Pfad weg und der Swift-Bridge-Weg wird
   Pflicht statt Option.
4. **Ist `/usr/share/zoneinfo` aus der App-Sandbox lesbar?** Nicht feststellbar.
   Auf dieser Maschine ist `zoneinfo.TZPATH == ()` — das Projekt läuft heute
   schon **ausschließlich** über das tzdata-Paket, nie über eine
   System-Datenbank. tzdata mitzuliefern macht die Frage gegenstandslos;
   deshalb ist das die Empfehlung und nicht der Notfallplan.
5. **Was ist `sys.stderr` im eingebetteten Interpreter?** None, ein Objekt ohne
   `reconfigure`, oder etwas Drittes. Der Code ist gegen alle drei robust
   (`src/utils/logging_config.py:95-98` nutzt `getattr`), aber das Verhalten
   bestimmt, wohin Diagnose überhaupt gehen kann.
6. **Was passiert wirklich, wenn `SystemExit` den Host erreicht?** Bis A6
   erledigt ist, muss der Host `BaseException` fangen. Danach als
   Regressionstest einmal absichtlich auslösen.
7. **Kaltstartkosten des Imports.** `config/coaching_config_schema.py:1067`
   liest und **validiert** die gesamte TOML beim Import, dazu kommen
   `requests`/`ssl`/`certifi`. Auf welchem Thread und wie lange — nur auf Gerät
   messbar. Empfehlung: einmal beim App-Start im Hintergrund importieren und
   `ConfigError` als Setup-Screen zeigen.
8. **`sys.platform == "ios"`** — nach PEP 730 wird der `darwin`-Zweig in
   `Lib/urllib/request.py:2033-2034` übersprungen, es gibt also kein
   `_scproxy`-Problem. Aus dem Stdlib-Quelltext gelesen, auf Gerät einmal
   bestätigen.
9. **Zeitbudget in der Realität.** Ob 5 s oder 8 s Gesamt-Deadline richtig
   sind, entscheidet Mobilfunk, nicht Code.

---

## C. Verifiziert CLEAN — nicht erneut untersuchen

Jede Zeile wurde durch Lesen (mehrfach durch Ausführen) belegt. Wer hier
nochmal gräbt, verbrennt Zeit.

- **`build_feed` gibt einen echten, JSON-serialisierbaren dict zurück** —
  `src/delivery/feed.py:179-222`, gegen `syn_veteran` ausgeführt.
- **Der Feed braucht weder einen vorherigen `analyze`- noch `pull`-Lauf.** Die
  Spine wird im Speicher gerechnet (`src/analysis/brief.py:80-97`,
  `brief_context.py:77`).
- **`build_feed` schreibt nichts.** Der Schreibvorgang ist der separate Wrapper
  `build_and_store` (`feed.py:231-235`).
- **Pfad-Objekte lesen die Modul-Globals spät**, ein fertiger Context folgt
  einem späteren Umbiegen — `src/utils/paths.py:156, 264, 290`; bewiesen in
  `tests/conftest.py:140-142`.
- **Atomares Schreiben ist sandbox-korrekt**: Temp-Datei ist Geschwister der
  Zieldatei (`src/utils/io_safe.py:28, 34`).
  `tempfile`/`gettempdir`/`mkstemp` kommen im Projekt **nirgends** vor.
- **Nichts löst Pfade relativ zum cwd auf.** `os.getcwd`/`Path.cwd`/`os.chdir` —
  null Treffer in `src`, `config`, `tools`, `scripts`.
- **`log_event` wirft nie**, auch nicht bei schreibgeschütztem `logs/` —
  `src/utils/logging_config.py:155-163`.
- **Credentials brauchen keine `.env`.** `os.environ` gewinnt
  (`override=False`, `config/settings.py:80, 166`). Der Host setzt den Key aus
  der Keychain vor `tenant.resolve`. Einziger Rest: der Hinweistext
  `settings.py:151` nennt einen Bundle-Pfad.
- **Genau ein HTTP-Einstiegspunkt**: `src/utils/http.py:83`. Kein zweiter Stack
  — `urllib`, `http.client`, `httpx`, `aiohttp`, `socket`, `ssl` werden in
  `src`/`config` nirgends importiert. Nur HTTPS, ein Host
  (`src/integrations/intervals_api.py:22`), null `http://`.
- **Keine Proxy-, Keychain- oder OS-Truststore-Annahme.** Und: **nicht** auf
  `truststore` oder `verify=True` „verbessern" — beides bricht auf iOS.
- **Nur zwei Fremdpakete in `src`/`config`**: `requests` und `dotenv`
  (AST-Analyse aller 52 Dateien, kein Regex). Beide deklariert.
- **Null dynamische Importe in `src`/`config`.** `importlib`, `__import__`,
  `runpy`, `exec(`, `eval(` — keine Treffer. Die Import-Analyse ist also
  vollständig.
- **`smtplib` ist von `build_feed` aus nicht erreichbar** — nur
  `src/delivery/email_brief.py:24`, und `src/delivery/__init__.py` importiert
  nichts.
- **`sqlite3` ist nicht auf dem Live-Pfad** — `src/store/__init__.py:26-31`
  exportiert nur den JSON-Backend.
- **Import-Nebenwirkungen sind reine Lesevorgänge** — ein TOML-Read, kein
  `mkdir`, keine Logging-Handler, kein Netzwerk.
- **Python-Untergrenze 3.11** (`pyproject.toml:9`), gebunden durch `tomllib`.
  PEP 730 verlangt 3.13+ — passt.
- **Kein Windows-Branching, keine Windows-Pfadliterale.** `os.name`,
  `sys.platform`, `ntpath`, Laufwerksbuchstaben: alle abwesend aus
  `src`/`config`. Die Konsolen-Encoding-Fixes sind `getattr`-geschützt und
  damit None-sicher (`src/utils/logging_config.py:95-98`).
- **Kein `schtasks` im Code.** Der 05:30-Job ist vollständig extern; auf iOS
  ersetzt ihn BGTaskScheduler mit derselben Sequenz (`scripts/run_daily.py:48`).
- **Datumsarithmetik läuft auf `date`-Objekten, nie auf aware datetimes** — DST
  kann keinen Tag verschlucken (`src/analysis/pmc.py:50-62` und ~14 weitere
  Stellen).
- **Frische/Staleness rechnet ausschließlich in UTC**
  (`src/utils/health.py:48-49, 105-115`). Ein Gerätewechsel der Zeitzone kann
  Daten nicht frisch erscheinen lassen.
- **Kein fest verdrahtetes Datum in `src/`.** Die zwei eingefrorenen Konstanten
  liegen in `tools/` (siehe A13).

---

## Empfohlener Endzustand (nicht für den ersten Versuch)

HTTP an Swift `URLSession` abgeben. Der Code ist dafür ungewöhnlich bereit:
**ein** Seam (`src/utils/http.py:76`), **fünf** genutzte Response-Member
(`.status_code`, `.headers`, `.json()`, `.raise_for_status()`), **vier**
Catch-Stellen (`brief_context.py:168`, `block_builder.py:634, 698, 834`). Das
entfernt `requests`, `urllib3`, `certifi`, `charset_normalizer`, `idna` aus dem
Bundle, löst das CA-Packaging-Risiko und das Blockier-Problem auf einmal statt
sie zu tunen.

Ausdrücklich **nicht** tun: auf Stdlib-`urllib` umsteigen, um Abhängigkeiten zu
sparen. `ssl.create_default_context` lädt OpenSSLs einkompilierte Pfade
(`Lib/ssl.py:528-534`), die es in einer iOS-Sandbox nicht gibt — leerer
Truststore, jeder HTTPS-Request scheitert. Man bräuchte trotzdem eine
gebündelte `.pem` und verlöre Retry-, Auth- und Timeout-Ergonomie, die hier
bereits richtig ist.
