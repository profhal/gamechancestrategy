'use strict';

const GROWTH = [1, 3, 6, 10, 15];
const DECAY = [10, 6, 3, 1, 0];
const MAX_TURNS = 28;

const PRIORITY = {
    Expansionist: ['HIGH_BOTTLE', 'EXPAND', 'HEX', 'DISPEL', 'LOW_BOTTLE'],
    Protector: ['HIGH_BOTTLE', 'DISPEL', 'EXPAND', 'HEX', 'LOW_BOTTLE'],
    Preserver: ['DECAY_BOTTLE', 'HIGH_BOTTLE', 'EXPAND', 'HEX', 'DISPEL', 'LOW_BOTTLE']
};
const OWNERSHIP_LIMIT = 3;
const HEX_COOLDOWN = 2;

function newGame() {
    return {
        turn: 0,
        scores: [0, 0],
        // True after a player HEXes; their next action cannot be HEX.
        hexCooldown: [0, 0],
        decayLosses: [0, 0],
        cauldrons: Array.from({length: 5}, (_, index) => ({
            id: index + 1,
            owner: null,
            state: 'AVAILABLE',
            potency: 0,
            threshold: 0,
            hexed: false
        })),
        history: []
    };
}

function legal(game, player = game.turn % 2) {
    const legalMoves = [];

    for (const cauldron of game.cauldrons) {
        if (cauldron.owner === null) {
            if (game.cauldrons.filter(c => c.owner === player).length < OWNERSHIP_LIMIT) {
                legalMoves.push({action: 'EXPAND', cauldronId: cauldron.id});
            }
        } else if (cauldron.owner === player) {
            legalMoves.push({
                action: cauldron.hexed ? 'DISPEL' : 'BOTTLE',
                cauldronId: cauldron.id
            });
        } else if (!cauldron.hexed && game.hexCooldown[player] === 0) {
            legalMoves.push({action: 'HEX', cauldronId: cauldron.id});
        }
    }

    if (legalMoves.length === 0) {
        legalMoves.push({action: 'PASS', cauldronId: -1});
    }

    return legalMoves;
}

function willExpireNextBrew(cauldron) {
    return cauldron.state === 'DECAYING'
        && cauldron.threshold === DECAY.length - 2;
}

function brew(cauldron) {
    if (cauldron.state === 'GROWING') {
        if (cauldron.threshold < GROWTH.length - 1) {
            if (cauldron.hexed) {
                cauldron.potency++;
                if (cauldron.potency === GROWTH[cauldron.threshold + 1]) {
                    cauldron.threshold++;
                }
            } else {
                cauldron.threshold++;
                cauldron.potency = GROWTH[cauldron.threshold];
            }
        } else {
            cauldron.state = 'DECAYING';
            cauldron.threshold = 0;
            cauldron.potency = DECAY[0];
        }
    } else if (cauldron.state === 'DECAYING') {
        if (cauldron.threshold < DECAY.length - 2) {
            cauldron.threshold++;
            cauldron.potency = DECAY[cauldron.threshold];
        } else {
            cauldron.potency = 0;
            cauldron.threshold = 0;
            cauldron.state = 'AVAILABLE';
            cauldron.owner = null;
            cauldron.hexed = false;
        }
    }
}

function play(game, move) {
    if (game.turn >= MAX_TURNS) {
        throw new Error('Game complete');
    }
    if (!legal(game).some(candidate =>
        candidate.action === move.action && candidate.cauldronId === move.cauldronId)) {
        throw new Error('Illegal action');
    }

    const player = game.turn % 2;
    const cauldron = game.cauldrons.find(item => item.id === move.cauldronId);
    const before = cauldron
        ? {potency: cauldron.potency, state: cauldron.state, hexed: cauldron.hexed}
        : {potency: 0, state: 'N/A', hexed: false};

    switch (move.action) {
        case 'PASS':
            break;
        case 'EXPAND':
            cauldron.owner = player;
            cauldron.state = 'GROWING';
            cauldron.threshold = 0;
            cauldron.potency = GROWTH[0];
            cauldron.hexed = false;
            break;
        case 'BOTTLE':
            game.scores[player] += cauldron.potency;
            cauldron.owner = null;
            cauldron.state = 'AVAILABLE';
            cauldron.potency = 0;
            cauldron.threshold = 0;
            cauldron.hexed = false;
            break;
        case 'HEX':
            cauldron.hexed = true;
            break;
        case 'DISPEL':
            cauldron.hexed = false;
            break;
    }

    // HEX is prohibited on the player's next turn only. Any other
    // legal action, including PASS, clears that player's cooldown.
    game.hexCooldown[player] = move.action === 'HEX'
        ? HEX_COOLDOWN
        : Math.max(0, game.hexCooldown[player] - 1);

    game.history.push({
        day: Math.floor(game.turn / 2) + 1,
        player: player + 1,
        ...move,
        before
    });

    // Brew once per day, after player 2 has acted.
    if (player === 1) {
        for (const pot of game.cauldrons) {
            if (pot.state !== 'AVAILABLE') {
                // Record the owner BEFORE brew() clears an expired cauldron.
                if (willExpireNextBrew(pot)) {
                    game.decayLosses[pot.owner]++;
                }
                brew(pot);
            }
        }
    }

    game.turn++;
    return game;
}

function choose(game, name, threshold) {
    const moves = legal(game);
    if (moves.length === 1 && moves[0].action === 'PASS') {
        return moves[0];
    }
    if (name === 'Naive') {
        return moves[Math.floor(Math.random() * moves.length)];
    }

    for (const group of PRIORITY[name]) {
        const options = moves.filter(move => {
            if (group === 'DECAY_BOTTLE') {
                return move.action === 'BOTTLE'
                    && game.cauldrons[move.cauldronId - 1].state === 'DECAYING';
            }
            if (group === 'HIGH_BOTTLE') {
                return move.action === 'BOTTLE'
                    && game.cauldrons[move.cauldronId - 1].potency >= threshold;
            }
            if (group === 'LOW_BOTTLE') {
                return move.action === 'BOTTLE'
                    && game.cauldrons[move.cauldronId - 1].potency < threshold;
            }
            return move.action === group;
        });

        if (options.length > 0) {
            return options[Math.floor(Math.random() * options.length)];
        }
    }
    throw new Error('Agent has no legal action');
}

function snapshot(game) {
    return {
        turn: game.turn,
        day: Math.min(14, Math.floor(game.turn / 2) + 1),
        currentPlayer: game.turn >= MAX_TURNS ? null : game.turn % 2 + 1,
        scores: [...game.scores],
        hexCooldown: [...game.hexCooldown],
        cauldrons: game.cauldrons.map(cauldron => ({...cauldron})),
        legalMoves: game.turn < MAX_TURNS ? legal(game) : [],
        history: game.history.map(entry => ({...entry}))
    };
}
