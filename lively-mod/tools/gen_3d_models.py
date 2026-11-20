"""Generates the 3D item models of the built-in resource pack.

Models only reference vanilla textures (nothing is copied). Inventory icons stay vanilla:
each item definition selects the 3D model for every display context except gui/fixed.
The display numbers here must match dev.livelyhands.Hanging (pendulum pivots).
"""
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..", "src", "main", "resources", "resourcepacks", "lively_pack", "assets")
FACES = ("north", "south", "east", "west", "up", "down")


def box(frm, to, tex, tint=False, faces=FACES):
    f = {}
    for side in faces:
        face = {"texture": tex}
        if tint:
            face["tintindex"] = 0
        f[side] = face
    return {"from": list(frm), "to": list(to), "faces": f}


def write(path, data):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w") as fh:
        json.dump(data, fh, indent=1)


# Hanging items hold the grip (top of the handle) at the model centre (8, 8, 8).
BUCKET_DISPLAY = {
    "firstperson_righthand": {"rotation": [0, -30, 0], "translation": [0, 6, 0], "scale": [0.6, 0.6, 0.6]},
    "firstperson_lefthand": {"rotation": [0, 30, 0], "translation": [0, 6, 0], "scale": [0.6, 0.6, 0.6]},
    "thirdperson_righthand": {"rotation": [90, 0, 0], "translation": [0, 0, 0], "scale": [0.55, 0.55, 0.55]},
    "thirdperson_lefthand": {"rotation": [90, 0, 0], "translation": [0, 0, 0], "scale": [0.55, 0.55, 0.55]},
    "ground": {"rotation": [0, 0, 0], "translation": [0, 3, 0], "scale": [0.45, 0.45, 0.45]},
    "head": {"rotation": [0, 0, 0], "translation": [0, 10, 0], "scale": [1.1, 1.1, 1.1]},
    "fixed": {"rotation": [0, 180, 0], "scale": [0.8, 0.8, 0.8]},
}

BUCKET_TEXTURES = {
    "side": "minecraft:block/cauldron_side",
    "inner": "minecraft:block/cauldron_inner",
    "bottom": "minecraft:block/cauldron_bottom",
    "handle": "minecraft:block/iron_block",
    "particle": "minecraft:block/cauldron_side",
}


def bucket_elements():
    return [
        box((4, -6, 4), (12, -5, 12), "#bottom"),
        box((4, -5, 4), (12, 2, 5), "#side"),
        box((4, -5, 11), (12, 2, 12), "#side"),
        box((4, -5, 5), (5, 2, 11), "#side"),
        box((11, -5, 5), (12, 2, 11), "#side"),
        box((5, -5, 5), (11, -4.9, 11), "#inner", faces=("up",)),
        box((3.5, 1, 7.5), (4, 7.5, 8.5), "#handle"),
        box((12, 1, 7.5), (12.5, 7.5, 8.5), "#handle"),
        box((3.5, 7.5, 7.5), (12.5, 8.5, 8.5), "#handle"),
    ]


def fill(tex, tint=False, top=1.0):
    return box((5, -5, 5), (11, top, 11), tex, tint, faces=("up",))


EYE = "minecraft:block/black_concrete"
CREATURES = {
    "axolotl_bucket": ({"pink": "minecraft:block/pink_wool", "gill": "minecraft:block/magenta_wool", "eye": EYE}, [
        box((5.5, 0.5, 6), (10.5, 5, 10), "#pink"),
        box((4.5, 3, 7.5), (5.5, 6, 8.5), "#gill"),
        box((10.5, 3, 7.5), (11.5, 6, 8.5), "#gill"),
        box((6.5, 5, 7.5), (9.5, 6, 8.5), "#gill"),
        box((6.3, 3.2, 5.9), (7.3, 4.2, 6), "#eye"),
        box((8.7, 3.2, 5.9), (9.7, 4.2, 6), "#eye"),
    ]),
    "cod_bucket": ({"body": "minecraft:block/brown_terracotta", "fin": "minecraft:block/light_gray_terracotta", "eye": EYE}, [
        box((6.5, 0, 6.5), (9.5, 6.5, 9.5), "#body"),
        box((5.5, 2, 7.5), (6.5, 4, 8.5), "#fin"),
        box((9.5, 2, 7.5), (10.5, 4, 8.5), "#fin"),
        box((6.8, 4.8, 6.4), (7.6, 5.6, 6.5), "#eye"),
        box((8.4, 4.8, 6.4), (9.2, 5.6, 6.5), "#eye"),
    ]),
    "salmon_bucket": ({"body": "minecraft:block/red_terracotta", "back": "minecraft:block/gray_terracotta", "eye": EYE}, [
        box((6.5, 0, 6.5), (9.5, 7, 9.5), "#body"),
        box((7.5, 2, 9.5), (8.5, 6, 10.5), "#back"),
        box((6.8, 5.2, 6.4), (7.6, 6, 6.5), "#eye"),
        box((8.4, 5.2, 6.4), (9.2, 6, 6.5), "#eye"),
    ]),
    "pufferfish_bucket": ({"body": "minecraft:block/yellow_wool", "spike": "minecraft:block/yellow_terracotta", "eye": EYE}, [
        box((5.5, 0, 5.5), (10.5, 5, 10.5), "#body"),
        box((7.5, 5, 7.5), (8.5, 6.5, 8.5), "#spike"),
        box((4.2, 2.5, 7.5), (5.5, 3.5, 8.5), "#spike"),
        box((10.5, 2.5, 7.5), (11.8, 3.5, 8.5), "#spike"),
        box((7.5, 2.5, 10.5), (8.5, 3.5, 11.8), "#spike"),
        box((6.3, 3, 5.4), (7.3, 4, 5.5), "#eye"),
        box((8.7, 3, 5.4), (9.7, 4, 5.5), "#eye"),
    ]),
    "tropical_fish_bucket": ({"body": "minecraft:block/orange_concrete", "stripe": "minecraft:block/white_concrete", "eye": EYE}, [
        box((6, 0, 7), (10, 6.5, 9), "#body"),
        box((5.9, 2.5, 6.9), (10.1, 3.5, 9.1), "#stripe"),
        box((7.5, 6.5, 7.5), (8.5, 7.5, 8.5), "#body"),
        box((6.5, 4.5, 6.9), (7.3, 5.3, 7), "#eye"),
    ]),
    "tadpole_bucket": ({"body": "minecraft:block/brown_concrete", "eye": EYE}, [
        box((6.5, 0.5, 6.5), (9.5, 3, 9.5), "#body"),
        box((7.5, 1.5, 9.5), (8.5, 2.5, 12), "#body"),
        box((6.8, 2, 6.4), (7.5, 2.7, 6.5), "#eye"),
        box((8.5, 2, 6.4), (9.2, 2.7, 6.5), "#eye"),
    ]),
}

