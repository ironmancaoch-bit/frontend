# Arbeitsliste bis zum Mac-Tag

*Erzeugt 2026-08-19 aus acht parallelen, rein lesenden Prüfungen gegen den
aktuellen Engine-Stand `459e7f5` (Session 024, Phase P abgeschlossen).*

*60 Punkte geprüft: 1 inzwischen erledigt, 59 offen, davon 17 im alten Plan nicht enthalten.*

*Ersetzt [IOS_PORTING_PLAN.md](IOS_PORTING_PLAN.md), der gegen den alten
Strang `0ea39fd` geschrieben wurde. Weder Engine noch Original wurden
dabei verändert.*

---

**Engine:** `C:\Users\benle\IronmanCoach_work` @ `459e7f5` · **App:** `C:\Users\benle\ironmancoach-app` · Stand geprüft 2026-08-18, alles read-only.

---

## 1. Was sich seit dem alten Plan geändert hat

**Die gute Nachricht zuerst: der Plan altert kaum.** Die Dateien, um die A1–A13 gehen (`paths.py`, `tenant.py`, `settings.py`, `logging_config.py`, `feed.py`, `brief_context.py`, `http.py`, `intervals_api.py`, `pull_service.py`, `coaching_config_schema.py`, `new_athlete.py`, `config_scope.py`, `roster.py`, `pyproject.toml`) sind gegenüber der Planbasis **byte-identisch**. Die 98 geänderten Dateien sind fast vollständig `docs/` und `tests/`. Phase P war eine Personendaten-Bereinigung, kein Umbau.

**Drei Zeilennummern im Plan sind falsch** und nur diese drei: A3-Beleg `tests/conftest.py:140-142` → heute **`:225-227`**; `build_feed` `feed.py:213` → heute **`:179`**; A13.4 `:472` → heute **`:471/473`**.

**ERLEDIGT — spart Arbeit:**
- **A2.3 (Credentials nur über `os.environ`)** braucht keinen Code. `config/settings.py:80` liest `os.environ`, `:166` ruft `load_dotenv(ENV_PATH, override=False)` erst *innerhalb* von `resolve_credentials()`, nie beim Import; fehlende Datei ist ein No-op. Einzige Auflage: keine `.env` neben dem installierten Paket.
- **Die Suite läuft ohne echten Athleten.** `tests/conftest.py:56` `SUITE_ATHLETE_ID = "syn_veteran"`, `:81` `live_ctx` für die 19 Install-Tests, CI deselektiert über `@pytest.mark.live_athlete`. Das war die eigentliche Vorbedingung für „Engine auf fremdem Gerät" — sie ist erfüllt.
- **Die 36 ATHLETE-Keys in `src/intake.ts` stimmen 1:1**, inklusive Reihenfolge und Inhalt der 13 Schwellen. Nicht anfassen.
- **A6 (`SystemExit` aus `src/`) ist kein Blocker mehr** für ein Feed-MVP: keine der 15 Fundstellen liegt auf dem `build_feed`-Pfad (`feed.py:16-38` importiert weder `planning` noch `ingest`; `brief_context.py:115-116` prüft den Key selbst statt `require_api_key`). A6 rutscht ans Ende.
- **A13.6 halbiert sich:** `SYSTEM.knowledge_dir` (`paths.py:427-429`) und `training_philosophy_md` (`:431-433`) haben **null Aufrufer**. Nur `coach.md` liegt auf einem Codepfad (`block_builder.py:140`).
- **A13.7** ist folgenlos, solange installiert statt kopiert wird: `tools/` ist in `pyproject.toml:25-34` gar nicht als Paket gelistet.

**NEU, im Plan nicht enthalten:**
- **Der Alert-Vertrag hat sich geändert** (`aad48a1`). `contract.py:404-407`: ein Breach wird **nie** zurückgehalten, `watch.items` kann also >2 sein. Die frisch erzeugten Fixtures zeigen es bereits: `items=2, held_back=4`. **Drei Stellen sind dadurch falsch:** `CLAUDE.md:48`, `docs/feed_schema.md:126`, `ironmancoach-app/src/feed.ts:267`.
- **GAP-13 bestätigt, nicht behoben.** `brief_context.py:192` `return [], "unplanned"` → `feed.py:86-88` liefert `source: "unplanned"` mit `source_meaning` von `"none"`. Nachweisbar in `src/fixtures/feed_veteran.json` und `feed_sparse.json`.
- **`profile.template.md` hat zwei neue Abschnitte** (`:54` „How you want to be coached", `:64` „Principles specific to you"), die seit D66 nirgendwo sonst stehen und die das Onboarding nicht erhebt.
- **Gemessen:** ein unausgefülltes Profil liefert `(18, 22)` statt UNKNOWN — Verstoß gegen Standing Rule 3, siehe E12.
- **Jede SHA-Referenz auf `0ea39fd` ist tot** (D67 hat die History ersetzt). Ein Submodule-Pin oder Commit-Zitat im App-Repo wäre nicht auflösbar. Lesbarer Ersatz nur `docs/log/commit_messages.md`.
- **Zwei Commits ohne Session-Log:** `aad48a1`, `459e7f5`. `docs/log/INDEX.md` endet bei 024, `CURRENT_STATE.md:7` nennt HEAD `8ac1e59`. Standing Rule 11 ist offen.
- **`CLAUDE.md:80` ist stale:** „next number D67" — D67 existiert bereits (`docs/DECISIONS.md:2497`). Nächste freie Nummer ist **D68**.

