// Your team when the app was made (from the game's Overview screens).
// The app uses this only the first time, or when you choose "Reset to starting team".
// After that your team is saved in the browser, and you can change it in "My team".
window.MANAMON_START_TEAM = [
  {
    name: "Mantasteel", types: ["Steel", "Insect"], level: null, active: true,
    moves: [
      { name: "Retaliate", types: ["Standard"], power: 65, category: "Physical", crit: 7,
        description: "The user retaliates against the foe's last move. If the foe has not yet used a move, this move's power is greatly reduced. If the foe's last attack was of the same type as the user of retaliate, the power is doubled." },
      { name: "Bugbite", types: ["Insect"], power: 30, category: "Physical", crit: 7,
        description: "The user sinks their teeth into the opponent." },
      { name: "Smite", types: ["Shadow"], power: 40, category: "Physical", crit: 7,
        description: "The user strikes the foe." },
      { name: "Pest Pincer", types: ["Insect"], power: 70, category: "Physical", crit: 7,
        description: "The user forcefully grabs the foe, squeezes, then slams them against the ground. It may cause the foe to recoil." },
      { name: "Steel Horn", types: ["Steel"], power: 65, category: "Physical", crit: 7,
        description: "The user charges head first into the foe." }
    ]
  },
  {
    name: "Kangard", types: ["Fighting"], level: null, active: true,
    moves: [
      { name: "Speed Kick", types: ["Fighting"], power: 45, category: "Physical", crit: 7,
        description: "The user quickly delivers a kick. The user will strike first next round." },
      { name: "Ice Punch", types: ["Ice", "Fighting"], power: 80, category: "Physical", crit: 7,
        description: "The user's fist begins to glow and an ice casing appear around it. It may freeze the foe." },
      { name: "Spirit Sight", types: ["Fighting"], power: 0, category: "Status",
        description: "The user endows itself with the ability to focus in the spiritual realm, allowing it to hit ghost type opponents with moves which normally would not effect ghost types." },
      { name: "Blaze Punch", types: ["Flame", "Fighting"], power: 80, category: "Physical", accuracy: 100, crit: 7,
        description: "The user's fist begins to glow and flames appear around it. It may scorch the foe." },
      { name: "Spark Punch", types: ["Electric", "Fighting"], power: 80, category: "Physical", accuracy: 100, crit: 7,
        description: "The user's fist begins to glow and sparks start flying from knuckle to knuckle. It may paralyze the foe." }
    ]
  },
  {
    name: "Friggle", types: ["Water", "Electric"], level: null, active: true,
    moves: [
      { name: "Hypermagnet", types: ["Electric"], power: 65, category: "Special", accuracy: 100, crit: 7, superVs: "Electric",
        description: "A powerful electric move which deals very effective damage against other electric type Manamon." },
      { name: "Electric Shield", types: ["Electric"], power: 0, category: "Status",
        description: "The user puts up a barrier which reduces the damage dealt by electric type moves for 10 turns." },
      { name: "Power Surge", types: ["Electric"], power: 50, category: "Special", accuracy: 100, crit: 10,
        description: "The user fills the battlefield with a surge of electricity. It has a chance to paralyze and hits multiple targets." },
      { name: "Downpour", types: ["Water"], power: 0, category: "Status",
        description: "The user summons a storm." },
      { name: "Tidal Wave", types: ["Water"], power: 45, category: "Special", accuracy: 100, crit: 7,
        description: "The user releases as much water as it can and directs it at the opponent. It may lower the opponent's speed." }
    ]
  },
  {
    name: "Zebbabern", types: ["Flame"], level: null, active: true,
    moves: [
      { name: "Sunshine Song", types: ["Flame"], power: 0, category: "Status",
        description: "The user summons severe sunshine." },
      { name: "Megasinge", types: ["Flame"], power: 70, category: "Physical", accuracy: 100, crit: 10,
        description: "The user sets itself alight and rushes into the foe. It may scorch the opponent." },
      { name: "Fire Breath", types: ["Flame"], power: 45, category: "Special", crit: 10,
        description: "The user exhales a stream of fire at the opponent. It may scorch the enemy." },
      { name: "Rookie Kick", types: ["Fighting"], power: 50, category: "Physical", crit: 12,
        description: "The user attacks the foe with an inexperienced kick." },
      { name: "Singe", types: ["Flame"], power: 55, category: "Physical", crit: 10,
        description: "The user sets itself alight and rushes into the foe. It may scorch the opponent." }
    ]
  },
  {
    name: "Groller", types: ["Earth", "Magic"], level: null, active: true,
    moves: [
      { name: "Scourge Tail", types: ["Shadow"], power: 75, category: "Physical", crit: 7,
        description: "The user concentrates all of its energy into its tail and uses it to ferociously slash the enemy. It may increase the user's strength stat." },
      { name: "Crystal Slash", types: ["Ice"], power: 85, category: "Physical", crit: 12,
        description: "The user slashes the foe with a large thin blade made of ice. The blade shatters on impact. It has a slightly elevated chance to get a critical hit." },
      { name: "Claw Swipe", types: ["Standard"], power: 40, category: "Physical", crit: 7,
        description: "The user swipes its claws across the opponent's body." },
      { name: "Land Power", types: ["Earth"], power: 60, category: "Special", crit: 7,
        description: "The user draws an odd line in the ground which causes white dust to cover the foe. It may increase all of the users stats." },
      { name: "Metal Fist", types: ["Steel", "Fighting"], power: 35, category: "Physical", crit: 15,
        description: "The user's solid fist impacts the foe." }
    ]
  },
  {
    name: "Greniverb", types: ["Plant", "Sound"], level: null, active: true,
    moves: [
      { name: "Divine Barrier", types: ["Holy"], power: 0, category: "Status",
        description: "The user puts up a barrier which halves the damage of special attacks for five rounds." },
      { name: "Petal Storm", types: ["Plant"], power: 85, category: "Special", crit: 7,
        description: "The user creates a storm of petals traveling at very high velocities which pellet the foe relentlessly. It may lower the foe's accuracy." },
      { name: "Power Leaf", types: ["Plant"], power: 55, category: "Special", crit: 15,
        description: "A flurry of razor sharp leaves assault the foe. It has an increased chance to get a critical hit." },
      { name: "Stingray", types: ["Poison"], power: 70, category: "Special", crit: 7,
        description: "The user releases a concentrated line of gunk from its mouth. Though it uses the user's magic attack, it targets the foe's defense stat. It may poison the foe." },
      { name: "Sound Wave", types: ["Sound"], power: 0, category: "Special", crit: 7,
        description: "The user unleashes a sound wave with a varying intensity. The move will deal drastically random amounts of damage based on the power." }
    ]
  }
];
