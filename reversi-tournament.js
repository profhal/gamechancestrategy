'use strict';

const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Load the Reversi implementation from the Arcade page.
const htmlPath = path.join(__dirname, 'reversi.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const start = html.search(/\bconst\s+dirs\s*=/);
const end = html.search(/\bfunction\s+labelPos\s*\(/);

if (start < 0 || end < start) {
  throw Error('Cannot locate game logic in reversi.html');
}

// Extract the board mechanics and agent strategies.
const source = html.slice(start, end);

const levels = [
  //'random',
  //'greedy',
  'corner',
  //'edge',
  'weighted'
];

// Games per pairing, defaulting to 100.
const games = Number(process.argv[2] ?? 100);

if (!Number.isSafeInteger(games) ||
    games < 2 ||
    games % 2 !== 0) {
  console.error(
    'Usage: node reversi-tournament.js [even games per pairing]'
  );
  process.exit(1);
}

// Repeatable pseudo-random number generator.
let seed = 0x12345678;

function random() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 4294967296;
}

// Run the Arcade game logic in an isolated context.
const math = Object.create(Math);
math.random = random;

const context = vm.createContext({ Math: math });

vm.runInContext(source + `
  globalThis.api = {
    fresh,
    legal,
    applied,

    choose(b, color, level) {
      board = b;
      turn = color;
      activeLevel = level;
      return computerChoice();
    }
  };
`, context);

const { fresh, legal, applied, choose } = context.api;

// Play one complete game.
// Return 1 for Black, -1 for White, 0 for a draw.
function play(black, white) {
  let board = fresh();
  let color = 1;
  let passes = 0;

  for (let turnCount = 0;
       turnCount < 130 && passes < 2;
       turnCount++) {

    const moves = legal(board, color);

    if (!moves.length) {
      passes++;
      color = -color;
      continue;
    }

    passes = 0;

    const agent = color === 1 ? black : white;
    const move = choose(board, color, agent);

    if (!moves.includes(move)) {
      throw Error(`Illegal move: ${move} from ${agent}`);
    }

    board = applied(board, move, color);
    color = -color;
  }

  const difference = board.reduce(
    (sum, disc) => sum + disc,
    0
  );

  return Math.sign(difference);
}

// Tournament.
console.log(
  `Reversi JavaScript round robin: ${games} games per pairing`
);
console.log(
  'Each matchup splits first-player assignments equally.\n'
);

const totals = Object.fromEntries(
  levels.map(name => [name, { w: 0, l: 0, d: 0 }])
);

console.log(
  'Pairing'.padEnd(26),
  'A wins'.padStart(8),
  'B wins'.padStart(8),
  'Draws'.padStart(8)
);

for (let i = 0; i < levels.length; i++) {
  for (let j = i + 1; j < levels.length; j++) {

    const a = levels[i];
    const b = levels[j];

    const result = { w: 0, l: 0, d: 0 };

    for (let g = 0; g < games; g++) {
      const aBlack = g % 2 === 0;

      const outcome = play(
        aBlack ? a : b,
        aBlack ? b : a
      );

      const aOutcome = outcome * (aBlack ? 1 : -1);

      if (aOutcome > 0) {
        result.w++;
        totals[a].w++;
        totals[b].l++;
      } else if (aOutcome < 0) {
        result.l++;
        totals[a].l++;
        totals[b].w++;
      } else {
        result.d++;
        totals[a].d++;
        totals[b].d++;
      }
    }

    console.log(
      `${a} vs ${b}`.padEnd(26),
      String(result.w).padStart(8),
      String(result.l).padStart(8),
      String(result.d).padStart(8)
    );
  }
}

// Overall standings.
console.log('\nOverall win percentages:');

const standings = Object.entries(totals).sort(
  (a, b) => b[1].w - a[1].w
);

for (const [name, t] of standings) {
  const n = t.w + t.l + t.d;

  console.log(
    `${name.padEnd(10)} ` +
    `${String(t.w).padStart(6)} W  ` +
    `${String(t.l).padStart(6)} L  ` +
    `${String(t.d).padStart(5)} D  ` +
    `${(100 * t.w / n).toFixed(2)}% wins`
  );
}