---

## 2. ENGINE — auf Windows, in der Arbeitskopie

Geordnet nach Wirkung auf den Mac-Tag. E1–E6 machen den Mac-Tag überhaupt erst zu einem Messtag; E7–E11 verhindern, dass dort Zeit mit Symptomen verbrannt wird.

### E1 — Paketliste reparieren **und** gegen Abdriften sichern
`pyproject.toml:25-34` listet acht Pakete, **`src.delivery` fehlt** — also `feed.py`, also `build_feed`, also genau die Funktion, die die App aufruft. Warum es heute grün aussieht: `.venv\Lib\site-packages\__editable___ironmancoach_1_0_0_finder.py:9` mappt **Verzeichnisse** (`{'config': …, 'src': …}`), nicht die Paketliste. Gegenprobe: `ironmancoach.egg-info\SOURCES.txt` und die `RECORD` des Dist-Info enthalten **null** Treffer für `delivery`.

Strittig: Handliste ergänzen oder ersetzen.
- *Ergänzen* ist ein Wort, ändert aber nichts daran, dass nichts die Liste prüft.
- *Ersetzen* durch `[tool.setuptools.packages.find] include = ["src*", "config*"]`.

**Empfehlung: ersetzen.** `pyproject.toml:21-24` dokumentiert selbst, dass die Liste schon zweimal abgedriftet ist (`src.bot` blieb nach D38/D42 stehen, `src.ingest`/`src.store` fehlten von Anfang an). Dazu ein CI-Schritt: `.github/workflows/ci.yml:58` installiert heute nur `requirements.txt` — ein `pip install .` plus `python -c "from src.delivery.feed import build_feed"` hätte den Fehler gefunden.

### E2 — `tzdata` in die Wheel-Metadaten
`pyproject.toml:10-13` listet nur `requests` und `python-dotenv`. `tzdata==2025.2` steht nur in `requirements.txt:25`. Ein `pip install <wheel>` zieht damit keine Zeitzonendatenbank — und `config/tenant.py:68` `return ZoneInfo(self.config["athlete"]["timezone"])` liegt im Ladepfad **jedes** Athleten. Auf dieser Maschine ist `zoneinfo.TZPATH == ()`, das Projekt läuft also schon heute ausschließlich über das Paket.

### E3 — `configure_roots(...)` in `src/utils/paths.py`
Die eine Naht. `paths.py:64` `ROOT = Path(__file__).resolve().parent.parent.parent`; `:72-74` leiten `DATA_ROOT`/`PLANS_ROOT`/`REPORTS_ROOT` **einmalig beim Import** daraus ab. `SystemPaths` (`:399-433`) liest `ROOT` dagegen bei jedem Zugriff. Read-only nachgestellt: nach `paths.ROOT = /tmp/ios` zeigte `config_dir` auf `\tmp\ios\config`, `data_dir` aber weiterhin auf `C:\…\IronmanCoach_work\data\athletes\default`. **Genau der stille Schreibfehler.** Erst nach Setzen aller vier Namen zogen alle drei Bäume mit.

Die Funktion muss zusätzlich mitsetzen — oder ausdrücklich als *nicht folgend* dokumentieren:
- `config/settings.py:46` `ENV_PATH = paths.ROOT / ".env"` (Import-Zeit)
- `src/utils/logging_config.py:48-50` `LOG_DIR` / `RUN_LOG_PATH` / `EVENTS_PATH`
- `src/analysis/report.py:33` `ROOT = paths.ROOT` — **lebendig**, dient als `cwd` für `subprocess.run(['git', …])` (`:503-505`)

**Korrektur am Plan:** er behauptet, `paths.ROOT` zu setzen verschiebe „`config/` und `coach.md`". Für `coach.md` stimmt das. Die tatsächlich gelesene Config hängt **nicht** an `ROOT`, sondern an `config/coaching_config_schema.py:36` `CONFIG_PATH = Path(__file__).resolve().parent / "coaching_config.toml"`. `SYSTEM.coaching_config`, `SYSTEM.env_file`, `SYSTEM.knowledge_dir`, `SYSTEM.training_philosophy_md` haben **null Aufrufer** — tot. `configure_roots` darf nicht suggerieren, es könne die Config verschieben (für iOS ist das günstig: sie bleibt im Read-only-Bundle, wo sie hingehört).

Der Ort ist vorgezeichnet: `tests/test_paths.py:69-73` verlangt bereits, dass `data/`, `plans/`, `reports/`, `logs/` **nur** über `paths.py` erreicht werden. Nebeneffekt: mindestens 12 Testdateien patchen heute drei Globals einzeln (`conftest.py:225-227`, `test_block_plan.py:70-72`, `test_day_one.py:28-30` …).

