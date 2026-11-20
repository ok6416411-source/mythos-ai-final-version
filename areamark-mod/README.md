# AreaMark – Fabric 1.21.11 (nur Client)

Blöcke und Blockbereiche markieren und farbig hervorheben, schlicht und animiert. Läuft nur auf dem Client, also auf jedem Server.

## Bedienung
| Taste | Funktion |
|---|---|
| `G` | Markier-Modus an. Nochmal `G` speichert (oder beendet, wenn nichts ausgewählt ist). |
| Linksklick | Ecke 1, bis 64 Blöcke weit. Im Markier-Modus wird nichts abgebaut. |
| Rechtsklick | Ecke 2. Im Markier-Modus wird nichts platziert. |
| `H` | Liste: umbenennen, Farbe, ein/aus, Koordinaten kopieren, WorldEdit `//pos1` `//pos2`, Blöcke zählen, löschen |

Nur Ecke 1 setzen und `G` drücken speichert einen einzelnen Block. Bereiche werden pro Welt bzw. Server und pro Dimension gespeichert (`config/areamark/`).

## Animationen
- Gespeicherte Bereiche wachsen aus der ersten Ecke heraus, gelöschte schrumpfen in sich zusammen.
- Die Füllung pulsiert, ein Lichtstreifen läuft an den Seiten hoch und runter, der Rand leuchtet.
- Das Schild mit Name und Größe ploppt auf und schwebt.
- Die Live-Auswahl wechselt fließend die Farbe, die Ecken-Würfel drehen sich, der Block unter dem Fadenkreuz pulsiert.
- Das Hinweis-Banner gleitet von oben herein, die Zeilen der Liste gleiten nacheinander herein.
