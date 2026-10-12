#!/usr/bin/env python3
"""Build data/manamon-data.js from the four guide text files in source-docs/.

Run it again whenever a guide file changes:

    python3 tools/build_data.py

It reads:
  - Manamon_2_-_Complete_Type_Advantage_Chart.txt   (type chart)
  - Manamon_2_-_List_of_All_307_Manamons_With_Locations.txt  (types and places)
  - Manamon_2_Guide.txt   (walkthrough: areas and battles in game order)
  - Manamon2_Item_Guide.txt   (items, sorted here into game order)

It prints a short report of anything it could not match, so the guides
and the corrections below can be checked.
"""

import difflib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "source-docs")
OUT = os.path.join(ROOT, "data", "manamon-data.js")

TYPES = ["Flame", "Water", "Plant", "Electric", "Magic", "Dragon", "Air",
         "Insect", "Ghost", "Undead", "Shadow", "Ice", "Holy", "Standard",
         "Earth", "Poison", "Sound", "Fighting", "Stone", "Steel"]

# Words the guides use for a type, mapped to the game's type names.
TYPE_WORDS = {t.lower(): t for t in TYPES}
TYPE_WORDS.update({"fire": "Flame", "flaim": "Flame", "grass": "Plant",
                   "ground": "Earth", "normal": "Standard", "steal": "Steel"})

# ---------------------------------------------------------------------------
# Corrections.  Each one says where the information came from.
# ---------------------------------------------------------------------------

# Types that are known for sure.  These replace whatever the list file says.
TYPE_FACTS = {
    # From your own game screen (NVDA overview text).
    "Mantasteel": (["Steel", "Insect"], "your game screen"),
    "Groller": (["Earth", "Magic"], "your game screen"),
    "Friggle": (["Water", "Electric"], "the Manamon list (Friggle becomes Water and Electric)"),
    "Kangard": (["Fighting"], "the Manamon list"),
    "Zebbabern": (["Flame"], "the Manamon list"),
    "Greniverb": (["Plant", "Sound"], "the walkthrough (Grekko line gains Sound)"),
    # From notes inside the walkthrough battles.
    "Daggeetle": (["Insect", "Holy"], "the walkthrough (Skeeter battle)"),
    "Gossolo": (["Insect", "Sound"], "the walkthrough (Five Feral Gossolo)"),
    "Hydrake": (["Water", "Plant", "Sound"], "the Manamon list (A Water, Grass and Sound type)"),
    "Treezon": (["Plant", "Poison"], "the walkthrough (Roseanne battle)"),
    "Thornita": (["Plant", "Poison"], "the walkthrough (Roseanne battle)"),
    "Dragomier": (["Flame", "Air", "Dragon"], "the walkthrough (Tatsuo battle)"),
    "Glimerodo": (["Dragon", "Electric"], "the walkthrough (Tatsuo battle)"),
    "Lantlare": (["Flame", "Ghost"], "the walkthrough (Blaze battle)"),
    "Dramegon": (["Water", "Dragon"], "the Manamon list (Dramegon swaps Air for Dragon)"),
    "Peggisen": (["Air", "Flame", "Ice", "Electric"], "the Manamon list (Elements: Air, Flame, Ice and Electric)"),
    "Gubbulline": (["Poison"], "the Manamon list (Elements: Poison)"),
    "Mutmo": (["Standard"], "the Manamon list (its other sections are its transformations)"),
    "Slothegor": (["Plant"], "the walkthrough (Mecha Slothegor is a plant type)"),
    "Ghost Lonar": (["Earth", "Standard", "Ghost"], "the walkthrough"),
}

# Types added on top of the list file (the list file missed them).
TYPE_ADD = {
    "Gronk": (["Earth"], "the walkthrough says Gronk is Earth and Magic"),
    "Grandlan": (["Earth"], "same line as Gronk and Groller, which are Earth and Magic"),
    "Blaizond": (["Flame"], "used by the flame Stadium Leader Blaze; it is the Mutmo flame form"),
}

# Extra Manamon that the list file does not give their own entry.
EXTRA_MANAMON = [
    {"id": "55g", "name": "Ghost Lonar", "base": 55,
     "note": "A ghost form of Lonar, found in a hole in Requiem."},
    {"id": "56g", "name": "Ghost Leonatar", "base": 56, "types": ["Earth", "Standard", "Ghost"],
     "uncertain": "Guessed from Ghost Lonar (Earth, Standard and Ghost). Please check in game.",
     "note": "A ghost form of Leonatar. Found at Chinkon Hill and Dyaz Royaum Ruins in Requiem."},
    {"id": "28s", "name": "Storm Jiminar", "base": 28,
     "uncertain": "A storm form of Jiminar. Types copied from Jiminar. Please check in game."},
    {"id": "29s", "name": "Storm Jiminite", "base": 29,
     "uncertain": "A storm form of Jiminite. Types copied from Jiminite. Please check in game."},
    {"id": "30s", "name": "Storm Jimitron", "base": 30,
     "uncertain": "A storm form of Jimitron. Types copied from Jimitron. Please check in game."},
]

# Names in the list file that are missing or broken.
MISSING_LOCATION_NAMES = {
    # line text before the nameless "Location list": the ID it belongs to
    "Dussoket": 139,   # Houndorf
    "Delazzard": 262,  # Waspunch
}

# Wrong ID numbers in the list file: (name, wrong id) -> right id.
LIST_ID_FIXES = {("Merkit", 11): 12}   # Merkit is ID 12; ID 11 is Miterosier

# Manamon the guides never give a type for.
NO_TYPE_INFO = {
    "Deciced": "None of the guides say what type Deciced is. Please check in game and add its types here.",
}

# Spellings used in the walkthrough that the matcher should know.
NAME_ALIASES = {
    "grenaverb": "Greniverb", "shadina": "Shadyena", "caberain": "Kaboerain",
    "limptoroom": "Limtoroom", "frorgerel": "Frorgeril", "zebabern": "Zebbabern",
    "murkat": "Merkit", "plasebot": "Placebot", "lantler": "Lantlare",
    "dramagon": "Dramegon", "farivia": "Furivia", "colovaird": "Colovaird",
    "brain dodderator": "Blade Dodderator", "groler": "Groller",
    "javoltric": "Javoltrik", "clubble": "Clubbull", "squirmonc": "Squirmunk", "montore": "Montor",
}