### E4 — Ein Einstiegspunkt, der aus einer Id ein dict macht
`src/delivery/feed.py` hat genau zwei öffentliche Funktionen: `:179 build_feed(ctx, report_date)` und `:231 build_and_store(...)`. Ein Aufrufer braucht heute zwei Schritte plus eigene Datumsrechnung (Vorbild `scripts/render_brief.py:44-52`), und der einzige Id→Ausgabe-Weg **schreibt Dateien**.

Neu: `feed_for_athlete(athlete_id, report_date=None)` → `tenant.resolve(id)` → `str(today(ctx.timezone))` → `build_feed`. Kein Schreiben; `build_feed:204-222` baut ein reines dict-Literal, die einzige Schreibstelle ist `:234`.

**Nicht `feed_for` nennen.** Der Name existiert bereits als `AthletePaths.feed_for` (`paths.py:308-314`) und liefert einen **Pfad** — und wird ausgerechnet in `feed.py:235` aufgerufen. Zwei `feed_for` mit entgegengesetztem Rückgabetyp in derselben Datei.

Das Datum muss **athletenlokal** sein (`ctx.timezone`), nicht das Gerätedatum. Das Gerät reist, der Athlet nicht.

### E5 — Erstlauf: die Meldung, die auf iOS nicht reparierbar ist
Gemessen: `load_config(athlete_id='nosuchathlete_xyz')` liefert **14 Zeilen**, die alle `coaching_config.toml` beschuldigen — eine Datei, die auf iOS read-only im Bundle liegt. Ursache: `coaching_config_schema.py:837-838` `if not override_path.exists(): return frozenset()` — die fehlende Athletendatei wird still übergangen, erst `validate_raw` schlägt danach an. Ein *ungültiger* Id wird seit D32 sauber gemeldet (`:834`), ein *gültiger Id ohne Partition* nicht.

Der brauchbare Weg existiert und wirft nicht: `paths.known_athlete_ids()` → `[]` (`paths.py:376-379`), `roster.active(kind=REAL)` → `[]`. **Empfehlung: beides** — der Host prüft vorher, *und* `tenant.resolve` bekommt ein eigenes `AthleteNotFoundError`. Der Fehler gehört in die Engine, nicht in die Bridge.

