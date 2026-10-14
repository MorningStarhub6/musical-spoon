# Manamon 2 Helper

A battle and guide helper for the game Manamon 2. It is a web page that works with NVDA and other screen readers. It runs from your own computer. You don't need to install anything, and you don't need the internet.

## How to open it

There are two ways. Both work the same.

- **One file (easiest to share):** open `dist/manamon-helper.html` in Chrome, Edge or Firefox. Everything is inside this one file, so you can send it to a friend.
- **The folder:** open `index.html` in a browser. Keep the `data` folder next to it.

The helper starts with an empty team. Go to "My team", paste what NVDA says on your Manamon's Overview screens, and the helper fills in your team. If you already saved your data to a file, load that file instead.

## What it does

The page has 8 sections. The links to them are at the top, in a navigation landmark. In NVDA browse mode, press D to jump there.

- **Battle helper.** Type an opponent's name. Small spelling mistakes are fine. Press Enter. The helper tells you:
  - **Use:** the move to use, and how much damage that Manamon takes from the opponent. This is the strongest move whose Manamon does not take extra damage. If the strongest move belongs to a Manamon that would take double damage, the helper picks a safer Manamon with a move that is nearly as strong, and says why.
  - **Other very effective moves:** for each Manamon, its very effective moves, and how much damage that Manamon takes.
  - **Takes the least damage:** which of your Manamon is safest against this opponent.
  - a table of all your moves, strongest first

  Under "Who can fight right now", untick a Manamon that fainted. The advice leaves it out until you tick it again, or until you press "Everyone is healed".
- **What's next.** Choose where you are in the game, or type the name of a place or tamer. The helper shows the next battles, with the move to use against each opponent, other good choices, and warnings to prepare for. It also shows the next big battle, tools you will get soon, and the walkthrough text. When you win a battle, press "I won the next battle".
- **Items in game order.** The item guide's items, sorted by when you reach each place, with the tool each item needs: Old Hammer, Crowbar, Rope, Swim Gear, Tunnel, Dive, Item Detector, or a Treasure Chest Key. It also has the shop lists.
- **My team.**
  - Your party holds up to 6 Manamon, like in the game. The others go in the transportal list, and the advice does not use them.
  - **Should I learn a new move?** When the game offers a new move, paste what NVDA says on the teach screen or the "Select the move to be deleted" screen. The helper tries every swap. It tells you which move to forget, or if you should keep your moves.
  - **Save all my helper data to a file:** a backup, or a way to move your data to another computer.
- **Manamon list.** All 307 Manamon, with types, transformations and where to find them. You can fix a Manamon's types here if the game says something different.
- **Type chart.** What a type is good or bad against.
- **Settings.** The same-type bonus, the effect point limits, your starter, and the rule for moves with two types.
- **Help.** A short version of this page.

## How the numbers work

- **Type effect.** Start at 1. Then multiply by the chart value once for each of the defender's types: very effective is 2, normal is 1, not very effective is half, no effect is 0. Example: an Insect move against an Air and Magic Manamon is 2 times half, which is 1, normal.
- **Estimated power** = effect points × type effect × same-type bonus (1.5) × accuracy. It does not know your stats, so use it to compare moves.
  - A 30 effect point move that is very effective is only 60, which is weaker than a normal 65 move.
  - A 120 effect point move with 70 percent accuracy counts as 84. You can turn accuracy off in Settings.
- **Move ratings** use your scale for effect points: under 40 terrible, 40 to 60 normal, 60 to 90 good, over 90 really great. Change them in Settings as your Manamon level up.
- **Damage taken.** The helper expects the opponent to attack with its own types. If you see it use another type, tick that type under "Extra attack types".

## Moves with two types, like Ice Punch

The first version multiplied both types. That was wrong: you saw Ice Punch do normal damage where Crystal Slash (pure Ice) was very effective. So now, by default, only the **weaker** of the two types counts. Then the helper never promises "very effective" when the game says "normal".

The guides don't say the real rule. Settings has a short test to find it. It says which Manamon to use a two-type move on, and what each answer would mean. Write down what the game says, and the helper tells you which rule fits.

For example, your note "Ice Punch on Folimoss: normal" already leaves only two possible rules:

- only the weaker type counts
- only the second type counts (Fighting, in "Ice and Fighting")

One more test, Ice Punch on a pure Flame Manamon like Flarebra, tells them apart:

- "not very effective" means the weaker type counts
- "normal" means only the second type counts

## Where the data comes from, and what is not sure

The data is built from your 4 guide files, which are in `source-docs`:

- the walkthrough
- the type chart
- the list of all 307 Manamon
- the item guide

The type chart document is used, not the typed list in your first message. They only differ on one point: the document says Steel is immune to Poison.

- **Some Manamon types are not sure.** They are marked "types not sure". The Manamon list puts a whole transformation line under a type, even when the first form does not have it yet.
- **Byron's starter** follows your starter. It is set to Grekko; change it in Settings.
- **Side areas.** The walkthrough never visits Elatia Walkway, Qweugum Swamp, Haunted Thicket, Solphear Cave F2, the lower Cave of Fates and the Lower Catacombs. You tick them yourself when you can reach them.

## For whoever changes the data

After a guide file changes, put the new file in `source-docs` with the same name, then run:

```
python3 tools/build_data.py
python3 tools/build_single_file.py
```

The first command rebuilds `data/manamon-data.js`. The second rebuilds `dist/manamon-helper.html`. The fixes for types, item tools and place order are at the top of `tools/build_data.py`. Each fix says where it came from.

## Files

- `dist/manamon-helper.html`: everything in one file, to open or share.
- `index.html`, `app.js`, `app.css`: the page, in separate files.
- `data/manamon-data.js`: all the game data, made by `tools/build_data.py`.
- `tools/`: the two build scripts.
- `source-docs/`: the 4 guide files.