# Bosses and special battles: which Manamon (if any) they really are.
BOSS_MANAMON = {
    "Hyper Mondevol": "Mondevol", "Hyper Symphonid": "Symphonid",
    "Hyper Symphonid Rematch": "Symphonid", "Hathorilian": "Hathorilian",
    "4 Hathorilians": "Hathorilian", "Hyper Hathorilian": "Hathorilian",
    "Hyper Maustodon": "Maustodon", "Hyper Tarboo": "Tarboo",
    "Hyper Grandlan": "Grandlan", "Mecha Slothegor": "Slothegor",
}

# Starter lines: Byron always picks the starter line that beats yours.
STARTER_LINES = {
    "Lavrog": ["Lavrog", "Ribignis", "Golavath"],
    "Kiduddle": ["Kiduddle", "Gowater", "Kaboerain"],
    "Grekko": ["Grekko", "Greniverb", "Bamboustica"],
}
# your starter -> the line Byron uses
BYRON_PICKS = {"Lavrog": "Kiduddle", "Grekko": "Lavrog", "Kiduddle": "Grekko"}

# Item guide areas -> walkthrough heading line where you first arrive.
# Side areas the walkthrough never visits have "side" and a hint instead.
# Occurrence numbers handle area names that appear twice in the item guide.
ITEM_AREA_PLACES = {
    "Your House": 268, "Elatia Path": 364, "Elatia City": 399,
    "Elatia Walkway": {"side": "Reached from Elatia. You said this path only opens later, "
                               "after you clear a blocked path with the Crowbar or the Old Hammer."},
    "Qweugum Swamp": {"side": "The swamp near Elatia (the Mutmo house is here). You said you reach it "
                              "much later, after clearing a blocked path with the Crowbar or the Old Hammer."},
    "Siccitas Road": 466, "Konduan City": 558, "Art Museum": 592,
    "Oghma's House#1": 558, "Wudrest Valley": 714, "Solphear Cave": 1039,
    "Solphear Cave F2": {"side": "Upper floor of Solphear Cave. The walkthrough does not go here."},
    "Vermechaw City": 833, "Coin Quest": 833, "Vermechaw Powerplant": 879,
    "Arduryx Hill": 1057, "Struttal Cave": 1100, "Struttal Cave F2": 1159,
    "Struttal Cave F3": 1190, "Struttal Cave F4, Up the Ladder": 1258,
    "Solphoa Peninsula": 1297, "Peninsula Wilds": 1495, "Polar Preserve": 1511,
    "Shadow Canyon": 1556, "Ancient Stadium": 1628, "Great Hall": 1660,
    "Submarine Tunnel": 6570, "Route Roshaw": 1875,
    "Brytanburg Wilderness Front": 2003, "Brytanburg Wilderness": 2013,
    "Haunted Thicket": {"side": "A forest the walkthrough does not visit. "
                                "It has a climbable tree, so bring the Rope."},
    "Brytanburg City": 2158, "Brytanburg City/North": 2235, "Brytanburg City/South": 2425,
    "Brytanburg Worship Space": 3158, "Ancient Crypt": 3167, "Thunder Prairie": 2402,
    "Dyeur Hills": 2467, "Mechamo City": 2582, "Seult Desert": 2832, "Seulee City": 2959,
    "Oghma's House#2": 3252, "Requia Gallery": 3471, "Old Cave": 3493,
    "Grotena Rainforest": 3504, "Mamish Outskirts": 3653, "Great Cave Geodaehan": 3714,
    "Abandoned Shrine": 3727, "Mamia": 3808, "Aimort Plateau": 3944,
    "Springdale Turf": 2975, "Eternity Studio": 4074, "Eternity Studio/Eternity Studio F2": 4099,
    "Eternity Studio/Eternity Studio F3": 4177, "Eternity Studio/Eternity Studio F4": 4233,
    "Eternity Studio/Eternity Studio F5": 4308, "Greater Catacombs": 4354,
    "Chinkon Hill": 4377, "Dyaz Royaum Ruins": 6427, "Requiem Castle": 4400,
    "Drumineshire Hamlet": 4437, "Barren Underground": 4455,
    "Barren Underground/Barren Underground F2, Quartantula": 4477,
    "Barren Underground/Barren Underground F2, Chiroperta": 4522,
    "Barren Underground/Barren Heart": 4640,
    "Hinterland Shelter": 4700, "Frozen Hinterland": 4694, "Edge of the World": 4857,
    "Lower catacombs": {"side": "The Lower Catacombs in Requiem. The walkthrough does not go here."},
    "Lower Catacombs F2": {"side": "The Lower Catacombs in Requiem. The walkthrough does not go here."},
    "Lower Catacombs F3": {"side": "The Lower Catacombs in Requiem. The walkthrough does not go here."},
    "Lower Catacombs F4": {"side": "The Lower Catacombs in Requiem. The walkthrough does not go here."},
    "Lower Catacombs F5": {"side": "The Lower Catacombs in Requiem. The walkthrough does not go here."},
    "Tradale Coast": 5152, "Tradale Village": 5216, "Sonasette Tunnel": 5566,
    "Sonasette City": 5571, "Kiarre Ocean": 5368, "Mordunt Island": 5425,
    "Cave of Fates F2": {"side": "Lower part of the Cave of Fates near Lellapol Village. "
                                 "The walkthrough does not go here."},
    "Cave of Fates F0": {"side": "Lower part of the Cave of Fates near Lellapol Village. "
                                 "The walkthrough does not go here."},
    "Fateful Underground": {"side": "Under the Cave of Fates. The walkthrough does not go here."},
    "Guardian Chamber (Cave of Fates)": {"side": "Inside the Cave of Fates. The walkthrough does not go here."},
    "Validation Road": 5603, "Ascendance Path": 5698,
    "Ascendance Path/Ascendance Path F2": 5704, "Ascendance Path/Ascendance Path F3": 5795,
    "Ascendance Path/Ascendance Path F4": 5815, "Ascendance Path/Ascendance Path F5": 5874,
    "Ascendance Path/Ascendance Path F6": 5916,
    "Ascendance Path/Ascendance Path F9, Ice Area": 6012,
    "Ascendance Path/Ascendance Path F9, Water Area": 6026,
    "Ascendance Path/Ascendance Path F10, Fire Area": 6017,
}

