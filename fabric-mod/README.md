# SwiftBuild – Fabric 1.21.11

Eine eigene Bau-Mod im Stil von "schnell bauen": Formen in wenigen Klicks, mit Hologramm-Vorschau und Animationen.

## Installation
1. Fabric Loader ≥ 0.17 für Minecraft 1.21.11 und **Fabric API** installieren.
2. `swiftbuild-1.0.0.jar` in den `mods`-Ordner legen (Client **und** Server; im Einzelspieler reicht der Client).

## Bedienung
| Taste | Funktion |
|---|---|
| **Linke Alt-Taste halten** | Radialmenü: Modus wählen, Füllung, Hotbar-Mix, Modifikatoren, Undo/Redo |
| Rechtsklick | Punkte setzen / platzieren (Block in der Hand) |
| Linksklick | Form abbauen. Beim Platzieren: abbrechen |
| Sneaken + Klick | normales Vanilla-Verhalten (z. B. Truhe öffnen) |
| Z / Y | Rückgängig / Wiederholen |
| N | Modifikator-Einstellungen |

**Modi:** Einzeln, Linie, Wand, Boden, Quader, Kreis, Zylinder, Kugel, Pyramide. Füllung jeweils Gefüllt, Hohl oder Kanten.
**Modifikatoren:** Array (wiederholen mit Versatz), Spiegeln (X/Y/Z, Zentrum mittig oder auf Blockkante), Radial (2–16 Segmente), Hotbar-Mix (zufällige Blöcke aus der Hotbar, Vorschau = Ergebnis).

**Animationen:** Blöcke fallen ein, drehen sich und ploppen wellenförmig vom ersten Klick aus ein. Beim Abbauen schrumpfen und drehen sie sich weg. Dazu kommen die pulsierende Hologramm-Vorschau, ein federnd aufklappendes Radialmenü und ein einfahrendes HUD.

Im Überlebensmodus werden Items verbraucht. Formen abbauen geht dort nur bei weichen Blöcken oder mit passendem Werkzeug, Undo gibt Items zurück. Server-Limits stehen in `config/swiftbuild-server.json`, Client-Optionen in `config/swiftbuild-client.json`.

## Bauen aus dem Quellcode
```
./gradlew build   # -> build/libs/swiftbuild-1.0.0.jar
```
