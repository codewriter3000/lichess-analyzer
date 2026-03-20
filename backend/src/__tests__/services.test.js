const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parsePgn, inferUsername } = require('../services/pgnParser');
const { computeStats } = require('../services/statsService');
const { buildCsv } = require('../services/csvExport');
const { getGamePhase, classifyTacticType } = require('../services/stockfishService');

// Sample PGN with 2 games
const SAMPLE_PGN = `[Event "Rated Bullet game"]
[Site "https://lichess.org"]
[Date "2024.01.10"]
[UTCDate "2024.01.10"]
[UTCTime "12:00:00"]
[White "Magnus"]
[Black "Hikaru"]
[Result "1-0"]
[WhiteElo "2850"]
[BlackElo "2800"]
[ECO "C65"]
[Opening "Ruy Lopez: Berlin Defense"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Nxe4 5. Re1 Nd6 6. Nxe5 Be7 1-0

[Event "Rated Rapid game"]
[Site "https://lichess.org"]
[Date "2024.01.11"]
[UTCDate "2024.01.11"]
[UTCTime "14:00:00"]
[White "Hikaru"]
[Black "Magnus"]
[Result "0-1"]
[WhiteElo "2800"]
[BlackElo "2855"]
[ECO "D00"]
[Opening "Queen's Pawn Game"]

1. d4 d5 2. Nf3 Nf6 3. e3 e6 0-1
`;

describe('PGN Parser', () => {
  it('parses multiple games from PGN text', () => {
    const games = parsePgn(SAMPLE_PGN);
    assert.equal(games.length, 2);
  });

  it('extracts player names correctly', () => {
    const games = parsePgn(SAMPLE_PGN);
    assert.equal(games[0].white, 'Magnus');
    assert.equal(games[0].black, 'Hikaru');
  });

  it('extracts Elo ratings', () => {
    const games = parsePgn(SAMPLE_PGN);
    assert.equal(games[0].whiteElo, 2850);
    assert.equal(games[0].blackElo, 2800);
  });

  it('extracts result', () => {
    const games = parsePgn(SAMPLE_PGN);
    assert.equal(games[0].result, '1-0');
    assert.equal(games[1].result, '0-1');
  });

  it('extracts date', () => {
    const games = parsePgn(SAMPLE_PGN);
    assert.equal(games[0].date, '2024-01-10');
  });

  it('extracts opening info', () => {
    const games = parsePgn(SAMPLE_PGN);
    assert.equal(games[0].eco, 'C65');
    assert.equal(games[0].opening, 'Ruy Lopez: Berlin Defense');
  });

  it('resolves known ECO code to opening name when Opening header is missing', () => {
    const ecoOnlyPgn = `[Event "Rated Blitz game"]
[Site "https://lichess.org"]
[UTCDate "2024.02.02"]
[White "A"]
[Black "B"]
[Result "1-0"]
[ECO "C46"]

1. e4 e5 2. Nf3 Nc6 3. Nc3 Nf6 1-0`;

    const games = parsePgn(ecoOnlyPgn);
    assert.equal(games[0].eco, 'C46');
    assert.equal(games[0].opening, 'Four Knights Game');
  });

  it('resolves C00 to French Defense when only ECO is provided', () => {
    const ecoOnlyPgn = `[Event "Rated Blitz game"]
[Site "https://lichess.org"]
[UTCDate "2024.03.03"]
[White "A"]
[Black "B"]
[Result "0-1"]
[ECO "C00"]

1. e4 e6 2. d4 d5 0-1`;

    const games = parsePgn(ecoOnlyPgn);
    assert.equal(games[0].eco, 'C00');
    assert.equal(games[0].opening, 'French Defense');
  });

  it('counts ply correctly', () => {
    const games = parsePgn(SAMPLE_PGN);
    assert.equal(games[0].plyCount, 12); // 6 full moves = 12 plies
  });

  it('returns empty array for empty input', () => {
    const games = parsePgn('');
    assert.equal(games.length, 0);
  });

  it('handles single game without newline at end', () => {
    const singleGame = `[White "A"][Black "B"][Result "1/2-1/2"][WhiteElo "1500"][BlackElo "1500"] 1. e4 e5 1/2-1/2`;
    const games = parsePgn(singleGame);
    assert.equal(games.length, 1);
    assert.equal(games[0].result, '1/2-1/2');
  });

  it('infers username from repeated player appearances', () => {
    const games = [
      { white: 'Magnus', black: 'Hikaru' },
      { white: 'Levon', black: 'Magnus' },
      { white: 'Magnus', black: 'Alireza' },
    ];
    const inferred = inferUsername(games);
    assert.equal(inferred, 'Magnus');
  });

  it('returns null when top player frequency is tied', () => {
    const games = [
      { white: 'Alice', black: 'Bob' },
      { white: 'Alice', black: 'Bob' },
    ];
    const inferred = inferUsername(games);
    assert.equal(inferred, null);
  });
});

