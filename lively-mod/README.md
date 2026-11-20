# Lively Hands 2.0 – Fabric 1.21.11 (nur Client)

Übertriebene Animationen für First und Third Person, echte 3D-Items mit Pendel-Physik und ein eingebautes Ressourcenpaket. Die Mod läuft nur auf dem Client, also auf jedem Server.

## Stil (Taste `O` → „Stil“)
Dezent · Normal · Krass · **ÜBERTRIEBEN** (Standard). „Krass“ und „Übertrieben“ schalten Combos, Saltos, Leerlauf-Spielereien und Kamera-Wackeln frei.

## First Person
- Trägheit mit Verstärkung kleiner Bewegungen: Auch die kleinste Mausbewegung ist sichtbar, das Item federt nach.
- Starkes Achter-Wippen beim Gehen, nach einer Sekunde Sprinten zieht der Arm nach hinten. Neigen, Schleichen, Atmen.
- **Combos** mit jedem Item: Hieb, Gegenhieb, und als dritter Schlag ein Finisher mit 360°-Drehung. Schwert, Axt, Spitzhacke, Schaufel, Dreizack und Blöcke haben jeweils eigene Schläge.
- **Faust-Combo** mit leerer Hand: Jab, Haken, Uppercut.
- Rückstoß und Kamera-Wackeln bei Treffern und beim Abbauen, ein harter Aufprall beim Landen.
- Das Item überschlägt sich beim Springen und wirbelt beim Wechseln herein.
- Item-Haltungen: Fackeln hochgehalten, Blöcke tief vor dem Körper, Essen nah dran, Totem schwebend. Bögen zittern beim Spannen, beim Essen wird gekaut.
- `I`: Ansehen mit Hochwerfen und Fangen. Im Leerlauf zwirbelt der Charakter das Item, wirft es hoch und dreht das Handgelenk.

## Third Person (du in F5 und alle anderen Spieler, Rüstung macht alles mit)
- Haltungen je nach Item: Fackel hoch, Eimer und Laterne hängend, Block mit beiden Händen, Bogen gesenkt, Schild seitlich, Waffe in Bereitschaft.
- Großer Armschwung und Wippen beim Gehen, der Oberkörper dreht mit, Anime-Run beim Sprinten.
- Salto beim Sprint-Sprung, Fallschirmspringer-Pose beim Fallen, Superhelden-Landung.
- Klettern, Essen, Zusammenzucken bei Schaden, Faust-Combos und Waffen-Combos mit Ganzkörper-Drehung.
- Im Leerlauf: Umschauen, Strecken, mit dem Fuß tippen.

## 3D & Physik
- **3D-Eimer** (leer, Wasser, Lava, Milch, Pulverschnee) mit Henkel und Füllung.
- **Fisch- und Axolotl-Eimer**: Das Tier schaut aus dem Wasser heraus.
- **3D-Fackeln** (normal, Seelen, Redstone, Kupfer) und **3D-Laternen**.
- Eimer und Laternen schwingen wie ein Pendel, in First Person und an anderen Spielern.
- Item-Physik: Gedroppte Items überschlagen sich, prallen beim Aufkommen zurück und liegen flach auf dem Boden.
- Im Inventar bleiben alle Items flach wie in Vanilla.

## Abschalten – jederzeit
- `K`: alles an/aus
- `O`: Stil, First Person, Third Person, Kamera, Item-Physik (jeweils mit Stärke) und jeden Einzeleffekt schalten
- Ressourcenpaket (3D-Modelle, Haltung, Fadenkreuz): Optionen → Ressourcenpakete
- Datei: `config/livelyhands.json`

Die 3D-Modelle erzeugt `tools/gen_3d_models.py`. Sie verwenden nur Verweise auf Vanilla-Texturen.