### E6 — Ein Probelauf-Skript, das die iOS-Umgebung festschreibt
Existiert nicht. `tools/` enthält zehn Dateien, keine stellt eine Ausführungsumgebung nach. Probeläufe gab es (Session 011/012, „clean-clone rehearsal") — von Hand, und genau daraus stammt die Falle in `CLAUDE.md`: *„Verifizieren in der falschen Umgebung."*

**Wichtig, im Plan nicht gesehen:** `sys.stdout = sys.stderr = None` greift auf dem Feed-Pfad ins Leere. `grep "print(" src/delivery/ src/analysis/brief.py src/analysis/brief_context.py src/analysis/analyze_service.py` → **null Treffer**; die 66 `print()` in `src/` sitzen im Pull und im Block-Builder. Das Skript muss deshalb **zwei Läufe** machen: `build_feed` (der eingebettete Pfad) und mindestens einen Skript-Einstiegspunkt (`scripts/run_daily.py` oder `scripts/pull.py`). Sonst meldet es Grün, ohne die 66 Stellen je berührt zu haben.

Prüfliste des Skripts, im frischen Venv nach `pip install <wheel>`:
```
python -c "from src.delivery.feed import build_feed"          # E1
python -c "from src.utils import paths; print(paths.ROOT, paths.DATA_ROOT)"   # E3/A1.5
python -c "import zoneinfo; zoneinfo.ZoneInfo('Europe/Berlin')"               # E2
```
Der mittlere Punkt ist der, den A1s Abnahmekriterium heute übersieht: nach einem Wheel-Install zeigt `ROOT` auf `site-packages\`, und damit `DATA_ROOT` in ein Verzeichnis, das auf iOS schreibgeschützt ist.

### E7 — Fünf `date.today()` auf dem Startpfad
`config/coaching_config_schema.py:711, 736, 746, 762, 780`, alle in `_check_cross_field_sanity` (ab `:455`), aufgerufen aus `:943`, aufgerufen aus `tenant.py:93` — bei **jedem** `resolve`. Ausfall: Athlet in `Pacific/Auckland`, Gerät in Berlin → ein korrektes `anchor_date` gilt als „in der Zukunft", `resolve` wirft `ConfigError`, kein Feed. Die Lösung liegt in derselben Funktion: `timezone_name` bei `:462`, `ZoneInfo(timezone_name)` bereits validiert bei `:470`.

**Zusatzbedingung, die der Plan nicht kennt:** `validate_raw` läuft seit D32 auch **ohne Athlet** (`load_system_config`, `:1003`), und `_check_cross_field_sanity` ist laut Docstring (`:899-901`) bewusst nicht scope-aware. Dort ist `[athlete]` nicht vorhanden, `timezone_name` also `None`. Wer das Referenzdatum blind aus `values['athlete']['timezone']` zieht, tauscht einen Reise-Bug gegen einen **Import**-Bug. Expliziter Fallback nötig (UTC oder Prüfung überspringen).

### E8 — `build_feed` netzfrei, und der Retry-After-Deckel
Kette unverändert: `feed.py:179` → `:75 get_sessions_for_date` → `brief_context.py:165` (`if JsonFileStore(ctx.paths).exists("block_ledger")`) → `:117` → `intervals_api.py:90`. Auslöser ist allein die Existenz von `block_ledger`, also jeder Athlet, der je einen Block hochgeladen hat. Einen `allow_network`-Schalter gibt es nicht. Das Offline-Verhalten steht dagegen fertig da: `brief_context.py:168` fängt, `:173` liefert den Draft.

Zeitbudget aus der heutigen `coaching_config.toml` nachgerechnet: `:979` connect 10 s, `:985` read 30 s, `:991` 4 Versuche, `:997` Backoff-Basis 1.0 s → 4×40 s + 5,25–8,75 s Jitter ≈ **167 s**.

**Neu und schlimmer:** 167 s ist die *Untergrenze* des schlimmsten Falls. `http.py:95-101` übernimmt ein vom Server gesendetes `Retry-After` **ungedeckelt** — der `else`-Zweig ersetzt den gedeckelten Backoff vollständig, `BACKOFF_MAX_SECONDS` wird nie angewandt. `Retry-After: 300` → dreimal 300 s → **~18 Minuten blockierter Aufruf**. Im Vordergrund ein eingefrorener Feed, im Hintergrund ein vom Watchdog getötetes Task. Sofortmaßnahme: `min(delay, BACKOFF_MAX_SECONDS)`. Sauber: eine Gesamt-Deadline in `http.py:79` (die Schleife prüft heute nur den Versuchszähler). Achtung Aufwand: ein neuer Config-Schlüssel braucht **drei** Deklarationen (`coaching_config_schema.py:333-338`, `config_scope.py:304-310`, `coaching_config.toml:978-1006`) — `:945` weist unbekannte Abschnitte zurück.

Im selben Griff mitnehmen: `brief_context.py:115-116` gibt bei fehlendem API-Key `[]` zurück, die Quelle bleibt aber `"calendar"` → `feed.py:86-88` liefert `source: "calendar"` mit `source_meaning: "no plan exists for this day"`. Der Feed widerspricht sich in derselben Zeile. Auf iOS ist das der **Normalfall beim ersten Start** (Key noch nicht in der Keychain).

### E9 — Cadence-Banner, und die fehlende Neu-Athleten-Ausnahme
`feed.py:58 def _warnings(ctx)` hat keinen `cadence`-Parameter, `:63` ruft `health.cadence_banner(entries)` ohne ihn. Die Gegenseite ist bereit: `health.py:291 def cadence_banner(health, now=None, cadence=None)`, Fallback ist das beim Import gelesene `CADENCE_HOURS` (`:204`). Ohne Heartbeat → `NEVER_RAN` (`:245-247`) → jeder Feed auf dem Telefon führt mit `🚨 SCHEDULED JOB NOT RUNNING` (`:303`). `[cadence]` ist SYSTEM-scoped (`config_scope.py:328`), der Host darf es setzen, ohne Athleten-Config anzufassen. **Nicht mit gefälschten Heartbeats lösen.**

**Billiger als gedacht:** der Feed weiß bereits, dass der Athlet neu ist — `feed.py:211 "new_athlete": is_new_athlete(ctx)`, und `is_new_athlete` ist in `feed.py:34` schon importiert. Der Brief-Pfad hat die Ausnahme (`brief_context.py:274-275`), `_warnings` nicht. Heute steht `new_athlete: true` neben einer Warnung `scheduled_job_not_running` — ein Widerspruch **innerhalb desselben Dokuments**. Der Fix ist eine Zeile und wirkt unabhängig vom `cadence`-Parameter.

### E10 — `as_of` durchreichen, plus der Test, der es festhält
`feed.py:179/181/186` reicht kein `as_of` weiter, obwohl `gather_series` (`brief_context.py:64`) und `daily_metrics` (`brief.py:80`) es annehmen und der Prosa-Zwilling es durchreicht (`brief.py:597/614`). Ohne `as_of` endet die Spine an der Wanduhr (`pmc.py:154`, `:157`). Ergebnis: `date`, `yesterday`, `week` folgen `report_date`, während `headline`, `recovery` und `watch` **heute** beschreiben. Änderung additiv (`as_of=None`), bestehende Aufrufer bleiben.

Der Widerspruch ist durch **keinen Test** gedeckt — deshalb ist er 98 Dateien lang unbemerkt geblieben. Alle sieben `build_feed`-Aufrufe in `tests/test_feed.py` (`:18, 28, 39, 62, 78, 107, 117`) nutzen dasselbe Datum, und `:80-85` prüft nur Null-Konsistenz. Ein Test „`build_feed` mit einem Datum in der Vergangenheit → `headline.as_of_date` nicht später als `document['date']`" schlägt heute fehl und ist der billigste Wirknachweis.

### E11 — Heartbeats in die Services, **beide** Zweige
Drei von vier Schreibvorgängen stehen in `scripts/`, nicht in den Services: `scripts/pull.py:64`, `scripts/data_quality.py:62`, `scripts/email_brief.py:115`. `src/ingest/pull_service.py` importiert `health` überhaupt nicht. Eine App, die `pull_service.run(ctx)` direkt aufruft, bekommt „pull has NEVER run" in jeden Feed. Auf dem Desktop fällt es nicht auf, weil `run_daily.py:61-63` die **Skripte** importiert.

**Auch `analyze` macht es nur zur Hälfte richtig:** der Erfolgs-Heartbeat steht im Service (`analyze_service.py:174, :292`, beide `health.OK`), der **Fehler**-Heartbeat im Skript (`scripts/analyze.py:60`). Ein In-Process-Aufrufer schreibt bei `DataError` gar nichts — ein Fehlschlag sieht aus wie „wurde nie gestartet". Beim Verschieben: `scripts/pull.py:53-54` fängt bewusst `BaseException`, damit auch ein `SystemExit` aufgezeichnet wird. Das Verhalten darf nicht verlorengehen.

### E12 — `profile.template.md:10` entschärfen (Ein-Zeilen-Fix, Standing Rule 3)
`tools/new_athlete.py:196` schreibt das Template **wortwörtlich** als `profile.md`. Das Template erklärt seine eine maschinengelesene Zeile mit einem **echten Zahlenbeispiel**:
```
config/profile.template.md:10   - Training hours available: **~18–22 hours/week**
config/profile.template.md:35   - Training hours available: **~X–Y hours/week**   ← matcht nicht
```
`block_builder.py:105` nutzt `re.search` — erster Treffer gewinnt. Gemessen: unausgefülltes Template → `(18, 22)`. Das Template verspricht auf `:14-15` das Gegenteil, und der Docstring bei `:86-92` erklärt ausdrücklich, dass genau dieser Fallback als *„invented athlete data"* entfernt wurde. Er ist über das Template zurückgekommen. Fix: Zahlen im Erklärtext durch Platzhalter ersetzen oder `hours/week` dort weglassen.

### E13 — Drei Vertragsentscheidungen, kein Code (aber vor dem Mac)
Standing Rule 4: melden, nicht still eine Seite wählen. Alle drei brauchen eine Nummer ab **D68**.

1. **`unplanned`.** `brief_context.py:192` emittiert es, `feed.py:43-49` kennt es nicht. Entweder ins Schema (+ `SOURCE_MEANING`-Eintrag) oder aus dem Feed. **Empfehlung: ins Schema** — 5 von 6 generierten Athleten tragen es, die App behandelt es bereits (`src/feed.ts:78-89`), und ein Wegnehmen bräche die Fixtures.
2. **`breach` als Feed-Feld.** `contract.py:137-138` trennt es strikt, `brief.py:535-536` hängt den Grund in den **`text`-String**, das Dict bei `:539-547` hat kein `breach`. Die UI kann eine Grenzüberschreitung nur durch String-Matching erkennen — was sie nicht tun darf. **Empfehlung: `breach: bool` + `breach_reason` in `watch_items` aufnehmen.**
3. **„At most 2" korrigieren** in `CLAUDE.md:48`, `docs/feed_schema.md:126`, `src/feed.ts:267` — und `docs/ROADMAP.md` M1 gleich mit.

### E14 — Kleinkram-Bündel, eine Sitzung
- **CA-Bundle** (`A11.1`): `http.py:78` setzt kein `verify`. Es gibt genau **einen** `requests`-Aufruf im Baum (`http.py:83`) — ein `setdefault` deckt intervals.icu und alles andere ab.
- **Vier Handler** (`A11.2`): `brief_context.py:168`, `block_builder.py:634/698/834` fangen nur `(requests.RequestException, http.HttpError)`. `RequestException` erbt von `OSError`, aber `requests/adapters.py:332` wirft einen **blanken** `OSError` („Could not find a suitable TLS CA certificate bundle") — und zwar außerhalb des übersetzenden try-Blocks. Um `OSError` erweitern.
- **Native Erweiterungen** (`A12`): im Venv nur zwei `.pyd`, beide aus `charset_normalizer`. Die reinen Python-Fassungen (`cd.py`, `md.py`) liegen **daneben** — ein `--no-binary` ist nicht nötig, es genügt, die `.pyd` beim Bündeln wegzulassen. Ein `tests/test_no_native_extensions.py` hält es fest; heute prüft das nichts.
- **Logging** (`A13.1` + `A13.8`): `http.py:68-73` printet nach `sys.stderr` statt zu loggen. Der naheliegende Fix hilft nur, wenn `logging_config.configure()` überhaupt läuft — es macht ein **ungeschütztes** `LOG_DIR.mkdir()` plus `RotatingFileHandler` (`:102-110`), während `log_event` bei `:155-163` ein `except OSError` hat. Auf einem schreibgeschützten Bundle wirft `configure()` beim **Start**. Try/except drum, symmetrisch zu `log_event`.
- **`datetime.now()` ohne tz**: `block_builder.py:446` (einziger naiver Aufruf in `src/`); dazu `roster.py:333` `enrolled_on=date.today()` — der Pfad, den die App beim Onboarding fährt. Beide auf `src/utils/dates.py:74 today(tz)` bzw. UTC.
- **Zeitzonen-Meldung**: `coaching_config_schema.py:470-474` unterscheidet nicht zwischen „unbekannter Zonenname" und „keine tz-Datenbank vorhanden".
- **`ARCHITECTURE.md:54` und `:106`** behaupten, `src/analysis/*` mache keine Netzaufrufe. `brief_context.py:25` `import requests`, `:31` `from src.integrations import intervals_api`. Zu melden, nicht still zu korrigieren.
- **`block_builder.py:52`** `ROOT = paths.ROOT` ist tot (2 Vorkommen im File, 0 Importeure) — aber `:48-51` trägt jetzt einen Kommentar, der das Gegenteil behauptet. Konflikt Plan ↔ Code-Kommentar; nicht stillschweigend eine Seite wählen.

### E15 — Standing Rule 11 nachziehen
`aad48a1` und `459e7f5` haben kein Session-Log, `docs/log/INDEX.md` endet bei 024, `CURRENT_STATE.md:7` nennt HEAD `8ac1e59`. `CLAUDE.md:80` sagt „next number D67", obwohl D67 bei `DECISIONS.md:2497` steht. Vor dem Mac schließen — am Mac-Tag ist eine kaputte Hash-Kette reine Ablenkung.

---

## 3. FRONTEND — auf Windows

### F1 — `src/athlete.ts:57` `fetchBriefing` ist die einzige Naht, und sie beschreibt die falsche Zukunft
Der Kommentar `:49-51` sagt „this becomes an HTTP call". Das ist die **verworfene** Alternative — `DECISION_local_first.md` (Entwurf D66) hat local-first entschieden, die Engine läuft *auf* dem Gerät. Korrigieren, sonst baut jemand einen Client für einen Server, den es nicht geben wird.

Vor dem Mac ohne natives Modul machbar:
- Signatur von `(which: TestAthlete)` auf `(athleteId: string, date?: string)` heben. `FetchResult` (`:42-44`) unterscheidet `source: 'fixture' | 'engine'` bereits — die Form stimmt schon.
- Eine `EngineBridge`-Schnittstelle mit **zwei** Implementierungen: `fixture` (heute) und `native` (Attrappe, wirft `NOT_AVAILABLE`). Am Mac-Tag wird nur die Attrappe getauscht.
- Die drei Pflichten aus `:52-55` bauen — keine braucht das native Modul: `schema_version` prüfen (steht schon, `:62`), **letzten guten Feed halten** (`storage.ts:111 archiveFeed` / `:108 loadArchive` liegen bereit, werden aber von `fetchBriefing` nicht benutzt), nie ein fehlendes Feld erfinden.

### F2 — Die Athleten-Id: die Entscheidung, die im App-Code komplett fehlt
`app/onboarding.tsx` erhebt keine, `src/session.tsx` hält keine, `src/storage.ts:27-36` hat keinen Schlüssel dafür. Engine-Seite: `paths.py:68 DEFAULT_ATHLETE_ID = "default"`, `paths.py:367 for_athlete(None) → default`, `json_store.py:157-160` dasselbe — A5 („`default` abschaffen") ist NOT BUILT. **Eine eingebettete Engine ohne explizite Id fällt still auf `default` zurück.** Auf einem Gerät mit einem Athleten unauffällig, beim Restore auf ein zweites Gerät ein Datenmischer.

Es hängt mehr dran als Dateipfade: `config/settings.py:66-75` vergibt den **unsuffigierten** `INTERVALS_API_KEY` nur an `default`, alle anderen bekommen `INTERVALS_API_KEY_<ID>`. Der Plan sagt korrekt „der Host setzt den Key aus der Keychain" — aber nicht, unter welchem Namen.

- *Für `default`:* bare Env-Namen, keine Suffix-Logik, ein Athlet pro Telefon, funktioniert sofort.
- *Dagegen:* A5 wird genau diese Benennungsregel ändern; dann fasst man Host, Keychain und Engine ein zweites Mal an. Und die `.env` dieser Arbeitskopie adressiert mit ihren baren Namen einen Athleten, den es auf der Platte nicht mehr gibt (`data/athletes/` enthält nur die sechs `syn_*`) — der Entwicklertisch verdeckt den Fall also aktiv.

**Empfehlung: eigene stabile Id**, beim Onboarding erzeugt, in `storage.ts` unter einem neuen Schlüssel abgelegt, Host setzt `INTERVALS_API_KEY_<ID>`. Sie überlebt A5 und kostet heute nur den Suffix. Wenn stattdessen `default` gewählt wird, gehört das als bewusste Entscheidung in `DECISION_local_first.md` — nicht als Nebenwirkung.

### F3 — `src/feed.ts` an den neuen Vertrag anpassen
- `:267` „At most 2 — the daily alert budget" ist seit `aad48a1` falsch. Kommentar korrigieren **und** sicherstellen, dass keine UI-Stelle auf zwei Einträge schneidet.
- `WatchItem` (`:251-264`) hat kein `breach`. Optional typisieren (`breach?: boolean; breach_reason?: string | null`) und bis zur Engine-Entscheidung E13.2 **nicht** auf `text`-Strings matchen.
- `:78-89` (`MISMATCH #1`, `unplanned`) ist durch GAP-13 bestätigt und in den Fixtures nachweisbar. Der Typ ist bereits richtig offen (`(string & {})` plus Default-Branch) — nichts zu ändern außer der Formulierung, sobald E13.1 entschieden ist.

### F4 — Fixtures: aktuell, und das Repo-Zusammenlegen vorbereiten
Die drei Fixtures wurden am 18.08. neu erzeugt und tragen bereits den neuen Vertrag (`items=2, held_back=4`, `today.source="unplanned"`). Kein Handlungsbedarf. **Aber:** `tests/test_repo_hygiene.py:54` läuft seit D66 über `git ls-files` des **gesamten** getrackten Baums. Wandert die Engine in ein Repo mit App-Code, scannt der Test `src/fixtures/` mit. Regel festhalten: dort nur `syn_*`-Athleten, nie ein echter Feed, keine `i1########`-Activity-Ids, keine Stadt. Und `docs/log/session_024.md` warnt zu Recht: ein grüner Scan ist kein Beweis — eine an einem Label verankerte Regel sieht nur das erste Vorkommen nach dem Label.

### F5 — Onboarding und Erst-Erfassung
- Die 36 Keys stimmen 1:1. **Nicht anfassen.**
- **Fehlend, seit D66:** `config/profile.template.md:54` „How you want to be coached" (Tonfall, ungefragt melden, wieviel Struktur) und `:64` „Principles specific to you" (gehaltene Stärke vs. Entwicklungsziel, was limitiert die Progression, feste Verpflichtungen, realistische Wochendecke). Diese Inhalte wurden aus dem **SYSTEM**-weiten `coach.md` herausgelöst, das `block_builder.py:130-141` für *jeden* Athleten liest. Solange das Onboarding sie nicht erhebt, bekommt jeder App-Athlet einen leeren Präferenz- und Limiter-Abschnitt. Zwei Freitextfragen, Ausgabe als Markdown-Abschnitte. `src/intake.ts:152-153, 186-187, 256-257` erhebt vom Profil heute **nur** `hoursPerWeekLow/High` — einer von acht Abschnitten, halb.
- `profile.hours_per_week_*` muss in die `hours/week`-Zeile geschrieben werden. `ENGINE_REQUIREMENTS.md:166-167` fordert das bereits; **die Funktion existiert in der Engine nicht**, `new_athlete.py:196` kopiert nur. Bis E12 erledigt ist, bekommt jeder App-Athlet stillschweigend 18–22 h/Woche.
- **Consent:** `toConfigPayload()` (`intake.ts:206-261`) liefert `{ given, at }`; das Roster erwartet `consent_version`, `consent_granted_at`, `consent_withdrawn_at`, `consent_categories` (`config/roster.py:78-82`). Felder ergänzen — aber ehrlich bleiben: A2 ist PARTIAL, `roster.active()` filtert nur nach Status und Art, `tools/roster.py:91` sagt selbst *„their data must not be processed until it is on record"*, und nichts verhindert die Verarbeitung. Die App sagt dem Athleten heute schon, dass die Einwilligung eine Willenserklärung und keine Sperre ist. Dabei bleiben.

### F6 — Intents: nichts weiterbauen
`report_session` (RPE/feel) hat keine Senke — F1 ist NOT BUILT, `icu_rpe` und `feel` kommen in `src/` **nirgends** vor. `change_availability`/`move_workout`: F2 NOT BUILT, der Planer emittiert ein festes Vier-Wochen-Template. Die Outbox mit `synced: false` (`storage.ts:10-14`) ist die richtige Antwort und bleibt so. **Nicht** „D50 LLM boundary" zitieren — `DECISIONS.md:2154` ist VOID („proposed by an AI session, never approved"). Die Grenze steht in `PROJECT_CHARTER.md:19` und `MASTER_PLAN.md:138`.

### F7 — Was die TypeScript-Seite vom eingebetteten Python braucht (festschreiben, nicht bauen)
- **Genau eine Funktion**, JSON rein/raus: `athleteId` + optional `date` → Feed-dict. Das ist E4.
- **Typisierte Fehlercodes statt Text.** Mindestens `ATHLETE_NOT_FOUND` (E5), `CONFIG_INVALID`, `ENGINE_ERROR`. Sonst müsste die App die 14-zeilige Config-Meldung parsen.
- **Ein beschreibbares Wurzelverzeichnis.** Die App muss dem Host einen Documents-Pfad für `data/`, `plans/`, `reports/`, `logs/` liefern; ohne E3 liegt `ROOT` im read-only Bundle.
- **Ein Ladezustand und ein Setup-Screen.** Der Import validiert die gesamte TOML (`coaching_config_schema.py:1067`). Das Muster steht bereits: `session.tsx` `ready` — nicht routen, bevor der erste Lesevorgang fertig ist. `ConfigError` bekommt einen eigenen Zustand, nicht einen Toast.

---

## 4. Der Mac-Tag selbst

**Vorbedingung:** E1–E6 sind grün, E6 läuft auf Windows durch, ein Wheel liegt gebaut vor, alles ist committet (E15). Sonst wird der Mac-Tag ein Windows-Tag auf fremder Hardware.

Dann, in dieser Reihenfolge — jeder Schritt ist ein Experiment mit einer Antwort, nicht eine Aufgabe:

1. **Toolchain und CPython-3.13-iOS-Build besorgen, dann als Erstes: hat er `_ssl`?** Das ist die Weiche des Tages. Wenn nein, fällt der gesamte `requests`-Pfad weg, der Swift-Bridge-Weg wird Pflicht statt Option — und E8 (`allow_network=False`) ist dann keine Optimierung, sondern die Betriebsart.
2. **Wheel plus Abhängigkeiten ins Bundle, dann nicht importieren, sondern nachsehen.** Existiert `tzdata/zoneinfo/Europe/Berlin` als **Datei**? `certifi/cacert.pem`? `config/coaching_config.toml`? Alle drei scheitern zur Laufzeit, nicht beim Bauen. Die Frage ist „liegt die Datei da", nicht „importiert das Paket".
3. **Zip oder Verzeichnis?** Verzeichnis → `coaching_config_schema.py:36/:792` bleibt harmlos. Zip → dieselbe Stelle wird zum Blocker, weil `open(Path(__file__).parent / …)` nicht in ein Zip hineinliest; dann `importlib.resources` nachziehen (im ganzen Baum kommt `importlib` heute **nirgends** vor).
4. **Erster Import auf einem Hintergrund-Thread, Zeit stoppen.** Der Import validiert die komplette TOML plus `requests`/`ssl`/`certifi`. Nur hier messbar.
5. **Feststellen, was `sys.stderr` ist.** None, ein Objekt ohne `reconfigure`, oder etwas Drittes. Danach erst `logging_config.configure()` aufrufen — und nur mit dem Schutz aus E14, sonst wirft `LOG_DIR.mkdir()` beim Start.
6. **`configure_roots` auf Documents zeigen lassen**, dann `known_athlete_ids()` abfragen. Leer → Onboarding zeigen. Nicht `tenant.resolve` blind aufrufen.
7. **Erst jetzt `feed_for_athlete` gegen `syn_veteran`, ohne Netz.** Erwartung: ein dict, kein Schreibzugriff außerhalb Documents, keine Verbindung. Das ist der eigentliche Beweis, dass die Portierung funktioniert.
8. **Dann mit Netz und echtem Key aus der Keychain.** Unter welchem Env-Namen — das ist F2, und das muss vorher entschieden sein.
9. **`SystemExit` absichtlich auslösen** und sehen, was der Host bekommt. Erst diese Antwort entscheidet, ob A6 (13 Stellen in `block_builder.py`) Arbeit wert ist oder ob ein `except BaseException` im Host reicht.
10. **Zeitbudget real messen.** Ob 5 s oder 8 s Gesamt-Deadline richtig sind, entscheidet Mobilfunk.

---

## 5. Was NICHT vorbereitet werden kann

Ehrlich, und ohne Ersatzbeschäftigung:

- **`_ssl` im iOS-CPython-Build.** Aus dem Repo nicht feststellbar. Die wichtigste offene Frage des Projekts, und es gibt nichts, was man vorher tun könnte außer E8 so zu bauen, dass beide Antworten funktionieren.
- **Was der Bundler kopiert, und ob Zip oder Verzeichnis.** Beides erst am Gerät sichtbar. E14 (`importlib.resources`) entschärft die Zip-Antwort vorab — mehr geht nicht.
- **Was `sys.stderr` im eingebetteten Interpreter ist.** Der Code ist gegen alle drei Möglichkeiten robust (`logging_config.py:95-98` nutzt `getattr`), aber wohin Diagnose überhaupt gehen kann, entscheidet das Gerät.
- **Kaltstartkosten des Imports.** Auf welchem Thread und wie lange — nur auf Gerät messbar.
- **Was passiert, wenn `SystemExit` die Bridge erreicht.**
- **Reale Timeout-Werte.**
- **`/usr/share/zoneinfo` aus der Sandbox.** Das ist ausdrücklich **keine** offene Frage, sondern eine Entscheidung: `zoneinfo.TZPATH == ()` auf dieser Maschine, das Projekt läuft schon heute ausschließlich über das `tzdata`-Paket. E2 macht die Frage gegenstandslos.
- **`sys.platform == "ios"` / `_scproxy`.** Aus dem Stdlib-Quelltext gelesen (`urllib/request.py` überspringt den `darwin`-Zweig), am Gerät einmal bestätigen. Keine Vorbereitung möglich, keine nötig.

Und eine ehrliche Abgrenzung: **F1 (RPE/„wie hat es sich angefühlt") und F2 (Verfügbarkeit) sind keine Mac-Fragen.** Sie sind schlicht nicht gebaut — `icu_rpe` und `feel` kommen in `src/` nicht vor, `docs/athlete_homework.md:142-143` zählt sie als `0 / 63`. Die App hat dafür bereits die richtige Antwort (Outbox, `synced: false`, und sie sagt es dem Athleten). Daran vor dem Mac weiterzubauen wäre die eine Falle, vor der `MASTER_PLAN.md:138` ausdrücklich warnt: *Chat, der ausgeliefert wird, bevor die Engine umplanen kann.*