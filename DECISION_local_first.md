# Entwurf D66 — Die Engine läuft auf dem Gerät

**Status: ENTWURF.** Gehört als nummerierte Entscheidung nach
`docs/DECISIONS.md` im Engine-Repo (nächste freie Nummer: D66). Liegt hier,
weil das Engine-Repo eine eigene Lane ist — und weil eine Entscheidung, die
nur in einem Chatverlauf steht, nach der Trap-Liste dieses Projekts als
verloren gilt.

*Entschieden 2026-08-16 von Hussein als Originator (Charter §6:
Architektur ist seine Domäne).*

---

## Die Entscheidung

Die Engine läuft **eingebettet auf dem Gerät**. Ein Athlet pro Telefon. Die
Daten liegen lokal.

Vier Teile:

1. **Rechnen lokal.** CPython eingebettet in die iOS-App, dieselben
   ~11.000 Zeilen Python wie heute. Kein zweiter Motor, keine
   Neuimplementierung.
2. **Daten lokal.** Aktivitäten, Wellness, berechneter Zustand, Briefings,
   Rückmeldungen — alles auf dem Gerät.
3. **Verschlüsseltes Backup auf einem eigenen Server.** Zweck: Gerätewechsel
   und Verlustschutz. Nicht: eine zentrale Datenbank.
4. **Diagnosedateien an denselben Server.** Zweck: erkennen, wenn bei einem
   Nutzer etwas schiefläuft. Auslieferung von Korrekturen über den App Store.

## Was die Alternative war

Der Server rechnet und vergisst, das Telefon behält. Verworfen, obwohl
technisch schneller erreichbar.

Der ausschlaggebende Punkt gegen den Server-Weg war nicht Technik, sondern
Positionierung: „deine Gesundheitsdaten verlassen dein Telefon nicht" ist
eine Aussage, die im Markt sonst niemand macht — Garmin, Whoop, TrainingPeaks
und intervals.icu sind alle Cloud. Sie passt zum bestehenden Kern des Produkts
(sichtbare Verweigerung statt geschätzter Werte) und ist verteidigbar.

## Was diese Entscheidung löst

- **Charter §4.8** — „eines Athleten Daten dürfen nie aus dem Kontext eines
  anderen erreichbar sein". Bei einem Athleten pro Gerät ist das strukturell
  wahr, nicht durch Tests erzwungen.
- **Charter §7** — „Athletendaten ohne Backup" darf nicht passieren. Der
  verschlüsselte Server-Backup erfüllt das.
- **Roadmap A4** (einen Athleten vollständig löschen) — App deinstallieren,
  Backup löschen. Zwei Aktionen statt eines ungebauten Werkzeugs.
- **Roadmap B4** (Logs pro Athlet trennbar) — es gibt keine gemeinsamen Logs
  mehr.
- **Roadmap B5** (Backup mit geprobter Wiederherstellung) — die
  Wiederherstellung ist der Gerätewechsel und wird bei jedem Test geprobt.
- **Phase P** teilweise — was nie zentral liegt, kann dort auch nicht lecken.

## Was sie kostet, ehrlich

- **Eine Korrektur an der Belastungsmathematik braucht eine
  App-Store-Auslieferung.** Python ist nativer Code; EAS Update kann nur
  JavaScript nachschieben. Rechne mit Tagen statt Minuten, und damit, dass
  ein Teil der Nutzer wochenlang eine alte Version fährt.
- **Neun Fragen sind offen**, die nur ein Mac beantwortet — darunter, ob der
  iOS-Python-Build überhaupt `_ssl` enthält. Siehe
  [IOS_PORTING_PLAN.md](IOS_PORTING_PLAN.md) Abschnitt B.
- **Die Golden-Output-Diffs** aus Charter §5 müssen künftig gegen genau das
  Wheel laufen, das ausgeliefert wird — nicht gegen den Arbeitsstand.
- Der eigentliche Engpass des Projekts bleibt unberührt: ein LT1-Feldtest
  schaltet weiterhin mehr frei als diese Architektur.

---

## Was sie NEU verlangt

Das ist der Teil, der noch nicht existiert.

### N1 — Das Backup muss Ende-zu-Ende verschlüsselt sein

Sonst ist der Server doch wieder ein Gesundheitsdatenspeicher, nur einer mit
schlechterem Ruf als intervals.icu. Das Gerät verschlüsselt, der Server
speichert einen undurchsichtigen Block, der Betreiber kann ihn nicht lesen.

**Die harte Konsequenz, die entschieden werden muss:** Wenn ihr das Passwort
nicht zurücksetzen könnt, ist ein vergessenes Passwort gleich verlorenes
Backup. Der übliche Kompromiss ist ein Wiederherstellungsschlüssel, den der
Nutzer bei der Einrichtung erhält und selbst verwahrt.

Ein Passwort-Reset, der das Backup rettet, bedeutet zwangsläufig, dass ihr
entschlüsseln könnt. Beides zusammen geht nicht. **Diese Entscheidung ist
offen.**

### N2 — Diagnosedaten dürfen keine Gesundheitsdaten enthalten