describe('Stats Service', () => {
  it('computes total games', () => {
    const games = parsePgn(SAMPLE_PGN);
    const stats = computeStats(games, 'Magnus');
    assert.equal(stats.total, 2);
  });

  it('computes wins and losses for a player', () => {
    const games = parsePgn(SAMPLE_PGN);
    const stats = computeStats(games, 'Magnus');
    assert.equal(stats.wins, 2);
    assert.equal(stats.losses, 0);
  });

  it('computes win rate', () => {
    const games = parsePgn(SAMPLE_PGN);
    const stats = computeStats(games, 'Magnus');
    assert.equal(stats.winRate, '100.0');
  });

  it('builds rating history', () => {
    const games = parsePgn(SAMPLE_PGN);
    const stats = computeStats(games, 'Magnus');
    assert.ok(stats.ratingHistory.length > 0);
    assert.equal(stats.ratingHistory[0].rating, 2850);
  });

  it('handles no games gracefully', () => {
    const stats = computeStats([], 'player');
    assert.equal(stats.total, 0);
  });

  it('computes stats without username filter', () => {
    const games = parsePgn(SAMPLE_PGN);
    const stats = computeStats(games, null);
    assert.equal(stats.total, 2);
  });

  it('includes opening name and ECO in top openings', () => {
    const games = parsePgn(SAMPLE_PGN);
    const stats = computeStats(games, 'Magnus');
    const opening = stats.topOpenings.find(op => op.eco === 'C65');

    assert.ok(opening);
    assert.equal(opening.openingName, 'Ruy Lopez: Berlin Defense');
  });
});

describe('CSV Export', () => {
  it('generates a CSV with correct headers', () => {
    const games = parsePgn(SAMPLE_PGN);
    const csv = buildCsv(games, null);
    const lines = csv.split('\r\n');
    assert.equal(lines[0], 'Date,White,WhiteRating,Black,BlackRating,Result,Winner');
  });

  it('generates correct number of data rows', () => {
    const games = parsePgn(SAMPLE_PGN);
    const csv = buildCsv(games, null);
    const lines = csv.split('\r\n').filter(l => l.trim());
    assert.equal(lines.length, 3); // header + 2 games
  });

  it('includes correct winner in CSV', () => {
    const games = parsePgn(SAMPLE_PGN);
    const csv = buildCsv(games, null);
    const lines = csv.split('\r\n');
    assert.ok(lines[1].includes('Magnus'));
    assert.ok(lines[2].includes('Magnus'));
  });

  it('includes ratings in CSV', () => {
    const games = parsePgn(SAMPLE_PGN);
    const csv = buildCsv(games, null);
    const lines = csv.split('\r\n');
    assert.ok(lines[1].includes('2850'));
    assert.ok(lines[1].includes('2800'));
  });

  it('handles draw result correctly', () => {
    const drawPgn = `[White "A"][Black "B"][Result "1/2-1/2"][WhiteElo "1500"][BlackElo "1500"][UTCDate "2024.01.01"] 1. e4 e5 1/2-1/2`;
    const games = parsePgn(drawPgn);
    const csv = buildCsv(games, null);
    assert.ok(csv.includes('Draw'));
  });
});

// Starting position FEN (white to move, move 0 = opening)
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('Stockfish Service – getGamePhase', () => {
  it('returns opening for half-move index 0 (start)', () => {
    assert.equal(getGamePhase(START_FEN, 0), 'opening');
  });

  it('returns opening for half-move index 19', () => {
    assert.equal(getGamePhase(START_FEN, 19), 'opening');
  });

  it('returns middlegame for half-move index 20 with many pieces on board', () => {
    // After ~10 full moves both sides still have most pieces – should be middlegame
    assert.equal(getGamePhase(START_FEN, 20), 'middlegame');
  });

  it('returns endgame when only kings and 2 rooks remain', () => {
    // No queens, 2 rooks total (≤ 6 major/minor pieces, 0 queens) → endgame
    const endgameFen = '4r3/8/4k3/8/8/4K3/8/4R3 w - - 0 60';
    assert.equal(getGamePhase(endgameFen, 40), 'endgame');
  });

  it('returns endgame when ≤ 4 major/minor pieces remain regardless of queens', () => {
    // 2 rooks total (≤ 4 major/minor pieces)
    const fewPiecesFen = '8/8/4k3/8/R7/4K3/8/r7 w - - 0 50';
    assert.equal(getGamePhase(fewPiecesFen, 30), 'endgame');
  });
});

describe('Stockfish Service – classifyTacticType', () => {
  it('returns null for null or (none) move', () => {
    assert.equal(classifyTacticType(null, START_FEN), null);
    assert.equal(classifyTacticType('(none)', START_FEN), null);
  });

  it('returns null for a quiet pawn push', () => {
    // e2e4 – no capture, no check, no fork (knight on e4 doesn't attack 2+ pieces from start)
    assert.equal(classifyTacticType('e2e4', START_FEN), null);
  });

  it('returns promotion for a pawn promotion move', () => {
    // White pawn on e7, black king far away – e7e8q
    const promotionFen = '8/4P3/8/8/8/8/8/4K2k w - - 0 1';
    assert.equal(classifyTacticType('e7e8q', promotionFen), 'promotion');
  });

  it('returns checkmate for a mating move', () => {
    // Scholar's mate position: Qh5xf7#
    const mateFen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    assert.equal(classifyTacticType('h5f7', mateFen), 'checkmate');
  });

  it('returns check for a checking move that is not checkmate', () => {
    // White queen on d1 moves to d7, checking the black king on d8.
    // The king can capture the queen (undefended), so it is not checkmate.
    const checkFen = '3k4/8/8/8/8/8/8/3Q3K w - - 0 1';
    assert.equal(classifyTacticType('d1d7', checkFen), 'check');
  });

  it('returns capture for a plain piece exchange (rook takes rook)', () => {
    // White rook on e1 captures the black rook on e4. The rook lands on e4 and
    // neither checks the black king on h5 (different rank and file) nor creates a fork.
    const captureFen = '8/8/8/7k/4r3/8/8/4R2K w - - 0 1';
    assert.equal(classifyTacticType('e1e4', captureFen), 'capture');
  });
});
