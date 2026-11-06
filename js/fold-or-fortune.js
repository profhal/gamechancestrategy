'use strict';

// Fold or Fortune: deliberately simple prototype for Arcade playtesting.
// All five cards come from one shuffled 52-card deck per round.
(function () {
    const $ = (id) => document.getElementById(id);
    const SUITS = ['♠', '♥', '♦', '♣'];
    const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    let game;

    function makeDeck() {
        const deck = [];
        for (const suit of SUITS) {
            for (let i = 0; i < RANKS.length; i++) {
                deck.push({ rank: RANKS[i], suit, value: Math.min(i + 1, 10) });
            }
        }
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    function availableIndices() {
        return game.cards.map((card, index) => game.owners[index] ? -1 : index)
            .filter((index) => index >= 0);
    }

    function randomAvailableIndex() {
        const indices = availableIndices();
        return indices[Math.floor(Math.random() * indices.length)];
    }

    function computerDecision() {
        const mine = game.cards[game.computerCards[0]].value;
        const theirs = game.cards[game.humanCards[0]].value;
        const level = $('level').value;
        if (level === 'naive') return Math.random() < .5 ? 'PLAY' : 'FOLD';
        // Intentionally imperfect, transparent heuristic opponents.
        const threshold = level === 'cautious' ? 2 : -2;
        const advantage = mine - theirs;
        const chance = advantage >= threshold ? .85 : .25;
        return Math.random() < chance ? 'PLAY' : 'FOLD';
    }

    function cardLabel(card) {
        return `${card.rank}${card.suit}`;
    }

    function total(indices) {
        return indices.reduce((sum, index) => sum + game.cards[index].value, 0);
    }

    function setStatus(message) {
        $('status').textContent = message;
    }

    function render() {
        const board = $('game-board');
        board.replaceChildren();
        game.cards.forEach((card, index) => {
            const owner = game.owners[index];
            const selectable = !owner && (game.phase === 'first' || game.phase === 'second');
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `playing-card ${owner ? '' : 'back'} ${owner && (card.suit === '♥' || card.suit === '♦') ? 'red' : ''} ${selectable ? 'selectable' : ''}`;
            button.disabled = !selectable;
            button.setAttribute('aria-label', owner ? `${owner === 'human' ? 'Your' : 'Computer'} card: ${cardLabel(card)}` : `Face-down card ${index + 1}`);
            if (owner) {
                const rank = document.createElement('span');
                rank.textContent = card.rank;
                const suit = document.createElement('span');
                suit.className = 'suit';
                suit.textContent = card.suit;
                const label = document.createElement('span');
                label.className = 'owner';
                label.textContent = owner === 'human' ? 'YOU' : 'COMPUTER';
                button.append(rank, suit, label);
            }
            if (selectable) button.addEventListener('click', () => chooseCard(index));
            board.appendChild(button);
        });
        $('human-score').textContent = game.humanScore;
        $('computer-score').textContent = game.computerScore;
        $('round-label').textContent = `Round ${game.round} of ${game.roundLimit}`;
        $('phase-label').textContent = ({ first: 'Initial reveal', decide: 'Fold or play?', second: 'Second reveal', done: 'Round complete', finished: 'Game complete' })[game.phase];
        $('decision-area').hidden = game.phase !== 'decide';
        $('next-round').hidden = game.phase !== 'done';
        $('next-round').textContent = game.round >= game.roundLimit ? 'See final result' : 'Next round';
    }

    function chooseCard(index) {
        if (game.owners[index]) return;
        if (game.phase === 'first') {
            game.owners[index] = 'human';
            game.humanCards.push(index);
            const computerIndex = randomAvailableIndex();
            game.owners[computerIndex] = 'computer';
            game.computerCards.push(computerIndex);
            game.phase = 'decide';
            setStatus('Both first cards are visible. Will you FOLD or PLAY?');
        } else if (game.phase === 'second') {
            game.owners[index] = 'human';
            game.humanCards.push(index);
            const computerIndex = randomAvailableIndex();
            game.owners[computerIndex] = 'computer';
            game.computerCards.push(computerIndex);
            resolveRound();
        }
        render();
    }

    function decide(humanChoice) {
        if (game.phase !== 'decide') return;
        const computerChoice = computerDecision();
        game.humanChoice = humanChoice;
        game.computerChoice = computerChoice;
        const reveal = $('reveal-area');
        reveal.hidden = false;
        reveal.replaceChildren();
        const choices = document.createElement('p');
        choices.textContent = `You: ${humanChoice} · Computer: ${computerChoice}`;
        reveal.appendChild(choices);
        if (humanChoice === 'PLAY' && computerChoice === 'PLAY') {
            game.phase = 'second';
            setStatus('Both chose PLAY. Choose your second card!');
        } else {
            resolveRound();
        }
        render();
    }

    function resolveRound() {
        const humanChoice = game.humanChoice;
        const computerChoice = game.computerChoice;
        let result;
        let detail;
        if (humanChoice === 'FOLD' && computerChoice === 'FOLD') {
            result = 'Both folded. No points.';
            detail = 'FOLD / FOLD';
        } else if (humanChoice === 'PLAY' && computerChoice === 'FOLD') {
            game.humanScore += 1;
            result = 'Computer folded. You earn 1 point!';
            detail = 'PLAY / FOLD';
        } else if (humanChoice === 'FOLD' && computerChoice === 'PLAY') {
            game.computerScore += 1;
            result = 'You folded. Computer earns 1 point.';
            detail = 'FOLD / PLAY';
        } else {
            const yours = total(game.humanCards);
            const theirs = total(game.computerCards);
            detail = `PLAY / PLAY · ${yours}–${theirs}`;
            if (yours > theirs) {
                game.humanScore += 2;
                result = `You win the showdown ${yours}–${theirs}. +2 points!`;
            } else if (theirs > yours) {
                game.computerScore += 2;
                result = `Computer wins the showdown ${theirs}–${yours}. +2 points.`;
            } else {
                result = `Showdown tied at ${yours}. No points.`;
            }
        }
        game.phase = 'done';
        setStatus(result);
        const summary = document.createElement('p');
        summary.textContent = result;
        $('reveal-area').appendChild(summary);
        const historyItem = document.createElement('li');
        historyItem.textContent = `Round ${game.round}: ${detail} — ${result}`;
        $('history').appendChild(historyItem);
    }

    function startRound() {
        const deck = makeDeck();
        game.cards = deck.slice(0, 5);
        game.owners = [null, null, null, null, null];
        game.humanCards = [];
        game.computerCards = [];
        game.humanChoice = null;
        game.computerChoice = null;
        game.phase = 'first';
        $('reveal-area').hidden = true;
        $('reveal-area').replaceChildren();
        setStatus('Choose one of the five face-down cards.');
        render();
    }

    function nextRound() {
        if (game.phase !== 'done') return;
        if (game.round >= game.roundLimit) {
            game.phase = 'finished';
            const outcome = game.humanScore > game.computerScore ? 'You win the game!' :
                game.humanScore < game.computerScore ? 'Computer wins the game.' : 'The game is a tie.';
            setStatus(`Final score: You ${game.humanScore}, Computer ${game.computerScore}. ${outcome}`);
            $('reveal-area').hidden = true;
            render();
        } else {
            game.round += 1;
            startRound();
        }
    }

    function newGame() {
        game = {
            round: 1,
            roundLimit: Number($('round-limit').value),
            humanScore: 0,
            computerScore: 0
        };
        $('history').replaceChildren();
        startRound();
    }

    $('restart').addEventListener('click', newGame);
    $('fold').addEventListener('click', () => decide('FOLD'));
    $('play').addEventListener('click', () => decide('PLAY'));
    $('next-round').addEventListener('click', nextRound);
    newGame();
})();