WATER = -12618012  # 0xFF3F76E4, vanilla water colour

FILLED = {
    "bucket": None,
    "water_bucket": ("minecraft:block/water_still", True),
    "lava_bucket": ("minecraft:block/lava_still", False),
    "milk_bucket": ("minecraft:block/white_concrete", False),
    "powder_snow_bucket": ("minecraft:block/powder_snow", False),
}


def item_def(name, model, tint=None):
    three_d = {"type": "minecraft:model", "model": model}
    if tint is not None:
        three_d["tints"] = [{"type": "minecraft:constant", "value": tint}]
    return {
        "model": {
            "type": "minecraft:select",
            "property": "minecraft:display_context",
            "cases": [{"when": ["gui", "fixed"], "model": {"type": "minecraft:model", "model": "minecraft:item/" + name}}],
            "fallback": three_d,
        }
    }


for name, content in FILLED.items():
    elements = bucket_elements()
    textures = dict(BUCKET_TEXTURES)
    tint = None
    if content:
        textures["fill"] = content[0]
        elements.append(fill("#fill", content[1]))
        if content[1]:
            tint = WATER
    write(f"livelyhands/models/item/{name}_3d.json", {"textures": textures, "elements": elements, "display": BUCKET_DISPLAY})
    write(f"minecraft/items/{name}.json", item_def(name, f"livelyhands:item/{name}_3d", tint))

for name, (tex, creature) in CREATURES.items():
    textures = dict(BUCKET_TEXTURES)
    textures["fill"] = "minecraft:block/water_still"
    textures.update(tex)
    elements = bucket_elements() + [fill("#fill", True, top=0.5)] + creature
    write(f"livelyhands/models/item/{name}_3d.json", {"textures": textures, "elements": elements, "display": BUCKET_DISPLAY})
    write(f"minecraft/items/{name}.json", item_def(name, f"livelyhands:item/{name}_3d", WATER))

TORCH_DISPLAY = {
    "firstperson_righthand": {"rotation": [0, -45, 8], "translation": [0, 4, 0], "scale": [1.0, 1.0, 1.0]},
    "firstperson_lefthand": {"rotation": [0, 45, -8], "translation": [0, 4, 0], "scale": [1.0, 1.0, 1.0]},
    "thirdperson_righthand": {"rotation": [0, 0, 0], "translation": [0, 2.5, 0.5], "scale": [0.85, 0.85, 0.85]},
    "thirdperson_lefthand": {"rotation": [0, 0, 0], "translation": [0, 2.5, 0.5], "scale": [0.85, 0.85, 0.85]},
    "ground": {"rotation": [0, 0, 0], "translation": [0, 2, 0], "scale": [0.6, 0.6, 0.6]},
    "head": {"rotation": [0, 0, 0], "translation": [0, 13, 0], "scale": [1, 1, 1]},
}
for name in ("torch", "soul_torch", "redstone_torch", "copper_torch"):
    write(f"livelyhands/models/item/{name}_3d.json", {"parent": f"minecraft:block/{name}", "display": TORCH_DISPLAY})
    write(f"minecraft/items/{name}.json", item_def(name, f"livelyhands:item/{name}_3d"))

# Hanging lanterns: grip at the top of the chain (y = 15), see Hanging.java.
LANTERN_DISPLAY = {
    "firstperson_righthand": {"rotation": [0, -20, 0], "translation": [0, 4, 0], "scale": [0.7, 0.7, 0.7]},
    "firstperson_lefthand": {"rotation": [0, 20, 0], "translation": [0, 4, 0], "scale": [0.7, 0.7, 0.7]},
    "thirdperson_righthand": {"rotation": [90, 0, 0], "translation": [0, 0, -4.9], "scale": [0.7, 0.7, 0.7]},
    "thirdperson_lefthand": {"rotation": [90, 0, 0], "translation": [0, 0, -4.9], "scale": [0.7, 0.7, 0.7]},
    "ground": {"rotation": [0, 0, 0], "translation": [0, 2, 0], "scale": [0.5, 0.5, 0.5]},
    "head": {"rotation": [0, 0, 0], "translation": [0, 13, 0], "scale": [1, 1, 1]},
}
for name in ("lantern", "soul_lantern"):
    write(f"livelyhands/models/item/{name}_3d.json", {"parent": f"minecraft:block/{name}_hanging", "display": LANTERN_DISPLAY})
    write(f"minecraft/items/{name}.json", item_def(name, f"livelyhands:item/{name}_3d"))

print("ok")
