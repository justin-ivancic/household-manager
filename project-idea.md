# household-manager

## Kurzbeschreibung

`household-manager` ist eine mobile-first Haushalts-App für gemeinsam genutzte Einkaufslisten und eine optionale Vorratsübersicht.

Alle Personen im Haushalt sollen schnell festhalten können, was fehlt: Lebensmittel, Badartikel, Haushaltswaren oder sonstige Dinge. Beim Einkaufen werden offene Einträge als gekauft markiert. Gekaufte Produkte verschwinden aus der offenen Liste und bleiben in einer Historie sichtbar.

Die App soll lokal im eigenen Heimnetz laufen, ohne Accounts, ohne Cloud-Zwang und ohne komplizierte Haushaltsverwaltung. Die komplette Benutzeroberfläche ist auf Deutsch.

## Produktziel

Die App soll das gemeinsame Haushaltsgedächtnis ersetzen, ohne selbst Arbeit zu machen.

Erfolgreich ist die App, wenn:

- ein Haushaltsmitglied in unter 5 Sekunden "Milch" zur Einkaufsliste hinzufügen kann
- eine andere Person beim Einkaufen denselben Eintrag in unter 2 Sekunden abhaken kann
- alle im Haushalt sofort sehen, was offen, gekauft oder im Vorrat vorhanden ist
- die Vorratsfunktion hilfreich bleibt, auch wenn sie nicht perfekt gepflegt wird

## Zielgruppe

Primäre Nutzer:

- mehrere Personen in einem gemeinsamen Haushalt
- Menschen, die beim Kochen, Putzen oder im Alltag schnell fehlende Dinge notieren wollen
- Menschen, die beim Einkaufen eine klare, abhakbare Liste brauchen

Wichtige Annahme:

- Die App wird oft nebenbei genutzt: im Supermarkt, in der Küche, im Bad, unterwegs oder schnell auf dem Sofa.

## Sprache und Ton

Die App ist vollständig deutsch.

Beispiele für UI-Texte:

- `Einkaufen`
- `Bestand`
- `Gekauft`
- `Hinzufügen`
- `Als gekauft markieren`
- `Zur Einkaufsliste`
- `Zuletzt gekauft`
- `Niedriger Bestand`
- `Heute`
- `Gestern`

Der Ton ist ruhig, direkt und alltagsnah. Keine erklärenden Marketingtexte in der App. Die Oberfläche soll sich wie ein Werkzeug anfühlen, nicht wie eine Landingpage.

## Referenzdesign

Es gibt ein Referenzbild unter `docs/reference-design.png`. Es muss nicht 1:1 nachgebaut werden, aber die abstrakte Richtung ist wichtig.

Übernommene Designprinzipien:

- helle, luftige Mobile-App-Oberfläche
- viel Weißraum, aber keine leere Marketing-Ästhetik
- weiche grüne und blaue Akzentfarben
- große Statuskarten oben
- segmentierte Listenbereiche für `Einkaufsliste` und `Gekauft`
- klare Zeilen mit Checkbox, Produktbild/Icon, Name, Kategorie und optionaler Person
- prominente Plus-Aktion zum schnellen Hinzufügen
- abgerundete, hochwertige Oberflächen mit subtilen Schatten
- Bottom Navigation als primäre Navigation

Abweichungen vom Referenzbild:

- Die App braucht keine Gruppenfunktion in Version 1.
- Avatare sind optional, da es keine echten Benutzerkonten gibt.
- Produktbilder sollten optional sein; Icons oder Emoji-artige Kategoriezeichen reichen für MVP.
- Der Fokus liegt stärker auf schneller Eingabe als auf dekorativer Darstellung.

## Designrichtung

Die App soll wirken wie:

- modern
- ruhig
- hochwertig
- schnell
- freundlich
- vertrauenswürdig
- klar strukturiert

Sie soll nicht wirken wie:

- eine komplexe Aufgabenmanagement-App
- ein Warenwirtschaftssystem
- eine Social-App
- ein überladener Supermarkt-Prospekt

## Visuelle Leitplanken

Layout:

- Mobile-first für ca. 360-430 px breite Viewports
- Desktop nur als breitere, zentrierte mobile App-Ansicht oder einfache responsive Erweiterung
- wichtige Aktionen immer im Daumenbereich erreichbar
- Listen müssen auch mit vielen Einträgen gut scannbar bleiben

Farben:

- Basis: sehr helles Weiß/Grau
- Primärakzent: Grün für Einkauf, Erfolg und Kaufen
- Sekundärakzent: Blau für Bestand
- optionaler Tertiärakzent: dezentes Violett für Hinweise oder Verweise
- Warnungen: warmes Gelb/Orange für niedrigen Bestand, Rot nur für destruktive Aktionen

Komponenten:

- Statuskarten mit Icon, Zahl und kurzer Beschriftung
- Listenzeilen mit stabiler Höhe
- runde Checkboxen für offene Einkäufe
- klare `+` Aktion zum Hinzufügen
- segmentierte Tabs für offene und gekaufte Einträge
- Bottom Navigation mit Icons und kurzen Labels

## Informationsarchitektur

Primäre Navigation:

1. `Home`
2. `Bestand`
3. `Hinzufügen`
4. `Historie`
5. `Einstellungen`

Alternative für MVP:

1. `Einkaufen`
2. `Bestand`
3. `Hinzufügen`
4. `Einstellungen`

Empfehlung:

- `Home` ist die Startansicht und zeigt die aktuelle Einkaufsliste.
- `Hinzufügen` ist eine prominente mittlere Plus-Aktion.
- `Historie` kann im MVP auch innerhalb von `Home` als Abschnitt `Zuletzt gekauft` bleiben.

## Startansicht: Home

Die Home-Ansicht ist der wichtigste Screen.

Sie zeigt:

- Haushaltsname oder App-Titel oben, z. B. `Unser Haushalt`
- zwei Statuskarten:
  - `Einkaufsliste`: Anzahl offener Einträge
  - `Bestand`: Anzahl gepflegter Vorratseinträge
- darunter eine große Liste mit offenen Einkäufen
- darunter `Zuletzt gekauft`
- optional eine kleine Karte `Bestand prüfen`, die zur Vorratsübersicht führt

### Kopfbereich

Elemente:

- links: Home-/Haushalts-Icon
- Titel: `Unser Haushalt`
- optional: kleiner Pfeil für spätere Haushalts-/Systemauswahl, im MVP ohne Funktion oder weggelassen
- rechts: Suche und Einstellungen oder Systemstatus

Da es keine Accounts gibt, sind Personen- und Benachrichtigungsicons im MVP nicht erforderlich.

### Statuskarten

Karte `Einkaufsliste`:

- Icon: Clipboard/List
- große Zahl: offene Einträge
- Text: `Dinge zu kaufen`
- Akzent: Grün

Karte `Bestand`:

- Icon: Box/Cube
- große Zahl: Bestandseinträge
- Text: `Dinge im Vorrat`
- Akzent: Blau

Bei Tap:

- Einkaufskarte springt zur offenen Liste
- Bestandskarte öffnet `Bestand`

### Einkaufsliste

Der Hauptbereich nutzt segmentierte Tabs:

- `Offen`
- `Gekauft`

Im Tab `Offen`:

- Überschrift `Zu kaufen`
- rechts eine kompakte Aktion `Hinzufügen`
- Liste offener Einträge

Jede Zeile:

- runde Checkbox links
- Produktbild/Icon oder Kategorie-Icon
- Produktname
- Kategorie und optionale Menge
- optional: wer den Eintrag erstellt hat, falls später lokale Namen eingeführt werden
- Drei-Punkte-Menü für Bearbeiten/Löschen

