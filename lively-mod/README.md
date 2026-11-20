# Lively Hands – Fabric 1.21.11 (nur Client)

Animations-Mod mit eingebautem Ressourcenpaket. Sie läuft nur auf dem Client, funktioniert also auf jedem Server.

## Installation
Fabric Loader ≥ 0.17 + Fabric API, dann `livelyhands-1.0.0.jar` nach `.minecraft/mods`.

## Was animiert wird
**First Person:** Trägheit beim Umschauen (das Item zieht nach und federt nach), Neigen beim Strafen, Vorlehnen beim Sprinten, Schweben beim Fallen, Federeffekt beim Landen, Absenken beim Schleichen, Atmen im Stand. Jedes Werkzeug schlägt anders: Schwert als Hieb, Axt als Hacken, Spitzhacke, Schaufel und Hacke als Stoß, Blöcke als Drücken. Dazu ein Hochklappen beim Item-Wechsel, Kauen beim Essen und Trinken und **Ansehen** mit Taste `I`: Das Item kommt in die Bildmitte und dreht sich einmal.

**Third Person (du in F5 und alle anderen Spieler):** Oberkörper dreht mit dem Kopf mit, Vorlehnen und Armschwung beim Sprinten, Wippen beim Gehen, Atmen, angezogene Beine beim Springen, rudernde Arme beim Fallen, Einfedern beim Landen, Klettern an Leitern und Ranken, Hand zum Mund beim Essen, Zusammenzucken bei Schaden, Hieb-, Hack- und Stoß-Schläge je nach Werkzeug, erhobene Waffe in Bereitschaft.

**Kamera:** leichte Neigung beim Strafen, Einknicken beim Landen.

**3D-Item-Physik:** Fallengelassene Items überschlagen sich in der Luft und liegen flach auf dem Boden, Blöcke stehen auf einer Seite.

**Ressourcenpaket „Lively Hands – Haltung & Fadenkreuz“** (standardmäßig an, abschaltbar unter Optionen → Ressourcenpakete): dickere 3D-Items, natürlichere Haltung für Werkzeuge, Items und Blöcke in First und Third Person sowie ein schlichtes Fadenkreuz.

## Abschalten – jederzeit
- `K`: alle Animationen an/aus
- `O`: Einstellungen. Dort lassen sich First Person, Third Person, Kamera und Item-Physik einzeln schalten, jeweils mit Stärke von 25 % bis 200 %. Einzelne Effekte (Trägheit, Schläge, Atmen …) sind ebenfalls schaltbar.
- Konfigurationsdatei: `config/livelyhands.json`