# Tools that open up places.  "line" = walkthrough line where you get it.
# Tools with no line depend on your own Manamon, so you tick them yourself.
TOOLS = [
    {"id": "hammer", "name": "Old Hammer", "need": "the Old Hammer", "what": "breaks rocks", "line": 1855,
     "where": "the Lookout, after beating Master Dyaz in Shadow Canyon"},
    {"id": "crowbar", "name": "Crowbar", "need": "the Crowbar", "what": "moves logs", "line": 2114,
     "where": "a chest in Brytanburg Wilderness"},
    {"id": "rope", "name": "Rope", "need": "the Rope", "what": "climbs trees and metal posts", "line": 3242,
     "where": "a man in Seulee City, after you show him the Demon Key (fourth stadium)"},
    {"id": "swim", "name": "Swim Gear", "need": "the Swim Gear", "what": "lets you swim", "line": 3619,
     "where": "Grotena Rainforest, in Kwensette"},
    {"id": "postgame", "name": "Game finished", "need": "to finish the game first", "what": "opens post game places and ice slides", "line": 6212,
     "where": "after you beat the Master Stadium"},
    {"id": "dive", "name": "Dive", "need": "Dive (Diver's Gear or the move Dive)", "what": "dives under water", "line": 6572,
     "where": "Diver's Gear in the Submarine Tunnel (post game), or a Manamon with the move Dive"},
    {"id": "tunnel", "name": "A Manamon with Tunnel", "need": "a Manamon that knows Tunnel", "what": "digs under marked trees", "line": None,
     "where": "teach a Manamon the move Tunnel. Hilimer learns it early (Struttal Cave)"},
    {"id": "detector", "name": "Item Detector", "need": "the Item Detector", "what": "finds hidden items", "line": None,
     "where": "under the marked tree in Thunder Prairie (needs Tunnel)"},
    {"id": "key", "name": "Treasure Chest Key", "need": "a Treasure Chest Key", "what": "opens locked chests", "line": None,
     "where": "many places, the first is a chest in Elatia Path. Each key opens one chest"},
]

# Requirement rules for item text.  (regular expression, tool id)
REQUIREMENT_RULES = [
    (r"\bclimb|metal post|up the tree|the pole\b", "rope"),
    (r"breakable rock|breaking a rock|behind a rock|break the thing", "hammer"),
    (r"\blog\b", "crowbar"),
    (r"\bswim|in the water|floating in the water|chest in the water|into the water|patch of water", "swim"),
    (r"buried under|with tunnel", "tunnel"),
    (r"locked (treasure )?chest|locked chest", "key"),
]