Beispielzeilen:

- `Toilettenpapier` - `Haushalt`
- `Bananen` - `Obst - 6 Stück`
- `Duschgel` - `Bad`
- `Zahnbürsten` - `Hygiene - 2 Stück`
- `Kiwis` - `Obst`

Interaktion:

- Tap auf Checkbox markiert als gekauft.
- Tap auf Zeile öffnet Details/Bearbeiten.
- Swipe nach rechts kann optional `gekauft` auslösen.
- Swipe nach links kann optional `bearbeiten`/`löschen` anzeigen.

### Gekauft

Der Tab `Gekauft` zeigt zuletzt gekaufte Einträge.

Jede Zeile:

- grünes Haken-Icon
- Produktname
- Kategorie
- Kaufzeitpunkt, z. B. `Heute, 08:30` oder `Gestern`
- optional: Menge

Aktionen:

- `Rückgängig` für kurz zuvor abgehakte Einträge
- `Erneut hinzufügen`, wenn ein gekauftes Produkt wieder gebraucht wird

## Hinzufügen-Flow

Der wichtigste Flow muss extrem schnell sein.

### Schnelles Hinzufügen

Primäre Eingabe:

- ein Textfeld mit Placeholder `Was fehlt?`
- Absenden per Enter oder Button `Hinzufügen`

Beispiele:

- `Milch`
- `Milch 6 Packungen`
- `Toilettenpapier große Packung`
- `Eier 30 Stück`

Die App darf einfache Mengen aus Text ableiten, muss es aber im MVP nicht perfekt können.

### Erweiterte Felder

Nach oder unter der Schnelleingabe:

- Kategorie
- Menge
- Einheit
- Notiz
- optional: `auch im Bestand führen`

Diese Felder dürfen nie den schnellen Standardfall blockieren.

### Bottom Sheet

Auf Mobile sollte `Hinzufügen` als Bottom Sheet oder kompakter Vollbilddialog erscheinen.

Anforderungen:

- Eingabefeld automatisch fokussieren
- Tastaturfreundlich
- nach dem Speichern sofort bereit für den nächsten Eintrag
- Abschluss durch `Fertig`

## Bestandsverwaltung

Die Bestandsverwaltung ist eine optionale Erweiterung, aber sie soll von Anfang an sauber mitgedacht werden.

Ziel:

- grober Überblick über Vorräte
- keine perfekte Lagerbuchhaltung
- schnelle Anpassung statt komplizierter Formulare

Beispiele:

- `30 Eier`
- `6 Packungen Milch`
- `3 Gläser Marmelade`
- `2 kg Hähnchen im Gefrierschrank`
- `12 Dosen Tomaten`

### Bestandsliste

Die Ansicht `Bestand` zeigt:

- Suchfeld
- Filter nach Kategorie
- Liste der Vorratseinträge
- Hinweise für niedrigen Bestand

Jede Zeile:

- Produktname
- aktuelle Menge und Einheit
- Kategorie
- optionaler Lagerort
- Schnellaktionen `-` und `+`
- optional `Zur Einkaufsliste`

### Bestand anpassen

Schnellaktionen:

- `+1`
- `-1`
- freie Eingabe
- Menge auf `0` setzen

Bei Einheiten wie kg oder Liter:

- Schrittweite kann kleiner sein, z. B. `0,5`

### Mindestbestand

Optional pro Bestandseintrag:

- Mindestmenge
- Warnung bei Unterschreitung
- Aktion `Zur Einkaufsliste`

Beispiel:

- Bestand Milch: `1 Packung`
- Mindestbestand: `3 Packungen`
- Anzeige: `Niedriger Bestand`
- Aktion: `Milch zur Einkaufsliste hinzufügen`

### Automatische Bestandserhöhung

Wenn ein Einkaufslisten-Eintrag als gekauft markiert wird, kann die App anbieten:

- Bestand automatisch erhöhen
- neuen Bestandseintrag anlegen
- ignorieren

Empfehlung für MVP:

- kein automatischer Zwang
- dezenter Vorschlag nach Kauf, wenn ein passender Bestandseintrag existiert

## Kategorien

Standardkategorien:

- Obst
- Gemüse
- Milchprodukte
- Fleisch
- Fisch
- Getränke
- Tiefkühlkost
- Vorrat
- Haushalt
- Bad
- Hygiene
- Drogerie
- Haustier
- Sonstiges

Kategorien enthalten:

- Name
- Icon
- Farbe
- Sortierung

MVP:

- feste Standardkategorien reichen
- Bearbeiten kann später folgen

## Suche

Globale Suche durchsucht:

- offene Einkaufsliste
- gekaufte Produkte
- Bestand
- Kategorien

Anforderungen:

- reagiert sofort
- funktioniert ohne Server-Roundtrip, wenn Daten lokal geladen sind
- toleriert Groß-/Kleinschreibung
- später optional fuzzy matching

## Historie

Die Historie speichert:

- wann ein Produkt hinzugefügt wurde
- wann es gekauft wurde
- welche Menge gekauft wurde
- ob es erneut hinzugefügt wurde

Nutzen:

- wiederkehrende Einkäufe erkennen
- schnell erneut hinzufügen
- nachvollziehen, was kürzlich gekauft wurde

MVP:

- Abschnitt `Zuletzt gekauft` auf Home
- optional eigene Historienansicht später

## Datenmodell

### ShoppingItem

- `id`
- `name`
- `quantity`
- `unit`
- `category_id`
- `note`
- `status` (`open`, `purchased`, `archived`)
- `created_at`
- `purchased_at`
- `updated_at`

Optional später:

- `created_by_name`
- `purchased_by_name`
- `linked_inventory_item_id`

### InventoryItem

- `id`
- `name`
- `quantity`
- `unit`
- `category_id`
- `location`
- `minimum_quantity`
- `note`
- `created_at`
- `updated_at`

### Category

- `id`
- `name`
- `icon`
- `color`
- `sort_order`

### EventLog

Optional, aber hilfreich:

- `id`
- `type`
- `entity_type`
- `entity_id`
- `payload_json`
- `created_at`

Beispiele für Events:

- `shopping_item.created`
- `shopping_item.purchased`
- `shopping_item.reopened`
- `inventory_item.adjusted`

## Technischer Stack

Frontend:

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui oder eigene kleine Komponentenbibliothek auf Radix-Basis
- lucide-react für Icons

Backend:

- bevorzugt Next.js API Routes oder Route Handlers für einfache lokale Installation
- alternativ Node.js + Express, falls Frontend/Backend bewusst getrennt werden sollen

Datenbank:

- SQLite als Standard
- Prisma als ORM
- PostgreSQL optional später

Deployment:

- Docker Compose
- persistentes Volume für SQLite-Datenbank
- persistentes Volume für Backups

Zielhardware:

- altes Notebook
- Mini-PC
- NAS
- Heimserver

## Architekturprinzipien

- lokal zuerst
- keine externe Cloud als Voraussetzung
- keine Nutzerkonten in Version 1
- robuste Bedienung im mobilen Browser
- Datenmodell einfach halten
- schnelle UI vor perfekter Automatisierung
- Bestand als Hilfe, nicht als Pflichtsystem

## MVP-Scope

Version 1 sollte enthalten:

- mobile Home-Ansicht
- offene Einkaufsliste
- Produkt hinzufügen
- Produkt bearbeiten
- Produkt löschen
- Produkt als gekauft markieren
- zuletzt gekauft anzeigen
- einfache Bestandsliste
- Bestandseintrag hinzufügen
- Bestand schnell erhöhen/verringern
- Kategorien als feste Liste
- lokale SQLite-Persistenz
- Docker-Compose-Setup

