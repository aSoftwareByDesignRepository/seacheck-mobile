# Datenschutzerklärung — SeaCheck Mobile (Android / iOS)

**Stand:** 12.07.2026  
**App:** SeaCheck Mobile  
**Anbieter:** Software by Design GbR, Husumer Baum 2, 24837 Schleswig, Deutschland  
**Kontakt:** info@software-by-design.de · datenschutz@software-by-design.de  
**Allgemeine Datenschutzerklärung (Website):** https://software-by-design.de/datenschutz/

---

## 1. Geltungsbereich

Diese Erklärung beschreibt die **mobile App** SeaCheck (Android und iOS). SeaCheck ist ein **eigenständiger** maritimer Navigationsbegleiter. Sie benötigt **keinen** Nextcloud-Server und **kein** Konto bei Software by Design.

**Software by Design betreibt keine zentrale Cloud**, in der Ihre Törns, Tracks oder GPS-Verläufe gespeichert werden. Ihre Daten bleiben auf Ihrem Gerät, sofern Sie sie nicht selbst exportieren oder teilen.

---

## 2. Wer ist verantwortlich?

| Speicherort | Verantwortlicher |
|-------------|------------------|
| App auf dem Gerät (Wegpunkte, Törns, Tracks, Einstellungen, Offline-Karten) | **Sie** (Verantwortlicher für Gerätedaten) |
| Herausgeber der mobilen App | **Software by Design GbR** (diese Erklärung) |

Fragen zu **dieser mobilen App:** datenschutz@software-by-design.de

---

## 3. Was die App auf Ihrem Gerät speichert

| Daten | Zweck | Speicher |
|-------|-------|----------|
| **GPS-Position** (aktuell und letzte Fixes) | Kartenposition, Instrumente (Kurs, Fahrt), Ankeralarm, Track-Aufzeichnung | Im Arbeitsspeicher; Track-Punkte bei Aufzeichnung in der Datenbank |
| **Wegpunkte, Törns, Etappen** | Routenplanung und Navigation | SQLite auf dem Gerät |
| **Tracks und Track-Punkte** | Fahrtenprotokoll | SQLite auf dem Gerät |
| **Schiffsdaten** (Name, Rufzeichen, MMSI, Heimathafen — optional) | Notfalltext, Standard-Törnnamen | App-Speicher (AsyncStorage) |
| **Einstellungen** (Einheiten, Theme, Alarme, Layout usw.) | App-Präferenzen | App-Speicher |
| **Offline-Kartenpakete** (Kacheln) | Karten ohne Mobilfunk | Dateisystem (MapLibre-Offline-Cache) |
| **Seezeichen-Index** (Auszug aus OpenSeaMap) | Offline-Seezeichen-Suche | SQLite auf dem Gerät |
| **Zwischengespeicherte Seezeichen-Kacheln** | Kartenanzeige | Dateisystem |

Die App erstellt **kein** Konto und lädt Törns, Tracks oder dauerhafte Standortverläufe **nicht** auf Server von Software by Design hoch.

---

## 4. Was über das Internet übertragen wird

**Online** kann die App **Drittanbieter** kontaktieren (nicht Software by Design):

| Dienst | Übermittelte Daten | Zweck |
|--------|-------------------|-------|
| **CARTO** (basemaps.cartocdn.com) | Kartenkachel-Anfragen (Gebiet/Zoom; kein Konto) | Basiskarte |
| **OpenSeaMap** (tiles.openseamap.org) | Kachel-Anfragen | Seezeichen-Overlay |
| **OpenStreetMap Overpass API** (z. B. overpass-api.de) | Bereichsabfragen für Seezeichen | Online-Seezeichen-Suche, wenn der lokale Index nicht reicht |

Diese Anfragen zeigen, **welche Kartenbereiche** Sie ansehen oder abfragen — nicht Ihre Identität. Kein Konto erforderlich.

**Offline:** Nach dem Download eines Regionenpakets im WLAN liegen Kacheln und Seezeichendaten für dieses Gebiet auf dem Gerät. Die App kann funktionieren, ohne Ihre GPS-Position an einen Server zu senden.

---

## 5. Was wir **nicht** tun

- Kein Verkauf personenbezogener Daten  
- Keine **Werbungs-** oder **Analyse-SDKs** (z. B. kein Firebase Analytics)  
- Keine Übertragung Ihrer Törns, Tracks oder Standortverläufe an Server von Software by Design  
- Kein Profiling oder Marketing auf Basis Ihrer Navigationsdaten  
- Keine sozialen Funktionen oder öffentliche Standortfreigabe  

---

## 6. Berechtigungen (Android / iOS)

| Berechtigung | Warum |
|--------------|-------|
| **Standort** (bei Nutzung) | Position auf der Karte; Kurs, Fahrt, Peilung |
| **Standort** (Hintergrund / immer) | Anker-Drift-Alarme und Track-Aufzeichnung bei ausgeschaltetem Bildschirm (optional; in der Einrichtung überspringbar) |
| **Internet** | Kartenkacheln und Online-Seezeichen-Abfragen |
| **Benachrichtigungen** | Anker-, Ankunfts- und Abweichungsalarme |
| **Wake Lock / Vordergrunddienst** (Android) | Zuverlässiges GPS und Alarme unterwegs |

---

## 7. Export, Teilen und Löschen

| Aktion | Wie |
|--------|-----|
| **Export** von Törns oder Tracks | GPX-Export in der App → Sie wählen Speicherort oder Teilen (System-Dialog) |
| **Koordinaten kopieren** | Zwischenablage (von Ihnen ausgelöst) |
| **App-Daten löschen** | App deinstallieren oder einzelne Törns, Tracks, Wegpunkte und Offline-Pakete in der App löschen |

Es gibt kein Remote-Konto zum Löschen. Deinstallation entfernt lokale App-Daten vom Gerät (abhängig vom OS-Backup-Verhalten).

---

## 8. Ihre Rechte (DSGVO)

In der EU/des EWR können Ihnen Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch und Datenübertragbarkeit zustehen.

Da Daten **lokal auf Ihrem Gerät** liegen, kontrollieren Sie sie direkt (GPX exportieren, in der App löschen, deinstallieren). Kontakt: **datenschutz@software-by-design.de** für Fragen oder zur Ausübung von Rechten gegenüber Software by Design als Herausgeber.

Aufsichtsbehörde (Deutschland): die Datenschutzbehörde Ihres Wohn- oder Arbeitsorts.

---

## 9. Kinder

SeaCheck richtet sich an **Skipper und Crew** mit verantwortungsvollem Bootseinsatz. **Nicht** an Kinder unter 16 Jahren.

---

## 10. Karten-Attribution

SeaCheck nutzt Gemeinschaftskartendaten von **OpenStreetMap**, **OpenSeaMap** und **CARTO** Voyager. Siehe in der App **Einstellungen → Info** und unsere [Nutzungsbedingungen & Navigation-Hinweis](https://nextcloud.software-by-design.de/de/nutzungsbedingungen-seacheck-mobile.html).

---

## 11. Änderungen

Wir können diese Erklärung bei App-Änderungen aktualisieren. Das Datum „Stand“ wird entsprechend angepasst.
