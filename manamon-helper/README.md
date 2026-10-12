# Manamon 2 Helper

A battle and guide helper for the game Manamon 2. It is one web page that works with NVDA and other screen readers. It runs from your own computer. You don't need to install anything, and you don't need the internet.

## How to open it

1. Download this repository. On GitHub, choose "Code", then "Download ZIP", and unzip it.
2. Open the folder `manamon-helper`.
3. Open `index.html` with Chrome, Edge or Firefox.

Keep the `data` folder next to `index.html`. The page needs it.

## What it does

The page has 8 sections. The links to them are at the top, in a navigation landmark. In NVDA browse mode, press D to jump there.

- **Battle helper.** Type an opponent's name. Small spelling mistakes are fine. Press Enter. The helper then tells you:
  - your strongest move against it
  - which of your Manamon takes the least damage from it
  - the best all-round choice: your strongest attacker that does not take extra damage
  - a table of all your moves, strongest first

  You can also set the opponent's types yourself, up to 4 types.
- **What's next.** Choose where you are in the game, or type the name of a place or tamer. The helper shows:
  - the next battles from the walkthrough, with the opponents' levels and types, and your best answer to each one
  - warnings, for example: "Nothing in your party is very effective against Kangard", or "Watch out for Ghost attacks"
  - the next big battle (stadium leader or boss), with the guide's tips
  - tools you will get soon, like the Rope
  - wild Manamon in the places ahead
  - the walkthrough text for the next steps

  When you win a battle, press "I won the next battle" to move on.
- **Items in game order.** The item guide is sorted by map, and it pretends you already have every tool. This section puts the items in the order you reach each place. It also says which tool each item needs: the Old Hammer, the Crowbar, the Rope, the Swim Gear, Tunnel, Dive, the Item Detector, or a Treasure Chest Key.
  - It uses your place from "What's next" to know which tools you have. For example, the Strong Herb on the metal post in the Great Hall shows as "come back later" until you have the Rope.
  - You can show only the items you can get now, or only the ones to come back for. You can also tick items you already picked up.
  - The shop lists are here too.
- **My team.** Your Manamon, their types, and their moves (type, effect points, physical, special or status).
  - The quickest way to update it: copy what NVDA says on each Overview screen and move list, then paste it into the box. The helper reads it and ignores extra lines like chat notifications.
  - Untick "In my party" for Manamon you put in the transportal.
- **Manamon list.** All 307 Manamon, with types, transformations and where to find them. If the game shows different types than the helper, fix them here. Your fix is saved.
- **Type chart.** What a type is good or bad against, and what a set of types is weak to.
- **Settings.** Change the same-type bonus, the effect point limits, and your starter.
- **Help.** A short version of this page.

Each section starts with a level 2 heading, and its parts have level 3 and 4 headings. Results are in tables, so you can press T, then use Control plus Alt plus the arrow keys.

Your team, your place in the game and your ticks are saved in the browser. To keep a backup, or to move your data to another computer, use "Save all my helper data to a file" in My team.

## How the numbers work

- **Type effect.** Start at 1. Then multiply by the chart value once for each of the defender's types:
  - very effective is 2
  - normal is 1
  - not very effective is half
  - no effect is 0

  Example: an Insect move against an Air and Magic Manamon is 2 times half, which is 1, normal.
- **Moves with two types**, like Ice Punch (Ice and Fighting), count both types. If the game works differently, you can change this in Settings to "use only the better type".
- **Same-type bonus.** If a move has one of its user's own types, it gets 1.5 times. You can change the 1.5 in Settings.
- **Estimated power** = effect points × type effect × same-type bonus. It does not know your stats, so use it to compare moves, not as the real damage.
- **Move ratings** use your own scale for effect points: under 40 is terrible, 40 to 60 is normal, 60 to 90 is good, and over 90 is really great. You can change these as your Manamon level up.
- **Damage taken.** The helper expects the opponent to attack with its own types. If you see it use another type, tick that type under "Extra attack types".
- **Special moves.** Status moves are not ranked. Moves whose power changes, like Sound Wave, are listed on their own.
  - Hypermagnet is always very effective against Electric types.
  - Spirit Sight lets Kangard's Fighting and Standard moves hit Ghost types.

## Where the data comes from, and what is not sure

The data is built from your 4 guide files, which are in `source-docs`:

- Manamon 2 Guide (the walkthrough by tunmi13 and others)
- the Complete Type Advantage Chart
- the List of All 307 Manamon With Locations
- the Manamon 2 Item Guide

As you asked, the type chart document is used, not the typed list in your message. The two only differ on one point: the document says Steel is immune to Poison, so the helper uses that.

Things to know:

- **Some types are not sure.** The Manamon list puts a whole transformation line under a type, even when the first form does not have it yet. For example, it puts Tadder under Electric, but Tadder only becomes Electric when it turns into Friggle.
  - The helper fixes this when the walkthrough or your game screens say the real types.
  - Where nothing says, the Manamon is marked "types not sure". In the Manamon list, you can show only those.
  - Deciced has no type in any of the guides.
- **The Manamon list had mistakes**, which the helper fixes:
  - Murkit had the wrong ID number.
  - Groller and Gronk were missing the Earth type.
  - Two location lists had no name (they belong to Houndorf and Waspunch).
- **Byron's starter** depends on yours. The helper is set to Grekko, because you have Greniverb. You can change this in Settings.
- **Side areas.** The walkthrough never visits some places in the item guide:
  - Elatia Walkway and Qweugum Swamp
  - Haunted Thicket
  - Solphear Cave F2
  - the lower floors of the Cave of Fates
  - the Lower Catacombs

  For these, the helper cannot know when you can get there, so you tick them yourself. You said the swamp opens after clearing a blocked path with the Crowbar or the Old Hammer. If you find out which tool it is, tell me and I'll set it.

## Updating the data

If a guide file gets a new version, put it in `source-docs` with the same file name. Then run:

```
python3 tools/build_data.py
```

This rebuilds `data/manamon-data.js`. The fixes for types, item tools and place order are at the top of `tools/build_data.py`. Each fix says where it came from.

## Files

- `index.html`, `app.js`, `app.css`: the page itself.
- `data/manamon-data.js`: all the game data, made by the build script.
- `data/starting-team.js`: your team when the helper was made. It is used the first time, or when you choose "Reset to starting team".
- `tools/build_data.py`: turns the guide files into the data file.
- `source-docs/`: the 4 guide files.
