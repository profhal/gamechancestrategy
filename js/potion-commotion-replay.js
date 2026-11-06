'use strict';

const REPLAY_PATTERN = /^\s*Day\s+(\d+)\s*\|\s*P([12])\s*\|\s*(EXPAND|BOTTLE|HEX|DISPEL|PASS)(?:\s+(-?\d+))?\s*$/i;
const replayElement = id => document.getElementById(id);

function parseTranscript(text) {
    const actions = [];
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const match = lines[i].match(REPLAY_PATTERN);
        if (!match) throw new Error(`Line ${i + 1}: unrecognized transcript line: ${lines[i]}`);
        const day = Number(match[1]);
        const player = Number(match[2]);
        const action = match[3].toUpperCase();
        const cauldronId = match[4] === undefined ? -1 : Number(match[4]);
        const expectedDay = Math.floor(actions.length / 2) + 1;
        const expectedPlayer = actions.length % 2 + 1;
        if (day !== expectedDay || player !== expectedPlayer) {
            throw new Error(`Line ${i + 1}: expected Day ${expectedDay} | P${expectedPlayer}, received Day ${day} | P${player}`);
        }
        if (action !== 'PASS' && !(cauldronId >= 1 && cauldronId <= 5)) {
            throw new Error(`Line ${i + 1}: cauldron must be numbered 1–5`);
        }
        actions.push({day, player, action, cauldronId, sourceLine: i + 1});
        if (actions.length > MAX_TURNS) throw new Error(`Line ${i + 1}: more than ${MAX_TURNS} turns`);
    }
    if (!actions.length) throw new Error('No transcript actions found.');
    return actions;
}

function replayTranscript(text) {
    const actions = parseTranscript(text);
    const game = newGame();
    const steps = [{label: 'Initial state', state: snapshot(game)}];
    const playerStats = [fresh(), fresh()];
    for (const entry of actions) {
        const move = {action: entry.action, cauldronId: entry.cauldronId};
        const options = legal(game).map(m => `${m.action} ${m.cauldronId}`).join(', ');
        try {
            // Tally before playing: BOTTLE needs the cauldron's pre-move potency.
            // Validate first so an illegal move cannot enter the statistics.
            if (!legal(game).some(candidate => candidate.action === move.action && candidate.cauldronId === move.cauldronId)) {
                throw new Error('Illegal action');
            }
            tally(game, playerStats[entry.player - 1], move, entry.player - 1);
            play(game, move);
        } catch (error) {
            const detail = `Day ${entry.day} P${entry.player} (line ${entry.sourceLine}): ${entry.action} ${entry.cauldronId}. ${error.message}. Legal moves: ${options}`;
            const failure = new Error(detail);
            failure.steps = steps;
            throw failure;
        }
        steps.push({label: `Day ${entry.day} P${entry.player}: ${entry.action} ${entry.action === 'PASS' ? '' : entry.cauldronId}`.trim(), state: snapshot(game)});
    }
    playerStats[0].decay = game.decayLosses[0];
    playerStats[1].decay = game.decayLosses[1];
    const complete = actions.length === MAX_TURNS;
    const replayStats = {
        games: 1,
        wins: [Number(complete && game.scores[0] > game.scores[1]), Number(complete && game.scores[1] > game.scores[0])],
        draws: Number(complete && game.scores[0] === game.scores[1]),
        illegal: 0,
        scores: [...game.scores],
        stats: playerStats,
        agents: ['Transcript P1', 'Transcript P2'],
        threshold: null
    };
    return {actions, steps, finalState: snapshot(game), complete, replayStats};
}

function renderReplayStep(step) {
    const state = step.state;
    const rows = state.cauldrons.map(pot => {
        const owner = pot.owner === null ? 'Available' : `P${pot.owner + 1}`;
        return `<tr><td>${pot.id}</td><td>${owner}</td><td>${pot.state}</td><td>${pot.potency}</td><td>${pot.threshold}</td><td>${pot.hexed ? 'Yes' : 'No'}</td></tr>`;
    }).join('');
    replayElement('replay-step-label').textContent = step.label;
    replayElement('replay-scores').textContent = `After ${state.turn} actions · P1 ${state.scores[0]} — P2 ${state.scores[1]} · HEX cooldown: P1 ${state.hexCooldown[0] ? 'Yes' : 'No'}, P2 ${state.hexCooldown[1] ? 'Yes' : 'No'}`;
    replayElement('replay-board').innerHTML = `<table><thead><tr><th>Cauldron</th><th>Owner</th><th>State</th><th>Potency</th><th>Threshold</th><th>Hexed</th></tr></thead><tbody>${rows}</tbody></table>`;
    replayElement('replay-legal').textContent = state.legalMoves.map(m => `${m.action} ${m.cauldronId}`).join(' · ') || '(game complete)';
}

let replayResult = null;
let replaySteps = [];
replayElement('replay-run').addEventListener('click', () => {
    try {
        replayResult = replayTranscript(replayElement('replay-input').value);
        replaySteps = replayResult.steps;
        replayElement('replay-stats').textContent = report(replayResult.replayStats);
        replayElement('replay-stats-note').textContent = replayResult.complete
            ? 'Complete game · same metric definitions as the simulation harness.'
            : 'Partial transcript · counts and scores are through the last replayed action; win/draw results are not final.';
        replayElement('replay-copy-stats').disabled = false;
        replayElement('replay-status').textContent = `${replayResult.actions.length} legal actions replayed. ${replayResult.complete ? 'Complete game.' : 'Partial transcript.'} Final scores: P1 ${replayResult.finalState.scores[0]}, P2 ${replayResult.finalState.scores[1]}.`;
    } catch (error) {
        replayResult = null;
        replaySteps = error.steps || [];
        replayElement('replay-stats').textContent = 'No completed replay statistics available.';
        replayElement('replay-stats-note').textContent = 'Replay stopped before all supplied actions could be validated.';
        replayElement('replay-copy-stats').disabled = true;
        replayElement('replay-status').textContent = `Replay stopped: ${error.message}`;
    }
    replayElement('replay-step').max = Math.max(0, replaySteps.length - 1);
    replayElement('replay-step').value = Math.max(0, replaySteps.length - 1);
    replayElement('replay-step').disabled = replaySteps.length === 0;
    replayElement('replay-export').disabled = !replayResult;
    if (replaySteps.length) renderReplayStep(replaySteps[replaySteps.length - 1]);
});
replayElement('replay-step').addEventListener('input', event => renderReplayStep(replaySteps[Number(event.target.value)]));
replayElement('replay-export').addEventListener('click', () => {
    if (!replayResult) return;
    const file = new Blob([JSON.stringify(replayResult, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'potion-commotion-replay.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
});

replayElement('replay-copy-stats').addEventListener('click', () => {
    if (!replayResult) return;
    navigator.clipboard.writeText(report(replayResult.replayStats))
        .then(() => { replayElement('replay-stats-note').textContent = 'Report copied.'; })
        .catch(() => { replayElement('replay-stats-note').textContent = 'Copy unavailable; select the report text to copy it.'; });
});