# Item fixes after reading each item by hand: (area, item start) -> settings.
#   needs: replaces the rule result.   after: walkthrough line it opens at.
ITEM_FIXES = {
    ("Solphear Cave", "Treasure Chest Key"): {"needs": ["swim"], "note": "Or walk in from the Tradale Coast side later."},
    ("Great Hall", "Bone Dagger"): {"needs": []},
    ("Great Hall", "Old Hammer"): {"needs": []},
    ("Haunted Thicket", "Hundred Arm Coat"): {"needs": []},
    ("Haunted Thicket", "Treasure Chest Key"): {"needs": []},
    ("Haunted Thicket", "UP Boost x2 + Max UP Boost"): {"needs": ["key"]},
    ("Haunted Thicket", "Kumori Cloak"): {"needs": ["rope"]},
    ("Thunder Prairie", "Item Detector"): {"needs": ["tunnel"]},
    ("Thunder Prairie", "Antique Jewel x5"): {"needs": ["tunnel", "key"]},
    ("Thunder Prairie", "*50 gold x20 (?)"): {"needs": ["swim", "detector"]},
    ("Thunder Prairie", "*Treasure Chest Key"): {"needs": [], "note": "The Item Detector makes it easy to find."},
    ("Polar Preserve", "Ice Staff"): {"needs": ["postgame"], "note": "The ice slide only works after you finish the game."},
    ("Polar Preserve", "Life Tonic"): {"needs": ["postgame", "swim"], "note": "The ice slide only works after you finish the game."},
    ("Seulee City", "Rope"): {"after": 3242},
    ("Oghma's House#2", "*5000 gold"): {"needs": [], "note": "The Item Detector makes it easy to find."},
    ("Oghma's House#2", "Domestress Belt"): {"needs": ["rope"]},
    ("Springdale Turf", "Willow Hammer"): {"needs": ["rope"], "note": "Or swim through the water instead of climbing."},
    ("Springdale Turf", "Sheepskin Outfit"): {"needs": ["swim"]},
    ("Springdale Turf", "Giganet x3 + Meganet x5 + Silver Tonic"): {"needs": ["swim", "key"]},
    ("Springdale Turf", "Life Tonic"): {"needs": ["swim"]},
    ("Requiem Castle", "Requiem Dust"): {"needs": ["postgame"], "note": "Battle Andromeda after you can time travel."},
    ("Validation Road", "Powerhit Bracer"): {"after": 5678},
    ("Validation Road", "Treadmill Game Disk"): {"after": 5678},
    ("Brytanburg City/North", "Family Heart"): {"needs": [], "after": 2414, "note": "Music Hall reward."},
    ("Great Cave Geodaehan", "Dojo Shield"): {"needs": []},
    ("Struttal Cave F2", "Slingshot Blaster + 5000 gold"): {"needs": ["hammer"]},
    ("Vermechaw Powerplant", "Strong Herb x2"): {"needs": [], "after": 1018},
    ("Thunder Prairie", "Word Chain Game Disk"): {"needs": ["swim"]},
    ("Springdale Turf", "Chlorophyll Element"): {"needs": []},
    ("Qweugum Swamp", "Sweet Tonic"): {"needs": []},
    ("Brytanburg City/North", "Treasure Chest Key"): {"needs": [], "after": 2414, "note": "Music Hall reward."},
    ("Brytanburg City/North", "Gene Emblem"): {"needs": [], "after": 2414, "note": "Music Hall reward."},
    ("Submarine Tunnel", "Diver's Gear"): {"needs": ["postgame", "swim"]},
    ("Submarine Tunnel", "Update Installer"): {"needs": ["postgame", "dive"]},
    ("Submarine Tunnel", "Screen Shield"): {"needs": ["postgame", "dive"]},
    ("Submarine Tunnel", "*1000 gold"): {"needs": ["postgame", "dive"]},
    ("Ascendance Path/Ascendance Path F9, Water Area", "Revival Mist"): {"needs": []},
    ("Fateful Underground", "Perfect Glasses"): {"needs": []},
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

REPORT = []


def report(msg):
    REPORT.append(msg)


def read(name, encoding="utf-8"):
    with open(os.path.join(SRC, name), "rb") as f:
        text = f.read().decode(encoding)
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace(" ", " ")
    text = text.replace("’", "'").replace("…", "...")
    return text.split("\n")


def norm(name):
    return re.sub(r"[^a-z]", "", name.lower())


def type_list(text):
    """'Steel and Insect' or 'Flame, Air, and Dragon' -> ['Steel', 'Insect']."""
    text = re.sub(r"\band\b|&|/", ",", text)
    out = []
    for w in text.split(","):
        w = w.strip().strip(".").lower()
        if not w:
            continue
        if w in TYPE_WORDS:
            out.append(TYPE_WORDS[w])
        else:
            return None
    return out


# ---------------------------------------------------------------------------
# 1. Type chart
# ---------------------------------------------------------------------------

def build_chart():
    lines = read("Manamon_2_-_Complete_Type_Advantage_Chart.txt")
    offense, defense = {}, {}
    cur = None
    for line in lines:
        line = line.strip()
        if line in TYPES:
            cur = line
            continue
        if not cur:
            continue
        m = re.match(r"\w+ (is very effective against|is not very effective against|does not effect|"
                     r"is susceptible to|is resistant to|is immune to) (.*)$", line)
        if not m:
            continue
        kind, rest = m.group(1), m.group(2)
        if rest.strip(". ").lower() == "nothing":
            continue
        for t in type_list(rest) or []:
            if kind == "is very effective against":
                offense[(cur, t)] = 2
            elif kind == "is not very effective against":
                offense[(cur, t)] = 0.5
            elif kind == "does not effect":
                offense[(cur, t)] = 0
            elif kind == "is susceptible to":
                defense[(t, cur)] = 2
            elif kind == "is resistant to":
                defense[(t, cur)] = 0.5
            elif kind == "is immune to":
                defense[(t, cur)] = 0
    chart = {a: {d: 1 for d in TYPES} for a in TYPES}
    notes = []
    for key in set(offense) | set(defense):
        a, d = key
        off, de = offense.get(key), defense.get(key)
        if off is not None and de is not None and off != de:
            notes.append(f"{a} attacking {d}: the chart's two halves disagree ({off} and {de}).")
        # The defensive half lists immunities the attack half forgets, so it wins.
        chart[a][d] = de if de is not None else off
    for key in set(offense) ^ set(defense):
        a, d = key
        if (offense.get(key, 1)) != (defense.get(key, 1)):
            notes.append(f"{a} attacking {d}: only one half of the chart says {chart[a][d]}x. "
                         f"Using {chart[a][d]}x.")
    for n in notes:
        report("Type chart: " + n)
    return chart, notes


# ---------------------------------------------------------------------------
# 2. Manamon list
# ---------------------------------------------------------------------------

def build_manamon():
    lines = [l.strip() for l in read("Manamon_2_-_List_of_All_307_Manamons_With_Locations.txt")]
    loc_start = lines.index("Locations")
    mons = {}          # id -> dict
    by_norm = {}       # normalised name -> id

    def get(mid):
        if mid not in mons:
            mons[mid] = {"id": mid, "name": None, "aliases": [], "types": [], "typeSources": {},
                         "chainOnly": set(), "evolvesTo": [], "evolvesFrom": [], "locations": [],
                         "notes": [], "uncertain": ""}
        return mons[mid]

    def add_name(m, name):
        name = name.strip()
        if not name:
            return
        if m["name"] is None:
            m["name"] = name
        elif norm(name) != norm(m["name"]) and name not in m["aliases"]:
            m["aliases"].append(name)
        by_norm.setdefault(norm(name), m["id"])

    entry_re = re.compile(r"^(?:Name, )?(.+?)(?: \((?:legend|[^)]*)\))?, ID (\d+)\.?\s*(\(.*\))?$")

    # --- type sections ---
    section = None
    prev_id, pending_evo = None, None
    sec_entries = []
    for i in range(loc_start):
        line = lines[i]
        m = re.match(r"^(\w+) [Tt]ypes$", line)
        if m:
            section = TYPE_WORDS[m.group(1).lower()]
            prev_id, pending_evo = None, None
            continue
        if not section:
            continue
        if re.match(r"^(Evolves|Evolution)", line):
            pending_evo = (pending_evo + " " + line) if pending_evo else line
            if prev_id is not None:
                mons[prev_id]["chainOnly"].add(section)
            continue
        if line.startswith("A tip:"):
            if prev_id is not None:
                mons[prev_id]["notes"].append(line)
            continue
        if line in ("Jiminar", "Jiminite"):
            mid = 28 if line == "Jiminar" else 29
        else:
            em = entry_re.match(line)
            if not em:
                continue
            mid = int(em.group(2))
            names = em.group(1)
            mid = LIST_ID_FIXES.get((names.strip(), mid), mid)
            m_ = get(mid)
            for nm in re.split(r", or ", names):
                add_name(m_, nm)
            if em.group(3):
                m_["notes"].append(em.group(3).strip("()"))
        m_ = get(mid)
        if line in ("Jiminar", "Jiminite"):
            add_name(m_, line)
        if section not in m_["types"]:
            m_["types"].append(section)
            m_["typeSources"][section] = "the Manamon list"
        if pending_evo:
            how = re.sub(r"\s+(in|into)\.?$", "", pending_evo.strip())
            how = re.sub(r"\s+Evolves$", "", how)
            how = re.sub(r"@\s*level\s*", "at level ", how).replace("@any", "at any")
            pending_evo = "no details given" if how == "Evolves" else how
        if pending_evo and prev_id is not None:
            edge = (prev_id, mid, pending_evo)
            if not any(e[0] == mid for e in mons[prev_id]["evolvesTo"]):
                mons[prev_id]["evolvesTo"].append((mid, pending_evo))
            if not any(e[0] == prev_id for e in m_["evolvesFrom"]):
                m_["evolvesFrom"].append((prev_id, pending_evo))
        prev_id, pending_evo = mid, None
        sec_entries.append((section, mid))

    # --- locations ---
    cur = None
    region = None
    header_seen = False
    i = loc_start + 1
    while i < len(lines):
        line = lines[i]
        i += 1
        if not line:
            continue
        em = entry_re.match(line)
        if em:
            mid = int(em.group(2))
            cur = get(mid)
            for nm in re.split(r", or ", em.group(1)):
                add_name(cur, nm)
            region = None
            header_seen = False
            continue
        gm = re.match(r"^Name, (Ghost \w+)$", line)
        if gm:
            cur = {"virtual": gm.group(1), "locations": [], "notes": []}
            EXTRA_LOCS[gm.group(1)] = cur
            region = None
            continue
        if line.startswith("Storm Jimi") or line == "Brain Dodderator":
            if line.startswith("Storm"):
                cur = {"virtual": line, "locations": [], "notes": []}
                EXTRA_LOCS[line] = cur
            region = None
            continue
        if cur is None:
            continue
        if line == "Location list":
            # A second header with no name: it belongs to the ID in MISSING_LOCATION_NAMES.
            if header_seen and cur.get("id") is not None:
                for key, fix_id in MISSING_LOCATION_NAMES.items():
                    if norm(key) == norm(cur.get("name") or ""):
                        cur = get(fix_id)
            region = None
            header_seen = True
            continue
        if line.startswith("Location"):
            header_seen = True
        if line.startswith("Location information unavailable"):
            if "(" in line:
                cur["notes"].append(line[line.index("(") + 1:].rstrip(")"))
            continue
        if line.startswith("Location:") or line.startswith("Location (") or line == "Location:":
            rest = line.split(":", 1)[1].strip()
            if rest:
                cur["locations"].append({"region": "", "place": rest})
            continue
        if line in ("Tangeria", "Kiarre", "Requiem", "Kwensette") or re.match(r"^(Tangeria|Kiarre):?\s*$", line):
            region = line.rstrip(":")
            continue
        m2 = re.match(r"^(Tangeria|Kiarre):\s*(.+)$", line)
        if m2 and not m2.group(2).startswith("Location information"):
            cur["locations"].append({"region": m2.group(1), "place": m2.group(2)})
            continue
        if re.search(r"weighs .* KG", line):
            continue
        if line.startswith("Elements"):
            cur["notes"].append(line.replace("Flaim", "Flame"))
            continue
        if line.startswith("Transformation of"):
            cur["notes"].append(line)
            continue
        cur["locations"].append({"region": region or "", "place": line})

    # Missing Dragomier entry (the list repeats Dragetull's line instead).
    get(122)
    if not mons[122]["name"]:
        add_name(mons[122], "Dragomier")
    return mons, by_norm


EXTRA_LOCS = {}


def finish_manamon(mons, by_norm, guide_types):
    """Apply guide facts, corrections and uncertainty flags."""
    def find(name):
        return by_norm.get(norm(name)) or by_norm.get(norm(NAME_ALIASES.get(name.lower(), "")))

    for mid, m in mons.items():
        if not m["name"]:
            report(f"Manamon ID {mid} has no name in the list file.")
            m["name"] = f"Manamon {mid}"

    # Walkthrough "#Name / Type: X" entries.
    for name, (types, text) in guide_types.items():
        mid = find(name)
        if mid is None:
            continue
        m = mons[mid]
        if types:
            m["types"] = list(types)
            m["typeSources"] = {t: "the walkthrough" for t in types}
            m["confirmed"] = "the walkthrough"
        if text:
            m["guideNotes"] = text

    for name, (types, source) in TYPE_FACTS.items():
        mid = find(name)
        if mid is None:
            continue
        mons[mid]["types"] = list(types)
        mons[mid]["typeSources"] = {t: source for t in types}
        mons[mid]["confirmed"] = source

    for name, (types, source) in TYPE_ADD.items():
        mid = find(name)
        if mid is None:
            report(f"TYPE_ADD: no Manamon called {name}")
            continue
        for t in types:
            if t not in mons[mid]["types"]:
                mons[mid]["types"].append(t)
                mons[mid]["typeSources"][t] = source

    for name, why in NO_TYPE_INFO.items():
        mid = find(name)
        if mid is not None and not mons[mid]["types"]:
            mons[mid]["uncertain"] = why

    # A transformation keeps the types of its earlier form (as far as the
    # guides show).  Add confirmed types the list file forgot, but flag them.
    def carry(mid, types, origin, seen):
        for to_id, _ in mons[mid]["evolvesTo"]:
            if to_id in seen:
                continue
            seen.add(to_id)
            nxt = mons[to_id]
            missing = [t for t in types if t not in nxt["types"]]
            if missing and not nxt.get("confirmed"):
                nxt["types"].extend(missing)
                for t in missing:
                    nxt["typeSources"][t] = f"its earlier form {origin}"
                nxt["uncertain"] = (f"The Manamon list does not give it {' and '.join(missing)}, but its "
                                    f"earlier form {origin} has it, so it was added. Please check in game.")
            carry(to_id, types, origin, seen)
    for mid, m in list(mons.items()):
        # Mutmo's forms each take one new type, so they do not keep Standard.
        if m.get("confirmed") and m["name"] != "Mutmo":
            carry(mid, list(m["types"]), m["name"], {mid})

    # Types that only come from being the start of a transformation line
    # might really belong to the later forms.  Mark them so the app can warn.
    for mid, m in mons.items():
        if m.get("confirmed") or m.get("uncertain"):
            continue
        shaky = [t for t in m["types"] if t in m["chainOnly"] and len(m["types"]) > 1]
        later = set()
        for to_id, _ in m["evolvesTo"]:
            later.update(mons[to_id]["types"])
        shaky = [t for t in shaky if t in later]
        if shaky:
            m["uncertain"] = ("The Manamon list puts it under " + " and ".join(shaky) +
                              " only as the start of its transformation line. Its later forms have "
                              "that type, but this one might not. Please check in game.")


def parse_guide_manamon_notes(lines):
    """'#Name' blocks -> {name: (types or None, description)}."""
    out = {}
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("#") and len(line) > 1 and line[1] not in " (":
            name = line[1:].strip()
            body = []
            j = i + 1
            while j < len(lines) and lines[j].strip():
                body.append(lines[j].strip())
                j += 1
            types = None
            if body and body[0].lower().startswith("type:"):
                types = type_list(body[0].split(":", 1)[1])
                body = body[1:]
            body = [b for b in body if b != "???"]
            out[name] = (types, " ".join(body))
            i = j
        else:
            i += 1
    return out


# ---------------------------------------------------------------------------
# 3. Walkthrough steps (areas and battles, in game order)
# ---------------------------------------------------------------------------

OPP_RE = re.compile(r"^(?:(?P<owner>[A-Z][\w]*)'s?\s+)?(?P<name>[A-Za-z][A-Za-z .\-]*?) is level(?: level)?\s+(?P<lvl>\d+)"
                    r"(?:\s*\(.*?\))?(?:\s+with (?:a |an |the )?\s*(?P<equip>.+?) (?:equipped|quipped))?")


def parse_opponent_line(line, resolve):
    line = line.strip().rstrip(".")
    found = []
    alt = re.match(r"^(.+?), (.+?),? or (.+?) is level (\d+)", line)
    if alt:
        names = [alt.group(1), alt.group(2), alt.group(3)]
        ids = [resolve(n) for n in names]
        return [{"alts": [{"name": n.strip(), "id": i} for n, i in zip(names, ids)],
                 "level": int(alt.group(4))}]
    parts = re.split(r",? and (?=[A-Z][\w]*'?s? ?[A-Za-z ]*? is level)|, (?=[A-Z][\w]*'?s? ?[A-Za-z ]*? is level)", line)
    for p in parts:
        m = OPP_RE.match(p.strip())
        if not m:
            continue
        name = m.group("name").strip()
        equip = (m.group("equip") or "").strip()
        o = {"name": name, "id": resolve(name), "level": int(m.group("lvl"))}
        if m.group("owner"):
            o["owner"] = m.group("owner")
        if equip:
            o["equip"] = equip
        found.append(o)
    return found


def build_steps(lines, resolve):
    steps = []
    started = False
    i = 0
    n = len(lines)
    heading_re = re.compile(r"^(@@|@|_|\*|!|\$Chinkon Hill)(.*)$")
    while i < n:
        line = lines[i]
        m = heading_re.match(line)
        if line.startswith("*End of Top Section"):
            started = True
        if not started or not m or (m.group(2)[:1] in (" ", "(") and m.group(1) != "$Chinkon Hill"):
            i += 1
            continue
        mark, title = m.group(1), m.group(2).strip()
        lineno = i + 1
        if title.startswith("End of Top Section"):
            i += 1
            continue
        # body = lines until the next heading
        j = i + 1
        body = []
        while j < n and not heading_re.match(lines[j]) and not (
                lines[j].startswith("*") and not lines[j].startswith("* ")):
            body.append(lines[j])
            j += 1
        step = {"line": lineno}
        if mark in ("@", "@@"):
            title = re.sub(r"\s*\(not real stadium.*\)", "", title)
            step["kind"] = "battle"
            step["major"] = mark == "@@"
            step["title"] = title
            # opponents = block until first blank line
            block = []
            k = 0
            while k < len(body) and body[k].strip():
                block.append(body[k].strip())
                k += 1
            opps, notes = [], []
            boss_level = None
            for b in block:
                lv = re.match(r"^Level:\s*(\d+)", b)
                if lv:
                    boss_level = int(lv.group(1))
                    continue
                got = parse_opponent_line(b, resolve) if " is level" in b else []
                for g in list(got):
                    if g.get("name", "").lower() == "it":   # "It is level 90."
                        boss_level = g["level"]
                        got.remove(g)
                if got:
                    opps.extend(got)
                else:
                    notes.append(b)
            fg = re.search(r"There are (\d+) of these, all of them being level (\d+)", " ".join(block))
            if title.startswith("Five Feral Gossolo"):
                opps = [{"name": "Gossolo", "id": resolve("Gossolo"), "level": 20, "count": 5}]
            boss = BOSS_MANAMON.get(title)
            if boss and not opps:
                opps = [{"name": title, "id": resolve(boss), "level": boss_level, "boss": True}]
            if boss_level is not None:
                step["bossLevel"] = boss_level
            step["opponents"] = opps
            step["notes"] = notes
            # Lines after the battle block until the next heading = narrative.
            rest = "\n".join(x for x in body[k:]).strip()
            step["after"] = rest
        else:
            if mark == "*":
                step["kind"] = "chapter"
            else:
                step["kind"] = "area"
            if mark == "$Chinkon Hill":
                title = "Chinkon Hill"
            step["title"] = title.rstrip(".").replace("_", "")
            wild = []
            for b in body:
                wm = re.match(r"^Manamon (?:Available|Present):\s*(.*)$", b.strip())
                if not wm:
                    continue
                for w in wm.group(1).split(","):
                    w = w.strip().rstrip(".")
                    low = w.lower()
                    if not w or low.startswith(("none", "nothing", "redacted", "undocumented")):
                        continue
                    if low.startswith(("same as", "everything")):
                        # "Same as outside", "Everything from F1": copy the last list
                        for prev in reversed(steps):
                            if prev.get("wild"):
                                for x in prev["wild"]:
                                    if x["name"] not in [y["name"] for y in wild]:
                                        wild.append(dict(x))
                                break
                        continue
                    w = re.sub(r"^plus ", "", w)
                    if w not in [x["name"] for x in wild]:
                        wild.append({"name": w, "id": resolve(w)})
            if wild:
                step["wild"] = wild
            step["text"] = "\n".join(body).strip()
        steps.append(step)
        i = j
    for idx, s in enumerate(steps):
        s["n"] = idx
    return steps


# ---------------------------------------------------------------------------
# 4. Item guide
# ---------------------------------------------------------------------------

def tool_line(tool_id):
    for t in TOOLS:
        if t["id"] == tool_id:
            return t["line"]
    return None


def build_items(steps):
    lines = read("Manamon2_Item_Guide.txt", "cp1252")
    areas = []
    shops = []
    rewards = []
    seen = {}
    cur = None
    sub = None
    mode = "items"
    shop = None
    for raw in lines:
        line = raw.rstrip()
        if not line.strip():
            continue
        if line.startswith("Bonus: Shop Lists"):
            mode = "shops"
            continue
        if line.startswith("Bonus: Manapedia"):
            mode = "rewards"
            continue
        is_item = raw.startswith("\t") or raw.startswith(" \t")
        text = re.sub(r"^[\s\u2022_.]+", "", line) if is_item else line.strip()
        text = text.strip()
        if mode == "shops":
            if is_item:
                if shop is not None:
                    shop["sections"][-1]["goods"].append(text.rstrip(". "))
            elif line.startswith("Listed below"):
                continue
            elif line.startswith("Note:") or line.startswith("Most things"):
                if shop is not None:
                    shop["note"] = (shop.get("note", "") + " " + line.strip()).strip()
            elif shop is not None and re.match(r"^(F\d|General Goods|Transformation Items)", line.strip()):
                if not shop["sections"][-1]["goods"]:
                    shop["sections"][-1]["name"] = line.strip()
                else:
                    shop["sections"].append({"name": line.strip(), "goods": []})
            else:
                shop = {"name": line.strip(), "sections": [{"name": "", "goods": []}]}
                shops.append(shop)
            continue
        if mode == "rewards":
            if is_item:
                rewards.append(text)
            continue
        if line.startswith("@"):
            name = line[1:].strip().rstrip(":")
            seen[name] = seen.get(name, 0) + 1
            key = name if name != "Oghma's House" else f"Oghma's House#{seen[name]}"
            cur = {"name": name, "key": key, "sub": None, "items": []}
            areas.append(cur)
            sub = None
            continue
        if cur is None:
            continue
        if not is_item:
            if line.startswith("Note:") or line.startswith("Remember the swamp"):
                cur.setdefault("note", "")
                cur["note"] = (cur["note"] + " " + line.strip()).strip()
                continue
            # a sub heading inside an area (a floor, part of a city...)
            subname = line.strip().rstrip(":")
            parent = cur["name"] if cur.get("sub") is None else cur["parent"]
            cur = {"name": subname, "key": f"{parent}/{subname}", "parent": parent,
                   "sub": subname, "items": []}
            areas.append(cur)
            continue
        cur["items"].append(text)

    # place each area in the walkthrough
    line_to_step = sorted((s["line"], s["n"]) for s in steps)

    def step_at(line):
        best = None
        for ln, idx in line_to_step:
            if ln <= line:
                best = idx
            else:
                break
        return best

    heading_lines = {ln: idx for ln, idx in line_to_step}

    def unlock_step(line):
        """Step from which something got at this line counts as done."""
        if line in heading_lines:
            return heading_lines[line]
        for ln, idx in line_to_step:
            if ln > line:
                return idx
        return len(steps)

    for t in TOOLS:
        t["step"] = unlock_step(t["line"]) if t["line"] else None

    out_areas = []
    for a in areas:
        key = a["key"]
        place = ITEM_AREA_PLACES.get(key)
        if place is None and a.get("parent"):
            # sub area with no own place: use the parent's
            parent_place = ITEM_AREA_PLACES.get(a["parent"])
            place = parent_place
        if place is None:
            report(f"Item area not placed: {key}")
            place = {"side": "Not placed in the walkthrough."}
        title = a["name"] if not a.get("parent") else f"{a['parent']}, {a['sub']}"
        if key == "Coin Quest":
            title = "Vermechaw City, coin quest"
        if a.get("parent") and a["sub"].startswith(a["parent"]):
            title = a["sub"]
        if a.get("parent") == "Brytanburg City":
            title = f"Brytanburg City, {a['sub']}"
        area = {"key": key, "title": title}
        if isinstance(place, dict):
            area["side"] = place["side"]
            area["line"] = None
        else:
            area["line"] = place
            area["step"] = step_at(place)
        if a.get("note"):
            area["note"] = a["note"]
        items = []
        for idx, t in enumerate(a["items"]):
            m = re.match(r"^(\*?)(.+?)(?::\s*(.*))?$", t)
            hidden = bool(m.group(1))
            name = m.group(2).strip()
            where = (m.group(3) or "").strip()
            if key == "Coin Quest":
                name, where = "Coin", t
            needs = []
            low = where.lower()
            for rx, tool in REQUIREMENT_RULES:
                if re.search(rx, low) and tool not in needs:
                    needs.append(tool)
            item = {"name": name, "where": where, "hidden": hidden}
            fix = ITEM_FIXES.get((key, ("*" if hidden else "") + name)) or ITEM_FIXES.get((key, name))
            after = None
            if fix:
                if "needs" in fix:
                    needs = list(fix["needs"])
                if fix.get("note"):
                    item["note"] = fix["note"]
                if fix.get("after"):
                    after = fix["after"]
            # Tools you already must have to be in this area are not listed.
            if area.get("line"):
                needs = [t for t in needs if not (tool_line(t) and tool_line(t) <= area["line"])]
            item["needs"] = needs
            if after:
                item["afterLine"] = after
                item["afterStep"] = unlock_step(after)
            item["id"] = f"{key}#{idx}"
            items.append(item)
        area["items"] = items
        if items:
            out_areas.append(area)

    # sort: walkthrough order first, side areas at the end (kept in guide order)
    order = {id(a): i for i, a in enumerate(out_areas)}
    out_areas.sort(key=lambda a: (a["line"] is None, a["line"] or 0, order[id(a)]))

    # shops: place by name (the first walkthrough area with that name)
    def first_area(name):
        for st in steps:
            if st["kind"] == "area" and norm(name) and norm(name) in norm(st["title"]):
                return st["line"]
        return None
    for s in shops:
        nm = s["name"]
        line = first_area(nm)
        if line is None:
            base = re.sub(r"(, Equipment Vender|, YGC Shop| Equipment Vender| Local Shop| Shopkeeper)$", "", nm)
            line = first_area(base) or first_area(base.replace(" Shelter", ""))
        if line is None:
            report(f"Shop not placed: {nm}")
        s["line"] = line
        s["step"] = step_at(line) if line else None
    shops.sort(key=lambda s: (s["line"] is None, s["line"] or 0))
    return out_areas, shops, rewards


def build_equipment_notes(lines):
    out = {}
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("$") and len(line) > 1 and line[1] not in " (" and not line.startswith("$Chinkon Hill"):
            name = line[1:].strip()
            body = []
            j = i + 1
            while j < len(lines) and lines[j].strip():
                body.append(lines[j].strip())
                j += 1
            out[name] = " ".join(body)
            i = j
        else:
            i += 1
    return out


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main():
    chart, chart_notes = build_chart()
    mons, by_norm = build_manamon()
    guide_lines = read("Manamon_2_Guide.txt")
    guide_types = parse_guide_manamon_notes(guide_lines)
    finish_manamon(mons, by_norm, guide_types)

    # extra forms
    next_extra = []
    for e in EXTRA_MANAMON:
        base = mons[e["base"]]
        m = {"id": e["id"], "name": e["name"], "aliases": [], "types": list(e.get("types") or base["types"]),
             "typeSources": {}, "evolvesTo": [], "evolvesFrom": [], "locations": [], "notes": [],
             "uncertain": e.get("uncertain", ""), "chainOnly": set()}
        fact = TYPE_FACTS.get(e["name"])
        if fact:
            m["types"] = list(fact[0])
            m["confirmed"] = fact[1]
        extra = EXTRA_LOCS.get(e["name"])
        if extra:
            m["locations"] = extra["locations"]
            m["notes"] += extra["notes"]
        if e.get("note"):
            m["notes"].append(e["note"])
        m["formOf"] = base["id"]
        mons[e["id"]] = m
        by_norm[norm(e["name"])] = e["id"]
        next_extra.append(e["id"])

    # Use the spelling the walkthrough uses most as the main name.
    guide_text = "\n".join(guide_lines).lower()
    for m in mons.values():
        cands = [m["name"]] + list(m["aliases"])
        counts = [len(re.findall(r"\b" + re.escape(c.lower()) + r"\b", guide_text)) for c in cands]
        best = max(range(len(cands)), key=lambda k: (counts[k], -k))
        if best != 0 and counts[best] > counts[0]:
            m["aliases"] = [c for c in cands if c != cands[best]]
            m["name"] = cands[best]

    names_norm = list(by_norm.keys())
    unresolved = {}

    def resolve(name):
        name = name.strip()
        key = norm(name)
        if not key or key == "it":
            return None
        if key in by_norm:
            return by_norm[key]
        alias = NAME_ALIASES.get(name.lower())
        if alias and norm(alias) in by_norm:
            return by_norm[norm(alias)]
        close = difflib.get_close_matches(key, names_norm, n=1, cutoff=0.8)
        if close:
            unresolved.setdefault(name, f"guessed {mons[by_norm[close[0]]]['name']}")
            return by_norm[close[0]]
        unresolved[name] = "no match"
        return None

    steps = build_steps(guide_lines, resolve)
    areas, shops, rewards = build_items(steps)
    equipment = build_equipment_notes(guide_lines)

    for name, what in sorted(unresolved.items()):
        report(f"Name in walkthrough: {name!r} -> {what}")

    # Byron's starter-dependent Manamon
    starters = {"lines": STARTER_LINES, "byronPicks": BYRON_PICKS}
    for k, v in STARTER_LINES.items():
        starters["lines"][k] = [{"name": n, "id": resolve(n)} for n in v]

    # final manamon list
    out_mons = []
    for mid, m in mons.items():
        o = {"id": m["id"], "name": m["name"], "types": m["types"]}
        if m["aliases"]:
            o["aliases"] = m["aliases"]
        if m.get("uncertain"):
            o["uncertain"] = m["uncertain"]
        if m.get("confirmed"):
            o["confirmed"] = m["confirmed"]
        if m["evolvesTo"]:
            o["evolvesTo"] = [{"id": t, "how": h} for t, h in m["evolvesTo"]]
        if m["evolvesFrom"]:
            o["evolvesFrom"] = [{"id": t, "how": h} for t, h in m["evolvesFrom"]]
        if m["locations"]:
            o["locations"] = m["locations"]
        if m["notes"]:
            o["notes"] = m["notes"]
        if m.get("guideNotes"):
            o["guideNotes"] = m["guideNotes"]
        if m.get("formOf") is not None:
            o["formOf"] = m["formOf"]
        out_mons.append(o)

    def sort_key(o):
        mid = o["id"]
        if isinstance(mid, int):
            return (mid, "")
        return (int(re.match(r"\d+", mid).group()), mid)
    out_mons.sort(key=sort_key)

    data = {
        "builtFrom": ["Manamon_2_Guide.txt (Rev 06/29/26)", "Manamon_2_-_Complete_Type_Advantage_Chart.txt",
                      "Manamon_2_-_List_of_All_307_Manamons_With_Locations.txt", "Manamon2_Item_Guide.txt"],
        "types": TYPES,
        "chart": chart,
        "chartNotes": chart_notes,
        "manamon": out_mons,
        "steps": steps,
        "tools": TOOLS,
        "itemAreas": areas,
        "shops": shops,
        "manapediaRewards": rewards,
        "equipmentNotes": equipment,
        "starters": starters,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("// Made by tools/build_data.py from the files in source-docs. Do not edit by hand.\n")
        f.write("window.MANAMON_DATA = ")
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    print(f"Manamon: {len(out_mons)}   steps: {len(steps)}   battles: "
          f"{sum(1 for s in steps if s['kind'] == 'battle')}   item areas: {len(areas)}   "
          f"items: {sum(len(a['items']) for a in areas)}   shops: {len(shops)}")
    print(f"Wrote {OUT} ({os.path.getsize(OUT) // 1024} KB)")
    if REPORT:
        print("\nThings to check:")
        for r in REPORT:
            print(" - " + r)


if __name__ == "__main__":
    sys.exit(main())