Nicht zwingend im MVP:

- Benutzer/Avatare
- Push-Benachrichtigungen
- Barcode-Scanner
- automatische Produkterkennung
- Rezeptplanung
- Preisvergleich
- mehrere Haushalte
- Cloud-Sync
- Rollen/Rechte

## Spätere Ausbaustufen

Mögliche Features nach MVP:

- lokale Personen-Namen ohne Login
- wiederkehrende Vorschläge, z. B. `Milch wieder hinzufügen?`
- Mindestbestand mit automatischen Einkaufsvorschlägen
- Barcode-Scanner
- Import/Export
- Backup-Wiederherstellung
- PWA-Installation
- Offline-Modus
- einfache Statistiken
- Produktfavoriten
- Lagerorte, z. B. `Küche`, `Bad`, `Gefrierschrank`, `Keller`

## Nicht-Ziele

Bewusst nicht vorgesehen:

- Benutzerregistrierung
- Login
- mehrere Haushalte
- Rollen und Berechtigungen
- Social Features
- Chat
- Werbung
- Abonnements
- Cloud-Zwang
- komplexe Lagerbuchhaltung
- perfektes Tracking jeder Entnahme

## Zentrale UX-Flows

### Flow: Produkt fehlt

1. App öffnen.
2. Plus-Aktion tippen.
3. Produktnamen eingeben.
4. `Hinzufügen` tippen.
5. Eintrag erscheint sofort in `Zu kaufen`.

### Flow: Einkaufen

1. App öffnen.
2. Offene Liste sehen.
3. Produkt im Laden finden.
4. Checkbox antippen.
5. Eintrag wandert nach `Gekauft`.

### Flow: Vorrat prüfen

1. `Bestand` öffnen.
2. Produkt suchen oder Kategorie scannen.
3. Menge ansehen.
4. Bei Bedarf mit `+` oder `-` anpassen.
5. Optional `Zur Einkaufsliste` tippen.

## Offene Produktentscheidungen

Noch zu entscheiden:

- Soll die App `Home` oder `Einkaufen` als erstes Tab labeln?
- Soll es lokale Personen-Namen geben, obwohl es keine Accounts gibt?
- Sollen Produktbilder automatisch, manuell oder gar nicht verwendet werden?
- Soll `Bestand` schon im MVP voll editierbar sein oder zuerst nur als einfache Liste starten?
- Soll die App als PWA installierbar sein?

## Qualitätskriterien für die Umsetzung

Die erste umgesetzte Version sollte:

- auf einem Smartphone sofort hochwertig wirken
- keine Desktop-Landingpage sein
- ohne Erklärtexte verständlich sein
- mit 0, 3, 10 und 50 Listeneinträgen gut aussehen
- auch bei langen deutschen Produktnamen nicht brechen
- schnelle Eingabe priorisieren
- leere Zustände schön und handlungsorientiert darstellen
- Lade-, Fehler- und Offline-Zustände berücksichtigen

## Beispiel für deutsche Startansicht

Oben:

- `Unser Haushalt`
- Statuskarte `Einkaufsliste` mit `8`
- Statuskarte `Bestand` mit `142`

Hauptbereich:

- Segment `Offen` / `Gekauft`
- Abschnitt `Zu kaufen`
- Button `Hinzufügen`

Einträge:

- `Toilettenpapier` - `Haushalt`
- `Bananen` - `Obst - 6 Stück`
- `Duschgel` - `Bad`
- `Zahnbürsten` - `Hygiene - 2 Stück`
- `Kiwis` - `Obst`

Darunter:

- `Zuletzt gekauft`
- `Milch` - `Heute, 08:30`
- `Brot` - `Gestern`
- `Eier` - `Gestern`

Bottom Navigation:

- `Home`
- `Bestand`
- `Hinzufügen`
- `Historie`
- `Einstellungen`