Der gefährlichste Punkt der ganzen Architektur, weil er sich schleichend
verletzt: ein Fehlerbericht, der „zur Fehlersuche" das Briefing mitschickt,
ist ein Gesundheitsdaten-Upload.

Regel, die aufgeschrieben und geprüft gehört:

**Erlaubt:** Engine-Version, Config-Version, Commit-Hash, Schema-Version,
Fehlertyp, Stack-Trace, Zeitstempel, anonyme Installations-ID, Anzahlen
(„38 Aktivitäten", „5 Lücken").

**Verboten:** Werte. Kein CTL, kein HRV, keine Schwellen, keine
Einheitennamen, keine Daten, kein Profiltext, keine Freitext-Rückmeldung.

Das ist prüfbar zu machen — eine Freigabeliste erlaubter Felder, und ein Test,
der fehlschlägt, sobald ein Feld hinzukommt, das nicht darauf steht. Dasselbe
Muster wie D28s Leck-Scanner, nur diesmal mit einer Freigabeliste statt einer
Sperrliste, weil eine Sperrliste genau der Grund ist, warum jener Scanner
seinen eigenen Vorfall nicht fängt (GAP-5).

Und: eigene Einwilligung, getrennt von der Datenverarbeitung. Diagnose ist
nicht Teil des Coachings.

### N3 — Die Version muss überall mitlaufen

Damit das Prüfmodell trägt, muss jede Ausgabe sagen, wer sie erzeugt hat. Die
Engine stempelt heute schon Config-Version, Datenqualitätsscore und
Commit-Hash in jeden Report — das muss in den Feed, in die Diagnose und
sichtbar in die App.

Ohne das ist ein Golden-Diff bei zehn Geräten wertlos, weil niemand weiß,
welche Version verglichen wird.

### N4 — Das Morgensignal kommt vom Backup-Server

iOS weckt keine App um 05:30 zum Rechnen. Mit der Engine auf dem Gerät gibt es
zwei Wege, und der zweite ist jetzt verfügbar:

- Die App rechnet beim Öffnen. Frischer als 05:30, kostet ein paar Sekunden.
- Der Server, den ihr für Backup und Diagnose ohnehin betreibt, schickt eine
  Push-Nachricht als Anstoß. **Er braucht dafür keine einzige
  Gesundheitsangabe** — nur einen Push-Token und eine Uhrzeit.

Beides zusammen ist die richtige Antwort: Anstoß vom Server, Rechnung auf dem
Gerät.

### N5 — Ein Konto, das so wenig wie möglich weiß

Nötig für Backup und Gerätewechsel. Minimal: eine Kennung, ein Passwort, ein
Push-Token, ein verschlüsselter Block. Kein Name, kein Alter, keine
Trainingsdaten.

Je weniger dieses Konto weiß, desto weniger ist es wert, es anzugreifen.

### N6 — Die Auslieferung wird zum Teil der Verifikation

Weil eine Korrektur nur über den App Store ankommt, muss die App wissen und
sagen können, wie alt ihre Engine ist. Bei einer bekannten fehlerhaften
Version gehört ein sichtbarer Hinweis dazu — nicht stilles Weiterrechnen.

---

## Offene Fragen, die vor der Umsetzung zu klären sind

1. **Passwort-Reset oder Wiederherstellungsschlüssel?** Siehe N1. Ohne
   Antwort kann das Backup nicht gebaut werden.
2. **Wo steht der Server?** Für ein EU-Projekt mit Gesundheitsbezug ist das
   keine Nebensache, auch wenn der Inhalt verschlüsselt ist.
3. **Was passiert bei zwei Geräten gleichzeitig?** Ein Athlet pro Telefon
   heißt nicht automatisch ein Telefon pro Athlet. Wenn iPhone und iPad
   dasselbe Konto nutzen, braucht es eine Regel, welche Fassung gewinnt.
4. **Wie kommen die intervals.icu-Zugangsdaten aufs Gerät?** Heute liegen sie
   in einer `.env`. Auf dem Telefon gehören sie in den iOS-Schlüsselbund — und
   der Athlet muss sie eingeben können, was die Erst-Erfassung heute bewusst
   nicht tut.
5. **Übersteht das Backup einen Schemawechsel?** Ein Block, der mit
   `feed-v1` und `config 7.0.0` erzeugt wurde, muss von einer späteren
   Version lesbar bleiben — oder es braucht eine Migration.

---

## Was sich dadurch NICHT ändert

Die Arbeitsliste aus [IOS_PORTING_PLAN.md](IOS_PORTING_PLAN.md) gilt
unverändert. `src.delivery` gehört ins Paket, `tzdata` in die Abhängigkeiten,
`build_feed` darf nicht 167 Sekunden blockieren, `SystemExit` gehört nicht in
eine Bibliothek. Nichts davon war für den Server-Weg gedacht.

Und die App merkt den Unterschied weiterhin nicht: `fetchBriefing()` in
`src/athlete.ts` ist die eine Funktion, die weiß, woher ein Briefing kommt.
